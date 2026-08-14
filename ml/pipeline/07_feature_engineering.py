"""Stage 07: leakage-safe feature engineering for synthetic SME monthly records."""

from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path

import numpy as np
import pandas as pd

from config import (
    BUSINESSES_DATASET,
    ENERGY_RECORDS_DATASET,
    PROCESSED_DATA_DIR,
    SYNTHETIC_DATA_DIR,
)


PIPELINE_DIR = Path(__file__).resolve().parent
ML_ROOT = PIPELINE_DIR.parent
REPORT_DIR = ML_ROOT / "reports" / "features"
OUTPUT_PATH = PROCESSED_DATA_DIR / "engineered_energy_records.csv"
REPORT_PATH = REPORT_DIR / "feature_engineering_report.json"
PIPELINE_STATE_PATH = ML_ROOT / "pipeline_state.json"


def _report_generated_at() -> str:
    """Prefer the pipeline run timestamp when available for deterministic reports."""
    if PIPELINE_STATE_PATH.is_file():
        try:
            with PIPELINE_STATE_PATH.open(encoding="utf-8") as f:
                state = json.load(f)
            ts = state.get("timestamp")
            if isinstance(ts, str) and ts:
                return ts
        except Exception:
            pass
    return datetime.now().isoformat()

EXPECTED_BUSINESSES = 150
EXPECTED_MONTHS_PER_BUSINESS = 24

BUSINESS_COLUMNS = [
    "business_id", "business_name", "business_type", "industry", "state", "city",
    "employees", "operating_hours", "floor_area_sqm", "energy_source",
    "solar_capacity_kw", "monthly_revenue", "created_at",
]
ENERGY_COLUMNS = [
    "record_id", "business_id", "month", "year", "electricity_bill", "diesel_cost",
    "petrol_cost", "generator_hours", "grid_hours", "outage_hours",
    "energy_consumption_kwh", "fuel_consumption_liters", "maintenance_cost",
    "weather_avg_temp", "occupancy_rate", "total_energy_cost",
]
ENGINEERED_COLUMNS = [
    "quarter", "cost_per_kwh", "energy_cost_per_employee", "generator_dependency",
    "revenue_energy_ratio", "outage_severity", "estimated_carbon_intensity",
    "next_month_energy_cost",
]
NONNEGATIVE_ENERGY_COLUMNS = [
    "electricity_bill", "diesel_cost", "petrol_cost", "generator_hours", "grid_hours",
    "outage_hours", "energy_consumption_kwh", "fuel_consumption_liters",
    "maintenance_cost", "total_energy_cost",
]


def _require_columns(frame: pd.DataFrame, columns: list[str], name: str) -> None:
    missing = sorted(set(columns) - set(frame.columns))
    if missing:
        raise ValueError(f"{name} is missing required columns: {missing}")


def load_inputs() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load Stage 06 data only; public Stage 05 data is intentionally excluded."""
    business_path = SYNTHETIC_DATA_DIR / BUSINESSES_DATASET
    energy_path = SYNTHETIC_DATA_DIR / ENERGY_RECORDS_DATASET
    for path in (business_path, energy_path):
        if not path.is_file():
            raise FileNotFoundError(f"Required Stage 06 input was not found: {path}")
    businesses = pd.read_csv(business_path)
    energy_records = pd.read_csv(energy_path)
    _require_columns(businesses, BUSINESS_COLUMNS, "businesses.csv")
    _require_columns(energy_records, ENERGY_COLUMNS, "energy_records.csv")
    return businesses, energy_records


def validate_inputs(businesses: pd.DataFrame, energy_records: pd.DataFrame) -> None:
    """Enforce the Stage 06 business-month contract before joining."""
    if not businesses.business_id.is_unique:
        raise ValueError("businesses.csv contains duplicate business_id values.")
    if not energy_records.record_id.is_unique:
        raise ValueError("energy_records.csv contains duplicate record_id values.")
    if energy_records.duplicated(["business_id", "year", "month"]).any():
        raise ValueError("energy_records.csv contains duplicate business-month keys.")
    if not energy_records.business_id.isin(businesses.business_id).all():
        raise ValueError("energy_records.csv contains business_id values absent from businesses.csv.")
    if len(businesses) != EXPECTED_BUSINESSES:
        raise ValueError(f"Expected {EXPECTED_BUSINESSES} businesses, found {len(businesses)}.")
    records_per_business = energy_records.groupby("business_id").size()
    if len(energy_records) != EXPECTED_BUSINESSES * EXPECTED_MONTHS_PER_BUSINESS or not (records_per_business == EXPECTED_MONTHS_PER_BUSINESS).all():
        raise ValueError("Stage 06 input must contain exactly 24 records for each of 150 businesses.")


def safe_divide(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Divide without producing infinity for zero or missing denominators."""
    denominator = denominator.mask(denominator == 0)
    result = numerator / denominator
    return result.replace([np.inf, -np.inf], np.nan)


def add_engineered_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Add only documented deterministic features and a within-business target lead."""
    result = frame.sort_values(["business_id", "year", "month"], kind="stable").reset_index(drop=True).copy()
    result["quarter"] = ((result["month"] - 1) // 3 + 1).astype("int64")
    result["cost_per_kwh"] = safe_divide(result["total_energy_cost"], result["energy_consumption_kwh"])
    result["energy_cost_per_employee"] = safe_divide(result["total_energy_cost"], result["employees"])
    result["generator_dependency"] = safe_divide(result["generator_hours"], result["generator_hours"] + result["grid_hours"])
    result["revenue_energy_ratio"] = safe_divide(result["monthly_revenue"], result["total_energy_cost"])
    days_in_month = pd.to_datetime(
        {"year": result["year"], "month": result["month"], "day": 1}
    ).dt.days_in_month
    result["outage_severity"] = safe_divide(
        result["outage_hours"], result["operating_hours"] * days_in_month
    )
    result["estimated_carbon_intensity"] = safe_divide(result["fuel_consumption_liters"], result["energy_consumption_kwh"])
    # shift(-1) is applied only inside an already chronological business group.
    result["next_month_energy_cost"] = result.groupby("business_id", sort=False)["total_energy_cost"].shift(-1)
    return result


def build_feature_dataset(businesses: pd.DataFrame, energy_records: pd.DataFrame) -> pd.DataFrame:
    """Join the one-to-many business relationship without changing its grain."""
    validate_inputs(businesses, energy_records)
    merged = energy_records.merge(
        businesses,
        on="business_id",
        how="left",
        validate="many_to_one",
        sort=False,
    )
    if len(merged) != len(energy_records):
        raise ValueError("Business join changed the number of energy-record rows.")
    return add_engineered_features(merged)


def validate_output(frame: pd.DataFrame) -> dict:
    """Validate grain, formulas, ratios, and the grouped forecasting target."""
    _require_columns(frame, BUSINESS_COLUMNS + ENERGY_COLUMNS[0:1] + ENERGY_COLUMNS[2:] + ENGINEERED_COLUMNS, "engineered dataset")
    if len(frame) != EXPECTED_BUSINESSES * EXPECTED_MONTHS_PER_BUSINESS:
        raise ValueError("Engineered dataset does not contain 3,600 rows.")
    if frame.business_id.nunique() != EXPECTED_BUSINESSES:
        raise ValueError("Engineered dataset does not contain 150 businesses.")
    if not (frame.groupby("business_id").size() == EXPECTED_MONTHS_PER_BUSINESS).all():
        raise ValueError("Engineered dataset does not contain 24 rows per business.")
    if frame.record_id.duplicated().any() or frame.duplicated(["business_id", "year", "month"]).any():
        raise ValueError("Engineered dataset contains duplicate keys.")
    if (frame[NONNEGATIVE_ENERGY_COLUMNS] < 0).any().any():
        raise ValueError("Engineered dataset contains invalid negative energy or cost values.")
    numeric = frame.select_dtypes(include="number")
    infinite_value_count = int(np.isinf(numeric.to_numpy(dtype=float)).sum())
    if infinite_value_count:
        raise ValueError("Engineered dataset contains infinite numeric values.")
    if not frame.occupancy_rate.between(0, 100).all() or not (frame.solar_capacity_kw >= 0).all():
        raise ValueError("Occupancy or solar-capacity constraints were violated.")
    for column in ("generator_dependency", "outage_severity"):
        defined = frame[column].dropna()
        if not defined.between(0, 1).all():
            raise ValueError(f"{column} must be between 0 and 1 when defined.")

    ordered = frame.sort_values(["business_id", "year", "month"], kind="stable")
    expected_target = ordered.groupby("business_id", sort=False)["total_energy_cost"].shift(-1)
    if not expected_target.equals(ordered["next_month_energy_cost"]):
        raise ValueError("next_month_energy_cost is not a chronological within-business lead.")
    final_rows = ordered.groupby("business_id", sort=False).tail(1)
    if final_rows.next_month_energy_cost.notna().any() or ordered.next_month_energy_cost.isna().sum() != EXPECTED_BUSINESSES:
        raise ValueError("Only the final chronological record of each business may have a null target.")
    ratio_columns = [
        "cost_per_kwh", "energy_cost_per_employee", "generator_dependency",
        "revenue_energy_ratio", "outage_severity", "estimated_carbon_intensity",
    ]
    return {
        "input_row_counts": {
            "businesses": EXPECTED_BUSINESSES,
            "energy_records": EXPECTED_BUSINESSES * EXPECTED_MONTHS_PER_BUSINESS,
        },
        "rows": len(frame), "columns": len(frame.columns),
        "unique_businesses": int(frame.business_id.nunique()),
        "records_per_business": EXPECTED_MONTHS_PER_BUSINESS,
        "distinct_business_months": int(
            frame[["business_id", "year", "month"]].drop_duplicates().shape[0]
        ),
        "duplicate_record_id_count": int(frame.record_id.duplicated().sum()),
        "duplicate_business_month_count": int(frame.duplicated(["business_id", "year", "month"]).sum()),
        "row_multiplication_detected": False,
        "undefined_ratio_counts": {column: int(frame[column].isna().sum()) for column in ratio_columns},
        "infinite_value_count": infinite_value_count,
        "ratio_validity": {
            "generator_dependency_in_range": True,
            "outage_severity_in_range": True,
        },
        "outage_severity_min": float(frame.outage_severity.min()),
        "outage_severity_max": float(frame.outage_severity.max()),
        "target_non_null": int(frame.next_month_energy_cost.notna().sum()),
        "target_null": int(frame.next_month_energy_cost.isna().sum()),
        "deterministic_output": "Rows are sorted by business_id, year, and month; no random operation is used.",
        "validation": "PASS",
    }


def write_output(frame: pd.DataFrame, report: dict, output_path: Path = OUTPUT_PATH, report_path: Path = REPORT_PATH) -> None:
    """Persist only Stage 07-owned processed data and its report."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False)
    payload = {
        "generated_at": _report_generated_at(),
        "input_files": [str(SYNTHETIC_DATA_DIR / BUSINESSES_DATASET), str(SYNTHETIC_DATA_DIR / ENERGY_RECORDS_DATASET)],
        "output_file": str(output_path),
        "grain": "one row per business-month",
        "features": ENGINEERED_COLUMNS,
        "feature_definitions": {
            "outage_severity": "outage_hours / (operating_hours * calendar days in month)",
        },
        "target_policy": "Final chronological row per business is retained with next_month_energy_cost = null.",
        "leakage_precaution": "Target is calculated with a chronological within-business lead only.",
        **report,
    }
    with report_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)


def main() -> None:
    businesses, energy_records = load_inputs()
    frame = build_feature_dataset(businesses, energy_records)
    report = validate_output(frame)
    write_output(frame, report)
    print(f"Engineered rows: {report['rows']}")
    print(f"Engineered columns: {report['columns']}")
    print(f"Target values: {report['target_non_null']} non-null, {report['target_null']} null")
    print(f"Saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
