"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  calculateGES,
  gesUnavailableMessage,
  type GesV1Available,
  type GesV1Result,
} from "@/lib/ges-v1";
import { useIsDark, getChartTheme } from "@/lib/use-is-dark";

type EnergyRecord = {
  id: string;
  year: number;
  month: number;
  energySource: string;
  electricityBill: number;
  dieselCost: number;
  petrolCost: number;
  totalEnergyCost: number;
  energyConsumptionKwh: number;
  maintenanceCost: number;
  costPerKwh: number;
  monthlyRevenue: number;
  generatorHours: number;
  gridHours: number;
  outageHours: number;
  operatingHours: number;
};

type Forecast = {
  id: string;
  createdAt: string | null;
  predictedNextMonthEnergyCost: number;
  predictedChange: number | null;
  predictedChangePercent: number | null;
  energyRecord: {
    id: string;
    year: number;
    month: number;
    totalEnergyCost: number;
  } | null;
};

type ChartTooltipPayload = {
  color?: string;
  name?: string;
  value?: number | string;
};

type CurrencyTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: ChartTooltipPayload[];
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
];

const sourceColors = ["#059669", "#d97706", "#2563eb"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseEnergyRecords(payload: unknown): EnergyRecord[] {
  if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.records)) {
    throw new Error("Energy records returned an invalid response.");
  }

  return payload.records.filter((item): item is EnergyRecord => {
    if (!isRecord(item)) return false;

    return (
      typeof item.id === "string" &&
      Number.isInteger(item.year) &&
      Number.isInteger(item.month) &&
      typeof item.energySource === "string" &&
      isFiniteNumber(item.electricityBill) &&
      isFiniteNumber(item.dieselCost) &&
      isFiniteNumber(item.petrolCost) &&
      isFiniteNumber(item.totalEnergyCost) &&
      isFiniteNumber(item.energyConsumptionKwh) &&
      isFiniteNumber(item.maintenanceCost) &&
      isFiniteNumber(item.costPerKwh) &&
      isFiniteNumber(item.monthlyRevenue) &&
      isFiniteNumber(item.generatorHours) &&
      isFiniteNumber(item.gridHours) &&
      isFiniteNumber(item.outageHours) &&
      isFiniteNumber(item.operatingHours)
    );
  });
}

function parseForecasts(payload: unknown): Forecast[] {
  if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.forecasts)) {
    throw new Error("Forecasts returned an invalid response.");
  }

  const forecasts: Forecast[] = [];

  for (const item of payload.forecasts) {
    if (!isRecord(item)) continue;

    const linkedRecordValue = item.energyRecord;
    let energyRecord: Forecast["energyRecord"] = null;

    if (linkedRecordValue !== null) {
      if (!isRecord(linkedRecordValue)) continue;

      const linkedYear = linkedRecordValue.year;
      const linkedMonth = linkedRecordValue.month;
      const linkedCost = linkedRecordValue.totalEnergyCost;

      if (
        typeof linkedRecordValue.id !== "string" ||
        !isFiniteNumber(linkedYear) ||
        !Number.isInteger(linkedYear) ||
        !isFiniteNumber(linkedMonth) ||
        !Number.isInteger(linkedMonth) ||
        !isFiniteNumber(linkedCost)
      ) {
        continue;
      }

      energyRecord = {
        id: linkedRecordValue.id,
        year: linkedYear,
        month: linkedMonth,
        totalEnergyCost: linkedCost,
      };
    }

    if (
      typeof item.id !== "string" ||
      !isFiniteNumber(item.predictedNextMonthEnergyCost) ||
      !(item.predictedChange === null || isFiniteNumber(item.predictedChange)) ||
      !(
        item.predictedChangePercent === null ||
        isFiniteNumber(item.predictedChangePercent)
      )
    ) {
      continue;
    }

    forecasts.push({
      id: item.id,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
      predictedNextMonthEnergyCost: item.predictedNextMonthEnergyCost,
      predictedChange: item.predictedChange,
      predictedChangePercent: item.predictedChangePercent,
      energyRecord,
    });
  }

  return forecasts;
}

function recordGes(record: EnergyRecord): GesV1Result {
  return calculateGES({
    totalEnergyCost: record.totalEnergyCost,
    monthlyRevenue: record.monthlyRevenue,
    generatorHours: record.generatorHours,
    gridHours: record.gridHours,
    outageHours: record.outageHours,
    operatingHours: record.operatingHours,
    year: record.year,
    month: record.month,
  });
}

function compareForecastRecency(left: Forecast, right: Forecast): number {
  const leftTime = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
  const rightTime = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return rightTime - leftTime;
  }
  if (Number.isFinite(leftTime)) return -1;
  if (Number.isFinite(rightTime)) return 1;
  return 0;
}

function getApiError(payload: unknown, fallback: string): string {
  return isRecord(payload) && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

async function readJson(response: Response): Promise<unknown> {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("The server returned an invalid response.");
  }
}

function periodIndex(year: number, month: number): number {
  return year * 12 + month - 1;
}

function formatPeriod(year: number, month: number): string {
  return `${monthNames[month - 1]?.slice(0, 3) ?? month} ${year}`;
}

function nextPeriod(year: number, month: number): { year: number; month: number } {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits,
  }).format(value);
}

function CurrencyTooltip({ active, label, payload }: CurrencyTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {label && <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{label}</p>}
      {payload.map((item) => (
        <p key={`${item.name}-${item.value}`} className="mt-1 text-slate-600 dark:text-slate-400">
          <span
            aria-hidden="true"
            className="mr-1.5 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.name}:{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(Number(item.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

function TrendTooltip({ active, label, payload }: CurrencyTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {label && <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{label}</p>}
      {payload.map((item) => (
        <p key={`${item.name}-${item.value}`} className="mt-1 text-slate-600 dark:text-slate-400">
          {item.name}:{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {item.name === "Energy consumption"
              ? `${formatNumber(Number(item.value ?? 0))} kWh`
              : formatCurrency(Number(item.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

function ScoreTooltip({ active, label, payload }: CurrencyTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {label && <p className="font-semibold text-slate-900 dark:text-slate-100">{label}</p>}
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        Energy score:{" "}
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {formatNumber(Number(payload[0]?.value ?? 0))}/100
        </span>
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
        {value}
      </p>
      <div className="mt-2 min-h-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {detail}
      </div>
    </article>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function EmptyState({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-800/70">
      <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}

function Interpretation({
  label = "What this means",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/70">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">{children}</div>
    </div>
  );
}

const ILLUSTRATIVE_BENCHMARK_SCORE = 78;
const ILLUSTRATIVE_BENCHMARK_COST_PER_KWH = 165;

const ILLUSTRATIVE_SAVINGS_SCENARIOS = [
  { id: "conservative", label: "Conservative", reductionPercent: 5 },
  { id: "moderate", label: "Moderate", reductionPercent: 10 },
  { id: "aggressive", label: "Aggressive", reductionPercent: 15 },
] as const;

function IllustrativeDataBadge() {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
      Illustrative data
    </span>
  );
}

function BusinessComparisonDemo({
  efficiencyScore,
  costPerKwh,
}: {
  efficiencyScore: number | null;
  costPerKwh: number | null;
}) {
  const hasBusinessValues =
    efficiencyScore !== null &&
    costPerKwh !== null &&
    Number.isFinite(efficiencyScore) &&
    Number.isFinite(costPerKwh);

  const scoreDelta = hasBusinessValues
    ? efficiencyScore - ILLUSTRATIVE_BENCHMARK_SCORE
    : null;
  const costPercentAboveBenchmark =
    hasBusinessValues && ILLUSTRATIVE_BENCHMARK_COST_PER_KWH > 0
      ? ((costPerKwh - ILLUSTRATIVE_BENCHMARK_COST_PER_KWH) /
          ILLUSTRATIVE_BENCHMARK_COST_PER_KWH) *
        100
      : null;

  const maxScoreBar = 100;
  const maxCostBar = hasBusinessValues
    ? Math.max(costPerKwh, ILLUSTRATIVE_BENCHMARK_COST_PER_KWH, 1)
    : ILLUSTRATIVE_BENCHMARK_COST_PER_KWH;

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            Illustrative benchmark
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            Business comparison
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            See how your current energy performance compares with an illustrative
            benchmark.
          </p>
        </div>
        <IllustrativeDataBadge />
      </div>

      {!hasBusinessValues ? (
        <div className="mt-6">
          <EmptyState
            title="No recorded values available."
            description="Add an energy record to compare your GridSense Energy Score and cost per kWh with the illustrative benchmark."
          />
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                Your business
              </p>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">GridSense Energy Score</dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {formatNumber(efficiencyScore)}/100
                  </dd>
                  <div
                    aria-hidden="true"
                    className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{
                        width: `${Math.min(
                          100,
                          (efficiencyScore / maxScoreBar) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Cost per kWh</dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {formatCurrency(costPerKwh)}
                  </dd>
                  <div
                    aria-hidden="true"
                    className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                  >
                    <div
                      className="h-full rounded-full bg-slate-700"
                      style={{
                        width: `${Math.min(
                          100,
                          (costPerKwh / maxCostBar) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </dl>
            </article>

            <article className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-800 dark:text-amber-300">
                  Illustrative benchmark
                </p>
                <span className="text-[0.65rem] font-medium text-amber-700 dark:text-amber-400">
                  Not real market data
                </span>
              </div>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    GridSense Energy Score
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {formatNumber(ILLUSTRATIVE_BENCHMARK_SCORE)}/100
                  </dd>
                  <div
                    aria-hidden="true"
                    className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100"
                  >
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (ILLUSTRATIVE_BENCHMARK_SCORE / maxScoreBar) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <dt className="text-xs text-amber-800/80 dark:text-amber-300/80">Cost per kWh</dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {formatCurrency(ILLUSTRATIVE_BENCHMARK_COST_PER_KWH)}
                  </dd>
                  <div
                    aria-hidden="true"
                    className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100"
                  >
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (ILLUSTRATIVE_BENCHMARK_COST_PER_KWH / maxCostBar) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </dl>
            </article>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 px-3.5 py-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">GridSense Energy Score</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                {scoreDelta === null
                  ? "Unavailable"
                  : `${scoreDelta >= 0 ? "+" : ""}${formatNumber(
                      scoreDelta
                    )} points`}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 px-3.5 py-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Cost per kWh</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                {costPercentAboveBenchmark === null
                  ? "Unavailable"
                  : costPercentAboveBenchmark >= 0
                    ? `${formatNumber(
                        costPercentAboveBenchmark
                      )}% above illustrative benchmark`
                    : `${formatNumber(
                        Math.abs(costPercentAboveBenchmark)
                      )}% below illustrative benchmark`}
              </p>
            </div>
          </div>

          <Interpretation label="Interpretation">
            <p>
              {scoreDelta !== null &&
              scoreDelta >= 0 &&
              costPercentAboveBenchmark !== null &&
              costPercentAboveBenchmark >= 0
                ? "Your recorded efficiency score is above the illustrative benchmark, while your cost per kWh is higher."
                : `Your recorded efficiency score is ${
                    scoreDelta !== null && scoreDelta >= 0 ? "above" : "below"
                  } the illustrative benchmark, while your cost per kWh is ${
                    costPercentAboveBenchmark !== null &&
                    costPercentAboveBenchmark >= 0
                      ? "higher"
                      : "lower"
                  }.`}{" "}
              In a production version, these comparisons would use verified
              benchmark data from similar businesses.
            </p>
          </Interpretation>
        </>
      )}
    </section>
  );
}

function SavingsProjectionDemo({
  currentMonthlyEnergyCost,
}: {
  currentMonthlyEnergyCost: number | null;
}) {
  const hasCurrentCost =
    currentMonthlyEnergyCost !== null &&
    Number.isFinite(currentMonthlyEnergyCost);

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            Illustrative scenario
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            Savings projection
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Explore what a potential reduction in energy costs could look like.
          </p>
        </div>
        <IllustrativeDataBadge />
      </div>

      {!hasCurrentCost ? (
        <div className="mt-6">
          <EmptyState
            title="No monthly energy cost available."
            description="Add an energy record so illustrative savings scenarios can be calculated from your recorded monthly energy cost."
          />
        </div>
      ) : (
        <>
          <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Starting from recorded monthly energy cost{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {formatCurrency(currentMonthlyEnergyCost)}
            </span>
            .
          </p>

          <div className="mt-4 grid gap-3">
            {ILLUSTRATIVE_SAVINGS_SCENARIOS.map((scenario) => {
              const monthlySavings =
                currentMonthlyEnergyCost * (scenario.reductionPercent / 100);
              const annualizedSavings = monthlySavings * 12;
              const isModerate = scenario.id === "moderate";

              return (
                <article
                  key={scenario.id}
                  className={
                    isModerate
                      ? "rounded-lg border-2 border-emerald-600 bg-emerald-50/40 p-4 dark:border-emerald-400 dark:bg-emerald-400/10"
                      : "rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/70"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        {scenario.label}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {scenario.reductionPercent}% reduction · illustrative
                        savings
                      </p>
                    </div>
                    {isModerate && (
                      <span className="rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-emerald-800 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300">
                        Example focus
                      </span>
                    )}
                  </div>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">
                        Monthly illustrative savings
                      </dt>
                      <dd className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                        {formatCurrency(monthlySavings)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">
                        Annualized illustrative savings
                      </dt>
                      <dd className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                        {formatCurrency(annualizedSavings)}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>

          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
            These are illustrative scenarios, not predicted savings. Production
            savings estimates will require verified assumptions about efficiency
            improvements, implementation costs, and expected impact.
          </p>
        </>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div aria-label="Loading analytics" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-5 h-7 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-5 h-3 w-20 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
    </div>
  );
}

function AnalyticsErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-xl border border-red-200 bg-white p-6 sm:p-8 dark:border-red-900 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
        Unable to load analytics data
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300"
      >
        Try again
      </button>
    </section>
  );
}

export default function AnalyticsPage() {
  const isDark = useIsDark();
  const chartTheme = getChartTheme(isDark);
  const [records, setRecords] = useState<EnergyRecord[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const loadAnalytics = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");

    try {
      const [recordsResponse, forecastsResponse] = await Promise.all([
        fetch("/api/energy-records", {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal,
        }),
        fetch("/api/forecasts", {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal,
        }),
      ]);

      const [recordsPayload, forecastsPayload] = await Promise.all([
        readJson(recordsResponse),
        readJson(forecastsResponse),
      ]);

      if (!recordsResponse.ok) {
        throw new Error(
          getApiError(recordsPayload, "Energy records could not be loaded.")
        );
      }
      if (!forecastsResponse.ok) {
        throw new Error(
          getApiError(forecastsPayload, "Forecasts could not be loaded.")
        );
      }

      setRecords(parseEnergyRecords(recordsPayload));
      setForecasts(parseForecasts(forecastsPayload));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(
        loadError instanceof TypeError
          ? "We could not reach the server. Check your connection and try again."
          : loadError instanceof Error
            ? loadError.message
            : "Analytics data could not be loaded."
      );
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadAnalytics(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadAnalytics, retryKey]);

  const availableYears = useMemo(
    () =>
      Array.from(new Set(records.map((record) => record.year))).sort(
        (left, right) => right - left
      ),
    [records]
  );

  const filteredRecords = useMemo(
    () =>
      records
        .filter(
          (record) =>
            (!yearFilter || record.year === Number(yearFilter)) &&
            (!monthFilter || record.month === Number(monthFilter))
        )
        .sort(
          (left, right) =>
            periodIndex(left.year, left.month) - periodIndex(right.year, right.month)
        ),
    [monthFilter, records, yearFilter]
  );

  const filteredForecasts = useMemo(
    () =>
      forecasts.filter((forecast) => {
        const linkedRecord = forecast.energyRecord;
        if (!linkedRecord) return !yearFilter && !monthFilter;
        return (
          (!yearFilter || linkedRecord.year === Number(yearFilter)) &&
          (!monthFilter || linkedRecord.month === Number(monthFilter))
        );
      }),
    [forecasts, monthFilter, yearFilter]
  );

  const latestRecord = filteredRecords.at(-1) ?? null;
  const previousRecord = filteredRecords.at(-2) ?? null;
  const hasConsecutiveComparison =
    latestRecord !== null &&
    previousRecord !== null &&
    periodIndex(latestRecord.year, latestRecord.month) -
      periodIndex(previousRecord.year, previousRecord.month) ===
      1;

  const monthlyCostChange =
    hasConsecutiveComparison && previousRecord.totalEnergyCost !== 0
      ? ((latestRecord.totalEnergyCost - previousRecord.totalEnergyCost) /
          previousRecord.totalEnergyCost) *
        100
      : null;

  const averageCostPerKwh =
    filteredRecords.length > 0
      ? filteredRecords.reduce((sum, record) => sum + record.costPerKwh, 0) /
        filteredRecords.length
      : null;

  const gesByRecordId = new Map(
    filteredRecords.map((record) => [record.id, recordGes(record)] as const)
  );
  const validScoreRecords = filteredRecords.filter((record) => {
    const ges = gesByRecordId.get(record.id);
    return ges?.available === true;
  });
  const latestGes = latestRecord ? gesByRecordId.get(latestRecord.id) : undefined;
  const latestScoreIsValid = latestGes?.available === true;
  const latestGesScore = latestScoreIsValid ? latestGes.score : null;
  const linkedForecasts = filteredForecasts.filter(
    (forecast): forecast is Forecast & {
      energyRecord: NonNullable<Forecast["energyRecord"]>;
    } => forecast.energyRecord !== null
  );

  const latestForecast = (() => {
    if (linkedForecasts.length === 0) {
      return null;
    }

    if (latestRecord) {
      const matchingLatestRecord = [...linkedForecasts]
        .filter(
          (forecast) =>
            forecast.energyRecord.year === latestRecord.year &&
            forecast.energyRecord.month === latestRecord.month
        )
        .sort(compareForecastRecency);

      if (matchingLatestRecord[0]) {
        return matchingLatestRecord[0];
      }
    }

    return [...linkedForecasts]
      .sort((left, right) => {
        const periodDelta =
          periodIndex(right.energyRecord.year, right.energyRecord.month) -
          periodIndex(left.energyRecord.year, left.energyRecord.month);
        if (periodDelta !== 0) return periodDelta;
        return compareForecastRecency(left, right);
      })[0];
  })();
  const latestForecastTarget = latestForecast?.energyRecord
    ? nextPeriod(
        latestForecast.energyRecord.year,
        latestForecast.energyRecord.month
      )
    : null;

  const trendData = filteredRecords.map((record) => ({
    period: formatPeriod(record.year, record.month),
    totalCost: record.totalEnergyCost,
    consumption: record.energyConsumptionKwh,
  }));

  const scoreTrendData = validScoreRecords.map((record) => {
    const ges = gesByRecordId.get(record.id) as GesV1Available;
    return {
      period: formatPeriod(record.year, record.month),
      score: ges.score,
    };
  });

  const costComponents = latestRecord
    ? [
        { name: "Electricity", value: latestRecord.electricityBill },
        { name: "Diesel", value: latestRecord.dieselCost },
        { name: "Petrol", value: latestRecord.petrolCost },
      ]
    : [];
  const componentSum = costComponents.reduce((sum, item) => sum + item.value, 0);
  const hasComponentCosts = componentSum > 0;
  const rankedCostComponents = [...costComponents]
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);
  const largestCostComponent = rankedCostComponents[0] ?? null;
  const secondLargestCostComponent = rankedCostComponents[1] ?? null;
  const largestCostPercentage =
    largestCostComponent && componentSum > 0
      ? (largestCostComponent.value / componentSum) * 100
      : null;
  const largestCostComponents =
    largestCostComponent === null
      ? []
      : rankedCostComponents.filter(
          (item) => item.value === largestCostComponent.value
        );
  const largestComponentIsTied =
    largestCostComponents.length > 1;
  const costDistributionTakeaway =
    latestRecord && largestCostComponent && largestCostPercentage !== null
      ? largestComponentIsTied
        ? `${largestCostComponents
            .map((item) => item.name)
            .join(
              " and "
            )} are tied as the largest recorded energy-cost components for ${formatPeriod(
            latestRecord.year,
            latestRecord.month
          )}, each accounting for ${formatNumber(
            largestCostPercentage
          )}% of the displayed component costs.`
        : `${largestCostComponent.name} accounts for ${formatNumber(
            largestCostPercentage
          )}% of recorded energy costs for ${formatPeriod(
            latestRecord.year,
            latestRecord.month
          )}, making it the largest energy-cost component. This makes ${largestCostComponent.name.toLowerCase()} the primary cost category to monitor when evaluating future energy expenditure.`
      : null;
  const sourceCostTakeaway = largestCostComponent
    ? largestComponentIsTied
      ? `${largestCostComponents
          .map((item) => item.name)
          .join(" and ")} are tied as the largest recorded energy expenses at ${formatCurrency(
          largestCostComponent.value
        )} each.`
      : `${largestCostComponent.name} is currently the largest recorded energy expense at ${formatCurrency(
          largestCostComponent.value
        )}${
          secondLargestCostComponent
            ? `, followed by ${
                secondLargestCostComponent.name
              } at ${formatCurrency(secondLargestCostComponent.value)}`
            : ""
        }.`
    : null;
  const hasCostMismatch =
    latestRecord !== null &&
    Math.abs(componentSum - latestRecord.totalEnergyCost) >
      Math.max(1, Math.abs(latestRecord.totalEnergyCost) * 0.01);

  const monthlyTrendTakeaway =
    previousRecord && latestRecord
      ? `Recorded energy cost ${
          latestRecord.totalEnergyCost > previousRecord.totalEnergyCost
            ? "increased"
            : latestRecord.totalEnergyCost < previousRecord.totalEnergyCost
              ? "decreased"
              : "remained unchanged"
        } from ${formatCurrency(
          previousRecord.totalEnergyCost
        )} in ${formatPeriod(
          previousRecord.year,
          previousRecord.month
        )} to ${formatCurrency(latestRecord.totalEnergyCost)} in ${formatPeriod(
          latestRecord.year,
          latestRecord.month
        )}.`
      : null;

  const scoreInterpretation = (() => {
    if (!latestRecord || !latestGes || !latestGes.available) return null;

    return `A GridSense Energy Score of ${formatNumber(
      latestGes.score
    )}/100 is rated ${latestGes.rating} on the documented GridSense 0–100 scale for this period. Continue monitoring the score over time to identify changes in efficiency.`;
  })();

  const scoreTrendInterpretation = (() => {
    if (validScoreRecords.length < 2) return null;

    const scores = validScoreRecords.map((record) => {
      const ges = gesByRecordId.get(record.id) as GesV1Available;
      return ges.score;
    });
    const earliest = scores[0];
    const latest = scores.at(-1);
    if (latest === undefined) return null;

    const nonDecreasing = scores.every(
      (score, index) => index === 0 || score >= scores[index - 1]
    );
    const nonIncreasing = scores.every(
      (score, index) => index === 0 || score <= scores[index - 1]
    );

    if (nonDecreasing && latest > earliest) {
      return `Energy efficiency increased from ${formatNumber(
        earliest
      )}/100 to ${formatNumber(latest)}/100 across the available valid records.`;
    }
    if (nonIncreasing && latest < earliest) {
      return `Energy efficiency declined from ${formatNumber(
        earliest
      )}/100 to ${formatNumber(latest)}/100 across the available valid records.`;
    }
    if (scores.every((score) => score === earliest)) {
      return `The energy score remained at ${formatNumber(
        latest
      )}/100 across the available valid records.`;
    }

    return `The energy score fluctuated across the available valid periods, with the latest score at ${formatNumber(
      latest
    )}/100.`;
  })();

  const forecastChartData = useMemo(() => {
    const points = new Map<
      number,
      { period: string; sortKey: number; actual?: number; forecast?: number }
    >();
    const selectedBySourcePeriod = new Map<number, Forecast>();

    const linkedForecasts = filteredForecasts
      .filter(
        (forecast): forecast is Forecast & {
          energyRecord: NonNullable<Forecast["energyRecord"]>;
        } => forecast.energyRecord !== null
      )
      .sort(compareForecastRecency);

    for (const forecast of linkedForecasts) {
      const actualKey = periodIndex(
        forecast.energyRecord.year,
        forecast.energyRecord.month
      );
      if (selectedBySourcePeriod.has(actualKey)) continue;
      selectedBySourcePeriod.set(actualKey, forecast);

      const actualPoint = points.get(actualKey) ?? {
        period: formatPeriod(
          forecast.energyRecord.year,
          forecast.energyRecord.month
        ),
        sortKey: actualKey,
      };
      actualPoint.actual = forecast.energyRecord.totalEnergyCost;
      points.set(actualKey, actualPoint);

      const target = nextPeriod(
        forecast.energyRecord.year,
        forecast.energyRecord.month
      );
      const forecastKey = periodIndex(target.year, target.month);
      const forecastPoint = points.get(forecastKey) ?? {
        period: formatPeriod(target.year, target.month),
        sortKey: forecastKey,
      };
      forecastPoint.forecast = forecast.predictedNextMonthEnergyCost;
      points.set(forecastKey, forecastPoint);
    }

    return Array.from(points.values()).sort(
      (left, right) => left.sortKey - right.sortKey
    );
  }, [filteredForecasts]);

  const scoreRing = latestScoreIsValid && latestGesScore !== null
    ? {
        background: `conic-gradient(#059669 ${
          latestGesScore * 3.6
        }deg, ${isDark ? "#334155" : "#e2e8f0"} 0deg)`,
      }
    : undefined;

  const recordPeriodDetail = latestRecord
    ? formatPeriod(latestRecord.year, latestRecord.month)
    : "No record available";
  const forecastDetail = latestForecast?.energyRecord
    ? `Forecast from ${formatPeriod(
        latestForecast.energyRecord.year,
        latestForecast.energyRecord.month
      )}${
        latestForecast.predictedChangePercent === null
          ? ""
          : ` · ${
              latestForecast.predictedChangePercent >= 0 ? "+" : ""
            }${formatNumber(latestForecast.predictedChangePercent)}%`
      }`
    : "No saved forecast";

  return (
    <main className="min-w-0 overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-transparent dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Analytics
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl dark:text-white">
              Energy analytics
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-400">
              Understand energy costs, consumption, efficiency, and forecast
              performance across your available records.
            </p>
          </div>

          <div
            aria-label="Analytics period filters"
            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:min-w-[360px] dark:border-slate-800 dark:bg-slate-900"
          >
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Year
              <select
                aria-label="Filter analytics by year"
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Month
              <select
                aria-label="Filter analytics by month"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All months</option>
                {monthNames.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div className="mt-8" aria-live="polite">
          {loading && <LoadingState />}

          {!loading && error && (
            <AnalyticsErrorState
              message={error}
              onRetry={() => setRetryKey((current) => current + 1)}
            />
          )}

          {!loading && !error && (
            <div className="space-y-6">
              <section
                aria-label="Analytics summary"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                <KpiCard
                  label="Total energy cost"
                  value={
                    latestRecord
                      ? formatCurrency(latestRecord.totalEnergyCost)
                      : "Unavailable"
                  }
                  detail={
                    monthlyCostChange === null
                      ? recordPeriodDetail
                      : `${monthlyCostChange >= 0 ? "+" : ""}${formatNumber(
                          monthlyCostChange
                        )}% vs previous month`
                  }
                />
                <KpiCard
                  label="Average cost per kWh"
                  value={
                    averageCostPerKwh === null
                      ? "Unavailable"
                      : `${formatCurrency(averageCostPerKwh)}/kWh`
                  }
                  detail={
                    filteredRecords.length
                      ? `Average across ${filteredRecords.length} available ${
                          filteredRecords.length === 1 ? "record" : "records"
                        }`
                      : "No record available"
                  }
                />
                <KpiCard
                  label="GridSense Energy Score"
                  value={
                    !latestRecord
                      ? "Unavailable"
                      : latestScoreIsValid && latestGesScore !== null
                        ? `${formatNumber(latestGesScore)}/100`
                        : "Unavailable"
                  }
                  detail={recordPeriodDetail}
                />
                <KpiCard
                  label="Forecasted next-month cost"
                  value={
                    latestForecast
                      ? formatCurrency(latestForecast.predictedNextMonthEnergyCost)
                      : "Unavailable"
                  }
                  detail={
                    latestForecast && latestForecastTarget ? (
                      <>
                        <span className="block">{forecastDetail}</span>
                        <span className="block">
                          Predicted period:{" "}
                          {formatPeriod(
                            latestForecastTarget.year,
                            latestForecastTarget.month
                          )}
                        </span>
                      </>
                    ) : (
                      forecastDetail
                    )
                  }
                />
              </section>

              <ChartCard
                title="Monthly energy trend"
                subtitle="Energy cost and consumption across available records."
              >
                {filteredRecords.length >= 2 ? (
                  <>
                    <div
                      role="img"
                      aria-label={`Monthly energy trend showing total cost in naira and consumption in kilowatt-hours across ${filteredRecords.length} available records.`}
                      className="overflow-x-auto"
                    >
                      <div className="h-80 min-w-[620px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={trendData}
                            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                            accessibilityLayer
                          >
                            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                            <XAxis
                              dataKey="period"
                              tick={{ fill: chartTheme.tick, fontSize: 12 }}
                              tickLine={false}
                              axisLine={{ stroke: chartTheme.axis }}
                            />
                            <YAxis
                              yAxisId="cost"
                              tickFormatter={formatCompactCurrency}
                              tick={{ fill: chartTheme.tick, fontSize: 12 }}
                              tickLine={false}
                              axisLine={false}
                              width={74}
                            />
                            <YAxis
                              yAxisId="consumption"
                              orientation="right"
                              tickFormatter={(value) => `${formatNumber(value, 0)} kWh`}
                              tick={{ fill: chartTheme.tick, fontSize: 12 }}
                              tickLine={false}
                              axisLine={false}
                              width={82}
                            />
                            <Tooltip content={<TrendTooltip />} />
                            <Legend verticalAlign="top" height={40} />
                            <Area
                              yAxisId="cost"
                              type="monotone"
                              dataKey="totalCost"
                              name="Total energy cost"
                              stroke="#059669"
                              fill="#d1fae5"
                              strokeWidth={2}
                              connectNulls={false}
                            />
                            <Line
                              yAxisId="consumption"
                              type="monotone"
                              dataKey="consumption"
                              name="Energy consumption"
                              stroke="#2563eb"
                              strokeWidth={2}
                              strokeDasharray="6 4"
                              dot={{ r: 4, fill: chartTheme.dotFill, strokeWidth: 2 }}
                              connectNulls={false}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Left axis: energy cost (NGN). Right axis: energy consumption
                      (kWh). Missing months are not inserted.
                    </p>
                    {monthlyTrendTakeaway && (
                      <Interpretation label="Key takeaway">
                        <p>{monthlyTrendTakeaway}</p>
                      </Interpretation>
                    )}
                  </>
                ) : filteredRecords.length === 1 && latestRecord ? (
                  <EmptyState
                    title={formatCurrency(latestRecord.totalEnergyCost)}
                    description={`${formatPeriod(
                      latestRecord.year,
                      latestRecord.month
                    )} · ${formatNumber(
                      latestRecord.energyConsumptionKwh
                    )} kWh. More history is needed to display a trend.`}
                  />
                ) : (
                  <EmptyState
                    title="No energy records yet."
                    description="Upload a CSV file or add an energy record to begin building your analytics history."
                    actions={
                      <>
                        <Link
                          href="/energy-records"
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Upload CSV
                        </Link>
                        <Link
                          href="/energy-records"
                          className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300"
                        >
                          Add Record
                        </Link>
                      </>
                    }
                  />
                )}
              </ChartCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Cost distribution"
                  subtitle={
                    latestRecord
                      ? `Electricity, diesel, and petrol costs for ${formatPeriod(
                          latestRecord.year,
                          latestRecord.month
                        )}.`
                      : "Electricity, diesel, and petrol costs for the selected period."
                  }
                >
                  {hasComponentCosts ? (
                    <>
                      <div
                        role="img"
                        aria-label={`Cost distribution: ${costComponents
                          .map(
                            (item) =>
                              `${item.name} ${formatCurrency(item.value)}`
                          )
                          .join(", ")}.`}
                        className="h-64"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart accessibilityLayer>
                            <Pie
                              data={costComponents}
                              dataKey="value"
                              nameKey="name"
                              innerRadius="52%"
                              outerRadius="78%"
                              paddingAngle={2}
                            >
                              {costComponents.map((item, index) => (
                                <Cell
                                  key={item.name}
                                  fill={sourceColors[index]}
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<CurrencyTooltip />} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                        {costComponents.map((item, index) => (
                          <li
                            key={item.name}
                            className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600 dark:bg-slate-800/70 dark:text-slate-400"
                          >
                            <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                              <span
                                aria-hidden="true"
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: sourceColors[index] }}
                              />
                              {item.name}
                            </span>
                            <span className="mt-1 block">
                              {formatCurrency(item.value)} ·{" "}
                              {formatNumber((item.value / componentSum) * 100)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                      {hasCostMismatch && (
                        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          Component costs do not fully reconcile with the recorded
                          total energy cost.
                        </p>
                      )}
                      {costDistributionTakeaway && (
                        <Interpretation>
                          <p>{costDistributionTakeaway}</p>
                        </Interpretation>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      title="No component costs available."
                      description="Electricity, diesel, and petrol costs are all zero for the selected period."
                    />
                  )}
                </ChartCard>

                <ChartCard
                  title="Energy source costs"
                  subtitle="Recorded electricity, diesel, and petrol costs. Values represent cost, not source-specific consumption."
                >
                  {hasComponentCosts ? (
                    <>
                      <div
                        role="img"
                        aria-label={`Energy source costs: ${costComponents
                          .map(
                            (item) =>
                              `${item.name} ${formatCurrency(item.value)}`
                          )
                          .join(", ")}.`}
                        className="h-72"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={costComponents}
                            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                            accessibilityLayer
                          >
                            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                            <XAxis
                              dataKey="name"
                              tick={{ fill: chartTheme.tick, fontSize: 12 }}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={formatCompactCurrency}
                              tick={{ fill: chartTheme.tick, fontSize: 12 }}
                              tickLine={false}
                              axisLine={false}
                              width={72}
                            />
                            <Tooltip content={<CurrencyTooltip />} />
                            <Bar
                              dataKey="value"
                              name="Recorded cost"
                              radius={[6, 6, 0, 0]}
                            >
                              {costComponents.map((item, index) => (
                                <Cell
                                  key={item.name}
                                  fill={sourceColors[index]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Vertical axis: recorded cost (NGN).
                      </p>
                      {sourceCostTakeaway && (
                        <Interpretation label="Key takeaway">
                          <p>{sourceCostTakeaway}</p>
                        </Interpretation>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      title="No source costs available."
                      description="Electricity, diesel, and petrol costs are all zero for the selected period."
                    />
                  )}
                </ChartCard>
              </div>

              <ChartCard
                title="Actual vs forecast"
                subtitle="Compare recorded energy costs with saved model forecasts."
              >
                {filteredForecasts.length > 0 && forecastChartData.length > 0 ? (
                  <>
                    <div
                      role="img"
                      aria-label={`Actual versus forecast energy costs from ${filteredForecasts.length} saved ${
                        filteredForecasts.length === 1 ? "forecast" : "forecasts"
                      }. Solid points are actual costs and dashed points are model forecasts.`}
                      className="overflow-x-auto"
                    >
                      <div className="h-80 min-w-[620px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={forecastChartData}
                            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                            accessibilityLayer
                          >
                            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                            <XAxis
                              dataKey="period"
                              tick={{ fill: chartTheme.tick, fontSize: 12 }}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={formatCompactCurrency}
                              tick={{ fill: chartTheme.tick, fontSize: 12 }}
                              tickLine={false}
                              axisLine={false}
                              width={74}
                            />
                            <Tooltip content={<CurrencyTooltip />} />
                            <Legend verticalAlign="top" height={40} />
                            <Line
                              type="linear"
                              dataKey="actual"
                              name="ACTUAL"
                              stroke={isDark ? "#f8fafc" : "#0f172a"}
                              strokeWidth={2.5}
                              dot={{ r: 5, fill: chartTheme.dotFill, strokeWidth: 2.5 }}
                              connectNulls={false}
                            />
                            <Line
                              type="linear"
                              dataKey="forecast"
                              name="FORECAST"
                              stroke="#059669"
                              strokeWidth={2.5}
                              strokeDasharray="7 5"
                              dot={{ r: 5, fill: chartTheme.dotFill, strokeWidth: 2.5 }}
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      ACTUAL is the recorded historical energy cost for a linked
                      period. FORECAST is the saved next-month model prediction for
                      the period after that record. Only stored forecasts are shown;
                      no future months are extrapolated.
                    </p>
                  </>
                ) : (
                  <EmptyState
                    title="No forecasts available yet."
                    description="Create a forecast to compare a recorded energy cost with its saved next-month prediction."
                    actions={
                      <Link
                        href="/forecast"
                        className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300"
                      >
                        Create forecast
                      </Link>
                    }
                  />
                )}
              </ChartCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="GridSense Energy Score"
                  subtitle="Calculated from raw energy performance data on the documented 0–100 scale."
                >
                  {!latestRecord ? (
                    <EmptyState
                      title="No energy score available."
                      description="Add an energy record to display its GridSense Energy Score."
                    />
                  ) : latestScoreIsValid && latestGes && latestGes.available ? (
                    <div className="flex min-h-64 flex-col items-center justify-center text-center">
                      <div
                        role="img"
                        aria-label={`GridSense Energy Score ${formatNumber(
                          latestGes.score
                        )} out of 100 for ${formatPeriod(
                          latestRecord.year,
                          latestRecord.month
                        )}.`}
                        className="flex h-44 w-44 items-center justify-center rounded-full p-4"
                        style={scoreRing}
                      >
                        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900">
                          <span className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
                            {formatNumber(latestGes.score)}
                          </span>
                          <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {latestGes.rating}
                          </span>
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                        {formatPeriod(latestRecord.year, latestRecord.month)}
                      </p>
                      {scoreInterpretation && (
                        <div className="w-full max-w-md text-left">
                          <Interpretation>
                            <p>{scoreInterpretation}</p>
                          </Interpretation>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-5 py-10 text-center dark:border-amber-800 dark:bg-amber-950/30">
                      <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                        Energy score unavailable
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-amber-800 dark:text-amber-300">
                        {latestGes && !latestGes.available
                          ? gesUnavailableMessage(latestGes.reason)
                          : "GridSense Energy Score could not be calculated from the latest record."}
                      </p>
                    </div>
                  )}
                </ChartCard>

                <ChartCard
                  title="Energy Score Trend"
                  subtitle="Computed GridSense Energy Scores across available periods."
                >
                  {validScoreRecords.length >= 2 ? (
                    <>
                      <div
                        role="img"
                        aria-label={`Energy Score Trend across ${validScoreRecords.length} records. Only scores within the valid 0 to 100 range are included.`}
                        className="overflow-x-auto"
                      >
                        <div className="h-72 min-w-[480px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={scoreTrendData}
                              margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                              accessibilityLayer
                            >
                              <CartesianGrid
                                stroke={chartTheme.grid}
                                strokeDasharray="3 3"
                              />
                              <XAxis
                                dataKey="period"
                                tick={{ fill: chartTheme.tick, fontSize: 12 }}
                                tickLine={false}
                              />
                              <YAxis
                                domain={[0, 100]}
                                ticks={[0, 25, 50, 75, 100]}
                                tick={{ fill: chartTheme.tick, fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                width={38}
                              />
                              <Tooltip content={<ScoreTooltip />} />
                              <Line
                                type="monotone"
                                dataKey="score"
                                name="Energy score"
                                stroke="#059669"
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: chartTheme.dotFill, strokeWidth: 2 }}
                                connectNulls={false}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Vertical axis: GridSense Energy Score (0–100). Invalid
                        scores are excluded rather than adjusted.
                      </p>
                      {scoreTrendInterpretation ? (
                        <Interpretation label="Key takeaway">
                          <p>{scoreTrendInterpretation}</p>
                        </Interpretation>
                      ) : null}
                    </>
                  ) : validScoreRecords.length === 1 ? (
                    <EmptyState
                      title="More history is needed to display a trend."
                      description={`One valid score is available: ${formatNumber(
                        (gesByRecordId.get(validScoreRecords[0].id) as GesV1Available)
                          .score
                      )}/100 for ${formatPeriod(
                        validScoreRecords[0].year,
                        validScoreRecords[0].month
                      )}.`}
                    />
                  ) : (
                    <EmptyState
                      title="No valid energy scores available."
                      description="The trend requires energy records with scores in the valid 0–100 range."
                    />
                  )}
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <BusinessComparisonDemo
                  efficiencyScore={latestGesScore}
                  costPerKwh={latestRecord?.costPerKwh ?? null}
                />
                <SavingsProjectionDemo
                  currentMonthlyEnergyCost={
                    latestRecord?.totalEnergyCost ?? null
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
