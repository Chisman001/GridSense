/**
 * GridSense Energy Score (GES) v1.
 *
 * Platform-computed 0–100 score. Recomputes C, D, and S from raw fields.
 * Does not read energy_efficiency_score or stored ratio columns.
 */

export const GES_V1_COST_WEIGHT = 0.5;
export const GES_V1_GENERATOR_WEIGHT = 0.25;
export const GES_V1_OPERATIONAL_WEIGHT = 0.25;

export const GES_V1_D_MIN = 0.006077;
export const GES_V1_D_MAX = 0.241246;
export const GES_V1_S_MIN = 0.048013;
export const GES_V1_S_MAX = 0.296079;

/** GES v1 treats operating hours as hours per day. Values above this are not used. */
export const GES_V1_MAX_OPERATING_HOURS_PER_DAY = 24;

export type GesRating =
  | "Excellent"
  | "Good"
  | "Needs Improvement"
  | "Critical";

export type GesUnavailableReason =
  | "monthly_revenue_invalid"
  | "powered_hours_invalid"
  | "operating_hours_invalid"
  | "period_invalid"
  | "total_energy_cost_invalid";

export type GesV1Input = {
  totalEnergyCost: number;
  monthlyRevenue: number;
  generatorHours: number;
  gridHours: number;
  outageHours: number;
  operatingHoursPerDay: number;
  year: number;
  month: number;
};

export type GesRecordInput = {
  totalEnergyCost: number;
  monthlyRevenue: number;
  generatorHours: number;
  gridHours: number;
  outageHours: number;
  operatingHours: number;
  year: number;
  month: number;
};

export type GesV1Components = {
  costBurden: number;
  costScore: number;
  generatorDependency: number;
  generatorScore: number;
  outageFraction: number;
  operationalScore: number;
};

export type GesV1Available = {
  available: true;
  score: number;
  rating: GesRating;
  components: GesV1Components;
};

export type GesV1Unavailable = {
  available: false;
  reason: GesUnavailableReason;
};

export type GesV1Result = GesV1Available | GesV1Unavailable;

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function daysInCalendarMonth(year: number, month: number): number | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function gesUnavailableMessage(reason: GesUnavailableReason): string {
  switch (reason) {
    case "monthly_revenue_invalid":
      return "Monthly revenue must be greater than zero to calculate GES.";
    case "powered_hours_invalid":
      return "Generator hours and grid hours must add up to more than zero.";
    case "operating_hours_invalid":
      return "Operating hours per day must be greater than 0 and at most 24. Monthly-shaped values are not converted automatically.";
    case "period_invalid":
      return "Year and month must form a valid calendar month.";
    case "total_energy_cost_invalid":
      return "Total energy cost must be a valid number.";
  }
}

export function gesRating(score: number): GesRating | null {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return null;
  }

  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Critical";
}

export function calculateGesV1(input: GesV1Input): GesV1Result {
  if (!isFiniteNumber(input.totalEnergyCost)) {
    return { available: false, reason: "total_energy_cost_invalid" };
  }

  if (!isFiniteNumber(input.monthlyRevenue) || input.monthlyRevenue <= 0) {
    return { available: false, reason: "monthly_revenue_invalid" };
  }

  if (
    !isFiniteNumber(input.generatorHours) ||
    !isFiniteNumber(input.gridHours) ||
    input.generatorHours + input.gridHours <= 0
  ) {
    return { available: false, reason: "powered_hours_invalid" };
  }

  if (!isFiniteNumber(input.operatingHoursPerDay) || input.operatingHoursPerDay <= 0) {
    return { available: false, reason: "operating_hours_invalid" };
  }

  if (!isFiniteNumber(input.outageHours)) {
    return { available: false, reason: "operating_hours_invalid" };
  }

  const days = daysInCalendarMonth(input.year, input.month);
  if (days === null) {
    return { available: false, reason: "period_invalid" };
  }

  const monthlyOperatingHours = input.operatingHoursPerDay * days;
  if (monthlyOperatingHours <= 0) {
    return { available: false, reason: "operating_hours_invalid" };
  }

  const costBurden = input.totalEnergyCost / input.monthlyRevenue;
  const costScore = 100 * (1 - clamp(costBurden, 0, 1));

  const generatorDependency =
    input.generatorHours / (input.generatorHours + input.gridHours);
  const clippedD = clamp(generatorDependency, GES_V1_D_MIN, GES_V1_D_MAX);
  const generatorScore =
    100 * (GES_V1_D_MAX - clippedD) / (GES_V1_D_MAX - GES_V1_D_MIN);

  const outageFraction = input.outageHours / monthlyOperatingHours;
  const clippedS = clamp(outageFraction, GES_V1_S_MIN, GES_V1_S_MAX);
  const operationalScore =
    100 * (GES_V1_S_MAX - clippedS) / (GES_V1_S_MAX - GES_V1_S_MIN);

  const score = clamp(
    GES_V1_COST_WEIGHT * costScore +
      GES_V1_GENERATOR_WEIGHT * clamp(generatorScore, 0, 100) +
      GES_V1_OPERATIONAL_WEIGHT * clamp(operationalScore, 0, 100),
    0,
    100
  );

  const rating = gesRating(score);
  if (rating === null) {
    return { available: false, reason: "period_invalid" };
  }

  return {
    available: true,
    score,
    rating,
    components: {
      costBurden,
      costScore,
      generatorDependency,
      generatorScore: clamp(generatorScore, 0, 100),
      outageFraction,
      operationalScore: clamp(operationalScore, 0, 100),
    },
  };
}

/**
 * Application-facing GES from stored/raw energy-record fields.
 *
 * Isolates GES from monthly-shaped operating-hours values (for example 600)
 * instead of treating them as hours per day.
 */
export function calculateGesV1FromRecord(record: GesRecordInput): GesV1Result {
  if (
    isFiniteNumber(record.operatingHours) &&
    record.operatingHours > GES_V1_MAX_OPERATING_HOURS_PER_DAY
  ) {
    return { available: false, reason: "operating_hours_invalid" };
  }

  return calculateGesV1({
    totalEnergyCost: record.totalEnergyCost,
    monthlyRevenue: record.monthlyRevenue,
    generatorHours: record.generatorHours,
    gridHours: record.gridHours,
    outageHours: record.outageHours,
    operatingHoursPerDay: record.operatingHours,
    year: record.year,
    month: record.month,
  });
}
