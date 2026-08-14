"""
GridSense AI

Smart Meter Dataset Cleaner
"""

from pathlib import Path

from cleaning.core.base_cleaner import BaseCleaner


class SmartMeterCleaner(BaseCleaner):

    def __init__(
        self,
        dataset_path: Path,
        rules: dict,
    ):
        super().__init__("smart_meter", dataset_path, rules)


def clean_smart_meter(dataset_path: Path, rules: dict):
    cleaner = SmartMeterCleaner(dataset_path, rules)
    return cleaner.clean()
