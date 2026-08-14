"""
GridSense AI

CBECS Dataset Cleaner
"""

from pathlib import Path

from cleaning.core.base_cleaner import BaseCleaner


class CbecsCleaner(BaseCleaner):

    def __init__(
        self,
        dataset_path: Path,
        rules: dict,
    ):
        super().__init__("cbecs", dataset_path, rules)


def clean_cbecs(dataset_path: Path, rules: dict):
    cleaner = CbecsCleaner(dataset_path, rules)
    return cleaner.clean()
