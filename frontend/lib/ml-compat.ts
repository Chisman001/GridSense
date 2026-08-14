/**
 * Legacy PredictionRequest field. This is NOT GES.
 *
 * Stage 10/12 feature contract does not include energy_efficiency_score.
 * FastAPI PredictionRequest still requires the field, so new records and
 * forecast payloads keep this existing schema-compatible default.
 */
export const LEGACY_ENERGY_EFFICIENCY_SCORE = 75;
