"""Stage 08: comprehensive validation for engineered business-month dataset."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from config import CSV_SEPARATOR, DEFAULT_ENCODING, PROCESSED_DATA_DIR, VALIDATION_REPORT_DIR

INPUT_PATH = PROCESSED_DATA_DIR / "engineered_energy_records.csv"
REPORT_PATH = VALIDATION_REPORT_DIR / "dataset_validation_report.json"
EXPECTED_BUSINESSES = 150
EXPECTED_MONTHS_PER_BUSINESS = 24

REQUIRED_IDENTIFIERS = ["business_id", "record_id", "year", "month"]
REQUIRED_TARGETS = ["next_month_energy_cost"]
REQUIRED_ENGINEERED_FEATURES = [
    "quarter",
    "cost_per_kwh",
    "energy_cost_per_employee",
    "generator_dependency",
    "revenue_energy_ratio",
    "outage_severity",
    "estimated_carbon_intensity",
    "next_month_energy_cost",
]
REQUIRED_SCHEDULE_FEATURES = ["quarter"]
REQUIRED_NUMERIC_FIELDS = [
    "electricity_bill",
    "diesel_cost",
    "petrol_cost",
    "generator_hours",
    "grid_hours",
    "outage_hours",
    "energy_consumption_kwh",
    "fuel_consumption_liters",
    "maintenance_cost",
    "total_energy_cost",
    "monthly_revenue",
    "employees",
    "floor_area_sqm",
    "solar_capacity_kw",
]
RANGE_FIELDS = {
    "employees": (lambda s: s > 0, "Employees must be greater than zero."),
    "operating_hours": (lambda s: s > 0, "Operating hours must be greater than zero."),
    "electricity_bill": (lambda s: s >= 0, "Electricity bill must be non-negative."),
    "diesel_cost": (lambda s: s >= 0, "Diesel cost must be non-negative."),
    "petrol_cost": (lambda s: s >= 0, "Petrol cost must be non-negative."),
    "generator_hours": (lambda s: s >= 0, "Generator hours must be non-negative."),
    "grid_hours": (lambda s: s >= 0, "Grid hours must be non-negative."),
    "outage_hours": (lambda s: s >= 0, "Outage hours must be non-negative."),
    "energy_consumption_kwh": (lambda s: s >= 0, "Energy consumption must be non-negative."),
    "fuel_consumption_liters": (lambda s: s >= 0, "Fuel consumption must be non-negative."),
    "maintenance_cost": (lambda s: s >= 0, "Maintenance cost must be non-negative."),
    "total_energy_cost": (lambda s: s >= 0, "Total energy cost must be non-negative."),
    "monthly_revenue": (lambda s: s >= 0, "Monthly revenue must be non-negative."),
    "solar_capacity_kw": (lambda s: s >= 0, "Solar capacity must be non-negative."),
    "occupancy_rate": (lambda s: s.between(0, 100), "Occupancy rate must be between 0 and 100."),
    "quarter": (lambda s: s.between(1, 4), "Quarter must be between 1 and 4."),
    "month": (lambda s: s.between(1, 12), "Month must be between 1 and 12."),
}

FORMULA_DEFINITIONS = {
    "cost_per_kwh": ("total_energy_cost", "energy_consumption_kwh"),
    "energy_cost_per_employee": ("total_energy_cost", "employees"),
    "generator_dependency": ("generator_hours", ["generator_hours", "grid_hours"]),
    "revenue_energy_ratio": ("monthly_revenue", "total_energy_cost"),
    "outage_severity": ("outage_hours", ["operating_hours", "days_in_month"]),
    "estimated_carbon_intensity": ("fuel_consumption_liters", "energy_consumption_kwh"),
}

SUSPICIOUS_TARGET_KEYWORDS = ["next_", "future_", "lead", "target"]

NUMERIC_TOLERANCE = {"rtol": 1e-6, "atol": 1e-8}


def _current_timestamp() -> str:
    return datetime.now().isoformat()


def _safe_load_csv(path: Path) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(f"Input dataset not found: {path}")
    try:
        return pd.read_csv(path, sep=CSV_SEPARATOR, encoding=DEFAULT_ENCODING, mangle_dupe_cols=False)
    except TypeError:
        return pd.read_csv(path, sep=CSV_SEPARATOR, encoding=DEFAULT_ENCODING)


def _is_blank(series: pd.Series) -> pd.Series:
    if series.dtype == object or pd.api.types.is_string_dtype(series):
        return series.isna() | (series.astype(str).str.strip() == "")
    return series.isna()


def _safe_divide(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    denominator = denominator.mask(denominator == 0)
    with np.errstate(divide="ignore", invalid="ignore"):
        result = numerator / denominator
    return result.replace([np.inf, -np.inf], np.nan)


def _numeric(series: pd.Series | pd.DataFrame) -> pd.Series | pd.DataFrame:
    if isinstance(series, pd.DataFrame):
        return series.apply(pd.to_numeric, errors="coerce")
    return pd.to_numeric(series, errors="coerce")


def _expected_next_month(year: int, month: int) -> tuple[int, int]:
    if month == 12:
        return year + 1, 1
    return year, month + 1


def _match_series(actual: pd.Series, expected: pd.Series) -> pd.Series:
    actual_num = _numeric(actual).astype(float)
    expected_num = _numeric(expected).astype(float)
    defined = actual_num.notna() & expected_num.notna()
    result = pd.Series(False, index=actual.index)
    if defined.any():
        result.loc[defined] = np.isclose(
            actual_num.loc[defined],
            expected_num.loc[defined],
            **NUMERIC_TOLERANCE,
        )
    result |= actual_num.isna() & expected_num.isna()
    return result


def _collect_distribution(frame: pd.DataFrame, columns: list[str]) -> dict[str, dict[str, float]]:
    distribution = {}
    for column in columns:
        if column not in frame.columns:
            continue
        numeric = _numeric(frame[column])
        if numeric.notna().empty:
            continue
        distribution[column] = {
            "min": float(numeric.min(skipna=True)),
            "max": float(numeric.max(skipna=True)),
            "mean": float(numeric.mean(skipna=True)),
            "median": float(numeric.median(skipna=True)),
            "std": float(numeric.std(skipna=True)),
        }
    return distribution


def _category_distribution(frame: pd.DataFrame, column: str, top_n: int = 10) -> dict[str, int]:
    if column not in frame.columns:
        return {}
    counts = frame[column].fillna("<NULL>").astype(str).value_counts().head(top_n)
    return counts.to_dict()


def validate(frame: pd.DataFrame, expected_businesses: int = EXPECTED_BUSINESSES, expected_months: int = EXPECTED_MONTHS_PER_BUSINESS) -> tuple[dict, bool]:
    report: dict[str, object] = {
        "validation_timestamp": _current_timestamp(),
        "row_count": int(len(frame)),
        "column_count": int(len(frame.columns)),
        "input_path": str(INPUT_PATH),
        "business_count": int(frame["business_id"].nunique(dropna=True)) if "business_id" in frame.columns else 0,
        "date_range": {},
        "checks": {
            "passed": [],
            "failed": [],
            "warnings": [],
        },
        "null_counts": {},
        "duplicate_counts": {},
        "invalid_range_counts": {},
        "formula_mismatch_counts": {},
        "target_checks": {},
        "leakage_checks": {},
        "distribution": {},
    }

    failures: list[str] = []
    warnings: list[str] = []
    passed: list[str] = []

    columns = list(frame.columns)
    duplicate_columns = [col for col in columns if columns.count(col) > 1]
    duplicate_columns = sorted(set(duplicate_columns))
    report["duplicate_counts"]["duplicate_column_names"] = duplicate_columns
    if duplicate_columns:
        failures.append("Duplicate column names detected.")
    else:
        passed.append("No duplicate column names.")

    required_columns = set(REQUIRED_IDENTIFIERS + REQUIRED_TARGETS + REQUIRED_ENGINEERED_FEATURES + REQUIRED_SCHEDULE_FEATURES)
    missing_columns = sorted(required_columns - set(columns))
    report["checks"]["required_columns"] = {
        "required": sorted(required_columns),
        "missing": missing_columns,
        "present": sorted(set(columns) & required_columns),
    }
    if missing_columns:
        failures.append(f"Missing required columns: {missing_columns}.")
    else:
        passed.append("All required Stage 07 columns are present.")

    empty_columns = [col for col in columns if _is_blank(frame[col]).all()]
    report["checks"]["empty_columns"] = empty_columns
    if empty_columns:
        failures.append(f"Completely empty columns found: {empty_columns}.")
    else:
        passed.append("No completely empty columns.")

    if "business_id" in frame.columns:
        business_id_missing = int(_is_blank(frame["business_id"]).sum())
    else:
        business_id_missing = 0
    if "record_id" in frame.columns:
        record_id_missing = int(_is_blank(frame["record_id"]).sum())
    else:
        record_id_missing = 0
    report["null_counts"]["business_id_missing"] = business_id_missing
    report["null_counts"]["record_id_missing"] = record_id_missing
    if business_id_missing:
        failures.append("Null or blank business_id values found.")
    else:
        passed.append("business_id is non-null for all rows.")
    if record_id_missing:
        failures.append("Null or blank record_id values found.")
    else:
        passed.append("record_id is non-null for all rows.")

    month_numeric = _numeric(frame["month"]) if "month" in frame.columns else pd.Series(dtype=float)
    year_numeric = _numeric(frame["year"]) if "year" in frame.columns else pd.Series(dtype=float)
    month_invalid = month_numeric.isna() | ~month_numeric.between(1, 12)
    year_invalid = year_numeric.isna() | (year_numeric % 1 != 0)
    report["invalid_range_counts"]["invalid_months"] = int(month_invalid.sum())
    report["invalid_range_counts"]["invalid_years"] = int(year_invalid.sum())
    if int(month_invalid.sum()):
        failures.append("Invalid month values detected.")
    else:
        passed.append("All month values are valid 1-12.")
    if int(year_invalid.sum()):
        failures.append("Invalid year values detected.")
    else:
        passed.append("All year values are valid integers.")

    if "business_id" in frame.columns:
        business_counts = frame.groupby("business_id", sort=False).size()
        business_count = int(business_counts.size)
        rows_per_business = business_counts.to_dict()
        exact_business_count = business_count == expected_businesses
        report["business_count"] = business_count
        report["checks"]["business_rows_per_business"] = rows_per_business
        if exact_business_count:
            passed.append(f"Expected {expected_businesses} unique businesses found.")
        else:
            failures.append(f"Expected {expected_businesses} unique businesses, found {business_count}.")
        abnormal_business_counts = {bid: int(count) for bid, count in business_counts.items() if count != expected_months}
        if abnormal_business_counts:
            failures.append("Some businesses do not have the expected number of month records.")
            report["checks"]["businesses_with_unexpected_record_counts"] = abnormal_business_counts
        else:
            passed.append(f"Each business has exactly {expected_months} records.")
    else:
        report["business_count"] = 0
        failures.append("business_id column is missing, so business-grain checks cannot be completed.")

    duplicate_record_id_count = int(frame["record_id"].duplicated().sum()) if "record_id" in frame.columns else 0
    duplicate_biz_month_count = int(frame.duplicated(["business_id", "year", "month"]).sum()) if {"business_id", "year", "month"}.issubset(frame.columns) else 0
    report["duplicate_counts"]["record_id"] = duplicate_record_id_count
    report["duplicate_counts"]["business_month"] = duplicate_biz_month_count
    if duplicate_record_id_count:
        failures.append("Duplicate record_id values found.")
    else:
        passed.append("No duplicate record_id values.")
    if duplicate_biz_month_count:
        failures.append("Duplicate business-month keys found.")
    else:
        passed.append("No duplicate business-month keys found.")

    if {"business_id", "year", "month"}.issubset(frame.columns):
        chronology_issues: dict[str, int] = {
            "missing_months": 0,
            "duplicate_business_months": 0,
            "invalid_business_chronology": 0,
        }
        missing_businesses: list[str] = []
        duplicate_business_months = 0
        invalid_business_orders = 0
        for business_id, group in frame.groupby("business_id", sort=False):
            group = group.copy()
            group = group.assign(
                year_numeric=_numeric(group["year"]).astype(float),
                month_numeric=_numeric(group["month"]).astype(float),
            )
            group = group.sort_values(["year_numeric", "month_numeric"], kind="stable")
            if int(group.duplicated(["year", "month"]).sum()):
                duplicate_business_months += 1
            seq = group["year_numeric"] * 12 + group["month_numeric"]
            diff = seq.diff().iloc[1:]
            if not diff.dropna().eq(1).all() or len(group) != expected_months:
                invalid_business_orders += 1
            if len(group) != expected_months:
                missing_businesses.append(str(business_id))
        chronology_issues["duplicate_business_months"] = duplicate_business_months
        chronology_issues["invalid_business_chronology"] = invalid_business_orders
        chronology_issues["businesses_with_missing_months"] = len(missing_businesses)
        report["checks"]["chronology"] = chronology_issues
        if duplicate_business_months:
            failures.append("Some businesses have duplicate year-month combinations.")
        if invalid_business_orders:
            failures.append("Some businesses do not have a contiguous 24-month period.")
        if not duplicate_business_months and not invalid_business_orders:
            passed.append("All businesses have valid contiguous 24-month business-month sequences.")
    else:
        report["checks"]["chronology"] = {}

    report["null_counts"]["columns"] = frame.isna().sum().to_dict()

    numeric_fields = [col for col in REQUIRED_NUMERIC_FIELDS if col in frame.columns]
    numeric_series = {col: _numeric(frame[col]) for col in numeric_fields}
    negative_counts = {col: int((series < 0).sum()) for col, series in numeric_series.items()}
    report["invalid_range_counts"]["negative_values"] = negative_counts
    if any(negative_counts.values()):
        failures.append("Negative numeric values found in energy/cost fields.")
    else:
        passed.append("No negative values found in required numeric energy/cost fields.")

    infinite_count = int(np.isinf(_numeric(frame.select_dtypes(include=[np.number])).to_numpy(dtype=float)).sum())
    report["invalid_range_counts"]["infinite_values"] = infinite_count
    if infinite_count:
        failures.append("Infinite numeric values found.")
    else:
        passed.append("No infinite numeric values found.")

    range_violations: dict[str, int] = {}
    for column, (predicate, _) in RANGE_FIELDS.items():
        if column not in frame.columns:
            continue
        series = _numeric(frame[column]) if column not in {"occupancy_rate", "quarter", "month"} else _numeric(frame[column])
        invalid = ~predicate(series)
        invalid = invalid.fillna(True)
        if int(invalid.sum()):
            range_violations[column] = int(invalid.sum())
    report["invalid_range_counts"]["range_violations"] = range_violations
    if range_violations:
        failures.append("Range validation failed for one or more features.")
    else:
        passed.append("All feature ranges are valid.")

    generated_formula_mismatches: dict[str, int] = {}
    if all(col in frame.columns for col in ["total_energy_cost", "energy_consumption_kwh", "employees", "generator_hours", "grid_hours", "monthly_revenue", "outage_hours", "operating_hours", "fuel_consumption_liters"]):
        days_in_month = pd.to_datetime(
            {
                "year": frame["year"].astype(float),
                "month": frame["month"].astype(float),
                "day": 1,
            },
            errors="coerce",
        ).dt.days_in_month

        expected_formula: dict[str, pd.Series] = {
            "cost_per_kwh": _safe_divide(frame["total_energy_cost"], frame["energy_consumption_kwh"]),
            "energy_cost_per_employee": _safe_divide(frame["total_energy_cost"], frame["employees"]),
            "generator_dependency": _safe_divide(frame["generator_hours"], frame["generator_hours"] + frame["grid_hours"]),
            "revenue_energy_ratio": _safe_divide(frame["monthly_revenue"], frame["total_energy_cost"]),
            "outage_severity": _safe_divide(frame["outage_hours"], frame["operating_hours"] * days_in_month),
            "estimated_carbon_intensity": _safe_divide(frame["fuel_consumption_liters"], frame["energy_consumption_kwh"]),
        }
        for column, expected in expected_formula.items():
            if column not in frame.columns:
                continue
            actual = frame[column]
            matches = _match_series(actual, expected)
            mismatch_count = int((~matches).sum())
            generated_formula_mismatches[column] = mismatch_count
            if mismatch_count:
                failures.append(f"Formula validation failed for {column} on {mismatch_count} rows.")
            else:
                passed.append(f"Formula validation passed for {column}.")
    else:
        generated_formula_mismatches = {column: None for column in FORMULA_DEFINITIONS}
        warnings.append("Not all inputs were available to validate engineered formulas.")
    report["formula_mismatch_counts"] = generated_formula_mismatches

    if {"total_energy_cost", "electricity_bill", "diesel_cost", "petrol_cost"}.issubset(frame.columns):
        total_expected = frame["electricity_bill"] + frame["diesel_cost"] + frame["petrol_cost"]
        cost_match = _match_series(frame["total_energy_cost"], total_expected)
        cost_mismatch_count = int((~cost_match).sum())
        report["target_checks"]["cost_consistency_mismatch_count"] = cost_mismatch_count
        if cost_mismatch_count:
            failures.append("Cost consistency validation failed for total_energy_cost.")
        else:
            passed.append("Total energy cost is consistent with electricity, diesel, and petrol costs.")
    else:
        report["target_checks"]["cost_consistency_mismatch_count"] = None
        warnings.append("Cannot validate cost consistency because required cost columns are missing.")

    if "next_month_energy_cost" in frame.columns and {"business_id", "year", "month", "total_energy_cost"}.issubset(frame.columns):
        ordered = frame.sort_values(["business_id", "year", "month"], kind="stable").reset_index(drop=True)
        actual_target = _numeric(ordered["next_month_energy_cost"])
        expected_target = ordered.groupby("business_id", sort=False)["total_energy_cost"].shift(-1)
        target_matches = _match_series(actual_target, expected_target)
        mismatch_mask = ~target_matches & ordered.groupby("business_id", sort=False)["total_energy_cost"].shift(-1).notna()
        mismatch_count = int(mismatch_mask.sum())
        null_count = int(actual_target.isna().sum())
        non_null_count = int(actual_target.notna().sum())
        target_final_rows = ordered.groupby("business_id", sort=False).tail(1).index
        final_non_null_targets = int(actual_target.loc[target_final_rows].notna().sum())
        non_final_null_targets = int(actual_target.loc[~ordered.index.isin(target_final_rows)].isna().sum())
        next_year = ordered.groupby("business_id", sort=False)["year"].shift(-1)
        next_month = ordered.groupby("business_id", sort=False)["month"].shift(-1)
        expected_next_year = ordered["year"].astype(int).copy()
        expected_next_month = ordered["month"].astype(int).copy()
        rollover = expected_next_month == 12
        expected_next_year[rollover] = expected_next_year[rollover] + 1
        expected_next_month[rollover] = 1
        expected_next_year[~rollover] = expected_next_year[~rollover]
        expected_next_month[~rollover] = expected_next_month[~rollover] + 1
        adjacency_violations = int(
            (~next_year.isna()
             & ((next_year != expected_next_year) | (next_month != expected_next_month))).sum()
        )
        report["target_checks"].update({
            "target_null_count": null_count,
            "target_non_null_count": non_null_count,
            "target_mismatch_count": mismatch_count,
            "non_final_null_targets": non_final_null_targets,
            "final_non_null_targets": final_non_null_targets,
            "adjacency_violations": adjacency_violations,
        })
        if null_count != expected_businesses or non_null_count != expected_businesses * (expected_months - 1):
            failures.append(
                f"Target null/non-null counts do not match expected {expected_businesses} null and {expected_businesses * (expected_months - 1)} non-null rows."
            )
        else:
            passed.append("Target null/non-null counts match the expected business-month structure.")
        if final_non_null_targets:
            failures.append("Final business-month records must have null next_month_energy_cost.")
        else:
            passed.append("Final business-month records have null next_month_energy_cost as expected.")
        if non_final_null_targets:
            failures.append("Non-final business-month records contain null next_month_energy_cost.")
        else:
            passed.append("Non-final business-month records have valid next_month_energy_cost values.")
        if mismatch_count:
            failures.append("Target values do not match the next month's total_energy_cost for some rows.")
        else:
            passed.append("Target values match next month's total_energy_cost for all non-final rows.")
        if adjacency_violations:
            failures.append("Some next_month_energy_cost values do not point to the immediately following month.")
        else:
            passed.append("All target values refer to the immediately following chronological month within each business.")
    else:
        report["target_checks"].update({
            "target_null_count": None,
            "target_non_null_count": None,
            "target_mismatch_count": None,
            "non_final_null_targets": None,
            "final_non_null_targets": None,
            "adjacency_violations": None,
        })
        warnings.append("Cannot validate target sequencing because required columns are missing.")

    reported_source_leakage: dict[str, object] = {
        "suspected_future_month_columns": [],
        "duplicate_target_columns": [],
        "documented_target_column": "next_month_energy_cost",
        "engineered_features_documented": REQUIRED_ENGINEERED_FEATURES,
    }
    suspicious_names = [col for col in frame.columns if col != "next_month_energy_cost" and any(keyword in col.lower() for keyword in SUSPICIOUS_TARGET_KEYWORDS)]
    reported_source_leakage["suspected_future_month_columns"] = suspicious_names
    if suspicious_names:
        warnings.append(f"Found suspicious column names that may indicate future-month or target-derived features: {suspicious_names}.")
    numeric_columns = frame.select_dtypes(include=[np.number]).columns.drop("next_month_energy_cost", errors="ignore")
    duplicate_target_columns = []
    if "next_month_energy_cost" in frame.columns:
        target_series = _numeric(frame["next_month_energy_cost"])
        for column in numeric_columns:
            if column == "next_month_energy_cost":
                continue
            candidate = _numeric(frame[column])
            equal_mask = target_series.notna() & candidate.notna() & (target_series == candidate)
            if int(equal_mask.sum()) == int(target_series.notna().sum()) and int(target_series.notna().sum()) > 0:
                duplicate_target_columns.append(column)
    reported_source_leakage["duplicate_target_columns"] = duplicate_target_columns
    if duplicate_target_columns:
        failures.append(f"Column(s) {duplicate_target_columns} duplicate next_month_energy_cost values exactly.")
    else:
        passed.append("No exact duplicate target columns detected.")
    report["leakage_checks"] = reported_source_leakage

    report["distribution"]["numeric_summary"] = _collect_distribution(frame, [
        "electricity_bill",
        "diesel_cost",
        "petrol_cost",
        "generator_hours",
        "grid_hours",
        "outage_hours",
        "energy_consumption_kwh",
        "fuel_consumption_liters",
        "maintenance_cost",
        "total_energy_cost",
        "monthly_revenue",
        "employees",
        "floor_area_sqm",
        "solar_capacity_kw",
        "cost_per_kwh",
        "energy_cost_per_employee",
        "generator_dependency",
        "revenue_energy_ratio",
        "outage_severity",
        "estimated_carbon_intensity",
        "next_month_energy_cost",
    ])
    report["distribution"]["target_distribution"] = {
        "non_null": int(frame["next_month_energy_cost"].notna().sum()) if "next_month_energy_cost" in frame.columns else None,
        "null": int(frame["next_month_energy_cost"].isna().sum()) if "next_month_energy_cost" in frame.columns else None,
    }
    report["distribution"]["business_type"] = _category_distribution(frame, "business_type")
    report["distribution"]["energy_source"] = _category_distribution(frame, "energy_source")

    if {"year", "month"}.issubset(frame.columns):
        valid_dates = ~month_invalid & ~year_invalid
        if valid_dates.any():
            min_year = int(year_numeric[valid_dates].min())
            max_year = int(year_numeric[valid_dates].max())
            min_month = int(month_numeric[valid_dates].min())
            max_month = int(month_numeric[valid_dates].max())
            report["date_range"] = {
                "min_year": min_year,
                "max_year": max_year,
                "min_month": min_month,
                "max_month": max_month,
            }
        else:
            report["date_range"] = {}

    report["passed_checks"] = passed
    report["failed_checks"] = failures
    report["warning_checks"] = warnings
    report["summary_status"] = "PASS" if not failures else "FAIL"
    report["checks"]["total_passed"] = len(passed)
    report["checks"]["total_failed"] = len(failures)
    report["checks"]["total_warnings"] = len(warnings)
    return report, not failures


def write_report(report: dict, path: Path = REPORT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding=DEFAULT_ENCODING) as file:
        json.dump(report, file, indent=2)


def main() -> None:
    try:
        frame = _safe_load_csv(INPUT_PATH)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"Failed to read input dataset: {exc}", file=sys.stderr)
        sys.exit(1)

    report, ok = validate(frame)
    write_report(report)

    print("Dataset validation summary")
    print("==========================")
    print(f"Rows: {report['row_count']}")
    print(f"Columns: {report['column_count']}")
    print(f"Businesses: {report['business_count']}")
    print(f"Date range: {report['date_range']}")
    print(f"Passed checks: {len(report['passed_checks'])}")
    print(f"Failed checks: {len(report['failed_checks'])}")
    print(f"Warnings: {len(report['warning_checks'])}")
    print(f"Report: {REPORT_PATH}")
    if report["failed_checks"]:
        print("Validation failed.")
        sys.exit(1)
    print("Validation passed.")


if __name__ == "__main__":
    main()
