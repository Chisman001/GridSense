"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";

import { GesReadout } from "@/components/ges-readout";
import {
  cardClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "@/components/ui/button-styles";
import { PageHeader } from "@/components/ui/page-header";
import {
  downloadSampleEnergyRecordsCsv,
  expectedUploadFields,
} from "@/lib/energy-records-sample";
import { calculateGES } from "@/lib/ges-v1";
import {
  deriveEnergyMetrics,
  totalEnergyCostFromBills,
  type ImportWarning,
} from "@/lib/energy-record-pipeline";
import { rawObservationFields, type RawObservationField } from "@/lib/energy-record-fields";

type WritableField = RawObservationField;

type EnergyRecord = {
  id: string;
  businessId: string;
  year: number;
  month: number;
  quarter: number;
  energySource: string;
  electricityBill: number;
  dieselCost: number;
  petrolCost: number;
  totalEnergyCost: number;
  energyConsumptionKwh: number;
  fuelConsumptionLiters: number;
  generatorHours: number;
  gridHours: number;
  outageHours: number;
  operatingHours: number;
  employees: number;
  employeeCount: number;
  occupancyRate: number;
  floorAreaSqm: number;
  solarCapacityKw: number;
  renewableEnergyPercentage: number;
  maintenanceCost: number;
  monthlyRevenue: number;
  energyCostPerEmployee: number;
  costPerKwh: number;
  averageMonthlyEnergyCost: number;
  energyEfficiencyScore: number;
  generatorDependency: number;
  revenueEnergyRatio: number;
  outageSeverity: number;
  weatherAvgTemp: number;
  estimatedCarbonIntensity: number;
  createdAt: string;
  hasLinkedPrediction: boolean;
};

type FormValues = Record<WritableField, string>;

type FieldDefinition = {
  name: WritableField;
  label: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

type FieldGroup = {
  title: string;
  description: string;
  fields: FieldDefinition[];
};

type ImportForecastTarget = {
  id: string;
  year: number;
  month: number;
  count: number;
};

type ImportError = {
  row: number;
  reason: string;
  field?: string;
};

type DialogState =
  | { type: "form"; record: EnergyRecord | null }
  | { type: "delete"; record: EnergyRecord }
  | null;

const CURRENT_YEAR = new Date().getFullYear();

const FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Reporting period",
    description: "Identify the month and primary energy source.",
    fields: [
      { name: "year", label: "Year", min: 2000, max: 2100 },
      { name: "month", label: "Month", min: 1, max: 12 },
      {
        name: "energySource",
        label: "Energy source",
        type: "text",
        placeholder: "e.g. Grid, Diesel & Solar",
      },
    ],
  },
  {
    title: "Costs and consumption",
    description: "Enter the bills and measured consumption GridSense uses to calculate totals.",
    fields: [
      { name: "electricityBill", label: "Electricity bill (₦)", min: 0, step: 0.01 },
      { name: "dieselCost", label: "Diesel cost (₦)", min: 0, step: 0.01 },
      { name: "petrolCost", label: "Petrol cost (₦)", min: 0, step: 0.01 },
      {
        name: "energyConsumptionKwh",
        label: "Energy consumption (kWh)",
        min: 0,
        step: 0.01,
      },
      {
        name: "fuelConsumptionLiters",
        label: "Fuel consumption (litres)",
        min: 0,
        step: 0.01,
      },
    ],
  },
  {
    title: "Operations and reliability",
    description: "Capture operating time and power availability.",
    fields: [
      { name: "generatorHours", label: "Generator hours", min: 0, step: 0.01 },
      { name: "gridHours", label: "Grid hours", min: 0, step: 0.01 },
      { name: "outageHours", label: "Outage hours", min: 0, step: 0.01 },
      { name: "operatingHours", label: "Operating Hours per Day", min: 0, step: 0.01 },
    ],
  },
  {
    title: "Business activity",
    description: "Add the operating scale and financial context.",
    fields: [
      { name: "employees", label: "Employees", min: 0 },
      { name: "occupancyRate", label: "Occupancy rate (%)", min: 0, max: 100, step: 0.01 },
      { name: "floorAreaSqm", label: "Floor area (m²)", min: 0, step: 0.01 },
      { name: "maintenanceCost", label: "Maintenance cost (₦)", min: 0, step: 0.01 },
      { name: "monthlyRevenue", label: "Monthly revenue (₦)", min: 0, step: 0.01 },
    ],
  },
  {
    title: "Efficiency and sustainability",
    description: "Record renewable capacity and environmental indicators.",
    fields: [
      { name: "solarCapacityKw", label: "Solar capacity (kW)", min: 0, step: 0.01 },
      {
        name: "renewableEnergyPercentage",
        label: "Renewable energy (%)",
        min: 0,
        max: 100,
        step: 0.01,
      },
      { name: "weatherAvgTemp", label: "Average temperature (°C)", step: 0.01 },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

function emptyForm(): FormValues {
  const values = Object.fromEntries(
    ALL_FIELDS.map(({ name }) => [name, ""])
  ) as FormValues;
  values.year = String(CURRENT_YEAR);
  values.month = String(new Date().getMonth() + 1);
  return values;
}

function formFromRecord(record: EnergyRecord): FormValues {
  return Object.fromEntries(
    ALL_FIELDS.map(({ name }) => [name, String(record[name])])
  ) as FormValues;
}

function toRequestBody(values: FormValues): Record<string, string | number> {
  return Object.fromEntries(
    ALL_FIELDS.map(({ name, type }) => [
      name,
      type === "text" ? values[name].trim() : Number(values[name]),
    ])
  );
}

function rawFromForm(values: FormValues) {
  return Object.fromEntries(
    rawObservationFields.map((field) => [
      field,
      field === "energySource"
        ? values[field].trim()
        : Number(values[field]),
    ])
  ) as Parameters<typeof deriveEnergyMetrics>[0];
}

function gesFromForm(values: FormValues) {
  const raw = rawFromForm(values);
  return calculateGES({
    ...raw,
    totalEnergyCost: totalEnergyCostFromBills(
      raw.electricityBill,
      raw.dieselCost,
      raw.petrolCost
    ),
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickLatestImportedRecord(
  records: Array<{ id: string; year: number; month: number }>
) {
  if (records.length === 0) {
    return null;
  }

  return [...records].sort(
    (left, right) => right.year * 12 + right.month - (left.year * 12 + left.month)
  )[0];
}

function parseImportedRecords(
  payload: unknown
): Array<{ id: string; year: number; month: number }> {
  if (!isObject(payload) || !Array.isArray(payload.records)) {
    return [];
  }

  return payload.records.flatMap((item) => {
    if (
      !isObject(item) ||
      typeof item.id !== "string" ||
      typeof item.year !== "number" ||
      typeof item.month !== "number"
    ) {
      return [];
    }

    return [{ id: item.id, year: item.year, month: item.month }];
  });
}

function isEnergyRecord(value: unknown): value is EnergyRecord {
  if (!isObject(value) || typeof value.id !== "string") return false;
  if (
    typeof value.businessId !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.hasLinkedPrediction !== "boolean"
  ) {
    return false;
  }

  const persistedNumericFields = [
    ...rawObservationFields.filter((field) => field !== "energySource"),
    "quarter",
    "totalEnergyCost",
    "employeeCount",
    "energyCostPerEmployee",
    "costPerKwh",
    "averageMonthlyEnergyCost",
    "energyEfficiencyScore",
    "generatorDependency",
    "revenueEnergyRatio",
    "outageSeverity",
    "estimatedCarbonIntensity",
  ] as const;

  return (
    typeof value.energySource === "string" &&
    persistedNumericFields.every((field) => typeof value[field] === "number")
  );
}

function parseRecords(payload: unknown): EnergyRecord[] {
  if (
    !isObject(payload) ||
    payload.success !== true ||
    !Array.isArray(payload.records) ||
    !payload.records.every(isEnergyRecord)
  ) {
    throw new Error("The server returned an invalid energy records response.");
  }

  return [...payload.records].sort((a, b) => {
    const periodDifference = b.year * 12 + b.month - (a.year * 12 + a.month);
    return periodDifference || Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

function statusMessage(status: number, payload: unknown, fallback: string): string {
  if (isObject(payload) && typeof payload.error === "string") return payload.error;
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 404:
      return "The requested energy record could not be found.";
    case 409:
      return "A record for this reporting period already exists.";
    case 500:
      return "The server could not complete the request. Please try again.";
    default:
      return fallback;
  }
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The server returned an invalid response.");
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits }).format(value);
}

function formatPeriod(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: "plus" | "upload" | "download" | "forecast" | "edit" | "trash" | "database" | "close" | "filter";
  className?: string;
}) {
  const paths: Record<typeof name, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
    upload: (
      <>
        <path d="m8 9 4-4 4 4M12 5v10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 15v4h14v-4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    download: (
      <>
        <path d="M12 5v10M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19h14" strokeLinecap="round" />
      </>
    ),
    forecast: (
      <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-7" strokeLinecap="round" strokeLinejoin="round" />
    ),
    edit: (
      <>
        <path d="m14 5 5 5M4 20l3.5-.7L19 7.8a2 2 0 0 0-2.8-2.8L4.7 16.5 4 20Z" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" strokeLinecap="round" />
        <path d="M10 11v5M14 11v5" strokeLinecap="round" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />,
    filter: (
      <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" strokeLinecap="round" strokeLinejoin="round" />
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      }`}
    >
      {children}
    </div>
  );
}

function RecordActions({
  record,
  onEdit,
  onDelete,
}: {
  record: EnergyRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lockedTitle = record.hasLinkedPrediction
    ? "This record is linked to a forecast and cannot be changed or deleted."
    : undefined;

  return (
    <div className="flex items-center gap-1.5">
      {!record.hasLinkedPrediction && (
        <Link
          href={`/forecast?recordId=${encodeURIComponent(record.id)}`}
          title="Forecast this month"
          aria-label={`Forecast ${formatPeriod(record.year, record.month)}`}
          className="hidden h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:inline-flex dark:border-slate-700 dark:text-slate-400 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
        >
          <Icon name="forecast" />
        </Link>
      )}
      <button
        type="button"
        onClick={onEdit}
        disabled={record.hasLinkedPrediction}
        title={lockedTitle ?? "Edit record"}
        aria-label={`Edit ${formatPeriod(record.year, record.month)} record`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600"
      >
        <Icon name="edit" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={record.hasLinkedPrediction}
        title={lockedTitle ?? "Delete record"}
        aria-label={`Delete ${formatPeriod(record.year, record.month)} record`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600"
      >
        <Icon name="trash" />
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
        <div className="h-11 animate-pulse border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="grid grid-cols-7 gap-6 border-b border-slate-100 p-5 last:border-0 dark:border-slate-800">
            {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
              <div key={cell} className="h-4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-5 h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="mt-3 h-4 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </>
  );
}

export default function EnergyRecordsPage() {
  const [records, setRecords] = useState<EnergyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [importForecastTarget, setImportForecastTarget] =
    useState<ImportForecastTarget | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importWarnings, setImportWarnings] = useState<ImportWarning[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formGes = dialog?.type === "form" ? gesFromForm(form) : null;
  const formDerived =
    dialog?.type === "form" ? deriveEnergyMetrics(rawFromForm(form)) : null;

  const loadRecords = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams();
    if (yearFilter) params.set("year", yearFilter);
    if (monthFilter) params.set("month", monthFilter);
    if (sourceFilter.trim()) params.set("source", sourceFilter.trim());

    try {
      const response = await fetch(
        `/api/energy-records${params.size ? `?${params.toString()}` : ""}`,
        { headers: { Accept: "application/json" }, cache: "no-store", signal }
      );
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(statusMessage(response.status, payload, "Energy records could not be loaded."));
      }
      setRecords(parseRecords(payload));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(
        error instanceof TypeError
          ? "We could not reach the server. Check your connection and try again."
          : error instanceof Error
            ? error.message
            : "Energy records could not be loaded."
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [monthFilter, sourceFilter, yearFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadRecords(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadRecords]);

  function openForm(record: EnergyRecord | null) {
    setForm(record ? formFromRecord(record) : emptyForm());
    setActionError("");
    setDialog({ type: "form", record });
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.type !== "form") return;
    const editingRecord = dialog.record;
    setActionLoading(true);
    setActionError("");

    try {
      const response = await fetch(
        editingRecord
          ? `/api/energy-records/${encodeURIComponent(editingRecord.id)}`
          : "/api/energy-records",
        {
          method: editingRecord ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(toRequestBody(form)),
        }
      );
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(
          statusMessage(
            response.status,
            payload,
            editingRecord ? "The record could not be updated." : "The record could not be added."
          )
        );
      }
      setDialog(null);
      setImportForecastTarget(null);
      setNotice(editingRecord ? "Energy record updated." : "Energy record added.");
      await loadRecords();
    } catch (error) {
      setActionError(
        error instanceof TypeError
          ? "We could not reach the server. Check your connection and try again."
          : error instanceof Error
            ? error.message
            : "The record could not be saved."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteRecord() {
    if (dialog?.type !== "delete") return;
    setActionLoading(true);
    setActionError("");

    try {
      const response = await fetch(
        `/api/energy-records/${encodeURIComponent(dialog.record.id)}`,
        { method: "DELETE", headers: { Accept: "application/json" } }
      );
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(statusMessage(response.status, payload, "The record could not be deleted."));
      }
      setDialog(null);
      setNotice("Energy record deleted.");
      setImportForecastTarget(null);
      await loadRecords();
    } catch (error) {
      setActionError(
        error instanceof TypeError
          ? "We could not reach the server. Check your connection and try again."
          : error instanceof Error
            ? error.message
            : "The record could not be deleted."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportErrors([]);
    setImportWarnings([]);
    setNotice("");
    setImportForecastTarget(null);
    setActionError("");
    const data = new FormData();
    data.append("file", file);

    try {
      const response = await fetch("/api/energy-records/import", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        if (
          isObject(payload) &&
          isObject(payload.details) &&
          Array.isArray(payload.details.errors)
        ) {
          const errors = payload.details.errors.filter(
            (item): item is ImportError =>
              isObject(item) &&
              typeof item.row === "number" &&
              typeof item.reason === "string" &&
              (item.field === undefined || typeof item.field === "string")
          );
          setImportErrors(errors);
        }
        throw new Error(statusMessage(response.status, payload, "The CSV file could not be imported."));
      }
      const importedRecords = parseImportedRecords(payload);
      const latestImported = pickLatestImportedRecord(importedRecords);
      if (isObject(payload) && Array.isArray(payload.warnings)) {
        setImportWarnings(
          payload.warnings.filter(
            (item): item is ImportWarning =>
              isObject(item) &&
              (item.type === "legacy_ignored" ||
                item.type === "total_recalculated" ||
                item.type === "unknown_ignored") &&
              typeof item.message === "string"
          )
        );
      }

      if (latestImported) {
        setImportForecastTarget({
          id: latestImported.id,
          year: latestImported.year,
          month: latestImported.month,
          count: importedRecords.length,
        });
        setNotice(
          `${importedRecords.length} record${
            importedRecords.length === 1 ? "" : "s"
          } uploaded. Generate a forecast from ${formatPeriod(
            latestImported.year,
            latestImported.month
          )} to see predictions, AI insights, and reports.`
        );
      } else {
        setNotice("CSV import completed successfully.");
      }
      await loadRecords();
    } catch (error) {
      setActionError(
        error instanceof TypeError
          ? "We could not reach the server. Check your connection and try again."
          : error instanceof Error
            ? error.message
            : "The CSV file could not be imported."
      );
    } finally {
      setImporting(false);
    }
  }

  const hasFilters = Boolean(yearFilter || monthFilter || sourceFilter);

  return (
    <main className="overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-transparent dark:text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={importCsv}
          className="sr-only"
          aria-label="Select CSV file to upload"
        />
        <PageHeader
          eyebrow="Energy data"
          title="Energy Records"
          description="Upload your energy records to start analyzing your business."
          actions={
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className={`${secondaryButtonClasses} w-full sm:w-auto`}
              >
                <Icon name="upload" />
                {importing ? "Uploading..." : "Upload CSV"}
              </button>
              <button
                type="button"
                onClick={downloadSampleEnergyRecordsCsv}
                className={`${secondaryButtonClasses} w-full sm:w-auto`}
              >
                <Icon name="download" />
                Download sample CSV
              </button>
              <button
                type="button"
                onClick={() => openForm(null)}
                className={`${primaryButtonClasses} w-full sm:w-auto`}
              >
                <Icon name="plus" />
                Add Record
              </button>
            </>
          }
        />

        <section className={`${cardClasses} mb-6`}>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">
            Expected fields
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Give GridSense monthly operating facts. Totals, ratios, and the
            GridSense Energy Score (GES) are calculated automatically.
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {expectedUploadFields.map((field) => (
              <li
                key={field.columns}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {field.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {field.unit}
                </p>
                <p className="mt-2 font-mono text-xs text-slate-600 dark:text-slate-300">
                  {field.columns}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Also needed for scoring and forecasts:{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Grid hours
            </span>
            ,{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Operating hours per day
            </span>
            , and{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Monthly revenue
            </span>
            .
          </p>
          <details className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">
              CSV format
            </summary>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Upload raw monthly energy data only. Do not include
              total_energy_cost or other calculated columns. If an older file
              still has those columns, GridSense ignores them and recalculates
              from electricity, diesel, and petrol costs. Unrecognized columns
              are also ignored. Use Download sample CSV rather than building a
              file from scratch. If a year and month already exist, delete
              those records first or change the period in the file.
            </p>
          </details>
        </section>

        {(records.length > 0 || hasFilters) && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Icon name="filter" />
            Filters
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_auto]">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Year</span>
              <input
                type="number"
                min="2000"
                max="2100"
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                placeholder="All years"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:ring-emerald-900/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Month</span>
              <select
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:ring-emerald-900/30"
              >
                <option value="">All months</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2026, index))}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Energy source</span>
              <input
                type="text"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                placeholder="All sources"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:ring-emerald-900/30"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setYearFilter("");
                setMonthFilter("");
                setSourceFilter("");
              }}
              disabled={!hasFilters}
              className="h-10 self-end rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-slate-400 dark:hover:bg-slate-800 dark:disabled:text-slate-600"
            >
              Clear filters
            </button>
          </div>
        </section>
        )}

        <div className="mt-5 space-y-3">
          {notice && (
            <Notice tone="success">
              <p>{notice}</p>
              {importForecastTarget && (
                <Link
                  href={`/forecast?recordId=${encodeURIComponent(importForecastTarget.id)}`}
                  className={`${primaryButtonClasses} mt-3 w-full sm:w-auto`}
                >
                  Generate forecast
                </Link>
              )}
            </Notice>
          )}
          {actionError && !dialog && <Notice tone="error">{actionError}</Notice>}
          {importWarnings.length > 0 && (
            <Notice tone="success">
              <p className="font-semibold">CSV imported with notes:</p>
              <ul className="mt-2 space-y-1">
                {importWarnings.map((warning, index) => (
                  <li key={`${warning.type}-${index}`}>{warning.message}</li>
                ))}
              </ul>
            </Notice>
          )}
          {importErrors.length > 0 && (
            <Notice tone="error">
              <p className="font-semibold">Some CSV rows need attention:</p>
              <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                {importErrors.map((error, index) => (
                  <li key={`${error.row}-${error.field ?? ""}-${index}`}>
                    Row {error.row}{error.field ? `, ${error.field}` : ""}: {error.reason}
                  </li>
                ))}
              </ul>
            </Notice>
          )}
        </div>

        <section className="mt-5" aria-live="polite">
          {loading && <LoadingState />}

          {!loading && loadError && (
            <div className="rounded-xl border border-red-200 bg-white p-6 sm:p-8 dark:border-red-900/60 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Energy records could not be loaded</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadRecords()}
                className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !loadError && records.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center sm:py-16 dark:border-slate-700 dark:bg-slate-900">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <Icon name="database" className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">No energy records yet.</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                {hasFilters
                  ? "No records match these filters. Clear them or add a new record."
                  : "Upload a CSV file or add your first monthly energy record."}
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className={`${secondaryButtonClasses} w-full sm:w-auto`}
                >
                  <Icon name="upload" /> Upload CSV
                </button>
                <button
                  type="button"
                  onClick={downloadSampleEnergyRecordsCsv}
                  className={`${secondaryButtonClasses} w-full sm:w-auto`}
                >
                  <Icon name="download" /> Download sample CSV
                </button>
                <button
                  type="button"
                  onClick={() => openForm(null)}
                  className={`${primaryButtonClasses} w-full sm:w-auto`}
                >
                  <Icon name="plus" /> Add record
                </button>
              </div>
            </div>
          )}

          {!loading && !loadError && records.length > 0 && (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] text-left">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400">
                      <tr>
                        {["Period", "Source", "Total cost", "Consumption", "Outage", "Renewable", "Status", "Actions"].map(
                          (heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3">
                              {heading}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {records.map((record) => (
                        <tr key={record.id} className="text-sm text-slate-700 hover:bg-slate-50/70 dark:text-slate-300 dark:hover:bg-slate-800/50">
                          <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-950 dark:text-slate-100">
                            {formatPeriod(record.year, record.month)}
                          </td>
                          <td className="max-w-44 truncate px-4 py-4" title={record.energySource}>
                            {record.energySource}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-medium">
                            {formatCurrency(record.totalEnergyCost)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {formatNumber(record.energyConsumptionKwh)} kWh
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">{formatNumber(record.outageHours)} hrs</td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {formatNumber(record.renewableEnergyPercentage)}%
                          </td>
                          <td className="px-4 py-4">
                            <span
                              title={
                                record.hasLinkedPrediction
                                  ? "Linked records are locked to preserve forecast data."
                                  : "This record can be edited or deleted."
                              }
                              className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                record.hasLinkedPrediction
                                  ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                              }`}
                            >
                              {record.hasLinkedPrediction ? "Linked forecast · Locked" : "Available"}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <RecordActions
                              record={record}
                              onEdit={() => openForm(record)}
                              onDelete={() => {
                                setActionError("");
                                setDialog({ type: "delete", record });
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 md:hidden">
                {records.map((record) => (
                  <article key={record.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950 dark:text-white">{formatPeriod(record.year, record.month)}</p>
                        <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400" title={record.energySource}>
                          {record.energySource}
                        </p>
                      </div>
                      <RecordActions
                        record={record}
                        onEdit={() => openForm(record)}
                        onDelete={() => {
                          setActionError("");
                          setDialog({ type: "delete", record });
                        }}
                      />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 text-sm dark:border-slate-800">
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Total cost</dt>
                        <dd className="mt-1 truncate font-semibold text-slate-900 dark:text-white">{formatCurrency(record.totalEnergyCost)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Consumption</dt>
                        <dd className="mt-1 truncate font-medium text-slate-700 dark:text-slate-300">{formatNumber(record.energyConsumptionKwh)} kWh</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Outage</dt>
                        <dd className="mt-1 font-medium text-slate-700 dark:text-slate-300">{formatNumber(record.outageHours)} hrs</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Renewable</dt>
                        <dd className="mt-1 font-medium text-slate-700 dark:text-slate-300">{formatNumber(record.renewableEnergyPercentage)}%</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <span
                        className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          record.hasLinkedPrediction
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        {record.hasLinkedPrediction ? "Linked forecast · Editing locked" : "Available to edit"}
                      </span>
                      {record.hasLinkedPrediction && (
                        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          This record is locked to preserve its linked forecast.
                        </p>
                      )}
                    </div>
                    {!record.hasLinkedPrediction && (
                      <Link
                        href={`/forecast?recordId=${encodeURIComponent(record.id)}`}
                        className={`${primaryButtonClasses} mt-4 w-full md:hidden`}
                      >
                        <Icon name="forecast" />
                        Forecast this month
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {dialog?.type === "form" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-dialog-title"
        >
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-800">
              <div>
                <h2 id="record-dialog-title" className="text-lg font-semibold text-slate-950 sm:text-xl dark:text-white">
                  {dialog.record ? "Edit energy record" : "Add energy record"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Enter the facts your business already knows. GridSense calculates totals, ratios, and GES.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={actionLoading}
                aria-label="Close dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitRecord} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/70 p-4 sm:p-6 dark:bg-slate-800/70">
                {FIELD_GROUPS.map((group) => (
                  <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{group.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{group.description}</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {group.fields.map((field) => (
                        <label key={field.name} className="block min-w-0">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}</span>
                          <input
                            name={field.name}
                            type={field.type ?? "number"}
                            required
                            min={field.min}
                            max={field.max}
                            step={field.step ?? (field.type === "text" ? undefined : 1)}
                            value={form[field.name]}
                            placeholder={field.placeholder}
                            onChange={(event) =>
                              setForm((previous) => ({
                                ...previous,
                                [field.name]: event.target.value,
                              }))
                            }
                            className="mt-1.5 h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:ring-emerald-900/30"
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
                <section className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Calculated by GridSense
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                    These values update as you type. They cannot be edited directly.
                  </p>
                  {formDerived && (
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Total energy cost</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                          {formatCurrency(formDerived.totalEnergyCost)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Cost per kWh</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                          {formatCurrency(formDerived.costPerKwh)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Generator dependency</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                          {(formDerived.generatorDependency * 100).toFixed(1)}%
                        </dd>
                      </div>
                    </dl>
                  )}
                  <div className="mt-4">
                    {formGes && <GesReadout result={formGes} showHelper={false} />}
                  </div>
                </section>
                {actionError && <Notice tone="error">{actionError}</Notice>}
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end sm:px-6 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  disabled={actionLoading}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300"
                >
                  {actionLoading ? "Saving..." : dialog.record ? "Save changes" : "Add record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dialog?.type === "delete" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6 dark:border dark:border-slate-800 dark:bg-slate-900">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
              <Icon name="trash" className="h-5 w-5" />
            </span>
            <h2 id="delete-dialog-title" className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">Delete energy record?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              This permanently deletes the {formatPeriod(dialog.record.year, dialog.record.month)} record. This action
              cannot be undone.
            </p>
            {actionError && <div className="mt-4"><Notice tone="error">{actionError}</Notice></div>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={actionLoading}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteRecord()}
                disabled={actionLoading}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-400"
              >
                {actionLoading ? "Deleting..." : "Delete record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
