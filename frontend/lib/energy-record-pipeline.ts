import {
  csvHeaders,
  legacyCsvHeaderSet,
  rawObservationFields,
  rawSnakeCaseAliases,
  requiredCsvHeaderSet,
  requiredCsvHeaders,
  type RawObservationField,
  type WritableField,
} from "@/lib/energy-record-contract";
import {
  calculateGES,
  daysInCalendarMonth,
  type GesV1Result,
} from "@/lib/ges-v1";

export { calculateGES };

export type RawEnergyRecord = {
  year: number;
  month: number;
  energySource: string;
  electricityBill: number;
  dieselCost: number;
  petrolCost: number;
  energyConsumptionKwh: number;
  fuelConsumptionLiters: number;
  generatorHours: number;
  gridHours: number;
  outageHours: number;
  operatingHours: number;
  employees: number;
  occupancyRate: number;
  floorAreaSqm: number;
  solarCapacityKw: number;
  renewableEnergyPercentage: number;
  maintenanceCost: number;
  monthlyRevenue: number;
  weatherAvgTemp: number;
};

export type DerivedEnergyMetrics = {
  quarter: number;
  totalEnergyCost: number;
  employeeCount: number;
  costPerKwh: number;
  energyCostPerEmployee: number;
  generatorDependency: number;
  revenueEnergyRatio: number;
  outageSeverity: number;
  estimatedCarbonIntensity: number;
  averageMonthlyEnergyCost: number;
  energyEfficiencyScore: number;
};

export type PersistedEnergyRecord = RawEnergyRecord & DerivedEnergyMetrics;

export type ValidationIssue = {
  field: WritableField;
  reason: string;
};

export type BusinessProfileFeatures = {
  businessType: string;
  industry: string;
  state: string;
};

export type CsvHeaderClassification = {
  rawHeaders: string[];
  legacyHeaders: string[];
  unknownHeaders: string[];
  missingRequired: string[];
  duplicateHeaders: string[];
};

export type ImportWarning = {
  type: "legacy_ignored" | "total_recalculated" | "unknown_ignored";
  columns?: string[];
  rows?: number[];
  message: string;
};

const integerRawFields = new Set<RawObservationField>([
  "year",
  "month",
  "employees",
]);

const signedRawFields = new Set<RawObservationField>(["weatherAvgTemp"]);

export function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

export function quarterFromMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

export function totalEnergyCostFromBills(
  electricityBill: number,
  dieselCost: number,
  petrolCost: number
): number {
  return electricityBill + dieselCost + petrolCost;
}

export function detectTotalCostMismatch(
  electricityBill: number,
  dieselCost: number,
  petrolCost: number,
  legacyTotal: number | undefined
): boolean {
  if (legacyTotal === undefined || !Number.isFinite(legacyTotal)) {
    return false;
  }

  return Math.abs(
    legacyTotal - totalEnergyCostFromBills(electricityBill, dieselCost, petrolCost)
  ) > 0.009;
}

export function nextAverageMonthlyEnergyCost(
  existingTotals: number[],
  incomingTotal: number
): number {
  const sum =
    existingTotals.reduce((total, value) => total + value, 0) + incomingTotal;
  return roundTo(sum / (existingTotals.length + 1), 2);
}

export function normalizeRawEnergyRecordInput(
  value: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const field of rawObservationFields) {
    if (value[field] !== undefined) {
      normalized[field] = value[field];
    }
  }

  for (const [alias, field] of Object.entries(rawSnakeCaseAliases)) {
    if (normalized[field] === undefined && value[alias] !== undefined) {
      normalized[field] = value[alias];
    }
  }

  return normalized;
}

export function validateRawEnergyRecord(
  value: unknown
):
  | { success: true; data: RawEnergyRecord }
  | { success: false; issues: ValidationIssue[] } {
  if (!isRecord(value)) {
    return {
      success: false,
      issues: [{ field: "year", reason: "Record must be an object" }],
    };
  }

  const raw = normalizeRawEnergyRecordInput(value);
  const issues: ValidationIssue[] = [];

  for (const field of rawObservationFields) {
    const fieldValue = raw[field];

    if (field === "energySource") {
      if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
        issues.push({
          field,
          reason: "Must be a non-empty string",
        });
      }
      continue;
    }

    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
      issues.push({ field, reason: "Must be a finite number" });
      continue;
    }

    if (integerRawFields.has(field) && !Number.isInteger(fieldValue)) {
      issues.push({ field, reason: "Must be an integer" });
      continue;
    }

    if (!signedRawFields.has(field) && fieldValue < 0) {
      issues.push({ field, reason: "Must be nonnegative" });
    }
  }

  const year = raw.year;
  const month = raw.month;
  const occupancyRate = raw.occupancyRate;
  const renewablePercentage = raw.renewableEnergyPercentage;

  if (
    typeof year === "number" &&
    Number.isInteger(year) &&
    (year < 2000 || year > 2100)
  ) {
    issues.push({ field: "year", reason: "Must be between 2000 and 2100" });
  }

  if (
    typeof month === "number" &&
    Number.isInteger(month) &&
    (month < 1 || month > 12)
  ) {
    issues.push({ field: "month", reason: "Must be between 1 and 12" });
  }

  if (
    typeof occupancyRate === "number" &&
    Number.isFinite(occupancyRate) &&
    (occupancyRate < 0 || occupancyRate > 100)
  ) {
    issues.push({
      field: "occupancyRate",
      reason: "Must be between 0 and 100",
    });
  }

  if (
    typeof renewablePercentage === "number" &&
    Number.isFinite(renewablePercentage) &&
    (renewablePercentage < 0 || renewablePercentage > 100)
  ) {
    issues.push({
      field: "renewableEnergyPercentage",
      reason: "Must be between 0 and 100",
    });
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: {
      year: raw.year as number,
      month: raw.month as number,
      energySource: (raw.energySource as string).trim(),
      electricityBill: raw.electricityBill as number,
      dieselCost: raw.dieselCost as number,
      petrolCost: raw.petrolCost as number,
      energyConsumptionKwh: raw.energyConsumptionKwh as number,
      fuelConsumptionLiters: raw.fuelConsumptionLiters as number,
      generatorHours: raw.generatorHours as number,
      gridHours: raw.gridHours as number,
      outageHours: raw.outageHours as number,
      operatingHours: raw.operatingHours as number,
      employees: raw.employees as number,
      occupancyRate: raw.occupancyRate as number,
      floorAreaSqm: raw.floorAreaSqm as number,
      solarCapacityKw: raw.solarCapacityKw as number,
      renewableEnergyPercentage: raw.renewableEnergyPercentage as number,
      maintenanceCost: raw.maintenanceCost as number,
      monthlyRevenue: raw.monthlyRevenue as number,
      weatherAvgTemp: raw.weatherAvgTemp as number,
    },
  };
}

export function deriveEnergyMetrics(
  raw: RawEnergyRecord,
  context?: { averageMonthlyEnergyCost?: number }
): DerivedEnergyMetrics {
  const totalEnergyCost = totalEnergyCostFromBills(
    raw.electricityBill,
    raw.dieselCost,
    raw.petrolCost
  );
  const ges = calculateGES({
    totalEnergyCost,
    monthlyRevenue: raw.monthlyRevenue,
    generatorHours: raw.generatorHours,
    gridHours: raw.gridHours,
    outageHours: raw.outageHours,
    operatingHours: raw.operatingHours,
    year: raw.year,
    month: raw.month,
  });

  return {
    quarter: quarterFromMonth(raw.month),
    totalEnergyCost,
    employeeCount: raw.employees,
    costPerKwh: roundTo(safeDivide(totalEnergyCost, raw.energyConsumptionKwh), 4),
    energyCostPerEmployee: roundTo(
      safeDivide(totalEnergyCost, raw.employees),
      4
    ),
    generatorDependency: roundTo(
      safeDivide(raw.generatorHours, raw.generatorHours + raw.gridHours),
      6
    ),
    revenueEnergyRatio: roundTo(
      safeDivide(raw.monthlyRevenue, totalEnergyCost),
      6
    ),
    outageSeverity: roundTo(
      safeDivide(
        raw.outageHours,
        raw.operatingHours * (daysInCalendarMonth(raw.year, raw.month) ?? 0)
      ),
      6
    ),
    estimatedCarbonIntensity: roundTo(
      safeDivide(raw.fuelConsumptionLiters, raw.energyConsumptionKwh),
      6
    ),
    averageMonthlyEnergyCost: roundTo(
      context?.averageMonthlyEnergyCost ?? totalEnergyCost,
      2
    ),
    energyEfficiencyScore: ges.available ? roundTo(ges.score, 4) : 0,
  };
}

export function withComputedGesCache(
  record: RawEnergyRecord & Omit<DerivedEnergyMetrics, "energyEfficiencyScore">
): PersistedEnergyRecord {
  const ges = calculateGES(record);

  return {
    ...record,
    energyEfficiencyScore: ges.available ? roundTo(ges.score, 4) : 0,
  };
}

export function buildPersistedEnergyRecord(
  raw: RawEnergyRecord,
  context?: { averageMonthlyEnergyCost?: number }
): { record: PersistedEnergyRecord; ges: GesV1Result } {
  const derived = deriveEnergyMetrics(raw, context);
  const record = {
    ...raw,
    ...derived,
  };
  const ges = calculateGES(record);

  return {
    record: {
      ...record,
      energyEfficiencyScore: ges.available ? roundTo(ges.score, 4) : 0,
    },
    ges,
  };
}

export function buildMlPredictionPayload(
  raw: RawEnergyRecord,
  profile: BusinessProfileFeatures,
  context?: { averageMonthlyEnergyCost?: number }
): Record<string, string | number> {
  const { record } = buildPersistedEnergyRecord(raw, context);

  return {
    business_type: profile.businessType,
    industry: profile.industry,
    state: profile.state,
    energy_source: record.energySource,
    year: record.year,
    month: record.month,
    quarter: record.quarter,
    electricity_bill: record.electricityBill,
    diesel_cost: record.dieselCost,
    petrol_cost: record.petrolCost,
    total_energy_cost: record.totalEnergyCost,
    energy_consumption_kwh: record.energyConsumptionKwh,
    fuel_consumption_liters: record.fuelConsumptionLiters,
    generator_hours: record.generatorHours,
    grid_hours: record.gridHours,
    outage_hours: record.outageHours,
    operating_hours: record.operatingHours,
    employees: record.employees,
    employee_count: record.employees,
    occupancy_rate: record.occupancyRate,
    floor_area_sqm: record.floorAreaSqm,
    solar_capacity_kw: record.solarCapacityKw,
    renewable_energy_percentage: record.renewableEnergyPercentage,
    maintenance_cost: record.maintenanceCost,
    monthly_revenue: record.monthlyRevenue,
    weather_avg_temp: record.weatherAvgTemp,
    cost_per_kwh: record.costPerKwh,
    energy_cost_per_employee: record.energyCostPerEmployee,
    generator_dependency: record.generatorDependency,
    revenue_energy_ratio: record.revenueEnergyRatio,
    outage_severity: record.outageSeverity,
    estimated_carbon_intensity: record.estimatedCarbonIntensity,
    average_monthly_energy_cost: record.averageMonthlyEnergyCost,
    energy_efficiency_score: record.energyEfficiencyScore,
  };
}

export function classifyCsvHeaders(headers: string[]): CsvHeaderClassification {
  const seenHeaders = new Set<string>();
  const duplicateHeaders: string[] = [];
  const rawHeaders: string[] = [];
  const legacyHeaders: string[] = [];
  const unknownHeaders: string[] = [];

  for (const header of headers) {
    if (seenHeaders.has(header)) {
      duplicateHeaders.push(header);
      continue;
    }

    seenHeaders.add(header);

    if (requiredCsvHeaderSet.has(header)) {
      rawHeaders.push(header);
    } else if (legacyCsvHeaderSet.has(header)) {
      legacyHeaders.push(header);
    } else if (header.length > 0) {
      unknownHeaders.push(header);
    }
  }

  return {
    rawHeaders,
    legacyHeaders,
    unknownHeaders,
    missingRequired: requiredCsvHeaders.filter((header) => !seenHeaders.has(header)),
    duplicateHeaders,
  };
}

export function buildImportWarnings(
  classification: CsvHeaderClassification,
  recalculatedRows: number[]
): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  if (classification.legacyHeaders.length > 0) {
    warnings.push({
      type: "legacy_ignored",
      columns: classification.legacyHeaders,
      message: `${classification.legacyHeaders.length} calculated column${
        classification.legacyHeaders.length === 1 ? " was" : "s were"
      } ignored and recalculated automatically.`,
    });
  }

  if (recalculatedRows.length > 0) {
    warnings.push({
      type: "total_recalculated",
      rows: recalculatedRows,
      message:
        "total_energy_cost was recalculated from electricity, diesel, and petrol costs.",
    });
  }

  if (classification.unknownHeaders.length > 0) {
    warnings.push({
      type: "unknown_ignored",
      columns: classification.unknownHeaders,
      message: `${classification.unknownHeaders.length} unrecognized column${
        classification.unknownHeaders.length === 1 ? " was" : "s were"
      } ignored.`,
    });
  }

  return warnings;
}

export function csvRowToPayload(
  headers: string[],
  values: string[]
): Record<string, unknown> {
  const byHeader = new Map(
    headers.map((header, index) => [header, values[index] ?? ""])
  );

  return Object.fromEntries(
    rawObservationFields.map((field) => {
      const rawValue = byHeader.get(csvHeaders[field]) ?? "";
      return [
        field,
        field === "energySource"
          ? rawValue.trim()
          : rawValue.trim().length === 0
            ? Number.NaN
            : Number(rawValue),
      ];
    })
  );
}

export function readOptionalCsvNumber(
  headers: string[],
  values: string[],
  header: string
): number | undefined {
  const index = headers.indexOf(header);
  if (index < 0) {
    return undefined;
  }

  const rawValue = (values[index] ?? "").trim();
  if (rawValue.length === 0) {
    return undefined;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}
