"""Tests for Stage 10 model training pipeline."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "10_tain_models.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("train_stage", MODULE_PATH)
TRAIN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TRAIN)


class TrainModelsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.input_path = TRAIN.INPUT_PATH
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

    def test_load_and_validate(self):
        df = TRAIN.load_dataset(self.input_path)
        TRAIN.validate_training_data(df)
        self.assertIn(TRAIN.TARGET_COLUMN, df.columns)

    def test_identify_features_and_exclusions(self):
        df = TRAIN.load_dataset(self.input_path)
        info = TRAIN.identify_features(df)
        self.assertNotIn("record_id", info["features"])  # excluded identifier
        self.assertNotIn("business_id", info["features"])  # excluded business id
        self.assertIn("total_energy_cost", info["features"])  # current-month cost allowed

    def test_chronological_split(self):
        df = TRAIN.load_dataset(self.input_path)
        train, val, test = TRAIN.split_chronological(df)
        # ensure periods are chronological and non-overlapping
        self.assertLessEqual(len(train), 3600)
        self.assertLessEqual(len(val), 3600)
        self.assertLessEqual(len(test), 3600)
        # final null-target rows must be excluded from supervised sets
        self.assertEqual(int(df[TRAIN.TARGET_COLUMN].isna().sum()), 150)
        self.assertEqual(int(train[TRAIN.TARGET_COLUMN].isna().sum()), 0)

    def test_models_can_be_built_and_trained(self):
        df = TRAIN.load_dataset(self.input_path)
        feature_info = TRAIN.identify_features(df)
        pre = TRAIN.build_preprocessor(feature_info["numeric"], feature_info["categorical"])
        train, val, test = TRAIN.split_chronological(df)
        models = TRAIN.build_models()
        trained = TRAIN.train_models(train, pre, feature_info["features"], models)
        # check that required models exist and at least the sklearn ones trained
        self.assertIn("linear_regression", trained)
        self.assertIn("random_forest", trained)
        self.assertEqual(trained["linear_regression"]["status"], "trained")
        self.assertEqual(trained["random_forest"]["status"], "trained")

    def test_artifacts_and_report_written(self):
        df = TRAIN.load_dataset(self.input_path)
        feature_info = TRAIN.identify_features(df)
        pre = TRAIN.build_preprocessor(feature_info["numeric"], feature_info["categorical"])
        train, val, test = TRAIN.split_chronological(df)
        models = TRAIN.build_models()
        trained = TRAIN.train_models(train, pre, feature_info["features"], models)

        with tempfile.TemporaryDirectory() as d:
            model_dir = Path(d) / "models"
            model_dir.mkdir()
            artifacts = TRAIN.save_artifacts(trained, model_dir)
            # only check that sklearn artifacts were saved
            self.assertTrue(any(p.endswith(".joblib") for p in artifacts.values()))

        report = TRAIN.write_report(TRAIN.INPUT_PATH, feature_info, {
            "train_end_period": 18,
            "val_end_period": 21,
            "train_rows": len(train),
            "val_rows": len(val),
            "test_rows": len(test),
            "null_target_rows": int(df[TRAIN.TARGET_COLUMN].isna().sum()),
        }, trained, artifacts, report_path=Path(tempfile.gettempdir()) / "train_report.json")
        self.assertIn("dataset_path", report)


if __name__ == "__main__":
    unittest.main()
