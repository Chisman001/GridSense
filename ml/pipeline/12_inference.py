"""
Stage 12: Model inference / application layer.

Loads the persisted best model selected during Stage 11 and provides a
reusable inference layer for predicting next-month energy cost.

This stage does NOT train or refit any model.

Responsibilities:
- Load the persisted LightGBM pipeline.
- Load the Stage 10 training report to recover the exact feature contract.
- Validate incoming business data.
- Apply the persisted preprocessing + model pipeline.
- Produce a prediction for next-month energy cost.
- Calculate useful business-facing analytics.
- Return structured output suitable for the FastAPI backend and
  downstream LLM insight generation.

The inference layer is intentionally independent of FastAPI and Next.js.
Those application layers can import and call these functions directly.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import json
import math

import joblib
import numpy as np
import pandas as pd

from pathlib import Path
import sys

# Ensure the project root is searched before ml/pipeline/
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    # Works when running 12_inference.py directly
    from config import (
        FINAL_DATA_DIR,
        MODELS_DIR,
        MODEL_REPORT_DIR,
        CSV_SEPARATOR,
        DEFAULT_ENCODING,
        RANDOM_SEED,
    )
except ModuleNotFoundError:
    # Works when Stage 12 is loaded as part of the ml.pipeline package
    from ml.pipeline.config import (
        FINAL_DATA_DIR,
        MODELS_DIR,
        MODEL_REPORT_DIR,
        CSV_SEPARATOR,
        DEFAULT_ENCODING,
        RANDOM_SEED,
    )


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

INPUT_PATH = FINAL_DATA_DIR / "energy_records.csv"

TRAINING_REPORT_PATH = MODEL_REPORT_DIR / "model_training_report.json"

MODEL_EVALUATION_REPORT_PATH = (
    MODEL_REPORT_DIR / "model_evaluation" / "model_evaluation_report.json"
)

# Stage 11 selected LightGBM as the best validation model.
DEFAULT_MODEL_NAME = "lightgbm"

MODEL_PATH = MODELS_DIR / f"{DEFAULT_MODEL_NAME}.joblib"

# Fields that must never be supplied to the model as prediction features.
IDENTIFIER_COLUMNS = {
    "record_id",
    "business_id",
    "business_name",
    "created_at",
    "city",
}

TARGET_COLUMN = "next_month_energy_cost"

# Target is never an inference input.
TARGET_FIELDS = {
    TARGET_COLUMN,
}


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class InferenceResult:
    """Structured result returned by the inference layer."""

    model: str
    predicted_next_month_energy_cost: float
    current_total_energy_cost: float | None
    prediction_change: float | None
    prediction_change_percent: float | None
    generated_at: str


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def _current_ts() -> str:
    """Return the current timestamp in ISO format."""
    return datetime.now().isoformat()


def _ensure_finite(value: Any, field_name: str) -> float:
    """
    Convert a value to float and ensure it is finite.

    Raises:
        ValueError: if the value cannot be converted to a finite number.
    """
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"Field '{field_name}' must be numeric."
        ) from exc

    if not math.isfinite(number):
        raise ValueError(
            f"Field '{field_name}' must contain a finite numeric value."
        )

    return number


# ---------------------------------------------------------------------------
# Training contract
# ---------------------------------------------------------------------------

def load_training_report(
    path: Path = TRAINING_REPORT_PATH,
) -> dict[str, Any]:
    """Load the Stage 10 model training report."""

    if not path.is_file():
        raise FileNotFoundError(
            f"Training report not found: {path}"
        )

    with path.open("r", encoding=DEFAULT_ENCODING) as file:
        report = json.load(file)

    if not isinstance(report, dict):
        raise ValueError("Training report must contain a JSON object.")

    return report


def load_evaluation_report(
    path: Path = MODEL_EVALUATION_REPORT_PATH,
) -> dict[str, Any] | None:
    """
    Load the Stage 11 evaluation report if available.

    The inference layer does not depend on the evaluation report, but
    using it allows us to verify which model Stage 11 selected.
    """

    if not path.is_file():
        return None

    with path.open("r", encoding=DEFAULT_ENCODING) as file:
        report = json.load(file)

    if not isinstance(report, dict):
        raise ValueError("Evaluation report must contain a JSON object.")

    return report


def get_feature_contract(
    training_report: dict[str, Any],
) -> list[str]:
    """
    Return the exact feature list used during Stage 10 training.
    """

    features = training_report.get("features")

    if not isinstance(features, list) or not features:
        raise ValueError(
            "Training report does not contain a valid feature list."
        )

    return [str(feature) for feature in features]


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def get_selected_model_name(
    evaluation_report: dict[str, Any] | None,
) -> str:
    """
    Determine the selected model.

    Stage 11 is the authoritative source for model selection.
    LightGBM is used as the fallback because it was the selected model
    in the completed Stage 11 evaluation.
    """

    if evaluation_report:
        selected_model = evaluation_report.get("selected_model")

        if isinstance(selected_model, str) and selected_model.strip():
            return selected_model

    return DEFAULT_MODEL_NAME


def load_model(
    model_name: str | None = None,
    model_path: Path | None = None,
):
    """
    Load a persisted model pipeline.

    No fitting or retraining occurs here.
    """

    if model_path is None:
        if model_name is None:
            model_name = DEFAULT_MODEL_NAME

        model_path = MODELS_DIR / f"{model_name}.joblib"

    if not model_path.is_file():
        raise FileNotFoundError(
            f"Persisted model not found: {model_path}"
        )

    return joblib.load(model_path)


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

def validate_input_columns(
    data: pd.DataFrame,
    features: list[str],
) -> None:
    """
    Ensure all model-required features are present.

    Extra columns are allowed because application payloads may contain
    identifiers or metadata that are not model features.
    """

    missing = [
        feature
        for feature in features
        if feature not in data.columns
    ]

    if missing:
        raise ValueError(
            "Missing required model features: "
            + ", ".join(missing)
        )


def clean_input_data(
    data: pd.DataFrame,
    features: list[str],
) -> pd.DataFrame:
    """
    Prepare inference data while preserving the Stage 10 feature contract.

    Only the exact training features are passed into the persisted
    preprocessing/model pipeline.
    """

    if data.empty:
        raise ValueError("Inference input cannot be empty.")

    validate_input_columns(data, features)

    X = data[features].copy()

    # Prevent target leakage.
    if TARGET_COLUMN in X.columns:
        raise ValueError(
            f"Target column '{TARGET_COLUMN}' must not be supplied "
            "as an inference feature."
        )

    # Ensure the resulting feature matrix has exactly the training schema.
    X = X.loc[:, features]

    return X


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def predict(
    data: pd.DataFrame,
    model_name: str | None = None,
) -> np.ndarray:
    """
    Predict next-month energy cost for one or more business records.

    The persisted pipeline performs preprocessing and model inference.

    IMPORTANT:
    This function intentionally calls predict() only.
    It never calls fit().
    """

    training_report = load_training_report()
    evaluation_report = load_evaluation_report()

    features = get_feature_contract(training_report)

    if model_name is None:
        model_name = get_selected_model_name(evaluation_report)

    pipeline = load_model(model_name=model_name)

    X = clean_input_data(data, features)

    predictions = pipeline.predict(X)

    predictions = np.asarray(predictions, dtype=float)

    if predictions.ndim != 1:
        predictions = predictions.reshape(-1)

    if not np.all(np.isfinite(predictions)):
        raise ValueError(
            "Model produced non-finite predictions."
        )

    return predictions


def predict_one(
    data: dict[str, Any],
    model_name: str | None = None,
) -> InferenceResult:
    """
    Predict next-month energy cost for one business record.
    """

    frame = pd.DataFrame([data])

    predictions = predict(
        frame,
        model_name=model_name,
    )

    prediction = float(predictions[0])

    current_cost = None

    if "total_energy_cost" in frame.columns:
        value = frame.iloc[0]["total_energy_cost"]

        if pd.notna(value):
            current_cost = _ensure_finite(
                value,
                "total_energy_cost",
            )

    prediction_change = None
    prediction_change_percent = None

    if current_cost is not None:
        prediction_change = prediction - current_cost

        if abs(current_cost) > 1e-12:
            prediction_change_percent = (
                prediction_change / current_cost
            ) * 100.0

    return InferenceResult(
        model=model_name or get_selected_model_name(
            load_evaluation_report()
        ),
        predicted_next_month_energy_cost=prediction,
        current_total_energy_cost=current_cost,
        prediction_change=prediction_change,
        prediction_change_percent=prediction_change_percent,
        generated_at=_current_ts(),
    )


# ---------------------------------------------------------------------------
# Business analytics
# ---------------------------------------------------------------------------

def calculate_business_analytics(
    data: dict[str, Any],
    prediction: float,
) -> dict[str, Any]:
    """
    Calculate additional business-facing indicators.

    These values are deterministic calculations and are intentionally
    separate from the ML prediction.

    The resulting dictionary is suitable for:
    - FastAPI responses
    - dashboard cards
    - LLM insight generation
    """

    analytics: dict[str, Any] = {}

    current_cost = data.get("total_energy_cost")

    if current_cost is not None and pd.notna(current_cost):
        current_cost = _ensure_finite(
            current_cost,
            "total_energy_cost",
        )

        change = prediction - current_cost

        analytics["current_energy_cost"] = current_cost
        analytics["predicted_energy_cost"] = prediction
        analytics["predicted_change"] = change

        if abs(current_cost) > 1e-12:
            analytics["predicted_change_percent"] = (
                change / current_cost
            ) * 100.0

    # Cost per employee.
    employees = data.get("employees")

    if employees is not None and pd.notna(employees):
        employees = _ensure_finite(
            employees,
            "employees",
        )

        if employees > 0:
            analytics["predicted_cost_per_employee"] = (
                prediction / employees
            )

    # Cost per kWh.
    energy_consumption = data.get("energy_consumption_kwh")

    if (
        energy_consumption is not None
        and pd.notna(energy_consumption)
    ):
        energy_consumption = _ensure_finite(
            energy_consumption,
            "energy_consumption_kwh",
        )

        if energy_consumption > 0:
            analytics["predicted_cost_per_kwh"] = (
                prediction / energy_consumption
            )

    # Generator dependency indicator.
    generator_hours = data.get("generator_hours")
    grid_hours = data.get("grid_hours")

    if (
        generator_hours is not None
        and grid_hours is not None
        and pd.notna(generator_hours)
        and pd.notna(grid_hours)
    ):
        generator_hours = _ensure_finite(
            generator_hours,
            "generator_hours",
        )

        grid_hours = _ensure_finite(
            grid_hours,
            "grid_hours",
        )

        total_hours = generator_hours + grid_hours

        if total_hours > 0:
            analytics["generator_dependency_percent"] = (
                generator_hours / total_hours
            ) * 100.0

    # Outage hours.
    outage_hours = data.get("outage_hours")

    if outage_hours is not None and pd.notna(outage_hours):
        analytics["outage_hours"] = _ensure_finite(
            outage_hours,
            "outage_hours",
        )

    # Revenue-to-energy-cost ratio.
    monthly_revenue = data.get("monthly_revenue")

    if (
        monthly_revenue is not None
        and pd.notna(monthly_revenue)
    ):
        monthly_revenue = _ensure_finite(
            monthly_revenue,
            "monthly_revenue",
        )

        if monthly_revenue > 0:
            analytics["predicted_energy_cost_as_percent_of_revenue"] = (
                prediction / monthly_revenue
            ) * 100.0

    return analytics


# ---------------------------------------------------------------------------
# Application-ready prediction
# ---------------------------------------------------------------------------

def generate_prediction_response(
    data: dict[str, Any],
    model_name: str | None = None,
) -> dict[str, Any]:
    """
    Generate a complete structured prediction response.

    This is the main function intended for the FastAPI backend.

    The response deliberately contains structured numerical information
    rather than an LLM-generated explanation. The LLM layer can consume
    this response later and turn it into natural-language insights.
    """

    frame = pd.DataFrame([data])

    training_report = load_training_report()
    evaluation_report = load_evaluation_report()

    features = get_feature_contract(training_report)

    if model_name is None:
        model_name = get_selected_model_name(
            evaluation_report
        )

    pipeline = load_model(
        model_name=model_name
    )

    X = clean_input_data(
        frame,
        features,
    )

    predictions = np.asarray(
        pipeline.predict(X),
        dtype=float,
    ).reshape(-1)

    if len(predictions) != 1:
        raise ValueError(
            "Expected exactly one prediction."
        )

    prediction = float(predictions[0])

    if not math.isfinite(prediction):
        raise ValueError(
            "Model produced a non-finite prediction."
        )

    analytics = calculate_business_analytics(
        data,
        prediction,
    )

    return {
        "prediction": {
            "target": TARGET_COLUMN,
            "predicted_next_month_energy_cost": prediction,
            "model": model_name,
        },
        "analytics": analytics,
        "input_summary": {
            key: value
            for key, value in data.items()
            if key not in TARGET_FIELDS
        },
        "llm_context": {
            "prediction": prediction,
            "analytics": analytics,
        },
        "generated_at": _current_ts(),
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    """
    Basic command-line verification.

    Uses the first supervised record from the final dataset.
    This is only a smoke test and does not modify the model.
    """

    if not INPUT_PATH.is_file():
        raise FileNotFoundError(
            f"Final dataset not found: {INPUT_PATH}"
        )

    frame = pd.read_csv(
        INPUT_PATH,
        encoding=DEFAULT_ENCODING,
    )

    training_report = load_training_report()
    features = get_feature_contract(training_report)

    supervised = frame[
        frame[TARGET_COLUMN].notna()
    ].copy()

    if supervised.empty:
        raise ValueError(
            "No supervised rows available for smoke test."
        )

    sample = supervised.iloc[0].to_dict()

    result = generate_prediction_response(
        sample
    )

    print("Stage 12 inference smoke test complete.")
    print(
        "Model:",
        result["prediction"]["model"],
    )
    print(
        "Predicted next-month energy cost:",
        result["prediction"][
            "predicted_next_month_energy_cost"
        ],
    )
    print(
        "Features used:",
        len(features),
    )


if __name__ == "__main__":
    main()