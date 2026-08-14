"""
GridSense AI

01 - Feature Selection

Reads feature-selection.yaml and creates
reduced datasets for downstream processing.
"""

from pathlib import Path

import yaml
import pandas as pd

from config import (
    RAW_DATA_DIR,
    CLEANED_DATA_DIR,
)

from utils import (
    ensure_directory,
    print_section,
)

CONFIG_PATH = (
    Path(__file__).resolve().parent.parent
    / "configs"
    / "feature-selection.yaml"
)

with open(CONFIG_PATH, "r") as f:
    config = yaml.safe_load(f)
    
def main():

    ensure_directory(CLEANED_DATA_DIR)

    print_section("FEATURE SELECTION")

    datasets = config["datasets"]

    for dataset_name, dataset_config in datasets.items():

        filename = dataset_config["file"]

        keep_columns = dataset_config["keep"]

        dataset_path = RAW_DATA_DIR / filename

        print(f"\nLoading {filename}")

        df = pd.read_csv(dataset_path)

        available_columns = [
            col
            for col in keep_columns
            if col in df.columns
        ]

        missing_columns = [
            col
            for col in keep_columns
            if col not in df.columns
        ]

        if missing_columns:

            print(
                f"Warning: {len(missing_columns)} missing columns"
            )

            for col in missing_columns:

                print(f"   - {col}")

        reduced_df = df[available_columns]

        output_path = (
            CLEANED_DATA_DIR /
            filename
        )

        reduced_df.to_csv(
            output_path,
            index=False
        )

        print(
            f"Saved {dataset_name}: "
            f"{len(reduced_df.columns)} columns"
        )

    print_section("FEATURE SELECTION COMPLETE")
    
if __name__ == "__main__":
    main()