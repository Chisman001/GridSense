import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  businesses,
  insights,
  predictions,
} from "@/lib/db/schema";

type AIInsightsPayload = {
  summary: string;
  key_insights: string[];
  recommendations: string[];
  risk_level: "low" | "moderate" | "high";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      predictionId: string;
    }>;
  }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return errorResponse(
        401,
        "UNAUTHORIZED",
        "Unauthorized"
      );
    }

    const { predictionId } = await context.params;

    if (!predictionId) {
      return errorResponse(
        400,
        "INVALID_PREDICTION_ID",
        "Prediction ID is required"
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

    if (
      !isRecord(body) ||
      !isAIInsightsPayload(body.aiInsights)
    ) {
      return errorResponse(
        400,
        "INVALID_AI_INSIGHTS",
        "AI insights data is invalid"
      );
    }

    const [business] = await db
      .select({
        id: businesses.id,
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

    const [ownedPrediction] = await db
      .select({
        id: predictions.id,
      })
      .from(predictions)
      .where(
        and(
          eq(predictions.id, predictionId),
          eq(predictions.businessId, business.id)
        )
      )
      .limit(1);

    if (!ownedPrediction) {
      return errorResponse(
        404,
        "PREDICTION_NOT_FOUND",
        "Prediction not found"
      );
    }

    const aiInsights = body.aiInsights;

    const [existingInsight] = await db
      .select({
        id: insights.id,
      })
      .from(insights)
      .where(
        and(
          eq(insights.predictionId, ownedPrediction.id),
          eq(insights.businessId, business.id)
        )
      )
      .limit(1);

    if (existingInsight) {
      const [savedInsights] = await db
        .update(insights)
        .set({
          summary: aiInsights.summary,
          keyInsights: aiInsights.key_insights,
          recommendations: aiInsights.recommendations,
          riskLevel: aiInsights.risk_level,
        })
        .where(eq(insights.id, existingInsight.id))
        .returning();

      return NextResponse.json({
        success: true,
        insights: savedInsights,
      });
    }

    const [savedInsights] = await db
      .insert(insights)
      .values({
        id: ownedPrediction.id,
        businessId: business.id,
        predictionId: ownedPrediction.id,
        summary: aiInsights.summary,
        keyInsights: aiInsights.key_insights,
        recommendations: aiInsights.recommendations,
        riskLevel: aiInsights.risk_level,
      })
      .onConflictDoUpdate({
        target: insights.id,
        set: {
          summary: aiInsights.summary,
          keyInsights: aiInsights.key_insights,
          recommendations: aiInsights.recommendations,
          riskLevel: aiInsights.risk_level,
        },
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        insights: savedInsights,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("FAILED TO SAVE AI INSIGHTS:", error);

    return errorResponse(
      500,
      "AI_INSIGHTS_SAVE_FAILED",
      "Failed to save AI insights"
    );
  }
}
