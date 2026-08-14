"""
GridSense AI

00b - Generate Feature Template

Reads every dataset and generates:

1. feature-selection.yaml
2. feature-template.csv
3. feature-statistics.json
"""

from pathlib import Path
from datetime import datetime
import json
import yaml
import pandas as pd

from config import (
    RAW_DATA_DIR,
)

from utils import (
    print_section,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent

CONFIG_DIR = PROJECT_ROOT / "configs"

CONFIG_DIR.mkdir(exist_ok=True)

YAML_OUTPUT = CONFIG_DIR / "feature-selection.yaml"

CSV_OUTPUT = CONFIG_DIR / "feature-template.csv"

JSON_OUTPUT = CONFIG_DIR / "feature-statistics.json"

def load_dataset(path: Path):

    if path.suffix == ".csv":
        return pd.read_csv(path, nrows=5)

    elif path.suffix == ".txt":
        return pd.read_csv(
            path,
            sep=";",
            nrows=5,
            low_memory=False
        )

    else:
        raise ValueError(
            f"Unsupported file: {path}"
        )
        
def main():

    print_section(
        "GENERATING FEATURE TEMPLATE"
    )

    if YAML_OUTPUT.exists():

        print("Existing feature-selection.yaml found.")

        with open(YAML_OUTPUT, "r", encoding="utf-8") as f:

            yaml_config = yaml.safe_load(f)

        if yaml_config is None:
            yaml_config = {"datasets": {}}

    else:

        print("Creating new feature-selection.yaml")

        yaml_config = {
            "datasets": {}
        }

    csv_rows = []

    statistics = {}
    generated = datetime.now().replace(microsecond=0).isoformat()
    initial_existing_datasets = len(yaml_config["datasets"])
    new_dataset_count = 0
    new_column_count = 0

    for file in sorted(RAW_DATA_DIR.iterdir()):

        if file.suffix.lower() not in [
            ".csv",
            ".txt"
        ]:
            continue

        print(f"Reading {file.name}")

        df = load_dataset(file)

        dataset_name = file.stem

        columns = list(df.columns)

        if dataset_name not in yaml_config["datasets"]:

            yaml_config["datasets"][dataset_name] = {
                "file": file.name,
                "keep": []
            }
            new_dataset_count += 1

        existing_keep = yaml_config["datasets"][dataset_name]["keep"]

        for column in columns:

            if column not in existing_keep:
                existing_keep.append(column)
                new_column_count += 1

        yaml_config["datasets"][dataset_name]["file"] = file.name

        statistics[dataset_name] = {
            "dataset": dataset_name,
            "file": file.name,
            "columns": len(columns),
            "generated": generated,
            "features": columns
        }

        for column in columns:

            csv_rows.append({
                "dataset": dataset_name,
                "column": column,
                "keep": "YES"
            })
        
    with open(
        YAML_OUTPUT,
        "w",
        encoding="utf-8"
    ) as f:

        yaml.dump(
            yaml_config,
            f,
            sort_keys=False,
            allow_unicode=True
        )
        
    pd.DataFrame(csv_rows).to_csv(
        CSV_OUTPUT,
        index=False
    )
    
    with open(
        JSON_OUTPUT,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            statistics,
            f,
            indent=4
        )
        
    print()
    print("=" * 40)
    print("Feature Template Updated")
    print("=" * 40)
    print()
    print(f"✓ Existing datasets: {initial_existing_datasets}")
    print(f"✓ New datasets added: {new_dataset_count}")
    print(f"✓ New columns discovered: {new_column_count}")
    print("✓ Existing selections preserved")
    print()
    print("Files Updated")
    print()
    print(YAML_OUTPUT.relative_to(PROJECT_ROOT))
    print(CSV_OUTPUT.relative_to(PROJECT_ROOT))
    print(JSON_OUTPUT.relative_to(PROJECT_ROOT))


if __name__ == "__main__":
    main()