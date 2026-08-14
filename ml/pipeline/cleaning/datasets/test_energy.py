"""
GridSense AI

Test Energy Dataset Cleaner
"""

from pathlib import Path

from cleaning.core.base_cleaner import BaseCleaner


class TestEnergyCleaner(BaseCleaner):

    def __init__(
        self,
        dataset_path: Path,
        rules: dict,
    ):
        super().__init__("test_energy", dataset_path, rules)


def clean_test_energy(dataset_path: Path, rules: dict):
    cleaner = TestEnergyCleaner(dataset_path, rules)
    return cleaner.clean()
