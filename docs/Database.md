# Database Design Document

**Project Name:** GridSense AI

**Version:** 1.0.0

**Author:** Emmanuel Chisom

**Last Updated:** August 2026

---

# Table of Contents

1. Overview
2. Database Technology
3. Design Principles
4. Entity Relationship Diagram
5. Database Schema
6. Table Definitions
7. Relationships
8. Constraints
9. Indexing Strategy
10. Data Validation Rules
11. Future Database Expansion

---

# 1. Overview

GridSense AI uses a relational PostgreSQL database to store user information, business profiles, historical energy records, machine learning predictions, AI recommendations, and generated reports.

The database is designed to:

- Maintain data integrity
- Support scalable growth
- Enable efficient querying
- Provide reliable relationships between entities
- Support future feature expansion

---

# 2. Database Technology

| Component | Technology |
|-----------|------------|
| Database | PostgreSQL |
| Provider | Neon |
| ORM | SQLAlchemy |
| Migration Tool | Alembic |

---

# 3. Design Principles

The database follows these principles:

- Normalized relational schema (3NF where practical)
- UUID primary keys
- Foreign key constraints
- Automatic timestamps
- Soft delete support (future)
- Efficient indexing
- Secure ownership validation
- Scalable table relationships

---

# Naming Convention

Tables

snake_case

Example

energy_records

Columns

snake_case

Example

business_name

Primary Keys

id

Foreign Keys

table_name_id

Example

business_id

created_at

updated_at

# 4. Entity Relationship Diagram

```

Users
│
│ 1
│
│ N
Businesses
│
├──────────────┐
│              │
│              │
▼              ▼
Energy Records Reports
│
│
▼
Predictions
│
▼
Recommendations

```

Relationship Summary

User

↓

Many Businesses

Business

↓

Many Energy Records

Business

↓

Many Predictions

Prediction

↓

One Recommendation

Business

↓

Many Reports

# 5. Database Schema

## Users

Purpose

Stores authenticated users.

| Column | Type | Nullable |
|---------|------|----------|
| id | UUID | No |
| clerk_id | VARCHAR | No |
| email | VARCHAR | No |
| full_name | VARCHAR | No |
| created_at | TIMESTAMP | No |
| updated_at | TIMESTAMP | No |

---

## Businesses

Purpose

Stores business profiles.

| Column | Type |
|---------|------|
| id | UUID |
| user_id | UUID |
| business_name | VARCHAR |
| industry | VARCHAR |
| location | VARCHAR |
| employees | INTEGER |
| operating_hours | INTEGER |
| primary_energy_source | VARCHAR |
| annual_revenue | DECIMAL |
| created_at | TIMESTAMP |
| updated_at | TIMESTAMP |

---

## Energy Records

Purpose

Stores historical monthly energy usage.

| Column | Type |
|---------|------|
| id | UUID |
| business_id | UUID |
| reporting_month | DATE |
| electricity_bill | DECIMAL |
| diesel_cost | DECIMAL |
| petrol_cost | DECIMAL |
| generator_hours | DECIMAL |
| fuel_consumption | DECIMAL |
| solar_usage | DECIMAL |
| operating_days | INTEGER |
| notes | TEXT |
| created_at | TIMESTAMP |

---

## Predictions

Purpose

Stores Machine Learning outputs.

| Column | Type |
|---------|------|
| id | UUID |
| business_id | UUID |
| predicted_cost | DECIMAL |
| confidence_score | FLOAT |
| energy_score | INTEGER |
| business_cluster | INTEGER |
| created_at | TIMESTAMP |

---

## Recommendations

Purpose

Stores AI-generated recommendations.

| Column | Type |
|---------|------|
| id | UUID |
| prediction_id | UUID |
| recommendation | TEXT |
| estimated_savings | DECIMAL |
| priority | VARCHAR |
| created_at | TIMESTAMP |

| Field                     | Type    | Example                                 |
| ------------------------- | ------- | --------------------------------------- |
| recommendation            | TEXT    | Reduce generator runtime by 2 hours/day |
| category                  | VARCHAR | Cost Optimization                       |
| priority                  | ENUM    | High                                    |
| estimated_savings         | DECIMAL | 50000                                   |
| implementation_difficulty | ENUM    | Easy                                    |
| expected_roi_days         | INTEGER | 45                                      |


---

## Reports

Purpose

Stores generated reports.

| Column | Type |
|---------|------|
| id | UUID |
| business_id | UUID |
| report_url | TEXT |
| report_type | VARCHAR |
| generated_at | TIMESTAMP |

# 6. Relationships

## Users → Businesses

Relationship

One-to-Many

Meaning

A single user may own multiple businesses.

---

## Businesses → Energy Records

Relationship

One-to-Many

Meaning

Each business can have many monthly energy records.

---

## Businesses → Predictions

Relationship

One-to-Many

Meaning

A business can generate multiple predictions over time.

---

## Predictions → Recommendations

Relationship

One-to-One

Meaning

Each prediction generates one AI recommendation.

---

## Businesses → Reports

Relationship

One-to-Many

Meaning

Businesses can generate multiple downloadable reports.

# 7. Constraints

Primary Keys

Every table uses UUID.

---

Foreign Keys

Businesses.user_id

references

Users.id

---

EnergyRecords.business_id

references

Businesses.id

---

Predictions.business_id

references

Businesses.id

---

Recommendations.prediction_id

references

Predictions.id

---

Reports.business_id

references

Businesses.id

---

Unique Constraints

Users.email

Users.clerk_id

---

Check Constraints

Employees > 0

Operating Hours

0 ≤ operating_hours ≤ 24

Energy Score

0 ≤ energy_score ≤ 100

Confidence Score

0 ≤ confidence_score ≤ 1

# 8. Indexing Strategy

Indexes improve query performance.

Indexed Columns

Users.email

Users.clerk_id

Businesses.user_id

EnergyRecords.business_id

EnergyRecords.reporting_month

Predictions.business_id

Reports.business_id

Recommendation.prediction_id

Composite Indexes

(business_id, reporting_month)

This improves historical trend analysis.

(business_id, created_at)

Useful for dashboard queries.

# 9. Data Validation Rules

Business Name

Required

Maximum Length

150 Characters

---

Industry

Required

Must belong to predefined categories.

---

Electricity Bill

Required

Must be greater than zero.

---

Diesel Cost

Cannot be negative.

---

Generator Hours

Range

0–744 hours/month

---

Fuel Consumption

Cannot be negative.

---

Energy Score

Automatically generated.

Users cannot modify it.

---

Recommendations

Generated only by the AI Recommendation Engine.

# 10. Future Database Expansion

Future versions of GridSense AI may introduce additional tables.

Carbon Emissions

Stores estimated CO₂ emissions.

IoT Devices

Stores connected smart meters.

Notifications

Stores user notifications.

Energy Tariffs

Stores electricity pricing.

Benchmark Data

Stores industry averages.

Organizations

Supports multi-user business accounts.

Audit Logs

Tracks important user activities.

API Keys

Supports third-party integrations.

Subscription Plans

Supports premium features.