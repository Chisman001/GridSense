"""
GridSense AI

Energy Complete Dataset Cleaner
"""

from pathlib import Path

from cleaning.core.base_cleaner import BaseCleaner


class EnergyCompleteCleaner(BaseCleaner):

    def __init__(
        self,
        dataset_path: Path,
        rules: dict,
    ):
        super().__init__("energy_complete", dataset_path, rules)


def clean_energy_complete(dataset_path: Path, rules: dict):
    cleaner = EnergyCompleteCleaner(dataset_path, rules)
    return cleaner.clean()
