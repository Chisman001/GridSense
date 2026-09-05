"use client";

import { useEffect, useMemo, useState } from "react";

import { GesReadout } from "@/components/ges-readout";
import { MlGuardrailNotice } from "@/components/ml-guardrail-notice";
import {
  deriveEnergyMetrics,
  type RawEnergyRecord,
} from "@/lib/energy-record-pipeline";
import { calculateGES, type GesV1Result } from "@/lib/ges-v1";
import {
  annualizeScenarioDelta,
  applyGeneratorHoursScenario,
  buildScenarioExplanation,
  computeScenarioDelta,
  formatForecastCurrency,
  formatForecastPercent,
  parseForecastPrediction,
  type ForecastPrediction,
  type ScenarioAdjustment,
  GENERATOR_SCENARIO_MAX_REDUCTION_PERCENT,
} from "@/lib/forecast-scenario";
import {
  WHATIF_SCENARIO_DISCLAIMER,
  hasLimitedModelCoverage,
  isScenarioResponseFlat,
} from "@/lib/ml-guardrails";

type WhatIfSimulatorProps = {
  baselineRaw: RawEnergyRecord;
  baselineResult: ForecastPrediction;
  businessType?: string;
  disabled?: boolean;
  disabledReason?: string;
};

type ScenarioInsights = {
  summary: string;
};

export function WhatIfSimulator({
  baselineRaw,
  baselineResult,
  businessType,
  disabled = false,
  disabledReason,
}: WhatIfSimulatorProps) {
  const [reductionPercent, setReductionPercent] = useState(0);
  const [scenarioResult, setScenarioResult] = useState<{
    reductionPercent: number;
    result: ForecastPrediction;
  } | null>(null);
  const [scenarioError, setScenarioError] = useState("");
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState("");
  const [aiExplanation, setAiExplanation] = useState<ScenarioInsights | null>(
    null
  );

  const scenario = useMemo(
    () => applyGeneratorHoursScenario(baselineRaw, reductionPercent),
    [baselineRaw, reductionPercent]
  );

  const baselineDerived = useMemo(
    () => deriveEnergyMetrics(baselineRaw),
    [baselineRaw]
  );
  const scenarioDerived = useMemo(
    () => deriveEnergyMetrics(scenario.scenarioRaw),
    [scenario.scenarioRaw]
  );
  const baselineGes = useMemo(
    () =>
      calculateGES({
        ...baselineRaw,
        totalEnergyCost: baselineDerived.totalEnergyCost,
      }),
    [baselineDerived.totalEnergyCost, baselineRaw]
  );
  const scenarioGes = useMemo(
    () =>
      calculateGES({
        ...scenario.scenarioRaw,
        totalEnergyCost: scenarioDerived.totalEnergyCost,
      }),
    [scenario.scenarioRaw, scenarioDerived.totalEnergyCost]
  );

  useEffect(() => {
    if (disabled || reductionPercent === 0) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void requestScenarioPrediction(
        scenario.scenarioRaw,
        controller.signal
      );
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };

    async function requestScenarioPrediction(
      payload: RawEnergyRecord,
      signal: AbortSignal
    ) {
      setScenarioError("");

      try {
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal,
        });
        const body = await readJson(response, "Prediction API");
        if (!response.ok) {
          throw new Error(getErrorMessage(body, "Scenario estimate could not be generated."));
        }
        setScenarioResult({
          reductionPercent,
          result: parseForecastPrediction(body),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setScenarioError(
          error instanceof Error
            ? error.message
            : "Scenario estimate could not be generated."
        );
        setScenarioResult(null);
      }
    }
  }, [disabled, reductionPercent, scenario.scenarioRaw]);

  const activeScenarioResult =
    disabled ||
    reductionPercent === 0 ||
    scenarioResult?.reductionPercent !== reductionPercent
      ? null
      : scenarioResult.result;

  const monthlyDelta =
    activeScenarioResult == null
      ? null
      : computeScenarioDelta(
          baselineResult.predicted_next_month_energy_cost,
          activeScenarioResult.predicted_next_month_energy_cost
        );
  const yearlyDelta =
    monthlyDelta == null ? null : annualizeScenarioDelta(monthlyDelta);
  const explanation =
    activeScenarioResult && reductionPercent > 0
      ? buildScenarioExplanation({
          reductionPercent,
          baselineCost: baselineResult.predicted_next_month_energy_cost,
          scenarioCost: activeScenarioResult.predicted_next_month_energy_cost,
        })
      : null;

  async function explainWithAi() {
    if (!activeScenarioResult || reductionPercent === 0) {
      return;
    }

    setExplainLoading(true);
    setExplainError("");
    setAiExplanation(null);

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prediction: activeScenarioResult.predicted_next_month_energy_cost,
          analytics: {
            ...(activeScenarioResult.analytics ?? {}),
            baseline_prediction:
              baselineResult.predicted_next_month_energy_cost,
            scenario_prediction:
              activeScenarioResult.predicted_next_month_energy_cost,
            reduction_percent: reductionPercent,
            adjustments: scenario.adjustments,
            note: "This is a scenario estimate, not a saved forecast.",
          },
        }),
      });
      const payload = await readJson(response, "Insights API");
      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "AI scenario explanation is temporarily unavailable.")
        );
      }
      if (!isRecord(payload) || typeof payload.summary !== "string") {
        throw new Error("Insights API returned an invalid response.");
      }
      setAiExplanation({ summary: payload.summary });
    } catch (error) {
      setExplainError(
        error instanceof Error
          ? error.message
          : "AI scenario explanation is temporarily unavailable."
      );
    } finally {
      setExplainLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
            Explore a scenario
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            Generator use reduction
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            What might your next-month energy cost look like if generator use
            were reduced? Diesel and fuel use are scaled with generator hours.
            Grid hours remain unchanged.
          </p>
        </div>
        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          Scenario estimate
        </span>
      </div>

      {typeof businessType === "string" &&
        hasLimitedModelCoverage(businessType) && (
          <MlGuardrailNotice variant="coverage" className="mt-5" />
        )}

      {disabled ? (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {disabledReason ??
            "Inputs changed — regenerate forecast to update the scenario baseline."}
        </p>
      ) : (
        <>
          <div className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Current generator hours
                </p>
                <p className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                  {formatHours(baselineRaw.generatorHours)} hrs
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Scenario generator hours
                </p>
                <p className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                  {formatHours(scenario.scenarioRaw.generatorHours)} hrs
                </p>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="sr-only">
                Generator hours reduction percent
              </span>
              <input
                type="range"
                min={0}
                max={GENERATOR_SCENARIO_MAX_REDUCTION_PERCENT}
                step={1}
                value={reductionPercent}
                onChange={(event) =>
                  setReductionPercent(Number(event.target.value))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600 dark:bg-slate-700"
              />
            </label>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {reductionPercent === 0
                ? "No reduction applied."
                : `That’s a ${formatForecastPercent(reductionPercent, 0)} reduction.`}
            </p>
          </div>

          {reductionPercent > 0 && (
            <dl className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3 dark:border-slate-700 dark:bg-slate-800/70">
              {scenario.adjustments.map((adjustment) => (
                <AdjustmentRow key={adjustment.field} adjustment={adjustment} />
              ))}
            </dl>
          )}

          {reductionPercent === 0 && (
            <p className="mt-5 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Move the slider to estimate a lower generator-usage scenario.
            </p>
          )}

          {reductionPercent > 0 && !activeScenarioResult && !scenarioError && (
            <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
              Updating scenario estimate...
            </p>
          )}

          {scenarioError && (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {scenarioError}
            </p>
          )}

          {activeScenarioResult && monthlyDelta !== null && yearlyDelta !== null && (
            <div className="mt-6 space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Scenario estimate
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Current forecast
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                      {formatForecastCurrency(
                        baselineResult.predicted_next_month_energy_cost
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Scenario
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                      {formatForecastCurrency(
                        activeScenarioResult.predicted_next_month_energy_cost
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Scenario estimate
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                    {formatDeltaCurrency(monthlyDelta)} / month
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Illustrative annual figure (12 × monthly):{" "}
                    {formatDeltaCurrency(yearlyDelta)} / year
                  </p>
                </div>
              </div>

              {isScenarioResponseFlat(
                baselineResult.predicted_next_month_energy_cost,
                activeScenarioResult.predicted_next_month_energy_cost
              ) && <MlGuardrailNotice variant="flat-scenario" />}

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Energy Score
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {formatGesScore(baselineGes)} → {formatGesScore(scenarioGes)}
                  </p>
                  <div className="mt-3">
                    <GesReadout result={scenarioGes} showHelper={false} compact />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Scenario cost mix
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Total energy cost{" "}
                    {formatForecastCurrency(scenarioDerived.totalEnergyCost)} ·
                    generator dependency{" "}
                    {formatForecastPercent(
                      scenarioDerived.generatorDependency * 100
                    )}
                  </p>
                </div>
              </div>

              {explanation && (
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {explanation}
                </p>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => void explainWithAi()}
                  disabled={explainLoading}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {explainLoading
                    ? "Explaining scenario..."
                    : "Explain this scenario with AI"}
                </button>
                {explainError && (
                  <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
                    {explainError}
                  </p>
                )}
                {aiExplanation && (
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    {aiExplanation.summary}
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
            {WHATIF_SCENARIO_DISCLAIMER}
          </p>
        </>
      )}
    </section>
  );
}

function AdjustmentRow({ adjustment }: { adjustment: ScenarioAdjustment }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">
        {adjustment.label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
        {formatAdjustmentValue(adjustment.before, adjustment.unit)} →{" "}
        {formatAdjustmentValue(adjustment.after, adjustment.unit)}
      </dd>
    </div>
  );
}

function formatAdjustmentValue(
  value: number,
  unit: ScenarioAdjustment["unit"]
): string {
  if (unit === "currency") {
    return formatForecastCurrency(value);
  }
  if (unit === "liters") {
    return `${formatHours(value)}L`;
  }
  return `${formatHours(value)} hrs`;
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDeltaCurrency(delta: number): string {
  const formatted = formatForecastCurrency(Math.abs(delta));
  if (delta < 0) {
    return `−${formatted}`;
  }
  if (delta > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

function formatGesScore(result: GesV1Result): string {
  return result.available ? String(Math.round(result.score)) : "—";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson(response: Response, label: string): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned an invalid response.`);
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }
  return fallback;
}
