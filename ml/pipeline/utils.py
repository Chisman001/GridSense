"""
GridSense AI

Utility Functions
"""

from pathlib import Path
import pandas as pd
import logging


# ==========================================================
# CREATE DIRECTORY
# ==========================================================

def ensure_directory(path: Path):
    """
    Create directory if it doesn't exist.
    """
    path.mkdir(parents=True, exist_ok=True)


# ==========================================================
# PRINT SECTION
# ==========================================================

def print_section(title: str):
    """
    Print formatted section headers.
    """
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


# ==========================================================
# LOAD EXCEL
# ==========================================================

def load_excel(path: Path):
    """
    Load all sheets from an Excel workbook.
    """
    return pd.read_excel(path, sheet_name=None)


# ==========================================================
# LOAD CSV
# ==========================================================

def load_csv(path: Path):
    """
    Load CSV file.
    """
    return pd.read_csv(path)


# ==========================================================
# LOAD TEXT
# ==========================================================

def load_text_dataset(path: Path, separator=";"):
    """
    Load text dataset with custom separator.
    """
    return pd.read_csv(
        path,
        sep=separator,
        low_memory=False
    )


# ==========================================================
# SAVE CSV
# ==========================================================

def save_csv(df: pd.DataFrame, path: Path):
    """
    Save dataframe to CSV.
    """
    df.to_csv(path, index=False)


# ==========================================================
# DATASET MEMORY
# ==========================================================

def dataset_memory(df: pd.DataFrame):
    """
    Return memory usage in MB.
    """
    return round(df.memory_usage(deep=True).sum() / 1024**2, 2)


# ==========================================================
# DUPLICATES
# ==========================================================

def duplicate_count(df: pd.DataFrame):
    """
    Count duplicate rows.
    """
    return df.duplicated().sum()


# ==========================================================
# MISSING VALUES
# ==========================================================

def missing_values(df: pd.DataFrame):
    """
    Missing values summary.
    """
    return df.isna().sum()


# ==========================================================
# LOGGING
# ==========================================================

def setup_logger():

    logging.basicConfig(

        level=logging.INFO,

        format="%(asctime)s | %(levelname)s | %(message)s"

    )

    return logging.getLogger("GridSense")