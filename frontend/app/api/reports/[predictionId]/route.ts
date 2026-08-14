import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  loadOwnedReport,
  reportErrorResponse,
  resolveReportBusiness,
} from "@/lib/reports";

type RouteContext = {
  params: Promise<{
    predictionId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return reportErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const { predictionId } = await context.params;

    if (!predictionId || predictionId.trim().length === 0) {
      return reportErrorResponse(
        400,
        "INVALID_PREDICTION_ID",
        "Prediction ID is required"
      );
    }

    const business = await resolveReportBusiness(userId);

    if (!business) {
      return reportErrorResponse(
        404,
        "BUSINESS_NOT_FOUND",
        "Business profile not found"
      );
    }

    const reportPayload = await loadOwnedReport(
      predictionId.trim(),
      business.id
    );

    if (!reportPayload) {
      return reportErrorResponse(
        404,
        "REPORT_NOT_FOUND",
        "Report not found"
      );
    }

    return NextResponse.json({
      success: true,
      business: reportPayload.business,
      report: reportPayload.report,
    });
  } catch (error) {
    console.error("FAILED TO FETCH REPORT:", error);

    return reportErrorResponse(
      500,
      "REPORT_FETCH_FAILED",
      "Failed to load report"
    );
  }
}
