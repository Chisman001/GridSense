/**
 * Authoritative Energy Record field contract.
 *
 * RAW: observations a business reports.
 * DERIVED: values GridSense calculates. Never user-editable.
 * LEGACY: old CSV / API columns that may appear but are ignored and recomputed.
 */

export const rawObservationFields = [
  "year",
  "month",
  "energySource",
  "electricityBill",
  "dieselCost",
  "petrolCost",
  "energyConsumptionKwh",
  "fuelConsumptionLiters",
  "generatorHours",
  "gridHours",
  "outageHours",
  "operatingHours",
  "employees",
  "occupancyRate",
  "floorAreaSqm",
  "solarCapacityKw",
  "renewableEnergyPercentage",
  "maintenanceCost",
  "monthlyRevenue",
  "weatherAvgTemp",
] as const;

export const derivedMetricFields = [
  "quarter",
  "totalEnergyCost",
  "employeeCount",
  "costPerKwh",
  "energyCostPerEmployee",
  "generatorDependency",
  "revenueEnergyRatio",
  "outageSeverity",
  "estimatedCarbonIntensity",
  "averageMonthlyEnergyCost",
  "energyEfficiencyScore",
] as const;

export const persistedEnergyRecordFields = [
  ...rawObservationFields,
  ...derivedMetricFields,
] as const;

export type RawObservationField = (typeof rawObservationFields)[number];
export type DerivedMetricField = (typeof derivedMetricFields)[number];
export type PersistedEnergyRecordField =
  (typeof persistedEnergyRecordFields)[number];

export const rawWritableFields = rawObservationFields;
export const derivedWritableFields = derivedMetricFields;
export const writableFields = persistedEnergyRecordFields;

export type RawWritableField = RawObservationField;
export type DerivedWritableField = DerivedMetricField;
export type WritableField = PersistedEnergyRecordField;

export const csvHeaders: Record<WritableField, string> = {
  year: "year",
  month: "month",
  quarter: "quarter",
  energySource: "energy_source",
  electricityBill: "electricity_bill",
  dieselCost: "diesel_cost",
  petrolCost: "petrol_cost",
  totalEnergyCost: "total_energy_cost",
  energyConsumptionKwh: "energy_consumption_kwh",
  fuelConsumptionLiters: "fuel_consumption_liters",
  generatorHours: "generator_hours",
  gridHours: "grid_hours",
  outageHours: "outage_hours",
  operatingHours: "operating_hours",
  employeeCount: "employee_count",
  employees: "employees",
  occupancyRate: "occupancy_rate",
  floorAreaSqm: "floor_area_sqm",
  solarCapacityKw: "solar_capacity_kw",
  renewableEnergyPercentage: "renewable_energy_percentage",
  maintenanceCost: "maintenance_cost",
  monthlyRevenue: "monthly_revenue",
  energyCostPerEmployee: "energy_cost_per_employee",
  costPerKwh: "cost_per_kwh",
  averageMonthlyEnergyCost: "average_monthly_energy_cost",
  energyEfficiencyScore: "energy_efficiency_score",
  generatorDependency: "generator_dependency",
  revenueEnergyRatio: "revenue_energy_ratio",
  outageSeverity: "outage_severity",
  weatherAvgTemp: "weather_avg_temp",
  estimatedCarbonIntensity: "estimated_carbon_intensity",
};

export const requiredCsvHeaders = rawObservationFields.map(
  (field) => csvHeaders[field]
);

export const legacyCsvHeaders = [
  "quarter",
  "employee_count",
  "total_energy_cost",
  "energy_cost_per_employee",
  "cost_per_kwh",
  "average_monthly_energy_cost",
  "energy_efficiency_score",
  "generator_dependency",
  "revenue_energy_ratio",
  "outage_severity",
  "estimated_carbon_intensity",
] as const;

export const optionalCsvHeaders = legacyCsvHeaders;

export const legacyCsvHeaderSet = new Set<string>(legacyCsvHeaders);
export const requiredCsvHeaderSet = new Set<string>(requiredCsvHeaders);

export const rawSnakeCaseAliases: Record<string, RawObservationField> = {
  year: "year",
  month: "month",
  energy_source: "energySource",
  electricity_bill: "electricityBill",
  diesel_cost: "dieselCost",
  petrol_cost: "petrolCost",
  energy_consumption_kwh: "energyConsumptionKwh",
  fuel_consumption_liters: "fuelConsumptionLiters",
  generator_hours: "generatorHours",
  grid_hours: "gridHours",
  outage_hours: "outageHours",
  operating_hours: "operatingHours",
  operating_hours_per_day: "operatingHours",
  employees: "employees",
  occupancy_rate: "occupancyRate",
  floor_area_sqm: "floorAreaSqm",
  solar_capacity_kw: "solarCapacityKw",
  renewable_energy_percentage: "renewableEnergyPercentage",
  maintenance_cost: "maintenanceCost",
  monthly_revenue: "monthlyRevenue",
  weather_avg_temp: "weatherAvgTemp",
};
