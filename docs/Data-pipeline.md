# GridSense AI Data Pipeline

**Project:** GridSense AI

**Version:** 1.0

**Last Updated:** August 2026

---

# Table of Contents

1. Overview
2. Pipeline Architecture
3. Pipeline Stages
4. Data Sources
5. Cleaning Pipeline
6. Synthetic Data Generation
7. Feature Engineering
8. Validation
9. Dataset Export
10. Folder Structure
11. Future Improvements

---

# 1. Overview

GridSense AI uses a modular data engineering pipeline to transform raw public datasets into a clean, enriched, and machine learning-ready dataset.

Rather than relying entirely on synthetic data, the platform combines real-world energy datasets with rule-based simulations to better represent SME energy usage patterns.

Each pipeline stage performs a single responsibility, making the system easier to maintain, extend, and test.

---

# 2. Pipeline Architecture

```

Public Datasets
        │
        ▼
Data Cleaning
        │
        ▼
Standardization
        │
        ▼
Business Rule Engine
        │
        ▼
Synthetic Data Generator
        │
        ▼
Feature Engineering
        │
        ▼
Validation
        │
        ▼
CSV Export
        │
        ▼
Machine Learning Pipeline

```

---

# 3. Pipeline Stages

Stage 1

Collect public datasets.

↓

Stage 2

Clean missing values.

↓

Stage 3

Normalize units.

↓

Stage 4

Generate SME-specific businesses.

↓

Stage 5

Generate monthly energy records.

↓

Stage 6

Engineer additional features.

↓

Stage 7

Validate the dataset.

↓

Stage 8

Export CSV files.

---

# 4. Public Data Sources

The following datasets will be incorporated where applicable.

## Energy Consumption

- Building Energy Dataset
- Smart Meter Dataset
- Commercial Energy Dataset

## Weather

- Monthly Temperature
- Climate Statistics

## Electricity

- Energy Consumption
- Electricity Tariffs (if available)

## Fuel Prices

- Diesel Prices
- Petrol Prices

These datasets provide realistic distributions and trends that the synthetic data generation process will preserve.

---

# 5. Cleaning Pipeline

Every imported dataset passes through the following process.

## Missing Values

- Remove duplicate rows.
- Fill missing numerical values.
- Handle missing categorical values.

## Formatting

- Standardize column names.
- Convert dates.
- Convert currencies.
- Normalize units.

## Quality Checks

- Remove impossible values.
- Remove corrupted records.
- Check primary keys.

---

# 6. Business Rule Engine

The rule engine introduces SME-specific relationships that may not exist in public datasets.

Examples:

Hotel
→ Higher occupancy
→ Higher electricity demand

Hospital
→ Continuous operations
→ High generator usage

Bakery
→ High daytime energy usage

Cold Room
→ Consistently high electricity demand

Factory
→ High equipment load

School
→ Lower consumption during holidays

Businesses with larger floor areas generally consume more energy.

Businesses with solar installations generally rely less on diesel generators.

---

# 7. Synthetic Data Generator

Synthetic records are generated to increase dataset diversity while preserving realistic relationships.

Generated fields include:

- Business profiles
- Monthly revenue
- Fuel consumption
- Generator hours
- Occupancy rates
- Maintenance costs
- Solar capacity

Random values are constrained by business rules and valid ranges.

---

# 8. Feature Engineering

Derived features include:

Energy Cost per Employee

Generator Dependency Ratio

Revenue-to-Energy Ratio

Cost per kWh

Energy Efficiency Score

Outage Severity Index

Monthly Cost Growth

Average Cost per Operating Hour

Estimated Carbon Intensity

Predicted Monthly Cost

These features become inputs for machine learning models.

---

# 9. Validation

The validation stage ensures dataset quality before training.

Checks include:

✔ No duplicate IDs

✔ No missing primary keys

✔ Positive energy costs

✔ Valid business types

✔ Valid dates

✔ Occupancy between 0 and 100%

✔ Generator hours within monthly limits

✔ Foreign key consistency

Records failing validation are logged and excluded.

---

# 10. Dataset Export

The pipeline exports the following datasets.

businesses.csv

energy_records.csv

recommendations.csv

predictions.csv

Each file is versioned to ensure reproducibility.

---

# 11. Suggested Folder Structure

datasets/

├── raw/

│   ├── public/

│   ├── weather/

│   ├── tariffs/

│   └── fuel/

│

├── cleaned/

│

├── synthetic/

│

├── processed/

│

└── final/

    ├── businesses.csv

    ├── energy_records.csv

    ├── recommendations.csv

    └── predictions.csv

---

# Future Improvements

Future versions of the pipeline may include:

- Live API ingestion
- Incremental updates
- Automated retraining
- Data versioning
- Feature store
- Airflow scheduling
- MLflow integration