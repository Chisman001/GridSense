"""
GridSense AI

02 - Clean Datasets

Pipeline Orchestrator

This script coordinates the cleaning of every dataset
using dataset-specific cleaning modules.

Outputs
-------
datasets/cleaned/
reports/cleaning/
"""

from pathlib import Path
import yaml
import pandas as pd
import json
from datetime import datetime

from config import (
    RAW_DATA_DIR,
    CLEANED_DATA_DIR,
    REPORTS_DIR,
)

from utils import (
    ensure_directory,
    print_section,
)

PIPELINE_STATE_PATH = Path(__file__).resolve().parent / "pipeline_state.json"
STAGE_NAME = "03_clean_datasets"


def write_pipeline_state(
    stage: str,
    completed: bool,
    datasets_processed: list,
    master_dataset_created: bool = False,
):
    state = {
        "stage": stage,
        "completed": completed,
        "datasets_processed": datasets_processed,
        "master_dataset_created": master_dataset_created,
        "timestamp": datetime.now().isoformat(),
    }

    with open(PIPELINE_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=4)


def load_pipeline_state():
    if not PIPELINE_STATE_PATH.exists():
        return None

    try:
        with open(PIPELINE_STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


# Dataset-specific cleaners
from cleaning.datasets.test_energy import clean_test_energy
from cleaning.datasets.energy_complete import clean_energy_complete
from cleaning.datasets.energy_consumption import clean_energy_consumption
from cleaning.datasets.smart_meter import clean_smart_meter
from cleaning.datasets.household import clean_household
from cleaning.datasets.cbecs import clean_cbecs


# ==========================================================
# PATHS
# ==========================================================

CONFIG_PATH = (
    Path(__file__).resolve().parent.parent
    / "configs"
    / "cleaning_rules.yaml"
)

CLEANING_REPORT_DIR = REPORTS_DIR / "cleaning"

ensure_directory(CLEANED_DATA_DIR)
ensure_directory(CLEANING_REPORT_DIR)


# ==========================================================
# LOAD CONFIG
# ==========================================================

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    CLEANING_RULES = yaml.safe_load(f)


# ==========================================================
# CLEANER REGISTRY
# ==========================================================

CLEANERS = {

    "test_energy": clean_test_energy,

    "energy_complete": clean_energy_complete,

    "energy_consumption": clean_energy_consumption,

    "smart_meter": clean_smart_meter,

    "household": clean_household,

    "cbecs": clean_cbecs,
}


# ==========================================================
# MAIN
# ==========================================================

def main():

    print_section("GRID SENSE DATA CLEANING")

    summary = []
    processed_datasets = []
    pipeline_state = load_pipeline_state()

    if pipeline_state and pipeline_state.get("stage") == STAGE_NAME:
        processed_datasets = list(pipeline_state.get("datasets_processed", []))
        print(f"Resuming stage {STAGE_NAME} with {len(processed_datasets)} datasets already processed")

    write_pipeline_state(
        stage=STAGE_NAME,
        completed=False,
        datasets_processed=processed_datasets,
    )

    for dataset_name, rules in CLEANING_RULES["datasets"].items():
        if dataset_name in processed_datasets:
            print(f"\nSkipping already processed dataset {dataset_name}")
            continue

        if not rules.get("enabled", True):
            print(f"\nSkipping disabled dataset {dataset_name}")
            continue

        print(f"\nCleaning {dataset_name}")

        filename = rules["file"]

        dataset_path = RAW_DATA_DIR / filename

        if not dataset_path.exists():

            print(f"Missing dataset: {filename}")

            continue

        cleaner = CLEANERS.get(dataset_name)

        if cleaner is None:

            print(f"No cleaner registered for {dataset_name}")

            continue

        cleaned_df, report = cleaner(
            dataset_path,
            rules
        )

        output_path = CLEANED_DATA_DIR / filename

        cleaned_df.to_csv(
            output_path,
            index=False
        )

        report_path = (
            CLEANING_REPORT_DIR /
            f"{dataset_name}_cleaning.txt"
        )

        with open(report_path, "w", encoding="utf-8") as f:

            f.write(report["text"])

        summary.append(report["summary"])
        processed_datasets.append(dataset_name)

        write_pipeline_state(
            stage=STAGE_NAME,
            completed=False,
            datasets_processed=processed_datasets,
        )

        print("Done")

    summary_df = pd.DataFrame(summary)

    summary_df.to_csv(
        CLEANING_REPORT_DIR /
        "cleaning_summary.csv",
        index=False
    )

    with open(
        CLEANING_REPORT_DIR /
        "cleaning_summary.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            {
                "generated": datetime.now().isoformat(),
                "datasets": summary,
            },
            f,
            indent=4
        )

    write_pipeline_state(
        stage=STAGE_NAME,
        completed=True,
        datasets_processed=processed_datasets,
    )

    print_section("CLEANING COMPLETE")


if __name__ == "__main__":
    main()