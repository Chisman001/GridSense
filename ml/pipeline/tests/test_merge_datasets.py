"""Focused unit tests for the Stage 05 controlled merge."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest

import pandas as pd


MODULE_PATH = Path(__file__).resolve().parents[1] / "05_merge_datasets.py"
SPEC = importlib.util.spec_from_file_location("merge_stage", MODULE_PATH)
MERGE_STAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MERGE_STAGE)


class MergeStageTests(unittest.TestCase):
    def test_build_dataset_frame_preserves_provenance_and_parses_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            source_dir = Path(directory)
            pd.DataFrame({"when": ["2024-01-01 00:00:00"], "usage": [2.5]}).to_csv(
                source_dir / "source.csv", index=False
            )
            previous_dir = MERGE_STAGE.STANDARDIZED_DATA_DIR
            MERGE_STAGE.STANDARDIZED_DATA_DIR = source_dir
            try:
                frame, report = MERGE_STAGE._build_dataset_frame(
                    "sample",
                    {
                        "source_file": "source.csv",
                        "source_grain": "time_series_reading",
                        "mapping": {"when": "timestamp", "usage": "energy_consumption"},
                    },
                    ["dataset_source", "source_grain", "source_row_id", "timestamp", "energy_consumption"],
                )
            finally:
                MERGE_STAGE.STANDARDIZED_DATA_DIR = previous_dir

        self.assertEqual(report["status"], "PASS")
        self.assertEqual(frame.loc[0, "dataset_source"], "sample")
        self.assertEqual(frame.loc[0, "source_row_id"], 1)
        self.assertTrue(pd.api.types.is_datetime64_any_dtype(frame["timestamp"]))

    def test_build_dataset_frame_rejects_duplicate_targets(self):
        frame, report = MERGE_STAGE._build_dataset_frame(
            "sample",
            {"source_file": "unused.csv", "source_grain": "test", "mapping": {"a": "x", "b": "x"}},
            ["dataset_source", "source_grain", "source_row_id", "x"],
        )
        self.assertIsNone(frame)
        self.assertEqual(report["status"], "FAILED")
        self.assertIn("same target", report["error"])


if __name__ == "__main__":
    unittest.main()
