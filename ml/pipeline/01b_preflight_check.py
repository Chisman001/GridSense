"""
GridSense AI

01b - Preflight Check

Validate feature-selection.yaml, raw dataset availability, environment requirements,
and report preflight health before the pipeline runs.
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

try:
    import pandas as pd
except ImportError:  # pragma: no cover
    pd = None

from config import (
    RAW_DATA_DIR,
    REPORTS_DIR,
    VALIDATION_REPORT_DIR,
)
from utils import (
    ensure_directory,
    print_section,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "configs" / "feature-selection.yaml"
TEXT_REPORT_PATH = VALIDATION_REPORT_DIR / "feature_validation_report.txt"
JSON_REPORT_PATH = VALIDATION_REPORT_DIR / "feature_validation.json"

REQUIRED_PACKAGES = {
    "pandas": "pandas",
    "numpy": "numpy",
    "openpyxl": "openpyxl",
    "pyyaml": "yaml",
    "tabulate": "tabulate",
    "scikit-learn": "sklearn",
    "matplotlib": "matplotlib",
    "joblib": "joblib",
}
SUPPORTED_PYTHON = (3, 10)


class DuplicateKeySafeLoader(yaml.SafeLoader if yaml else object):
    pass


def _construct_mapping(loader, node, deep=False):
    if not hasattr(loader, "duplicate_keys"):
        loader.duplicate_keys = []

    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            loader.duplicate_keys.append(key)
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


if yaml:
    DuplicateKeySafeLoader.add_constructor(
        yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
        _construct_mapping,
    )


def is_package_available(import_name: str) -> bool:
    return importlib.util.find_spec(import_name) is not None


def python_version_supported() -> bool:
    return sys.version_info >= SUPPORTED_PYTHON


def load_yaml_with_duplicates(path: Path):
    if yaml is None:
        return None, [], "PyYAML is not installed"

    try:
        with open(path, "r", encoding="utf-8") as f:
            loader = DuplicateKeySafeLoader(f)
            loader.duplicate_keys = []
            config = loader.get_single_data()

        return config or {}, list(dict.fromkeys(loader.duplicate_keys)), None
    except FileNotFoundError:
        return None, [], "feature-selection.yaml not found"
    except yaml.YAMLError as exc:
        return None, [], str(exc)


def load_dataset_columns(path: Path):
    if pd is None:
        raise RuntimeError("pandas is not installed")

    if path.suffix.lower() == ".txt":
        return pd.read_csv(path, sep=";", nrows=0, low_memory=False).columns.tolist()

    return pd.read_csv(path, nrows=0).columns.tolist()


def validate_environment():
    ensure_directory(VALIDATION_REPORT_DIR)

    env_errors = []
    env_warnings = []

    if not CONFIG_PATH.exists():
        env_errors.append("Feature YAML config is missing.")

    if not RAW_DATA_DIR.exists():
        env_errors.append("Raw dataset folder is missing.")

    if not VALIDATION_REPORT_DIR.exists():
        env_errors.append("Validation report folder cannot be created.")

    if not python_version_supported():
        env_errors.append(
            f"Unsupported Python version: {sys.version_info.major}.{sys.version_info.minor}. "
            f"Python {SUPPORTED_PYTHON[0]}.{SUPPORTED_PYTHON[1]}+ is required."
        )

    if not os.access(VALIDATION_REPORT_DIR, os.W_OK):
        env_errors.append("No write permission for report directory.")

    missing_packages = [
        pkg_name
        for pkg_name, import_name in REQUIRED_PACKAGES.items()
        if not is_package_available(import_name)
    ]
    if missing_packages:
        env_errors.append(
            "Missing required packages: " + ", ".join(missing_packages)
        )

    return {
        "config_valid": CONFIG_PATH.exists(),
        "datasets_folder_exists": RAW_DATA_DIR.exists(),
        "output_folder_exists": VALIDATION_REPORT_DIR.exists(),
        "python_version_supported": python_version_supported(),
        "packages_ok": len(missing_packages) == 0,
        "missing_packages": missing_packages,
        "errors": env_errors,
        "warnings": env_warnings,
    }


def validate_feature_selection():
    validation = {
        "dataset_reports": [],
        "duplicate_dataset_names": [],
        "files_checked": 0,
        "columns_checked": 0,
        "errors": 0,
        "warnings": 0,
        "yaml_error": None,
    }

    config, duplicate_keys, parse_error = load_yaml_with_duplicates(CONFIG_PATH)
    validation["duplicate_dataset_names"] = duplicate_keys

    if parse_error:
        validation["yaml_error"] = parse_error
        validation["errors"] += 1
        return validation

    datasets = (config or {}).get("datasets", {})

    for dataset_name, dataset_config in datasets.items():
        report = {
            "dataset": dataset_name,
            "status": "PASS",
            "columns_checked": 0,
            "missing_columns": [],
            "warnings": [],
            "errors": [],
        }

        validation["files_checked"] += 1

        if not isinstance(dataset_config, dict):
            report["status"] = "FAIL"
            report["errors"].append("Invalid dataset configuration.")
            validation["errors"] += 1
            validation["dataset_reports"].append(report)
            continue

        if "file" not in dataset_config:
            report["status"] = "FAIL"
            report["errors"].append("Missing file entry.")
            validation["errors"] += 1
            validation["dataset_reports"].append(report)
            continue

        filename = dataset_config["file"]
        dataset_path = RAW_DATA_DIR / filename

        if not dataset_path.exists():
            report["status"] = "FAIL"
            report["errors"].append("File missing.")
            validation["errors"] += 1
            validation["dataset_reports"].append(report)
            continue

        if pd is None:
            report["status"] = "FAIL"
            report["errors"].append("pandas is not installed.")
            validation["errors"] += 1
            validation["dataset_reports"].append(report)
            continue

        try:
            dataset_columns = load_dataset_columns(dataset_path)
        except Exception as exc:
            report["status"] = "FAIL"
            report["errors"].append(f"Unable to read dataset: {exc}")
            validation["errors"] += 1
            validation["dataset_reports"].append(report)
            continue

        keep = dataset_config.get("keep", [])
        if keep is None:
            keep = []

        if isinstance(keep, str):
            keep = [keep]

        if not isinstance(keep, list):
            report["status"] = "FAIL"
            report["errors"].append("Keep list must be a YAML sequence.")
            validation["errors"] += 1
            validation["dataset_reports"].append(report)
            continue

        report["columns_checked"] = len(keep)
        validation["columns_checked"] += len(keep)

        if len(keep) == 0:
            report["warnings"].append("No selected features.")
            validation["warnings"] += 1

        duplicates = [
            feature
            for feature in sorted(set(keep))
            if keep.count(feature) > 1
        ]
        if duplicates:
            report["warnings"].append(
                "Duplicate feature(s): " + ", ".join(duplicates)
            )
            validation["warnings"] += 1

        missing_columns = [
            column
            for column in keep
            if column not in dataset_columns
        ]
        if missing_columns:
            report["status"] = "FAIL"
            report["missing_columns"] = missing_columns
            report["errors"].append(
                "Missing Columns: " + ", ".join(missing_columns)
            )
            validation["errors"] += len(missing_columns)

        try:
            row_count = pd.read_csv(
                dataset_path,
                sep=";" if dataset_path.suffix.lower() == ".txt" else ",",
                low_memory=False,
            ).shape[0]
            if row_count == 0:
                report["warnings"].append("Empty dataset.")
                validation["warnings"] += 1
        except Exception:
            pass

        validation["dataset_reports"].append(report)

    return validation


def format_console_report(env_report, validation):
    print_section("VALIDATING FEATURE SELECTION")
    print("Checking:\n")

    if validation["yaml_error"]:
        print(f"❌ YAML parse error: {validation['yaml_error']}")
    else:
        for report in validation["dataset_reports"]:
            prefix = "✓" if report["status"] == "PASS" else "❌"
            print(f"{prefix} {report['dataset']}")

    if validation["duplicate_dataset_names"]:
        print("\nDuplicate dataset names found:")
        for duplicate in validation["duplicate_dataset_names"]:
            print(f" - {duplicate}")

    print("\n" + "-" * 40)
    print("Validation Complete\n")
    print(f"Files Checked:\n{validation['files_checked']}\n")
    print(f"Columns Checked:\n{validation['columns_checked']}\n")
    print(f"Warnings:\n{validation['warnings']}\n")
    print(f"Errors:\n{validation['errors']}\n")
    print("Status:\nPASS" if validation["errors"] == 0 and not env_report["errors"] else "Status:\nFAIL")

    print_section("PREFLIGHT CHECK")
    checklist = [
        ("Config valid", env_report["config_valid"]),
        ("Datasets found", env_report["datasets_folder_exists"]),
        ("Feature YAML valid", validation["yaml_error"] is None),
        ("Output folders exist", env_report["output_folder_exists"]),
        ("Required packages installed", env_report["packages_ok"]),
        ("Disk write permissions", len(env_report["errors"]) == 0 or env_report["output_folder_exists"] and os.access(VALIDATION_REPORT_DIR, os.W_OK)),
        ("Python version supported", env_report["python_version_supported"]),
    ]
    for label, ok in checklist:
        print(f"{'✓' if ok else '❌'} {label}")

    if env_report["missing_packages"]:
        print("\nMissing Packages:")
        for package in env_report["missing_packages"]:
            print(f" - {package}")

    if env_report["errors"]:
        print("\nEnvironment Errors:")
        for error in env_report["errors"]:
            print(f" - {error}")

    print()


def write_text_report(validation):
    ensure_directory(VALIDATION_REPORT_DIR)

    lines = [
        "GridSense AI",
        "",
        "Feature Validation Report",
        "",
    ]

    if validation["yaml_error"]:
        lines.extend([
            "Status:",
            "FAIL",
            "",
            "YAML Error:",
            validation["yaml_error"],
            "",
        ])
    else:
        for report in validation["dataset_reports"]:
            lines.extend([
                "Dataset:",
                report["dataset"],
                "",
                "Status:",
                report["status"],
                "",
                "Columns Checked:",
                str(report["columns_checked"]),
                "Missing Columns:",
                str(len(report["missing_columns"])),
                "Warnings:",
                str(len(report["warnings"])),
                "",
                "-" * 40,
                "",
            ])

    TEXT_REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def write_json_report(validation):
    ensure_directory(VALIDATION_REPORT_DIR)

    summary = {
        "status": "PASS" if validation["errors"] == 0 else "FAIL",
        "datasets_checked": validation["files_checked"],
        "errors": validation["errors"],
        "warnings": validation["warnings"],
        "generated": datetime.now().strftime("%Y-%m-%d"),
    }
    JSON_REPORT_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")


def main():
    ensure_directory(VALIDATION_REPORT_DIR)
    env_report = validate_environment()
    validation = validate_feature_selection()

    format_console_report(env_report, validation)
    write_text_report(validation)
    write_json_report(validation)

    if env_report["errors"]:
        print("Preflight failed due to environment issues.")
        sys.exit(1)

    if validation["errors"] > 0:
        print("Preflight failed due to validation errors.")
        sys.exit(1)

    print(f"Reports written to: {VALIDATION_REPORT_DIR}")
    sys.exit(0)


if __name__ == "__main__":
    main()
