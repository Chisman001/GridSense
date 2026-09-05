"""
Stage 13: ML model coverage and reliability audits.

Audits:
  A — Training coverage vs frontend-allowed business types and industries
  B — Industry / business_type sensitivity (fixed energy profile)
  C — Per-category accuracy (MAE, RMSE, R² by business_type and industry)
  D — Worst prediction cases (largest residuals, error clustering)
  E — What-If sensitivity sweep (generator reduction 0–40%, sample profiles)
  F — What-If robustness (full validation/test population sweep)
  G — Feature importance (LightGBM aggregated importances)
  H — Leakage / feature temporal sanity checks

Writes JSON reports to ml/reports/model_evaluation/.
"""

from __future__ import annotations

import calendar
import importlib.util
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import yaml
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from config import (
    CSV_SEPARATOR,
    DEFAULT_ENCODING,
    FINAL_DATA_DIR,
    MODEL_REPORT_DIR,
    MODELS_DIR,
    SYNTHETIC_DATA_DIR,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_BUSINESS_PROFILE = (
    PROJECT_ROOT / "frontend" / "lib" / "business-profile.ts"
)
RULE_ENGINE_CONFIG = PROJECT_ROOT / "ml" / "configs" / "rule-engine.yaml"

EVAL_DIR = MODEL_REPORT_DIR.parent / "model_evaluation"
PREDICTIONS_CSV = EVAL_DIR / "model_predictions.csv"
BUSINESSES_CSV = SYNTHETIC_DATA_DIR / "businesses.csv"
ENERGY_RECORDS_CSV = FINAL_DATA_DIR / "energy_records.csv"

AUDIT_A_REPORT = EVAL_DIR / "audit_a_coverage_gap.json"
AUDIT_B_REPORT = EVAL_DIR / "audit_b_industry_sensitivity.json"
AUDIT_C_REPORT = EVAL_DIR / "audit_c_metrics_by_category.json"
AUDIT_D_REPORT = EVAL_DIR / "audit_d_worst_predictions.json"
AUDIT_E_REPORT = EVAL_DIR / "audit_e_whatif_sensitivity.json"
AUDIT_F_REPORT = EVAL_DIR / "audit_f_whatif_robustness.json"
AUDIT_G_REPORT = EVAL_DIR / "audit_g_feature_importance.json"
AUDIT_H_REPORT = EVAL_DIR / "audit_h_leakage_sanity.json"
AUDIT_SUMMARY_REPORT = EVAL_DIR / "audit_summary.json"

TRAINING_REPORT_PATH = MODEL_REPORT_DIR / "model_training_report.json"

TARGET_COLUMN = "next_month_energy_cost"
SELECTED_MODEL = "lightgbm"
WORST_PREDICTIONS_TOP_N = 20
GENERATOR_SCENARIO_MAX_REDUCTION_PERCENT = 40
WHATIF_REDUCTION_LEVELS = [0, 10, 20, 30, 40]
GENERATOR_DEPENDENCY_BUCKETS: list[tuple[str, float, float]] = [
    ("0-5%", 0.0, 0.05),
    ("5-10%", 0.05, 0.10),
    ("10-20%", 0.10, 0.20),
    ("20-40%", 0.20, 0.40),
    ("40%+", 0.40, 1.01),
]
IDENTIFIER_COLUMNS = {
    "record_id",
    "business_id",
    "business_name",
    "created_at",
    "city",
    TARGET_COLUMN,
}


def _current_ts() -> str:
    return datetime.now().isoformat()


def _load_stage_12():
    stage_path = Path(__file__).resolve().parent / "12_inference.py"
    spec = importlib.util.spec_from_file_location("stage12", stage_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load Stage 12 from {stage_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def parse_ts_string_array(name: str, content: str) -> list[str]:
    pattern = rf"export const {name} = \[(.*?)\] as const;"
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        raise ValueError(f"Could not parse {name} from business-profile.ts")
    raw = match.group(1)
    return re.findall(r'"([^"]+)"', raw)


def load_training_business_types(path: Path = BUSINESSES_CSV) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(f"Training businesses file not found: {path}")
    return pd.read_csv(path, sep=CSV_SEPARATOR, encoding=DEFAULT_ENCODING)


def load_rule_engine_industry_map(path: Path = RULE_ENGINE_CONFIG) -> dict[str, str]:
    if not path.is_file():
        raise FileNotFoundError(f"Rule engine config not found: {path}")
    with path.open("r", encoding=DEFAULT_ENCODING) as file:
        config = yaml.safe_load(file)
    rules = config.get("business_rules", {})
    return {
        str(business_type): str(details["industry"])
        for business_type, details in rules.items()
    }


def audit_a_coverage_gap() -> dict[str, Any]:
    """Compare training categories with frontend dropdown options."""
    businesses = load_training_business_types()
    training_business_types = sorted(businesses["business_type"].dropna().unique().tolist())
    training_industries = sorted(businesses["industry"].dropna().unique().tolist())

    profile_content = FRONTEND_BUSINESS_PROFILE.read_text(encoding=DEFAULT_ENCODING)
    app_business_types = parse_ts_string_array("BUSINESS_TYPES", profile_content)
    app_industries = parse_ts_string_array("INDUSTRIES", profile_content)

    training_bt_set = set(training_business_types)
    training_ind_set = set(training_industries)
    app_bt_set = set(app_business_types)
    app_ind_set = set(app_industries)

    rule_engine_map = load_rule_engine_industry_map()

    training_pairs = (
        businesses[["business_type", "industry"]]
        .drop_duplicates()
        .sort_values(["business_type", "industry"])
        .to_dict(orient="records")
    )

    training_counts = (
        businesses.groupby("business_type", as_index=False)
        .size()
        .rename(columns={"size": "business_count"})
        .sort_values("business_type")
        .to_dict(orient="records")
    )

    return {
        "audit": "A",
        "title": "Training coverage vs frontend options",
        "generated_at": _current_ts(),
        "training": {
            "business_types": training_business_types,
            "industries": training_industries,
            "business_type_industry_pairs": training_pairs,
            "business_type_counts": training_counts,
            "rule_engine_business_type_to_industry": rule_engine_map,
        },
        "frontend": {
            "business_types": app_business_types,
            "industries": app_industries,
        },
        "gaps": {
            "business_types_in_app_not_in_training": sorted(app_bt_set - training_bt_set),
            "business_types_in_training_not_in_app": sorted(training_bt_set - app_bt_set),
            "industries_in_app_not_in_training": sorted(app_ind_set - training_ind_set),
            "industries_in_training_not_in_app": sorted(training_ind_set - app_ind_set),
            "business_types_shared": sorted(training_bt_set & app_bt_set),
            "industries_shared": sorted(training_ind_set & app_ind_set),
        },
        "coverage_summary": {
            "app_business_types_covered_pct": round(
                len(training_bt_set & app_bt_set) / len(app_bt_set) * 100, 1
            )
            if app_bt_set
            else 0.0,
            "app_industries_covered_pct": round(
                len(training_ind_set & app_ind_set) / len(app_ind_set) * 100, 1
            )
            if app_ind_set
            else 0.0,
            "app_only_business_type_count": len(app_bt_set - training_bt_set),
            "app_only_industry_count": len(app_ind_set - training_ind_set),
        },
    }


def _category_metrics(
    actual: np.ndarray,
    predicted: np.ndarray,
) -> dict[str, float | int | None]:
    if len(actual) == 0:
        return {
            "row_count": 0,
            "mae": None,
            "rmse": None,
            "r2": None,
            "mean_actual": None,
            "mean_predicted": None,
        }

    mae = float(mean_absolute_error(actual, predicted))
    rmse = float(np.sqrt(mean_squared_error(actual, predicted)))
    r2 = float(r2_score(actual, predicted)) if len(actual) > 1 else None

    return {
        "row_count": int(len(actual)),
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4) if r2 is not None else None,
        "mean_actual": round(float(np.mean(actual)), 2),
        "mean_predicted": round(float(np.mean(predicted)), 2),
    }


def audit_c_metrics_by_category() -> dict[str, Any]:
    """Compute LightGBM accuracy grouped by business_type and industry."""
    if not PREDICTIONS_CSV.is_file():
        raise FileNotFoundError(
            f"Predictions file not found: {PREDICTIONS_CSV}. Run Stage 11 first."
        )
    if not BUSINESSES_CSV.is_file():
        raise FileNotFoundError(f"Businesses file not found: {BUSINESSES_CSV}")

    predictions = pd.read_csv(
        PREDICTIONS_CSV,
        sep=CSV_SEPARATOR,
        encoding=DEFAULT_ENCODING,
    )
    businesses = pd.read_csv(
        BUSINESSES_CSV,
        sep=CSV_SEPARATOR,
        encoding=DEFAULT_ENCODING,
    )

    model_preds = predictions[
        (predictions["model"] == SELECTED_MODEL)
        & (predictions["split"].isin(["validation", "test"]))
    ].copy()

    merged = model_preds.merge(
        businesses[["business_id", "business_type", "industry"]],
        on="business_id",
        how="left",
    )

    if merged["business_type"].isna().any():
        raise ValueError("Some prediction rows could not be joined to business metadata.")

    overall = _category_metrics(
        merged["actual_next_month_energy_cost"].to_numpy(dtype=float),
        merged["predicted_next_month_energy_cost"].to_numpy(dtype=float),
    )

    by_business_type: list[dict[str, Any]] = []
    for business_type, group in merged.groupby("business_type", sort=True):
        metrics = _category_metrics(
            group["actual_next_month_energy_cost"].to_numpy(dtype=float),
            group["predicted_next_month_energy_cost"].to_numpy(dtype=float),
        )
        by_business_type.append({"business_type": business_type, **metrics})

    by_industry: list[dict[str, Any]] = []
    for industry, group in merged.groupby("industry", sort=True):
        metrics = _category_metrics(
            group["actual_next_month_energy_cost"].to_numpy(dtype=float),
            group["predicted_next_month_energy_cost"].to_numpy(dtype=float),
        )
        by_industry.append({"industry": industry, **metrics})

    by_split: dict[str, Any] = {}
    for split_name, group in merged.groupby("split", sort=True):
        by_split[split_name] = _category_metrics(
            group["actual_next_month_energy_cost"].to_numpy(dtype=float),
            group["predicted_next_month_energy_cost"].to_numpy(dtype=float),
        )

    return {
        "audit": "C",
        "title": "Accuracy by business type and industry",
        "generated_at": _current_ts(),
        "model": SELECTED_MODEL,
        "splits_included": ["validation", "test"],
        "overall": overall,
        "by_split": by_split,
        "by_business_type": by_business_type,
        "by_industry": by_industry,
    }


def _build_baseline_record(frame: pd.DataFrame, features: list[str]) -> dict[str, Any]:
    """Use median numeric values from Factory records as a fixed energy profile."""
    factory_rows = frame[frame["business_type"] == "Factory"].copy()
    if factory_rows.empty:
        factory_rows = frame.copy()

    numeric_cols = [
        col
        for col in features
        if col not in {"business_type", "industry", "state", "energy_source"}
        and pd.api.types.is_numeric_dtype(factory_rows[col])
    ]

    baseline = factory_rows[numeric_cols].median().to_dict()

    # Stable categorical defaults for the baseline energy situation.
    baseline["business_type"] = "Factory"
    baseline["industry"] = "Manufacturing"
    baseline["state"] = "Lagos"
    baseline["energy_source"] = "Hybrid"
    baseline["year"] = int(baseline.get("year", 2024))
    baseline["month"] = int(baseline.get("month", 6))

    for feature in features:
        if feature not in baseline:
            if feature in factory_rows.columns:
                baseline[feature] = factory_rows[feature].median()
            else:
                raise ValueError(f"Baseline record missing required feature: {feature}")

    return baseline


def _build_sensitivity_scenarios(rule_engine_map: dict[str, str]) -> list[dict[str, str]]:
    """Scenarios for Audit B: trained types, app-only types, and decoupled pairs."""
    scenarios: list[dict[str, str]] = []

    for business_type, industry in sorted(rule_engine_map.items()):
        scenarios.append(
            {
                "label": f"trained:{business_type}",
                "business_type": business_type,
                "industry": industry,
                "category": "trained_locked_pair",
            }
        )

    app_only_cases = [
        ("Retail Store", "Retail"),
        ("Restaurant", "Food Production"),
        ("Office", "Professional Services"),
        ("Supermarket", "Retail"),
        ("Pharmacy", "Healthcare"),
        ("Clinic", "Healthcare"),
    ]
    for business_type, industry in app_only_cases:
        scenarios.append(
            {
                "label": f"app_only:{business_type}",
                "business_type": business_type,
                "industry": industry,
                "category": "app_only_unseen",
            }
        )

    decoupled_cases = [
        ("Factory", "Retail"),
        ("Hospital", "Manufacturing"),
        ("Hotel", "Healthcare"),
        ("Bakery", "Hospitality"),
    ]
    for business_type, industry in decoupled_cases:
        scenarios.append(
            {
                "label": f"decoupled:{business_type}+{industry}",
                "business_type": business_type,
                "industry": industry,
                "category": "decoupled_user_mismatch",
            }
        )

    return scenarios


def audit_b_industry_sensitivity(stage12: Any) -> dict[str, Any]:
    """Run the same energy profile through different business_type/industry labels."""
    if not ENERGY_RECORDS_CSV.is_file():
        raise FileNotFoundError(f"Final dataset not found: {ENERGY_RECORDS_CSV}")

    model_path = MODELS_DIR / f"{SELECTED_MODEL}.joblib"
    if not model_path.is_file():
        raise FileNotFoundError(
            f"Persisted model not found: {model_path}. Run Stage 10 training first."
        )

    frame = pd.read_csv(
        ENERGY_RECORDS_CSV,
        sep=CSV_SEPARATOR,
        encoding=DEFAULT_ENCODING,
    )
    training_report = stage12.load_training_report()
    features = stage12.get_feature_contract(training_report)
    baseline = _build_baseline_record(frame, features)
    rule_engine_map = load_rule_engine_industry_map()
    scenarios = _build_sensitivity_scenarios(rule_engine_map)

    results: list[dict[str, Any]] = []
    for scenario in scenarios:
        record = dict(baseline)
        record["business_type"] = scenario["business_type"]
        record["industry"] = scenario["industry"]
        prediction = float(stage12.predict(pd.DataFrame([record]))[0])
        results.append(
            {
                **scenario,
                "predicted_next_month_energy_cost": round(prediction, 2),
            }
        )

    predictions = [row["predicted_next_month_energy_cost"] for row in results]
    min_pred = min(predictions)
    max_pred = max(predictions)
    spread = max_pred - min_pred
    spread_pct = (spread / min_pred * 100) if min_pred > 0 else None

    trained_preds = [
        row["predicted_next_month_energy_cost"]
        for row in results
        if row["category"] == "trained_locked_pair"
    ]
    app_only_preds = [
        row["predicted_next_month_energy_cost"]
        for row in results
        if row["category"] == "app_only_unseen"
    ]

    factory_pred = next(
        row["predicted_next_month_energy_cost"]
        for row in results
        if row["label"] == "trained:Factory"
    )
    retail_store_pred = next(
        (
            row["predicted_next_month_energy_cost"]
            for row in results
            if row["label"] == "app_only:Retail Store"
        ),
        None,
    )
    hospital_pred = next(
        row["predicted_next_month_energy_cost"]
        for row in results
        if row["label"] == "trained:Hospital"
    )

    return {
        "audit": "B",
        "title": "Industry and business_type sensitivity",
        "generated_at": _current_ts(),
        "model": SELECTED_MODEL,
        "method": (
            "Fixed median Factory energy profile; only business_type and industry vary "
            "per scenario. All other model features held constant."
        ),
        "baseline_profile_summary": {
            key: round(float(baseline[key]), 4)
            if isinstance(baseline[key], (int, float, np.floating))
            else baseline[key]
            for key in [
                "year",
                "month",
                "electricity_bill",
                "diesel_cost",
                "petrol_cost",
                "generator_hours",
                "grid_hours",
                "outage_hours",
                "total_energy_cost",
                "employees",
                "monthly_revenue",
                "business_type",
                "industry",
                "state",
                "energy_source",
            ]
            if key in baseline
        },
        "scenarios": results,
        "analysis": {
            "prediction_min": round(min_pred, 2),
            "prediction_max": round(max_pred, 2),
            "prediction_spread_naira": round(spread, 2),
            "prediction_spread_pct_of_min": round(spread_pct, 2)
            if spread_pct is not None
            else None,
            "trained_type_spread_naira": round(max(trained_preds) - min(trained_preds), 2),
            "app_only_all_equal": len(set(app_only_preds)) == 1 if app_only_preds else None,
            "app_only_unique_prediction_count": len(set(app_only_preds)),
            "factory_vs_hospital_delta_naira": round(hospital_pred - factory_pred, 2),
            "factory_vs_retail_store_delta_naira": round(retail_store_pred - factory_pred, 2)
            if retail_store_pred is not None
            else None,
            "interpretation_notes": [
                "If app_only scenarios share one prediction, unknown categories are likely ignored by one-hot encoding.",
                "If trained scenarios differ, business_type/industry affect predictions within training coverage.",
                "Decoupled pairs simulate user-selected mismatches not present in synthetic training data.",
            ],
        },
    }


def _load_lightgbm_predictions() -> pd.DataFrame:
    if not PREDICTIONS_CSV.is_file():
        raise FileNotFoundError(
            f"Predictions file not found: {PREDICTIONS_CSV}. Run Stage 11 first."
        )

    predictions = pd.read_csv(
        PREDICTIONS_CSV,
        sep=CSV_SEPARATOR,
        encoding=DEFAULT_ENCODING,
    )
    return predictions[
        (predictions["model"] == SELECTED_MODEL)
        & (predictions["split"].isin(["validation", "test"]))
    ].copy()


def _round_to(value: float, digits: int) -> float:
    factor = 10**digits
    return round(value * factor) / factor


def _safe_divide(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def _days_in_calendar_month(year: int, month: int) -> int:
    return calendar.monthrange(int(year), int(month))[1]


def _recalculate_derived_features(record: dict[str, Any]) -> dict[str, Any]:
    """Mirror frontend deriveEnergyMetrics / ML engineered fields after scenario edits."""
    result = dict(record)
    total_energy_cost = (
        float(result["electricity_bill"])
        + float(result["diesel_cost"])
        + float(result["petrol_cost"])
    )
    employees = float(result["employees"])
    energy_kwh = float(result["energy_consumption_kwh"])
    generator_hours = float(result["generator_hours"])
    grid_hours = float(result["grid_hours"])
    outage_hours = float(result["outage_hours"])
    operating_hours = float(result["operating_hours"])
    monthly_revenue = float(result["monthly_revenue"])
    fuel_liters = float(result["fuel_consumption_liters"])
    year = int(result["year"])
    month = int(result["month"])

    result["total_energy_cost"] = total_energy_cost
    result["quarter"] = (month - 1) // 3 + 1
    result["cost_per_kwh"] = _round_to(_safe_divide(total_energy_cost, energy_kwh), 4)
    result["energy_cost_per_employee"] = _round_to(
        _safe_divide(total_energy_cost, employees), 4
    )
    result["generator_dependency"] = _round_to(
        _safe_divide(generator_hours, generator_hours + grid_hours), 6
    )
    result["revenue_energy_ratio"] = _round_to(
        _safe_divide(monthly_revenue, total_energy_cost), 6
    )
    days_in_month = _days_in_calendar_month(year, month)
    result["outage_severity"] = _round_to(
        _safe_divide(outage_hours, operating_hours * days_in_month), 6
    )
    result["estimated_carbon_intensity"] = _round_to(
        _safe_divide(fuel_liters, energy_kwh), 6
    )
    return result


def apply_generator_hours_scenario(
    record: dict[str, Any],
    reduction_percent: float,
) -> dict[str, Any]:
    """Match frontend applyGeneratorHoursScenario scaling rules."""
    clamped = min(
        GENERATOR_SCENARIO_MAX_REDUCTION_PERCENT,
        max(0.0, float(reduction_percent)),
    )
    scale_factor = 1 - clamped / 100

    scenario = dict(record)
    scenario["generator_hours"] = _round_to(
        float(record["generator_hours"]) * scale_factor, 4
    )
    scenario["diesel_cost"] = _round_to(float(record["diesel_cost"]) * scale_factor, 2)
    scenario["fuel_consumption_liters"] = _round_to(
        float(record["fuel_consumption_liters"]) * scale_factor, 4
    )
    return _recalculate_derived_features(scenario)


def _record_to_json_safe(record: dict[str, Any]) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    for key, value in record.items():
        if isinstance(value, (np.floating, float)):
            safe[key] = round(float(value), 4)
        elif isinstance(value, (np.integer, int)):
            safe[key] = int(value)
        else:
            safe[key] = value
    return safe


def _load_training_report() -> dict[str, Any]:
    if not TRAINING_REPORT_PATH.is_file():
        raise FileNotFoundError(f"Training report not found: {TRAINING_REPORT_PATH}")
    with TRAINING_REPORT_PATH.open("r", encoding=DEFAULT_ENCODING) as file:
        report = json.load(file)
    if not isinstance(report, dict):
        raise ValueError("Training report must contain a JSON object.")
    return report


def _load_eval_energy_rows() -> pd.DataFrame:
    """Return validation/test energy rows used for model evaluation."""
    if not ENERGY_RECORDS_CSV.is_file():
        raise FileNotFoundError(f"Final dataset not found: {ENERGY_RECORDS_CSV}")

    model_preds = _load_lightgbm_predictions()
    eval_record_ids = set(model_preds["record_id"].tolist())
    energy_records = pd.read_csv(
        ENERGY_RECORDS_CSV,
        sep=CSV_SEPARATOR,
        encoding=DEFAULT_ENCODING,
    )
    return energy_records[energy_records["record_id"].isin(eval_record_ids)].copy()


def _baseline_record_from_row(row: pd.Series) -> dict[str, Any]:
    record = row.to_dict()
    for column in IDENTIFIER_COLUMNS:
        record.pop(column, None)
    return record


def _analyze_whatif_sweep(
    predictions_by_reduction: dict[int, float],
) -> dict[str, Any]:
    ordered = [predictions_by_reduction[level] for level in WHATIF_REDUCTION_LEVELS]
    baseline = ordered[0]
    at_max = ordered[-1]
    delta = at_max - baseline
    delta_pct = (delta / baseline * 100) if abs(baseline) > 1e-12 else 0.0
    flat = all(abs(value - baseline) < 1.0 for value in ordered)
    monotonic = all(
        ordered[index] >= ordered[index + 1] for index in range(len(ordered) - 1)
    )

    return {
        "baseline_prediction": round(baseline, 2),
        "prediction_at_max_reduction": round(at_max, 2),
        "delta_at_max_reduction_naira": round(delta, 2),
        "delta_at_max_reduction_pct": round(delta_pct, 4),
        "direction_sensible": delta <= 0,
        "monotonic_non_increasing": monotonic,
        "flat_response": flat,
    }


def _bucket_label(value: float, buckets: list[tuple[str, float, float]]) -> str:
    for label, lower, upper in buckets:
        if lower <= value < upper:
            return label
    return buckets[-1][0]


def audit_f_whatif_robustness(stage12: Any) -> dict[str, Any]:
    """Sweep What-If scenarios across the full validation/test population."""
    model_path = MODELS_DIR / f"{SELECTED_MODEL}.joblib"
    if not model_path.is_file():
        raise FileNotFoundError(
            f"Persisted model not found: {model_path}. Run Stage 10 training first."
        )

    eval_rows = _load_eval_energy_rows()
    training_report = _load_training_report()
    features = stage12.get_feature_contract(training_report)

    scenario_rows: list[dict[str, Any]] = []
    metadata_rows: list[dict[str, Any]] = []

    for _, row in eval_rows.iterrows():
        baseline_record = _baseline_record_from_row(row)
        baseline_dependency = float(baseline_record["generator_dependency"])

        for reduction in WHATIF_REDUCTION_LEVELS:
            scenario_record = apply_generator_hours_scenario(baseline_record, reduction)
            scenario_rows.append({key: scenario_record[key] for key in features})
            metadata_rows.append(
                {
                    "record_id": row["record_id"],
                    "business_type": row["business_type"],
                    "industry": row["industry"],
                    "reduction_percent": reduction,
                    "generator_dependency_baseline": baseline_dependency,
                }
            )

    predictions = stage12.predict(pd.DataFrame(scenario_rows))
    metadata = pd.DataFrame(metadata_rows)
    metadata["predicted_next_month_energy_cost"] = predictions

    per_record_results: list[dict[str, Any]] = []
    for record_id, group in metadata.groupby("record_id", sort=False):
        preds_by_reduction = {
            int(row.reduction_percent): float(row.predicted_next_month_energy_cost)
            for row in group.itertuples(index=False)
        }
        analysis = _analyze_whatif_sweep(preds_by_reduction)
        first = group.iloc[0]
        per_record_results.append(
            {
                "record_id": record_id,
                "business_type": first["business_type"],
                "industry": first["industry"],
                "generator_dependency_baseline": round(
                    float(first["generator_dependency_baseline"]), 4
                ),
                "dependency_bucket": _bucket_label(
                    float(first["generator_dependency_baseline"]),
                    GENERATOR_DEPENDENCY_BUCKETS,
                ),
                **analysis,
            }
        )

    results_frame = pd.DataFrame(per_record_results)
    population = len(results_frame)

    def _population_rates(frame: pd.DataFrame) -> dict[str, Any]:
        count = len(frame)
        if count == 0:
            return {"row_count": 0}
        return {
            "row_count": count,
            "direction_sensible_rate_pct": round(
                float(frame["direction_sensible"].mean()) * 100, 1
            ),
            "monotonic_non_increasing_rate_pct": round(
                float(frame["monotonic_non_increasing"].mean()) * 100, 1
            ),
            "flat_response_rate_pct": round(float(frame["flat_response"].mean()) * 100, 1),
            "median_delta_at_max_reduction_naira": round(
                float(frame["delta_at_max_reduction_naira"].median()), 2
            ),
            "median_delta_at_max_reduction_pct": round(
                float(frame["delta_at_max_reduction_pct"].median()), 4
            ),
            "mean_delta_at_max_reduction_naira": round(
                float(frame["delta_at_max_reduction_naira"].mean()), 2
            ),
        }

    by_dependency_bucket: list[dict[str, Any]] = []
    for label, lower, upper in GENERATOR_DEPENDENCY_BUCKETS:
        bucket_rows = results_frame[
            (results_frame["generator_dependency_baseline"] >= lower)
            & (results_frame["generator_dependency_baseline"] < upper)
        ]
        by_dependency_bucket.append(
            {
                "bucket": label,
                "generator_dependency_range": [lower, upper if upper <= 1 else 1.0],
                **_population_rates(bucket_rows),
            }
        )

    by_business_type: list[dict[str, Any]] = []
    for business_type, group in results_frame.groupby("business_type", sort=True):
        by_business_type.append(
            {"business_type": business_type, **_population_rates(group)}
        )

    overall = _population_rates(results_frame)

    empirical_thresholds: list[dict[str, Any]] = []
    for threshold in [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40]:
        subset = results_frame[results_frame["generator_dependency_baseline"] >= threshold]
        rates = _population_rates(subset)
        empirical_thresholds.append(
            {
                "minimum_generator_dependency": threshold,
                "minimum_generator_dependency_pct": round(threshold * 100, 1),
                **rates,
            }
        )

    recommended_cutoff: dict[str, Any] | None = None
    for entry in empirical_thresholds:
        if entry.get("row_count", 0) == 0:
            continue
        if entry.get("direction_sensible_rate_pct", 0) >= 70:
            recommended_cutoff = {
                "minimum_generator_dependency": entry["minimum_generator_dependency"],
                "minimum_generator_dependency_pct": entry["minimum_generator_dependency_pct"],
                "direction_sensible_rate_pct": entry["direction_sensible_rate_pct"],
                "monotonic_non_increasing_rate_pct": entry[
                    "monotonic_non_increasing_rate_pct"
                ],
                "row_count": entry["row_count"],
                "note": (
                    "Lowest tested threshold where at least 70% of records show "
                    "non-increasing predicted cost at max generator reduction."
                ),
            }
            break

    return {
        "audit": "F",
        "title": "What-If robustness across validation/test population",
        "generated_at": _current_ts(),
        "model": SELECTED_MODEL,
        "population_size": population,
        "reduction_levels_percent": WHATIF_REDUCTION_LEVELS,
        "max_reduction_percent": GENERATOR_SCENARIO_MAX_REDUCTION_PERCENT,
        "overall": overall,
        "by_generator_dependency_bucket": by_dependency_bucket,
        "by_business_type": by_business_type,
        "empirical_threshold_analysis": empirical_thresholds,
        "recommended_minimum_generator_dependency": recommended_cutoff,
        "analysis": {
            "interpretation_notes": [
                "Direction sensible = predicted cost at 40% reduction is not higher than baseline.",
                "Flat response = all five scenario predictions are within ₦1 of each other.",
                "Use dependency buckets and empirical thresholds to set product guardrails with evidence.",
            ],
            "population_direction_sensible_rate_pct": overall.get(
                "direction_sensible_rate_pct"
            ),
            "population_flat_response_rate_pct": overall.get("flat_response_rate_pct"),
        },
    }


def _aggregate_transformed_importances(
    transformed_names: np.ndarray,
    importances: np.ndarray,
    numeric_features: list[str],
    categorical_features: list[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    aggregated: dict[str, float] = {feature: 0.0 for feature in numeric_features + categorical_features}
    detail: list[dict[str, Any]] = []

    for name, importance in zip(transformed_names, importances, strict=True):
        value = float(importance)
        detail.append({"transformed_feature": str(name), "importance": round(value, 6)})

        if str(name).startswith("num__"):
            base = str(name)[5:]
            if base in aggregated:
                aggregated[base] += value
            continue

        if str(name).startswith("cat__"):
            rest = str(name)[4:]
            matched = None
            for categorical in categorical_features:
                prefix = f"{categorical}_"
                if rest.startswith(prefix):
                    matched = categorical
                    break
            if matched is not None:
                aggregated[matched] += value

    total = sum(aggregated.values()) or 1.0
    ranked = sorted(
        (
            {
                "feature": feature,
                "importance": round(score, 6),
                "importance_pct": round(score / total * 100, 2),
            }
            for feature, score in aggregated.items()
            if score > 0
        ),
        key=lambda row: row["importance"],
        reverse=True,
    )
    return ranked, detail


def audit_g_feature_importance() -> dict[str, Any]:
    """Extract and aggregate LightGBM feature importances from the persisted pipeline."""
    model_path = MODELS_DIR / f"{SELECTED_MODEL}.joblib"
    if not model_path.is_file():
        raise FileNotFoundError(
            f"Persisted model not found: {model_path}. Run Stage 10 training first."
        )

    pipeline = joblib.load(model_path)
    preprocessor = pipeline.named_steps["preprocessor"]
    estimator = pipeline.named_steps["estimator"]

    if not hasattr(estimator, "feature_importances_"):
        raise ValueError("Selected model does not expose feature_importances_.")

    training_report = _load_training_report()
    numeric_features = [str(feature) for feature in training_report["numeric"]]
    categorical_features = [str(feature) for feature in training_report["categorical"]]

    transformed_names = preprocessor.get_feature_names_out()
    importances = np.asarray(estimator.feature_importances_, dtype=float)
    ranked, detail = _aggregate_transformed_importances(
        transformed_names,
        importances,
        numeric_features,
        categorical_features,
    )

    def _importance_pct(feature_name: str) -> float:
        for row in ranked:
            if row["feature"] == feature_name:
                return row["importance_pct"]
        return 0.0

    energy_cost_group = [
        "total_energy_cost",
        "electricity_bill",
        "diesel_cost",
        "petrol_cost",
        "maintenance_cost",
    ]
    usage_group = [
        "generator_hours",
        "grid_hours",
        "outage_hours",
        "fuel_consumption_liters",
        "energy_consumption_kwh",
        "generator_dependency",
        "outage_severity",
    ]
    identity_group = ["business_type", "industry", "state", "energy_source"]
    derived_ratio_group = [
        "cost_per_kwh",
        "energy_cost_per_employee",
        "revenue_energy_ratio",
        "estimated_carbon_intensity",
    ]

    def _group_total(features: list[str]) -> float:
        return round(sum(_importance_pct(feature) for feature in features), 2)

    top_feature = ranked[0]["feature"] if ranked else None
    top_three = ranked[:3]

    product_interpretation = (
        "The model is primarily driven by current-month energy spend and usage signals."
    )
    if _importance_pct("total_energy_cost") >= 25:
        product_interpretation = (
            "GridSense behaves mainly as a current-spend-to-next-month forecast: "
            "total_energy_cost dominates the model."
        )
    if _importance_pct("business_type") + _importance_pct("industry") < 5:
        product_interpretation += (
            " Industry and business_type labels contribute very little relative to energy inputs."
        )

    return {
        "audit": "G",
        "title": "LightGBM feature importance",
        "generated_at": _current_ts(),
        "model": SELECTED_MODEL,
        "ranked_features": ranked,
        "top_features": top_three,
        "importance_groups_pct": {
            "current_energy_costs": _group_total(energy_cost_group),
            "usage_and_operational": _group_total(usage_group),
            "business_identity": _group_total(identity_group),
            "derived_ratios": _group_total(derived_ratio_group),
            "time_fields": _group_total(["month", "year", "quarter"]),
            "business_scale": _group_total(
                ["employees", "floor_area_sqm", "monthly_revenue", "occupancy_rate"]
            ),
            "environment_and_renewables": _group_total(
                ["weather_avg_temp", "solar_capacity_kw"]
            ),
        },
        "transformed_feature_count": int(len(transformed_names)),
        "analysis": {
            "dominant_feature": top_feature,
            "business_identity_importance_pct": _group_total(identity_group),
            "current_energy_cost_importance_pct": _group_total(energy_cost_group),
            "product_interpretation": product_interpretation,
            "interpretation_notes": [
                "Importances are aggregated across one-hot encoded categorical columns.",
                "High total_energy_cost importance indicates autoregressive cost forecasting, not industry optimization.",
            ],
        },
        "transformed_feature_details": detail,
    }


def _feature_temporal_catalog() -> list[dict[str, Any]]:
    """Document when each model feature is measured relative to the target."""
    return [
        {
            "feature": "month",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Calendar month of the input energy record.",
        },
        {
            "feature": "year",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Calendar year of the input energy record.",
        },
        {
            "feature": "quarter",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": ["month"],
            "leakage_risk": "low",
            "notes": "Derived from current month.",
        },
        {
            "feature": "electricity_bill",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Current-month electricity spend; target is next month.",
        },
        {
            "feature": "diesel_cost",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Current-month diesel spend.",
        },
        {
            "feature": "petrol_cost",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Current-month petrol spend.",
        },
        {
            "feature": "total_energy_cost",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": ["electricity_bill", "diesel_cost", "petrol_cost"],
            "leakage_risk": "medium",
            "notes": (
                "Sum of current-month bills. Strong predictor of next month because target "
                "is next month's total_energy_cost, but this is intentional autoregressive "
                "forecasting rather than same-month leakage."
            ),
        },
        {
            "feature": "generator_hours",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Observed generator usage for the input month.",
        },
        {
            "feature": "grid_hours",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Observed grid usage for the input month.",
        },
        {
            "feature": "outage_hours",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Observed outage hours for the input month.",
        },
        {
            "feature": "energy_consumption_kwh",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Current-month consumption.",
        },
        {
            "feature": "fuel_consumption_liters",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Current-month fuel consumption.",
        },
        {
            "feature": "maintenance_cost",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Current-month maintenance spend.",
        },
        {
            "feature": "cost_per_kwh",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": ["total_energy_cost", "energy_consumption_kwh"],
            "leakage_risk": "medium",
            "notes": "Derived from current-month cost and consumption.",
        },
        {
            "feature": "energy_cost_per_employee",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": ["total_energy_cost", "employees"],
            "leakage_risk": "medium",
            "notes": "Derived from current-month total cost.",
        },
        {
            "feature": "generator_dependency",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": ["generator_hours", "grid_hours"],
            "leakage_risk": "low",
            "notes": "Ratio using current-month hours.",
        },
        {
            "feature": "revenue_energy_ratio",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": ["monthly_revenue", "total_energy_cost"],
            "leakage_risk": "medium",
            "notes": "Uses current-month energy cost in denominator.",
        },
        {
            "feature": "outage_severity",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": ["outage_hours", "operating_hours", "month", "year"],
            "leakage_risk": "low",
            "notes": "Normalized current-month outage exposure.",
        },
        {
            "feature": "estimated_carbon_intensity",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": ["fuel_consumption_liters", "energy_consumption_kwh"],
            "leakage_risk": "low",
            "notes": "Current-month fuel intensity ratio.",
        },
        {
            "feature": "business_type",
            "temporal_basis": "business_static",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Static business profile field.",
        },
        {
            "feature": "industry",
            "temporal_basis": "business_static",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Static business profile field.",
        },
        {
            "feature": "state",
            "temporal_basis": "business_static",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Static business location.",
        },
        {
            "feature": "energy_source",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Declared source mix for the input month.",
        },
        {
            "feature": "employees",
            "temporal_basis": "business_static",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Slow-changing business attribute.",
        },
        {
            "feature": "operating_hours",
            "temporal_basis": "business_static",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Business operating profile.",
        },
        {
            "feature": "floor_area_sqm",
            "temporal_basis": "business_static",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Business physical profile.",
        },
        {
            "feature": "solar_capacity_kw",
            "temporal_basis": "business_static",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Installed capacity, not future generation.",
        },
        {
            "feature": "monthly_revenue",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Revenue aligned to the input month.",
        },
        {
            "feature": "occupancy_rate",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Operational rate for the input month.",
        },
        {
            "feature": "weather_avg_temp",
            "temporal_basis": "current_month",
            "available_at_forecast_time": True,
            "derived_from": [],
            "leakage_risk": "low",
            "notes": "Observed weather for the input month.",
        },
    ]


def _verify_target_construction(frame: pd.DataFrame) -> dict[str, Any]:
    ordered = frame.sort_values(["business_id", "year", "month"]).copy()
    expected = ordered.groupby("business_id", sort=False)["total_energy_cost"].shift(-1)
    actual = ordered[TARGET_COLUMN]

    comparable = expected.notna() & actual.notna()
    exact_matches = int((expected[comparable] == actual[comparable]).sum())
    comparable_count = int(comparable.sum())

    final_rows = ordered.groupby("business_id", sort=False).tail(1)
    final_null_targets = int(final_rows[TARGET_COLUMN].isna().sum())

    return {
        "target_definition": "next_month_energy_cost = next month's total_energy_cost within business",
        "comparable_rows": comparable_count,
        "exact_match_rows": exact_matches,
        "exact_match_rate_pct": round(exact_matches / comparable_count * 100, 4)
        if comparable_count
        else None,
        "final_row_null_targets": final_null_targets,
        "expected_final_null_targets": int(frame["business_id"].nunique()),
        "target_shift_verified": exact_matches == comparable_count
        and final_null_targets == int(frame["business_id"].nunique()),
    }


def audit_h_leakage_sanity() -> dict[str, Any]:
    """Verify feature timing and target construction; quantify target correlations."""
    if not ENERGY_RECORDS_CSV.is_file():
        raise FileNotFoundError(f"Final dataset not found: {ENERGY_RECORDS_CSV}")

    frame = pd.read_csv(
        ENERGY_RECORDS_CSV,
        sep=CSV_SEPARATOR,
        encoding=DEFAULT_ENCODING,
    )
    training_report = _load_training_report()
    features = [str(feature) for feature in training_report["features"]]

    target_check = _verify_target_construction(frame)

    eval_rows = _load_eval_energy_rows()
    correlations: list[dict[str, Any]] = []
    for feature in features:
        if feature not in eval_rows.columns:
            continue
        series = eval_rows[[feature, TARGET_COLUMN]].dropna()
        if len(series) < 2:
            continue
        if not pd.api.types.is_numeric_dtype(series[feature]):
            continue
        correlation = float(series[feature].corr(series[TARGET_COLUMN]))
        if not np.isfinite(correlation):
            continue
        correlations.append(
            {
                "feature": feature,
                "pearson_correlation_with_target": round(correlation, 4),
            }
        )

    correlations.sort(
        key=lambda row: abs(row["pearson_correlation_with_target"]),
        reverse=True,
    )

    medium_risk = [
        row
        for row in _feature_temporal_catalog()
        if row["leakage_risk"] == "medium"
    ]
    high_corr = [
        row
        for row in correlations
        if abs(row["pearson_correlation_with_target"]) >= 0.85
    ]

    current_cost_only = eval_rows[[TARGET_COLUMN, "total_energy_cost"]].dropna()
    same_month_leakage_probe = {
        "feature": "total_energy_cost_same_month_vs_target",
        "pearson_correlation_with_target": round(
            float(
                current_cost_only["total_energy_cost"].corr(
                    current_cost_only[TARGET_COLUMN]
                )
            ),
            4,
        ),
        "interpretation": (
            "High correlation is expected because the target is next month's total "
            "energy cost and businesses have persistent monthly spend patterns."
        ),
    }

    excluded_from_model = [str(item) for item in training_report.get("excluded", [])]
    explicitly_excluded_targets = [
        column for column in excluded_from_model if column == TARGET_COLUMN
    ]

    return {
        "audit": "H",
        "title": "Leakage and feature temporal sanity",
        "generated_at": _current_ts(),
        "target_column": TARGET_COLUMN,
        "target_construction_check": target_check,
        "excluded_from_model_features": excluded_from_model,
        "target_explicitly_excluded_from_inputs": bool(explicitly_excluded_targets),
        "feature_temporal_catalog": _feature_temporal_catalog(),
        "eval_split_correlations_with_target": correlations,
        "high_correlation_features": high_corr,
        "medium_leakage_risk_features": medium_risk,
        "same_month_cost_vs_next_month_target": same_month_leakage_probe,
        "analysis": {
            "leakage_verdict": (
                "PASS"
                if target_check["target_shift_verified"]
                and TARGET_COLUMN in excluded_from_model
                else "REVIEW"
            ),
            "product_interpretation": (
                "Features represent current-month observations and static business "
                "attributes forecasting next month's total energy cost. High R² is "
                "primarily driven by autoregressive cost persistence, not same-month leakage."
            ),
            "interpretation_notes": [
                "Medium-risk features derive from current-month total_energy_cost but remain temporally valid inputs.",
                "Verify product copy describes next-month forecasting from current observed data.",
                "GES and other post-hoc scores are excluded from the model contract.",
            ],
        },
    }


def audit_d_worst_predictions(top_n: int = WORST_PREDICTIONS_TOP_N) -> dict[str, Any]:
    """Identify largest LightGBM errors and summarize where they cluster."""
    model_preds = _load_lightgbm_predictions()
    if not ENERGY_RECORDS_CSV.is_file():
        raise FileNotFoundError(f"Final dataset not found: {ENERGY_RECORDS_CSV}")

    energy_records = pd.read_csv(
        ENERGY_RECORDS_CSV,
        sep=CSV_SEPARATOR,
        encoding=DEFAULT_ENCODING,
    )

    merged = model_preds.merge(
        energy_records,
        on="record_id",
        how="left",
        suffixes=("", "_record"),
    )

    if merged["total_energy_cost"].isna().any():
        missing = int(merged["total_energy_cost"].isna().sum())
        raise ValueError(f"{missing} prediction rows could not be joined to energy records.")

    merged["abs_residual"] = merged["residual"].abs()
    merged["residual_pct_of_actual"] = np.where(
        merged["actual_next_month_energy_cost"].abs() > 1e-12,
        merged["abs_residual"] / merged["actual_next_month_energy_cost"] * 100,
        np.nan,
    )
    merged["over_predicted"] = merged["residual"] < 0

    worst = merged.sort_values("abs_residual", ascending=False).head(top_n)

    context_columns = [
        "record_id",
        "business_id",
        "business_name",
        "business_type",
        "industry",
        "state",
        "year",
        "month",
        "split",
        "actual_next_month_energy_cost",
        "predicted_next_month_energy_cost",
        "residual",
        "abs_residual",
        "residual_pct_of_actual",
        "over_predicted",
        "total_energy_cost",
        "electricity_bill",
        "diesel_cost",
        "petrol_cost",
        "generator_hours",
        "grid_hours",
        "outage_hours",
        "generator_dependency",
        "energy_consumption_kwh",
        "monthly_revenue",
        "energy_source",
    ]

    worst_rows: list[dict[str, Any]] = []
    for _, row in worst.iterrows():
        entry = {}
        for column in context_columns:
            if column not in row.index:
                continue
            value = row[column]
            if pd.isna(value):
                entry[column] = None
            elif isinstance(value, (np.floating, float)):
                entry[column] = round(float(value), 2)
            elif isinstance(value, (np.bool_, bool)):
                entry[column] = bool(value)
            elif isinstance(value, (np.integer, int)):
                entry[column] = int(value)
            else:
                entry[column] = value
        worst_rows.append(entry)

    def _cluster_summary(group_col: str) -> list[dict[str, Any]]:
        grouped = (
            merged.groupby(group_col, as_index=False)
            .agg(
                row_count=("record_id", "count"),
                mean_abs_residual=("abs_residual", "mean"),
                max_abs_residual=("abs_residual", "max"),
                over_prediction_rate=("over_predicted", "mean"),
            )
            .sort_values("mean_abs_residual", ascending=False)
        )
        results: list[dict[str, Any]] = []
        for _, row in grouped.iterrows():
            results.append(
                {
                    group_col: row[group_col],
                    "row_count": int(row["row_count"]),
                    "mean_abs_residual": round(float(row["mean_abs_residual"]), 2),
                    "max_abs_residual": round(float(row["max_abs_residual"]), 2),
                    "over_prediction_rate_pct": round(
                        float(row["over_prediction_rate"]) * 100, 1
                    ),
                }
            )
        return results

    top_business_type = worst["business_type"].value_counts().index[0]
    top_business_type_count = int(worst["business_type"].value_counts().iloc[0])

    return {
        "audit": "D",
        "title": "Worst prediction cases",
        "generated_at": _current_ts(),
        "model": SELECTED_MODEL,
        "splits_included": ["validation", "test"],
        "top_n": top_n,
        "overall_error_profile": {
            "row_count": int(len(merged)),
            "mean_abs_residual": round(float(merged["abs_residual"].mean()), 2),
            "median_abs_residual": round(float(merged["abs_residual"].median()), 2),
            "max_abs_residual": round(float(merged["abs_residual"].max()), 2),
            "over_prediction_rate_pct": round(
                float(merged["over_predicted"].mean()) * 100, 1
            ),
        },
        "error_clusters": {
            "by_business_type": _cluster_summary("business_type"),
            "by_industry": _cluster_summary("industry"),
            "by_energy_source": _cluster_summary("energy_source"),
            "by_split": _cluster_summary("split"),
        },
        "worst_predictions": worst_rows,
        "analysis": {
            "dominant_business_type_in_top_errors": top_business_type,
            "dominant_business_type_count_in_top_errors": top_business_type_count,
            "interpretation_notes": [
                "Large residuals on high-cost Factory/Hospital rows often reflect absolute naira scale, not only percentage error.",
                "Cluster summaries highlight systematic bias (over- vs under-prediction) by category.",
                "Inspect generator_dependency and outage_hours on worst rows for operational pattern signals.",
            ],
        },
    }


def _select_representative_profile(
    frame: pd.DataFrame,
    business_type: str,
    *,
    rank: str,
) -> pd.Series:
    """Pick a validation/test row for a business type by generator dependency rank."""
    subset = frame[frame["business_type"] == business_type].copy()
    if subset.empty:
        raise ValueError(f"No rows found for business_type={business_type!r}")

    if rank == "high":
        return subset.sort_values("generator_dependency", ascending=False).iloc[0]
    if rank == "low":
        return subset.sort_values("generator_dependency", ascending=True).iloc[0]
    if rank == "median":
        subset = subset.sort_values("generator_dependency")
        return subset.iloc[len(subset) // 2]

    raise ValueError(f"Unknown rank selector: {rank}")


def audit_e_whatif_sensitivity(stage12: Any) -> dict[str, Any]:
    """Sweep generator reduction levels and measure prediction response."""
    if not ENERGY_RECORDS_CSV.is_file():
        raise FileNotFoundError(f"Final dataset not found: {ENERGY_RECORDS_CSV}")

    model_path = MODELS_DIR / f"{SELECTED_MODEL}.joblib"
    if not model_path.is_file():
        raise FileNotFoundError(
            f"Persisted model not found: {model_path}. Run Stage 10 training first."
        )

    model_preds = _load_lightgbm_predictions()
    eval_record_ids = set(model_preds["record_id"].tolist())

    energy_records = pd.read_csv(
        ENERGY_RECORDS_CSV,
        sep=CSV_SEPARATOR,
        encoding=DEFAULT_ENCODING,
    )
    eval_rows = energy_records[energy_records["record_id"].isin(eval_record_ids)].copy()

    profile_specs = [
        {
            "profile_id": "factory_high_generator",
            "label": "Factory — high generator dependency",
            "business_type": "Factory",
            "rank": "high",
        },
        {
            "profile_id": "hotel_moderate_generator",
            "label": "Hotel — moderate generator dependency",
            "business_type": "Hotel",
            "rank": "median",
        },
        {
            "profile_id": "school_low_generator",
            "label": "School — low generator dependency",
            "business_type": "School",
            "rank": "low",
        },
    ]

    training_report = stage12.load_training_report()
    features = stage12.get_feature_contract(training_report)

    profile_results: list[dict[str, Any]] = []

    for spec in profile_specs:
        row = _select_representative_profile(
            eval_rows,
            spec["business_type"],
            rank=spec["rank"],
        )
        baseline_record = row.to_dict()
        baseline_record.pop(TARGET_COLUMN, None)
        baseline_record.pop("record_id", None)
        baseline_record.pop("business_id", None)
        baseline_record.pop("business_name", None)
        baseline_record.pop("created_at", None)
        baseline_record.pop("city", None)

        sweep: list[dict[str, Any]] = []
        baseline_prediction: float | None = None

        for reduction in WHATIF_REDUCTION_LEVELS:
            scenario_record = apply_generator_hours_scenario(baseline_record, reduction)
            feature_record = {key: scenario_record[key] for key in features}
            prediction = float(stage12.predict(pd.DataFrame([feature_record]))[0])

            if reduction == 0:
                baseline_prediction = prediction

            delta = (
                prediction - baseline_prediction
                if baseline_prediction is not None
                else 0.0
            )
            delta_pct = (
                (delta / baseline_prediction) * 100
                if baseline_prediction and abs(baseline_prediction) > 1e-12
                else 0.0
            )

            sweep.append(
                {
                    "reduction_percent": reduction,
                    "generator_hours": scenario_record["generator_hours"],
                    "diesel_cost": scenario_record["diesel_cost"],
                    "fuel_consumption_liters": scenario_record["fuel_consumption_liters"],
                    "total_energy_cost": round(float(scenario_record["total_energy_cost"]), 2),
                    "generator_dependency": round(
                        float(scenario_record["generator_dependency"]), 4
                    ),
                    "predicted_next_month_energy_cost": round(prediction, 2),
                    "delta_from_baseline_naira": round(delta, 2),
                    "delta_from_baseline_pct": round(delta_pct, 2),
                }
            )

        assert baseline_prediction is not None
        predictions = [step["predicted_next_month_energy_cost"] for step in sweep]
        monotonic_non_increasing = all(
            predictions[index] >= predictions[index + 1]
            for index in range(len(predictions) - 1)
        )

        profile_results.append(
            {
                "profile_id": spec["profile_id"],
                "label": spec["label"],
                "source_record_id": row["record_id"],
                "baseline_summary": _record_to_json_safe(
                    {
                        "year": baseline_record["year"],
                        "month": baseline_record["month"],
                        "business_type": baseline_record["business_type"],
                        "industry": baseline_record["industry"],
                        "total_energy_cost": baseline_record["total_energy_cost"],
                        "generator_hours": baseline_record["generator_hours"],
                        "diesel_cost": baseline_record["diesel_cost"],
                        "generator_dependency": baseline_record["generator_dependency"],
                        "monthly_revenue": baseline_record["monthly_revenue"],
                    }
                ),
                "baseline_prediction": round(baseline_prediction, 2),
                "max_reduction_percent": GENERATOR_SCENARIO_MAX_REDUCTION_PERCENT,
                "sweep": sweep,
                "analysis": {
                    "prediction_at_max_reduction": sweep[-1][
                        "predicted_next_month_energy_cost"
                    ],
                    "total_delta_at_max_reduction_naira": sweep[-1][
                        "delta_from_baseline_naira"
                    ],
                    "total_delta_at_max_reduction_pct": sweep[-1][
                        "delta_from_baseline_pct"
                    ],
                    "monotonic_non_increasing": monotonic_non_increasing,
                    "direction_sensible": sweep[-1]["delta_from_baseline_naira"] <= 0,
                },
            }
        )

    sensible_count = sum(
        1 for profile in profile_results if profile["analysis"]["direction_sensible"]
    )
    monotonic_count = sum(
        1
        for profile in profile_results
        if profile["analysis"]["monotonic_non_increasing"]
    )

    return {
        "audit": "E",
        "title": "What-If generator reduction sensitivity",
        "generated_at": _current_ts(),
        "model": SELECTED_MODEL,
        "method": (
            "Matches frontend What-If: scale generator_hours, diesel_cost, and "
            "fuel_consumption_liters; recalculate derived ML features; predict."
        ),
        "reduction_levels_percent": WHATIF_REDUCTION_LEVELS,
        "profiles": profile_results,
        "analysis": {
            "profiles_tested": len(profile_results),
            "profiles_with_sensible_direction": sensible_count,
            "profiles_with_monotonic_non_increasing_predictions": monotonic_count,
            "interpretation_notes": [
                "Sensible direction means max-reduction scenario predicts lower cost than baseline.",
                "Monotonic non-increasing means each step down in generator use does not raise the forecast.",
                "What-If does not model grid replacement or operational constraints — treat as scenario estimates.",
            ],
        },
    }


def build_audit_summary(
    audit_a: dict[str, Any],
    audit_b: dict[str, Any] | None,
    audit_c: dict[str, Any],
    audit_d: dict[str, Any] | None = None,
    audit_e: dict[str, Any] | None = None,
    audit_f: dict[str, Any] | None = None,
    audit_g: dict[str, Any] | None = None,
    audit_h: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """High-level findings across audits A–H."""
    findings: list[str] = []

    gaps = audit_a["gaps"]
    if gaps["business_types_in_app_not_in_training"]:
        findings.append(
            f"{len(gaps['business_types_in_app_not_in_training'])} frontend business types "
            "have no training examples."
        )
    if gaps["industries_in_app_not_in_training"]:
        findings.append(
            f"{len(gaps['industries_in_app_not_in_training'])} frontend industries "
            "have no training examples."
        )

    if audit_b is not None:
        analysis = audit_b["analysis"]
        if analysis.get("app_only_all_equal"):
            findings.append(
                "All app-only business type scenarios produced the same prediction — "
                "likely ignored by the model."
            )
        if analysis.get("trained_type_spread_naira", 0) == 0:
            findings.append(
                "Changing only business_type/industry with fixed energy inputs did not "
                "change predictions at all."
            )
        elif analysis.get("trained_type_spread_naira", 0) > 0:
            findings.append(
                "Trained business types produce different predictions for the same energy profile."
            )

    if audit_d is not None:
        clusters = audit_d["error_clusters"]["by_business_type"]
        if clusters:
            worst_cluster = clusters[0]
            findings.append(
                f"Highest mean absolute error cluster: {worst_cluster['business_type']} "
                f"(MAE ~₦{worst_cluster['mean_abs_residual']:,.0f})."
            )
        dominant = audit_d["analysis"]["dominant_business_type_in_top_errors"]
        count = audit_d["analysis"]["dominant_business_type_count_in_top_errors"]
        findings.append(
            f"{count} of top {audit_d['top_n']} worst errors are {dominant} businesses."
        )

    if audit_e is not None:
        sensible = audit_e["analysis"]["profiles_with_sensible_direction"]
        total = audit_e["analysis"]["profiles_tested"]
        findings.append(
            f"What-If sample sweep: {sensible}/{total} profiles show lower predicted cost at max generator reduction."
        )
        monotonic = audit_e["analysis"]["profiles_with_monotonic_non_increasing_predictions"]
        findings.append(
            f"What-If sample sweep: {monotonic}/{total} profiles have monotonic non-increasing predictions."
        )

    if audit_f is not None:
        overall_f = audit_f["overall"]
        findings.append(
            f"Population What-If: {overall_f.get('direction_sensible_rate_pct', 0)}% "
            f"direction-sensible at max reduction across {audit_f['population_size']} records."
        )
        flat_rate = overall_f.get("flat_response_rate_pct", 0)
        findings.append(
            f"Population What-If: {flat_rate}% of records show flat predictions across all reduction levels."
        )
        cutoff = audit_f.get("recommended_minimum_generator_dependency")
        if cutoff:
            findings.append(
                "Evidence-based generator dependency floor for reliable What-If direction: "
                f"{cutoff['minimum_generator_dependency_pct']}% "
                f"({cutoff['direction_sensible_rate_pct']}% direction-sensible, n={cutoff['row_count']})."
            )
        else:
            findings.append(
                "No tested generator-dependency threshold reached 70% direction-sensible rate."
            )

    if audit_g is not None:
        dominant = audit_g["analysis"].get("dominant_feature")
        identity_pct = audit_g["analysis"].get("business_identity_importance_pct", 0)
        findings.append(
            f"Dominant model driver: {dominant}; business identity features = {identity_pct}% importance."
        )
        findings.append(audit_g["analysis"]["product_interpretation"])

    if audit_h is not None:
        verdict = audit_h["analysis"]["leakage_verdict"]
        findings.append(f"Leakage/temporal sanity verdict: {verdict}.")
        top_corr = audit_h.get("high_correlation_features", [])[:1]
        if top_corr:
            feature = top_corr[0]["feature"]
            corr = top_corr[0]["pearson_correlation_with_target"]
            findings.append(
                f"Highest target correlation on eval split: {feature} (r={corr})."
            )

    worst_bt = min(
        audit_c["by_business_type"],
        key=lambda row: row["r2"] if row["r2"] is not None else float("inf"),
    )
    best_bt = max(
        audit_c["by_business_type"],
        key=lambda row: row["r2"] if row["r2"] is not None else float("-inf"),
    )
    findings.append(
        f"Lowest R² by business_type: {worst_bt['business_type']} ({worst_bt['r2']}); "
        f"highest: {best_bt['business_type']} ({best_bt['r2']})."
    )

    audits_run = [
        label
        for label, included in [
            ("A", True),
            ("B", audit_b is not None),
            ("C", True),
            ("D", audit_d is not None),
            ("E", audit_e is not None),
            ("F", audit_f is not None),
            ("G", audit_g is not None),
            ("H", audit_h is not None),
        ]
        if included
    ]

    return {
        "generated_at": _current_ts(),
        "audits_run": audits_run,
        "key_findings": findings,
        "coverage": audit_a["coverage_summary"],
        "sensitivity": audit_b["analysis"] if audit_b is not None else None,
        "overall_accuracy": audit_c["overall"],
        "worst_errors": audit_d["overall_error_profile"] if audit_d is not None else None,
        "whatif_sample_sensitivity": audit_e["analysis"] if audit_e is not None else None,
        "whatif_population_robustness": audit_f["analysis"] if audit_f is not None else None,
        "whatif_recommended_minimum_generator_dependency": (
            audit_f.get("recommended_minimum_generator_dependency") if audit_f else None
        ),
        "feature_importance": audit_g["analysis"] if audit_g is not None else None,
        "leakage_sanity": audit_h["analysis"] if audit_h is not None else None,
    }


def write_json_report(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding=DEFAULT_ENCODING) as file:
        json.dump(payload, file, indent=2)


def run_audits(*, skip_model_audits_if_missing: bool = False) -> dict[str, Any]:
    """Run audits A–H and write JSON reports."""
    print("Running Audit A: training coverage vs frontend options...")
    audit_a = audit_a_coverage_gap()
    write_json_report(AUDIT_A_REPORT, audit_a)
    print(f"  Wrote {AUDIT_A_REPORT}")

    print("Running Audit C: per-category accuracy...")
    audit_c = audit_c_metrics_by_category()
    write_json_report(AUDIT_C_REPORT, audit_c)
    print(f"  Wrote {AUDIT_C_REPORT}")

    print("Running Audit D: worst prediction cases...")
    audit_d = audit_d_worst_predictions()
    write_json_report(AUDIT_D_REPORT, audit_d)
    print(f"  Wrote {AUDIT_D_REPORT}")

    print("Running Audit H: leakage and feature temporal sanity...")
    audit_h = audit_h_leakage_sanity()
    write_json_report(AUDIT_H_REPORT, audit_h)
    print(f"  Wrote {AUDIT_H_REPORT}")

    model_path = MODELS_DIR / f"{SELECTED_MODEL}.joblib"
    audit_b: dict[str, Any] | None = None
    audit_e: dict[str, Any] | None = None
    audit_f: dict[str, Any] | None = None
    audit_g: dict[str, Any] | None = None

    if model_path.is_file():
        stage12 = _load_stage_12()
        print("Running Audit B: industry / business_type sensitivity...")
        audit_b = audit_b_industry_sensitivity(stage12)
        write_json_report(AUDIT_B_REPORT, audit_b)
        print(f"  Wrote {AUDIT_B_REPORT}")

        print("Running Audit E: What-If generator reduction sensitivity (sample profiles)...")
        audit_e = audit_e_whatif_sensitivity(stage12)
        write_json_report(AUDIT_E_REPORT, audit_e)
        print(f"  Wrote {AUDIT_E_REPORT}")

        print("Running Audit F: What-If robustness (full eval population)...")
        audit_f = audit_f_whatif_robustness(stage12)
        write_json_report(AUDIT_F_REPORT, audit_f)
        print(f"  Wrote {AUDIT_F_REPORT}")

        print("Running Audit G: feature importance...")
        audit_g = audit_g_feature_importance()
        write_json_report(AUDIT_G_REPORT, audit_g)
        print(f"  Wrote {AUDIT_G_REPORT}")
    elif skip_model_audits_if_missing:
        print("Skipping Audits B, E, F, and G: model artifact not found.")
    else:
        raise FileNotFoundError(
            f"Model artifact required for Audits B, E, F, and G not found: {model_path}. "
            "Run Stage 10 (10_tain_models.py) first."
        )

    summary = build_audit_summary(
        audit_a, audit_b, audit_c, audit_d, audit_e, audit_f, audit_g, audit_h
    )
    write_json_report(AUDIT_SUMMARY_REPORT, summary)
    print(f"Wrote {AUDIT_SUMMARY_REPORT}")

    return {
        "audit_a": audit_a,
        "audit_b": audit_b,
        "audit_c": audit_c,
        "audit_d": audit_d,
        "audit_e": audit_e,
        "audit_f": audit_f,
        "audit_g": audit_g,
        "audit_h": audit_h,
        "summary": summary,
    }


def main() -> None:
    run_audits(skip_model_audits_if_missing=False)


if __name__ == "__main__":
    main()
