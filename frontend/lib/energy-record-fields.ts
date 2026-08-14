export const rawWritableFields = [
  "year",
  "month",
  "quarter",
  "energySource",
  "electricityBill",
  "dieselCost",
  "petrolCost",
  "totalEnergyCost",
  "energyConsumptionKwh",
  "fuelConsumptionLiters",
  "generatorHours",
  "gridHours",
  "outageHours",
  "operatingHours",
  "employeeCount",
  "employees",
  "occupancyRate",
  "floorAreaSqm",
  "solarCapacityKw",
  "renewableEnergyPercentage",
  "maintenanceCost",
  "monthlyRevenue",
  "weatherAvgTemp",
  "estimatedCarbonIntensity",
] as const;

export const derivedWritableFields = [
  "energyCostPerEmployee",
  "costPerKwh",
  "averageMonthlyEnergyCost",
  "energyEfficiencyScore",
  "generatorDependency",
  "revenueEnergyRatio",
  "outageSeverity",
] as const;

export const writableFields = [
  ...rawWritableFields,
  ...derivedWritableFields,
] as const;

export type RawWritableField = (typeof rawWritableFields)[number];
export type DerivedWritableField = (typeof derivedWritableFields)[number];
export type WritableField = (typeof writableFields)[number];

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

export const requiredCsvHeaders = rawWritableFields.map(
  (field) => csvHeaders[field]
);

export const optionalCsvHeaders = derivedWritableFields.map(
  (field) => csvHeaders[field]
);
