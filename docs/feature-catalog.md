# Feature Catalog

**Project:** GridSense AI

**Version:** 1.0

**Last Updated:** August 2026

---

# Overview

This document defines every feature used throughout the GridSense AI platform.

Each feature is classified according to:

- Data Type
- Feature Category
- Source
- Usage
- Importance
- Expected Range
- Engineering Method

---

# Feature Categories

| Category | Description |
|----------|-------------|
| Raw | Imported directly from public datasets |
| Generated | Created by the SME Rule Engine |
| Engineered | Calculated from existing features |
| Target | Variable predicted by the ML model |

---

# Raw Features

## building_type

**Type**

Categorical

**Source**

Test Energy Data + CBECS

**Used By**

Regression

Recommendation Engine

Dashboard

**Importance**

High

**Example**

Hotel

Bakery

Factory

Hospital

---

## floor_area_sqm

Type

Numerical

Source

Test Energy Data

CBECS

Unit

Square Metres

Importance

High

Expected Range

20–5000

---

## occupants

Type

Integer

Source

Multiple Datasets

Importance

Medium

Expected Range

1–500

---

## energy_consumption_kwh

Type

Float

Source

EnergyData Complete

Household Power

Smart Meter

Importance

★★★★★

Unit

kWh

Expected Range

50–150000

---

## electricity_cost

Type

Float

Source

Energy Consumption Dataset

Importance

★★★★★

Unit

₦

---

## weather_temperature

Type

Float

Source

EnergyData Complete

Importance

Medium

Unit

°C

Expected Range

15–45

---

## operating_hours

Type

Float

Source

CBECS

Importance

High

Expected Range

4–24

---

# Generated Features

These are created by the SME Rule Engine.

---

## employees

Type

Integer

Source

Generated

Importance

Medium

Range

1–300

---

## monthly_revenue

Type

Float

Unit

₦

Importance

High

---

## generator_hours

Type

Float

Importance

★★★★★

Range

0–744

---

## outage_hours

Type

Float

Importance

★★★★★

Range

0–744

---

## diesel_cost

Type

Float

Unit

₦

Importance

High

---

## fuel_consumption_liters

Type

Float

Unit

Litres

Importance

Medium

---

## solar_capacity_kw

Type

Float

Unit

kW

Importance

Medium

---

## occupancy_rate

Type

Percentage

Range

0–100

Importance

Medium

---

# Engineered Features

---

## total_energy_cost

Formula

electricity_cost +
diesel_cost +
petrol_cost

Used By

Regression

Dashboard

Recommendation Engine

Importance

★★★★★

---

## cost_per_kwh

Formula

total_energy_cost /
energy_consumption_kwh

Importance

★★★★★

---

## generator_dependency

Formula

generator_hours /
(generator_hours + grid_hours)

Range

0–1

Importance

★★★★★

---

## revenue_energy_ratio

Formula

monthly_revenue /
total_energy_cost

Importance

★★★★☆

---

## energy_cost_per_employee

Formula

total_energy_cost /
employees

Importance

★★★★☆

---

## outage_severity

Formula

outage_hours /
operating_hours

Importance

★★★★☆

---

## energy_efficiency_score

Type

Composite Score

Range

0–100

Importance

★★★★★

Description

Represents the overall energy performance of the business.

---

# Target Features

## next_month_energy_cost

Type

Regression Target

Predicted By

Random Forest

Linear Regression

Gradient Boosting

Importance

★★★★★

---

# Recommendation Features

The recommendation engine will use:

- Building Type
- Generator Dependency
- Outage Severity
- Energy Cost per Employee
- Revenue-Energy Ratio
- Energy Efficiency Score
- Monthly Cost Trend
- Solar Capacity

to produce personalized recommendations.

---

# Dashboard Features

The dashboard will display:

- Energy Score
- Predicted Cost
- Potential Savings
- Monthly Consumption
- Monthly Cost
- Generator Dependency
- Carbon Estimate
- AI Insights
- Recommendation Priority

---

# Future Features

Future versions may include:

- Carbon Footprint
- Live Tariff Index
- Renewable Energy Ratio
- Battery Storage Capacity
- Smart Meter Health
- Peak Demand Forecast
- Occupancy Forecast
- Dynamic Energy Pricing

---

# Feature Lineage

Every feature belongs to one of four groups:

1. Raw Public Data
2. Generated SME Data
3. Engineered Features
4. Machine Learning Outputs

This ensures complete traceability from data ingestion to AI predictions.