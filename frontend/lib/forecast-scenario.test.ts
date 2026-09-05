import assert from "node:assert/strict";

import { deriveEnergyMetrics } from "./energy-record-pipeline";
import {
  annualizeScenarioDelta,
  applyGeneratorHoursScenario,
  buildForecastDrivers,
  buildScenarioExplanation,
  computeScenarioDelta,
  rawEnergyRecordsEqual,
} from "./forecast-scenario";
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
  electricityBill: 150_000,
  dieselCost: 250_000,
  petrolCost: 50_000,
  energyConsumptionKwh: 2_000,
  fuelConsumptionLiters: 500,
  generatorHours: 240,
  gridHours: 300,
  outageHours: 48,
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

run("20% reduction scales generator hours, diesel, and fuel", () => {
  const { scenarioRaw, adjustments } = applyGeneratorHoursScenario(rawBase, 20);

  assert.equal(scenarioRaw.generatorHours, 192);
  assert.equal(scenarioRaw.dieselCost, 200_000);
  assert.equal(scenarioRaw.fuelConsumptionLiters, 400);
  assert.equal(scenarioRaw.gridHours, rawBase.gridHours);
  assert.equal(scenarioRaw.electricityBill, rawBase.electricityBill);
  assert.equal(scenarioRaw.petrolCost, rawBase.petrolCost);
  assert.equal(scenarioRaw.outageHours, rawBase.outageHours);

  assert.deepEqual(
    adjustments.map((item) => [item.field, item.before, item.after]),
    [
      ["generatorHours", 240, 192],
      ["dieselCost", 250_000, 200_000],
      ["fuelConsumptionLiters", 500, 400],
    ]
  );
});

run("0% reduction returns an identical raw payload", () => {
  const { scenarioRaw } = applyGeneratorHoursScenario(rawBase, 0);
  assert.ok(rawEnergyRecordsEqual(scenarioRaw, rawBase));
});

run("scenario delta is negative when the scenario cost falls", () => {
  assert.equal(computeScenarioDelta(520_000, 455_000), -65_000);
  assert.equal(annualizeScenarioDelta(-65_000), -780_000);
});

run("scenario delta is positive when the scenario cost rises", () => {
  assert.equal(computeScenarioDelta(400_000, 450_000), 50_000);
  assert.equal(annualizeScenarioDelta(50_000), 600_000);
});

run("drivers pick the largest cost component", () => {
  const derived = deriveEnergyMetrics(rawBase);
  const ges = calculateGES({
    totalEnergyCost: derived.totalEnergyCost,
    monthlyRevenue: rawBase.monthlyRevenue,
    generatorHours: rawBase.generatorHours,
    gridHours: rawBase.gridHours,
    outageHours: rawBase.outageHours,
    operatingHours: rawBase.operatingHours,
    year: rawBase.year,
    month: rawBase.month,
  });
  const drivers = buildForecastDrivers(rawBase, derived, ges);
  const costDriver = drivers.find((driver) => driver.id === "largest-cost");

  assert.ok(costDriver);
  assert.match(costDriver.detail, /Diesel represents 55\.6% of current energy cost/);
  assert.ok(drivers.some((driver) => driver.id === "generator-dependency"));
  assert.ok(drivers.some((driver) => driver.id === "outage-hours"));
});

run("scenario explanation includes the reduction and both costs", () => {
  const explanation = buildScenarioExplanation({
    reductionPercent: 20,
    baselineCost: 520_000,
    scenarioCost: 455_000,
  });

  assert.match(explanation, /20%/);
  assert.match(explanation, /₦520,000/);
  assert.match(explanation, /₦455,000/);
  assert.match(explanation, /falls/);
});
