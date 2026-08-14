# Data Mapping Specification

Project: GridSense AI

Version: 1.0

Last Updated: August 2026

---

# Table of Contents

1. Overview
2. Source Datasets
3. Master Dataset Schema
4. Dataset Mapping
5. Generated Features
6. Engineered Features
7. Rule-Based SME Features
8. Columns Removed
9. Final ML Features

---

# 1. Overview

GridSense AI combines multiple public datasets into a unified master dataset.

Each source dataset contributes different information:

- Energy consumption
- Building characteristics
- Environmental conditions
- Customer information
- Time-series patterns

The datasets are standardized before being merged into a single machine-learning-ready dataset.

---

# 2. Source Datasets

| Dataset | Purpose |
|----------|----------|
| Test Energy Data | Building energy characteristics |
| Energy Consumption | Customer & cost information |
| Appliances Energy Prediction | Consumption behaviour |
| Household Electric Power Consumption | Time-series electricity usage |
| Smart Meter Prediction | Usage forecasting patterns |
| Household Power Consumption | Additional consumption behaviour |
| CBECS | Commercial building characteristics |

---

# 3. Master Dataset Schema

The final master dataset (`master_energy_dataset.csv`) will contain:

business_id

record_date

building_type

customer_type

region

building_size_sqm

floor_area_sqm

occupants

employees

operating_hours

number_of_appliances

average_temperature

energy_consumption_kwh

electricity_cost

diesel_cost

generator_hours

grid_hours

outage_hours

fuel_consumption_liters

monthly_revenue

solar_capacity_kw

weather_temperature

energy_source

total_energy_cost

---

# 4. Dataset Mapping

## Dataset 1 — Test Energy Data

| Source Column | Destination Column | Action | Reason |
|---------------|--------------------|--------|--------|
| Building Type | building_type | Keep | Business classification |
| Square Footage | floor_area_sqm | Convert (ft² → m² if required) | Standard unit |
| Number of Occupants | occupants | Keep | Occupancy indicator |
| Appliances Used | number_of_appliances | Rename | Consistent naming |
| Average Temperature | weather_temperature | Rename | Standard naming |
| Day Type | day_type | Keep | Behaviour pattern |
| Energy Consumption | energy_consumption_kwh | Rename | Standard unit |

---

## Dataset 2 — Energy Consumption

| Source Column | Destination Column | Action | Reason |
|---------------|--------------------|--------|--------|
| Customer ID | source_customer_id | Keep (Reference Only) | Traceability |
| Customer Type | customer_type | Keep | Business category |
| Region | region | Keep | Location feature |
| Building Size | building_size_sqm | Rename | Standard naming |
| Occupants | occupants | Merge | Fill missing values |
| Energy Cost | electricity_cost | Rename | Cost modelling |

---

## Dataset 3 — Appliances Energy Prediction

| Source Column | Destination Column | Action |
|---------------|--------------------|--------|
| Date | record_date | Keep |
| Temperature | weather_temperature | Merge |
| Humidity | humidity | Optional |
| Appliances | energy_consumption_kwh | Map |
| Lights | lighting_usage | Optional |

---

## Dataset 4 — Household Electric Power Consumption

| Source Column | Destination Column | Action |
|---------------|--------------------|--------|
| Date | record_date | Merge |
| Time | record_time | Optional |
| Global Active Power | active_power | Keep |
| Global Reactive Power | reactive_power | Keep |
| Voltage | voltage | Keep |
| Global Intensity | current | Rename |
| Sub Metering 1 | sub_meter_1 | Keep |
| Sub Metering 2 | sub_meter_2 | Keep |
| Sub Metering 3 | sub_meter_3 | Keep |

---

## Dataset 5 — Smart Meter Prediction

| Source Column | Destination Column | Action |
|---------------|--------------------|--------|
| Meter ID | meter_id | Keep |
| Timestamp | record_date | Merge |
| Consumption | energy_consumption_kwh | Merge |
| Predicted Usage | predicted_usage | Optional |

---

## Dataset 6 — Household Power Consumption

This dataset is used mainly to validate consumption distributions.

Columns overlapping with previous datasets will be merged after duplicate checking.

---

## Dataset 7 — CBECS

| Source Column | Destination Column | Action |
|---------------|--------------------|--------|
| Building Type | building_type | Merge |
| Floor Area | floor_area_sqm | Merge |
| Weekly Operating Hours | operating_hours | Keep |
| Electricity Consumption | energy_consumption_kwh | Merge |
| Fuel Consumption | fuel_consumption_liters | Merge |

---

# 5. Generated Features

The following fields are created by the SME Rule Engine.

| Feature | Source |
|----------|--------|
| business_id | Generated |
| employees | Generated |
| generator_hours | Generated |
| outage_hours | Generated |
| diesel_cost | Generated |
| petrol_cost | Generated |
| solar_capacity_kw | Generated |
| monthly_revenue | Generated |
| energy_source | Generated |
| maintenance_cost | Generated |
| occupancy_rate | Generated |

These values are generated using realistic business rules based on building type, region, and energy consumption.

---

# 6. Engineered Features

The following features are calculated during preprocessing.

| Feature | Formula |
|----------|----------|
| total_energy_cost | electricity + diesel + petrol |
| cost_per_kwh | total_energy_cost / energy_consumption_kwh |
| energy_cost_per_employee | total_energy_cost / employees |
| generator_dependency | generator_hours / (generator_hours + grid_hours) |
| outage_severity | outage_hours / operating_hours |
| revenue_energy_ratio | monthly_revenue / total_energy_cost |
| estimated_carbon_intensity | fuel_consumption / energy_consumption_kwh |
| energy_efficiency_score | Composite score (0–100) |

---

# 7. Rule-Based SME Features

The rule engine applies business-specific logic.

## Hotel

- Higher occupancy
- Higher operating hours
- Moderate generator usage

## Bakery

- High appliance usage
- Morning energy peaks
- Moderate floor area

## Hospital

- 24-hour operations
- High generator dependency
- High electricity demand

## School

- Lower occupancy during holidays
- Weekday-heavy usage

## Cold Room

- Constant electricity demand
- Low occupancy
- High energy intensity

## Factory

- Large floor area
- High machinery load
- High maintenance cost

---

# 8. Columns Removed

The following columns may be removed if they do not contribute to modelling.

- Duplicate timestamps
- Duplicate occupancy columns
- Dataset-specific IDs (after traceability checks)
- Constant-value columns
- Empty columns
- High-missing-value columns (>40%, unless strategically useful)

All removed columns will be documented.

---

# 9. Final ML Features

Regression Model (Next Month Energy Cost)

Input Features:

- building_type
- region
- floor_area_sqm
- occupants
- employees
- operating_hours
- number_of_appliances
- weather_temperature
- energy_consumption_kwh
- electricity_cost
- diesel_cost
- generator_hours
- outage_hours
- fuel_consumption_liters
- monthly_revenue
- solar_capacity_kw
- occupancy_rate
- cost_per_kwh
- generator_dependency
- revenue_energy_ratio

Target:

- next_month_energy_cost

---

# Data Lineage

Every feature in the final dataset can be traced to one of three origins:

1. Public Dataset
2. Rule-Based Generation
3. Feature Engineering

This ensures transparency, reproducibility, and explainability throughout the GridSense AI pipeline.