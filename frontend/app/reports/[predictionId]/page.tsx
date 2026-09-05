"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { MlGuardrailNotice } from "@/components/ml-guardrail-notice";
import { calculateGES } from "@/lib/ges-v1";
import { formatGesScoreWithRating } from "@/lib/ges-display";
import { hasLimitedModelCoverage } from "@/lib/ml-guardrails";

type ReportBusiness = {
  id: string;
  businessName: string;
  businessType: string;
  industry: string;
  state: string;
};

type ReportPrediction = {
  id: string;
  predictedNextMonthEnergyCost: number;
  predictedChange: number | null;
  predictedChangePercent: number | null;
  generatorDependencyPercent: number | null;
  model: string;
  outageHours: number | null;
  createdAt: string;
};

type ReportEnergyRecord = {
  id: string;
  year: number;
  month: number;
  electricityBill: number;
  dieselCost: number;
  petrolCost: number;
  maintenanceCost: number;
  totalEnergyCost: number;
  energyConsumptionKwh: number;
  costPerKwh: number;
  monthlyRevenue: number;
  energyCostPerEmployee: number;
  revenueEnergyRatio: number;
  generatorDependency: number;
  generatorHours: number;
  gridHours: number;
  outageHours: number;
  operatingHours: number;
};

type ReportInsight = {
  id: string;
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  riskLevel: string;
};

type ReportDetailResponse = {
  success: true;
  business: ReportBusiness;
  report: {
    prediction: ReportPrediction;
    energyRecord: ReportEnergyRecord | null;
    insight: ReportInsight | null;
  };
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getErrorMessage(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : fallback;
}

function parseReportDetail(value: unknown): ReportDetailResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !isRecord(value.business) ||
    typeof value.business.id !== "string" ||
    typeof value.business.businessName !== "string" ||
    !isRecord(value.report) ||
    !isRecord(value.report.prediction) ||
    typeof value.report.prediction.id !== "string" ||
    !isFiniteNumber(value.report.prediction.predictedNextMonthEnergyCost) ||
    typeof value.report.prediction.model !== "string"
  ) {
    throw new Error("Report API returned an invalid response.");
  }

  return value as ReportDetailResponse;
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

function formatSignedCurrency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  const absolute = Math.abs(value).toFixed(1);
  if (value > 0) return `+${absolute}%`;
  if (value < 0) return `-${absolute}%`;
  return `${absolute}%`;
}

function formatNumber(
  value: number | null | undefined,
  options?: {
    suffix?: string;
    fractionDigits?: number;
    asPercent?: boolean;
  }
) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  const digits = options?.fractionDigits ?? 2;
  if (options?.asPercent) {
    return `${(value * 100).toFixed(digits)}%`;
  }

  return `${value.toFixed(digits)}${options?.suffix ?? ""}`;
}

function formatGesScore(energyRecord: ReportEnergyRecord | null | undefined) {
  if (!energyRecord) {
    return "Unavailable";
  }

  const ges = calculateGES({
    totalEnergyCost: energyRecord.totalEnergyCost,
    monthlyRevenue: energyRecord.monthlyRevenue,
    generatorHours: energyRecord.generatorHours,
    gridHours: energyRecord.gridHours,
    outageHours: energyRecord.outageHours,
    operatingHours: energyRecord.operatingHours,
    year: energyRecord.year,
    month: energyRecord.month,
  });

  return formatGesScoreWithRating(ges);
}

function formatStoredPercent(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return `${value.toFixed(1)}%`;
}

function recordedLabel(period: string, noun: string) {
  if (period === "Unavailable") {
    return `Recorded ${noun}`;
  }

  return `${period} recorded ${noun}`;
}

function forecastLabel(period: string) {
  if (period === "Unavailable") {
    return "Forecast next-month cost";
  }

  return `${period} forecast`;
}

function formatPeriod(year: number, month: number) {
  if (month < 1 || month > 12) {
    return "Unavailable";
  }

  return `${monthNames[month - 1]} ${year}`;
}

function formatActualPeriod(record: ReportEnergyRecord | null) {
  if (!record) {
    return "Unavailable";
  }

  return formatPeriod(record.year, record.month);
}

function formatForecastPeriod(record: ReportEnergyRecord | null) {
  if (!record) {
    return "Unavailable";
  }

  const next = new Date(record.year, record.month);
  return `${monthNames[next.getMonth()]} ${next.getFullYear()}`;
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

function getChangeTone(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "text-slate-950 dark:text-slate-100";
  }

  if (value > 0) return "text-red-700 dark:text-red-400";
  if (value < 0) return "text-emerald-700 dark:text-emerald-400";
  return "text-slate-950 dark:text-slate-100";
}

async function downloadReportPdf(predictionId: string) {
  const response = await fetch(`/api/reports/${predictionId}/pdf`, {
    headers: { Accept: "application/pdf" },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "PDF download failed.";
    try {
      const payload = (await response.json()) as unknown;
      message = getErrorMessage(payload, message);
    } catch {
      // Keep fallback.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `gridsense-report-${predictionId}.pdf`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function KpiCard({
  label,
  value,
  hint,
  description,
  toneClass = "text-slate-950 dark:text-white",
}: {
  label: string;
  value: string;
  hint?: string;
  description?: string;
  toneClass?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {description && (
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
    </article>
  );
}

function MetricRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800">
      <dt className="min-w-0">
        <span className="block text-sm text-slate-600 dark:text-slate-400">{label}</span>
        {detail && (
          <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">{detail}</span>
        )}
      </dt>
      <dd className="text-right text-sm font-semibold text-slate-950 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
      {description && (
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LoadingState() {
  return (
    <div aria-label="Loading report" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-5 h-7 w-28 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-xl border border-red-200 bg-white p-6 sm:p-8 dark:border-red-900/60 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
        Unable to load report
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
      >
        Try again
      </button>
    </section>
  );
}

function NotFoundState() {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center sm:py-16 dark:border-slate-700 dark:bg-slate-800/50">
      <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Report not found</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
        This report is unavailable or does not belong to your business.
      </p>
      <Link
        href="/reports"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
      >
        Return to Reports
      </Link>
    </section>
  );
}

function CostBreakdown({
  energyRecord,
}: {
  energyRecord: ReportEnergyRecord | null;
}) {
  if (!energyRecord) {
    return (
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
        Cost breakdown is unavailable because no energy record is linked to
        this forecast.
      </p>
    );
  }

  const items = [
    {
      label: "Electricity",
      value: energyRecord.electricityBill,
      color: "bg-emerald-500",
    },
    {
      label: "Diesel",
      value: energyRecord.dieselCost,
      color: "bg-amber-500",
    },
    {
      label: "Petrol",
      value: energyRecord.petrolCost,
      color: "bg-blue-500",
    },
    {
      label: "Maintenance",
      value: energyRecord.maintenanceCost,
      color: "bg-slate-400",
    },
  ];

  const total = energyRecord.totalEnergyCost;
  const sumParts = items.reduce((sum, item) => sum + item.value, 0);
  const denominator = total > 0 ? total : sumParts;

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Recorded costs
      </p>

      <div className="space-y-3">
        {items.map((item) => {
          const widthPercent =
            denominator > 0
              ? Math.max(0, Math.min(100, (item.value / denominator) * 100))
              : 0;

          return (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                <span className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                  {formatCurrency(item.value)}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full ${item.color}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Total energy cost
        </span>
        <span className="text-sm font-bold text-slate-950 dark:text-white">
          {formatCurrency(energyRecord.totalEnergyCost)}
        </span>
      </div>
    </div>
  );
}

export default function ReportDetailPage() {
  const params = useParams<{ predictionId: string }>();
  const predictionId =
    typeof params.predictionId === "string" ? params.predictionId : "";

  const [business, setBusiness] = useState<ReportBusiness | null>(null);
  const [prediction, setPrediction] = useState<ReportPrediction | null>(null);
  const [energyRecord, setEnergyRecord] =
    useState<ReportEnergyRecord | null>(null);
  const [insight, setInsight] = useState<ReportInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const loadReport = useCallback(
    async (signal: AbortSignal) => {
      if (!predictionId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setNotFound(false);

      try {
        const response = await fetch(`/api/reports/${predictionId}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal,
        });

        const payload = await response.json();

        if (response.status === 404) {
          setNotFound(true);
          setBusiness(null);
          setPrediction(null);
          setEnergyRecord(null);
          setInsight(null);
          return;
        }

        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "Failed to load report."));
        }

        const parsed = parseReportDetail(payload);
        setBusiness(parsed.business);
        setPrediction(parsed.report.prediction);
        setEnergyRecord(parsed.report.energyRecord);
        setInsight(parsed.report.insight);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setBusiness(null);
        setPrediction(null);
        setEnergyRecord(null);
        setInsight(null);
        setError(
          loadError instanceof TypeError
            ? "Network error while loading report."
            : loadError instanceof Error
              ? loadError.message
              : "Failed to load report."
        );
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [predictionId]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadReport(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadReport, retryKey]);

  const changeValue = useMemo(() => {
    if (!prediction) return null;
    return prediction.predictedChangePercent ?? prediction.predictedChange;
  }, [prediction]);

  async function handleDownload() {
    if (!predictionId) return;

    setDownloadError("");
    setDownloading(true);

    try {
      await downloadReportPdf(predictionId);
    } catch (downloadFailure) {
      setDownloadError(
        downloadFailure instanceof Error
          ? downloadFailure.message
          : "PDF download failed."
      );
    } finally {
      setDownloading(false);
    }
  }

  let content: ReactNode;

  if (loading) {
    content = <LoadingState />;
  } else if (notFound) {
    content = <NotFoundState />;
  } else if (error) {
    content = (
      <ErrorState
        message={error}
        onRetry={() => setRetryKey((value) => value + 1)}
      />
    );
  } else if (!business || !prediction) {
    content = <NotFoundState />;
  } else {
    const actualPeriod = formatActualPeriod(energyRecord);
    const forecastPeriod = formatForecastPeriod(energyRecord);

    content = (
      <div className="space-y-6">
        {downloadError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {downloadError}
          </p>
        )}

        <section
          aria-labelledby="executive-summary-heading"
          className="space-y-4"
        >
          <h2
            id="executive-summary-heading"
            className="text-lg font-semibold text-slate-950 dark:text-white"
          >
            Executive Summary
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Actual cost"
              value={formatCurrency(energyRecord?.totalEnergyCost)}
              hint={recordedLabel(actualPeriod, "cost")}
            />
            <KpiCard
              label="Estimated next-month cost"
              value={formatCurrency(prediction.predictedNextMonthEnergyCost)}
              hint={forecastLabel(forecastPeriod)}
              description="Based on saved bills, usage, and operating data."
            />
            <KpiCard
              label="Forecast change"
              value={formatSignedCurrency(prediction.predictedChange)}
              hint={formatPercent(prediction.predictedChangePercent)}
              toneClass={getChangeTone(changeValue)}
            />
            <KpiCard
              label="GridSense Energy Score"
              value={formatGesScore(energyRecord)}
              hint={recordedLabel(actualPeriod, "score")}
            />
          </div>
          {hasLimitedModelCoverage(business.businessType) && (
            <MlGuardrailNotice variant="coverage" />
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Energy Performance"
            description={
              actualPeriod === "Unavailable"
                ? "Recorded metrics from the linked energy period."
                : `Recorded metrics for ${actualPeriod}.`
            }
          >
            <dl>
              <MetricRow
                label="Consumption"
                detail={recordedLabel(actualPeriod, "usage")}
                value={formatNumber(energyRecord?.energyConsumptionKwh, {
                  suffix: " kWh",
                })}
              />
              <MetricRow
                label="Cost / kWh"
                detail={recordedLabel(actualPeriod, "unit cost")}
                value={formatCurrency(energyRecord?.costPerKwh)}
              />
              <MetricRow
                label="Cost / employee"
                detail={recordedLabel(actualPeriod, "cost per employee")}
                value={formatCurrency(energyRecord?.energyCostPerEmployee)}
              />
              <MetricRow
                label="Revenue / energy ratio"
                detail={recordedLabel(actualPeriod, "ratio")}
                value={formatNumber(energyRecord?.revenueEnergyRatio, {
                  fractionDigits: 2,
                })}
              />
            </dl>
          </SectionCard>

          <SectionCard
            title="Cost Breakdown"
            description={
              actualPeriod === "Unavailable"
                ? "Recorded cost components from the linked energy period."
                : `Recorded costs for ${actualPeriod}.`
            }
          >
            <CostBreakdown energyRecord={energyRecord} />
          </SectionCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Operational Performance"
            description={
              actualPeriod === "Unavailable"
                ? "Recorded operational metrics from the linked energy period."
                : `Recorded operational metrics for ${actualPeriod}.`
            }
          >
            <dl>
              <MetricRow
                label="Recorded generator dependency"
                detail="From the linked energy record"
                value={formatNumber(energyRecord?.generatorDependency, {
                  asPercent: true,
                  fractionDigits: 1,
                })}
              />
              <MetricRow
                label="Generator hours"
                detail={recordedLabel(actualPeriod, "hours")}
                value={formatNumber(energyRecord?.generatorHours, {
                  suffix: " hrs",
                })}
              />
              <MetricRow
                label="Grid hours"
                detail={recordedLabel(actualPeriod, "hours")}
                value={formatNumber(energyRecord?.gridHours, {
                  suffix: " hrs",
                })}
              />
              <MetricRow
                label="Outage hours"
                detail={recordedLabel(actualPeriod, "outage hours")}
                value={formatNumber(energyRecord?.outageHours, {
                  suffix: " hrs",
                })}
              />
              <MetricRow
                label="Operating hours per day"
                detail={recordedLabel(actualPeriod, "hours")}
                value={formatNumber(energyRecord?.operatingHours, {
                  suffix: " hrs",
                })}
              />
            </dl>
          </SectionCard>

          <SectionCard
            title="Forecast Context"
            description={
              forecastPeriod === "Unavailable"
                ? "Saved prediction analytics for this report."
                : `Saved prediction analytics targeting ${forecastPeriod}.`
            }
          >
            <dl>
              <MetricRow label="Model" value={prediction.model} />
              <MetricRow
                label="Actual period"
                value={actualPeriod}
              />
              <MetricRow
                label="Forecast period"
                value={forecastPeriod}
              />
              <MetricRow
                label="Actual cost"
                detail={recordedLabel(actualPeriod, "cost")}
                value={formatCurrency(energyRecord?.totalEnergyCost)}
              />
              <MetricRow
                label="Estimated next-month cost"
                detail={forecastLabel(forecastPeriod)}
                value={formatCurrency(
                  prediction.predictedNextMonthEnergyCost
                )}
              />
              <MetricRow
                label="Absolute change"
                detail="Saved forecast change"
                value={formatSignedCurrency(prediction.predictedChange)}
              />
              <MetricRow
                label="Percentage change"
                detail="Saved forecast percentage change"
                value={formatPercent(prediction.predictedChangePercent)}
              />
              <MetricRow
                label="Forecast generator dependency"
                detail="Saved prediction analytics value"
                value={formatStoredPercent(
                  prediction.generatorDependencyPercent
                )}
              />
              <MetricRow
                label="Forecast input outage hours"
                detail="Saved with the prediction analytics"
                value={formatNumber(prediction.outageHours, {
                  suffix: " hrs",
                })}
              />
            </dl>
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
              This saved figure is an estimate based on the recorded bills,
              usage, and operating data. It is not a guaranteed outcome.
            </p>
          </SectionCard>
        </div>

        <SectionCard
          title="AI Analysis"
          description={
            actualPeriod === "Unavailable"
              ? "Stored AI analysis for this forecast."
              : `Stored AI analysis for the ${actualPeriod} forecast.`
          }
        >
          {insight ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getRiskBadgeClasses(insight.riskLevel)}`}
                >
                  {insight.riskLevel} risk
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Insight text is stored as generated and is not recalculated
                  here.
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4 sm:p-5 dark:bg-slate-800/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Summary
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  {insight.summary}
                </p>
              </div>

              {insight.keyInsights.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Observations
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {insight.keyInsights.map((item) => (
                      <li
                        key={item}
                        className="rounded-lg border border-slate-100 bg-white px-3.5 py-3 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insight.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Priority recommendations
                  </h3>
                  <ol className="mt-3 space-y-2">
                    {insight.recommendations.map((item, index) => (
                      <li
                        key={item}
                        className="flex gap-3 rounded-lg border border-slate-100 bg-white px-3.5 py-3 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                      >
                        <span className="font-semibold text-slate-400 dark:text-slate-500">
                          {index + 1}.
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                AI insights unavailable
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                AI insights were not available for this forecast.
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  return (
    <main className="overflow-x-hidden bg-slate-50 px-4 py-8 text-slate-950 dark:bg-transparent dark:text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
              Reports
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
              Energy Performance Report
            </h1>
            {business && (
              <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                {business.businessName}
              </p>
            )}
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {formatActualPeriod(energyRecord)} →{" "}
              {formatForecastPeriod(energyRecord)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/reports"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
            >
              Back to Reports
            </Link>
            <button
              type="button"
              onClick={() => {
                void handleDownload();
              }}
              disabled={loading || notFound || Boolean(error) || downloading}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
            >
              {downloading ? "Downloading..." : "Download PDF"}
            </button>
          </div>
        </header>

        {content}
      </div>
    </main>
  );
}
