from dataclasses import dataclass, field
from typing import Dict, Any


@dataclass
class CleaningMetrics:
    rows_before: int = 0
    rows_after: int = 0
    duplicates_removed: int = 0
    empty_rows_removed: int = 0
    warnings_count: int = 0
    execution_time: float = 0.0
    status: str = "PASS"
    details: Dict[str, Any] = field(default_factory=dict)
