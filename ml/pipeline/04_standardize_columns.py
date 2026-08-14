"""Stage 04: standardize cleaned dataset schemas without merging datasets."""

from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
import re

import pandas as pd
import yaml


# Paths are relative to ``ml/pipeline/04_standardize_columns.py``.
PIPELINE_DIR = Path(__file__).resolve().parent
ML_ROOT = PIPELINE_DIR.parent
DATA_DIR = ML_ROOT / "datasets"
CLEANED_DATA_DIR = DATA_DIR / "cleaned"
STANDARDIZED_DATA_DIR = DATA_DIR / "standardized"
CONFIG_DIR = ML_ROOT / "configs"
COLUMN_MAPPING_PATH = CONFIG_DIR / "column_mapping.yaml"
REPORT_DIR = ML_ROOT / "reports" / "standardization"

# Cleaning writes files using their source filename, not their dataset key.
DATASET_FILES = {
    "test_energy": "test_energy_data.csv",
    "energy_consumption": "energy_consumption.csv",
    "energy_complete": "energydata_complete.csv",
    "smart_meter": "smart_meter_data.csv",
    "household": "household_power_consumption.csv",
    "cbecs": "cbecs2018_final_public.csv",
}


def ensure_output_directories() -> None:
    """Create only the directories owned by this stage."""
    STANDARDIZED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


def load_column_mapping() -> dict:
    """Load and validate the column-standardization configuration."""
    if not COLUMN_MAPPING_PATH.is_file():
        raise FileNotFoundError(
            f"Column mapping configuration not found: {COLUMN_MAPPING_PATH}"
        )

    with COLUMN_MAPPING_PATH.open(encoding="utf-8") as file:
        config = yaml.safe_load(file) or {}

    if not isinstance(config, dict):
        raise ValueError("Column mapping configuration must be a mapping.")
    return config


def normalize_column_key(column: object) -> str:
    """Return a predictable, snake_case key for matching column names."""
    value = str(column).strip().lower()
    value = re.sub(r"[\s./-]+", "_", value)
    value = re.sub(r"[()\[\]]", "", value)
    return re.sub(r"_+", "_", value).strip("_")


def _unique_normalized_columns(columns) -> dict[str, str]:
    """Build a lookup and reject ambiguous source columns early."""
    lookup: dict[str, str] = {}
    for column in columns:
        key = normalize_column_key(column)
        if key in lookup and lookup[key] != column:
            raise ValueError(
                "Ambiguous columns after normalization: "
                f"{lookup[key]!r} and {column!r}."
            )
        lookup[key] = column
    return lookup


def standardize_columns(df: pd.DataFrame, mapping: dict) -> tuple[pd.DataFrame, int, list[str]]:
    """Rename configured columns while retaining all unconfigured columns."""
    rename_rules = mapping.get("rename", {}) or {}
    if not isinstance(rename_rules, dict):
        raise ValueError("The 'rename' configuration must be a mapping.")

    lookup = _unique_normalized_columns(df.columns)
    rename_map: dict[str, str] = {}
    matched_sources: set[str] = set()

    for source, target in rename_rules.items():
        actual_source = lookup.get(normalize_column_key(source))
        if actual_source is None:
            continue
        target = normalize_column_key(target)
        if actual_source != target:
            rename_map[actual_source] = target
        matched_sources.add(actual_source)

    targets = list(rename_map.values())
    unchanged_columns = [column for column in df.columns if column not in rename_map]
    collisions = set(targets) & {normalize_column_key(column) for column in unchanged_columns}
    if len(targets) != len(set(targets)) or collisions:
        raise ValueError(f"Column rename would create duplicate columns: {sorted(collisions)}")

    standardized = df.rename(columns=rename_map)
    unmapped = [column for column in df.columns if column not in matched_sources]
    return standardized, len(rename_map), unmapped


def normalize_remaining_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize unmapped names and reject any resulting duplicate columns."""
    normalized = [normalize_column_key(column) for column in df.columns]
    duplicates = sorted({name for name in normalized if normalized.count(name) > 1})
    if duplicates:
        raise ValueError(f"Duplicate columns after normalization: {duplicates}")
    result = df.copy()
    result.columns = normalized
    return result


def create_datetime_column(df: pd.DataFrame, datetime_config: dict) -> tuple[pd.DataFrame, int, int]:
    """Create a timestamp from a configured date/time pair and count parse failures."""
    combine = (datetime_config or {}).get("combine", {}) or {}
    date_column = normalize_column_key(combine.get("date_column", ""))
    time_column = normalize_column_key(combine.get("time_column", ""))
    output_column = normalize_column_key(combine.get("output_column", "timestamp"))
    if not date_column or not time_column or date_column not in df or time_column not in df:
        return df, 0, 0

    combined = df[date_column].astype("string") + " " + df[time_column].astype("string")
    timestamp = pd.to_datetime(
        combined,
        errors="coerce",
        dayfirst=bool(combine.get("dayfirst", False)),
    )
    df = df.copy()
    df[output_column] = timestamp
    return df, 1, int(timestamp.isna().sum())


def standardize_categories(df: pd.DataFrame, category_config: dict) -> tuple[pd.DataFrame, int]:
    """Apply case- and whitespace-insensitive configured category mappings."""
    changes = 0
    df = df.copy()
    for column, mappings in (category_config or {}).items():
        column = normalize_column_key(column)
        if column not in df or not isinstance(mappings, dict):
            continue
        lookup = {str(key).strip().casefold(): value for key, value in mappings.items()}
        original = df[column].astype("string")
        normalized = original.str.strip().str.casefold()
        replacement = normalized.map(lookup)
        result = original.where(replacement.isna(), replacement)
        changes += int((original.fillna("<NA>") != result.fillna("<NA>")).sum())
        df[column] = result
    return df, changes


def standardize_dataset(dataset_name: str, config: dict) -> dict:
    """Standardize one dataset and return a complete, serializable outcome."""
    filename = DATASET_FILES[dataset_name]
    input_path = CLEANED_DATA_DIR / filename
    output_path = STANDARDIZED_DATA_DIR / filename
    report = {"dataset": dataset_name, "input": str(input_path), "output": str(output_path)}

    if not input_path.is_file():
        return report | {"status": "MISSING", "message": "Cleaned input file was not found."}

    try:
        df = pd.read_csv(input_path)
        rows_before, columns_before = len(df), len(df.columns)
        dataset_config = config.get(dataset_name, {}) or {}
        df, renamed_count, unmapped = standardize_columns(df, dataset_config)
        df = normalize_remaining_column_names(df)
        df, datetime_created, datetime_parse_failures = create_datetime_column(
            df, dataset_config.get("datetime", {})
        )
        df, category_changes = standardize_categories(df, dataset_config.get("categories", {}))
        if "timestamp" in df:
            df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df.to_csv(output_path, index=False)
    except (OSError, pd.errors.ParserError, ValueError) as error:
        return report | {"status": "FAILED", "message": str(error)}

    return report | {
        "status": "PASS",
        "rows_before": rows_before,
        "rows_after": len(df),
        "columns_before": columns_before,
        "columns_after": len(df.columns),
        "columns_renamed": renamed_count,
        "datetime_created": datetime_created,
        "datetime_parse_failures": datetime_parse_failures,
        "category_changes": category_changes,
        "unmapped_columns": unmapped,
        "timestamp": datetime.now().isoformat(),
    }


def main() -> None:
    ensure_output_directories()
    config = load_column_mapping()
    reports = [standardize_dataset(name, config) for name in DATASET_FILES]

    pd.DataFrame(reports).to_csv(REPORT_DIR / "standardization_summary.csv", index=False)
    with (REPORT_DIR / "standardization_report.json").open("w", encoding="utf-8") as file:
        json.dump(reports, file, indent=2, default=str)

    for report in reports:
        print(f"{report['dataset']}: {report['status']}")
        if report["status"] != "PASS":
            print(f"  {report['message']}")


if __name__ == "__main__":
    main()
