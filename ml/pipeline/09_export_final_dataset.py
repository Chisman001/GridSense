"""Stage 09: publish the validated engineered dataset as the final ML dataset."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from config import CSV_SEPARATOR, DEFAULT_ENCODING, FINAL_DATA_DIR, PROCESSED_DATA_DIR, REPORTS_DIR

INPUT_PATH = PROCESSED_DATA_DIR / "engineered_energy_records.csv"
OUTPUT_PATH = FINAL_DATA_DIR / "energy_records.csv"
REPORT_PATH = REPORTS_DIR / "export" / "final_dataset_export_report.json"
EXPECTED_ROWS = 3600
EXPECTED_COLUMNS = [
    "record_id",
    "business_id",
    "month",
    "year",
    "electricity_bill",
    "diesel_cost",
    "petrol_cost",
    "generator_hours",
    "grid_hours",
    "outage_hours",
    "energy_consumption_kwh",
    "fuel_consumption_liters",
    "maintenance_cost",
    "weather_avg_temp",
    "occupancy_rate",
    "total_energy_cost",
    "business_name",
    "business_type",
    "industry",
    "state",
    "city",
    "employees",
    "operating_hours",
    "floor_area_sqm",
    "energy_source",
    "solar_capacity_kw",
    "monthly_revenue",
    "created_at",
    "quarter",
    "cost_per_kwh",
    "energy_cost_per_employee",
    "generator_dependency",
    "revenue_energy_ratio",
    "outage_severity",
    "estimated_carbon_intensity",
    "next_month_energy_cost",
]
EXPECTED_BUSINESSES = 150
EXPECTED_MONTHS_PER_BUSINESS = 24
EXPECTED_TARGET_NON_NULL = 3450
EXPECTED_TARGET_NULL = 150
TARGET_COLUMN = "next_month_energy_cost"


def _current_timestamp() -> str:
    return datetime.now().isoformat()


def _safe_load_csv(path: Path) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(f"Input dataset not found: {path}")
    try:
        return pd.read_csv(path, sep=CSV_SEPARATOR, encoding=DEFAULT_ENCODING, mangle_dupe_cols=False)
    except TypeError:
        return pd.read_csv(path, sep=CSV_SEPARATOR, encoding=DEFAULT_ENCODING)


def _duplicate_columns(frame: pd.DataFrame) -> list[str]:
    columns = list(frame.columns)
    return sorted({column for column in columns if columns.count(column) > 1})


def _validate_numeric_infinities(frame: pd.DataFrame) -> int:
    numeric = frame.select_dtypes(include=[np.number])
    if numeric.empty:
        return 0
    return int(np.isinf(numeric.to_numpy(dtype=float)).sum())


def _validate_source(frame: pd.DataFrame) -> dict[str, object]:
    if _duplicate_columns(frame):
        raise ValueError("Input dataset contains duplicate column names.")

    if list(frame.columns) != EXPECTED_COLUMNS:
        missing = [col for col in EXPECTED_COLUMNS if col not in frame.columns]
        extra = [col for col in frame.columns if col not in EXPECTED_COLUMNS]
        if missing or extra:
            raise ValueError(
                f"Input dataset schema mismatch. Missing columns: {missing}. Unexpected columns: {extra}."
            )

    if len(frame) != EXPECTED_ROWS:
        raise ValueError(f"Input dataset must contain exactly {EXPECTED_ROWS} rows, found {len(frame)}.")

    unique_business_count = int(frame["business_id"].nunique(dropna=True))
    if unique_business_count != EXPECTED_BUSINESSES:
        raise ValueError(
            f"Input dataset must contain exactly {EXPECTED_BUSINESSES} unique businesses, found {unique_business_count}."
        )

    if not frame["record_id"].is_unique:
        raise ValueError("Input dataset contains duplicate record_id values.")

    if frame.duplicated(["business_id", "year", "month"]).any():
        raise ValueError("Input dataset contains duplicate (business_id, year, month) keys.")

    counts = frame.groupby("business_id").size()
    if not (counts == EXPECTED_MONTHS_PER_BUSINESS).all():
        invalid = counts[counts != EXPECTED_MONTHS_PER_BUSINESS].to_dict()
        raise ValueError(
            f"Input dataset must contain {EXPECTED_MONTHS_PER_BUSINESS} records per business, but some businesses differ: {invalid}."
        )

    non_null = int(frame[TARGET_COLUMN].notna().sum())
    null = int(frame[TARGET_COLUMN].isna().sum())
    if non_null != EXPECTED_TARGET_NON_NULL or null != EXPECTED_TARGET_NULL:
        raise ValueError(
            f"Input dataset target counts must be {EXPECTED_TARGET_NON_NULL} non-null and {EXPECTED_TARGET_NULL} null, found {non_null} non-null and {null} null."
        )

    infinite_count = _validate_numeric_infinities(frame)
    if infinite_count:
        raise ValueError(f"Input dataset contains {infinite_count} infinite numeric value(s).")

    return {
        "rows": len(frame),
        "columns": len(frame.columns),
        "unique_businesses": unique_business_count,
        "duplicate_record_id_count": int(frame["record_id"].duplicated().sum()),
        "duplicate_business_month_count": int(frame.duplicated(["business_id", "year", "month"]).sum()),
        "target_non_null": non_null,
        "target_null": null,
    }


def _validate_export_integrity(input_frame: pd.DataFrame, output_frame: pd.DataFrame) -> dict[str, object]:
    input_cols = list(input_frame.columns)
    output_cols = list(output_frame.columns)
    if input_cols != output_cols:
        raise ValueError("Exported dataset has different column names or order than the input dataset.")

    if len(output_frame) != len(input_frame):
        raise ValueError("Exported dataset has a different row count than the input dataset.")

    try:
        pd.testing.assert_frame_equal(
            input_frame,
            output_frame,
            check_dtype=True,
            check_exact=False,
            rtol=1e-9,
            atol=0.0,
            check_column_type=True,
        )
    except AssertionError as exc:
        if not output_frame["record_id"].is_unique:
            raise ValueError("Exported dataset contains duplicate record_id values after export.") from exc
        if output_frame.duplicated(["business_id", "year", "month"]).any():
            raise ValueError("Exported dataset contains duplicate (business_id, year, month) keys after export.") from exc
        raise ValueError(
            "Exported dataset differs from the input dataset after write/read round-trip. "
            f"Details: {exc}"
        ) from exc

    return {
        "rows": len(output_frame),
        "columns": len(output_frame.columns),
        "unique_businesses": int(output_frame["business_id"].nunique(dropna=True)),
        "duplicate_record_id_count": int(output_frame["record_id"].duplicated().sum()),
        "duplicate_business_month_count": int(output_frame.duplicated(["business_id", "year", "month"]).sum()),
        "target_non_null": int(output_frame[TARGET_COLUMN].notna().sum()),
        "target_null": int(output_frame[TARGET_COLUMN].isna().sum()),
    }


def _build_report(
    input_path: Path,
    output_path: Path,
    source_metadata: dict[str, object],
    export_metadata: dict[str, object],
) -> dict[str, object]:
    return {
        "export_timestamp": _current_timestamp(),
        "input_file": str(input_path),
        "output_file": str(output_path),
        "rows": source_metadata["rows"],
        "columns": source_metadata["columns"],
        "unique_businesses": source_metadata["unique_businesses"],
        "target": TARGET_COLUMN,
        "target_non_null": source_metadata["target_non_null"],
        "target_null": source_metadata["target_null"],
        "input_column_count": source_metadata["columns"],
        "output_column_count": export_metadata["columns"],
        "duplicate_record_id_count": export_metadata["duplicate_record_id_count"],
        "duplicate_business_month_count": export_metadata["duplicate_business_month_count"],
        "export_integrity_result": "PASS",
        "validation": "PASS",
    }


def _write_report(report: dict[str, object], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding=DEFAULT_ENCODING) as file:
        json.dump(report, file, indent=2)


def export_final_dataset(
    input_path: Path = INPUT_PATH,
    output_path: Path = OUTPUT_PATH,
    report_path: Path = REPORT_PATH,
) -> dict[str, object]:
    frame = _safe_load_csv(input_path)
    source_metadata = _validate_source(frame)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False)

    exported = _safe_load_csv(output_path)
    export_metadata = _validate_export_integrity(frame, exported)

    report = _build_report(input_path, output_path, source_metadata, export_metadata)
    _write_report(report, report_path)
    return report


def main() -> None:
    report = export_final_dataset()
    print("Final dataset export complete.")
    print(f"Input: {report['input_file']}")
    print(f"Output: {report['output_file']}")
    print(f"Rows: {report['rows']}")
    print(f"Columns: {report['columns']}")
    print(f"Target non-null: {report['target_non_null']}")
    print(f"Target null: {report['target_null']}")
    print(f"Report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
