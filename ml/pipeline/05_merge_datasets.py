"""Stage 05: build controlled, grain-specific analytical datasets.

Time-series readings, cross-sectional observations, and the CBECS building
survey are kept separate.  This avoids treating unlike observations as though
they were directly comparable rows in one master table.
"""

from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path

import pandas as pd
import yaml


PIPELINE_DIR = Path(__file__).resolve().parent
ML_ROOT = PIPELINE_DIR.parent
STANDARDIZED_DATA_DIR = ML_ROOT / "datasets" / "standardized"
MERGED_DATA_DIR = ML_ROOT / "datasets" / "merged"
CONFIG_DIR = ML_ROOT / "configs"
MERGE_CONFIG_PATH = CONFIG_DIR / "merge_mapping.yaml"
REPORT_DIR = ML_ROOT / "reports" / "merge"


def ensure_output_directories() -> None:
    """Create only directories owned by this stage."""
    MERGED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


def load_merge_config() -> dict:
    """Load the explicit, grain-aware merge configuration."""
    if not MERGE_CONFIG_PATH.is_file():
        raise FileNotFoundError(f"Merge configuration not found: {MERGE_CONFIG_PATH}")
    with MERGE_CONFIG_PATH.open(encoding="utf-8") as file:
        config = yaml.safe_load(file) or {}
    if not isinstance(config, dict) or not isinstance(config.get("outputs"), dict):
        raise ValueError("merge_mapping.yaml must define an 'outputs' mapping.")
    return config


def _validate_output_config(name: str, output_config: dict) -> tuple[str, list[str]]:
    filename = output_config.get("filename")
    columns = output_config.get("columns")
    if not isinstance(filename, str) or not filename.endswith(".csv"):
        raise ValueError(f"Output {name!r} must define a CSV filename.")
    if not isinstance(columns, list) or not columns or len(columns) != len(set(columns)):
        raise ValueError(f"Output {name!r} must define unique columns.")
    required = {"dataset_source", "source_grain", "source_row_id"}
    if not required.issubset(columns):
        raise ValueError(f"Output {name!r} is missing provenance columns: {sorted(required - set(columns))}")
    return filename, columns


def _build_dataset_frame(dataset_name: str, dataset_config: dict, output_columns: list[str]) -> tuple[pd.DataFrame | None, dict]:
    """Map one source into an output schema without manufacturing fields."""
    source_file = dataset_config.get("source_file")
    source_grain = dataset_config.get("source_grain")
    mapping = dataset_config.get("mapping", {}) or {}
    input_path = STANDARDIZED_DATA_DIR / str(source_file)
    report = {
        "dataset": dataset_name,
        "input_path": str(input_path),
        "source_grain": source_grain,
        "status": "FAILED",
        "warnings": [],
    }

    if not isinstance(source_file, str) or not isinstance(source_grain, str) or not isinstance(mapping, dict):
        report["error"] = "Dataset configuration requires source_file, source_grain, and mapping."
        return None, report
    if len(mapping.values()) != len(set(mapping.values())):
        report["error"] = "Multiple source columns map to the same target column."
        return None, report
    invalid_targets = sorted(set(mapping.values()) - set(output_columns))
    if invalid_targets:
        report["error"] = f"Mapping targets are not in the output schema: {invalid_targets}"
        return None, report
    if not input_path.is_file():
        report["status"] = "MISSING"
        report["error"] = "Standardized input file was not found."
        return None, report

    try:
        source = pd.read_csv(input_path)
    except (OSError, pd.errors.ParserError, UnicodeDecodeError) as error:
        report["error"] = str(error)
        return None, report

    report["rows_before"] = len(source)
    report["columns_before"] = len(source.columns)
    missing_sources = sorted(set(mapping) - set(source.columns))
    if missing_sources:
        report["error"] = f"Expected standardized columns are missing: {missing_sources}"
        return None, report

    result = pd.DataFrame(pd.NA, index=source.index, columns=output_columns)
    for source_column, target_column in mapping.items():
        result[target_column] = source[source_column]
    result["dataset_source"] = dataset_name
    result["source_grain"] = source_grain
    result["source_row_id"] = range(1, len(source) + 1)

    timestamp_invalid = 0
    timestamp_duplicates = 0
    if "timestamp" in output_columns and "timestamp" in mapping.values():
        parsed = pd.to_datetime(result["timestamp"], errors="coerce")
        timestamp_invalid = int(parsed.isna().sum())
        timestamp_duplicates = int(parsed.duplicated().sum())
        result["timestamp"] = parsed
        if timestamp_invalid:
            report["warnings"].append(f"{timestamp_invalid} unparseable timestamp value(s).")
        if timestamp_duplicates:
            report["warnings"].append(f"{timestamp_duplicates} duplicate timestamp value(s) retained.")

    missing_common = [column for column in output_columns if result[column].isna().all()]
    report.update({
        "status": "PASS",
        "rows_contributed": len(result),
        "columns_mapped": list(mapping.values()),
        "missing_common_fields": missing_common,
        "timestamp_invalid": timestamp_invalid,
        "duplicate_timestamps": timestamp_duplicates,
    })
    return result, report


def merge_output(output_name: str, output_config: dict) -> tuple[pd.DataFrame, list[dict], dict]:
    """Build one output at a single analytical grain."""
    filename, columns = _validate_output_config(output_name, output_config)
    dataset_configs = output_config.get("datasets", {})
    if not isinstance(dataset_configs, dict) or not dataset_configs:
        raise ValueError(f"Output {output_name!r} must define at least one dataset.")

    frames: list[pd.DataFrame] = []
    reports: list[dict] = []
    for dataset_name, dataset_config in dataset_configs.items():
        frame, report = _build_dataset_frame(dataset_name, dataset_config or {}, columns)
        reports.append(report | {"output": output_name})
        if frame is not None:
            frames.append(frame)

    if not frames:
        raise RuntimeError(f"No datasets could be merged into {output_name!r}.")
    merged = pd.concat(frames, ignore_index=True)
    if list(merged.columns) != columns or merged.columns.duplicated().any():
        raise ValueError(f"Output {output_name!r} does not match its configured schema.")

    all_null_columns = [column for column in columns if merged[column].isna().all()]
    output_report = {
        "output": output_name,
        "output_path": str(MERGED_DATA_DIR / filename),
        "rows": len(merged),
        "columns": len(merged.columns),
        "all_null_columns": all_null_columns,
        "status": "WARNING" if any(r["status"] != "PASS" for r in reports) else "PASS",
    }
    return merged, reports, output_report


def run_merge(config: dict) -> tuple[dict[str, pd.DataFrame], list[dict], list[dict]]:
    """Create every configured grain-specific output in deterministic order."""
    outputs: dict[str, pd.DataFrame] = {}
    dataset_reports: list[dict] = []
    output_reports: list[dict] = []
    for output_name, output_config in config["outputs"].items():
        frame, reports, output_report = merge_output(output_name, output_config or {})
        outputs[output_name] = frame
        dataset_reports.extend(reports)
        output_reports.append(output_report)
    return outputs, dataset_reports, output_reports


def write_reports(dataset_reports: list[dict], output_reports: list[dict]) -> None:
    """Write human-readable CSV and machine-readable JSON merge reports."""
    pd.DataFrame(dataset_reports).to_csv(REPORT_DIR / "merge_summary.csv", index=False)
    report = {
        "generated_at": datetime.now().isoformat(),
        "outputs": output_reports,
        "datasets": dataset_reports,
    }
    with (REPORT_DIR / "merge_report.json").open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2, default=str)


def main() -> None:
    ensure_output_directories()
    config = load_merge_config()
    outputs, dataset_reports, output_reports = run_merge(config)
    for output_name, frame in outputs.items():
        filename = config["outputs"][output_name]["filename"]
        frame.to_csv(MERGED_DATA_DIR / filename, index=False)
    write_reports(dataset_reports, output_reports)

    for report in output_reports:
        print(f"{report['output']}: {report['status']} ({report['rows']:,} rows)")


if __name__ == "__main__":
    main()
