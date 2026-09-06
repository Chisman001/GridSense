import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  businesses,
  energyRecords,
  predictions,
  insights,
} from "@/lib/db/schema";
import {
  isEnergyRecordPeriodConflict,
  persistableEnergyRecord,
  validateEnergyRecord,
  type RawEnergyRecord,
} from "@/lib/energy-records";

import { and, eq } from "drizzle-orm";

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

    const formValidation = validateEnergyRecord(form);
    if (!formValidation.success) {
      return errorResponse(
        400,
        "INVALID_FORECAST_FORM",
        "Forecast form data is invalid"
      );
    }

    const rawForm: RawEnergyRecord = formValidation.data;

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
          eq(energyRecords.year, rawForm.year),
          eq(energyRecords.month, rawForm.month)
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
      const persisted = await persistableEnergyRecord(
        rawForm,
        business.id
      );

      const [insertedRecord] = await db
        .insert(energyRecords)
        .values({
          id: crypto.randomUUID(),
          businessId: business.id,
          ...persisted,
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
        businessType: businesses.businessType,
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