# 5. Frontend Architecture

The frontend is developed using Next.js with the App Router.

The frontend is responsible for:

- Authentication
- Dashboard rendering
- Data visualization
- Form validation
- User interactions
- API communication

---

## Directory Structure

```

src/

├── app/

├── components/

├── hooks/

├── lib/

├── services/

├── types/

├── utils/

├── styles/

└── assets/

```

---

## Responsibilities

### app/

Contains application routes.

Examples:

- Dashboard
- Reports
- Settings
- Analytics

---

### components/

Reusable UI components.

Examples:

- Cards
- Buttons
- Sidebar
- Navbar
- Charts

---

### services/

Handles API communication.

Example:

BusinessService

PredictionService

AuthenticationService

---

### hooks/

Custom React hooks.

Example:

useBusiness()

usePrediction()

useAnalytics()

---

### lib/

Contains utility configurations.

Examples:

Axios instance

Clerk configuration

Theme configuration

# 6. Backend Architecture

## Overview

The backend follows a layered architecture inspired by Clean Architecture principles.

Each layer has a single responsibility, reducing coupling between components and improving maintainability.

The request lifecycle is:

```

Client Request
↓
API Router
↓
Controller
↓
Service Layer
↓
Repository Layer
↓
Database

OR

↓

Machine Learning Layer

↓

AI Recommendation Layer

↓

Response

```

The frontend never communicates directly with the database or machine learning models.

All requests pass through the backend.

---

## Backend Layers

### API Layer

Responsible for:

- Routing
- Authentication validation
- Request validation
- Response formatting

Technology

- FastAPI
- Pydantic

---

### Controller Layer

Responsible for:

- Receiving requests
- Calling services
- Returning responses

Controllers should contain minimal business logic.

---

### Service Layer

Responsible for:

- Business logic
- Validation
- Calculations
- Workflow orchestration

Examples

BusinessService

PredictionService

AnalyticsService

ReportService

RecommendationService

---

### Repository Layer

Responsible for:

- Database operations

Examples

Create Business

Update Energy Record

Delete Report

Retrieve Predictions

The Service Layer never communicates directly with SQLAlchemy.

Everything goes through repositories.

---

### Machine Learning Layer

Responsible for:

- Data preprocessing
- Feature engineering
- Model inference
- Energy Score calculation
- Clustering

---

### AI Layer

Responsible for:

- Explaining predictions
- Generating recommendations
- Producing business-friendly insights

---

### Database Layer

Responsible for:

- Persistent storage
- Relationships
- Queries

# Request Lifecycle

Every request follows the same architecture.

```

Frontend

↓

POST /predict

↓

FastAPI Router

↓

Prediction Controller

↓

Prediction Service

↓

Prediction Repository

↓

Retrieve Business Data

↓

Machine Learning Model

↓

Prediction

↓

Gemini Recommendation

↓

Store Result

↓

Return JSON

↓

Frontend Dashboard

```

# Business Logic Flow

Example:

User submits a new energy record.

```

Energy Form

↓

Backend Validation

↓

Save Record

↓

Generate Prediction

↓

Calculate Energy Score

↓

Generate Recommendation

↓

Store Prediction

↓

Return Dashboard Data

```

# Error Handling

The backend shall implement centralized exception handling.

Examples:

400 Bad Request

```
Invalid energy record.
```

401 Unauthorized

```
Authentication required.
```

403 Forbidden

```
You do not have permission to access this resource.
```

404 Not Found

```
Business not found.
```

500 Internal Server Error

```
Unexpected server error.
```

All errors should return a standardized JSON response.

Example

```json
{
  "success": false,
  "message": "Business not found",
  "error_code": "BUSINESS_NOT_FOUND"
}
```

# Logging Strategy

The application should log important events.

Examples

Authentication

Business creation

Prediction requests

Errors

API failures

ML inference failures

Logs should never expose sensitive user information.

# Configuration

Environment variables shall contain:

DATABASE_URL=

CLERK_SECRET_KEY=

CLERK_PUBLISHABLE_KEY=

GEMINI_API_KEY=

ENVIRONMENT=

FRONTEND_URL=

JWT_SECRET=

All secrets must be excluded from version control using `.gitignore`.

# Standard API Response

Successful Response

```json
{
    "success": true,
    "message": "Prediction generated successfully.",
    "data": {
        ...
    }
}
```

Failed Response

```json
{
    "success": false,
    "message": "Prediction failed.",
    "error": {
        "code": "MODEL_ERROR",
        "details": "Unable to generate prediction."
    }
}
```

This consistent structure simplifies frontend development and error handling.

