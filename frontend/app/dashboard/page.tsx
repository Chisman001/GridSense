"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { EnergyNextSteps } from "@/components/energy-next-steps";
import { EnergyProfileCard } from "@/components/energy-profile-card";
import { EnergyReading } from "@/components/energy-reading";
import { MlGuardrailNotice } from "@/components/ml-guardrail-notice";
import { ShellIcon } from "@/components/shell/shell-icon";
import { primaryButtonClasses, secondaryButtonClasses } from "@/components/ui/button-styles";
import {
  buildEnergyProfile,
  isEnergyProfileSource,
  type EnergyProfileSource,
} from "@/lib/energy-profile";
import { isRecord } from "@/lib/energy-record-pipeline";
import {
  formatForecastCurrency,
  formatForecastPercent,
} from "@/lib/forecast-scenario";
import {
  FORECAST_EYEBROW,
  FORECAST_SUBTITLE,
  hasLimitedModelCoverage,
} from "@/lib/ml-guardrails";

type DashboardEnergyRecord = EnergyProfileSource & {
  id: string;
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
  energyRecord: { year: number; month: number } | null;
  insights: DashboardInsights | null;
};

type ForecastHistoryResponse = {
  success: true;
  business: {
    id: string;
    businessName: string;
    businessType?: string;
  };
  latestForecast: DashboardForecast | null;
  forecasts: DashboardForecast[];
};

type EnergyRecordsResponse = {
  success: true;
  records: DashboardEnergyRecord[];
};

function isDashboardEnergyRecord(
  value: unknown
): value is DashboardEnergyRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isEnergyProfileSource(value)
  );
}

function hasForecastPeriod(
  value: unknown
): value is { year: number; month: number } {
  return (
    isRecord(value) &&
    typeof value.year === "number" &&
    typeof value.month === "number"
  );
}

function isDashboardForecast(value: unknown): value is DashboardForecast {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.model === "string" &&
    typeof value.predictedNextMonthEnergyCost === "number" &&
    (value.energyRecord === null || hasForecastPeriod(value.energyRecord)) &&
    (value.insights === null || isRecord(value.insights))
  );
}

function parseForecastHistory(value: unknown): ForecastHistoryResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !isRecord(value.business) ||
    typeof value.business.id !== "string" ||
    typeof value.business.businessName !== "string" ||
    (value.business.businessType !== undefined &&
      typeof value.business.businessType !== "string") ||
    !Array.isArray(value.forecasts) ||
    !value.forecasts.every(isDashboardForecast) ||
    (value.latestForecast !== null && !isDashboardForecast(value.latestForecast))
  ) {
    throw new Error("Forecast API returned an invalid response.");
  }

  return value as ForecastHistoryResponse;
}

function parseEnergyRecords(value: unknown): EnergyRecordsResponse {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.records)) {
    throw new Error("Energy records API returned an invalid response.");
  }

  const records = value.records.filter(isDashboardEnergyRecord);

  return { success: true, records };
}

function getErrorMessage(value: unknown): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : "Failed to load dashboard data.";
}

function isMissingBusinessProfile(status: number, payload: unknown): boolean {
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
      previousEnergyRecord: DashboardEnergyRecord | null;
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
  let previousEnergyRecord: DashboardEnergyRecord | null = null;

  if (recordsResponse.ok) {
    const recordsText = await recordsResponse.text();
    try {
      const recordsPayload = JSON.parse(recordsText);
      const parsed = parseEnergyRecords(recordsPayload);
      latestEnergyRecord = parsed.records[0] ?? null;
      previousEnergyRecord = parsed.records[1] ?? null;
    } catch {
      // Energy records are optional for dashboard overview.
    }
  }

  return {
    status: "ready",
    data: parseForecastHistory(forecastPayload),
    latestEnergyRecord,
    previousEnergyRecord,
  };
}

function formatPeriod(year: number, month: number) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1));
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

type IconName = "chart" | "sparkles" | "arrow" | "check" | "bolt";

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    chart: (
      <>
        <path d="M4 19V9" strokeLinecap="round" />
        <path d="M10 19V5" strokeLinecap="round" />
        <path d="M16 19v-7" strokeLinecap="round" />
        <path d="M22 19V3" strokeLinecap="round" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3L12 3Z" />
        <path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Z" />
        <path d="m19 13-.6 1.4L17 15l1.4.6L19 17l.6-1.4L21 15l-1.4-.6L19 13Z" />
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
    bolt: (
      <path
        d="m13 2-8 11h7l-1 9 8-12h-7l1-8Z"
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

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<ForecastHistoryResponse | null>(null);
  const [latestEnergyRecord, setLatestEnergyRecord] =
    useState<DashboardEnergyRecord | null>(null);
  const [previousEnergyRecord, setPreviousEnergyRecord] =
    useState<DashboardEnergyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsBusinessProfile, setNeedsBusinessProfile] = useState(false);

  function applyReadyResult(result: Extract<DashboardLoadResult, { status: "ready" }>) {
    setData(result.data);
    setLatestEnergyRecord(result.latestEnergyRecord);
    setPreviousEnergyRecord(result.previousEnergyRecord);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      try {
        const result = await fetchDashboardData(controller.signal);

        if (result.status === "missing-profile") {
          setNeedsBusinessProfile(true);
          return;
        }

        applyReadyResult(result);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
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

      applyReadyResult(result);
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

  const energyProfile = useMemo(() => {
    if (!latestEnergyRecord) {
      return null;
    }

    return buildEnergyProfile(latestEnergyRecord, previousEnergyRecord);
  }, [latestEnergyRecord, previousEnergyRecord]);

  const latestForecast = data?.latestForecast ?? null;
  const savedInsights = latestForecast?.insights ?? null;
  const changePercent = latestForecast?.predictedChangePercent ?? null;
  const expectedCostChange = latestForecast?.predictedChange ?? null;
  const businessType = data?.business.businessType;
  const showCoverageNotice =
    Boolean(latestForecast) &&
    typeof businessType === "string" &&
    hasLimitedModelCoverage(businessType);

  return (
    <main className="bg-slate-50 text-slate-950 dark:bg-transparent dark:text-slate-100">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
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
                See this month’s energy situation, then estimate next month if
                you want.
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
                  {latestEnergyRecord && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Latest period:{" "}
                      {formatPeriod(
                        latestEnergyRecord.year,
                        latestEnergyRecord.month
                      )}
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
              <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
              <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
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

          {!loading && !error && !needsBusinessProfile && !energyProfile && (
            <section className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center sm:py-16 dark:border-slate-800 dark:bg-slate-900">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Icon name="bolt" />
              </span>
              <h3 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">
                Add an energy record to see this month
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                Recorded bills and hours are enough to describe what happened.
                A forecast is optional and comes after that.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link href="/energy-records" className={primaryButtonClasses}>
                  Add energy record
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </div>
            </section>
          )}

          {!loading && !error && !needsBusinessProfile && energyProfile && (
            <div className="space-y-6">
              <EnergyProfileCard profile={energyProfile} />
              <EnergyReading profile={energyProfile} />
              <EnergyNextSteps generatorHours={energyProfile.generatorHours} />

              <section
                aria-label="Next-month energy cost estimate"
                className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                  {FORECAST_EYEBROW}
                </p>

                {latestForecast ? (
                  <>
                    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                          {formatForecastCurrency(
                            latestForecast.predictedNextMonthEnergyCost
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Estimated next-month cost
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                          {FORECAST_SUBTITLE}
                        </p>
                        {typeof changePercent === "number" &&
                          typeof expectedCostChange === "number" && (
                            <p className="mt-3 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">
                              <span
                                className={
                                  expectedCostChange >= 0
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-emerald-700 dark:text-emerald-300"
                                }
                              >
                                {expectedCostChange >= 0 ? "↑" : "↓"}{" "}
                                {formatForecastPercent(Math.abs(changePercent))}
                              </span>
                              {" · "}
                              {formatForecastCurrency(Math.abs(expectedCostChange))}{" "}
                              expected{" "}
                              {expectedCostChange >= 0 ? "increase" : "reduction"}
                              {latestForecast.energyRecord
                                ? ` after ${formatPeriod(
                                    latestForecast.energyRecord.year,
                                    latestForecast.energyRecord.month
                                  )}`
                                : ""}
                            </p>
                          )}
                      </div>
                      <Link href="/forecast" className={secondaryButtonClasses}>
                        Open forecast
                        <Icon name="arrow" className="h-4 w-4" />
                      </Link>
                    </div>
                    {showCoverageNotice && (
                      <MlGuardrailNotice variant="coverage" className="mt-4" />
                    )}
                  </>
                ) : (
                  <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                      No next-month estimate yet. Generate one when you want a
                      model-based look ahead.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/forecast")}
                      className={primaryButtonClasses}
                    >
                      Generate estimate
                      <Icon name="arrow" className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </section>

              {latestForecast && (
                <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-900/40">
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
                              {savedInsights.keyInsights.map((insight, index) => (
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
                              ))}
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
                        AI insights are not available for this forecast.
                      </p>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
