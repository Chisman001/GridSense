/**
 * Product-facing ML reliability helpers.
 *
 * Coverage and flat-response rules come from Stage 13 audits A and F.
 * These do not change model behavior — they only change how results are presented.
 */

export const ML_VALIDATED_BUSINESS_TYPES = [
  "Bakery",
  "Cold Room",
  "Factory",
  "Hospital",
  "Hotel",
  "School",
] as const;

export type MlValidatedBusinessType =
  (typeof ML_VALIDATED_BUSINESS_TYPES)[number];

/** Audit F treated predictions within ₦1 as a flat What-If response. */
export const SCENARIO_FLAT_RESPONSE_THRESHOLD_NAIRA = 1;

export const FORECAST_EYEBROW = "Next-month energy cost estimate";
export const FORECAST_SUBTITLE =
  "Based on your current bills, usage, and operating data.";
export const FORECAST_MEANING_TITLE = "How to read this estimate";
export const FORECAST_MEANING_BODY =
  "Your current energy spending and operating pattern suggest a similar level of energy cost next month.";

export const COVERAGE_LIMITED_TITLE = "Limited model coverage";
export const COVERAGE_LIMITED_BODY =
  "GridSense has limited historical validation for this business type. This forecast is an estimate and may be less reliable than predictions for supported business types.";

export const WHATIF_SCENARIO_DISCLAIMER =
  "This is a model-based scenario estimate, not a guaranteed saving. Results are directional and do not account for operational constraints.";

export const WHATIF_FLAT_TITLE = "Limited scenario sensitivity";
export const WHATIF_FLAT_BODY =
  "The model shows little change in estimated cost under this scenario. This does not necessarily mean generator reduction has no operational or financial benefit.";

const validatedBusinessTypes = new Set<string>(ML_VALIDATED_BUSINESS_TYPES);

export function hasLimitedModelCoverage(businessType: string): boolean {
  const trimmed = businessType.trim();
  if (!trimmed) {
    return false;
  }

  return !validatedBusinessTypes.has(trimmed);
}

export function isScenarioResponseFlat(
  baselinePrediction: number,
  scenarioPrediction: number,
  thresholdNaira: number = SCENARIO_FLAT_RESPONSE_THRESHOLD_NAIRA
): boolean {
  if (
    !Number.isFinite(baselinePrediction) ||
    !Number.isFinite(scenarioPrediction) ||
    !Number.isFinite(thresholdNaira)
  ) {
    return false;
  }

  return Math.abs(scenarioPrediction - baselinePrediction) <= thresholdNaira;
}
