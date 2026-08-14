"""
GridSense AI

00 - Dataset Inspection

This script inspects every dataset before cleaning.
"""

from pathlib import Path
import pandas as pd
import json

from config import (
    RAW_DATA_DIR,
    DATASETS,
    PROFILE_REPORT_DIR,
)

from utils import (
    ensure_directory,
    print_section,
    dataset_memory,
    duplicate_count,
    missing_values,
)


# ==========================================================
# LOAD DATASET
# ==========================================================

def load_dataset(path: Path):
    """
    Load CSV or TXT dataset automatically.
    """
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)

    elif path.suffix.lower() == ".txt":
        return pd.read_csv(
            path,
            sep=";",
            low_memory=False
        )

    else:
        raise ValueError(f"Unsupported file type: {path.suffix}")


# ==========================================================
# INSPECT DATASET
# ==========================================================

def inspect_dataset(dataset_name, dataset_path):

    print_section(dataset_name)

    df = load_dataset(dataset_path)

    report = []

    report.append(f"Dataset: {dataset_name}")
    report.append("=" * 60)
    report.append(f"File: {dataset_path.name}")
    report.append("")
    report.append(f"Rows: {len(df):,}")
    report.append(f"Columns: {len(df.columns)}")
    report.append(f"Memory: {dataset_memory(df)} MB")
    report.append(f"Duplicate Rows: {duplicate_count(df)}")
    report.append("")

    report.append("COLUMN NAMES")
    report.append("-" * 60)

    for col in df.columns:
        report.append(col)

    report.append("")
    report.append("DATA TYPES")
    report.append("-" * 60)

    report.append(df.dtypes.to_string())

    report.append("")
    report.append("MISSING VALUES")
    report.append("-" * 60)

    report.append(missing_values(df).to_string())

    report.append("")
    report.append("FIRST FIVE ROWS")
    report.append("-" * 60)

    report.append(df.head().to_string())

    report_text = "\n".join(report)

    print(report_text)

    report_file = PROFILE_REPORT_DIR / f"{dataset_name}_report.txt"

    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report_text)
        
    return {
        "Dataset": dataset_name,
        "Rows": len(df),
        "Columns": len(df.columns),
        "Missing Cells": int(df.isna().sum().sum()),
        "Duplicate Rows": int(duplicate_count(df)),
        "Memory (MB)": dataset_memory(df)
    }


# ==========================================================
# MAIN
# ==========================================================

def main():

    ensure_directory(PROFILE_REPORT_DIR)

    print_section("GRID SENSE AI DATASET INSPECTION")
    
    summary_data = []

    for dataset_name, filename in DATASETS.items():

        dataset_path = RAW_DATA_DIR / filename

        if dataset_path.exists():

            summary = inspect_dataset(dataset_name, dataset_path)
            summary_data.append(summary)

        else:

            print(f"❌ Missing: {filename}")
            
    summary_df = pd.DataFrame(summary_data)

    summary_df = summary_df.sort_values(
        by="Rows",
        ascending=False
    )

    summary_file = PROFILE_REPORT_DIR / "dataset_summary.csv"

    summary_df.to_csv(summary_file, index=False)

    print("\nDataset summary saved to:")
    print(summary_file)
    
    summary_json = PROFILE_REPORT_DIR / "dataset_summary.json"

    with open(summary_json, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=4)

    print_section("INSPECTION COMPLETE")


if __name__ == "__main__":
    main()