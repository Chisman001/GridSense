"""Stage 11: Model evaluation.

Reproduces Stage 10 split, loads persisted pipelines, evaluates models on
validation, selects best model (validation MAE), evaluates it on test, and
writes evaluation report + predictions CSV.

Follows the repository defaults: uses split_metadata.json as canonical split
membership when present; otherwise reproduces the chronological split logic.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
import json
import sys
from typing import Any

import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from config import (
    FINAL_DATA_DIR,
    MODEL_REPORT_DIR,
    MODELS_DIR,
    CSV_SEPARATOR,
    DEFAULT_ENCODING,
    RANDOM_SEED,
)


TARGET_COLUMN = "next_month_energy_cost"
INPUT_PATH = FINAL_DATA_DIR / "energy_records.csv"
TRAINING_REPORT = MODEL_REPORT_DIR / "model_training_report.json"
SPLIT_METADATA = MODEL_REPORT_DIR / "split_metadata.json"
EVAL_DIR = MODEL_REPORT_DIR.parent / "model_evaluation"
EVAL_REPORT = EVAL_DIR / "model_evaluation_report.json"
PREDICTIONS_CSV = EVAL_DIR / "model_predictions.csv"


def _current_ts() -> str:
    return datetime.now().isoformat()


def load_dataset(path: Path = INPUT_PATH) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(path)
    return pd.read_csv(path, sep=CSV_SEPARATOR, encoding=DEFAULT_ENCODING)


def _period_number(year: int, month: int, base_year: int = 2024) -> int:
    return (int(year) - base_year) * 12 + int(month)


def get_split_membership(frame: pd.DataFrame, train_end: int = 18, val_end: int = 21) -> tuple[set, set, set, str]:
    """Return (train_ids, val_ids, test_ids, source).

    Prefer SPLIT_METADATA if present; otherwise reproduce chronological split.
    """
    if SPLIT_METADATA.is_file():
        meta = json.loads(SPLIT_METADATA.read_text(encoding=DEFAULT_ENCODING))
        train_ids = set(meta.get("train_record_ids", []))
        val_ids = set(meta.get("val_record_ids", []))
        test_ids = set(meta.get("test_record_ids", []))
        return train_ids, val_ids, test_ids, "split_metadata.json"

    # fallback: reproduce Stage 10 logic
    f = frame.copy()
    f["_period"] = f.apply(lambda r: _period_number(int(r["year"]), int(r["month"])), axis=1)
    supervised = f[f[TARGET_COLUMN].notna()]
    train = supervised[supervised["_period"] <= train_end]
    val = supervised[(supervised["_period"] > train_end) & (supervised["_period"] <= val_end)]
    test = supervised[supervised["_period"] > val_end]
    return set(train["record_id"].tolist()), set(val["record_id"].tolist()), set(test["record_id"].tolist()), "recomputed"


def load_training_report(path: Path = TRAINING_REPORT) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding=DEFAULT_ENCODING))


def load_models_from_report(report: dict[str, Any], model_dir: Path = MODELS_DIR) -> dict[str, Any]:
    artifacts = report.get("artifacts", {})
    models: dict[str, Any] = {}
    for name, path in artifacts.items():
        p = Path(path)
        if not p.is_file():
            # try in model_dir
            alt = model_dir / f"{name}.joblib"
            if alt.is_file():
                p = alt
        if p.is_file():
            models[name] = joblib.load(p)
        else:
            models[name] = None
    return models


def _safe_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    mae = float(mean_absolute_error(y_true, y_pred))
    # sklearn version compatibility: compute RMSE as sqrt of MSE
    mse = float(mean_squared_error(y_true, y_pred))
    rmse = float(np.sqrt(mse))
    r2 = float(r2_score(y_true, y_pred))
    err = y_true - y_pred
    mean_err = float(np.mean(err))
    median_abs = float(np.median(np.abs(err)))
    max_abs = float(np.max(np.abs(err)))
    return {
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
        "mean_error": mean_err,
        "median_abs_error": median_abs,
        "max_abs_error": max_abs,
    }


def evaluate():
    frame = load_dataset()
    report = load_training_report()

    features = report.get("features")
    if not features:
        raise ValueError("No feature list found in training report")

    # Build supervised dataframe (exclude null targets)
    supervised = frame[frame[TARGET_COLUMN].notna()].copy()

    train_ids, val_ids, test_ids, split_source = get_split_membership(frame)

    def assign_split(r):
        rid = r["record_id"]
        if rid in train_ids:
            return "train"
        if rid in val_ids:
            return "validation"
        if rid in test_ids:
            return "test"
        return "unassigned"

    supervised["split"] = supervised.apply(assign_split, axis=1)

    val_df = supervised[supervised["split"] == "validation"].copy()
    test_df = supervised[supervised["split"] == "test"].copy()

    # Load persisted model pipelines
    models = load_models_from_report(report)

    validation_metrics: dict[str, dict[str, float]] = {}
    predictions_rows: list[dict[str, Any]] = []

    X_val = val_df[features]
    y_val = val_df[TARGET_COLUMN].to_numpy()

    # Evaluate each model on validation
    for name, pipeline in models.items():
        if pipeline is None:
            validation_metrics[name] = {"status": "missing"}
            continue
        # Do not call fit(); only predict
        y_pred = pipeline.predict(X_val)
        y_pred = np.asarray(y_pred)
        metrics = _safe_metrics(y_val, y_pred)
        validation_metrics[name] = {**metrics, "status": "evaluated"}

        # store per-row predictions
        # map row index to position in y_pred
        idx_list = list(val_df.index)
        for pos, i in enumerate(idx_list):
            row = val_df.loc[i]
            predictions_rows.append(
                {
                    "record_id": row["record_id"],
                    "business_id": row.get("business_id"),
                    "year": int(row["year"]),
                    "month": int(row["month"]),
                    "actual_next_month_energy_cost": float(row[TARGET_COLUMN]),
                    "model": name,
                    "predicted_next_month_energy_cost": float(y_pred[pos]),
                    "split": "validation",
                    "residual": float(row[TARGET_COLUMN] - y_pred[pos]),
                }
            )

    # Select best model by validation MAE
    best_name = None
    best_mae = None
    tol = 1e-6
    for name, stats in validation_metrics.items():
        if stats.get("status") != "evaluated":
            continue
        mae = stats["mae"]
        if best_name is None:
            best_name = name
            best_mae = mae
            continue
        if mae + tol < best_mae:
            best_name = name
            best_mae = mae
        elif abs(mae - best_mae) <= tol:
            # tie-breaker: RMSE
            if stats.get("rmse", float("inf")) < validation_metrics[best_name].get("rmse", float("inf")):
                best_name = name
                best_mae = mae

    # Evaluate selected model on test (only once)
    test_metrics = None
    if best_name is not None and models.get(best_name) is not None:
        pipeline = models[best_name]
        X_test = test_df[features]
        y_test = test_df[TARGET_COLUMN].to_numpy()
        y_pred_test = pipeline.predict(X_test)
        y_pred_test = np.asarray(y_pred_test)
        test_metrics = _safe_metrics(y_test, y_pred_test)

        idx_list = list(test_df.index)
        for pos, i in enumerate(idx_list):
            row = test_df.loc[i]
            predictions_rows.append(
                {
                    "record_id": row["record_id"],
                    "business_id": row.get("business_id"),
                    "year": int(row["year"]),
                    "month": int(row["month"]),
                    "actual_next_month_energy_cost": float(row[TARGET_COLUMN]),
                    "model": best_name,
                    "predicted_next_month_energy_cost": float(y_pred_test[pos]),
                    "split": "test",
                    "residual": float(row[TARGET_COLUMN] - y_pred_test[pos]),
                }
            )

    # Persist predictions CSV
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    preds_df = pd.DataFrame(predictions_rows)
    if not preds_df.empty:
        preds_df.to_csv(PREDICTIONS_CSV, index=False, encoding=DEFAULT_ENCODING)

    # Build evaluation report
    eval_report = {
        "generated_at": _current_ts(),
        "dataset_path": str(INPUT_PATH),
        "target": TARGET_COLUMN,
        "split_strategy": {"type": "chronological", "train_end_period": 18, "val_end_period": 21},
        "split_source": split_source,
        "row_counts": {"validation": int(len(val_df)), "test": int(len(test_df)), "null_target": int(frame[TARGET_COLUMN].isna().sum())},
        "validation_metrics": validation_metrics,
        "selected_model": best_name,
        "selection_rule": "validation_mae (lower_is_better); tie-breaker: rmse; mae_tol=1e-6",
        "test_metrics": test_metrics,
        "artifact_paths": report.get("artifacts", {}),
        "leakage_controls": [
            "do_not_fit_models",
            "use_persisted_pipelines_only",
            "use_exact_split_membership",
            "exclude_null_targets",
        ],
        "reproducibility": report.get("reproducibility", {}),
    }

    EVAL_REPORT.write_text(json.dumps(eval_report, indent=2), encoding=DEFAULT_ENCODING)
    return eval_report


def main():
    report = evaluate()
    print("Model evaluation complete.")
    print("Report:", EVAL_REPORT)
    return report


if __name__ == "__main__":
    main()
