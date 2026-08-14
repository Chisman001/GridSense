<div align="center">

# ⚡ GridSense AI

### AI-powered energy decision support for small and medium-sized businesses.

**Measure energy performance → Forecast costs → Understand what is happening → Take action**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12+-blue?style=for-the-badge&logo=python)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=for-the-badge&logo=postgresql)](https://neon.tech/)
[![Gemini](https://img.shields.io/badge/AI-Gemini-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 🌍 The Problem

For many small and medium-sized businesses, energy is a major operating expense, but energy management is often reactive.

Businesses may know:

- how much they spent last month
- how much electricity they consumed
- how much fuel they purchased

but still struggle to answer the questions that matter most:

> **What is likely to happen next?**
>
> **Why are energy costs changing?**
>
> **How efficiently is the business operating?**
>
> **What should we do about it?**

Large organizations can use sophisticated energy-management systems, but these tools are often inaccessible to smaller businesses.

**GridSense AI was built to close that gap.**

---

## 💡 The Solution

**GridSense AI** is an energy decision-support platform that combines **machine learning, energy-performance scoring, analytics, and generative AI** to help SMEs understand and act on their energy data.

A business can provide its energy and operating information and use GridSense to:

1. Track historical energy performance
2. Calculate a standardized **GridSense Energy Score**
3. Analyze energy-cost trends
4. Forecast future energy costs using machine learning
5. Generate AI-powered observations and recommendations
6. Produce reports that turn the analysis into something decision-makers can use

Instead of simply displaying charts, GridSense connects:

**Data → Prediction → Explanation → Action**

---

## 🤖 How GridSense Uses AI

GridSense uses AI in two complementary ways.

### 1. Machine Learning — Prediction

The forecasting system uses a trained **LightGBM regression model** to estimate the next month's energy cost from business and energy-related features.

The model is served through a **FastAPI inference service**.

The prediction target is:

```text
next_month_energy_cost
```

The model uses a combination of numerical and categorical features, including:

- electricity and fuel costs
- generator and grid hours
- outage hours
- energy consumption
- fuel consumption
- maintenance cost
- business type
- industry
- state
- energy source
- operating hours
- floor area
- monthly revenue
- cost and efficiency-related features

The training pipeline evaluates multiple candidate models before selecting the persisted LightGBM model for inference.

### 2. Generative AI — Explanation & Recommendations

GridSense also uses **Google Gemini** to transform energy and forecasting information into understandable business insights.

Instead of requiring a business owner to interpret multiple charts and model outputs, the AI layer can provide:

- important observations
- potential areas of concern
- explanations of energy patterns
- practical recommendations
- prioritized actions

This creates a clear separation:

| Layer | Role |
| --- | --- |
| **Machine Learning** | Predicts |
| **Generative AI** | Explains and recommends |

---

## ⚡ GridSense Energy Score

One of GridSense's core features is the **GridSense Energy Score (GES)**.

GES provides a standardized **0–100** measure of business energy performance.

The score combines three dimensions:

| Dimension | What it measures |
| --- | --- |
| 💰 **Cost Burden** | How significant energy costs are relative to business revenue |
| ⚡ **Generator Dependency** | How dependent the business is on generator usage relative to available powered hours |
| 🕐 **Operational Reliability** | How much of the business's operating time is affected by outages |

### Approved GES v1 Weighting

| Component | Weight |
| --- | ---: |
| Cost performance | 50% |
| Generator dependency | 25% |
| Operational reliability | 25% |

### Rating Bands

| Score | Rating |
| ---: | --- |
| 90–100 | 🟢 Excellent |
| 75–89 | 🔵 Good |
| 50–74 | 🟡 Needs Improvement |
| 0–49 | 🔴 Critical |

GES is calculated from raw energy and operating inputs rather than relying on a user-entered score.

### Validation

The GES v1 implementation was validated against **3,600 synthetic energy records**.

| Rating | Records | Percentage |
| --- | ---: | ---: |
| Excellent | 106 | 2.94% |
| Good | 1,124 | 31.22% |
| Needs Improvement | 1,932 | 53.67% |
| Critical | 438 | 12.17% |

All **3,600** records produced valid GES values.

Representative validation cases also matched the approved methodology.

---

## 📊 Key Features

### ⚡ Energy Performance

- GridSense Energy Score
- Cost burden analysis
- Generator dependency analysis
- Operational reliability analysis
- Historical energy records

### 📈 Analytics

- Energy-cost trends
- Performance analysis
- Business energy metrics
- Data-driven observations
- Comparative views

### 🤖 Machine Learning Forecasting

- Next-month energy-cost prediction
- LightGBM-powered forecasting
- Business-specific prediction inputs
- Forecast result visualization

### 🧠 AI Insights

- AI-generated observations
- Personalized recommendations
- Natural-language explanations
- Action-oriented energy guidance

### 📄 Reporting

- Detailed energy reports
- GES rating
- Forecast information
- Business performance information
- PDF report generation

### 🏢 Business Profiles

- Business profile creation
- Industry and location information
- Business-specific energy analysis
- Profile-aware forecasting

### 🔐 Platform

- Clerk authentication
- PostgreSQL persistence
- Responsive web interface
- Structured loading, empty, and error states

---

## 🧠 Machine Learning Pipeline

The ML workflow is structured as:

```text
Raw Energy Data
       │
       ▼
Data Cleaning
       │
       ▼
Feature Engineering
       │
       ▼
Dataset Validation
       │
       ▼
Model Training
       │
       ▼
Model Evaluation
       │
       ▼
Best Model Selection
       │
       ▼
Persisted LightGBM Model
       │
       ▼
FastAPI Inference API
       │
       ▼
GridSense Forecast
```

### Model Development

The training pipeline evaluated:

- Linear Regression
- Random Forest
- XGBoost
- LightGBM

**LightGBM** was selected as the model used by the inference layer.

The inference layer loads the persisted model and applies the same preprocessing and feature contract used during model development.

---

## 🏗️ System Architecture

```text
                         ┌──────────────────────┐
                         │      GridSense UI    │
                         │      Next.js 15      │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                    ▼               ▼                ▼
             PostgreSQL        FastAPI ML       Gemini AI
                Neon             Service           API
                    │               │                │
                    │               ▼                │
                    │          LightGBM              │
                    │           Forecast             │
                    │                                │
                    └──────────────┬─────────────────┘
                                   ▼
                         Business Decision Support
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
                   GES         Forecast       AI Insights
                    │              │              │
                    └──────────────┼──────────────┘
                                   ▼
                                Reports
```

---

## 🛠️ Technology Stack

| Area | Technologies |
| --- | --- |
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| **Machine Learning** | Python, Pandas, NumPy, Scikit-learn, LightGBM, Joblib |
| **Backend / API** | FastAPI, Python, SQLAlchemy, Drizzle ORM |
| **Generative AI** | Google Gemini |
| **Database** | PostgreSQL (Neon) |
| **Authentication** | Clerk |

---

## 📂 Project Structure

```text
GridSense-AI/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── drizzle/
│
├── ml/
│   ├── api/
│   ├── configs/
│   ├── datasets/
│   ├── models/
│   ├── pipeline/
│   └── reports/
│
├── docs/
│
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🧪 Testing & Validation

GridSense includes automated tests across the frontend scoring layer and ML pipeline.

### GES Tests

```bash
cd frontend
npm run test:ges
```

### TypeScript Validation

```bash
cd frontend
npx tsc --noEmit
```

### Frontend Linting

```bash
cd frontend
npm run lint
```

### ML Pipeline Tests

From the project root:

```bash
python -m unittest discover -s ml/pipeline/tests
```

### Current Validation Results

| Check | Result |
| --- | --- |
| GES tests | 19/19 passed |
| ML pipeline tests | 54 passed |
| TypeScript compilation | passed |
| ESLint | passed |
| GES validation | 3,600/3,600 valid records |

---

## 🎯 Target Users

GridSense is designed primarily for SMEs operating in energy-intensive or energy-sensitive environments, including:

- Manufacturing businesses
- Hotels and hospitality providers
- Cold rooms
- Healthcare facilities
- Educational institutions
- Retail businesses
- Restaurants
- Small offices
- Other small and medium-sized enterprises

---

## 🌱 Impact

GridSense aims to make energy intelligence more accessible to businesses that may not have dedicated energy analysts.

By combining forecasting, performance scoring, and AI-generated recommendations, the platform can help businesses:

- understand energy costs
- identify operational problems
- anticipate future expenses
- prioritize improvement opportunities
- make more informed energy decisions

The broader goal is to encourage more efficient and data-driven energy use among SMEs.

---

## 🧩 Challenges & What We Learned

Building GridSense involved challenges beyond simply training a model.

### Turning ML into a usable product

A prediction alone is not enough.

We had to design a workflow where predictions become understandable and actionable for non-technical users.

### Designing a meaningful energy score

Creating GES required defining measurable dimensions, selecting appropriate weighting, handling invalid inputs, and validating the resulting score distribution.

### Data quality

Energy datasets contain missing values, inconsistent measurements, different operating conditions, and varying units.

Building a reliable pipeline required substantial validation before model use.

### Combining ML and Generative AI

The project combines traditional machine learning with generative AI.

Keeping prediction, explanation, and application logic conceptually separate helped make the system easier to reason about and test.

### Designing around real users

During development, several assumptions in the original interface were replaced with explicit business profiles, daily operating-hour inputs, validated dropdown values, and calculated rather than user-entered GES values.

---

## 🔮 Future Plans

Potential future development includes:

- Electricity-bill OCR and automatic data extraction
- Carbon-emissions tracking
- Solar investment and ROI analysis
- Smart-meter / IoT integration
- Energy anomaly detection
- More advanced forecasting models
- Regional energy benchmarks based on real market data
- Team collaboration
- Mobile application

---

## 🎥 Product Flow

The complete GridSense workflow is:

```text
Business Registration
        ↓
Energy Record
        ↓
GridSense Energy Score
        ↓
Analytics
        ↓
ML Forecast
        ↓
AI Insights
        ↓
Report
```

The goal is to take a business from raw energy data to an actionable decision in one platform.

---

## 👨‍💻 Team

**Emmanuel Chisom**

Project Lead · Machine Learning · Backend · Frontend

GridSense AI was developed as a solo project for the **ML Empowerment Build Challenge**.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**⚡ GridSense AI**

Turning energy data into better business decisions.

**Predict • Understand • Act**

</div>
