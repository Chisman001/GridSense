# Software Requirements Specification (SRS)

**Project Name:** GridSense AI

**Version:** 1.0.0

**Document Status:** Draft

**Author:** Emmanuel Chisom

**Last Updated:** August 2026

---

# Revision History

| Version | Date | Author | Description |
|----------|------|---------|-------------|
| 1.0.0 | August 2026 | Emmanuel Chisom | Initial SRS Document |

---

# Table of Contents

1. Introduction
2. Problem Statement
3. Project Objectives
4. Project Scope
5. Stakeholders
6. User Personas
7. Functional Requirements
8. Non-Functional Requirements
9. System Architecture
10. System Modules
11. Database Design
12. Machine Learning Pipeline
13. API Specification
14. User Flow
15. UI/UX Requirements
16. Security Requirements
17. Testing Strategy
18. Deployment Strategy
19. Future Enhancements
20. Success Metrics
21. Product Differentiators

---

# 1. Introduction

## 1.1 Overview

GridSense AI is an AI-powered Energy Intelligence Platform designed to help Small and Medium-sized Enterprises (SMEs) monitor, analyze, predict, and optimize their energy consumption.

The platform combines Machine Learning, Predictive Analytics, Artificial Intelligence, and interactive dashboards to transform raw energy data into actionable business insights.

Unlike traditional monitoring systems that simply display energy usage, GridSense AI provides intelligent recommendations, forecasts future energy costs, and assists businesses in making informed energy decisions.

The platform is primarily targeted at businesses operating in regions where electricity costs are high or power supply is unreliable.

---

## 1.2 Purpose

The purpose of GridSense AI is to enable businesses to:

- Understand how energy is being consumed.
- Predict future energy expenses.
- Identify energy inefficiencies.
- Receive AI-powered optimization recommendations.
- Reduce operational costs.
- Improve sustainability.

The platform acts as an intelligent decision-support system rather than a traditional energy monitoring dashboard.

---

## 1.3 Intended Audience

This Software Requirements Specification is intended for:

- Software Developers
- Machine Learning Engineers
- UI/UX Designers
- Project Maintainers
- Hackathon Judges
- Future Contributors
- Potential Investors

---

## 1.4 Definitions

| Term | Description |
|------|-------------|
| SME | Small and Medium-sized Enterprise |
| ML | Machine Learning |
| AI | Artificial Intelligence |
| GES | GridSense Energy Score |
| API | Application Programming Interface |
| OCR | Optical Character Recognition |

---

# 2. Problem Statement

Across many developing countries, SMEs spend a significant portion of their operational budget on energy.

Businesses often rely on multiple energy sources such as:

- National electricity grids
- Diesel generators
- Petrol generators
- Solar systems

However, most SMEs lack intelligent tools that help them understand their energy consumption patterns or predict future costs.

Current challenges include:

- Rising diesel prices
- Unreliable electricity supply
- Lack of energy analytics
- Poor forecasting
- Inefficient energy utilization
- Data-driven decision making is almost nonexistent

As a result, businesses frequently make costly decisions based on assumptions instead of data.

GridSense AI addresses this problem by combining machine learning, predictive analytics, and artificial intelligence to transform energy data into meaningful insights and actionable recommendations.

---

# 3. Project Objectives

## 3.1 Primary Objective

Develop an AI-powered energy intelligence platform that enables SMEs to optimize energy consumption and reduce operational costs.

---

## 3.2 Secondary Objectives

The platform aims to:

- Predict future energy expenditure.
- Analyze historical energy trends.
- Benchmark businesses against similar organizations.
- Recommend cost-saving strategies.
- Generate professional energy reports.
- Encourage sustainable energy practices.
- Simplify complex energy analytics through AI explanations.

---

## 3.3 Success Criteria

The project will be considered successful if it enables users to:

- Predict monthly energy costs with reasonable accuracy.
- Receive personalized optimization recommendations.
- Visualize energy consumption through intuitive dashboards.
- Download professional energy reports.
- Make informed energy decisions using AI-generated insights.

---

# 4. Project Scope

## 4.1 In Scope

The following features are included in the MVP:

### User Authentication

- User Registration
- User Login
- Google Authentication
- Secure Session Management

---

### Business Management

Users can:

- Create Businesses
- Edit Businesses
- Delete Businesses
- View Business Profiles

---

### Energy Data Management

Users can:

- Enter energy records manually
- Upload CSV energy records
- View historical energy data
- Update existing records

---

### Machine Learning

The platform shall:

- Predict future energy costs
- Calculate the GridSense Energy Score (GES)
- Cluster businesses with similar energy profiles
- Detect abnormal energy usage (stretch goal)

---

### AI Recommendation Engine

The platform shall generate:

- Cost-saving recommendations
- Sustainability suggestions
- Operational efficiency advice
- Personalized energy insights

---

### Dashboard

The dashboard shall display:

- Monthly energy expenditure
- Predicted future costs
- GridSense Energy Score
- Potential savings
- Interactive charts
- AI recommendations

---

### Reporting

Users shall be able to:

- Generate PDF reports
- Download reports
- View previous reports

---

## 4.2 Out of Scope

The following features are excluded from the Hackathon MVP:

- IoT Sensor Integration
- Smart Meter Connectivity
- Mobile Applications
- Team Collaboration
- Multi-language Support
- Utility Company Integrations
- Live Energy Monitoring
- Payment Processing
- Subscription Billing

# 5. Stakeholders

The following stakeholders are involved in the development and usage of GridSense AI.

## 5.1 Primary Stakeholders

### Business Owners (SMEs)

Business owners are the primary users of GridSense AI. They use the platform to monitor energy consumption, understand energy costs, receive AI-powered recommendations, and make informed business decisions.

Responsibilities:

- Register and manage their business profile
- Upload or enter energy consumption data
- Review analytics and recommendations
- Generate and download reports

---

### Operations Managers

Operations managers monitor daily energy usage and operational efficiency.

Responsibilities:

- Track energy consumption
- Compare historical performance
- Review forecasts
- Implement optimization recommendations

---

### Energy Consultants

Consultants use GridSense AI to analyze clients' energy profiles and prepare recommendations.

Responsibilities:

- Analyze business energy performance
- Generate reports
- Recommend energy optimization strategies

---

## 5.2 Development Team

### Product Lead

Responsible for:

- Product vision
- Feature prioritization
- Project coordination

---

### Frontend Developer

Responsible for:

- User Interface
- Dashboard
- Responsive Design
- User Experience

---

### Backend Developer

Responsible for:

- REST API
- Authentication integration
- Business logic
- Database management

---

### Machine Learning Engineer

Responsible for:

- Data preprocessing
- Model training
- Prediction services
- Model evaluation

---

### UI/UX Designer

Responsible for:

- User flows
- Wireframes
- Design System
- Prototypes

---

# 6. User Personas

## Persona 1 — Ada (Small Business Owner)

**Age:** 36

**Business:** Bakery

**Location:** Lagos, Nigeria

### Goals

- Reduce monthly electricity expenses
- Lower diesel consumption
- Understand where money is being spent

### Pain Points

- High generator costs
- Unpredictable electricity supply
- No visibility into energy trends
- Difficult to estimate future expenses

### How GridSense Helps

- Predicts future costs
- Shows spending trends
- Suggests practical ways to reduce expenses

---

## Persona 2 — Michael (Factory Manager)

**Age:** 42

**Business:** Manufacturing

### Goals

- Monitor energy performance
- Improve operational efficiency
- Justify investment decisions

### Pain Points

- Large monthly fuel bills
- Poor reporting
- Manual calculations

### How GridSense Helps

- Interactive dashboards
- AI recommendations
- Downloadable reports
- Cost forecasts

---

## Persona 3 — Sarah (Energy Consultant)

**Age:** 31

**Profession:** Sustainability Consultant

### Goals

- Analyze client energy performance
- Prepare professional reports
- Recommend improvements

### Pain Points

- Manual report creation
- Time-consuming analysis
- Lack of predictive tools

### How GridSense Helps

- Automated reports
- AI-powered insights
- Business benchmarking

---

# 7. Functional Requirements

This section defines the functional capabilities of GridSense AI.

---

## FR-001 User Authentication

### Description

The system shall allow users to securely create accounts and access the platform.

### Requirements

- Register with email
- Login
- Logout
- Google Sign-In
- Password Reset
- Session Management

Priority: High

---

## FR-002 Business Management

### Description

Users shall be able to manage one or more businesses.

### Requirements

- Create Business
- Edit Business
- Delete Business
- View Business Details

Priority: High

---

## FR-003 Energy Data Management

### Description

Users shall record energy consumption data.

### Requirements

- Manual data entry
- CSV upload
- Edit records
- Delete records
- View historical records

Priority: High

---

## FR-004 Dashboard

### Description

The system shall provide a visual overview of business energy performance.

Dashboard Components

- Monthly Cost
- Predicted Cost
- GridSense Energy Score
- Potential Savings
- Monthly Trend
- Cost Breakdown
- AI Recommendations

Priority: High

---

## FR-005 Machine Learning Predictions

### Description

The system shall analyze historical data and generate future energy predictions.

Outputs

- Predicted Monthly Cost
- Business Cluster
- Energy Score
- Trend Analysis

Priority: High

---

## FR-006 AI Recommendation Engine

### Description

The system shall convert analytical outputs into understandable recommendations.

Examples

- Reduce generator runtime
- Switch to alternative energy
- Optimize operating schedule
- Improve energy efficiency

Priority: High

---

## FR-007 Report Generation

### Description

Users shall generate downloadable reports.

Report Contents

- Business Summary
- Charts
- Predictions
- Recommendations
- GridSense Energy Score

Export Formats

- PDF

Priority: Medium

---

## FR-008 Notifications (Future)

The system may notify users about:

- High energy consumption
- Significant cost increases
- Monthly report availability

Priority: Low

---

# 8. Non-Functional Requirements

## Performance

The platform should:

- Load dashboard within 3 seconds.
- Respond to API requests in under 500 ms (excluding AI inference).
- Handle concurrent requests efficiently.

---

## Reliability

The platform should:

- Maintain data integrity.
- Recover gracefully from failures.
- Minimize downtime.

---

## Scalability

The architecture should support:

- Thousands of businesses.
- Large datasets.
- Future integrations.

---

## Security

The platform shall:

- Use Clerk Authentication.
- Protect API endpoints.
- Encrypt communication using HTTPS.
- Store secrets securely using environment variables.
- Validate all user inputs.

---

## Maintainability

The codebase shall:

- Follow a modular architecture.
- Be well documented.
- Follow consistent naming conventions.
- Support future feature additions.

---

## Usability

The interface shall:

- Be responsive on desktop and mobile.
- Provide intuitive navigation.
- Display meaningful error messages.
- Offer a consistent user experience.

---

## Accessibility

The application should:

- Support keyboard navigation.
- Provide sufficient color contrast.
- Include descriptive labels for form controls.
- Follow basic WCAG accessibility principles where practical.

# 9. System Architecture

## 9.1 Architecture Overview

GridSense AI follows a modern three-tier architecture consisting of:

- Presentation Layer (Frontend)
- Application Layer (Backend & AI Services)
- Data Layer (Database & Machine Learning Models)

The frontend communicates with the backend through REST APIs. The backend processes business logic, interacts with the machine learning models, and retrieves or stores data in the PostgreSQL database. AI-generated explanations are produced after the machine learning models generate predictions.

---

## 9.2 High-Level Architecture

```
                    ┌───────────────────────────┐
                    │      Next.js Frontend     │
                    │      (TypeScript)         │
                    └─────────────┬─────────────┘
                                  │
                     Clerk Authentication
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │      FastAPI Backend      │
                    │      Business Logic       │
                    └───────┬─────────┬─────────┘
                            │         │
                            │         │
                            ▼         ▼
                 Machine Learning    Gemini API
                  (Scikit-Learn)   (AI Explanations)
                            │
                            ▼
                   Neon PostgreSQL Database
```

---

## 9.3 Architectural Components

### Presentation Layer

Responsible for:

- User Interface
- Forms
- Dashboards
- Authentication
- Data Visualization

Technology:

- Next.js
- Tailwind CSS
- shadcn/ui
- Recharts

---

### Application Layer

Responsible for:

- Business Logic
- Authentication Validation
- API Endpoints
- Machine Learning Integration
- Report Generation

Technology:

- FastAPI
- Python

---

### Data Layer

Responsible for:

- Data Storage
- User Records
- Business Information
- Energy Records
- Prediction Results

Technology:

- PostgreSQL (Neon)

---

### Machine Learning Layer

Responsible for:

- Data preprocessing
- Feature engineering
- Model inference
- Cost prediction
- Business clustering
- Energy score calculation

Technology:

- Pandas
- NumPy
- Scikit-Learn
- Joblib

---

### AI Layer

Responsible for transforming machine learning outputs into human-readable recommendations.

Example:

Input

```
Prediction:
₦425,000

Cluster:
3

Energy Score:
72
```

Output

> Your projected monthly energy expenditure is ₦425,000. Most of your operational cost comes from diesel usage. Businesses with similar energy profiles typically reduce costs by lowering generator runtime or transitioning part of their energy load to alternative sources.

Technology:

- Gemini API

---

# 10. System Modules

GridSense AI is divided into independent modules.

---

## Module 1 — Authentication

Responsibilities

- User registration
- User login
- Session management
- User profile

Technology

- Clerk

---

## Module 2 — Business Management

Responsibilities

- Create businesses
- Update businesses
- Delete businesses
- Retrieve business information

---

## Module 3 — Energy Data Management

Responsibilities

- Store energy records
- Edit records
- Delete records
- Upload CSV
- Validate data

---

## Module 4 — Analytics Dashboard

Responsibilities

- Display metrics
- Display charts
- Display trends
- Display predictions
- Display energy score

---

## Module 5 — Machine Learning Engine

Responsibilities

- Preprocess data
- Generate predictions
- Calculate Energy Score
- Cluster businesses

---

## Module 6 — AI Recommendation Engine

Responsibilities

- Explain predictions
- Recommend improvements
- Generate business insights

---

## Module 7 — Reporting

Responsibilities

- Generate reports
- Download PDF
- Store report history

---

## Module 8 — Settings

Responsibilities

- Profile management
- Preferences
- Theme
- Account settings

---

# 11. Database Design

The database follows a relational PostgreSQL design.

---

## Entity Relationship Overview

```
Users
   │
   │ 1
   │
   │ N
Businesses
   │
   │ 1
   │
   │ N
Energy Records
   │
   │ 1
   │
   │ N
Predictions

Businesses
   │
   │ 1
   │
   │ N
Reports
```

---

## Users Table

| Field | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| clerk_id | String | Clerk User ID |
| email | String | User Email |
| full_name | String | Full Name |
| created_at | Timestamp | Account Creation |

---

## Businesses Table

| Field | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| user_id | UUID | Foreign Key |
| business_name | String | Business Name |
| industry | String | Industry |
| location | String | Country/City |
| employees | Integer | Number of Employees |
| operating_hours | Integer | Daily Operating Hours |
| primary_energy_source | String | Main Energy Source |
| created_at | Timestamp | Date Created |

---

## Energy Records Table

| Field | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| business_id | UUID | Foreign Key |
| month | Date | Reporting Month |
| electricity_bill | Decimal | Monthly Electricity Cost |
| diesel_cost | Decimal | Monthly Diesel Cost |
| generator_hours | Decimal | Generator Usage |
| fuel_consumption | Decimal | Fuel Used |
| solar_capacity | Decimal | Solar Usage |
| created_at | Timestamp | Record Created |

---

## Predictions Table

| Field | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| business_id | UUID | Foreign Key |
| predicted_cost | Decimal | ML Prediction |
| energy_score | Integer | GridSense Energy Score |
| business_cluster | Integer | Cluster Assignment |
| recommendation_summary | Text | AI Summary |
| created_at | Timestamp | Prediction Date |

---

## Reports Table

| Field | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| business_id | UUID | Foreign Key |
| report_url | String | Generated PDF |
| generated_at | Timestamp | Report Date |

---

# 12. Machine Learning Pipeline

## 12.1 Overview

The Machine Learning pipeline transforms raw business energy data into predictive insights.

The pipeline consists of:

1. Data Collection
2. Data Validation
3. Data Preprocessing
4. Feature Engineering
5. Model Prediction
6. Business Clustering
7. Energy Score Calculation
8. AI Recommendation Generation

---

## 12.2 Data Inputs

The following features are used for prediction:

- Electricity Bill
- Diesel Cost
- Generator Hours
- Fuel Consumption
- Business Industry
- Number of Employees
- Operating Hours
- Primary Energy Source

---

## 12.3 Data Preprocessing

The preprocessing pipeline performs:

- Missing value handling
- Duplicate removal
- Outlier detection
- Feature scaling
- Categorical encoding
- Feature normalization (where required)

---

## 12.4 Machine Learning Models

### Regression Model

Purpose:

Predict future monthly energy costs.

Candidate Models:

- Linear Regression (Baseline)
- Random Forest Regressor
- Gradient Boosting Regressor

Evaluation Metrics:

- MAE
- RMSE
- R² Score

---

### Clustering Model

Purpose:

Group businesses with similar energy consumption patterns.

Algorithm:

- K-Means Clustering

Evaluation Metrics:

- Silhouette Score
- Inertia

---

### Energy Efficiency Score (GES)

GridSense AI computes a proprietary GridSense Energy Score (GES) ranging from 0 to 100.

The score is derived from multiple indicators, including:

- Generator dependency
- Electricity cost ratio
- Fuel efficiency
- Operational consistency
- Sustainability readiness

The score is categorized as follows:

| Score | Rating |
|--------|---------|
| 90–100 | Excellent |
| 75–89 | Good |
| 50–74 | Needs Improvement |
| 0–49 | Critical |

---

## 12.5 AI Recommendation Generation

The machine learning outputs are passed to the AI layer.

Inputs include:

- Predicted cost
- Business cluster
- Energy score
- Historical trends

The AI generates:

- Personalized recommendations
- Cost-saving opportunities
- Sustainability suggestions
- Business-friendly explanations

The AI does not make predictions independently. It interprets and explains the outputs produced by the machine learning models.

# 13. API Specification

## 13.1 Overview

GridSense AI exposes a RESTful API that enables secure communication between the frontend, backend, machine learning services, and database.

The API follows REST principles and exchanges data in JSON format.

Base URL (Development)

```
http://localhost:8000/api/v1
```

---

## 13.2 Authentication

Authentication is managed by Clerk.

Protected endpoints require a valid Clerk JWT token.

Example Header

```http
Authorization: Bearer <JWT_TOKEN>
```

---

## 13.3 Business Endpoints

### Create Business

**POST** `/businesses`

Request

```json
{
  "business_name": "ABC Manufacturing",
  "industry": "Manufacturing",
  "location": "Lagos, Nigeria",
  "employees": 50,
  "operating_hours": 12,
  "primary_energy_source": "Diesel Generator"
}
```

Response

```json
{
  "message": "Business created successfully"
}
```

---

### Get Businesses

**GET** `/businesses`

Returns all businesses belonging to the authenticated user.

---

### Update Business

**PUT** `/businesses/{id}`

---

### Delete Business

**DELETE** `/businesses/{id}`

---

## 13.4 Energy Records

### Create Record

**POST** `/energy-records`

### Get Records

**GET** `/energy-records`

### Update Record

**PUT** `/energy-records/{id}`

### Delete Record

**DELETE** `/energy-records/{id}`

---

## 13.5 Prediction Endpoint

### Generate Prediction

**POST** `/predict`

Response

```json
{
  "predicted_cost": 425000,
  "energy_score": 81,
  "cluster": 2
}
```

---

## 13.6 AI Recommendation Endpoint

### Generate AI Insights

**POST** `/recommendations`

Returns AI-generated explanations and recommendations based on machine learning predictions.

---

## 13.7 Report Endpoint

### Generate Report

**POST** `/reports`

Returns a downloadable PDF report.

---

# 14. User Flow

## Primary User Journey

```
Landing Page
      │
      ▼
Sign Up / Login
      │
      ▼
Create Business Profile
      │
      ▼
Add Energy Data
      │
      ▼
Generate AI Analysis
      │
      ▼
Dashboard
      │
      ▼
Review Recommendations
      │
      ▼
Generate PDF Report
      │
      ▼
Logout
```

---

## Business Onboarding Flow

```
Register
    │
    ▼
Verify Account
    │
    ▼
Create Business
    │
    ▼
Complete Business Details
    │
    ▼
Access Dashboard
```

---

## Prediction Workflow

```
User Input
      │
      ▼
Backend Validation
      │
      ▼
Machine Learning Model
      │
      ▼
Prediction
      │
      ▼
Energy Score Calculation
      │
      ▼
AI Recommendation
      │
      ▼
Dashboard Display
```

---

# 15. UI/UX Requirements

## Design Principles

GridSense AI should provide a clean, modern, and intuitive user experience.

The interface should prioritize clarity, accessibility, and ease of navigation while presenting complex energy analytics in a simple and understandable format.

---

## Design Goals

- Minimalistic Interface
- Responsive Layout
- Fast Navigation
- Clear Data Visualization
- Consistent Design Language

---

## Color Palette

Primary

- Emerald Green

Secondary

- Navy Blue

Accent

- Electric Blue

Success

- Green

Warning

- Amber

Danger

- Red

Background

- White / Light Gray

---

## Typography

Primary Font

- Geist

Fallback

- Inter

---

## Layout

The application shall include:

- Sidebar Navigation
- Top Navigation Bar
- Dashboard Cards
- Interactive Charts
- Responsive Tables
- Form Components
- Toast Notifications
- Modal Dialogs

---

## Core Pages

- Landing Page
- Login
- Registration
- Dashboard
- Business Management
- Energy Records
- Analytics
- Reports
- Settings
- Profile

---

## Accessibility

The interface should:

- Support keyboard navigation
- Provide meaningful labels
- Maintain adequate color contrast
- Display readable typography
- Include loading and error states

---

# 16. Security Requirements

GridSense AI shall implement industry-standard security practices.

---

## Authentication

- Clerk Authentication
- Secure Session Management
- JWT Validation

---

## Authorization

Users may only access their own businesses, reports, and energy records.

---

## Data Protection

- HTTPS Encryption
- Environment Variables
- Secure Password Handling (managed by Clerk)
- Input Validation
- SQL Injection Protection
- XSS Prevention

---

## File Upload Security

Uploaded files shall:

- Validate file type
- Validate file size
- Reject malicious files

---

# 17. Testing Strategy

## Frontend Testing

The frontend shall be tested for:

- Component rendering
- Navigation
- Form validation
- Responsive layout
- Error handling

---

## Backend Testing

Backend testing includes:

- API endpoints
- Authentication
- Validation
- Database operations

---

## Machine Learning Testing

Evaluate models using:

Regression

- MAE
- RMSE
- R² Score

Clustering

- Silhouette Score
- Inertia

---

## End-to-End Testing

Validate the complete workflow:

User Registration

↓

Business Creation

↓

Energy Data Entry

↓

Prediction

↓

Recommendation

↓

Report Generation

---

# 18. Deployment Strategy

## Frontend

Platform

- Vercel

---

## Backend

Platform

- Render

---

## Database

Platform

- Neon PostgreSQL

---

## Authentication

Platform

- Clerk

---

## AI

Platform

- Google Gemini API

---

## Continuous Deployment

Version Control

- GitHub

Deployment Strategy

- Automatic deployment from the main branch

---

# 19. Future Enhancements

Future versions of GridSense AI may include:

- OCR for electricity bill extraction
- IoT sensor integration
- Smart meter connectivity
- Mobile application
- Carbon emission tracking
- Solar ROI calculator
- Diesel vs Solar comparison
- Team collaboration
- Multi-language support
- Email notifications
- Real-time monitoring
- Predictive maintenance
- Advanced anomaly detection

---

# 20. Success Metrics

The success of GridSense AI will be evaluated using technical, product, and user experience metrics.

---

## Technical Metrics

- API Response Time
- Dashboard Load Time
- Prediction Accuracy
- System Uptime

---

## Machine Learning Metrics

Regression

- Mean Absolute Error (MAE)
- Root Mean Squared Error (RMSE)
- R² Score

Clustering

- Silhouette Score

---

## Product Metrics

- Number of Businesses Created
- Reports Generated
- Predictions Generated
- Active Users

---

## User Experience Metrics

- Time to Complete Onboarding
- User Satisfaction
- Feature Adoption
- Dashboard Engagement

---

# 21. Product Differentiators

GridSense AI distinguishes itself from conventional energy management tools through the following innovations.

---

## GridSense Energy Score (GES)

A proprietary score ranging from 0 to 100 that summarizes a business's overall energy efficiency based on multiple operational indicators.

---

## Machine Learning + AI Architecture

Machine learning models generate predictions, while a Large Language Model (LLM) translates those predictions into clear, actionable recommendations.

This separation improves transparency and allows users to understand why recommendations are made.

---

## SME-Focused Design

The platform is specifically designed for Small and Medium-sized Enterprises operating in regions with unreliable or expensive energy infrastructure.

---

## Actionable Recommendations

Instead of displaying raw analytics, GridSense AI prioritizes recommendations based on expected business impact and estimated cost savings.

---

## Modern SaaS Experience

The application provides a responsive, intuitive interface featuring dashboards, interactive charts, downloadable reports, and AI-assisted insights.

---

# Appendix A — Technology Stack

| Layer | Technology |
|--------|------------|
| Frontend | Next.js 15 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Authentication | Clerk |
| Backend | FastAPI |
| Database | PostgreSQL (Neon) |
| ORM | SQLAlchemy |
| Machine Learning | Scikit-learn |
| Data Processing | Pandas, NumPy |
| Charts | Recharts |
| AI | Google Gemini API |
| Deployment | Vercel + Render |

---

# Appendix B — Folder Structure

```
GridSense-AI/

├── frontend/
├── backend/
├── ml/
├── datasets/
├── docs/
│   ├── SRS.md
│   ├── PRD.md
│   ├── Architecture.md
│   ├── Database.md
│   ├── API.md
│   ├── UI-Blueprint.md
│   ├── Development-Roadmap.md
│   └── Pitch.md
│
├── presentation/
├── README.md
├── LICENSE
└── .gitignore
```

---

# Conclusion

GridSense AI aims to deliver an intelligent, scalable, and user-friendly platform that empowers SMEs to optimize energy consumption through machine learning, predictive analytics, and AI-powered recommendations.

This Software Requirements Specification serves as the foundation for the design, development, testing, deployment, and future enhancement of the GridSense AI platform.