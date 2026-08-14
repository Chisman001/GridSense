from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from google import genai


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

load_dotenv()

# ---------------------------------------------------------------------------
# Gemini configuration
# ---------------------------------------------------------------------------

MODEL_NAME = "gemini-3.5-flash-lite"


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTION = """
You are the AI insights assistant for GridSense, an energy-cost
forecasting platform for businesses in Nigeria.

Analyze the numerical forecast and business analytics provided to you
and return concise, practical insights.

IMPORTANT CURRENCY RULE:
- GridSense operates in Nigeria.
- ALL monetary values are in Nigerian Naira (NGN).
- Always use the ₦ symbol when referring to monetary amounts.
- NEVER use $, USD, US dollars, €, £, or any other currency symbol.
- For example, write ₦8,091,088.99, not $8,091,088.99.
- If a monetary value is provided without a currency symbol, assume it
  is Nigerian Naira.

Return valid JSON with exactly these fields:
{
  "summary": "string",
  "key_insights": ["string", "..."],
  "recommendations": ["string", "..."],
  "risk_level": "low | moderate | high"
}

Keep the analysis grounded strictly in the provided prediction and
analytics. Do not invent numerical values.
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class GeminiServiceError(RuntimeError):
    """
    Safe Gemini service error that can be mapped to an HTTP response.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        error_code: str,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


def _get_client() -> Any:
    """
    Create the Gemini client only when insights are requested.
    """

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise GeminiServiceError(
            "AI insights are not configured.",
            status_code=503,
            error_code="AI_NOT_CONFIGURED",
        )

    return genai.Client(api_key=api_key)


def _provider_status_code(error: Exception) -> int | None:
    """
    Read an HTTP-style status code from a Google GenAI exception.
    """

    for attribute in ("code", "status_code"):
        value = getattr(error, attribute, None)

        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue

    return None


def _map_provider_error(error: Exception) -> GeminiServiceError:
    status_code = _provider_status_code(error)

    if status_code == 429:
        return GeminiServiceError(
            "AI insights are temporarily rate limited. Please try again.",
            status_code=429,
            error_code="AI_RATE_LIMITED",
        )

    if status_code == 503:
        return GeminiServiceError(
            "AI insights are temporarily unavailable. Please try again.",
            status_code=503,
            error_code="AI_UNAVAILABLE",
        )

    return GeminiServiceError(
        "The AI insights provider could not complete the request.",
        status_code=502,
        error_code="AI_PROVIDER_ERROR",
    )


def _extract_response_text(response: Any) -> str:
    """
    Extract text from a Gemini response.
    """

    text = getattr(response, "text", None)

    if text:
        return text.strip()

    raise RuntimeError(
        "Gemini returned an empty response."
    )


def _parse_json_response(text: str) -> dict[str, Any]:
    """
    Parse Gemini's JSON response safely.
    """

    cleaned = text.strip()

    # Handle accidental Markdown code fences.
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()

        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        cleaned = "\n".join(lines).strip()

        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Gemini returned invalid JSON: {text}"
        ) from exc

    if not isinstance(result, dict):
        raise RuntimeError(
            "Gemini response must be a JSON object."
        )

    return result


def _validate_insights(
    result: dict[str, Any],
) -> dict[str, Any]:
    """
    Ensure Gemini returned the expected structure.
    """

    required_fields = (
        "summary",
        "key_insights",
        "recommendations",
        "risk_level",
    )

    for field in required_fields:
        if field not in result:
            raise RuntimeError(
                f"Gemini response is missing required field: {field}"
            )

    if not isinstance(result["summary"], str):
        raise RuntimeError(
            "Gemini summary must be a string."
        )

    if not isinstance(result["key_insights"], list):
        raise RuntimeError(
            "Gemini key_insights must be a list."
        )

    if not isinstance(result["recommendations"], list):
        raise RuntimeError(
            "Gemini recommendations must be a list."
        )

    if result["risk_level"] not in {
        "low",
        "moderate",
        "high",
    }:
        raise RuntimeError(
            "Gemini risk_level must be low, moderate, or high."
        )

    return result


# ---------------------------------------------------------------------------
# Public service
# ---------------------------------------------------------------------------

def generate_energy_insights(
    llm_context: dict[str, Any],
) -> dict[str, Any]:
    """
    Generate readable business insights from Stage 12 analytics.

    Gemini interprets the ML output. It does NOT generate the prediction.
    """

    prompt = f"""
Analyze this GridSense forecast for a Nigerian business.

IMPORTANT:
All monetary values in the provided data are Nigerian Naira (NGN).
Use the ₦ symbol for every monetary amount.
Never use $, USD, €, £, or any other currency.

GridSense prediction context:

{json.dumps(llm_context, indent=2, default=str)}

Provide the requested business interpretation.
"""

    client = _get_client()

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={
                "system_instruction": SYSTEM_INSTRUCTION,
                "temperature": 0.2,
                "response_mime_type": "application/json",
            },
        )
    except GeminiServiceError:
        raise
    except Exception as exc:
        raise _map_provider_error(exc) from exc

    text = _extract_response_text(response)

    result = _parse_json_response(text)

    return _validate_insights(result)