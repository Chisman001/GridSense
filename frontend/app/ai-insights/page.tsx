"use client";

import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type EnergyRecordSummary = {
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
  createdAt: string;
};

type StoredInsights = {
  id: string;
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  riskLevel: string;
  createdAt: string;
};

type ForecastItem = {
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
  energyRecord: EnergyRecordSummary | null;
  insights: StoredInsights | null;
};

type ForecastHistoryResponse = {
  success: true;
  business: {
    id: string;
    businessName: string;
  };
  latestForecast: ForecastItem | null;
  forecasts: ForecastItem[];
};

type GeneratedInsights = {
  summary: string;
  key_insights: string[];
  recommendations: string[];
  risk_level: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isForecastItem(value: unknown): value is ForecastItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.model === "string" &&
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
    !value.forecasts.every(isForecastItem) ||
    (value.latestForecast !== null &&
      !isForecastItem(value.latestForecast))
  ) {
    throw new Error("Forecast API returned an invalid response.");
  }

  return value as ForecastHistoryResponse;
}

function getApiErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) {
    return fallback;
  }

  if (typeof value.error === "string") {
    return value.error;
  }

  if (typeof value.detail === "string") {
    return value.detail;
  }

  if (
    isRecord(value.detail) &&
    typeof value.detail.message === "string"
  ) {
    return value.detail.message;
  }

  return fallback;
}

function toFriendlyError(message: string, fallback: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("stack") ||
    normalized.includes("traceback") ||
    normalized.includes("gemini") ||
    normalized.includes("postgres") ||
    normalized.includes("drizzle") ||
    normalized.includes("sql") ||
    normalized.includes("econn") ||
    normalized.includes("enotfound")
  ) {
    return fallback;
  }

  if (message.length > 180) {
    return fallback;
  }

  return message || fallback;
}

async function readJsonResponse(
  response: Response,
  label: string
): Promise<unknown> {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`${label} returned an invalid response.`);
  }
}

function parseGeneratedInsights(payload: unknown): GeneratedInsights {
  if (
    !isRecord(payload) ||
    typeof payload.summary !== "string" ||
    !Array.isArray(payload.key_insights) ||
    !payload.key_insights.every((item) => typeof item === "string") ||
    !Array.isArray(payload.recommendations) ||
    !payload.recommendations.every((item) => typeof item === "string") ||
    typeof payload.risk_level !== "string"
  ) {
    throw new Error("AI insights returned an invalid response.");
  }

  return {
    summary: payload.summary,
    key_insights: payload.key_insights,
    recommendations: payload.recommendations,
    risk_level: payload.risk_level,
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

function formatPeriod(
  record: Pick<EnergyRecordSummary, "year" | "month"> | null
) {
  if (!record) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
  }).format(new Date(record.year, record.month - 1));
}

function formatForecastPeriod(
  record: Pick<EnergyRecordSummary, "year" | "month"> | null
) {
  if (!record) {
    return "Next month";
  }

  const nextMonthDate = new Date(record.year, record.month);
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
  }).format(nextMonthDate);
}

function capitalizeRisk(riskLevel: string) {
  if (!riskLevel) return "Unknown";
  return riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).toLowerCase();
}

function getRiskBadgeClasses(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "critical":
      return "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300";
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

function getRiskCardClasses(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "critical":
      return "border-rose-200 bg-gradient-to-br from-rose-50 to-white dark:border-rose-900/60 dark:from-rose-950/40 dark:to-slate-900";
    case "high":
      return "border-red-200 bg-gradient-to-br from-red-50 to-white dark:border-red-900/60 dark:from-red-950/40 dark:to-slate-900";
    case "moderate":
      return "border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900/60 dark:from-amber-950/40 dark:to-slate-900";
    case "low":
      return "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-slate-900";
    default:
      return "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
  }
}

function getRiskExplanation(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "critical":
      return "Stored analysis flagged elevated near-term energy-cost pressure for this forecast period.";
    case "high":
      return "Stored analysis indicates elevated energy-cost risk for the upcoming period.";
    case "moderate":
      return "Stored analysis indicates moderate energy-cost risk that warrants attention.";
    case "low":
      return "Stored analysis indicates comparatively lower near-term energy-cost risk.";
    default:
      return "Risk level is based on the stored AI analysis for this forecast.";
  }
}

function buildAnalyticsPayload(forecast: ForecastItem) {
  const analytics: Record<string, number> = {};

  if (forecast.energyRecord) {
    analytics.current_energy_cost = forecast.energyRecord.totalEnergyCost;
  }

  analytics.predicted_energy_cost = forecast.predictedNextMonthEnergyCost;

  if (typeof forecast.predictedChange === "number") {
    analytics.predicted_change = forecast.predictedChange;
  }

  if (typeof forecast.predictedChangePercent === "number") {
    analytics.predicted_change_percent = forecast.predictedChangePercent;
  }

  if (typeof forecast.predictedCostPerEmployee === "number") {
    analytics.predicted_cost_per_employee =
      forecast.predictedCostPerEmployee;
  }

  if (typeof forecast.predictedCostPerKwh === "number") {
    analytics.predicted_cost_per_kwh = forecast.predictedCostPerKwh;
  }

  if (typeof forecast.generatorDependencyPercent === "number") {
    analytics.generator_dependency_percent =
      forecast.generatorDependencyPercent;
  }

  if (typeof forecast.outageHours === "number") {
    analytics.outage_hours = forecast.outageHours;
  }

  if (
    typeof forecast.predictedEnergyCostAsPercentOfRevenue === "number"
  ) {
    analytics.predicted_energy_cost_as_percent_of_revenue =
      forecast.predictedEnergyCostAsPercentOfRevenue;
  }

  return analytics;
}

function mapPersistedInsights(
  forecastId: string,
  generated: GeneratedInsights,
  previous: StoredInsights | null
): StoredInsights {
  return {
    id: previous?.id ?? forecastId,
    summary: generated.summary,
    keyInsights: generated.key_insights,
    recommendations: generated.recommendations,
    riskLevel: generated.risk_level,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
  };
}

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "neutral";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-700 dark:text-red-400"
        : "text-slate-950 dark:text-slate-100";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-2 text-xl font-semibold tracking-tight sm:text-2xl ${valueClass}`}>
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </article>
  );
}

function MiniInsightCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </article>
  );
}

function LoadingState() {
  return (
    <div aria-label="Loading AI insights" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-5 h-7 w-28 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}

function PageErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-xl border border-red-200 bg-white p-6 sm:p-8 dark:border-red-900/60 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
        Unable to load AI insights
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
      >
        Try again
      </button>
    </section>
  );
}

function NoForecastsState() {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 sm:p-8 dark:border-slate-700 dark:bg-slate-800/50">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
        No forecasts yet
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
        AI Insights are generated from your saved forecasts and energy
        records. Create a forecast to unlock analysis for your business.
      </p>
      <Link
        href="/forecast"
        className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
      >
        Create forecast
      </Link>
    </section>
  );
}

function MissingInsightsState({
  generating,
  onGenerate,
}: {
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 sm:p-8 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
        No AI insights yet
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
        Your forecast has been saved, but AI analysis has not been
        generated for this forecast.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
      >
        {generating ? "Generating AI insights..." : "Generate AI insights"}
      </button>
    </section>
  );
}

function InsightsFailureState({
  generating,
  onRetry,
}: {
  generating: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-6 sm:p-8 dark:border-amber-900/60 dark:bg-amber-950/40">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
        AI insights unavailable
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
        Your forecast is safely saved. AI analysis could not be generated
        right now.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={generating}
        className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
      >
        {generating ? "Retrying AI insights..." : "Retry AI insights"}
      </button>
    </section>
  );
}

export default function AiInsightsPage() {
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [selectedForecastId, setSelectedForecastId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);

  const loadForecasts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    setGenerationFailed(false);

    try {
      const response = await fetch("/api/forecasts", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal,
      });

      const payload = await readJsonResponse(response, "Forecasts API");

      if (!response.ok) {
        throw new Error(
          toFriendlyError(
            getApiErrorMessage(payload, "Failed to load forecasts."),
            "Failed to load AI insights. Please try again."
          )
        );
      }

      const parsed = parseForecastHistory(payload);
      setForecasts(parsed.forecasts);

      setSelectedForecastId((current) => {
        if (
          current &&
          parsed.forecasts.some((forecast) => forecast.id === current)
        ) {
          return current;
        }

        const latestWithInsights =
          parsed.forecasts.find((forecast) => forecast.insights !== null) ??
          null;

        return (
          latestWithInsights?.id ??
          parsed.latestForecast?.id ??
          parsed.forecasts[0]?.id ??
          null
        );
      });
    } catch (loadError) {
      if (
        loadError instanceof DOMException &&
        loadError.name === "AbortError"
      ) {
        return;
      }

      setError(
        toFriendlyError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load AI insights.",
          "Failed to load AI insights. Please try again."
        )
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadForecasts(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadForecasts, retryKey]);

  const selectedForecast = useMemo(() => {
    if (!selectedForecastId) {
      return null;
    }

    return (
      forecasts.find((forecast) => forecast.id === selectedForecastId) ??
      null
    );
  }, [forecasts, selectedForecastId]);

  const insightHistory = useMemo(
    () => forecasts.filter((forecast) => forecast.insights !== null),
    [forecasts]
  );

  function selectForecast(forecastId: string) {
    setSelectedForecastId(forecastId);
    setGenerationFailed(false);
  }

  async function generateOrRetryInsights() {
    if (!selectedForecast) {
      return;
    }

    setGenerating(true);
    setGenerationFailed(false);

    try {
      const insightsResponse = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prediction: selectedForecast.predictedNextMonthEnergyCost,
          analytics: buildAnalyticsPayload(selectedForecast),
        }),
      });

      const insightsPayload = await readJsonResponse(
        insightsResponse,
        "Insights API"
      );

      if (!insightsResponse.ok) {
        throw new Error(
          getApiErrorMessage(
            insightsPayload,
            "AI insights are temporarily unavailable."
          )
        );
      }

      const generatedInsights = parseGeneratedInsights(insightsPayload);

      const persistResponse = await fetch(
        `/api/forecasts/${encodeURIComponent(selectedForecast.id)}/insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            aiInsights: generatedInsights,
          }),
        }
      );

      const persistPayload = await readJsonResponse(
        persistResponse,
        "Insights save API"
      );

      if (!persistResponse.ok) {
        throw new Error(
          getApiErrorMessage(
            persistPayload,
            "AI insights were generated but could not be saved."
          )
        );
      }

      const nextInsights = mapPersistedInsights(
        selectedForecast.id,
        generatedInsights,
        selectedForecast.insights
      );

      setForecasts((previous) =>
        previous.map((forecast) =>
          forecast.id === selectedForecast.id
            ? { ...forecast, insights: nextInsights }
            : forecast
        )
      );
      setGenerationFailed(false);
    } catch {
      setGenerationFailed(true);
    } finally {
      setGenerating(false);
    }
  }

  const insights = selectedForecast?.insights ?? null;
  const energyRecord = selectedForecast?.energyRecord ?? null;
  const changePercent = selectedForecast?.predictedChangePercent ?? null;
  const changeAbsolute = selectedForecast?.predictedChange ?? null;
  const changeTone =
    typeof changePercent === "number"
      ? changePercent > 0
        ? "negative"
        : changePercent < 0
          ? "positive"
          : "neutral"
      : typeof changeAbsolute === "number"
        ? changeAbsolute > 0
          ? "negative"
          : changeAbsolute < 0
            ? "positive"
            : "neutral"
        : "default";

  const forecastDirection =
    typeof changePercent === "number"
      ? changePercent > 0
        ? "Cost increase expected"
        : changePercent < 0
          ? "Cost decrease expected"
          : "No material change expected"
      : typeof changeAbsolute === "number"
        ? changeAbsolute > 0
          ? "Cost increase expected"
          : changeAbsolute < 0
            ? "Cost decrease expected"
            : "No material change expected"
        : null;

  let content: ReactNode;

  if (loading) {
    content = <LoadingState />;
  } else if (error) {
    content = (
      <PageErrorState
        message={error}
        onRetry={() => setRetryKey((value) => value + 1)}
      />
    );
  } else if (forecasts.length === 0) {
    content = <NoForecastsState />;
  } else if (!selectedForecast) {
    content = <NoForecastsState />;
  } else if (!insights) {
    content = generationFailed ? (
      <InsightsFailureState
        generating={generating}
        onRetry={() => {
          void generateOrRetryInsights();
        }}
      />
    ) : (
      <MissingInsightsState
        generating={generating}
        onGenerate={() => {
          void generateOrRetryInsights();
        }}
      />
    );
  } else {
    content = (
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="AI risk level"
            value={capitalizeRisk(insights.riskLevel)}
            hint="From stored analysis"
          />
          <MetricCard
            label="Recommendations"
            value={String(insights.recommendations.length)}
            hint={
              insights.recommendations.length === 1
                ? "1 stored recommendation"
                : `${insights.recommendations.length} stored recommendations`
            }
          />
          <MetricCard
            label="Estimated next-month cost"
            value={formatCurrency(
              selectedForecast.predictedNextMonthEnergyCost
            )}
            hint={formatForecastPeriod(energyRecord)}
          />
          <MetricCard
            label="Forecast change"
            value={formatPercent(changePercent)}
            hint={
              typeof changeAbsolute === "number"
                ? formatSignedCurrency(changeAbsolute)
                : undefined
            }
            tone={changeTone}
          />
          <MetricCard
            label="Insight period"
            value={formatPeriod(energyRecord)}
            hint={`Forecast: ${formatForecastPeriod(energyRecord)}`}
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forecastDirection ? (
            <MiniInsightCard
              label="Forecast direction"
              value={forecastDirection}
            />
          ) : null}
          <MiniInsightCard
            label="Risk level"
            value={capitalizeRisk(insights.riskLevel)}
          />
          <MiniInsightCard
            label="Recommendations"
            value={String(insights.recommendations.length)}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                Priority actions
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                Priority recommendations
              </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              From your stored AI analysis
            </p>
          </div>

          {insights.recommendations.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No recommendations were stored for this insight.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {insights.recommendations.map((recommendation, index) => (
                <article
                  key={`${recommendation}-${index}`}
                  className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-emerald-700 dark:bg-slate-900 dark:text-emerald-300">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-emerald-950/80 dark:text-emerald-200/90">
                      {recommendation}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article
            className={`rounded-xl border p-5 shadow-sm sm:p-6 dark:shadow-none ${getRiskCardClasses(
              insights.riskLevel
            )}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Risk analysis
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                Current risk
              </h3>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getRiskBadgeClasses(
                  insights.riskLevel
                )}`}
              >
                {insights.riskLevel}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">
              {getRiskExplanation(insights.riskLevel)}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              This reflects the stored AI assessment for the selected
              forecast. It is not a guarantee of financial outcomes.
            </p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
              Supporting reasoning
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              Observations
            </h3>
            <div className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/70">
              <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                {insights.summary}
              </p>
            </div>
            {insights.keyInsights.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {insights.keyInsights.map((insight, index) => (
                  <li
                    key={`${insight}-${index}`}
                    className="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-400"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {index + 1}
                    </span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Forecast context
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                What this analysis was based on
              </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Model: {selectedForecast.model}
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Actual
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">
                {formatCurrency(energyRecord?.totalEnergyCost)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatPeriod(energyRecord)}
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/60 dark:bg-blue-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Forecast
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">
                {formatCurrency(
                  selectedForecast.predictedNextMonthEnergyCost
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatForecastPeriod(energyRecord)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2 xl:col-span-1 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Absolute change
              </p>
              <p
                className={`mt-2 text-xl font-semibold ${
                  changeTone === "positive"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : changeTone === "negative"
                      ? "text-red-700 dark:text-red-400"
                      : "text-slate-950 dark:text-slate-100"
                }`}
              >
                {formatSignedCurrency(changeAbsolute)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Percentage change: {formatPercent(changePercent)}
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-100 px-3.5 py-3 dark:border-slate-800">
              <dt className="text-xs text-slate-500 dark:text-slate-400">Forecast period</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {formatForecastPeriod(energyRecord)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 px-3.5 py-3 dark:border-slate-800">
              <dt className="text-xs text-slate-500 dark:text-slate-400">Insight period</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {formatPeriod(energyRecord)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 px-3.5 py-3 dark:border-slate-800">
              <dt className="text-xs text-slate-500 dark:text-slate-400">Model name</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selectedForecast.model}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    );
  }

  return (
    <main className="bg-slate-50 text-slate-950 dark:bg-transparent dark:text-slate-100">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="mb-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                Intelligence
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
              AI Insights
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-400">
              Turn your energy data and forecasts into actionable business
              recommendations.
            </p>
          </section>

          {content}

          {!loading && !error && insightHistory.length > 0 ? (
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    History
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    Insight history
                  </h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {insightHistory.length === 1
                    ? "1 saved insight"
                    : `${insightHistory.length} saved insights`}
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                {insightHistory.map((forecast) => {
                  const isSelected = forecast.id === selectedForecastId;
                  const historyInsights = forecast.insights;

                  if (!historyInsights) {
                    return null;
                  }

                  return (
                    <button
                      key={forecast.id}
                      type="button"
                      onClick={() => selectForecast(forecast.id)}
                      className={`w-full rounded-xl border px-4 py-3.5 text-left transition ${
                        isSelected
                          ? "border-blue-300 bg-blue-50/70 ring-1 ring-blue-200 dark:border-blue-700 dark:bg-blue-950/40 dark:ring-blue-900/60"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                            {formatPeriod(forecast.energyRecord)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Forecast {formatForecastPeriod(forecast.energyRecord)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                            {formatCurrency(
                              forecast.predictedNextMonthEnergyCost
                            )}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getRiskBadgeClasses(
                              historyInsights.riskLevel
                            )}`}
                          >
                            {historyInsights.riskLevel}
                          </span>
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                            {historyInsights.recommendations.length}{" "}
                            {historyInsights.recommendations.length === 1
                              ? "recommendation"
                              : "recommendations"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

        </div>
      </div>
    </main>
  );
}
