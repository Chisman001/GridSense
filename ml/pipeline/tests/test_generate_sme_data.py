"""Validation tests for deterministic Stage 06 SME generation."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest


MODULE_PATH = Path(__file__).resolve().parents[1] / "06_generate_sme_data.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("sme_stage", MODULE_PATH)
SME_STAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SME_STAGE)


class GenerateSmeDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = SME_STAGE.load_rule_config()
        cls.businesses, cls.records, cls.recommendations, cls.validation = SME_STAGE.generate_all(cls.config)

    def test_schemas_and_unique_ids(self):
        self.assertEqual(self.businesses.columns.tolist(), SME_STAGE.BUSINESS_COLUMNS)
        self.assertEqual(self.records.columns.tolist(), SME_STAGE.ENERGY_COLUMNS)
        self.assertEqual(self.recommendations.columns.tolist(), SME_STAGE.RECOMMENDATION_COLUMNS)
        self.assertTrue(self.businesses.business_id.is_unique)
        self.assertTrue(self.records.record_id.is_unique)
        self.assertTrue(self.recommendations.recommendation_id.is_unique)

    def test_integrity_and_ranges(self):
        self.assertTrue(self.records.business_id.isin(self.businesses.business_id).all())
        self.assertTrue((self.records.groupby("business_id").size() == 24).all())
        self.assertTrue((self.businesses.employees > 0).all())
        self.assertTrue((self.businesses.solar_capacity_kw >= 0).all())
        self.assertTrue(self.records.occupancy_rate.between(0, 100).all())
        self.assertTrue((self.records[["electricity_bill", "diesel_cost", "petrol_cost", "generator_hours", "grid_hours", "outage_hours", "fuel_consumption_liters", "maintenance_cost", "energy_consumption_kwh", "total_energy_cost"]] >= 0).all().all())
        self.assertTrue(((self.records.total_energy_cost - (self.records.electricity_bill + self.records.diesel_cost + self.records.petrol_cost)).abs() < 0.001).all())
        self.assertTrue(all(self.validation.values()))

    def test_generation_is_reproducible_and_business_rules_differ(self):
        businesses, records, recommendations, _ = SME_STAGE.generate_all(self.config)
        self.assertTrue(self.businesses.equals(businesses))
        self.assertTrue(self.records.equals(records))
        self.assertTrue(self.recommendations.equals(recommendations))
        mean_by_type = self.records.assign(business_type=self.records.business_id.map(self.businesses.set_index("business_id").business_type)).groupby("business_type").energy_consumption_kwh.mean()
        self.assertGreater(mean_by_type["Cold Room"], mean_by_type["School"])
        self.assertGreater(mean_by_type["Factory"], mean_by_type["Bakery"])

    def test_output_files_are_written(self):
        with tempfile.TemporaryDirectory() as directory:
            paths = SME_STAGE.write_outputs(
                self.businesses, self.records, self.recommendations, self.validation,
                self.config, Path(directory) / "data", Path(directory) / "reports",
            )
            self.assertTrue(all(path.is_file() for path in paths.values()))


if __name__ == "__main__":
    unittest.main()
