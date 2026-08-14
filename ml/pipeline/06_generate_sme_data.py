"""Stage 06: deterministically generate rule-based SME data.

This stage creates SME profiles, monthly operating records, and recommendation
templates.  It deliberately does not join the grain-specific Stage 05 public
reference data to generated businesses: no real source row identifies an SME.
"""

from __future__ import annotations

import calendar
from datetime import date
import json
from math import sin, pi
from pathlib import Path
import random

import pandas as pd
import yaml

from config import (
    BUSINESSES_DATASET,
    ENERGY_RECORDS_DATASET,
    RANDOM_SEED,
    RECOMMENDATIONS_DATASET,
    SYNTHETIC_DATA_DIR,
)


PIPELINE_DIR = Path(__file__).resolve().parent
ML_ROOT = PIPELINE_DIR.parent
CONFIG_PATH = ML_ROOT / "configs" / "rule-engine.yaml"
REPORT_DIR = ML_ROOT / "reports" / "synthetic"

BUSINESS_COLUMNS = [
    "business_id", "business_name", "business_type", "industry", "state", "city",
    "employees", "operating_hours", "floor_area_sqm", "energy_source",
    "solar_capacity_kw", "monthly_revenue", "created_at",
]
ENERGY_COLUMNS = [
    "record_id", "business_id", "month", "year", "electricity_bill", "diesel_cost",
    "petrol_cost", "generator_hours", "grid_hours", "outage_hours",
    "energy_consumption_kwh", "fuel_consumption_liters", "maintenance_cost",
    "weather_avg_temp", "occupancy_rate", "total_energy_cost",
]
RECOMMENDATION_COLUMNS = [
    "recommendation_id", "title", "description", "estimated_savings",
    "implementation_cost", "difficulty", "priority", "applicable_business_types", "category",
]


def load_rule_config() -> dict:
    """Load the documented business rules and reject incomplete configuration."""
    if not CONFIG_PATH.is_file():
        raise FileNotFoundError(f"Rule engine configuration not found: {CONFIG_PATH}")
    with CONFIG_PATH.open(encoding="utf-8") as file:
        config = yaml.safe_load(file) or {}
    required = {"generation", "locations", "business_rules", "recommendation_templates"}
    if not isinstance(config, dict) or not required.issubset(config):
        raise ValueError(f"Rule engine configuration must define: {sorted(required)}")
    return config


def _range_value(rng: random.Random, values: list[float], integer: bool = False) -> float | int:
    low, high = values
    return rng.randint(int(low), int(high)) if integer else rng.uniform(low, high)


def _weighted_choice(rng: random.Random, weighted_values: dict[str, int]) -> str:
    values, weights = zip(*weighted_values.items())
    return rng.choices(values, weights=weights, k=1)[0]


def generate_businesses(config: dict, rng: random.Random) -> pd.DataFrame:
    """Generate business profiles using per-type ranges and source preferences."""
    generation = config["generation"]
    rows = []
    business_types = list(config["business_rules"])
    for index in range(1, int(generation["business_count"]) + 1):
        business_type = rng.choice(business_types)
        rules = config["business_rules"][business_type]
        location = rng.choice(config["locations"])
        employees = _range_value(rng, rules["employees"], integer=True)
        floor_area = _range_value(rng, rules["floor_area_sqm"])
        energy_source = _weighted_choice(rng, rules["energy_source_weights"])
        solar_range = rules["solar_capacity_kw"] if energy_source in {"Solar", "Hybrid"} else [0, 0]
        rows.append({
            "business_id": f"BIZ-{index:04d}",
            "business_name": f"{business_type} SME {index:03d}",
            "business_type": business_type,
            "industry": rules["industry"],
            "state": location["state"],
            "city": location["city"],
            "employees": employees,
            "operating_hours": round(_range_value(rng, rules["operating_hours"]), 2),
            "floor_area_sqm": round(floor_area, 2),
            "energy_source": energy_source,
            "solar_capacity_kw": round(_range_value(rng, solar_range), 2),
            "monthly_revenue": round(_range_value(rng, rules["monthly_revenue"]), 2),
            "created_at": generation["created_at"],
        })
    return pd.DataFrame(rows, columns=BUSINESS_COLUMNS)


def _month_sequence(start_year: int, start_month: int, count: int):
    for offset in range(count):
        month_index = start_month - 1 + offset
        yield start_year + month_index // 12, month_index % 12 + 1


def _energy_record(business: pd.Series, year: int, month: int, record_number: int, config: dict, rng: random.Random) -> dict:
    """Generate one month while retaining the causal rule relationships."""
    rules = config["business_rules"][business.business_type]
    economics = config["economics"]
    days = calendar.monthrange(year, month)[1]
    monthly_operating_hours = business.operating_hours * days
    seasonal_temperature = config["weather"]["base_temperature_c"] + config["weather"]["seasonal_amplitude_c"] * sin(2 * pi * (month - 2) / 12)
    weather = seasonal_temperature + rng.uniform(-config["weather"]["noise_c"], config["weather"]["noise_c"])
    occupancy = _range_value(rng, rules["occupancy_rate"])
    seasonal_factor = 1 + rules["seasonal_sensitivity"] * max(weather - config["weather"]["base_temperature_c"], 0) / 10
    if business.business_type == "School" and month in config["generation"]["school_holiday_months"]:
        occupancy *= rules["holiday_occupancy_multiplier"]
        seasonal_factor *= rules["holiday_energy_multiplier"]
    load_factor = 0.72 + 0.28 * occupancy / 100
    consumption = business.floor_area_sqm * _range_value(rng, rules["kwh_per_sqm_month"]) * load_factor * seasonal_factor
    outage_hours = min(monthly_operating_hours, _range_value(rng, rules["outage_hours_month"]))
    generator_share = rules["generator_outage_coverage"][business.energy_source]
    generator_hours = min(monthly_operating_hours, outage_hours * generator_share)
    grid_hours = max(0.0, monthly_operating_hours - outage_hours)
    solar_kwh = business.solar_capacity_kw * economics["solar_kwh_per_kw_month"] if business.energy_source in {"Solar", "Hybrid"} else 0.0
    billed_kwh = max(0.0, consumption - solar_kwh)
    fuel_liters = generator_hours * _range_value(rng, rules["generator_liters_per_hour"])
    diesel_fraction = rules["diesel_fraction"]
    electricity_bill = billed_kwh * economics["electricity_tariff_naira_per_kwh"]
    diesel_cost = fuel_liters * diesel_fraction * economics["diesel_price_naira_per_liter"]
    petrol_cost = fuel_liters * (1 - diesel_fraction) * economics["petrol_price_naira_per_liter"]
    maintenance = rules["maintenance_base_naira"] + generator_hours * rules["maintenance_naira_per_generator_hour"] + consumption * rules["maintenance_naira_per_kwh"]
    return {
        "record_id": f"REC-{record_number:06d}", "business_id": business.business_id,
        "month": month, "year": year, "electricity_bill": round(electricity_bill, 2),
        "diesel_cost": round(diesel_cost, 2), "petrol_cost": round(petrol_cost, 2),
        "generator_hours": round(generator_hours, 2), "grid_hours": round(grid_hours, 2),
        "outage_hours": round(outage_hours, 2), "energy_consumption_kwh": round(consumption, 2),
        "fuel_consumption_liters": round(fuel_liters, 2), "maintenance_cost": round(maintenance, 2),
        "weather_avg_temp": round(weather, 2), "occupancy_rate": round(occupancy, 2),
        "total_energy_cost": round(round(electricity_bill, 2) + round(diesel_cost, 2) + round(petrol_cost, 2), 2),
    }


def generate_energy_records(businesses: pd.DataFrame, config: dict, rng: random.Random) -> pd.DataFrame:
    """Generate a fixed number of monthly records for every business."""
    generation = config["generation"]
    rows, record_number = [], 1
    for _, business in businesses.iterrows():
        for year, month in _month_sequence(generation["start_year"], generation["start_month"], generation["months_per_business"]):
            rows.append(_energy_record(business, year, month, record_number, config, rng))
            record_number += 1
    return pd.DataFrame(rows, columns=ENERGY_COLUMNS)


def generate_recommendations(config: dict) -> pd.DataFrame:
    """Create a deterministic knowledge base, not business predictions."""
    rows, identifier = [], 1
    for business_type in config["business_rules"]:
        for template in config["recommendation_templates"]:
            rows.append({
                "recommendation_id": f"REC-TPL-{identifier:03d}",
                "title": template["title"],
                "description": template["description"].format(business_type=business_type),
                "estimated_savings": template["estimated_savings"],
                "implementation_cost": template["implementation_cost"],
                "difficulty": template["difficulty"], "priority": template["priority"],
                "applicable_business_types": business_type, "category": template["category"],
            })
            identifier += 1
    return pd.DataFrame(rows, columns=RECOMMENDATION_COLUMNS)


def validate_generated_data(businesses: pd.DataFrame, energy_records: pd.DataFrame, recommendations: pd.DataFrame, config: dict) -> dict:
    """Raise on violated invariants so invalid synthetic data is never exported."""
    months = int(config["generation"]["months_per_business"])
    checks = {
        "business_ids_unique": businesses.business_id.is_unique,
        "record_ids_unique": energy_records.record_id.is_unique,
        "recommendation_ids_unique": recommendations.recommendation_id.is_unique,
        "employees_positive": (businesses.employees > 0).all(),
        "solar_capacity_nonnegative": (businesses.solar_capacity_kw >= 0).all(),
        "referential_integrity": energy_records.business_id.isin(businesses.business_id).all(),
        "records_per_business": (energy_records.groupby("business_id").size() == months).all(),
        "occupancy_in_range": energy_records.occupancy_rate.between(0, 100).all(),
        "generator_within_operating_hours": (energy_records.generator_hours <= (
            energy_records.business_id.map(businesses.set_index("business_id").operating_hours)
            * energy_records.apply(lambda row: calendar.monthrange(int(row.year), int(row.month))[1], axis=1)
        )).all(),
        "nonnegative_energy_fields": (energy_records[["electricity_bill", "diesel_cost", "petrol_cost", "generator_hours", "grid_hours", "outage_hours", "energy_consumption_kwh", "fuel_consumption_liters", "maintenance_cost", "total_energy_cost"]] >= 0).all().all(),
        "total_cost_consistent": ((energy_records.total_energy_cost - (energy_records.electricity_bill + energy_records.diesel_cost + energy_records.petrol_cost)).abs() < 0.001).all(),
        "no_missing_values": not (businesses.isna().any().any() or energy_records.isna().any().any() or recommendations.isna().any().any()),
    }
    failures = [name for name, passed in checks.items() if not bool(passed)]
    if failures:
        raise ValueError(f"Generated data failed validation: {failures}")
    return {name: bool(value) for name, value in checks.items()}


def generate_all(config: dict) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict]:
    """Generate and validate all Stage 06 datasets with one fixed RNG stream."""
    seed = int(config["generation"].get("random_seed", RANDOM_SEED))
    rng = random.Random(seed)
    businesses = generate_businesses(config, rng)
    energy_records = generate_energy_records(businesses, config, rng)
    recommendations = generate_recommendations(config)
    validation = validate_generated_data(businesses, energy_records, recommendations, config)
    return businesses, energy_records, recommendations, validation


def write_outputs(businesses: pd.DataFrame, energy_records: pd.DataFrame, recommendations: pd.DataFrame, validation: dict, config: dict, data_dir: Path = SYNTHETIC_DATA_DIR, report_dir: Path = REPORT_DIR) -> dict[str, Path]:
    """Persist Stage 06-owned files and return their paths."""
    data_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "businesses": data_dir / BUSINESSES_DATASET,
        "energy_records": data_dir / ENERGY_RECORDS_DATASET,
        "recommendations": data_dir / RECOMMENDATIONS_DATASET,
        "report": report_dir / "synthetic_generation_report.json",
    }
    businesses.to_csv(paths["businesses"], index=False)
    energy_records.to_csv(paths["energy_records"], index=False)
    recommendations.to_csv(paths["recommendations"], index=False)
    report = {
        "generated_at": date.today().isoformat(), "businesses": len(businesses),
        "energy_records": len(energy_records), "recommendations": len(recommendations),
        "records_per_business": int(config["generation"]["months_per_business"]),
        "business_type_distribution": businesses.business_type.value_counts().sort_index().to_dict(),
        "validation": validation,
    }
    with paths["report"].open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)
    return paths


def main() -> None:
    config = load_rule_config()
    businesses, energy_records, recommendations, validation = generate_all(config)
    write_outputs(businesses, energy_records, recommendations, validation, config)
    print(f"Businesses: {len(businesses)}")
    print(f"Energy records: {len(energy_records)}")
    print(f"Recommendations: {len(recommendations)}")
    print(f"Saved to: {SYNTHETIC_DATA_DIR}")


if __name__ == "__main__":
    main()
