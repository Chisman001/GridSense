import assert from "node:assert/strict";

import { requiredCsvHeaders } from "./energy-record-contract";
import {
  buildImportWarnings,
  buildMlPredictionPayload,
  buildPersistedEnergyRecord,
  classifyCsvHeaders,
  csvRowToPayload,
  deriveEnergyMetrics,
  detectTotalCostMismatch,
  nextAverageMonthlyEnergyCost,
  readOptionalCsvNumber,
  totalEnergyCostFromBills,
  validateRawEnergyRecord,
} from "./energy-record-pipeline";
import { calculateGES } from "./ges-v1";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const rawBase = {
  year: 2025,
  month: 3,
  energySource: "Hybrid",
  electricityBill: 100_000,
  dieselCost: 150_000,
  petrolCost: 50_000,
  energyConsumptionKwh: 2_000,
  fuelConsumptionLiters: 80,
  generatorHours: 180,
  gridHours: 300,
  outageHours: 20,
  operatingHours: 12,
  employees: 10,
  occupancyRate: 70,
  floorAreaSqm: 250,
  solarCapacityKw: 8,
  renewableEnergyPercentage: 12,
  maintenanceCost: 15_000,
  monthlyRevenue: 2_000_000,
  weatherAvgTemp: 28,
};

run("total energy cost is always the sum of the three bills", () => {
  assert.equal(totalEnergyCostFromBills(100_000, 150_000, 50_000), 300_000);
});

run("derived generator dependency uses raw hours", () => {
  const derived = deriveEnergyMetrics(rawBase);
  assert.equal(derived.totalEnergyCost, 300_000);
  assert.equal(derived.generatorDependency, 0.375);
  assert.equal(derived.employeeCount, 10);
  assert.equal(derived.quarter, 1);
});

run("changing generator hours changes dependency and GES", () => {
  const baseline = deriveEnergyMetrics({
    ...rawBase,
    generatorHours: 20,
  });
  const increased = deriveEnergyMetrics({
    ...rawBase,
    generatorHours: 180,
  });

  assert.ok(increased.generatorDependency > baseline.generatorDependency);
  assert.notEqual(
    increased.energyEfficiencyScore,
    baseline.energyEfficiencyScore
  );
  assert.notEqual(increased.energyEfficiencyScore, 75);
});

run("GES cache is written from calculateGES, never 75", () => {
  const { record, ges } = buildPersistedEnergyRecord(rawBase);
  assert.equal(record.energyEfficiencyScore === 75, false);
  assert.equal(ges.available, true);
  if (ges.available) {
    assert.equal(record.energyEfficiencyScore, Number(ges.score.toFixed(4)));
  }
});

run("client-supplied totals are ignored during validation", () => {
  const validation = validateRawEnergyRecord({
    ...rawBase,
    totalEnergyCost: 500_000,
    energy_efficiency_score: 75,
  });
  assert.equal(validation.success, true);
  if (validation.success) {
    const derived = deriveEnergyMetrics(validation.data);
    assert.equal(derived.totalEnergyCost, 300_000);
  }
});

run("snake_case forecast payloads normalize to RAW fields", () => {
  const validation = validateRawEnergyRecord({
    year: 2025,
    month: 3,
    energy_source: "Hybrid",
    electricity_bill: 100_000,
    diesel_cost: 150_000,
    petrol_cost: 50_000,
    energy_consumption_kwh: 2_000,
    fuel_consumption_liters: 80,
    generator_hours: 180,
    grid_hours: 300,
    outage_hours: 20,
    operating_hours: 12,
    employees: 10,
    occupancy_rate: 70,
    floor_area_sqm: 250,
    solar_capacity_kw: 8,
    renewable_energy_percentage: 12,
    maintenance_cost: 15_000,
    monthly_revenue: 2_000_000,
    weather_avg_temp: 28,
  });
  assert.equal(validation.success, true);
});

run("ML payload uses recomputed derived features", () => {
  const payload = buildMlPredictionPayload(rawBase, {
    businessType: "Printing Press",
    industry: "Manufacturing",
    state: "Abia",
  });
  assert.equal(payload.total_energy_cost, 300_000);
  assert.equal(payload.generator_dependency, 0.375);
  assert.equal(payload.employee_count, 10);
  assert.notEqual(payload.energy_efficiency_score, 75);
});

run("new clean RAW CSV headers have no warnings", () => {
  const classification = classifyCsvHeaders([...requiredCsvHeaders]);
  assert.deepEqual(classification.missingRequired, []);
  assert.deepEqual(classification.legacyHeaders, []);
  assert.deepEqual(classification.unknownHeaders, []);
  assert.deepEqual(buildImportWarnings(classification, []), []);
});

run("legacy derived columns are ignored and warned", () => {
  const classification = classifyCsvHeaders([
    ...requiredCsvHeaders,
    "total_energy_cost",
    "cost_per_kwh",
    "energy_efficiency_score",
  ]);
  const warnings = buildImportWarnings(classification, []);
  assert.equal(classification.legacyHeaders.includes("total_energy_cost"), true);
  assert.equal(warnings.some((warning) => warning.type === "legacy_ignored"), true);
});

run("unknown columns are warned, not fatal", () => {
  const classification = classifyCsvHeaders([
    ...requiredCsvHeaders,
    "foo",
    "customer_comment",
  ]);
  const warnings = buildImportWarnings(classification, []);
  assert.deepEqual(classification.unknownHeaders, ["foo", "customer_comment"]);
  assert.equal(warnings.some((warning) => warning.type === "unknown_ignored"), true);
});

run("contradictory legacy total is detected and discarded", () => {
  assert.equal(
    detectTotalCostMismatch(100_000, 150_000, 50_000, 500_000),
    true
  );
  assert.equal(
    detectTotalCostMismatch(100_000, 150_000, 50_000, 300_000),
    false
  );
});

run("CSV row payload reads RAW only and ignores legacy total", () => {
  const headers = [...requiredCsvHeaders, "total_energy_cost"];
  const values: string[] = requiredCsvHeaders.map((header) => {
    if (header === "year") return "2025";
    if (header === "month") return "3";
    if (header === "energy_source") return "Hybrid";
    if (header === "electricity_bill") return "100000";
    if (header === "diesel_cost") return "150000";
    if (header === "petrol_cost") return "50000";
    if (header === "employees") return "10";
    return "1";
  });
  values.push("500000");

  const payload = csvRowToPayload(headers, values);
  const validation = validateRawEnergyRecord(payload);
  assert.equal(validation.success, true);
  if (validation.success) {
    assert.equal(
      deriveEnergyMetrics(validation.data).totalEnergyCost,
      300_000
    );
  }
  assert.equal(readOptionalCsvNumber(headers, values, "total_energy_cost"), 500_000);
});

run("invalid RAW CSV is rejected", () => {
  const validation = validateRawEnergyRecord({
    ...rawBase,
    electricityBill: "not-a-number",
  });
  assert.equal(validation.success, false);
});

run("missing required CSV header is reported", () => {
  const classification = classifyCsvHeaders(
    requiredCsvHeaders.filter((header) => header !== "electricity_bill")
  );
  assert.deepEqual(classification.missingRequired, ["electricity_bill"]);
});

run("average monthly energy cost is a running mean", () => {
  assert.equal(nextAverageMonthlyEnergyCost([200_000], 400_000), 300_000);
});

run("calculateGES matches persisted GES cache", () => {
  const { record } = buildPersistedEnergyRecord(rawBase);
  const ges = calculateGES(record);
  assert.equal(ges.available, true);
  if (ges.available) {
    assert.equal(record.energyEfficiencyScore, Number(ges.score.toFixed(4)));
  }
});

console.log("All energy-record pipeline tests passed.");
