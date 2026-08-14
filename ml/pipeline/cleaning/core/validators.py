from typing import Callable, List

import pandas as pd

Validator = Callable[[pd.DataFrame], pd.DataFrame]


class ValidatorRegistry:

    def __init__(self):
        self._validators: List[Validator] = []

    def register(self, validator: Validator):
        self._validators.append(validator)

    def validators(self) -> List[Validator]:
        return list(self._validators)
