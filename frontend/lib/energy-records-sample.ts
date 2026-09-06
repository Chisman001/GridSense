import { ABA_DEMO_RECORDS } from "@/lib/aba-demo-fixture";
import {
  csvHeaders,
  requiredCsvHeaders,
  writableFields,
  type WritableField,
} from "@/lib/energy-record-fields";
import { deriveEnergyMetrics, type RawEnergyRecord } from "@/lib/energy-record-pipeline";

export const SAMPLE_CSV_FILENAME = "aba-packaging-plastics-energy-records.csv";

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
    label: "Solar capacity",
    unit: "kW (0 in the Aba sample)",
    columns: "solar_capacity_kw",
  },
] as const;

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
    ...ABA_DEMO_RECORDS.map((raw) =>
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

  return ABA_DEMO_RECORDS.map((raw, index) => {
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

export function buildAbaDemoCsvFile(): File {
  return new File([buildSampleEnergyRecordsCsv()], SAMPLE_CSV_FILENAME, {
    type: "text/csv",
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
