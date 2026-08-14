"""
GridSense AI

Household Dataset Cleaner
"""

from pathlib import Path

import pandas as pd

from cleaning.core.base_cleaner import BaseCleaner


class HouseholdCleaner(BaseCleaner):

    def __init__(
        self,
        dataset_path: Path,
        rules: dict,
    ):
        super().__init__("household", dataset_path, rules)

    def custom_cleaning(self, df):
        if "date" in df.columns and "time" in df.columns:
            df["date_time"] = pd.to_datetime(
                df["date"].astype(str) + " " + df["time"].astype(str),
                errors="coerce",
                dayfirst=True,
            )

        return df


def clean_household(dataset_path: Path, rules: dict):
    cleaner = HouseholdCleaner(dataset_path, rules)
    return cleaner.clean()
