"""
GridSense AI

Energy Consumption Dataset Cleaner
"""

from pathlib import Path

from cleaning.core.base_cleaner import BaseCleaner


class EnergyConsumptionCleaner(BaseCleaner):

    def __init__(
        self,
        dataset_path: Path,
        rules: dict,
    ):
        super().__init__("energy_consumption", dataset_path, rules)


def clean_energy_consumption(dataset_path: Path, rules: dict):
    cleaner = EnergyConsumptionCleaner(dataset_path, rules)
    return cleaner.clean()
