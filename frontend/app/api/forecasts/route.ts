import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  businesses,
  energyRecords,
  predictions,
  insights,
} from "@/lib/db/schema";
import { isEnergyRecordPeriodConflict } from "@/lib/energy-records";

import { and, eq } from "drizzle-orm";

type ForecastForm = {
  year: number;
  month: number;
  quarter: number;
  energy_source: string;
  electricity_bill: number;
  diesel_cost: number;
  petrol_cost: number;
  total_energy_cost: number;
  energy_consumption_kwh: number;
  fuel_consumption_liters: number;
  generator_hours: number;
  grid_hours: number;
  outage_hours: number;
  operating_hours: number;
  employee_count: number;
  employees: number;
  occupancy_rate: number;
  floor_area_sqm: number;
  solar_capacity_kw: number;
  renewable_energy_percentage: number;
  maintenance_cost: number;
  monthly_revenue: number;
  energy_cost_per_employee: number;
  cost_per_kwh: number;
  average_monthly_energy_cost: number;
  energy_efficiency_score: number;
  generator_dependency: number;
  revenue_energy_ratio: number;
  outage_severity: number;
  weather_avg_temp: number;
  estimated_carbon_intensity: number;
};

type PredictionPayload = {
  predicted_next_month_energy_cost: number;
  model: string;
  analytics?: {
    predicted_change?: number;
    predicted_change_percent?: number;
    predicted_cost_per_employee?: number;
    predicted_cost_per_kwh?: number;
    generator_dependency_percent?: number;
    outage_hours?: number;
    predicted_energy_cost_as_percent_of_revenue?: number;
  } | null;
};

type AIInsightsPayload = {
  summary: string;
  key_insights: string[];
  recommendations: string[];
  risk_level: "low" | "moderate" | "high";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isForecastForm(value: unknown): value is ForecastForm {
  if (!isRecord(value) || typeof value.energy_source !== "string") {
    return false;
  }

  const numericFields = [
    "year",
    "month",
    "quarter",
    "electricity_bill",
    "diesel_cost",
    "petrol_cost",
    "total_energy_cost",
    "energy_consumption_kwh",
    "fuel_consumption_liters",
    "generator_hours",
    "grid_hours",
    "outage_hours",
    "operating_hours",
    "employee_count",
    "employees",
    "occupancy_rate",
    "floor_area_sqm",
    "solar_capacity_kw",
    "renewable_energy_percentage",
    "maintenance_cost",
    "monthly_revenue",
    "energy_cost_per_employee",
    "cost_per_kwh",
    "average_monthly_energy_cost",
    "energy_efficiency_score",
    "generator_dependency",
    "revenue_energy_ratio",
    "outage_severity",
    "weather_avg_temp",
    "estimated_carbon_intensity",
  ] as const;

  if (!numericFields.every((field) => isFiniteNumber(value[field]))) {
    return false;
  }

  const nonNegativeFields = [
    "electricity_bill",
    "diesel_cost",
    "petrol_cost",
    "total_energy_cost",
    "energy_consumption_kwh",
    "fuel_consumption_liters",
    "generator_hours",
    "grid_hours",
    "outage_hours",
    "operating_hours",
    "employee_count",
    "employees",
    "occupancy_rate",
    "floor_area_sqm",
    "solar_capacity_kw",
    "renewable_energy_percentage",
    "maintenance_cost",
    "monthly_revenue",
    "energy_cost_per_employee",
    "cost_per_kwh",
    "average_monthly_energy_cost",
    "generator_dependency",
    "revenue_energy_ratio",
    "outage_severity",
    "estimated_carbon_intensity",
  ] as const;

  const year = value.year as number;
  const month = value.month as number;
  const quarter = value.quarter as number;
  const employeeCount = value.employee_count as number;
  const employees = value.employees as number;
  const occupancyRate = value.occupancy_rate as number;
  const renewableEnergyPercentage =
    value.renewable_energy_percentage as number;

  return (
    value.energy_source.trim().length > 0 &&
    nonNegativeFields.every(
      (field) => (value[field] as number) >= 0
    ) &&
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(quarter) &&
    quarter >= 1 &&
    quarter <= 4 &&
    Number.isInteger(employeeCount) &&
    employeeCount >= 0 &&
    Number.isInteger(employees) &&
    employees >= 0 &&
    occupancyRate >= 0 &&
    occupancyRate <= 100 &&
    renewableEnergyPercentage >= 0 &&
    renewableEnergyPercentage <= 100
  );
}

function isPredictionPayload(
  value: unknown
): value is PredictionPayload {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.predicted_next_month_energy_cost) ||
    typeof value.model !== "string" ||
    value.model.trim().length === 0
  ) {
    return false;
  }

  const analytics = value.analytics;

  if (analytics === undefined || analytics === null) {
    return true;
  }

  if (!isRecord(analytics)) {
    return false;
  }

  const analyticsFields = [
    "predicted_change",
    "predicted_change_percent",
    "predicted_cost_per_employee",
    "predicted_cost_per_kwh",
    "generator_dependency_percent",
    "outage_hours",
    "predicted_energy_cost_as_percent_of_revenue",
  ] as const;

  return analyticsFields.every(
    (field) =>
      analytics[field] === undefined ||
      isFiniteNumber(analytics[field])
  );
}

function isAIInsightsPayload(
  value: unknown
): value is AIInsightsPayload {
  return (
    isRecord(value) &&
    typeof value.summary === "string" &&
    Array.isArray(value.key_insights) &&
    value.key_insights.every((item) => typeof item === "string") &&
    Array.isArray(value.recommendations) &&
    value.recommendations.every((item) => typeof item === "string") &&
    (value.risk_level === "low" ||
      value.risk_level === "moderate" ||
      value.risk_level === "high")
  );
}

function errorResponse(
  status: number,
  code: string,
  message: string
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
    },
    {
      status,
    }
  );
}

function duplicatePeriodResponse() {
  return errorResponse(
    409,
    "DUPLICATE_ENERGY_RECORD_PERIOD",
    "An energy record already exists for this year and month. Use the existing record in Energy Records instead of creating another forecast record."
  );
}

function forecastAlreadyExistsResponse() {
  return errorResponse(
    409,
    "FORECAST_ALREADY_EXISTS",
    "A forecast already exists for this period."
  );
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return errorResponse(
        401,
        "UNAUTHORIZED",
        "Unauthorized"
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        400,
        "INVALID_JSON",
        "Request body must be valid JSON"
      );
    }

    if (!isRecord(body)) {
      return errorResponse(
        400,
        "INVALID_REQUEST",
        "Forecast request body is invalid"
      );
    }

    const { form, prediction, aiInsights } = body;

    if (!isForecastForm(form)) {
      return errorResponse(
        400,
        "INVALID_FORECAST_FORM",
        "Forecast form data is invalid"
      );
    }

    if (!isPredictionPayload(prediction)) {
      return errorResponse(
        400,
        "INVALID_PREDICTION",
        "Prediction data is invalid"
      );
    }

    if (
      aiInsights !== undefined &&
      aiInsights !== null &&
      !isAIInsightsPayload(aiInsights)
    ) {
      return errorResponse(
        400,
        "INVALID_AI_INSIGHTS",
        "AI insights data is invalid"
      );
    }

    // Find the business belonging to the logged-in Clerk user
    const businessResult = await db
      .select()
      .from(businesses)
      .where(eq(businesses.clerkUserId, userId))
      .limit(1);

    const business = businessResult[0];

    if (!business) {
      return errorResponse(
        404,
        "BUSINESS_NOT_FOUND",
        "Business profile not found"
      );
    }

    const [existingRecord] = await db
      .select()
      .from(energyRecords)
      .where(
        and(
          eq(energyRecords.businessId, business.id),
          eq(energyRecords.year, form.year),
          eq(energyRecords.month, form.month)
        )
      )
      .limit(1);

    let energyRecord = existingRecord ?? null;

    if (existingRecord) {
      const [linkedPrediction] = await db
        .select({ id: predictions.id })
        .from(predictions)
        .where(
          and(
            eq(predictions.energyRecordId, existingRecord.id),
            eq(predictions.businessId, business.id)
          )
        )
        .limit(1);

      if (linkedPrediction) {
        return forecastAlreadyExistsResponse();
      }
    } else {
      const [insertedRecord] = await db
        .insert(energyRecords)
        .values({
          id: crypto.randomUUID(),
          businessId: business.id,

          year: form.year,
          month: form.month,
          quarter: form.quarter,

          energySource: form.energy_source,

          electricityBill: form.electricity_bill,
          dieselCost: form.diesel_cost,
          petrolCost: form.petrol_cost,
          totalEnergyCost: form.total_energy_cost,

          energyConsumptionKwh:
            form.energy_consumption_kwh,

          fuelConsumptionLiters:
            form.fuel_consumption_liters,

          generatorHours: form.generator_hours,
          gridHours: form.grid_hours,
          outageHours: form.outage_hours,
          operatingHours: form.operating_hours,

          employeeCount: form.employee_count,
          employees: form.employees,

          occupancyRate: form.occupancy_rate,
          floorAreaSqm: form.floor_area_sqm,

          solarCapacityKw: form.solar_capacity_kw,

          renewableEnergyPercentage:
            form.renewable_energy_percentage,

          maintenanceCost: form.maintenance_cost,
          monthlyRevenue: form.monthly_revenue,

          energyCostPerEmployee:
            form.energy_cost_per_employee,

          costPerKwh: form.cost_per_kwh,

          averageMonthlyEnergyCost:
            form.average_monthly_energy_cost,

          energyEfficiencyScore:
            form.energy_efficiency_score,

          generatorDependency:
            form.generator_dependency,

          revenueEnergyRatio:
            form.revenue_energy_ratio,

          outageSeverity:
            form.outage_severity,

          weatherAvgTemp:
            form.weather_avg_temp,

          estimatedCarbonIntensity:
            form.estimated_carbon_intensity,
        })
        .returning();

      energyRecord = insertedRecord;
    }

    if (!energyRecord) {
      return errorResponse(
        500,
        "FORECAST_SAVE_FAILED",
        "Failed to save forecast"
      );
    }

    const predictionId = crypto.randomUUID();

    // 2. Save the prediction
    const [savedPrediction] = await db
      .insert(predictions)
      .values({
        id: predictionId,

        businessId: business.id,

        energyRecordId: energyRecord.id,

        predictedNextMonthEnergyCost:
          prediction.predicted_next_month_energy_cost,

        predictedChange:
          prediction.analytics?.predicted_change ?? null,

        predictedChangePercent:
          prediction.analytics
            ?.predicted_change_percent ?? null,

        predictedCostPerEmployee:
          prediction.analytics
            ?.predicted_cost_per_employee ?? null,

        predictedCostPerKwh:
          prediction.analytics
            ?.predicted_cost_per_kwh ?? null,

        generatorDependencyPercent:
          prediction.analytics
            ?.generator_dependency_percent ?? null,

        outageHours:
          prediction.analytics?.outage_hours ?? null,

        predictedEnergyCostAsPercentOfRevenue:
          prediction.analytics
            ?.predicted_energy_cost_as_percent_of_revenue ??
          null,

        model: prediction.model,
      })
      .returning();

    // 3. Save Gemini insights if they exist
    let savedInsights = null;

    if (aiInsights && isAIInsightsPayload(aiInsights)) {
      const insightId = crypto.randomUUID();

      const [insertedInsights] = await db
        .insert(insights)
        .values({
          id: insightId,

          businessId: business.id,

          predictionId: savedPrediction.id,

          summary: aiInsights.summary,

          keyInsights: aiInsights.key_insights,

          recommendations:
            aiInsights.recommendations,

          riskLevel: aiInsights.risk_level,
        })
        .returning();

      savedInsights = insertedInsights;
    }

    return NextResponse.json(
      {
        success: true,
        energyRecord,
        prediction: savedPrediction,
        insights: savedInsights,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    if (isEnergyRecordPeriodConflict(error)) {
      return duplicatePeriodResponse();
    }

    console.error("FAILED TO SAVE FORECAST:", error);

    return errorResponse(
      500,
      "FORECAST_SAVE_FAILED",
      "Failed to save forecast"
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return errorResponse(
        401,
        "UNAUTHORIZED",
        "Unauthorized"
      );
    }

    const [business] = await db
      .select({
        id: businesses.id,
        businessName: businesses.businessName,
      })
      .from(businesses)
      .where(eq(businesses.clerkUserId, userId))
      .limit(1);

    if (!business) {
      return errorResponse(
        404,
        "BUSINESS_NOT_FOUND",
        "Business profile not found"
      );
    }

    const forecastHistory = await db.query.predictions.findMany({
      where: eq(predictions.businessId, business.id),
      orderBy: (prediction, { desc }) => [
        desc(prediction.createdAt),
      ],
      with: {
        energyRecord: true,
        insights: {
          orderBy: (insight, { desc }) => [
            desc(insight.createdAt),
          ],
          limit: 1,
        },
      },
    });

    const forecasts = forecastHistory.map((forecast) => {
      const ownedEnergyRecord =
        forecast.energyRecord?.businessId === business.id
          ? forecast.energyRecord
          : null;
      const savedInsights =
        forecast.insights.find(
          (savedInsight) =>
            savedInsight.businessId === business.id
        ) ?? null;

      return {
        id: forecast.id,
        createdAt: forecast.createdAt,
        model: forecast.model,
        predictedNextMonthEnergyCost:
          forecast.predictedNextMonthEnergyCost,
        predictedChange: forecast.predictedChange,
        predictedChangePercent:
          forecast.predictedChangePercent,
        predictedCostPerEmployee:
          forecast.predictedCostPerEmployee,
        predictedCostPerKwh:
          forecast.predictedCostPerKwh,
        generatorDependencyPercent:
          forecast.generatorDependencyPercent,
        outageHours: forecast.outageHours,
        predictedEnergyCostAsPercentOfRevenue:
          forecast.predictedEnergyCostAsPercentOfRevenue,
        energyRecord: ownedEnergyRecord
          ? {
              id: ownedEnergyRecord.id,
              year: ownedEnergyRecord.year,
              month: ownedEnergyRecord.month,
              quarter: ownedEnergyRecord.quarter,
              energySource:
                ownedEnergyRecord.energySource,
              totalEnergyCost:
                ownedEnergyRecord.totalEnergyCost,
              energyConsumptionKwh:
                ownedEnergyRecord.energyConsumptionKwh,
              outageHours:
                ownedEnergyRecord.outageHours,
              costPerKwh:
                ownedEnergyRecord.costPerKwh,
              renewableEnergyPercentage:
                ownedEnergyRecord.renewableEnergyPercentage,
              createdAt: ownedEnergyRecord.createdAt,
            }
          : null,
        insights: savedInsights
          ? {
              id: savedInsights.id,
              summary: savedInsights.summary,
              keyInsights: Array.isArray(
                savedInsights.keyInsights
              )
                ? savedInsights.keyInsights.filter(
                    (item): item is string =>
                      typeof item === "string"
                  )
                : [],
              recommendations: Array.isArray(
                savedInsights.recommendations
              )
                ? savedInsights.recommendations.filter(
                    (item): item is string =>
                      typeof item === "string"
                  )
                : [],
              riskLevel: savedInsights.riskLevel,
              createdAt: savedInsights.createdAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      business,
      latestForecast: forecasts[0] ?? null,
      forecasts,
    });
  } catch (error) {
    console.error("FAILED TO FETCH FORECASTS:", error);

    return errorResponse(
      500,
      "FORECAST_FETCH_FAILED",
      "Failed to load forecasts"
    );
  }
}