"""Tests for Stage 09 final dataset export."""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest

import pandas as pd

MODULE_PATH = Path(__file__).resolve().parents[1] / "09_export_final_dataset.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("export_stage", MODULE_PATH)
EXPORT_STAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXPORT_STAGE)


class ExportFinalDatasetTests(unittest.TestCase):
    def setUp(self) -> None:
        self.input_path = EXPORT_STAGE.INPUT_PATH
        self.output_path = EXPORT_STAGE.OUTPUT_PATH
        self.report_path = EXPORT_STAGE.REPORT_PATH
        self.assertTrue(self.input_path.is_file(), f"Stage 09 input file does not exist: {self.input_path}")
        if self.output_path.exists():
            self.output_path.unlink()
        if self.report_path.exists():
            self.report_path.unlink()

    def test_export_creates_output_and_report(self):
        report = EXPORT_STAGE.export_final_dataset(
            input_path=self.input_path,
            output_path=self.output_path,
            report_path=self.report_path,
        )

        self.assertTrue(self.output_path.is_file(), "Final output file was not created.")
        self.assertTrue(self.report_path.is_file(), "Export report file was not created.")
        self.assertEqual(report["rows"], 3600)
        self.assertEqual(report["columns"], len(EXPORT_STAGE.EXPECTED_COLUMNS))
        self.assertEqual(report["unique_businesses"], 150)
        self.assertEqual(report["target_non_null"], 3450)
        self.assertEqual(report["target_null"], 150)

    def test_output_schema_is_exact(self):
        EXPORT_STAGE.export_final_dataset(
            input_path=self.input_path,
            output_path=self.output_path,
            report_path=self.report_path,
        )
        output = pd.read_csv(self.output_path)
        self.assertEqual(list(output.columns), EXPORT_STAGE.EXPECTED_COLUMNS)
        self.assertEqual(len(output.columns), len(EXPORT_STAGE.EXPECTED_COLUMNS))

    def test_record_id_uniqueness(self):
        EXPORT_STAGE.export_final_dataset(
            input_path=self.input_path,
            output_path=self.output_path,
            report_path=self.report_path,
        )
        output = pd.read_csv(self.output_path)
        self.assertTrue(output["record_id"].is_unique)

    def test_business_year_month_uniqueness(self):
        EXPORT_STAGE.export_final_dataset(
            input_path=self.input_path,
            output_path=self.output_path,
            report_path=self.report_path,
        )
        output = pd.read_csv(self.output_path)
        self.assertFalse(output.duplicated(["business_id", "year", "month"]).any())

    def test_export_is_deterministic(self):
        with tempfile.TemporaryDirectory() as first_dir, tempfile.TemporaryDirectory() as second_dir:
            first_output = Path(first_dir) / "energy_records.csv"
            second_output = Path(second_dir) / "energy_records.csv"
            first_report = Path(first_dir) / "report.json"
            second_report = Path(second_dir) / "report.json"

            first = EXPORT_STAGE.export_final_dataset(
                input_path=self.input_path,
                output_path=first_output,
                report_path=first_report,
            )
            second = EXPORT_STAGE.export_final_dataset(
                input_path=self.input_path,
                output_path=second_output,
                report_path=second_report,
            )

            self.assertTrue(first_output.is_file())
            self.assertTrue(second_output.is_file())
            self.assertTrue(first_report.is_file())
            self.assertTrue(second_report.is_file())
            self.assertEqual(first_output.read_bytes(), second_output.read_bytes())
            self.assertEqual(
                {
                    k: first[k]
                    for k in ["rows", "columns", "unique_businesses", "target_non_null", "target_null"]
                },
                {
                    k: second[k]
                    for k in ["rows", "columns", "unique_businesses", "target_non_null", "target_null"]
                },
            )

    def test_does_not_require_stage05_datasets(self):
        stage05_files = [
            Path("ml/datasets/merged/time_series_energy_records.csv"),
            Path("ml/datasets/merged/cross_sectional_energy_records.csv"),
            Path("ml/datasets/merged/cbecs_building_survey.csv"),
        ]
        for path in stage05_files:
            self.assertFalse(path.exists() and path.samefile(self.input_path), f"Stage 09 should not depend on {path}")

    def tearDown(self) -> None:
        if self.output_path.exists():
            self.output_path.unlink()
        if self.report_path.exists():
            self.report_path.unlink()


if __name__ == "__main__":
    unittest.main()
