"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { GesReadout } from "@/components/ges-readout";
import { ShellIcon } from "@/components/shell/shell-icon";
import { primaryButtonClasses, secondaryButtonClasses } from "@/components/ui/button-styles";
import { calculateGesV1FromRecord } from "@/lib/ges-v1";

type DashboardEnergyRecord = {
  id: string;
  year: number;
  month: number;
  quarter: number;
  energySource: string;
  totalEnergyCost: number;
  energyConsumptionKwh: number;
  outageHours: number;
  costPerKwh: number;
  renewableEnergyPercentage: number;
  monthlyRevenue: number;
  generatorHours: number;
  gridHours: number;
  operatingHours: number;
  createdAt: string;
};

type DashboardInsights = {
  id: string;
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  riskLevel: string;
  createdAt: string;
};

type DashboardForecast = {
  id: string;
  createdAt: string;
  model: string;
  predictedNextMonthEnergyCost: number;
  predictedChange: number | null;
  predictedChangePercent: number | null;
  predictedCostPerEmployee: number | null;
  predictedCostPerKwh: number | null;
  generatorDependencyPercent: number | null;
  outageHours: number | null;
  predictedEnergyCostAsPercentOfRevenue: number | null;
  energyRecord: DashboardEnergyRecord | null;
  insights: DashboardInsights | null;
};

type ForecastHistoryResponse = {
  success: true;
  business: {
    id: string;
    businessName: string;
  };
  latestForecast: DashboardForecast | null;
  forecasts: DashboardForecast[];
};

type EnergyRecordsResponse = {
  success: true;
  records: DashboardEnergyRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDashboardForecast(
  value: unknown
): value is DashboardForecast {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.model === "string" &&
    typeof value.predictedNextMonthEnergyCost === "number" &&
    (value.energyRecord === null ||
      isRecord(value.energyRecord)) &&
    (value.insights === null || isRecord(value.insights))
  );
}

function parseForecastHistory(
  value: unknown
): ForecastHistoryResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !isRecord(value.business) ||
    typeof value.business.id !== "string" ||
    typeof value.business.businessName !== "string" ||
    !Array.isArray(value.forecasts) ||
    !value.forecasts.every(isDashboardForecast) ||
    (value.latestForecast !== null &&
      !isDashboardForecast(value.latestForecast))
  ) {
    throw new Error("Forecast API returned an invalid response.");
  }

  return value as ForecastHistoryResponse;
}

function parseEnergyRecords(value: unknown): EnergyRecordsResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !Array.isArray(value.records)
  ) {
    throw new Error("Energy records API returned an invalid response.");
  }

  return value as EnergyRecordsResponse;
}

function getErrorMessage(value: unknown): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : "Failed to load dashboard data.";
}

function isMissingBusinessProfile(
  status: number,
  payload: unknown
): boolean {
  if (status !== 404) {
    return false;
  }

  if (isRecord(payload) && payload.code === "BUSINESS_NOT_FOUND") {
    return true;
  }

  return getErrorMessage(payload) === "Business profile not found";
}

type DashboardLoadResult =
  | { status: "missing-profile" }
  | {
      status: "ready";
      data: ForecastHistoryResponse;
      latestEnergyRecord: DashboardEnergyRecord | null;
    };

async function fetchDashboardData(
  signal?: AbortSignal
): Promise<DashboardLoadResult> {
  const [forecastResponse, recordsResponse] = await Promise.all([
    fetch("/api/forecasts", {
      headers: { Accept: "application/json" },
      signal,
    }),
    fetch("/api/energy-records", {
      headers: { Accept: "application/json" },
      signal,
    }),
  ]);

  const forecastText = await forecastResponse.text();
  let forecastPayload: unknown;

  try {
    forecastPayload = JSON.parse(forecastText);
  } catch {
    throw new Error("Forecast API returned invalid JSON.");
  }

  if (isMissingBusinessProfile(forecastResponse.status, forecastPayload)) {
    return { status: "missing-profile" };
  }

  if (!forecastResponse.ok) {
    throw new Error(getErrorMessage(forecastPayload));
  }

  let latestEnergyRecord: DashboardEnergyRecord | null = null;

  if (recordsResponse.ok) {
    const recordsText = await recordsResponse.text();
    try {
      const recordsPayload = JSON.parse(recordsText);
      const parsed = parseEnergyRecords(recordsPayload);
      latestEnergyRecord = parsed.records[0] ?? null;
    } catch {
      // Energy records are optional for dashboard overview.
    }
  }

  return {
    status: "ready",
    data: parseForecastHistory(forecastPayload),
    latestEnergyRecord,
  };
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(
  value: number | null | undefined
) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(
  value: number | null | undefined,
  suffix = ""
) {
  return typeof value === "number"
    ? `${value.toFixed(2)}${suffix}`
    : "Unavailable";
}

function formatDetailedCurrency(
  value: number | null | undefined
) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPeriod(record: DashboardEnergyRecord | null) {
  if (!record) {
    return "Latest reporting period";
  }

  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
  }).format(new Date(record.year, record.month - 1));
}

function getRiskBadgeClasses(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "high":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
    case "moderate":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
    case "low":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400";
  }
}

type IconName =
  | "bolt"
  | "chart"
  | "users"
  | "ratio"
  | "sparkles"
  | "generator"
  | "clock"
  | "leaf"
  | "currency"
  | "arrow"
  | "check";

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    bolt: (
      <path
        d="m13 2-8 11h7l-1 9 8-12h-7l1-8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    chart: (
      <>
        <path d="M4 19V9" strokeLinecap="round" />
        <path d="M10 19V5" strokeLinecap="round" />
        <path d="M16 19v-7" strokeLinecap="round" />
        <path d="M22 19V3" strokeLinecap="round" />
      </>
    ),
    users: (
      <>
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          strokeLinecap="round"
        />
        <circle cx="9" cy="7" r="4" />
        <path
          d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
          strokeLinecap="round"
        />
      </>
    ),
    ratio: (
      <>
        <circle cx="7" cy="7" r="3" />
        <circle cx="17" cy="17" r="3" />
        <path d="m6 18 12-12" strokeLinecap="round" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3L12 3Z" />
        <path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Z" />
        <path d="m19 13-.6 1.4L17 15l1.4.6L19 17l.6-1.4L21 15l-1.4-.6L19 13Z" />
      </>
    ),
    generator: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h4M7 13h2" strokeLinecap="round" />
        <circle cx="16.5" cy="12" r="2.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4c-8 0-14 4-14 10a6 6 0 0 0 6 6c6 0 8-8 8-16Z" />
        <path d="M4 21c2-5 6-8 11-10" strokeLinecap="round" />
      </>
    ),
    currency: (
      <>
        <path d="M7 18V6l10 12V6" strokeLinecap="round" />
        <path d="M4 10h16M4 14h16" strokeLinecap="round" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" strokeLinecap="round" />
        <path
          d="m13 6 6 6-6 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    check: (
      <path
        d="m5 12 4 4L19 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function KpiCard({
  label,
  value,
  context,
  icon,
  emphasized = false,
}: {
  label: string;
  value: string;
  context: ReactNode;
  icon: IconName;
  emphasized?: boolean;
}) {
  return (
    <article
      className={`min-w-0 border p-5 sm:p-6 ${
        emphasized
          ? "border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      } rounded-xl`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.7rem] dark:text-white">
            {value}
          </p>
        </div>

        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            emphasized
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          <Icon name={icon} />
        </span>
      </div>

      <div className="mt-4 min-h-5 text-sm text-slate-500 dark:text-slate-400">
        {context}
      </div>
    </article>
  );
}

function PerformanceMetric({
  label,
  value,
  context,
  icon,
  tone,
  progress,
}: {
  label: string;
  value: string;
  context: string;
  icon: IconName;
  tone: "blue" | "amber" | "red" | "green";
  progress?: number;
}) {
  const toneClasses = {
    blue: {
      icon: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
      bar: "bg-blue-600",
    },
    amber: {
      icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      bar: "bg-amber-500",
    },
    red: {
      icon: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      bar: "bg-red-500",
    },
    green: {
      icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      bar: "bg-emerald-500",
    },
  }[tone];

  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/70">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses.icon}`}
        >
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 break-words text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{context}</p>
        </div>
      </div>

      {typeof progress === "number" && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full ${toneClasses.bar}`}
            style={{
              width: `${Math.min(Math.max(progress, 0), 100)}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] =
    useState<ForecastHistoryResponse | null>(null);
  const [latestEnergyRecord, setLatestEnergyRecord] =
    useState<DashboardEnergyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsBusinessProfile, setNeedsBusinessProfile] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      try {
        const result = await fetchDashboardData(controller.signal);

        if (result.status === "missing-profile") {
          setNeedsBusinessProfile(true);
          return;
        }

        setData(result.data);
        setLatestEnergyRecord(result.latestEnergyRecord);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load dashboard data."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      controller.abort();
    };
  }, []);

  async function retryDashboardLoad() {
    setLoading(true);
    setError("");
    setNeedsBusinessProfile(false);

    try {
      const result = await fetchDashboardData();

      if (result.status === "missing-profile") {
        setNeedsBusinessProfile(true);
        return;
      }

      setData(result.data);
      setLatestEnergyRecord(result.latestEnergyRecord);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  const latestForecast = data?.latestForecast ?? null;
  const energyRecord = latestForecast?.energyRecord ?? latestEnergyRecord;
  const gesResult = useMemo(() => {
    if (!latestEnergyRecord) {
      return null;
    }

    return calculateGesV1FromRecord({
      totalEnergyCost: latestEnergyRecord.totalEnergyCost,
      monthlyRevenue: latestEnergyRecord.monthlyRevenue,
      generatorHours: latestEnergyRecord.generatorHours,
      gridHours: latestEnergyRecord.gridHours,
      outageHours: latestEnergyRecord.outageHours,
      operatingHours: latestEnergyRecord.operatingHours,
      year: latestEnergyRecord.year,
      month: latestEnergyRecord.month,
    });
  }, [latestEnergyRecord]);
  const savedInsights = latestForecast?.insights ?? null;
  const changePercent =
    latestForecast?.predictedChangePercent ?? null;
  const changeDirection =
    typeof changePercent === "number" && changePercent >= 0
      ? "increase"
      : "decrease";
  const currentEnergyCost = energyRecord?.totalEnergyCost ?? null;
  const predictedEnergyCost =
    latestForecast?.predictedNextMonthEnergyCost ?? null;
  const expectedCostChange =
    latestForecast?.predictedChange ?? null;
  const generatorDependency =
    latestForecast?.generatorDependencyPercent ?? null;
  const outageExposure =
    latestForecast?.outageHours ??
    energyRecord?.outageHours ??
    null;
  const energyCostPerKwh =
    latestForecast?.predictedCostPerKwh ??
    energyRecord?.costPerKwh ??
    null;
  const renewableEnergyPercentage =
    energyRecord?.renewableEnergyPercentage ?? null;
  const hasPerformanceMetrics = [
    generatorDependency,
    outageExposure,
    energyCostPerKwh,
    renewableEnergyPercentage,
  ].some((value) => typeof value === "number");
  const costChangeIsIncrease =
    typeof expectedCostChange === "number"
      ? expectedCostChange >= 0
      : typeof changePercent === "number"
        ? changePercent >= 0
        : null;
  const hasExpectedImpact =
    typeof changePercent === "number" ||
    typeof expectedCostChange === "number" ||
    energyRecord !== null;
  const comparisonMaximum = Math.max(
    currentEnergyCost ?? 0,
    predictedEnergyCost ?? 0,
    1
  );
  const currentCostWidth =
    typeof currentEnergyCost === "number"
      ? `${(currentEnergyCost / comparisonMaximum) * 100}%`
      : "0%";
  const predictedCostWidth =
    typeof predictedEnergyCost === "number"
      ? `${(predictedEnergyCost / comparisonMaximum) * 100}%`
      : "0%";

  return (
    <main className="bg-slate-50 text-slate-950 dark:bg-transparent dark:text-slate-100">
      {/* Dashboard */}
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Welcome */}
          <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                  Dashboard
                </p>
              </div>

              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
                Energy intelligence overview
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                Monitor current energy costs, understand your next
                forecast, and act on AI-powered recommendations.
              </p>
            </div>

            {data?.business.businessName && (
              <div className="flex w-full shrink-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:w-auto dark:border-slate-800 dark:bg-slate-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Icon name="chart" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Business
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {data.business.businessName}
                  </p>
                  {energyRecord && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Latest period: {formatPeriod(energyRecord)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {!loading && !error && !needsBusinessProfile && (
            <section
              aria-label="Quick actions"
              className="mb-6 flex flex-wrap gap-2"
            >
              <Link href="/energy-records" className={secondaryButtonClasses}>
                Energy Records
              </Link>
              <Link href="/analytics" className={secondaryButtonClasses}>
                Analytics
              </Link>
              <Link href="/forecast" className={secondaryButtonClasses}>
                Forecast
              </Link>
              <Link href="/reports" className={secondaryButtonClasses}>
                Reports
              </Link>
            </section>
          )}

          {loading && (
            <section aria-label="Loading dashboard" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-5 h-7 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-5 h-3 w-20 rounded bg-slate-100 dark:bg-slate-700" />
                  </div>
                ))}
              </div>

              <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
            </section>
          )}

          {!loading && needsBusinessProfile && (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 sm:px-8 sm:py-16 dark:border-slate-700 dark:bg-slate-900">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <ShellIcon name="building" className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">
                  Set up your business profile
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Your GridSense workspace needs a business profile before we
                  can analyze your energy data. Create your business profile to
                  continue with your first analysis.
                </p>
                <div className="mt-6 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <Link href="/onboarding" className={primaryButtonClasses}>
                    Create Business Profile
                    <Icon name="arrow" className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void retryDashboardLoad()}
                    className={secondaryButtonClasses}
                  >
                    Try again
                  </button>
                </div>
              </div>
            </section>
          )}

          {!loading && error && !needsBusinessProfile && (
            <section className="rounded-xl border border-red-200 bg-white p-6 sm:p-8 dark:border-red-900/60 dark:bg-red-950/40">
              <div className="flex max-w-xl flex-col items-start">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300">
                  <Icon name="chart" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">
                  Dashboard data could not be loaded
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-red-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
                >
                  Try again
                </button>
              </div>
            </section>
          )}

          {!loading && !error && !needsBusinessProfile && !latestForecast && (
            <section className="space-y-6">
              {gesResult && (
                <div className="max-w-md">
                  <GesReadout result={gesResult} compact />
                </div>
              )}
              <section className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center sm:py-16 dark:border-slate-800 dark:bg-slate-900">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Icon name="bolt" />
              </span>
              <h3 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">
                Your energy intelligence starts here
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                {latestEnergyRecord
                  ? "You have energy records on file. Generate a forecast to see predicted costs and AI insights."
                  : "Add an energy record to calculate your GridSense Energy Score, then generate a forecast for next-month predictions."}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {!latestEnergyRecord && (
                  <Link href="/energy-records" className={primaryButtonClasses}>
                    Add energy record
                    <Icon name="arrow" className="h-4 w-4" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => router.push("/forecast")}
                  className={latestEnergyRecord ? primaryButtonClasses : secondaryButtonClasses}
                >
                  Generate forecast
                  <Icon name="arrow" className="h-4 w-4" />
                </button>
              </div>
            </section>
            </section>
          )}

          {latestForecast && (
            <>
              {gesResult && (
                <section aria-label="GridSense Energy Score" className="mb-6 max-w-md">
                  <GesReadout result={gesResult} compact />
                </section>
              )}

              {/* Overview cards */}
              <section
                aria-label="Key energy metrics"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {typeof energyRecord?.totalEnergyCost ===
                  "number" && (
                  <KpiCard
                    label="Current energy cost"
                    value={formatCompactCurrency(
                      energyRecord.totalEnergyCost
                    )}
                    context={formatPeriod(energyRecord)}
                    icon="currency"
                  />
                )}

                <KpiCard
                  label="Forecasted cost"
                  value={formatCompactCurrency(
                    latestForecast.predictedNextMonthEnergyCost
                  )}
                  context={
                    typeof changePercent === "number" ? (
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          changePercent >= 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        <span aria-hidden="true">
                          {changePercent >= 0 ? "↑" : "↓"}
                        </span>
                        {Math.abs(changePercent).toFixed(2)}% expected{" "}
                        {changeDirection}
                      </span>
                    ) : (
                      "Predicted next-month cost"
                    )
                  }
                  icon="chart"
                  emphasized
                />

                {typeof latestForecast.predictedCostPerEmployee ===
                  "number" && (
                  <KpiCard
                    label="Cost per employee"
                    value={formatCompactCurrency(
                      latestForecast.predictedCostPerEmployee
                    )}
                    context="Predicted next-month allocation"
                    icon="users"
                  />
                )}

                {typeof latestForecast
                  .predictedEnergyCostAsPercentOfRevenue ===
                  "number" && (
                  <KpiCard
                    label="Energy / revenue"
                    value={formatNumber(
                      latestForecast
                        .predictedEnergyCostAsPercentOfRevenue,
                      "%"
                    )}
                    context="Forecasted revenue burden"
                    icon="ratio"
                  />
                )}
              </section>

              {/* Forecast */}
              <section className="mt-6">
                <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-900/40">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                        Next-month outlook
                      </p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        Energy cost forecast
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        What is changing and by how much.
                      </p>
                    </div>

                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                      {latestForecast.model}
                    </span>
                  </div>

                  <div
                    className={`mt-6 grid items-start gap-5 ${
                      hasExpectedImpact
                        ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.5fr)]"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div
                        className={`overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 ${
                          typeof currentEnergyCost === "number"
                            ? "sm:grid sm:grid-cols-2 sm:divide-x sm:divide-slate-200 dark:sm:divide-slate-700"
                            : ""
                        }`}
                      >
                        {typeof currentEnergyCost === "number" && (
                          <div className="min-w-0 bg-slate-50/60 p-4 sm:p-5 dark:bg-slate-800/70">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              Current energy cost
                            </p>
                            <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                              {formatCompactCurrency(
                                currentEnergyCost
                              )}
                            </p>
                            {energyRecord && (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {formatPeriod(energyRecord)}
                              </p>
                            )}
                          </div>
                        )}

                        <div
                          className={`min-w-0 bg-blue-50/60 p-4 sm:p-5 dark:bg-blue-950/30 ${
                            typeof currentEnergyCost === "number"
                              ? "border-t border-slate-200 sm:border-t-0 dark:border-slate-700"
                              : ""
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                            Forecasted energy cost
                          </p>
                          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-blue-950 sm:text-3xl dark:text-blue-100">
                            {formatCompactCurrency(
                              latestForecast.predictedNextMonthEnergyCost
                            )}
                          </p>
                          <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                            Predicted next month
                          </p>
                        </div>
                      </div>

                      {typeof currentEnergyCost === "number" && (
                        <div className="mt-5 space-y-4">
                          <div>
                            <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                              <span className="font-medium text-slate-500 dark:text-slate-400">
                                Current
                              </span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {formatCurrency(currentEnergyCost)}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-slate-400"
                                style={{ width: currentCostWidth }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                              <span className="font-medium text-slate-500 dark:text-slate-400">
                                Forecast
                              </span>
                              <span className="font-semibold text-blue-700 dark:text-blue-300">
                                {formatCurrency(
                                  predictedEnergyCost
                                )}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-blue-50 dark:bg-blue-950/40">
                              <div
                                className="h-full rounded-full bg-blue-600"
                                style={{ width: predictedCostWidth }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {hasExpectedImpact && (
                      <aside
                        className={`rounded-lg border p-5 ${
                          costChangeIsIncrease === true
                            ? "border-red-100 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/40"
                            : costChangeIsIncrease === false
                              ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/40"
                              : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Expected impact
                        </p>

                        {typeof changePercent === "number" && (
                          <p
                            className={`mt-3 text-3xl font-bold tracking-tight ${
                              costChangeIsIncrease
                                ? "text-red-700 dark:text-red-300"
                                : "text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            <span aria-hidden="true">
                              {costChangeIsIncrease ? "↑" : "↓"}
                            </span>{" "}
                            {Math.abs(changePercent).toFixed(2)}%
                          </p>
                        )}

                        {typeof expectedCostChange === "number" && (
                          <p className="mt-2 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">
                            {formatCompactCurrency(
                              Math.abs(expectedCostChange)
                            )}{" "}
                            expected{" "}
                            {costChangeIsIncrease
                              ? "increase"
                              : "reduction"}
                          </p>
                        )}

                        {energyRecord && (
                          <div className="mt-5 border-t border-slate-900/10 pt-4 dark:border-slate-700">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Forecast period
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                              Next month after{" "}
                              {formatPeriod(energyRecord)}
                            </p>
                          </div>
                        )}
                      </aside>
                    )}
                  </div>
                </article>
              </section>

              {/* AI Insights */}
              <section className="mt-6 min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-900/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                        <Icon name="sparkles" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                          Gemini analysis
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                          AI insights
                        </h3>
                      </div>
                    </div>
                  </div>

                  {savedInsights ? (
                    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                      <div className="min-w-0">
                        <div className="rounded-lg bg-slate-50 p-4 sm:p-5 dark:bg-slate-800/70">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            Summary
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                            {savedInsights.summary}
                          </p>
                        </div>

                        {savedInsights.keyInsights.length > 0 && (
                          <div className="mt-5">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                              Observations
                            </h4>
                            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                              {savedInsights.keyInsights.map(
                                (insight, index) => (
                                  <li
                                    key={`${insight}-${index}`}
                                    className="flex gap-3 py-3 first:pt-0"
                                  >
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                      {index + 1}
                                    </span>
                                    <p className="text-sm leading-5 text-slate-600 dark:text-slate-400">
                                      {insight}
                                    </p>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-4">
                        <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              Risk assessment
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                              Based on this forecast
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${getRiskBadgeClasses(
                              savedInsights.riskLevel
                            )}`}
                          >
                            {savedInsights.riskLevel} risk
                          </span>
                        </div>

                        {savedInsights.recommendations.length > 0 && (
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                            <h4 className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                              Recommended actions
                            </h4>
                            <ul className="mt-3 space-y-3">
                              {savedInsights.recommendations.map(
                                (recommendation, index) => (
                                  <li
                                    key={`${recommendation}-${index}`}
                                    className="flex gap-2.5"
                                  >
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                      <Icon
                                        name="check"
                                        className="h-3.5 w-3.5"
                                      />
                                    </span>
                                    <p className="text-sm leading-5 text-emerald-950/75 dark:text-emerald-200/80">
                                      {recommendation}
                                    </p>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/70">
                      <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                        AI insights are not available for this
                        forecast.
                      </p>
                    </div>
                  )}
              </section>

              {/* Energy metrics */}
              {hasPerformanceMetrics && (
                <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-900/30">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                        Operational profile
                      </p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        Energy performance
                      </h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Indicators from your latest saved forecast
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {typeof generatorDependency === "number" && (
                      <PerformanceMetric
                        label="Generator dependency"
                        value={formatNumber(
                          generatorDependency,
                          "%"
                        )}
                        context="Forecasted generator reliance"
                        icon="generator"
                        tone="amber"
                        progress={generatorDependency}
                      />
                    )}

                    {typeof outageExposure === "number" && (
                      <PerformanceMetric
                        label="Outage exposure"
                        value={formatNumber(
                          outageExposure,
                          " hrs"
                        )}
                        context="Latest reported outage duration"
                        icon="clock"
                        tone="red"
                      />
                    )}

                    {typeof energyCostPerKwh === "number" && (
                      <PerformanceMetric
                        label="Cost per kWh"
                        value={formatDetailedCurrency(
                          energyCostPerKwh
                        )}
                        context="Forecasted unit energy cost"
                        icon="currency"
                        tone="blue"
                      />
                    )}

                    {typeof renewableEnergyPercentage ===
                      "number" && (
                      <PerformanceMetric
                        label="Renewable energy"
                        value={formatNumber(
                          renewableEnergyPercentage,
                          "%"
                        )}
                        context="Share of renewable supply"
                        icon="leaf"
                        tone="green"
                        progress={renewableEnergyPercentage}
                      />
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}