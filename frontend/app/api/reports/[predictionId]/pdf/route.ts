import { auth } from "@clerk/nextjs/server";

import {
  buildPdfFilename,
  buildReportPdfBuffer,
  loadOwnedReport,
  reportErrorResponse,
  resolveReportBusiness,
} from "@/lib/reports";

export const runtime = "nodejs";

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

    const pdfBuffer = await buildReportPdfBuffer(reportPayload);
    const filename = buildPdfFilename(
      reportPayload.report.energyRecord
    );

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("FAILED TO GENERATE REPORT PDF:", error);

    return reportErrorResponse(
      500,
      "REPORT_PDF_FAILED",
      "Failed to generate report PDF"
    );
  }
}
