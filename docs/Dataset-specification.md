# Dataset Specification

**Project:** GridSense AI

**Version:** 1.0

**Last Updated:** August 2026

---

# Table of Contents

1. Dataset Strategy
2. Data Sources
3. Dataset Overview
4. businesses.csv
5. energy_records.csv
6. recommendations.csv
7. predictions.csv
8. Feature Engineering
9. Data Validation Rules
10. Synthetic Data Generation Rules
11. Machine Learning Targets
12. Data Dictionary
13. Future Data Expansion

---

# 1. Dataset Strategy

GridSense AI uses a hybrid data approach consisting of:

- Publicly available real-world energy datasets
- Rule-based synthetic data generation
- Engineered features for machine learning

This approach provides realistic data patterns while ensuring the dataset reflects the operational realities of Small and Medium-sized Enterprises (SMEs).

The final dataset is intended for demonstration, model training, and evaluation within the GridSense AI platform.

---

# 2. Data Sources

## Public Datasets

The project will incorporate publicly available datasets from sources such as:

- Kaggle
- UCI Machine Learning Repository
- Open Energy Data Initiative
- Government Open Data Portals
- Smart Meter Energy Consumption datasets

These datasets will provide realistic energy consumption patterns, seasonal trends, and operational characteristics.

## Synthetic Data

Where public datasets lack SME-specific information, additional records will be generated using rule-based simulations.

Synthetic records will preserve realistic relationships between variables rather than relying on random values.

## Feature Engineering

Additional business-focused metrics will be derived from existing columns to improve prediction quality and recommendation accuracy.

---

# 3. Dataset Overview

The platform consists of four primary datasets.

| Dataset | Purpose |
|----------|----------|
| businesses.csv | Business profile information |
| energy_records.csv | Historical monthly energy usage |
| recommendations.csv | Recommendation knowledge base |
| predictions.csv | AI prediction history |

---

# 4. businesses.csv

## Description

Stores information about each registered business.

## Expected Records

150+

## Primary Key

business_id

## Columns

| Column | Type | Unit | Required | Source |
|----------|------|------|----------|----------|
| business_id | String | - | Yes | Generated |
| business_name | String | - | Yes | Synthetic |
| business_type | Category | - | Yes | Synthetic |
| industry | Category | - | Yes | Synthetic |
| state | Category | - | Yes | Synthetic |
| city | String | - | Yes | Synthetic |
| employees | Integer | People | Yes | Synthetic |
| operating_hours | Float | Hours/Day | Yes | Synthetic |
| floor_area_sqm | Float | m² | Yes | Synthetic |
| energy_source | Category | - | Yes | Synthetic |
| solar_capacity_kw | Float | kW | Optional | Synthetic |
| monthly_revenue | Float | ₦ | Optional | Synthetic |
| created_at | Date | - | Yes | Generated |

### Allowed Business Types

- Bakery
- Hotel
- Restaurant
- Retail Store
- Supermarket
- Hospital
- School
- Factory
- Office
- Pharmacy
- Farm
- Laundry
- Cold Room
- Warehouse
- Salon

### Allowed Energy Sources

- Grid
- Generator
- Solar
- Hybrid

---

# 5. energy_records.csv

## Description

Stores monthly energy records for every business.

## Expected Records

3,600+

(150 businesses × 24 months)

## Primary Key

record_id

## Foreign Key

business_id

## Columns

| Column | Type | Unit | Required | Source |
|----------|------|------|----------|----------|
| record_id | String | - | Yes | Generated |
| business_id | String | - | Yes | businesses.csv |
| month | Integer | 1-12 | Yes | Generated |
| year | Integer | Year | Yes | Generated |
| electricity_bill | Float | ₦ | Yes | Real + Synthetic |
| diesel_cost | Float | ₦ | Yes | Real + Synthetic |
| petrol_cost | Float | ₦ | Optional | Synthetic |
| generator_hours | Float | Hours | Yes | Real + Synthetic |
| grid_hours | Float | Hours | Yes | Engineered |
| outage_hours | Float | Hours | Yes | Real + Synthetic |
| energy_consumption_kwh | Float | kWh | Yes | Real |
| fuel_consumption_liters | Float | Litres | Yes | Synthetic |
| maintenance_cost | Float | ₦ | Optional | Synthetic |
| weather_avg_temp | Float | °C | Optional | Real |
| occupancy_rate | Float | % | Optional | Synthetic |
| total_energy_cost | Float | ₦ | Yes | Calculated |

---

# 6. recommendations.csv

## Description

Knowledge base containing predefined recommendation templates.

## Expected Records

30–50

## Columns

| Column | Type |
|----------|------|
| recommendation_id | String |
| title | String |
| description | String |
| estimated_savings | Float |
| implementation_cost | Float |
| difficulty | Easy/Medium/Hard |
| priority | High/Medium/Low |
| applicable_business_types | List |
| category | String |

---

# 7. predictions.csv

## Description

Stores historical machine learning predictions.

## Columns

| Column | Type |
|----------|------|
| prediction_id | String |
| business_id | String |
| prediction_date | Date |
| predicted_cost | Float |
| confidence_score | Float |
| energy_score | Integer |
| anomaly_detected | Boolean |
| generated_recommendation | String |

---

# 8. Feature Engineering

The following features will be generated during preprocessing.

| Feature | Formula |
|----------|----------|
| Energy Cost per Employee | total_energy_cost / employees |
| Generator Dependency | generator_hours / (generator_hours + grid_hours) |
| Solar Utilization | solar_capacity_kw / energy_consumption_kwh |
| Revenue-to-Energy Ratio | monthly_revenue / total_energy_cost |
| Cost per kWh | total_energy_cost / energy_consumption_kwh |
| Outage Severity Index | outage_hours / operating_hours |
| Carbon Intensity | carbon_emission_est / energy_consumption_kwh |
| Energy Efficiency Score | Composite Score |

---

# 9. Data Validation Rules

The following rules apply during data generation and preprocessing.

- Energy costs cannot be negative.
- Employees must be greater than zero.
- Generator hours cannot exceed total monthly operating hours.
- Occupancy rate must be between 0 and 100%.
- Solar capacity cannot be negative.
- Total energy cost must equal the sum of all applicable energy costs.
- Every business must have at least 24 months of records.
- Every prediction must reference an existing business.

---

# 10. Synthetic Data Generation Rules

Synthetic records will follow realistic business rules.

Examples:

- Hotels consume more electricity than salons.
- Hospitals maintain higher generator usage due to uptime requirements.
- Cold rooms have consistently high electricity demand.
- Businesses with larger floor areas generally consume more energy.
- Increased outage hours lead to higher generator usage.
- Solar installations reduce diesel dependence.
- Higher occupancy rates increase energy consumption.
- Seasonal weather variations influence electricity demand.

Random values will be generated within realistic ranges while maintaining these relationships.

---

# 11. Machine Learning Targets

## Regression Target

Next Month Energy Cost

## Classification Targets (Future)

- High Risk Business
- Energy Efficiency Class
- High Waste Detection
- Recommendation Category

## Clustering

Business Energy Consumption Segments

---

# 12. Data Dictionary

## Currency

Nigerian Naira (₦)

## Energy

Kilowatt-hour (kWh)

## Fuel

Litres

## Temperature

Degrees Celsius (°C)

## Time

Hours

## Revenue

₦ per Month

---

# 13. Future Data Expansion

Future versions of GridSense AI may incorporate:

- IoT Smart Meter Data
- Live Electricity Tariffs
- Diesel Price API
- Petrol Price API
- Weather API
- Solar Irradiance Data
- Carbon Emissions API
- Utility Provider Data
- Regional Grid Reliability Metrics

