/**
 * Rule-based Energy Profile from recorded bills and hours.
 *
 * Measurement only. Business type is not an input.
 * Same energy numbers produce the same profile and reading.
 */

import {
  deriveEnergyMetrics,
  safeDivide,
  type RawEnergyRecord,
} from "@/lib/energy-record-pipeline";
import { GENERATOR_DEPENDENCY_ELEVATED_THRESHOLD } from "@/lib/forecast-scenario";
import { calculateGES, type GesV1Result } from "@/lib/ges-v1";

export const ENERGY_COST_BURDEN_THRESHOLD = 0.2;
export const ENERGY_TREND_MEANINGFUL_PERCENT = 2;

export type EnergyFlagId =
  | "cost-burden"
  | "generator-reliance"
  | "diesel-mix"
  | "outage-exposure"
  | "ges-pressure"
  | "rising-cost"
  | "easing-cost";

export type EnergyFlag = {
  id: EnergyFlagId;
  label: string;
};

export type EnergyProfileSource = {
  year: number;
  month: number;
  energySource?: string;
  electricityBill: number;
  dieselCost: number;
  petrolCost: number;
  energyConsumptionKwh: number;
  fuelConsumptionLiters: number;
  generatorHours: number;
  gridHours: number;
  outageHours: number;
  operatingHours: number;
  employees: number;
  monthlyRevenue: number;
};

export type EnergyProfile = {
  period: { year: number; month: number };
  cost: {
    total: number;
    electricity: number;
    diesel: number;
    petrol: number;
  };
  dependency: { generator: number; grid: number };
  outageHours: number;
  generatorHours: number;
  intensity: {
    costPerKwh: number;
    costPerEmployee: number;
    costShareOfRevenue: number;
  };
  ges: GesV1Result;
  trend: { available: boolean; costDeltaPercent: number | null };
  flags: EnergyFlag[];
  reading: {
    headline: string;
    body: string;
    primaryFlagId: EnergyFlagId | null;
  };
};

const PRIMARY_FLAG_ORDER: EnergyFlagId[] = [
  "cost-burden",
  "generator-reliance",
  "diesel-mix",
  "outage-exposure",
  "ges-pressure",
  "rising-cost",
  "easing-cost",
];

const READINGS: Record<
  EnergyFlagId,
  { headline: string; body: string }
> = {
  "cost-burden": {
    headline: "Energy is taking a large share of revenue",
    body: "This month, recorded energy cost is a substantial portion of monthly revenue. Review the bill mix and operating hours, then use Forecast if you want a next-month estimate.",
  },
  "generator-reliance": {
    headline: "Generator reliance is a major operating pattern",
    body: "This month, generator power accounts for a large share of powered hours. That pattern often sits alongside diesel spend. Review the recorded mix, then use Forecast if you want a next-month estimate or a generator-use scenario.",
  },
  "diesel-mix": {
    headline: "Diesel is the largest energy-cost component",
    body: "Diesel accounts for more of this month’s energy spend than electricity or petrol. That is a recorded cost mix, not a recommendation to change operations.",
  },
  "outage-exposure": {
    headline: "Outages are a meaningful operational load",
    body: "Recorded outage hours are the weakest part of this month’s Energy Score. The score reflects exposure in the recorded period, not a forecast of future outages.",
  },
  "ges-pressure": {
    headline: "The Energy Score is under pressure",
    body: "Cost burden, generator use, or outages are pulling this month’s Energy Score down. The score is calculated from recorded bills and hours.",
  },
  "rising-cost": {
    headline: "Energy cost rose versus the previous month",
    body: "This month’s total energy cost is higher than the previous recorded month. Compare the two periods in Analytics to see what changed.",
  },
  "easing-cost": {
    headline: "Energy cost eased versus the previous month",
    body: "This month’s total energy cost is lower than the previous recorded month. The Energy Score and mix still describe the current period on its own terms.",
  },
};

const BALANCED_READING = {
  headline: "This month’s energy situation looks measured",
  body: "Recorded costs, generator use, and outages sit within GridSense watch thresholds. Review the profile, then use Forecast if you want a next-month estimate.",
};

export function isEnergyProfileSource(
  value: unknown
): value is EnergyProfileSource {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const numericFields: Array<keyof EnergyProfileSource> = [
    "year",
    "month",
    "electricityBill",
    "dieselCost",
    "petrolCost",
    "energyConsumptionKwh",
    "fuelConsumptionLiters",
    "generatorHours",
    "gridHours",
    "outageHours",
    "operatingHours",
    "employees",
    "monthlyRevenue",
  ];

  return numericFields.every(
    (field) => typeof record[field] === "number" && Number.isFinite(record[field])
  );
}

export function buildEnergyProfile(
  latest: EnergyProfileSource,
  previous?: EnergyProfileSource | null
): EnergyProfile {
  const raw = toRawEnergyRecord(latest);
  const derived = deriveEnergyMetrics(raw);
  const ges = calculateGES({
    totalEnergyCost: derived.totalEnergyCost,
    monthlyRevenue: latest.monthlyRevenue,
    generatorHours: latest.generatorHours,
    gridHours: latest.gridHours,
    outageHours: latest.outageHours,
    operatingHours: latest.operatingHours,
    year: latest.year,
    month: latest.month,
  });

  const poweredHours = latest.generatorHours + latest.gridHours;
  const generatorShare = safeDivide(latest.generatorHours, poweredHours);
  const gridShare = safeDivide(latest.gridHours, poweredHours);
  const costShareOfRevenue = safeDivide(
    derived.totalEnergyCost,
    latest.monthlyRevenue
  );

  const previousTotal = previous
    ? previous.electricityBill + previous.dieselCost + previous.petrolCost
    : null;
  const trend = buildTrend(derived.totalEnergyCost, previousTotal);
  const flags = collectFlags({
    latest,
    derivedTotal: derived.totalEnergyCost,
    generatorShare,
    costShareOfRevenue,
    ges,
    trend,
  });
  const primaryFlagId = pickPrimaryFlag(flags);

  return {
    period: { year: latest.year, month: latest.month },
    cost: {
      total: derived.totalEnergyCost,
      electricity: latest.electricityBill,
      diesel: latest.dieselCost,
      petrol: latest.petrolCost,
    },
    dependency: {
      generator: generatorShare,
      grid: gridShare,
    },
    outageHours: latest.outageHours,
    generatorHours: latest.generatorHours,
    intensity: {
      costPerKwh: derived.costPerKwh,
      costPerEmployee: derived.energyCostPerEmployee,
      costShareOfRevenue,
    },
    ges,
    trend,
    flags,
    reading: primaryFlagId
      ? { ...READINGS[primaryFlagId], primaryFlagId }
      : { ...BALANCED_READING, primaryFlagId: null },
  };
}

function toRawEnergyRecord(source: EnergyProfileSource): RawEnergyRecord {
  return {
    year: source.year,
    month: source.month,
    energySource: source.energySource ?? "Hybrid",
    electricityBill: source.electricityBill,
    dieselCost: source.dieselCost,
    petrolCost: source.petrolCost,
    energyConsumptionKwh: source.energyConsumptionKwh,
    fuelConsumptionLiters: source.fuelConsumptionLiters,
    generatorHours: source.generatorHours,
    gridHours: source.gridHours,
    outageHours: source.outageHours,
    operatingHours: source.operatingHours,
    employees: source.employees,
    occupancyRate: 0,
    floorAreaSqm: 0,
    solarCapacityKw: 0,
    renewableEnergyPercentage: 0,
    maintenanceCost: 0,
    monthlyRevenue: source.monthlyRevenue,
    weatherAvgTemp: 0,
  };
}

function buildTrend(
  currentTotal: number,
  previousTotal: number | null
): EnergyProfile["trend"] {
  if (previousTotal === null || previousTotal <= 0) {
    return { available: false, costDeltaPercent: null };
  }

  const costDeltaPercent = ((currentTotal - previousTotal) / previousTotal) * 100;
  return {
    available: true,
    costDeltaPercent,
  };
}

function collectFlags(input: {
  latest: EnergyProfileSource;
  derivedTotal: number;
  generatorShare: number;
  costShareOfRevenue: number;
  ges: GesV1Result;
  trend: EnergyProfile["trend"];
}): EnergyFlag[] {
  const flags: EnergyFlag[] = [];

  if (input.costShareOfRevenue >= ENERGY_COST_BURDEN_THRESHOLD) {
    flags.push({
      id: "cost-burden",
      label: "High cost burden",
    });
  }

  if (input.generatorShare >= GENERATOR_DEPENDENCY_ELEVATED_THRESHOLD) {
    flags.push({
      id: "generator-reliance",
      label: "Elevated generator reliance",
    });
  }

  const largestBill = largestCostComponent(input.latest);
  if (largestBill === "diesel" && input.derivedTotal > 0) {
    flags.push({
      id: "diesel-mix",
      label: "Diesel-led cost mix",
    });
  }

  if (
    input.latest.outageHours > 0 &&
    weakestGesComponent(input.ges) === "outage exposure"
  ) {
    flags.push({
      id: "outage-exposure",
      label: "Outage exposure",
    });
  }

  if (
    !input.ges.available ||
    input.ges.rating === "Critical" ||
    input.ges.rating === "Needs Improvement"
  ) {
    flags.push({
      id: "ges-pressure",
      label: input.ges.available
        ? `Energy Score: ${input.ges.rating}`
        : "Energy Score unavailable",
    });
  }

  if (
    input.trend.available &&
    input.trend.costDeltaPercent !== null &&
    input.trend.costDeltaPercent >= ENERGY_TREND_MEANINGFUL_PERCENT
  ) {
    flags.push({
      id: "rising-cost",
      label: "Rising cost",
    });
  }

  if (
    input.trend.available &&
    input.trend.costDeltaPercent !== null &&
    input.trend.costDeltaPercent <= -ENERGY_TREND_MEANINGFUL_PERCENT
  ) {
    flags.push({
      id: "easing-cost",
      label: "Easing cost",
    });
  }

  return flags;
}

function pickPrimaryFlag(flags: EnergyFlag[]): EnergyFlagId | null {
  for (const id of PRIMARY_FLAG_ORDER) {
    if (flags.some((flag) => flag.id === id)) {
      return id;
    }
  }

  return null;
}

function largestCostComponent(
  source: EnergyProfileSource
): "electricity" | "diesel" | "petrol" | null {
  const components = [
    { id: "electricity" as const, value: source.electricityBill },
    { id: "diesel" as const, value: source.dieselCost },
    { id: "petrol" as const, value: source.petrolCost },
  ];
  const total = components.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return null;
  }

  return components.reduce((current, item) =>
    item.value > current.value ? item : current
  ).id;
}

function weakestGesComponent(ges: GesV1Result): string | null {
  if (!ges.available) {
    return null;
  }

  const scores = [
    { label: "cost burden", score: ges.components.costScore },
    { label: "generator dependency", score: ges.components.generatorScore },
    { label: "outage exposure", score: ges.components.operationalScore },
  ].sort((left, right) => left.score - right.score);

  const [lowest, next] = scores;
  if (!lowest || !next) {
    return null;
  }

  if (next.score - lowest.score < 8) {
    return null;
  }

  return lowest.label;
}
