from datetime import datetime
from typing import List, Optional


def generate_report(
    dataset: str,
    before: int,
    after: int,
    duplicates: int,
    empty_rows: int,
    status: str = "PASS",
    warnings: Optional[List[str]] = None,
    execution_time: Optional[float] = None,
) -> str:
    warnings = warnings or []

    report = f"""

    GridSense AI

    Cleaning Report

    Dataset: {dataset}

    Generated: {datetime.now()}

    ----------------------------------------

    Rows Before: {before}

    Rows After: {after}

    Duplicates Removed: {duplicates}

    Empty Rows Removed: {empty_rows}

    Status: {status}

    """

    if execution_time is not None:
        report += f"Execution Time (s): {execution_time:.3f}\n\n"

    report += "\nWarnings\n"
    report += "-" * 40 + "\n"

    if warnings:
        for item in warnings:
            report += f"- {item}\n"
    else:
        report += "None\n"

    return report
