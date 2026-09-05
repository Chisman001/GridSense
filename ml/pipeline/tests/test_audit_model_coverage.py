"""Tests for Stage 13 model coverage audits."""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "13_audit_model_coverage.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("audit_stage", MODULE_PATH)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


class AuditModelCoverageTests(unittest.TestCase):
    def test_parse_frontend_business_types(self):
        content = AUDIT.FRONTEND_BUSINESS_PROFILE.read_text(
            encoding=AUDIT.DEFAULT_ENCODING
        )
        business_types = AUDIT.parse_ts_string_array("BUSINESS_TYPES", content)
        industries = AUDIT.parse_ts_string_array("INDUSTRIES", content)

        self.assertIn("Factory", business_types)
        self.assertIn("Retail Store", business_types)
        self.assertIn("Manufacturing", industries)
        self.assertIn("Retail", industries)

    def test_audit_a_identifies_app_only_gaps(self):
        report = AUDIT.audit_a_coverage_gap()

        self.assertEqual(report["audit"], "A")
        self.assertIn("Factory", report["training"]["business_types"])
        self.assertIn("Retail Store", report["gaps"]["business_types_in_app_not_in_training"])
        self.assertIn("Retail", report["gaps"]["industries_in_app_not_in_training"])
        self.assertLess(report["coverage_summary"]["app_business_types_covered_pct"], 100)

    def test_audit_c_metrics_by_business_type(self):
        if not AUDIT.PREDICTIONS_CSV.is_file():
            self.skipTest("Predictions CSV not available")

        report = AUDIT.audit_c_metrics_by_category()

        self.assertEqual(report["audit"], "C")
        self.assertEqual(report["model"], "lightgbm")
        self.assertGreater(report["overall"]["row_count"], 0)
        self.assertGreater(len(report["by_business_type"]), 0)
        self.assertGreater(len(report["by_industry"]), 0)

        for row in report["by_business_type"]:
            self.assertIsNotNone(row["mae"])
            self.assertIsNotNone(row["rmse"])
            self.assertGreater(row["row_count"], 0)

    def test_audit_b_requires_model(self):
        model_path = AUDIT.MODELS_DIR / f"{AUDIT.SELECTED_MODEL}.joblib"
        if not model_path.is_file():
            with self.assertRaises(FileNotFoundError):
                stage12 = AUDIT._load_stage_12()
                AUDIT.audit_b_industry_sensitivity(stage12)
            return

        stage12 = AUDIT._load_stage_12()
        report = AUDIT.audit_b_industry_sensitivity(stage12)

        self.assertEqual(report["audit"], "B")
        self.assertGreater(len(report["scenarios"]), 0)
        labels = {row["label"] for row in report["scenarios"]}
        self.assertIn("trained:Factory", labels)
        self.assertIn("app_only:Retail Store", labels)

    def test_apply_generator_scenario_recalculates_derived_fields(self):
        record = {
            "year": 2024,
            "month": 6,
            "electricity_bill": 100000.0,
            "diesel_cost": 50000.0,
            "petrol_cost": 10000.0,
            "generator_hours": 100.0,
            "grid_hours": 200.0,
            "outage_hours": 20.0,
            "energy_consumption_kwh": 5000.0,
            "fuel_consumption_liters": 400.0,
            "employees": 10.0,
            "operating_hours": 12.0,
            "monthly_revenue": 1000000.0,
        }
        scenario = AUDIT.apply_generator_hours_scenario(record, 20)

        self.assertEqual(scenario["diesel_cost"], 40000.0)
        self.assertEqual(scenario["generator_hours"], 80.0)
        self.assertEqual(scenario["total_energy_cost"], 150000.0)
        self.assertAlmostEqual(scenario["generator_dependency"], 80 / 280, places=4)

    def test_audit_d_worst_predictions(self):
        if not AUDIT.PREDICTIONS_CSV.is_file():
            self.skipTest("Predictions CSV not available")

        report = AUDIT.audit_d_worst_predictions(top_n=5)

        self.assertEqual(report["audit"], "D")
        self.assertEqual(len(report["worst_predictions"]), 5)
        self.assertGreater(report["overall_error_profile"]["max_abs_residual"], 0)
        self.assertGreater(len(report["error_clusters"]["by_business_type"]), 0)

    def test_audit_e_whatif_sensitivity(self):
        model_path = AUDIT.MODELS_DIR / f"{AUDIT.SELECTED_MODEL}.joblib"
        if not model_path.is_file():
            self.skipTest("Model artifact not available")

        stage12 = AUDIT._load_stage_12()
        report = AUDIT.audit_e_whatif_sensitivity(stage12)

        self.assertEqual(report["audit"], "E")
        self.assertEqual(len(report["profiles"]), 3)
        for profile in report["profiles"]:
            self.assertEqual(len(profile["sweep"]), len(AUDIT.WHATIF_REDUCTION_LEVELS))
            self.assertEqual(profile["sweep"][0]["reduction_percent"], 0)

    def test_audit_f_whatif_robustness(self):
        model_path = AUDIT.MODELS_DIR / f"{AUDIT.SELECTED_MODEL}.joblib"
        if not model_path.is_file():
            self.skipTest("Model artifact not available")

        stage12 = AUDIT._load_stage_12()
        report = AUDIT.audit_f_whatif_robustness(stage12)

        self.assertEqual(report["audit"], "F")
        self.assertEqual(report["population_size"], 750)
        self.assertEqual(len(report["by_generator_dependency_bucket"]), 5)
        self.assertIn("overall", report)

    def test_audit_g_feature_importance(self):
        model_path = AUDIT.MODELS_DIR / f"{AUDIT.SELECTED_MODEL}.joblib"
        if not model_path.is_file():
            self.skipTest("Model artifact not available")

        report = AUDIT.audit_g_feature_importance()

        self.assertEqual(report["audit"], "G")
        self.assertGreater(len(report["ranked_features"]), 0)
        self.assertIn("total_energy_cost", [row["feature"] for row in report["ranked_features"]])

    def test_audit_h_leakage_sanity(self):
        report = AUDIT.audit_h_leakage_sanity()

        self.assertEqual(report["audit"], "H")
        self.assertTrue(report["target_construction_check"]["target_shift_verified"])
        self.assertEqual(report["analysis"]["leakage_verdict"], "PASS")
        self.assertGreater(len(report["eval_split_correlations_with_target"]), 0)

    def test_run_audits_writes_reports(self):
        results = AUDIT.run_audits(skip_model_audits_if_missing=True)

        self.assertTrue(AUDIT.AUDIT_A_REPORT.is_file())
        self.assertTrue(AUDIT.AUDIT_C_REPORT.is_file())
        self.assertTrue(AUDIT.AUDIT_D_REPORT.is_file())
        self.assertTrue(AUDIT.AUDIT_H_REPORT.is_file())
        self.assertTrue(AUDIT.AUDIT_SUMMARY_REPORT.is_file())

        with AUDIT.AUDIT_H_REPORT.open("r", encoding=AUDIT.DEFAULT_ENCODING) as file:
            payload = json.load(file)
        self.assertEqual(payload["audit"], "H")

        if results["audit_f"] is not None:
            self.assertTrue(AUDIT.AUDIT_F_REPORT.is_file())
        if results["audit_g"] is not None:
            self.assertTrue(AUDIT.AUDIT_G_REPORT.is_file())


if __name__ == "__main__":
    unittest.main()
