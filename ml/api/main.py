from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Project paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

PIPELINE_DIR = PROJECT_ROOT / "ml" / "pipeline"

if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))


# ---------------------------------------------------------------------------
# Stage 12 inference
# ---------------------------------------------------------------------------

import importlib.util


STAGE_12_PATH = PIPELINE_DIR / "12_inference.py"


def load_stage_12():
    if not STAGE_12_PATH.is_file():
        raise FileNotFoundError(
            f"Stage 12 inference module not found: {STAGE_12_PATH}"
        )

    spec = importlib.util.spec_from_file_location(
        "gridsense_stage12",
        STAGE_12_PATH,
    )

    if spec is None or spec.loader is None:
        raise ImportError(
            f"Could not load Stage 12 from {STAGE_12_PATH}"
        )

    module = importlib.util.module_from_spec(spec)

    # Required for dataclasses/introspection inside Stage 12.
    sys.modules[spec.name] = module

    spec.loader.exec_module(module)

    return module


stage12 = load_stage_12()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

from ml.api.schemas import (
    HealthResponse,
    InsightResponse,
    InsightsRequest,
    ModelResponse,
    PredictionRequest,
    PredictionResponse,
)

from ml.api.llm_service import (
    GeminiServiceError,
    generate_energy_insights,
)


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="GridSense API",
    description=(
        "Backend API for GridSense energy-cost forecasting. "
        "Uses the persisted Stage 12 LightGBM inference pipeline."
    ),
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

load_dotenv()

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

configured_frontend_urls = os.getenv(
    "FRONTEND_URL",
    "",
)

for frontend_url in configured_frontend_urls.split(","):
    normalized_url = frontend_url.strip().rstrip("/")

    if normalized_url and normalized_url not in allowed_origins:
        allowed_origins.append(normalized_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_model_name() -> str:
    """
    Return the model currently used by Stage 12.
    """

    for attribute in (
        "MODEL_NAME",
        "SELECTED_MODEL",
        "DEFAULT_MODEL",
    ):
        value = getattr(stage12, attribute, None)

        if value:
            return str(value)

    return "lightgbm"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    response_model=HealthResponse,
)
def health() -> HealthResponse:
    """
    Basic API health check.
    """

    return HealthResponse(
        status="healthy",
        service="gridsense-api",
    )


@app.get(
    "/model",
    response_model=ModelResponse,
)
def model_info() -> ModelResponse:
    """
    Return information about the active prediction model.
    """

    return ModelResponse(
        model=get_model_name(),
        status="loaded",
    )
    
@app.post(
    "/predict",
    response_model=PredictionResponse,
)
def predict(payload: PredictionRequest) -> PredictionResponse:
    """
    Generate an energy-cost prediction and deterministic analytics.

    Stage 12 performs the numerical prediction and business analytics.
    AI insights are generated independently through the /insights route.
    """

    try:
        data = payload.model_dump()

        # ---------------------------------------------------------------
        # Stage 12: prediction + analytics
        # ---------------------------------------------------------------

        result = stage12.generate_prediction_response(
            data=data
        )

        if not isinstance(result, dict):
            raise RuntimeError(
                "Stage 12 returned an unexpected response."
            )

        prediction_data = result.get("prediction", {})

        if not isinstance(prediction_data, dict):
            raise RuntimeError(
                "Stage 12 prediction section is invalid."
            )

        prediction = prediction_data.get(
            "predicted_next_month_energy_cost"
        )

        if prediction is None:
            raise RuntimeError(
                "Stage 12 response does not contain a prediction."
            )

        analytics = result.get(
            "analytics",
            {},
        )

        input_summary = result.get(
            "input_summary",
            {},
        )

        llm_context = result.get(
            "llm_context",
            {},
        )

        generated_at = result.get(
            "generated_at"
        )

        # ---------------------------------------------------------------
        # Feature count
        # ---------------------------------------------------------------

        features_used = len(data)

        if isinstance(input_summary, dict):
            summary_features = input_summary.get(
                "features_used"
            )

            if isinstance(
                summary_features,
                (int, float),
            ):
                features_used = int(summary_features)

        # ---------------------------------------------------------------
        # Build API response
        # ---------------------------------------------------------------

        return PredictionResponse(
            predicted_next_month_energy_cost=float(
                prediction
            ),
            model=get_model_name(),
            features_used=features_used,
            analytics=analytics,
            input_summary=input_summary,
            llm_context=llm_context,
            insights=None,
            generated_at=generated_at,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {exc}",
        ) from exc
        
@app.post(
    "/insights",
    response_model=InsightResponse,
)
def generate_insights(
    payload: InsightsRequest,
) -> InsightResponse:
    """
    Generate Gemini-powered insights from forecast context.
    """

    try:
        result = generate_energy_insights(
            payload.model_dump()
        )

        if not isinstance(result, dict):
            raise RuntimeError(
                "Gemini returned an unexpected response."
            )

        return InsightResponse.model_validate(result)

    except GeminiServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "code": exc.error_code,
                "message": str(exc),
            },
        ) from exc

    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "AI_RESPONSE_INVALID",
                "message": "AI insights returned an invalid response.",
            },
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "AI_INSIGHTS_FAILED",
                "message": "Failed to generate AI insights.",
            },
        ) from exc

@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "GridSense API",
        "status": "running",
        "docs": "/docs",
    }