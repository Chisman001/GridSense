import unittest

from fastapi.testclient import TestClient

from ml.api.main import app


class TestGridSenseAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        cls.payload = {
            "business_type": "Manufacturing",
            "industry": "Manufacturing",
            "state": "Lagos",
            "energy_source": "Grid",

            "year": 2025,
            "month": 9,
            "quarter": 3,

            "electricity_bill": 5000000,
            "diesel_cost": 2000000,
            "petrol_cost": 500000,

            "total_energy_cost": 7500000,

            "energy_consumption_kwh": 50000,
            "fuel_consumption_liters": 1200,

            "generator_hours": 100,
            "grid_hours": 500,
            "outage_hours": 50,
            "operating_hours": 600,

            "employee_count": 100,
            "employees": 100,
            "occupancy_rate": 80,

            "floor_area_sqm": 2500,

            "solar_capacity_kw": 50,
            "renewable_energy_percentage": 10,

            "maintenance_cost": 300000,
            "monthly_revenue": 30000000,

            "energy_cost_per_employee": 75000,
            "cost_per_kwh": 150,
            "average_monthly_energy_cost": 7000000,
            "energy_efficiency_score": 75,

            "generator_dependency": 0.17,
            "revenue_energy_ratio": 4.0,

            "outage_severity": 0.1,
            "weather_avg_temp": 28,
            "estimated_carbon_intensity": 450,
        }

    def test_health_endpoint(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "gridsense-api")

    def test_model_endpoint(self):
        response = self.client.get("/model")

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["model"], "lightgbm")
        self.assertEqual(data["status"], "loaded")

    def test_root_endpoint(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["name"], "GridSense API")
        self.assertEqual(data["status"], "running")

    def test_prediction_endpoint(self):
        response = self.client.post(
            "/predict",
            json=self.payload,
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        # Core prediction
        self.assertIn(
            "predicted_next_month_energy_cost",
            data,
        )

        prediction = data[
            "predicted_next_month_energy_cost"
        ]

        self.assertIsInstance(prediction, (int, float))
        self.assertGreater(prediction, 0)

        # Model
        self.assertEqual(
            data["model"],
            "lightgbm",
        )

        # Feature count
        self.assertEqual(
            data["features_used"],
            34,
        )

        # Analytics
        self.assertIn(
            "analytics",
            data,
        )

        analytics = data["analytics"]

        self.assertIn(
            "predicted_change",
            analytics,
        )

        self.assertIn(
            "predicted_change_percent",
            analytics,
        )

        # Input summary
        self.assertIn(
            "input_summary",
            data,
        )

        self.assertEqual(
            data["input_summary"]["business_type"],
            "Manufacturing",
        )

        # LLM context
        self.assertIn(
            "llm_context",
            data,
        )

        self.assertIn(
            "prediction",
            data["llm_context"],
        )

        self.assertIn(
            "analytics",
            data["llm_context"],
        )

        # Timestamp
        self.assertIn(
            "generated_at",
            data,
        )

    def test_prediction_is_deterministic(self):
        response_1 = self.client.post(
            "/predict",
            json=self.payload,
        )

        response_2 = self.client.post(
            "/predict",
            json=self.payload,
        )

        self.assertEqual(
            response_1.status_code,
            200,
        )

        self.assertEqual(
            response_2.status_code,
            200,
        )

        prediction_1 = response_1.json()[
            "predicted_next_month_energy_cost"
        ]

        prediction_2 = response_2.json()[
            "predicted_next_month_energy_cost"
        ]

        self.assertEqual(
            prediction_1,
            prediction_2,
        )


if __name__ == "__main__":
    unittest.main()