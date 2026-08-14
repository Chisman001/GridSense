"""
Tests for Stage 12 inference/application layer.
"""

from __future__ import annotations

import importlib.util
import json
import unittest
import sys
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
STAGE_12_PATH = PROJECT_ROOT / "pipeline" / "12_inference.py"


def load_stage_12():
    spec = importlib.util.spec_from_file_location(
        "stage12",
        STAGE_12_PATH,
    )

    if spec is None or spec.loader is None:
        raise ImportError(
            f"Could not load Stage 12 from {STAGE_12_PATH}"
        )

    module = importlib.util.module_from_spec(spec)

    # Register the dynamically loaded module before executing it.
    # This is required for dataclasses and other introspection-based
    # features that expect the module to exist in sys.modules.
    sys.modules[spec.name] = module

    spec.loader.exec_module(module)

    return module


stage12 = load_stage_12()


class FakePipeline:
    """Simple pipeline used to verify inference behavior."""

    def __init__(self, prediction=123456.0):
        self.prediction = prediction
        self.predict_calls = 0
        self.fit_calls = 0

    def predict(self, X):
        self.predict_calls += 1
        return np.full(
            shape=(len(X),),
            fill_value=self.prediction,
            dtype=float,
        )

    def fit(self, X, y):
        self.fit_calls += 1
        raise AssertionError(
            "Stage 12 must never call fit()."
        )


class TestInference(unittest.TestCase):

    def test_training_report_contains_feature_contract(self):
        report = stage12.load_training_report()

        features = stage12.get_feature_contract(
            report
        )

        self.assertTrue(features)
        self.assertIsInstance(features, list)

    def test_load_model_does_not_fit(self):
        fake_pipeline = FakePipeline()

        with patch.object(
            stage12.joblib,
            "load",
            return_value=fake_pipeline,
        ) as mock_load:

            loaded = stage12.load_model(
                model_name="lightgbm"
            )

        mock_load.assert_called_once()
        self.assertIs(loaded, fake_pipeline)
        self.assertEqual(
            fake_pipeline.fit_calls,
            0,
        )

    def test_predict_calls_predict_only(self):
        fake_pipeline = FakePipeline(
            prediction=987654.0
        )

        report = stage12.load_training_report()

        features = stage12.get_feature_contract(
            report
        )

        row = {}

        for feature in features:
            if feature in {
                "year",
                "month",
                "quarter",
            }:
                row[feature] = 2025
            else:
                row[feature] = 1.0

        frame = pd.DataFrame([row])

        with patch.object(
            stage12,
            "load_model",
            return_value=fake_pipeline,
        ):

            predictions = stage12.predict(
                frame,
                model_name="lightgbm",
            )

        self.assertEqual(
            fake_pipeline.predict_calls,
            1,
        )

        self.assertEqual(
            fake_pipeline.fit_calls,
            0,
        )

        self.assertEqual(
            len(predictions),
            1,
        )

        self.assertAlmostEqual(
            predictions[0],
            987654.0,
        )

    def test_missing_feature_is_rejected(self):
        report = stage12.load_training_report()

        features = stage12.get_feature_contract(
            report
        )

        frame = pd.DataFrame(
            [
                {
                    feature: 1.0
                    for feature in features[1:]
                }
            ]
        )

        with self.assertRaises(ValueError):
            stage12.clean_input_data(
                frame,
                features,
            )

    def test_empty_input_is_rejected(self):
        report = stage12.load_training_report()

        features = stage12.get_feature_contract(
            report
        )

        frame = pd.DataFrame(
            columns=features
        )

        with self.assertRaises(ValueError):
            stage12.clean_input_data(
                frame,
                features,
            )

    def test_generate_prediction_response(self):
        fake_pipeline = FakePipeline(
            prediction=5_000_000.0
        )

        report = stage12.load_training_report()

        features = stage12.get_feature_contract(
            report
        )

        data = {}

        for feature in features:
            if feature == "year":
                data[feature] = 2025
            elif feature == "month":
                data[feature] = 12
            elif feature == "quarter":
                data[feature] = 4
            else:
                data[feature] = 1.0

        data["total_energy_cost"] = 4_000_000.0
        data["employees"] = 100
        data["monthly_revenue"] = 20_000_000.0
        data["energy_consumption_kwh"] = 50_000.0
        data["generator_hours"] = 100.0
        data["grid_hours"] = 200.0
        data["outage_hours"] = 20.0

        with patch.object(
            stage12,
            "load_model",
            return_value=fake_pipeline,
        ):

            result = stage12.generate_prediction_response(
                data,
                model_name="lightgbm",
            )

        self.assertIn(
            "prediction",
            result,
        )

        self.assertIn(
            "analytics",
            result,
        )

        self.assertIn(
            "llm_context",
            result,
        )

        self.assertEqual(
            result["prediction"]["model"],
            "lightgbm",
        )

        self.assertEqual(
            result["prediction"][
                "predicted_next_month_energy_cost"
            ],
            5_000_000.0,
        )

        self.assertAlmostEqual(
            result["analytics"][
                "predicted_change_percent"
            ],
            25.0,
        )

        self.assertAlmostEqual(
            result["analytics"][
                "generator_dependency_percent"
            ],
            33.33333333333333,
        )

    def test_business_analytics(self):
        data = {
            "total_energy_cost": 4_000_000,
            "employees": 100,
            "energy_consumption_kwh": 50_000,
            "generator_hours": 100,
            "grid_hours": 300,
            "outage_hours": 25,
            "monthly_revenue": 20_000_000,
        }

        analytics = stage12.calculate_business_analytics(
            data,
            prediction=5_000_000,
        )

        self.assertEqual(
            analytics["current_energy_cost"],
            4_000_000,
        )

        self.assertEqual(
            analytics["predicted_energy_cost"],
            5_000_000,
        )

        self.assertAlmostEqual(
            analytics["predicted_change_percent"],
            25.0,
        )

        self.assertAlmostEqual(
            analytics["predicted_cost_per_employee"],
            50_000,
        )

        self.assertAlmostEqual(
            analytics["predicted_cost_per_kwh"],
            100,
        )

        self.assertAlmostEqual(
            analytics["generator_dependency_percent"],
            25.0,
        )

        self.assertAlmostEqual(
            analytics[
                "predicted_energy_cost_as_percent_of_revenue"
            ],
            25.0,
        )

    def test_target_is_not_in_feature_contract(self):
        report = stage12.load_training_report()

        features = stage12.get_feature_contract(
            report
        )

        self.assertNotIn(
            stage12.TARGET_COLUMN,
            features,
        )


if __name__ == "__main__":
    unittest.main()