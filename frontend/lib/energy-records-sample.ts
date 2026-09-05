import {
  csvHeaders,
  requiredCsvHeaders,
  writableFields,
  type WritableField,
} from "@/lib/energy-record-fields";
import { deriveEnergyMetrics, type RawEnergyRecord } from "@/lib/energy-record-pipeline";

export const SAMPLE_CSV_FILENAME = "gridsense-sample-energy-records.csv";

export const expectedUploadFields = [
  {
    label: "Date",
    unit: "Year and month",
    columns: "year, month",
  },
  {
    label: "Grid Cost",
    unit: "₦",
    columns: "electricity_bill",
  },
  {
    label: "Diesel Cost",
    unit: "₦",
    columns: "diesel_cost",
  },
  {
    label: "Petrol Cost",
    unit: "₦",
    columns: "petrol_cost",
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

const SAMPLE_RAW_ROWS: RawEnergyRecord[] = [
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

function csvValue(value: string | number): string {
  const text = String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function buildSampleEnergyRecordsCsv(): string {
  const lines = [
    requiredCsvHeaders.join(","),
    ...SAMPLE_RAW_ROWS.map((raw) =>
      requiredCsvHeaders
        .map((header) => {
          const field = writableFields.find(
            (name) => csvHeaders[name] === header
          ) as WritableField | undefined;

          if (!field || !(field in raw)) {
            throw new Error(`Sample CSV is missing header mapping: ${header}`);
          }

          return csvValue(raw[field as keyof RawEnergyRecord]);
        })
        .join(",")
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export function buildSampleDerivedRecords() {
  let runningTotal = 0;

  return SAMPLE_RAW_ROWS.map((raw, index) => {
    const derived = deriveEnergyMetrics(raw);
    runningTotal += derived.totalEnergyCost;
    return {
      ...raw,
      ...deriveEnergyMetrics(raw, {
        averageMonthlyEnergyCost: runningTotal / (index + 1),
      }),
    };
  });
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
