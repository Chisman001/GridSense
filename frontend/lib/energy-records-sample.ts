import {
  csvHeaders,
  requiredCsvHeaders,
  writableFields,
  type WritableField,
} from "@/lib/energy-record-fields";
import { LEGACY_ENERGY_EFFICIENCY_SCORE } from "@/lib/ml-compat";

export const SAMPLE_CSV_FILENAME = "gridsense-sample-energy-records.csv";

export const expectedUploadFields = [
  {
    label: "Date",
    unit: "Year and month",
    columns: "year, month",
  },
  {
    label: "Energy Cost",
    unit: "₦",
    columns: "total_energy_cost",
  },
  {
    label: "Grid Cost",
    unit: "₦",
    columns: "electricity_bill",
  },
  {
    label: "Generator Cost",
    unit: "₦",
    columns: "diesel_cost",
  },
  {
    label: "Energy Consumption",
    unit: "kWh",
    columns: "energy_consumption_kwh",
  },
  {
    label: "Generator Hours",
    unit: "Hours",
    columns: "generator_hours",
  },
  {
    label: "Outage Hours",
    unit: "Hours",
    columns: "outage_hours",
  },
  {
    label: "Renewable Contribution",
    unit: "kW solar",
    columns: "solar_capacity_kw",
  },
] as const;

type SampleRawRow = {
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

const SAMPLE_RAW_ROWS: SampleRawRow[] = [
  {
    year: 2025,
    month: 1,
    energySource: "Hybrid",
    electricityBill: 248500,
    dieselCost: 112000,
    petrolCost: 9800,
    energyConsumptionKwh: 5120,
    fuelConsumptionLiters: 92,
    generatorHours: 52,
    gridHours: 248,
    outageHours: 41,
    operatingHours: 11,
    employees: 22,
    occupancyRate: 68,
    floorAreaSqm: 380,
    solarCapacityKw: 12,
    renewableEnergyPercentage: 15,
    maintenanceCost: 18500,
    monthlyRevenue: 3_200_000,
    weatherAvgTemp: 27.6,
  },
  {
    year: 2025,
    month: 2,
    energySource: "Hybrid",
    electricityBill: 231800,
    dieselCost: 126400,
    petrolCost: 11200,
    energyConsumptionKwh: 4980,
    fuelConsumptionLiters: 104,
    generatorHours: 61,
    gridHours: 214,
    outageHours: 48,
    operatingHours: 11,
    employees: 22,
    occupancyRate: 71,
    floorAreaSqm: 380,
    solarCapacityKw: 12,
    renewableEnergyPercentage: 15,
    maintenanceCost: 19200,
    monthlyRevenue: 3_200_000,
    weatherAvgTemp: 28.9,
  },
  {
    year: 2025,
    month: 3,
    energySource: "Hybrid",
    electricityBill: 265200,
    dieselCost: 98000,
    petrolCost: 8600,
    energyConsumptionKwh: 5380,
    fuelConsumptionLiters: 81,
    generatorHours: 44,
    gridHours: 262,
    outageHours: 33,
    operatingHours: 11,
    employees: 22,
    occupancyRate: 74,
    floorAreaSqm: 380,
    solarCapacityKw: 12,
    renewableEnergyPercentage: 15,
    maintenanceCost: 17600,
    monthlyRevenue: 3_200_000,
    weatherAvgTemp: 29.4,
  },
  {
    year: 2025,
    month: 4,
    energySource: "Hybrid",
    electricityBill: 272400,
    dieselCost: 108500,
    petrolCost: 9400,
    energyConsumptionKwh: 5560,
    fuelConsumptionLiters: 89,
    generatorHours: 49,
    gridHours: 255,
    outageHours: 38,
    operatingHours: 11,
    employees: 22,
    occupancyRate: 76,
    floorAreaSqm: 380,
    solarCapacityKw: 12,
    renewableEnergyPercentage: 15,
    maintenanceCost: 20100,
    monthlyRevenue: 3_200_000,
    weatherAvgTemp: 30.1,
  },
];

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function csvValue(value: string | number): string {
  const text = String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function buildSampleRecord(
  raw: SampleRawRow,
  averageMonthlyEnergyCost: number
): Record<WritableField, string | number> {
  const totalEnergyCost = raw.electricityBill + raw.dieselCost + raw.petrolCost;

  return {
    year: raw.year,
    month: raw.month,
    quarter: Math.floor((raw.month - 1) / 3) + 1,
    energySource: raw.energySource,
    electricityBill: raw.electricityBill,
    dieselCost: raw.dieselCost,
    petrolCost: raw.petrolCost,
    totalEnergyCost,
    energyConsumptionKwh: raw.energyConsumptionKwh,
    fuelConsumptionLiters: raw.fuelConsumptionLiters,
    generatorHours: raw.generatorHours,
    gridHours: raw.gridHours,
    outageHours: raw.outageHours,
    operatingHours: raw.operatingHours,
    employeeCount: raw.employees,
    employees: raw.employees,
    occupancyRate: raw.occupancyRate,
    floorAreaSqm: raw.floorAreaSqm,
    solarCapacityKw: raw.solarCapacityKw,
    renewableEnergyPercentage: raw.renewableEnergyPercentage,
    maintenanceCost: raw.maintenanceCost,
    monthlyRevenue: raw.monthlyRevenue,
    energyCostPerEmployee: roundTo(
      safeDivide(totalEnergyCost, raw.employees),
      4
    ),
    costPerKwh: roundTo(
      safeDivide(totalEnergyCost, raw.energyConsumptionKwh),
      4
    ),
    averageMonthlyEnergyCost: roundTo(averageMonthlyEnergyCost, 2),
    energyEfficiencyScore: LEGACY_ENERGY_EFFICIENCY_SCORE,
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
        raw.operatingHours * daysInMonth(raw.year, raw.month)
      ),
      6
    ),
    weatherAvgTemp: raw.weatherAvgTemp,
    estimatedCarbonIntensity: roundTo(
      safeDivide(raw.fuelConsumptionLiters, raw.energyConsumptionKwh),
      6
    ),
  };
}

function buildSampleRecords(): Array<Record<WritableField, string | number>> {
  let runningTotal = 0;

  return SAMPLE_RAW_ROWS.map((raw, index) => {
    const totalEnergyCost = raw.electricityBill + raw.dieselCost + raw.petrolCost;
    runningTotal += totalEnergyCost;
    return buildSampleRecord(raw, runningTotal / (index + 1));
  });
}

export function buildSampleEnergyRecordsCsv(): string {
  const records = buildSampleRecords();
  const lines = [
    requiredCsvHeaders.join(","),
    ...records.map((record) =>
      requiredCsvHeaders
        .map((header) => {
          const field = writableFields.find(
            (name) => csvHeaders[name] === header
          );

          if (!field) {
            throw new Error(`Sample CSV is missing header mapping: ${header}`);
          }

          return csvValue(record[field]);
        })
        .join(",")
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export function downloadSampleEnergyRecordsCsv(): void {
  const csv = buildSampleEnergyRecordsCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = SAMPLE_CSV_FILENAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
