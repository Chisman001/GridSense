"""
GridSense AI

Base cleaner framework with lifecycle hooks and validation registry.
"""

from pathlib import Path
from typing import Any

import pandas as pd

from cleaning.common import (
    standardize_column_names,
    trim_strings,
    replace_missing_values,
    remove_empty_rows,
    remove_duplicates,
    convert_numeric_columns,
    convert_datetime_columns,
    validate_numeric_range,
    validate_categories,
    validate_unique_ids,
    validate_datetime_column,
    validate_duplicate_timestamps,
    validate_required_columns,
    validate_ratio,
    start_timer,
    stop_timer,
)
from cleaning.core.metrics import CleaningMetrics
from cleaning.core.validators import ValidatorRegistry
from cleaning.core.reports import generate_report


class BaseCleaner:

    def __init__(
        self,
        dataset_name: str,
        dataset_path: Path,
        rules: dict,
    ):
        self.dataset_name = dataset_name
        self.dataset_path = dataset_path
        self.rules = rules
        self.warnings = []
        self.metrics = CleaningMetrics()
        self.validator_registry = ValidatorRegistry()

        self.validator_registry.register(self.validate_required_columns)
        self.validator_registry.register(self.validate_ranges)
        self.validator_registry.register(self.validate_categories)
        self.validator_registry.register(self.validate_id_checks)
        self.validator_registry.register(self.validate_datetime_columns)
        self.validator_registry.register(self.validate_ratio_checks)
        self.validator_registry.register(self.validate_duplicate_timestamps)

    def before_load(self):
        return None

    def load_dataframe(self) -> pd.DataFrame:
        self.before_load()
        df = pd.read_csv(self.dataset_path)
        return self.after_load(df)

    def after_load(self, df: pd.DataFrame) -> pd.DataFrame:
        return df

    def preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        df = standardize_column_names(df)

        if self.rules.get("trim_strings", True):
            df = trim_strings(df)

        if self.rules.get("replace_missing_values", True):
            df = replace_missing_values(df)

        if self.rules.get("remove_empty_rows", True):
            df, self.metrics.empty_rows_removed = remove_empty_rows(df)

        if self.rules.get("remove_duplicates", True):
            df, self.metrics.duplicates_removed = remove_duplicates(df)

        df = convert_numeric_columns(
            df,
            self.rules.get("numeric_columns", []),
        )

        return df

    def before_validation(self, df: pd.DataFrame) -> pd.DataFrame:
        return df

    def after_cleaning(self, df: pd.DataFrame) -> pd.DataFrame:
        return df

    def final_validation(self, df: pd.DataFrame) -> pd.DataFrame:
        return df

    def save(self, df: pd.DataFrame) -> pd.DataFrame:
        return df

    def custom_cleaning(self, df: pd.DataFrame) -> pd.DataFrame:
        return df

    def feature_engineering(self, df: pd.DataFrame) -> pd.DataFrame:
        return df

    def post_validation(self, df: pd.DataFrame) -> pd.DataFrame:
        return df

    def validate_required_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        required_columns = self.rules.get("required_columns", [])

        if not required_columns:
            return df

        missing, warning = validate_required_columns(df, required_columns)

        self.metrics.details["Missing Required Columns"] = len(missing)

        if warning:
            self.warnings.append(warning)

        return df

    def validate_ranges(self, df: pd.DataFrame) -> pd.DataFrame:
        for column, limits in self.rules.get("ranges", {}).items():
            if column not in df.columns:
                continue

            before = len(df)

            df = validate_numeric_range(
                df,
                column,
                minimum=limits.get("min"),
                maximum=limits.get("max"),
            )

            removed = before - len(df)

            if removed > 0:
                self.metrics.details[f"{column} Range Violations"] = removed
                self.warnings.append(
                    f"{removed} rows removed for {column} outside defined range"
                )

        return df

    def validate_categories(self, df: pd.DataFrame) -> pd.DataFrame:
        for column, valid_values in self.rules.get("categories", {}).items():
            df, invalid_count, invalid_values, warning = validate_categories(
                df,
                column,
                valid_values,
            )

            self.metrics.details[f"Invalid {column}"] = invalid_count

            if warning:
                self.warnings.append(warning)

        return df

    def validate_id_checks(self, df: pd.DataFrame) -> pd.DataFrame:
        id_columns = set(
            self.rules.get("duplicate_checks", {}).get("unique_ids", []) or []
        )
        id_columns.update(self.rules.get("id_columns", []) or [])

        for column in id_columns:
            count, warning = validate_unique_ids(df, column)

            self.metrics.details[f"Duplicate {column}"] = count

            if warning:
                self.warnings.append(warning)

        return df

    def validate_datetime_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        df = convert_datetime_columns(
            df,
            self.rules.get("datetime_columns", []),
        )

        for column in self.rules.get("datetime_columns", []):
            df, invalid_count, warning = validate_datetime_column(df, column)

            self.metrics.details[f"Invalid {column}"] = invalid_count

            if warning:
                self.warnings.append(warning)

        return df

    def validate_ratio_checks(self, df: pd.DataFrame) -> pd.DataFrame:
        for check in self.rules.get("ratio_checks", []):
            numerator = check.get("numerator")
            denominator = check.get("denominator")
            maximum_ratio = check.get("maximum_ratio")
            description = check.get("description", "ratio check")

            if not numerator or not denominator or maximum_ratio is None:
                continue

            count, warning = validate_ratio(
                df,
                numerator,
                denominator,
                maximum_ratio=maximum_ratio,
                description=description,
            )

            self.metrics.details[f"Suspicious {description}"] = count

            if warning:
                self.warnings.append(warning)

        return df

    def validate_duplicate_timestamps(self, df: pd.DataFrame) -> pd.DataFrame:
        timestamp_rules = self.rules.get("duplicate_checks", {}).get("timestamps", {})

        timestamp_column = timestamp_rules.get("timestamp_column")

        if not timestamp_column:
            return df

        id_column = timestamp_rules.get("id_column")

        count, warning = validate_duplicate_timestamps(
            df,
            timestamp_column,
            id_column,
        )

        self.metrics.details["Duplicate Timestamps"] = count

        if warning:
            self.warnings.append(warning)

        return df

    def compute_status(self):
        if self.metrics.rows_after == 0:
            self.metrics.status = "FAIL"
        elif self.warnings:
            self.metrics.status = "WARNING"
        else:
            self.metrics.status = "PASS"

    def _normalize_summary_value(self, value):
        if isinstance(value, (bool, str, float, type(None))):
            return value
        if isinstance(value, (int,)):
            return value
        try:
            return int(value)
        except Exception:
            try:
                return float(value)
            except Exception:
                return str(value)

    def build_summary(self) -> dict:
        self.metrics.rows_before = self.metrics.rows_before or self.rows_before
        self.metrics.rows_after = self.metrics.rows_after or self.rows_after
        self.metrics.warnings_count = len(self.warnings)

        summary = {
            "Dataset": self.dataset_name,
            "Rows Before": self._normalize_summary_value(self.metrics.rows_before),
            "Rows After": self._normalize_summary_value(self.metrics.rows_after),
            "Duplicates Removed": self._normalize_summary_value(self.metrics.duplicates_removed),
            "Empty Rows Removed": self._normalize_summary_value(self.metrics.empty_rows_removed),
            "Warnings": self._normalize_summary_value(self.metrics.warnings_count),
            "Execution Time (s)": self._normalize_summary_value(self.metrics.execution_time),
            "Status": self.metrics.status,
        }

        normalized_details = {
            key: self._normalize_summary_value(value)
            for key, value in self.metrics.details.items()
        }

        summary.update(normalized_details)

        return summary

    def clean(self):
        start = start_timer()

        df = self.load_dataframe()

        self.rows_before = len(df)
        self.metrics.rows_before = self.rows_before

        df = self.preprocess(df)

        df = self.custom_cleaning(df)
        df = self.after_cleaning(df)

        df = self.before_validation(df)

        for validator in self.validator_registry.validators():
            df = validator(df)

        df = self.post_validation(df)
        df = self.final_validation(df)

        self.rows_after = len(df)
        self.metrics.rows_after = self.rows_after

        self.metrics.execution_time = stop_timer(start)
        self.compute_status()

        report_text = generate_report(
            dataset=self.dataset_name,
            before=self.metrics.rows_before,
            after=self.metrics.rows_after,
            duplicates=self.metrics.duplicates_removed,
            empty_rows=self.metrics.empty_rows_removed,
            status=self.metrics.status,
            warnings=self.warnings,
            execution_time=self.metrics.execution_time,
        )

        df = self.save(df)

        return df, {
            "text": report_text,
            "summary": self.build_summary(),
        }
