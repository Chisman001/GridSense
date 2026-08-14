"""
GridSense AI
Configuration File

Central location for all project paths and constants.
"""

from pathlib import Path

# ==========================================================
# PROJECT PATHS
# ==========================================================

# ml/
ML_ROOT = Path(__file__).resolve().parent.parent

# datasets/
DATASETS_DIR = ML_ROOT / "datasets"

RAW_DATA_DIR = DATASETS_DIR / "raw"
CLEANED_DATA_DIR = DATASETS_DIR / "cleaned"
PROCESSED_DATA_DIR = DATASETS_DIR / "processed"
SYNTHETIC_DATA_DIR = DATASETS_DIR / "synthetic"
FINAL_DATA_DIR = DATASETS_DIR / "final"

# reports/
REPORTS_DIR = ML_ROOT / "reports"
PROFILE_REPORT_DIR = REPORTS_DIR / "dataset_profiles"
VALIDATION_REPORT_DIR = REPORTS_DIR / "validation"
MODEL_REPORT_DIR = REPORTS_DIR / "model_metrics"

# models/
MODELS_DIR = ML_ROOT / "models"

# ==========================================================
# RANDOMNESS
# ==========================================================

RANDOM_SEED = 42

# ==========================================================
# FILE NAMES
# ==========================================================

DATASETS = {
    "test_energy": "test_energy_data.csv",
    "energy_consumption": "energy_consumption.csv",
    "energy_complete": "energydata_complete.csv",
    "smart_meter": "smart_meter_data.csv",
    "household_csv": "household_power_consumption.csv",
    "household_text": "household_power_consumption.txt",
    "cbecs": "cbecs2018_final_public.csv",
}

# ==========================================================
# OUTPUT FILES
# ==========================================================

MASTER_DATASET = "master_energy_dataset.csv"

BUSINESSES_DATASET = "businesses.csv"

ENERGY_RECORDS_DATASET = "energy_records.csv"

RECOMMENDATIONS_DATASET = "recommendations.csv"

PREDICTIONS_DATASET = "predictions.csv"

# ==========================================================
# DEFAULT SETTINGS
# ==========================================================

DEFAULT_ENCODING = "utf-8"

EXCEL_ENGINE = "openpyxl"

CSV_SEPARATOR = ","

DATE_FORMAT = "%Y-%m-%d"

# ==========================================================
# VALID BUSINESS TYPES
# ==========================================================

BUSINESS_TYPES = [
    "Bakery",
    "Hotel",
    "Restaurant",
    "Retail Store",
    "Supermarket",
    "Hospital",
    "School",
    "Factory",
    "Office",
    "Laundry",
    "Salon",
    "Cold Room",
    "Pharmacy",
    "Farm",
    "Warehouse"
]

# ==========================================================
# VALID ENERGY SOURCES
# ==========================================================

ENERGY_SOURCES = [
    "Grid",
    "Generator",
    "Solar",
    "Hybrid"
]