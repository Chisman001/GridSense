"""Tests for Stage 07 business-month feature engineering."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
import pandas as pd


MODULE_PATH = Path(__file__).resolve().parents[1] / "07_feature_engineering.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("feature_stage", MODULE_PATH)
FEATURE_STAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(FEATURE_STAGE)


class FeatureEngineeringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.businesses, cls.energy_records = FEATURE_STAGE.load_inputs()
        cls.engineered = FEATURE_STAGE.build_feature_dataset(cls.businesses, cls.energy_records)

    def test_stage06_inputs_and_join_contract(self):
        self.assertTrue((FEATURE_STAGE.SYNTHETIC_DATA_DIR / "businesses.csv").is_file())
        self.assertTrue((FEATURE_STAGE.SYNTHETIC_DATA_DIR / "energy_records.csv").is_file())
        self.assertTrue(self.businesses.business_id.is_unique)
        self.assertTrue(self.energy_records.record_id.is_unique)
        self.assertTrue(self.energy_records.business_id.isin(self.businesses.business_id).all())
        self.assertFalse(self.energy_records.duplicated(["business_id", "year", "month"]).any())
        self.assertEqual(len(self.engineered), 3600)
        self.assertEqual(self.engineered.business_id.nunique(), 150)
        self.assertTrue((self.engineered.groupby("business_id").size() == 24).all())

    def test_controlled_feature_formulas_and_calendar_outage_severity(self):
        frame = pd.DataFrame({
            "business_id": ["B1", "B1"], "year": [2024, 2024], "month": [2, 3],
            "total_energy_cost": [1000.0, 1200.0], "energy_consumption_kwh": [100.0, 200.0],
            "employees": [10, 10], "generator_hours": [20.0, 0.0], "grid_hours": [80.0, 0.0],
            "monthly_revenue": [5000.0, 6000.0], "outage_hours": [29.0, 0.0],
            "operating_hours": [10.0, 10.0], "fuel_consumption_liters": [50.0, 0.0],
        })
        result = FEATURE_STAGE.add_engineered_features(frame)
        first, second = result.iloc[0], result.iloc[1]
        self.assertEqual(first.quarter, 1)
        self.assertAlmostEqual(first.cost_per_kwh, 10.0)
        self.assertAlmostEqual(first.energy_cost_per_employee, 100.0)
        self.assertAlmostEqual(first.generator_dependency, 0.2)
        self.assertAlmostEqual(first.revenue_energy_ratio, 5.0)
        self.assertAlmostEqual(first.outage_severity, 29.0 / (10.0 * 29.0))  # Leap-year February.
        self.assertAlmostEqual(first.estimated_carbon_intensity, 0.5)
        self.assertEqual(first.next_month_energy_cost, 1200.0)
        self.assertTrue(pd.isna(second.next_month_energy_cost))
        self.assertTrue(pd.isna(second.generator_dependency))

    def test_zero_denominators_produce_nan_not_infinity(self):
        numerator = pd.Series([10.0, 0.0])
        denominator = pd.Series([0.0, 0.0])
        result = FEATURE_STAGE.safe_divide(numerator, denominator)
        self.assertTrue(result.isna().all())
        self.assertFalse(np.isinf(result.to_numpy(dtype=float)).any())

    def test_target_and_ratio_integrity(self):
        required = set(FEATURE_STAGE.BUSINESS_COLUMNS + FEATURE_STAGE.ENERGY_COLUMNS + FEATURE_STAGE.ENGINEERED_COLUMNS)
        self.assertTrue(required.issubset(self.engineered.columns))
        self.assertEqual(self.engineered.next_month_energy_cost.notna().sum(), 3450)
        self.assertEqual(self.engineered.next_month_energy_cost.isna().sum(), 150)
        self.assertTrue(self.engineered.generator_dependency.dropna().between(0, 1).all())
        self.assertTrue(self.engineered.outage_severity.dropna().between(0, 1).all())
        self.assertFalse(np.isinf(self.engineered.select_dtypes(include="number").to_numpy(dtype=float)).any())
        ordered = self.engineered.sort_values(["business_id", "year", "month"])
        expected = ordered.groupby("business_id").total_energy_cost.shift(-1)
        self.assertTrue(expected.equals(ordered.next_month_energy_cost))
        self.assertTrue(ordered.groupby("business_id").tail(1).next_month_energy_cost.isna().all())

    def test_target_cannot_leak_between_businesses(self):
        frame = pd.DataFrame({
            "business_id": ["A", "B", "A", "B"], "year": [2024] * 4,
            "month": [1, 1, 2, 2], "total_energy_cost": [100.0, 900.0, 200.0, 1000.0],
            "energy_consumption_kwh": [1.0] * 4, "employees": [1] * 4,
            "generator_hours": [0.0] * 4, "grid_hours": [1.0] * 4,
            "monthly_revenue": [1.0] * 4, "outage_hours": [0.0] * 4,
            "operating_hours": [1.0] * 4, "fuel_consumption_liters": [0.0] * 4,
        })
        result = FEATURE_STAGE.add_engineered_features(frame)
        self.assertEqual(result.loc[result.business_id.eq("A") & result.month.eq(1), "next_month_energy_cost"].iloc[0], 200.0)
        self.assertEqual(result.loc[result.business_id.eq("B") & result.month.eq(1), "next_month_energy_cost"].iloc[0], 1000.0)

    def test_generation_is_deterministic_and_writable(self):
        repeated = FEATURE_STAGE.build_feature_dataset(self.businesses, self.energy_records)
        self.assertTrue(self.engineered.equals(repeated))
        with tempfile.TemporaryDirectory() as directory:
            output_path = Path(directory) / "engineered.csv"
            report_path = Path(directory) / "report.json"
            report = FEATURE_STAGE.validate_output(self.engineered)
            FEATURE_STAGE.write_output(self.engineered, report, output_path, report_path)
            self.assertTrue(output_path.is_file())
            self.assertTrue(report_path.is_file())


if __name__ == "__main__":
    unittest.main()
