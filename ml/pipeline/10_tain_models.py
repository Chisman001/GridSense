"""Stage 10: Model training pipeline.

Implements a leakage-safe, chronological train/validation/test split and trains
multiple regressors (Linear Regression, Random Forest, optional XGBoost and
LightGBM when available). Persists model pipelines and a training report.

This module is intentionally conservative about features: it consumes the
Stage 09 final CSV and excludes identifier fields and any next-month/future
columns. The split is configurable but defaults to a chronological split by
calendar period (year/month) so that no future data leaks into training.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import json
import time
import sys
from typing import Any

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor

from config import FINAL_DATA_DIR, MODELS_DIR, MODEL_REPORT_DIR, CSV_SEPARATOR, DEFAULT_ENCODING, RANDOM_SEED


TARGET_COLUMN = "next_month_energy_cost"
INPUT_PATH = FINAL_DATA_DIR / "energy_records.csv"
MODEL_DIR = MODELS_DIR
REPORT_PATH = MODEL_REPORT_DIR / "model_training_report.json"


def _current_ts() -> str:
	return datetime.now().isoformat()


def load_dataset(path: Path = INPUT_PATH) -> pd.DataFrame:
	if not path.is_file():
		raise FileNotFoundError(f"Training dataset not found: {path}")
	return pd.read_csv(path, sep=CSV_SEPARATOR, encoding=DEFAULT_ENCODING)


def validate_training_data(frame: pd.DataFrame) -> None:
	if TARGET_COLUMN not in frame.columns:
		raise ValueError(f"Target column {TARGET_COLUMN} not found in dataset.")


def identify_features(frame: pd.DataFrame) -> dict[str, list[str]]:
	# Conservative exclusions
	exclude = {"record_id", "business_id", "business_name", "created_at", "city", TARGET_COLUMN}
	cols = [c for c in frame.columns if c not in exclude]

	# Heuristics for categorical vs numeric
	categorical = [
		c
		for c in cols
		if frame[c].dtype == object or c in ("business_type", "industry", "state", "energy_source")
	]
	# remove high-cardinality textual fields (we exclude city from modeling)
	categorical = [c for c in categorical if c not in ("city",)]
	numeric = [c for c in cols if c not in categorical]

	identifier = ["record_id", "business_id", "business_name", "created_at"]
	time_columns = [c for c in ("year", "month", "quarter") if c in frame.columns]

	return {
		"features": cols,
		"numeric": [c for c in numeric if c in cols],
		"categorical": [c for c in categorical if c in cols],
		"identifiers": [c for c in identifier if c in frame.columns],
		"time_columns": time_columns,
		"excluded": list(exclude),
	}


def build_preprocessor(numeric_features: list[str], categorical_features: list[str]) -> ColumnTransformer:
	num_pipe = Pipeline(
		[
			("imputer", SimpleImputer(strategy="median")),
			("scaler", StandardScaler()),
		]
	)
	cat_pipe = Pipeline(
		[
			("imputer", SimpleImputer(strategy="constant", fill_value="<MISSING>")),
			("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
		]
	)
	transformers = []
	if numeric_features:
		transformers.append(("num", num_pipe, numeric_features))
	if categorical_features:
		transformers.append(("cat", cat_pipe, categorical_features))
	return ColumnTransformer(transformers=transformers, remainder="drop")


def _period_number(year: int, month: int, base_year: int = 2024) -> int:
	return (int(year) - base_year) * 12 + int(month)


def split_chronological(
	frame: pd.DataFrame,
	train_end_period: int = 18,  # months from Jan 2024, i.e., first 18 months → train
	val_end_period: int = 21,  # next 3 months → val, remaining → test
	base_year: int = 2024,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
	f = frame.copy()
	f["_period"] = f.apply(lambda r: _period_number(int(r["year"]), int(r["month"]), base_year), axis=1)
	# Exclude rows without observed target for supervised steps
	supervised = f[f[TARGET_COLUMN].notna()].copy()

	train = supervised[supervised["_period"] <= train_end_period].copy()
	val = supervised[(supervised["_period"] > train_end_period) & (supervised["_period"] <= val_end_period)].copy()
	test = supervised[supervised["_period"] > val_end_period].copy()

	return train.drop(columns=["_period"]), val.drop(columns=["_period"]), test.drop(columns=["_period"])


def build_models(seed: int = RANDOM_SEED) -> dict[str, Any]:
	models: dict[str, Any] = {}
	models["linear_regression"] = LinearRegression()
	models["random_forest"] = RandomForestRegressor(n_estimators=100, random_state=seed, n_jobs=-1)

	# optional models
	try:
		import xgboost as xgb  # type: ignore

		models["xgboost"] = xgb.XGBRegressor(random_state=seed, verbosity=0)
	except Exception:
		models["xgboost"] = None

	try:
		import lightgbm as lgb  # type: ignore

		models["lightgbm"] = lgb.LGBMRegressor(random_state=seed)
	except Exception:
		models["lightgbm"] = None

	return models


def train_models(
	frame: pd.DataFrame,
	preprocessor: ColumnTransformer,
	features: list[str],
	models: dict[str, Any],
	seed: int = RANDOM_SEED,
) -> dict[str, dict[str, Any]]:
	X = frame[features]
	y = frame[TARGET_COLUMN]

	results: dict[str, dict[str, Any]] = {}
	for name, model in models.items():
		if model is None:
			results[name] = {"status": "skipped", "reason": "missing dependency"}
			continue
		pipeline = Pipeline([("preprocessor", preprocessor), ("estimator", model)])
		start = time.time()
		pipeline.fit(X, y)
		duration = time.time() - start
		results[name] = {"status": "trained", "duration_seconds": duration, "pipeline": pipeline}
	return results


def save_artifacts(trained: dict[str, dict[str, Any]], model_dir: Path = MODEL_DIR) -> dict[str, str]:
	model_dir.mkdir(parents=True, exist_ok=True)
	paths: dict[str, str] = {}
	for name, info in trained.items():
		if info.get("status") != "trained":
			continue
		pipeline = info["pipeline"]
		path = model_dir / f"{name}.joblib"
		joblib.dump(pipeline, path)
		paths[name] = str(path)
	return paths


def write_report(
	dataset_path: Path,
	feature_info: dict[str, list[str]],
	splits: dict[str, int],
	trained: dict[str, dict[str, Any]],
	artifact_paths: dict[str, str],
	report_path: Path = REPORT_PATH,
) -> dict[str, Any]:
	payload = {
		"generated_at": _current_ts(),
		"dataset_path": str(dataset_path),
		"target": TARGET_COLUMN,
		"features": feature_info["features"],
		"excluded": feature_info["excluded"],
		"numeric": feature_info["numeric"],
		"categorical": feature_info["categorical"],
		"split_strategy": {
			"train_end_period": splits["train_end_period"],
			"val_end_period": splits["val_end_period"],
		},
		"train_rows": int(splits["train_rows"]),
		"val_rows": int(splits["val_rows"]),
		"test_rows": int(splits["test_rows"]),
		"null_target_rows": int(splits["null_target_rows"]),
		"models": {},
		"artifacts": artifact_paths,
		"reproducibility": {
			"python_version": sys.version,
			"sklearn_version": getattr(__import__("sklearn"), "__version__", None),
			"joblib_version": getattr(joblib, "__version__", None),
			"random_seed": int(RANDOM_SEED),
		},
	}
	for name, info in trained.items():
		payload["models"][name] = {k: v for k, v in info.items() if k != "pipeline"}

	report_path.parent.mkdir(parents=True, exist_ok=True)
	with report_path.open("w", encoding=DEFAULT_ENCODING) as f:
		json.dump(payload, f, indent=2)
	return payload


def main() -> dict[str, Any]:
	frame = load_dataset()
	validate_training_data(frame)
	feature_info = identify_features(frame)

	# chronological split configuration (period numbers relative to Jan 2024)
	train_end = 18
	val_end = 21

	train, val, test = split_chronological(frame, train_end_period=train_end, val_end_period=val_end)

	splits = {
		"train_end_period": train_end,
		"val_end_period": val_end,
		"train_rows": len(train),
		"val_rows": len(val),
		"test_rows": len(test),
		"null_target_rows": int(frame[TARGET_COLUMN].isna().sum()),
	}

	# Persist split metadata (record_id lists) for downstream evaluation stages
	split_meta = {
		"generated_at": _current_ts(),
		"train_record_ids": train["record_id"].tolist(),
		"val_record_ids": val["record_id"].tolist(),
		"test_record_ids": test["record_id"].tolist(),
	}
	split_meta_path = MODEL_REPORT_DIR / "split_metadata.json"
	split_meta_path.parent.mkdir(parents=True, exist_ok=True)
	with split_meta_path.open("w", encoding=DEFAULT_ENCODING) as f:
		json.dump(split_meta, f, indent=2)


	preprocessor = build_preprocessor(feature_info["numeric"], feature_info["categorical"])
	models = build_models()

	trained = train_models(train, preprocessor, feature_info["features"], models)
	artifact_paths = save_artifacts(trained)
	report = write_report(INPUT_PATH, feature_info, splits, trained, artifact_paths)
	return report


if __name__ == "__main__":
	report = main()
	print("Model training complete.")
	print("Report:", REPORT_PATH)
