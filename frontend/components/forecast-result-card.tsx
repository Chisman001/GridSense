import { MlGuardrailNotice } from "@/components/ml-guardrail-notice";
import {
  formatForecastCurrency,
  formatForecastPercent,
  type ForecastPrediction,
} from "@/lib/forecast-scenario";
import {
  FORECAST_EYEBROW,
  FORECAST_MEANING_BODY,
  FORECAST_MEANING_TITLE,
  FORECAST_SUBTITLE,
  hasLimitedModelCoverage,
} from "@/lib/ml-guardrails";

type ForecastResultCardProps = {
  result: ForecastPrediction;
  loading?: boolean;
  businessType?: string;
  showMeaningBlock?: boolean;
};

export function ForecastResultCard({
  result,
  loading = false,
  businessType,
  showMeaningBlock = true,
}: ForecastResultCardProps) {
  const analytics = result.analytics;
  const changePercent = analytics?.predicted_change_percent;
  const changeAmount = analytics?.predicted_change;
  const currentCost = analytics?.current_energy_cost;
  const rising = typeof changeAmount === "number" ? changeAmount >= 0 : true;
  const limitedCoverage =
    typeof businessType === "string" && hasLimitedModelCoverage(businessType);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
        {FORECAST_EYEBROW}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
        {formatForecastCurrency(result.predicted_next_month_energy_cost)}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Estimated next-month cost
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {FORECAST_SUBTITLE}
      </p>

      {typeof changePercent === "number" &&
        typeof changeAmount === "number" &&
        typeof currentCost === "number" && (
          <p className="mt-4 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">
            <span className={rising ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
              {rising ? "↑" : "↓"} {formatForecastPercent(Math.abs(changePercent))}
            </span>
            {" · "}
            {formatSignedCurrency(changeAmount)} vs current{" "}
            {formatForecastCurrency(currentCost)}
          </p>
        )}

      <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3 dark:border-slate-800">
        <Metric
          label="Cost per employee"
          value={
            typeof analytics?.predicted_cost_per_employee === "number"
              ? formatForecastCurrency(analytics.predicted_cost_per_employee)
              : "Unavailable"
          }
        />
        <Metric
          label="Cost per kWh"
          value={
            typeof analytics?.predicted_cost_per_kwh === "number"
              ? formatForecastCurrency(analytics.predicted_cost_per_kwh)
              : "Unavailable"
          }
        />
        <Metric
          label="Energy / revenue"
          value={
            typeof analytics?.predicted_energy_cost_as_percent_of_revenue ===
            "number"
              ? formatForecastPercent(
                  analytics.predicted_energy_cost_as_percent_of_revenue
                )
              : "Unavailable"
          }
        />
      </dl>

      {showMeaningBlock && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {FORECAST_MEANING_TITLE}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {FORECAST_MEANING_BODY}
          </p>
        </div>
      )}

      {limitedCoverage && (
        <MlGuardrailNotice variant="coverage" className="mt-4" />
      )}

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Powered by {result.model}
        {loading ? " · updating..." : ""}
      </p>
    </section>
  );
}

function formatSignedCurrency(value: number): string {
  const formatted = formatForecastCurrency(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
        {value}
      </dd>
    </div>
  );
}
