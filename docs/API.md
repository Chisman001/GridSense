# API Documentation

**Project Name:** GridSense AI

**Version:** 1.0.0

**API Version:** v1

**Protocol:** HTTPS

**Architecture Style:** REST API

**Data Format:** JSON

**Authentication:** Clerk JWT

---

# Table of Contents

1. Overview
2. Base URL
3. Authentication
4. Standard Response Format
5. Error Responses
6. Business Endpoints
7. Energy Record Endpoints
8. Prediction Endpoints
9. Recommendation Endpoints
10. Report Endpoints
11. Analytics Endpoints
12. Pagination
13. Filtering
14. Rate Limiting
15. Status Codes

---

# 1. Overview

GridSense AI exposes a RESTful API that enables secure communication between the frontend, backend, machine learning services, and database.

All requests and responses use JSON.

Protected endpoints require authentication.

All timestamps are stored in UTC.

API Version:

v1

Example:

/api/v1/businesses

# 2. Base URL

Development

http://localhost:8000/api/v1

Production

https://api.gridsense.ai/api/v1

# 3. Authentication

GridSense AI uses Clerk Authentication.

Protected routes require a valid JWT token.

Example

Authorization:

Bearer YOUR_JWT_TOKEN

# 4. Standard Response Format

Successful Response

```json
{
  "success": true,
  "message": "Request successful.",
  "data": {}
}
```

Failed Response

```json
{
  "success": false,
  "message": "Request failed.",
  "error": {
    "code": "INVALID_DATA",
    "details": "Diesel cost cannot be negative."
  }
}
```

# 5. Error Responses

| Status Code | Meaning |
|------------|---------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

# 6. Business Endpoints

## Create Business

POST /businesses

Request

```json
{
  "business_name": "ABC Manufacturing",
  "industry": "Manufacturing",
  "location": "Lagos, Nigeria",
  "employees": 25,
  "operating_hours": 12,
  "primary_energy_source": "Diesel Generator"
}
```

Response

```json
{
  "success": true,
  "message": "Business created successfully.",
  "data": {
    "id": "uuid"
  }
}
```

---

## Get Businesses

GET /businesses

Returns all businesses owned by the authenticated user.

---

## Get Business

GET /businesses/{business_id}

---

## Update Business

PUT /businesses/{business_id}

---

## Delete Business

DELETE /businesses/{business_id}

# 7. Energy Record Endpoints

## Create Energy Record

POST /energy-records

Request

```json
{
  "business_id": "uuid",
  "reporting_month": "2026-08-01",
  "electricity_bill": 120000,
  "diesel_cost": 250000,
  "generator_hours": 180,
  "fuel_consumption": 320
}
```

---

## Get Energy Records

GET /energy-records

Query Parameters

business_id

page

limit

month

year

---

## Get Energy Record

GET /energy-records/{record_id}

---

## Update Energy Record

PUT /energy-records/{record_id}

---

## Delete Energy Record

DELETE /energy-records/{record_id}

# 8. Prediction Endpoints

## Generate Prediction

POST /predictions

Request

```json
{
  "business_id": "uuid"
}
```

Response

```json
{
  "success": true,
  "message": "Prediction generated successfully.",
  "data": {
    "predicted_cost": 425000,
    "confidence_score": 0.87,
    "energy_score": 81,
    "cluster": 2
  }
}
```

---

## Get Prediction History

GET /predictions

Query Parameters

business_id

page

limit

---

## Get Prediction

GET /predictions/{prediction_id}

# 9. Recommendation Endpoints

## Get Recommendations

GET /recommendations/{prediction_id}

Response

```json
{
  "success": true,
  "data": {
    "priority": "High",
    "estimated_savings": 50000,
    "implementation_difficulty": "Easy",
    "expected_roi_days": 45,
    "recommendation":
      "Reduce generator runtime by 2 hours daily."
  }
}
```

# 10. Report Endpoints

## Generate Report

POST /reports

Request

```json
{
  "business_id": "uuid"
}
```

---

## Get Reports

GET /reports

---

## Download Report

GET /reports/{report_id}

# 11. Analytics Endpoints

## Dashboard Analytics

GET /analytics/dashboard

Returns:

- Total Energy Cost
- Predicted Cost
- Energy Score
- Monthly Trend
- Potential Savings
- Recommendation Summary

---

## Monthly Trend

GET /analytics/trends

---

## Cost Breakdown

GET /analytics/cost-breakdown

---

## Benchmarking

GET /analytics/benchmark

# 12. Pagination

Example

GET /energy-records?page=1&limit=10

Response

```json
{
  "page": 1,
  "limit": 10,
  "total": 52,
  "pages": 6
}
```

# 13. Filtering

Example

GET /energy-records?year=2026

GET /predictions?business_id=uuid

GET /reports?page=1&limit=5

# 14. Rate Limiting

General Endpoints

100 requests/minute

Prediction Endpoints

20 requests/minute

AI Recommendation Endpoints

10 requests/minute

# 15. Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Resource Created |
| 204 | Deleted Successfully |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

# Recommended API flow

Create Energy Record
↓
Trigger Prediction Automatically
↓
Generate Recommendation Automatically
↓
Update Dashboard Automatically