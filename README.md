<div align="center">

# ⚡ GridSense AI

### AI-Powered Energy Decision Support Platform for SMEs

Predict • Optimize • Save • Sustain

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12-blue?style=for-the-badge&logo=python)](https://python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=for-the-badge&logo=postgresql)](https://neon.tech/)
[![Clerk](https://img.shields.io/badge/Authentication-Clerk-6C47FF?style=for-the-badge)](https://clerk.com/)
[![Gemini](https://img.shields.io/badge/AI-Gemini-4285F4?style=for-the-badge)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)]()

</div>

---

## 🌍 Why We Built GridSense AI

While working on energy-related projects and researching the challenges businesses face during the transition to more sustainable energy solutions, we observed a recurring problem:

Small and Medium-sized Enterprises (SMEs) often struggle with rising electricity and fuel costs but lack accessible tools that help them make informed energy decisions.

Many businesses rely on historical bills and intuition rather than data-driven insights when deciding how to manage energy expenses or invest in alternative energy solutions.

This observation inspired the development of GridSense AI—an intelligent platform that helps businesses transform energy data into actionable decisions.

---

## 💡 Our Solution

GridSense AI is an AI-powered Energy Decision Support Platform designed to help SMEs understand, predict, and optimize their energy consumption.

By combining Machine Learning, predictive analytics, and Large Language Models (LLMs), the platform analyzes historical energy data, forecasts future energy costs, identifies inefficiencies, and delivers personalized recommendations that business owners can act on immediately.

Rather than acting as another reporting dashboard, GridSense AI serves as an intelligent decision-support assistant that helps businesses reduce operational costs and improve energy efficiency.

---

## 🌱 Our Inspiration

GridSense AI was inspired by real-world energy challenges faced by SMEs, particularly in regions where businesses operate with a combination of grid electricity, generators, and alternative energy sources.

During research into energy consulting and business energy transition strategies, it became clear that while large organizations often have access to energy management systems, smaller businesses rarely have affordable tools that translate complex energy data into practical business decisions.

Our goal is to bridge that gap by making intelligent energy insights accessible to every business, regardless of size.

---

## 🤖 Why AI?

Artificial Intelligence enables GridSense AI to move beyond traditional reporting by helping businesses answer questions such as:

- What will my energy costs look like next month?
- Why are my expenses increasing?
- Which actions will save the most money?
- Which recommendations should I prioritize first?

Machine Learning predicts future trends, while Generative AI explains those predictions in simple, business-friendly language and recommends practical next steps.

---

## ✨ Key Features

- 📈 Energy Cost Forecasting
- 🤖 AI-Powered Recommendations
- ⚡ GridSense Energy Score
- 📊 Interactive Analytics Dashboard
- 🏢 Multi-Business Management
- 📄 PDF Report Generation
- 🔒 Secure Authentication with Clerk
- 📉 Cost Trend Analysis
- 💰 Savings Estimation
- 📱 Responsive Modern UI

---

## 🎯 Target Users

GridSense AI is designed for:

- Manufacturing businesses
- Hotels and hospitality providers
- Retail stores
- Restaurants
- Healthcare facilities
- Educational institutions
- Small offices
- Any SME seeking to reduce energy costs and improve operational efficiency

---

## 🏗️ System Architecture

```
Frontend (Next.js)
        │
        ▼
FastAPI Backend
        │
 ┌──────┴────────┐
 │               │
 ▼               ▼
Machine Learning   Gemini AI
       │
       ▼
PostgreSQL (Neon)
```

---

## 🛠️ Technology Stack

### Frontend

- Next.js 15
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts

### Backend

- FastAPI
- SQLAlchemy
- Alembic

### Machine Learning

- Scikit-Learn
- Pandas
- NumPy

### AI

- Google Gemini

### Database

- PostgreSQL (Neon)

### Authentication

- Clerk

### Deployment

- Vercel
- Render

---

## 📂 Project Structure

```
GridSense-AI/

frontend/
backend/
docs/
datasets/
models/
reports/

README.md
LICENSE
```

---

## 🚀 Getting Started

### Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/GridSense-AI.git

cd GridSense-AI
```

---

### Frontend

```bash
cd frontend

npm install

npm run dev
```

---

### Backend

```bash
cd backend

pip install -r requirements.txt

uvicorn app.main:app --reload
```

---

### Environment Variables

Frontend

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

NEXT_PUBLIC_API_URL=
```

Backend

```env
DATABASE_URL=

CLERK_SECRET_KEY=

GEMINI_API_KEY=

JWT_SECRET=
```

---

## 📊 Machine Learning Pipeline

```
Energy Data

↓

Data Cleaning

↓

Feature Engineering

↓

Model Training

↓

Prediction

↓

AI Recommendation

↓

Dashboard
```

---

## 📸 Screenshots

### Landing Page

Coming Soon

### Dashboard

Coming Soon

### AI Insights

Coming Soon

### Reports

Coming Soon

---

## 📅 Development Roadmap

- [x] Planning
- [x] System Design
- [ ] Backend Development
- [ ] Frontend Development
- [ ] Machine Learning
- [ ] AI Integration
- [ ] Testing
- [ ] Deployment

---

## 🎯 Future Improvements

- OCR Electricity Bill Upload
- Carbon Emissions Dashboard
- Solar ROI Calculator
- IoT Smart Meter Integration
- Team Collaboration
- Mobile Application

---

## 👨‍💻 Contributors

### Emmanuel Chisom

Project Lead

Machine Learning

Backend Development

Frontend Development

---

## 📜 License

This project is released under the MIT License.

---

<div align="center">

### ⚡ Empowering SMEs to Make Smarter Energy Decisions

Built with ❤️ for the AI for Good Hackathon

</div>