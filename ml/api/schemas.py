from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    """
    Input payload for a GridSense energy-cost prediction.

    The fields below correspond to the features required
    by the Stage 12 inference pipeline.
    """

    # Categorical features
    business_type: str
    industry: str
    state: str
    energy_source: str

    # Time features
    year: int = Field(..., ge=2000, le=2100)
    month: int = Field(..., ge=1, le=12)
    quarter: int = Field(..., ge=1, le=4)

    # Energy cost features
    electricity_bill: float = Field(..., ge=0)
    diesel_cost: float = Field(..., ge=0)
    petrol_cost: float = Field(..., ge=0)
    total_energy_cost: float = Field(..., ge=0)

    # Energy usage features
    energy_consumption_kwh: float = Field(..., ge=0)
    fuel_consumption_liters: float = Field(..., ge=0)

    # Operational features
    generator_hours: float = Field(..., ge=0)
    grid_hours: float = Field(..., ge=0)
    outage_hours: float = Field(..., ge=0)
    operating_hours: float = Field(..., ge=0)

    # Business / workforce features
    employee_count: int | None = Field(default=None, ge=0)
    employees: int = Field(..., ge=0)
    occupancy_rate: float = Field(..., ge=0, le=100)

    # Building / physical features
    floor_area_sqm: float = Field(..., ge=0)

    # Renewable / energy infrastructure
    solar_capacity_kw: float = Field(..., ge=0)
    renewable_energy_percentage: float = Field(
        ...,
        ge=0,
        le=100,
    )

    # Financial / business performance
    maintenance_cost: float = Field(..., ge=0)
    monthly_revenue: float = Field(..., ge=0)

    # Derived efficiency / ratio features
    energy_cost_per_employee: float = Field(..., ge=0)
    cost_per_kwh: float = Field(..., ge=0)
    average_monthly_energy_cost: float | None = Field(default=None, ge=0)
    energy_efficiency_score: float | None = None
    generator_dependency: float = Field(..., ge=0)
    revenue_energy_ratio: float = Field(..., ge=0)

    # Reliability / environmental features
    outage_severity: float = Field(..., ge=0)
    weather_avg_temp: float
    estimated_carbon_intensity: float = Field(..., ge=0)

    class Config:
        extra = "allow"


class InsightResponse(BaseModel):
    summary: str
    key_insights: list[str]
    recommendations: list[str]
    risk_level: str


class InsightsRequest(BaseModel):
    prediction: float
    analytics: dict[str, Any]


class PredictionResponse(BaseModel):
    predicted_next_month_energy_cost: float
    model: str
    features_used: int

    analytics: dict[str, Any] | None = None
    input_summary: dict[str, Any] | None = None
    llm_context: dict[str, Any] | None = None
    insights: InsightResponse | None = None
    generated_at: str | None = None

class HealthResponse(BaseModel):
    status: str
    service: str


class ModelResponse(BaseModel):
    model: str
    status: str