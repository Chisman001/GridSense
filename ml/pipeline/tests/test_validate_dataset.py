"""Unit tests for Stage 08 dataset validation."""

from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path
import unittest

import numpy as np
import pandas as pd

MODULE_PATH = Path(__file__).resolve().parents[1] / "08_validate_dataset.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("validate_stage", MODULE_PATH)
VAL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VAL)


def make_business_month_df(n_businesses=3, months=4, start_year=2024, start_month=1):
    rows = []
    for b in range(n_businesses):
        business_id = f"B{b+1:03d}"
        for m in range(months):
            current_year = start_year + ((start_month + m - 1) // 12)
            current_month = ((start_month + m - 1) % 12) + 1
            total_energy_cost = 100.0 + m
            diesel_cost = 10.0
            petrol_cost = 5.0
            electricity_bill = total_energy_cost - diesel_cost - petrol_cost
            days_in_month = pd.to_datetime({"year": [current_year], "month": [current_month], "day": [1]}).dt.days_in_month.iloc[0]
            rows.append({
                "business_id": business_id,
                "record_id": f"R{b+1:03d}-{m+1:02d}",
                "year": current_year,
                "month": current_month,
                "electricity_bill": electricity_bill,
                "diesel_cost": diesel_cost,
                "petrol_cost": petrol_cost,
                "generator_hours": 5.0,
                "grid_hours": 100.0,
                "outage_hours": 1.0,
                "energy_consumption_kwh": 500.0,
                "fuel_consumption_liters": 50.0,
                "maintenance_cost": 5.0,
                "total_energy_cost": total_energy_cost,
                "monthly_revenue": 10000.0,
                "employees": 10,
                "floor_area_sqm": 100.0,
                "solar_capacity_kw": 10.0,
                "occupancy_rate": 50.0,
                "operating_hours": 10.0,
                "business_type": "Factory",
                "energy_source": "Generator",
                "business_name": f"Business {business_id}",
                "industry": "Manufacturing",
                "state": "State",
                "city": "City",
                "created_at": "2024-01-01",
                "quarter": ((current_month - 1) // 3) + 1,
                "cost_per_kwh": total_energy_cost / 500.0,
                "energy_cost_per_employee": total_energy_cost / 10.0,
                "generator_dependency": 5.0 / 105.0,
                "revenue_energy_ratio": 10000.0 / total_energy_cost,
                "outage_severity": 1.0 / (10.0 * days_in_month),
                "estimated_carbon_intensity": 50.0 / 500.0,
                "next_month_energy_cost": np.nan,
            })
    df = pd.DataFrame(rows)
    df = df.sort_values(["business_id", "year", "month"]).reset_index(drop=True)
    df["next_month_energy_cost"] = df.groupby("business_id")["total_energy_cost"].shift(-1)
    return df


class ValidateStageTests(unittest.TestCase):
    def test_valid_dataset_passes(self):
        df = make_business_month_df(n_businesses=3, months=4)
        report, ok = VAL.validate(df, expected_businesses=3, expected_months=4)
        self.assertTrue(ok)
        self.assertEqual(report["row_count"], 12)
        self.assertEqual(report["summary_status"], "PASS")

    def test_duplicate_record_id_detection(self):
        df = make_business_month_df(n_businesses=2, months=3)
        df.loc[1, "record_id"] = df.loc[0, "record_id"]
        report, ok = VAL.validate(df, expected_businesses=2, expected_months=3)
        self.assertFalse(ok)
        self.assertIn("Duplicate record_id values found.", report["failed_checks"])

    def test_duplicate_business_month_detection(self):
        df = make_business_month_df(n_businesses=2, months=3)
        df = pd.concat([df, df.iloc[[0]]], ignore_index=True)
        report, ok = VAL.validate(df, expected_businesses=2, expected_months=3)
        self.assertFalse(ok)
        self.assertIn("Duplicate business-month keys found.", report["failed_checks"])

    def test_missing_business_month_detection(self):
        df = make_business_month_df(n_businesses=2, months=3)
        df = df.drop(df[(df.business_id == "B001") & (df.month == df["month"].max())].index)
        report, ok = VAL.validate(df, expected_businesses=2, expected_months=3)
        self.assertFalse(ok)
        self.assertIn("Some businesses do not have the expected number of month records.", report["failed_checks"])

    def test_invalid_month_detection(self):
        df = make_business_month_df(n_businesses=1, months=3)
        df.loc[0, "month"] = 13
        report, ok = VAL.validate(df, expected_businesses=1, expected_months=3)
        self.assertFalse(ok)
        self.assertIn("Invalid month values detected.", report["failed_checks"])

    def test_negative_cost_detection(self):
        df = make_business_month_df(n_businesses=1, months=3)
        df.loc[0, "electricity_bill"] = -5.0
        report, ok = VAL.validate(df, expected_businesses=1, expected_months=3)
        self.assertFalse(ok)
        self.assertIn("Negative numeric values found in energy/cost fields.", report["failed_checks"])

    def test_invalid_occupancy_detection(self):
        df = make_business_month_df(n_businesses=1, months=3)
        df.loc[0, "occupancy_rate"] = 150.0
        report, ok = VAL.validate(df, expected_businesses=1, expected_months=3)
        self.assertFalse(ok)
        self.assertIn("Range validation failed for one or more features.", report["failed_checks"])

    def test_invalid_generator_dependency_detection(self):
        df = make_business_month_df(n_businesses=1, months=3)
        df.loc[0, "generator_dependency"] = 2.0
        report, ok = VAL.validate(df, expected_businesses=1, expected_months=3)
        self.assertFalse(ok)
        self.assertTrue(any("Formula validation failed for generator_dependency" in f for f in report["failed_checks"]))

    def test_invalid_outage_severity_detection(self):
        df = make_business_month_df(n_businesses=1, months=3)
        df.loc[0, "outage_severity"] = 2.0
        report, ok = VAL.validate(df, expected_businesses=1, expected_months=3)
        self.assertFalse(ok)
        self.assertTrue(any("Formula validation failed for outage_severity" in f for f in report["failed_checks"]))

    def test_cost_consistency_detection(self):
        df = make_business_month_df(n_businesses=1, months=3)
        df.loc[0, "total_energy_cost"] = 9999.0
        report, ok = VAL.validate(df, expected_businesses=1, expected_months=3)
        self.assertFalse(ok)
        self.assertIn("Cost consistency validation failed for total_energy_cost.", report["failed_checks"])

    def test_target_lead_correctness(self):
        df = make_business_month_df(n_businesses=2, months=4)
        df.loc[(df.business_id == "B001") & (df.month == df["month"].min()), "next_month_energy_cost"] = 9999.0
        report, ok = VAL.validate(df, expected_businesses=2, expected_months=4)
        self.assertFalse(ok)
        self.assertIn("Target values do not match the next month's total_energy_cost for some rows.", report["failed_checks"])

    def test_final_month_target_null_requirement(self):
        df = make_business_month_df(n_businesses=1, months=3)
        last_index = df.groupby("business_id").tail(1).index
        df.loc[last_index, "next_month_energy_cost"] = 1000.0
        report, ok = VAL.validate(df, expected_businesses=1, expected_months=3)
        self.assertFalse(ok)
        self.assertIn("Final business-month records must have null next_month_energy_cost.", report["failed_checks"])

    def test_target_counts(self):
        df = make_business_month_df(n_businesses=2, months=4)
        report, ok = VAL.validate(df, expected_businesses=2, expected_months=4)
        self.assertTrue(ok)
        self.assertEqual(report["target_checks"]["target_null_count"], 2)
        self.assertEqual(report["target_checks"]["target_non_null_count"], 6)

    def test_no_infinite_values(self):
        df = make_business_month_df(n_businesses=1, months=3)
        df.loc[0, "energy_consumption_kwh"] = 0.0
        df.loc[0, "cost_per_kwh"] = np.inf
        report, ok = VAL.validate(df, expected_businesses=1, expected_months=3)
        self.assertFalse(ok)
        self.assertIn("Infinite numeric values found.", report["failed_checks"])

    def test_deterministic_validation_results(self):
        df = make_business_month_df(n_businesses=2, months=4)
        report1, ok1 = VAL.validate(df, expected_businesses=2, expected_months=4)
        report2, ok2 = VAL.validate(df, expected_businesses=2, expected_months=4)
        self.assertEqual(ok1, ok2)
        self.assertEqual(report1["failed_checks"], report2["failed_checks"])
        self.assertEqual(report1["warning_checks"], report2["warning_checks"])


if __name__ == "__main__":
    unittest.main()
