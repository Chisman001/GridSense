"""Non-production GES v1 validation.

Applies the approved GridSense Energy Score v1 methodology to the frozen
Stage 09 final ML dataset. This script does not modify application code,
schema, models, or stored energy_efficiency_score values.
"""

from __future__ import annotations

import calendar
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from config import (
    CSV_SEPARATOR,
    DEFAULT_ENCODING,
    FINAL_DATA_DIR,
    VALIDATION_REPORT_DIR,
)

INPUT_PATH = FINAL_DATA_DIR / "energy_records.csv"
JSON_REPORT_PATH = VALIDATION_REPORT_DIR / "ges_v1_validation_report.json"
MARKDOWN_REPORT_PATH = VALIDATION_REPORT_DIR / "ges_v1_validation_report.md"

EXPECTED_ROWS = 3600
REPRESENTATIVE_RECORD_IDS = [
    "REC-000049",
    "REC-000001",
    "REC-000005",
    "REC-000025",
    "REC-001241",
    "REC-003386",
]

D_MIN = 0.006077
D_MAX = 0.241246
S_MIN = 0.048013
S_MAX = 0.296079

COST_WEIGHT = 0.50
GEN_WEIGHT = 0.25
OP_WEIGHT = 0.25

REQUIRED_COLUMNS = [
    "record_id",
    "year",
    "month",
    "total_energy_cost",
    "monthly_revenue",
    "generator_hours",
    "grid_hours",
    "outage_hours",
    "operating_hours",
]


def _to_float(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def days_in_month(year: pd.Series, month: pd.Series) -> pd.Series:
    years = pd.to_numeric(year, errors="coerce")
    months = pd.to_numeric(month, errors="coerce")
    days = pd.Series(np.nan, index=year.index, dtype="float64")
    valid = (
        years.notna()
        & months.notna()
        & years.eq(years.round())
        & months.eq(months.round())
        & years.between(1, 9999)
        & months.between(1, 12)
    )
    for idx in year.index[valid]:
        days.at[idx] = calendar.monthrange(int(years.at[idx]), int(months.at[idx]))[1]
    return days


def cost_burden(total_energy_cost: pd.Series, monthly_revenue: pd.Series) -> pd.Series:
    cost = _to_float(total_energy_cost)
    revenue = _to_float(monthly_revenue)
    result = pd.Series(np.nan, index=cost.index, dtype="float64")
    valid = revenue.notna() & cost.notna() & (revenue > 0)
    result.loc[valid] = cost.loc[valid] / revenue.loc[valid]
    return result


def generator_dependency(generator_hours: pd.Series, grid_hours: pd.Series) -> pd.Series:
    generator = _to_float(generator_hours)
    grid = _to_float(grid_hours)
    powered = generator + grid
    result = pd.Series(np.nan, index=generator.index, dtype="float64")
    valid = generator.notna() & grid.notna() & (powered > 0)
    result.loc[valid] = generator.loc[valid] / powered.loc[valid]
    return result


def outage_fraction(
    outage_hours: pd.Series,
    operating_hours_per_day: pd.Series,
    year: pd.Series,
    month: pd.Series,
) -> pd.Series:
    outage = _to_float(outage_hours)
    daily_hours = _to_float(operating_hours_per_day)
    days = days_in_month(year, month)
    monthly_operating = daily_hours * days
    result = pd.Series(np.nan, index=outage.index, dtype="float64")
    valid = (
        outage.notna()
        & daily_hours.notna()
        & days.notna()
        & (daily_hours > 0)
        & (monthly_operating > 0)
    )
    result.loc[valid] = outage.loc[valid] / monthly_operating.loc[valid]
    return result


def cost_score(burden: pd.Series) -> pd.Series:
    clipped = burden.clip(lower=0, upper=1)
    return 100.0 * (1.0 - clipped)


def stretched_score(value: pd.Series, low: float, high: float) -> pd.Series:
    span = high - low
    clipped = value.clip(lower=low, upper=high)
    score = 100.0 * (high - clipped) / span
    return score.clip(lower=0, upper=100)


def rating_band(score: float) -> str | None:
    if pd.isna(score):
        return None
    if 90 <= score <= 100:
        return "Excellent"
    if 75 <= score < 90:
        return "Good"
    if 50 <= score < 75:
        return "Needs Improvement"
    if 0 <= score < 50:
        return "Critical"
    return None


def summarize(series: pd.Series) -> dict[str, float | None]:
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if numeric.empty:
        return {
            "count": 0,
            "min": None,
            "p10": None,
            "p25": None,
            "p50": None,
            "p75": None,
            "p90": None,
            "p95": None,
            "max": None,
            "mean": None,
            "std": None,
        }
    quantiles = numeric.quantile([0.10, 0.25, 0.50, 0.75, 0.90, 0.95], interpolation="linear")
    return {
        "count": int(numeric.count()),
        "min": float(numeric.min()),
        "p10": float(quantiles.loc[0.10]),
        "p25": float(quantiles.loc[0.25]),
        "p50": float(quantiles.loc[0.50]),
        "p75": float(quantiles.loc[0.75]),
        "p90": float(quantiles.loc[0.90]),
        "p95": float(quantiles.loc[0.95]),
        "max": float(numeric.max()),
        "mean": float(numeric.mean()),
        "std": float(numeric.std(ddof=1)),
    }


def apply_ges(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    result["cost_burden"] = cost_burden(result["total_energy_cost"], result["monthly_revenue"])
    result["generator_dependency_recomputed"] = generator_dependency(
        result["generator_hours"],
        result["grid_hours"],
    )
    result["outage_fraction"] = outage_fraction(
        result["outage_hours"],
        result["operating_hours"],
        result["year"],
        result["month"],
    )
    result["cost_score"] = cost_score(result["cost_burden"])
    result["gen_score"] = stretched_score(
        result["generator_dependency_recomputed"],
        D_MIN,
        D_MAX,
    )
    result["op_score"] = stretched_score(result["outage_fraction"], S_MIN, S_MAX)
    result["ges"] = (
        COST_WEIGHT * result["cost_score"]
        + GEN_WEIGHT * result["gen_score"]
        + OP_WEIGHT * result["op_score"]
    ).clip(lower=0, upper=100)
    unavailable = (
        result["cost_score"].isna()
        | result["gen_score"].isna()
        | result["op_score"].isna()
    )
    result.loc[unavailable, "ges"] = np.nan
    result["ges_rating"] = result["ges"].map(rating_band)
    if "fuel_consumption_liters" in result.columns and "energy_consumption_kwh" in result.columns:
        fuel = _to_float(result["fuel_consumption_liters"])
        kwh = _to_float(result["energy_consumption_kwh"])
        intensity = pd.Series(np.nan, index=result.index, dtype="float64")
        valid = fuel.notna() & kwh.notna() & (kwh > 0)
        intensity.loc[valid] = fuel.loc[valid] / kwh.loc[valid]
        result["fuel_intensity"] = intensity
    return result


def boundary_cases() -> list[dict[str, Any]]:
    cases = [
        {
            "name": "cost_revenue_zero",
            "total_energy_cost": 0.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 40.0,
            "grid_hours": 360.0,
            "outage_hours": 40.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "cost_revenue_half",
            "total_energy_cost": 500_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 40.0,
            "grid_hours": 360.0,
            "outage_hours": 40.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "cost_revenue_at_one",
            "total_energy_cost": 1_000_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 40.0,
            "grid_hours": 360.0,
            "outage_hours": 40.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "cost_revenue_above_one",
            "total_energy_cost": 1_500_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 40.0,
            "grid_hours": 360.0,
            "outage_hours": 40.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "d_below_dmin",
            "total_energy_cost": 300_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 0.001,
            "grid_hours": 399.999,
            "outage_hours": 40.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "d_above_dmax",
            "total_energy_cost": 300_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 200.0,
            "grid_hours": 200.0,
            "outage_hours": 40.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "s_below_smin",
            "total_energy_cost": 300_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 40.0,
            "grid_hours": 360.0,
            "outage_hours": 1.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "s_above_smax",
            "total_energy_cost": 300_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 40.0,
            "grid_hours": 360.0,
            "outage_hours": 300.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "invalid_zero_revenue",
            "total_energy_cost": 300_000.0,
            "monthly_revenue": 0.0,
            "generator_hours": 40.0,
            "grid_hours": 360.0,
            "outage_hours": 40.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "invalid_zero_powered_hours",
            "total_energy_cost": 300_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 0.0,
            "grid_hours": 0.0,
            "outage_hours": 40.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "invalid_zero_operating_hours",
            "total_energy_cost": 300_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 40.0,
            "grid_hours": 360.0,
            "outage_hours": 40.0,
            "operating_hours": 0.0,
            "year": 2024,
            "month": 1,
        },
        {
            "name": "invalid_month",
            "total_energy_cost": 300_000.0,
            "monthly_revenue": 1_000_000.0,
            "generator_hours": 40.0,
            "grid_hours": 360.0,
            "outage_hours": 40.0,
            "operating_hours": 12.0,
            "year": 2024,
            "month": 13,
        },
    ]
    scored = apply_ges(pd.DataFrame(cases))
    rows = []
    for _, row in scored.iterrows():
        rows.append(
            {
                "name": row["name"],
                "cost_burden": _json_number(row["cost_burden"]),
                "generator_dependency": _json_number(row["generator_dependency_recomputed"]),
                "outage_fraction": _json_number(row["outage_fraction"]),
                "cost_score": _json_number(row["cost_score"]),
                "gen_score": _json_number(row["gen_score"]),
                "op_score": _json_number(row["op_score"]),
                "ges": _json_number(row["ges"]),
                "ges_available": bool(pd.notna(row["ges"])),
            }
        )
    return rows


def _json_number(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and np.isnan(value)) or pd.isna(value):
        return None
    return float(value)


def representative_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    rows = []
    for record_id in REPRESENTATIVE_RECORD_IDS:
        matches = frame.loc[frame["record_id"] == record_id]
        if matches.empty:
            rows.append({"record_id": record_id, "present": False})
            continue
        row = matches.iloc[0]
        rows.append(
            {
                "record_id": record_id,
                "present": True,
                "business_name": None if pd.isna(row.get("business_name")) else str(row["business_name"]),
                "business_type": None if pd.isna(row.get("business_type")) else str(row["business_type"]),
                "energy_source": None if pd.isna(row.get("energy_source")) else str(row["energy_source"]),
                "year": _json_number(row["year"]),
                "month": _json_number(row["month"]),
                "total_energy_cost": _json_number(row["total_energy_cost"]),
                "monthly_revenue": _json_number(row["monthly_revenue"]),
                "generator_hours": _json_number(row["generator_hours"]),
                "grid_hours": _json_number(row["grid_hours"]),
                "outage_hours": _json_number(row["outage_hours"]),
                "operating_hours_per_day": _json_number(row["operating_hours"]),
                "cost_burden": _json_number(row["cost_burden"]),
                "generator_dependency": _json_number(row["generator_dependency_recomputed"]),
                "outage_fraction": _json_number(row["outage_fraction"]),
                "cost_score": _json_number(row["cost_score"]),
                "gen_score": _json_number(row["gen_score"]),
                "op_score": _json_number(row["op_score"]),
                "ges": _json_number(row["ges"]),
                "ges_rating": row["ges_rating"],
            }
        )
    return rows


def _corr_matrix(frame: pd.DataFrame, method: str) -> dict[str, dict[str, float | None]]:
    corr = frame.corr(method=method)
    payload: dict[str, dict[str, float | None]] = {}
    for column in corr.columns:
        payload[column] = {
            key: None if pd.isna(value) else float(value)
            for key, value in corr[column].items()
        }
    return payload


def correlation_block(frame: pd.DataFrame) -> dict[str, Any]:
    columns = {
        "cost_burden": frame["cost_burden"],
        "generator_dependency": frame["generator_dependency_recomputed"],
        "outage_fraction": frame["outage_fraction"],
    }
    if "fuel_intensity" in frame.columns:
        columns["fuel_intensity"] = frame["fuel_intensity"]
    corr_frame = pd.DataFrame(columns)
    complete = corr_frame.dropna()
    return {
        "n_complete_rows": int(complete.shape[0]),
        "pearson": _corr_matrix(complete, "pearson"),
        "spearman": _corr_matrix(complete, "spearman"),
        "note": (
            "Correlation does not establish causation. Stage 06 generates "
            "generator hours from outage hours and fuel from generator hours."
        ),
    }


def business_type_block(frame: pd.DataFrame) -> dict[str, Any]:
    if "business_type" not in frame.columns:
        return {"available": False}
    grouped = {}
    for business_type, group in frame.groupby("business_type", dropna=False):
        ratings = group["ges_rating"].value_counts(dropna=False).to_dict()
        grouped[str(business_type)] = {
            "count": int(len(group)),
            "ges": summarize(group["ges"]),
            "rating_counts": {str(key): int(value) for key, value in ratings.items()},
        }
    return {"available": True, "by_type": grouped}


def rating_distribution(frame: pd.DataFrame) -> dict[str, Any]:
    available = frame["ges"].notna()
    n = int(available.sum())
    counts = {
        "Excellent": int((frame.loc[available, "ges_rating"] == "Excellent").sum()),
        "Good": int((frame.loc[available, "ges_rating"] == "Good").sum()),
        "Needs Improvement": int(
            (frame.loc[available, "ges_rating"] == "Needs Improvement").sum()
        ),
        "Critical": int((frame.loc[available, "ges_rating"] == "Critical").sum()),
    }
    percents = {
        name: (count / n * 100.0 if n else None) for name, count in counts.items()
    }
    return {
        "available_scores": n,
        "unavailable_scores": int((~available).sum()),
        "counts": counts,
        "percents": percents,
    }


def observations(frame: pd.DataFrame, ratings: dict[str, Any]) -> list[str]:
    notes = []
    notes.append(
        "GES was recomputed from raw fields; stored generator_dependency and "
        "outage_severity were not used as scoring inputs."
    )
    notes.append(
        "energy_efficiency_score is absent from the ML dataset and was not used."
    )
    if ratings["unavailable_scores"] == 0:
        notes.append("All 3,600 records produced a valid GES.")
    cost_at_or_above_one = int((frame["cost_burden"] >= 1).sum())
    notes.append(
        f"{cost_at_or_above_one} records have cost burden >= 1.0 and therefore CostScore = 0."
    )
    d_clipped_low = int((frame["generator_dependency_recomputed"] < D_MIN).sum())
    d_clipped_high = int((frame["generator_dependency_recomputed"] > D_MAX).sum())
    s_clipped_low = int((frame["outage_fraction"] < S_MIN).sum())
    s_clipped_high = int((frame["outage_fraction"] > S_MAX).sum())
    notes.append(
        "Calibration clips: "
        f"D below Dmin={d_clipped_low}, D above Dmax={d_clipped_high}, "
        f"S below Smin={s_clipped_low}, S above Smax={s_clipped_high}."
    )
    percents = ratings["percents"]
    notes.append(
        "Approved rating bands on this dataset: "
        f"Excellent {percents['Excellent']:.2f}%, "
        f"Good {percents['Good']:.2f}%, "
        f"Needs Improvement {percents['Needs Improvement']:.2f}%, "
        f"Critical {percents['Critical']:.2f}%."
    )
    return notes


def warnings_block(frame: pd.DataFrame, ratings: dict[str, Any]) -> list[str]:
    warnings = []
    excellent = ratings["percents"]["Excellent"]
    if excellent is not None and excellent < 1:
        warnings.append(
            "Excellent is rare on this synthetic SME set. That matches a strict "
            "absolute Excellent label, but product owners should confirm it is acceptable."
        )
    if int((frame["cost_burden"] >= 1).sum()) > 0:
        warnings.append(
            "Some synthetic months have energy cost greater than monthly revenue. "
            "Those rows receive CostScore 0 and are pulled toward Critical."
        )
    warnings.append(
        "Frozen D/S min-max constants are taken from this synthetic snapshot. "
        "Live app records with operating_hours stored as monthly hours would "
        "mis-compute S."
    )
    warnings.append(
        "The application currently lets users type generatorDependency, "
        "outageSeverity, revenueEnergyRatio, and energyEfficiencyScore. "
        "Production GES must ignore those columns."
    )
    if "energy_efficiency_score" in frame.columns:
        warnings.append(
            "Unexpected: energy_efficiency_score is present in the ML CSV. "
            "It was still not used for GES."
        )
    return warnings


def build_markdown(report: dict[str, Any]) -> str:
    stats = report["component_statistics"]
    ratings = report["rating_distribution"]
    lines = [
        "# GES v1 validation report",
        "",
        "Status: **non-production validation only**. No application, schema, model, or UI files were modified.",
        "",
        "## Approved methodology",
        "",
        "- Components: Cost Burden 50%, Generator Dependency 25%, Operational Reliability 25%.",
        "- Raw formulas: `C = total_energy_cost / monthly_revenue`; `D = generator_hours / (generator_hours + grid_hours)`; `S = outage_hours / (operating_hours_per_day * days_in_month)`.",
        "- CostScore = `100 * (1 - min(max(C, 0), 1))`.",
        "- GenScore uses frozen `Dmin=0.006077`, `Dmax=0.241246`.",
        "- OpScore uses frozen `Smin=0.048013`, `Smax=0.296079`.",
        "- GES = `0.50*CostScore + 0.25*GenScore + 0.25*OpScore`, clamped to `[0, 100]`.",
        "- Bands: 90–100 Excellent, 75–89 Good, 50–74 Needs Improvement, 0–49 Critical.",
        "- Invalid inputs yield unavailable GES, not an imputed value.",
        "",
        f"Dataset: `{report['dataset']}`",
        f"Rows: {report['row_count']}",
        f"Generated at: {report['generated_at']}",
        "",
        "## Component statistics",
        "",
        "| Metric | n | min | P10 | P25 | P50 | P75 | P90 | P95 | max | mean | std |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    order = [
        "cost_burden",
        "cost_score",
        "generator_dependency",
        "gen_score",
        "outage_fraction",
        "op_score",
        "ges",
    ]
    for key in order:
        item = stats[key]
        lines.append(
            "| {name} | {count} | {min:.6f} | {p10:.6f} | {p25:.6f} | {p50:.6f} | {p75:.6f} | {p90:.6f} | {p95:.6f} | {max:.6f} | {mean:.6f} | {std:.6f} |".format(
                name=key,
                count=item["count"],
                min=item["min"],
                p10=item["p10"],
                p25=item["p25"],
                p50=item["p50"],
                p75=item["p75"],
                p90=item["p90"],
                p95=item["p95"],
                max=item["max"],
                mean=item["mean"],
                std=item["std"],
            )
        )
    lines.extend(
        [
            "",
            "## Rating distribution",
            "",
            f"- Available scores: {ratings['available_scores']}",
            f"- Unavailable scores: {ratings['unavailable_scores']}",
            "",
        ]
    )
    for name in ["Excellent", "Good", "Needs Improvement", "Critical"]:
        count = ratings["counts"][name]
        percent = ratings["percents"][name]
        lines.append(f"- {name}: {count} ({percent:.2f}%)")
    lines.extend(["", "## Representative records", ""])
    for row in report["representative_records"]:
        if not row["present"]:
            lines.append(f"- `{row['record_id']}`: not present")
            continue
        lines.append(
            f"- `{row['record_id']}` {row['business_name']} ({row['business_type']}, {row['energy_source']}): "
            f"C={row['cost_burden']:.4f}, D={row['generator_dependency']:.4f}, S={row['outage_fraction']:.4f}, "
            f"CostScore={row['cost_score']:.2f}, GenScore={row['gen_score']:.2f}, OpScore={row['op_score']:.2f}, "
            f"GES={row['ges']:.2f} ({row['ges_rating']})"
        )
    lines.extend(["", "## Boundary behavior", ""])
    for row in report["boundary_behavior"]:
        ges = "unavailable" if row["ges"] is None else f"{row['ges']:.2f}"
        lines.append(f"- `{row['name']}`: GES {ges}")
    lines.extend(
        [
            "",
            "## Correlations",
            "",
            "Pearson and Spearman matrices are in the JSON report. Correlation is not causation.",
            "",
            "## Observations",
            "",
        ]
    )
    for note in report["observations"]:
        lines.append(f"- {note}")
    lines.extend(["", "## Warnings", ""])
    for note in report["warnings"]:
        lines.append(f"- {note}")
    lines.extend(
        [
            "",
            "## Production changes",
            "",
            "None. This validation did not modify schema, APIs, Analytics, Reports, Forecast, or historical scores.",
            "",
        ]
    )
    return "\n".join(lines) + "\n"


def validate(frame: pd.DataFrame) -> dict[str, Any]:
    missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")
    scored = apply_ges(frame)
    ratings = rating_distribution(scored)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "non_production_validation_only",
        "production_changes": "none",
        "dataset": str(INPUT_PATH),
        "row_count": int(len(scored)),
        "expected_row_count": EXPECTED_ROWS,
        "approved_methodology": {
            "components": {
                "cost_burden": COST_WEIGHT,
                "generator_dependency": GEN_WEIGHT,
                "operational_reliability": OP_WEIGHT,
            },
            "excluded": [
                "fuel_intensity",
                "sustainability",
                "solar_capacity_kw",
                "renewable_energy_percentage",
                "occupancy_rate",
                "energy_efficiency_score",
            ],
            "operating_hours_unit": "hours_per_day",
            "d_min": D_MIN,
            "d_max": D_MAX,
            "s_min": S_MIN,
            "s_max": S_MAX,
            "rating_bands": {
                "Excellent": "90-100",
                "Good": "75-89",
                "Needs Improvement": "50-74",
                "Critical": "0-49",
            },
        },
        "component_statistics": {
            "cost_burden": summarize(scored["cost_burden"]),
            "cost_score": summarize(scored["cost_score"]),
            "generator_dependency": summarize(scored["generator_dependency_recomputed"]),
            "gen_score": summarize(scored["gen_score"]),
            "outage_fraction": summarize(scored["outage_fraction"]),
            "op_score": summarize(scored["op_score"]),
            "ges": summarize(scored["ges"]),
        },
        "rating_distribution": ratings,
        "boundary_behavior": boundary_cases(),
        "representative_records": representative_rows(scored),
        "correlations": correlation_block(scored),
        "business_type_distribution": business_type_block(scored),
        "observations": observations(scored, ratings),
        "warnings": warnings_block(scored, ratings),
    }
    if len(scored) != EXPECTED_ROWS:
        report["warnings"].insert(
            0,
            f"Expected {EXPECTED_ROWS} rows, found {len(scored)}.",
        )
    return report


def main() -> None:
    if not INPUT_PATH.is_file():
        raise SystemExit(f"Dataset not found: {INPUT_PATH}")
    frame = pd.read_csv(INPUT_PATH, sep=CSV_SEPARATOR, encoding=DEFAULT_ENCODING)
    report = validate(frame)
    VALIDATION_REPORT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_REPORT_PATH.write_text(json.dumps(report, indent=2), encoding=DEFAULT_ENCODING)
    MARKDOWN_REPORT_PATH.write_text(build_markdown(report), encoding=DEFAULT_ENCODING)
    print(f"Wrote {JSON_REPORT_PATH}")
    print(f"Wrote {MARKDOWN_REPORT_PATH}")
    print(f"Rows: {report['row_count']}")
    print(f"Available GES: {report['rating_distribution']['available_scores']}")
    print("Rating percents:", json.dumps(report["rating_distribution"]["percents"], indent=2))


if __name__ == "__main__":
    main()
