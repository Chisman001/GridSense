import {
  deriveEnergyMetrics,
  isRecord,
  roundTo,
  type DerivedEnergyMetrics,
  type RawEnergyRecord,
} from "@/lib/energy-record-pipeline";
import { type GesV1Result } from "@/lib/ges-v1";

export const GENERATOR_SCENARIO_MAX_REDUCTION_PERCENT = 40;
export const GENERATOR_DEPENDENCY_ELEVATED_THRESHOLD = 0.3;

export type ScenarioAdjustment = {
  field: "generatorHours" | "dieselCost" | "fuelConsumptionLiters";
  label: string;
  before: number;
  after: number;
  unit: "hours" | "currency" | "liters";
};

export type ForecastDriver = {
  id: string;
  label: string;
  detail: string;
};

export type ForecastPredictionAnalytics = {
  current_energy_cost?: number;
  predicted_energy_cost?: number;
  predicted_change?: number;
  predicted_change_percent?: number;
  predicted_cost_per_employee?: number;
  predicted_cost_per_kwh?: number;
  generator_dependency_percent?: number;
  outage_hours?: number;
  predicted_energy_cost_as_percent_of_revenue?: number;
};

export type ForecastPrediction = {
  predicted_next_month_energy_cost: number;
  model: string;
  features_used: number;
  analytics?: ForecastPredictionAnalytics | null;
};

export function formatForecastCurrency(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatForecastPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function rawEnergyRecordsEqual(
  left: RawEnergyRecord,
  right: RawEnergyRecord
): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.energySource === right.energySource &&
    left.electricityBill === right.electricityBill &&
    left.dieselCost === right.dieselCost &&
    left.petrolCost === right.petrolCost &&
    left.energyConsumptionKwh === right.energyConsumptionKwh &&
    left.fuelConsumptionLiters === right.fuelConsumptionLiters &&
    left.generatorHours === right.generatorHours &&
    left.gridHours === right.gridHours &&
    left.outageHours === right.outageHours &&
    left.operatingHours === right.operatingHours &&
    left.employees === right.employees &&
    left.occupancyRate === right.occupancyRate &&
    left.floorAreaSqm === right.floorAreaSqm &&
    left.solarCapacityKw === right.solarCapacityKw &&
    left.renewableEnergyPercentage === right.renewableEnergyPercentage &&
    left.maintenanceCost === right.maintenanceCost &&
    left.monthlyRevenue === right.monthlyRevenue &&
    left.weatherAvgTemp === right.weatherAvgTemp
  );
}

export function applyGeneratorHoursScenario(
  raw: RawEnergyRecord,
  reductionPercent: number
): {
  scenarioRaw: RawEnergyRecord;
  adjustments: ScenarioAdjustment[];
  scaleFactor: number;
  reductionPercent: number;
} {
  const clamped = clampReductionPercent(reductionPercent);
  const scaleFactor = 1 - clamped / 100;

  const generatorHours = roundTo(raw.generatorHours * scaleFactor, 4);
  const dieselCost = roundTo(raw.dieselCost * scaleFactor, 2);
  const fuelConsumptionLiters = roundTo(
    raw.fuelConsumptionLiters * scaleFactor,
    4
  );

  const scenarioRaw: RawEnergyRecord = {
    ...raw,
    generatorHours,
    dieselCost,
    fuelConsumptionLiters,
  };

  return {
    scenarioRaw,
    scaleFactor,
    reductionPercent: clamped,
    adjustments: [
      {
        field: "generatorHours",
        label: "Generator hours",
        before: raw.generatorHours,
        after: generatorHours,
        unit: "hours",
      },
      {
        field: "dieselCost",
        label: "Diesel cost",
        before: raw.dieselCost,
        after: dieselCost,
        unit: "currency",
      },
      {
        field: "fuelConsumptionLiters",
        label: "Fuel consumption",
        before: raw.fuelConsumptionLiters,
        after: fuelConsumptionLiters,
        unit: "liters",
      },
    ],
  };
}

export function computeScenarioDelta(
  baselinePrediction: number,
  scenarioPrediction: number
): number {
  return scenarioPrediction - baselinePrediction;
}

export function annualizeScenarioDelta(monthlyDelta: number): number {
  return monthlyDelta * 12;
}

export function buildForecastDrivers(
  raw: RawEnergyRecord,
  derived: DerivedEnergyMetrics = deriveEnergyMetrics(raw),
  ges?: GesV1Result
): ForecastDriver[] {
  const drivers: ForecastDriver[] = [];
  const totalEnergyCost = derived.totalEnergyCost;

  if (totalEnergyCost > 0) {
    const components = [
      { id: "electricity", label: "Electricity", value: raw.electricityBill },
      { id: "diesel", label: "Diesel", value: raw.dieselCost },
      { id: "petrol", label: "Petrol", value: raw.petrolCost },
    ];
    const largest = components.reduce((current, item) =>
      item.value > current.value ? item : current
    );
    const share = (largest.value / totalEnergyCost) * 100;

    drivers.push({
      id: "largest-cost",
      label: `${largest.label} is the largest energy-cost component`,
      detail: `${largest.label} represents ${formatForecastPercent(share)} of current energy cost`,
    });
  }

  if (raw.generatorHours + raw.gridHours > 0) {
    const dependencyPercent = derived.generatorDependency * 100;
    const elevated =
      derived.generatorDependency >= GENERATOR_DEPENDENCY_ELEVATED_THRESHOLD;

    drivers.push({
      id: "generator-dependency",
      label: elevated
        ? "Elevated generator reliance"
        : "Generator dependency",
      detail: `Generator dependency: ${formatForecastPercent(dependencyPercent)}`,
    });
  }

  if (raw.outageHours > 0) {
    drivers.push({
      id: "outage-hours",
      label: "Outage exposure",
      detail: `${formatHours(raw.outageHours)} outage hours recorded`,
    });
  }

  const weakest = weakestGesComponent(ges);
  if (weakest) {
    drivers.push({
      id: "ges-component",
      label: "Energy score pressure",
      detail: `Energy score is most affected by ${weakest}`,
    });
  }

  return drivers;
}

export function buildScenarioExplanation(input: {
  reductionPercent: number;
  baselineCost: number;
  scenarioCost: number;
}): string {
  const reduction = clampReductionPercent(input.reductionPercent);
  const direction =
    input.scenarioCost < input.baselineCost
      ? "falls"
      : input.scenarioCost > input.baselineCost
        ? "rises"
        : "stays at";
  const scenarioPhrase =
    input.scenarioCost === input.baselineCost
      ? formatForecastCurrency(input.baselineCost)
      : `${formatForecastCurrency(input.baselineCost)} to ${formatForecastCurrency(input.scenarioCost)}`;

  return `Scenario estimate: Reducing generator hours by ${formatForecastPercent(reduction, 0)} also reduces diesel and fuel consumption by ${formatForecastPercent(reduction, 0)}. The model's estimated next-month energy cost ${direction} from ${scenarioPhrase}.`;
}

export function parseForecastPrediction(payload: unknown): ForecastPrediction {
  if (
    !isRecord(payload) ||
    typeof payload.predicted_next_month_energy_cost !== "number" ||
    typeof payload.model !== "string" ||
    typeof payload.features_used !== "number" ||
    (payload.analytics !== null &&
      payload.analytics !== undefined &&
      !isRecord(payload.analytics))
  ) {
    throw new Error("Prediction API returned an invalid response.");
  }

  return {
    predicted_next_month_energy_cost: payload.predicted_next_month_energy_cost,
    model: payload.model,
    features_used: payload.features_used,
    analytics: payload.analytics as ForecastPredictionAnalytics | null | undefined,
  };
}

function clampReductionPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    GENERATOR_SCENARIO_MAX_REDUCTION_PERCENT,
    Math.max(0, value)
  );
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function weakestGesComponent(ges?: GesV1Result): string | null {
  if (!ges?.available) {
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
