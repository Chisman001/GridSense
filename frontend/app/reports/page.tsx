"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type HistoryEnergyRecord = {
  id: string;
  year: number;
  month: number;
  totalEnergyCost: number;
};

type HistoryInsights = {
  id: string;
  riskLevel: string;
};

type HistoryForecast = {
  id: string;
  createdAt: string;
  predictedNextMonthEnergyCost: number;
  predictedChange: number | null;
  predictedChangePercent: number | null;
  energyRecord: HistoryEnergyRecord | null;
  insights: HistoryInsights | null;
};

type ForecastHistoryResponse = {
  success: true;
  business: {
    id: string;
    businessName: string;
  };
  latestForecast: HistoryForecast | null;
  forecasts: HistoryForecast[];
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

function isHistoryForecast(value: unknown): value is HistoryForecast {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    isFiniteNumber(value.predictedNextMonthEnergyCost) &&
    (value.energyRecord === null || isRecord(value.energyRecord)) &&
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
    !Array.isArray(value.forecasts) ||
    !value.forecasts.every(isHistoryForecast) ||
    (value.latestForecast !== null &&
      !isHistoryForecast(value.latestForecast))
  ) {
    throw new Error("Forecast API returned an invalid response.");
  }

  return value as ForecastHistoryResponse;
}

function getErrorMessage(value: unknown): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : "Failed to load reports.";
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

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  const absolute = Math.abs(value).toFixed(1);
  if (value > 0) return `+${absolute}%`;
  if (value < 0) return `-${absolute}%`;
  return `${absolute}%`;
}

function formatPeriod(year: number, month: number) {
  if (month < 1 || month > 12) {
    return "Unavailable";
  }

  return `${monthNames[month - 1]} ${year}`;
}

function formatActualPeriod(record: HistoryEnergyRecord | null) {
  if (!record) {
    return "Unavailable";
  }

  return formatPeriod(record.year, record.month);
}

function formatForecastTarget(record: HistoryEnergyRecord | null) {
  if (!record) {
    return "Unavailable";
  }

  const next = new Date(record.year, record.month);
  return `${monthNames[next.getMonth()]} ${next.getFullYear()}`;
}

function formatAnalysisDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
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
    return "text-slate-700 dark:text-slate-300";
  }

  if (value > 0) return "text-red-700 dark:text-red-400";
  if (value < 0) return "text-emerald-700 dark:text-emerald-400";
  return "text-slate-700 dark:text-slate-300";
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
      if (isRecord(payload) && typeof payload.error === "string") {
        message = payload.error;
      }
    } catch {
      // Keep fallback message.
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

function LoadingState() {
  return (
    <section aria-label="Loading reports" className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5 sm:h-20 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-4 h-4 w-48 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </section>
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
        Unable to load reports
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

function EmptyState() {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center sm:py-16 dark:border-slate-700 dark:bg-slate-800/50">
      <h2 className="text-xl font-semibold text-slate-950 dark:text-white">No reports yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
        Generate an energy forecast to create your first report.
      </p>
      <Link
        href="/forecast"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
      >
        Generate Energy Forecast
      </Link>
    </section>
  );
}

function RiskBadge({ riskLevel }: { riskLevel: string | null }) {
  if (!riskLevel) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
        Unavailable
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getRiskBadgeClasses(riskLevel)}`}
    >
      {riskLevel}
    </span>
  );
}

function ActionButtons({
  predictionId,
  downloadingId,
  onDownload,
}: {
  predictionId: string;
  downloadingId: string | null;
  onDownload: (id: string) => void;
}) {
  const downloading = downloadingId === predictionId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/reports/${predictionId}`}
        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
      >
        View
      </Link>
      <button
        type="button"
        onClick={() => onDownload(predictionId)}
        disabled={downloading}
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
      >
        {downloading ? "Downloading..." : "Download"}
      </button>
    </div>
  );
}

function ReportCard({
  forecast,
  downloadingId,
  onDownload,
}: {
  forecast: HistoryForecast;
  downloadingId: string | null;
  onDownload: (id: string) => void;
}) {
  const changeValue =
    forecast.predictedChangePercent ?? forecast.predictedChange;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Actual period
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
            {formatActualPeriod(forecast.energyRecord)}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Forecast target: {formatForecastTarget(forecast.energyRecord)}
          </p>
        </div>
        <RiskBadge riskLevel={forecast.insights?.riskLevel ?? null} />
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Forecasted cost</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(forecast.predictedNextMonthEnergyCost)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Actual cost</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(forecast.energyRecord?.totalEnergyCost)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Change</dt>
          <dd
            className={`mt-1 text-sm font-semibold ${getChangeTone(changeValue)}`}
          >
            {formatPercent(forecast.predictedChangePercent)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Analysis date</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {formatAnalysisDate(forecast.createdAt)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <ActionButtons
          predictionId={forecast.id}
          downloadingId={downloadingId}
          onDownload={onDownload}
        />
      </div>
    </article>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [forecasts, setForecasts] = useState<HistoryForecast[]>([]);
  const [latestForecast, setLatestForecast] =
    useState<HistoryForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");

  const loadReports = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/forecasts", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(payload));
      }

      const parsed = parseForecastHistory(payload);
      setForecasts(parsed.forecasts);
      setLatestForecast(parsed.latestForecast);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setForecasts([]);
      setLatestForecast(null);
      setError(
        loadError instanceof TypeError
          ? "Network error while loading reports."
          : loadError instanceof Error
            ? loadError.message
            : "Failed to load reports."
      );
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadReports(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadReports, retryKey]);

  async function handleDownload(predictionId: string) {
    setDownloadError("");
    setDownloadingId(predictionId);

    try {
      await downloadReportPdf(predictionId);
    } catch (downloadFailure) {
      setDownloadError(
        downloadFailure instanceof Error
          ? downloadFailure.message
          : "PDF download failed."
      );
    } finally {
      setDownloadingId(null);
    }
  }

  function handleGenerateReport() {
    if (latestForecast) {
      router.push(`/reports/${latestForecast.id}`);
      return;
    }

    router.push("/forecast");
  }

  let content: ReactNode;

  if (loading) {
    content = <LoadingState />;
  } else if (error) {
    content = (
      <ErrorState
        message={error}
        onRetry={() => setRetryKey((value) => value + 1)}
      />
    );
  } else if (forecasts.length === 0) {
    content = <EmptyState />;
  } else {
    content = (
      <div className="space-y-4">
        {downloadError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {downloadError}
          </p>
        )}

        <div className="space-y-4 lg:hidden">
          {forecasts.map((forecast) => (
            <ReportCard
              key={forecast.id}
              forecast={forecast}
              downloadingId={downloadingId}
              onDownload={handleDownload}
            />
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40 lg:block dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Period
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Forecast
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Actual cost
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Change
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Risk
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Analysis date
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {forecasts.map((forecast) => {
                const changeValue =
                  forecast.predictedChangePercent ??
                  forecast.predictedChange;

                return (
                  <tr key={forecast.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-4 align-top">
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                        {formatActualPeriod(forecast.energyRecord)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Target: {formatForecastTarget(forecast.energyRecord)}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(forecast.predictedNextMonthEnergyCost)}
                    </td>
                    <td className="px-5 py-4 align-top text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(forecast.energyRecord?.totalEnergyCost)}
                    </td>
                    <td
                      className={`px-5 py-4 align-top text-sm font-semibold ${getChangeTone(changeValue)}`}
                    >
                      {formatPercent(forecast.predictedChangePercent)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <RiskBadge
                        riskLevel={forecast.insights?.riskLevel ?? null}
                      />
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-700 dark:text-slate-300">
                      {formatAnalysisDate(forecast.createdAt)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <ActionButtons
                        predictionId={forecast.id}
                        downloadingId={downloadingId}
                        onDownload={handleDownload}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <main className="overflow-x-hidden bg-slate-50 px-4 py-8 text-slate-950 dark:bg-transparent dark:text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
              Reports
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Generate and review energy performance reports from your saved
              forecasts.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
          >
            Generate report
          </button>
        </header>

        <section aria-labelledby="report-history-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="report-history-heading"
              className="text-lg font-semibold text-slate-950 dark:text-white"
            >
              Report history
            </h2>
            {!loading && !error && forecasts.length > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {forecasts.length}{" "}
                {forecasts.length === 1 ? "report" : "reports"}
              </p>
            )}
          </div>

          {content}
        </section>
      </div>
    </main>
  );
}
