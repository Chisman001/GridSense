"""Tests for Stage 11 model evaluation."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
import unittest
import time

MODULE_PATH = Path(__file__).resolve().parents[1] / "11_evaluate_models.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("eval_stage", MODULE_PATH)
EVAL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EVAL)


class ModelEvaluationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.input_path = EVAL.INPUT_PATH
        if not self.input_path.is_file():
            # Attempt to regenerate the final CSV using Stage 09 export if available.
            export_mod_path = Path(__file__).resolve().parents[1] / "09_export_final_dataset.py"
            if export_mod_path.is_file():
                import importlib.util as il

                spec = il.spec_from_file_location("export_stage", export_mod_path)
                mod = il.module_from_spec(spec)
                spec.loader.exec_module(mod)
                mod.export_final_dataset()
        self.assertTrue(self.input_path.is_file(), f"Final dataset not found: {self.input_path}")
        # record model artifact mtimes to ensure evaluation doesn't modify them
        self.model_files = {p.name: p.stat().st_mtime for p in Path(EVAL.MODELS_DIR).glob("*.joblib")}

    def test_split_membership_and_counts(self):
        df = EVAL.load_dataset(self.input_path)
        train_ids, val_ids, test_ids, source = EVAL.get_split_membership(df)
        # Ensure disjoint
        self.assertTrue(train_ids.isdisjoint(val_ids))
        self.assertTrue(train_ids.isdisjoint(test_ids))
        self.assertTrue(val_ids.isdisjoint(test_ids))
        # Ensure supervised rows match
        supervised = df[df[EVAL.TARGET_COLUMN].notna()]
        total_assigned = len(train_ids) + len(val_ids) + len(test_ids)
        self.assertEqual(total_assigned, len(supervised))
        # null-target rows must be excluded
        self.assertEqual(int(df[EVAL.TARGET_COLUMN].isna().sum()), 150)

    def test_models_loaded_and_evaluated(self):
        report = EVAL.load_training_report()
        models = EVAL.load_models_from_report(report)
        # All expected model keys present
        for k in ("linear_regression", "random_forest", "xgboost", "lightgbm"):
            self.assertIn(k, models)

    def test_evaluate_creates_outputs_and_metrics(self):
        # run evaluation
        eval_report = EVAL.evaluate()
        # report file exists
        self.assertTrue(EVAL.EVAL_REPORT.is_file())
        # predictions CSV exists (may be empty if no preds)
        self.assertTrue(EVAL.PREDICTIONS_CSV.is_file())

        # validation_metrics present
        v = eval_report.get("validation_metrics")
        self.assertIsInstance(v, dict)
        # selected_model must be one of the evaluated models or None
        sel = eval_report.get("selected_model")
        if sel is not None:
            self.assertIn(sel, v)

        # test_metrics must be present when a model was selected
        if sel is not None:
            self.assertIsNotNone(eval_report.get("test_metrics"))

        # ensure model artifacts were not modified
        for name, mtime in self.model_files.items():
            path = Path(EVAL.MODELS_DIR) / name
            self.assertTrue(path.exists())
            self.assertEqual(path.stat().st_mtime, mtime)


if __name__ == "__main__":
    unittest.main()
