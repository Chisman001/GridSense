import { and, desc, eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  businesses,
  energyRecords,
  insights,
  predictions,
} from "@/lib/db/schema";
import { calculateGES } from "@/lib/ges-v1";

export type ReportBusiness = {
  id: string;
  businessName: string;
  businessType: string;
  industry: string;
  state: string;
};

export type ReportPrediction = {
  id: string;
  businessId: string;
  energyRecordId: string | null;
  predictedNextMonthEnergyCost: number;
  predictedChange: number | null;
  predictedChangePercent: number | null;
  predictedCostPerEmployee: number | null;
  predictedCostPerKwh: number | null;
  generatorDependencyPercent: number | null;
  outageHours: number | null;
  predictedEnergyCostAsPercentOfRevenue: number | null;
  model: string;
  createdAt: Date;
};

export type ReportEnergyRecord = {
  id: string;
  businessId: string;
  year: number;
  month: number;
  quarter: number;
  energySource: string;
  electricityBill: number;
  dieselCost: number;
  petrolCost: number;
  totalEnergyCost: number;
  energyConsumptionKwh: number;
  fuelConsumptionLiters: number;
  generatorHours: number;
  gridHours: number;
  outageHours: number;
  operatingHours: number;
  employeeCount: number;
  employees: number;
  occupancyRate: number;
  floorAreaSqm: number;
  solarCapacityKw: number;
  renewableEnergyPercentage: number;
  maintenanceCost: number;
  monthlyRevenue: number;
  energyCostPerEmployee: number;
  costPerKwh: number;
  averageMonthlyEnergyCost: number;
  energyEfficiencyScore: number;
  generatorDependency: number;
  revenueEnergyRatio: number;
  outageSeverity: number;
  weatherAvgTemp: number;
  estimatedCarbonIntensity: number;
  createdAt: Date;
};

export type ReportInsight = {
  id: string;
  businessId: string;
  predictionId: string;
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  riskLevel: string;
  createdAt: Date;
};

export type ReportPayload = {
  business: ReportBusiness;
  report: {
    prediction: ReportPrediction;
    energyRecord: ReportEnergyRecord | null;
    insight: ReportInsight | null;
  };
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function reportErrorResponse(
  status: number,
  code: string,
  error: string
) {
  return NextResponse.json(
    {
      success: false,
      error,
      code,
    },
    { status }
  );
}

export async function resolveReportBusiness(
  userId: string
): Promise<ReportBusiness | null> {
  const [business] = await db
    .select({
      id: businesses.id,
      businessName: businesses.businessName,
      businessType: businesses.businessType,
      industry: businesses.industry,
      state: businesses.state,
    })
    .from(businesses)
    .where(eq(businesses.clerkUserId, userId))
    .limit(1);

  return business ?? null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export async function loadOwnedReport(
  predictionId: string,
  businessId: string
): Promise<ReportPayload | null> {
  const [prediction] = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.id, predictionId),
        eq(predictions.businessId, businessId)
      )
    )
    .limit(1);

  if (!prediction) {
    return null;
  }

  const [business] = await db
    .select({
      id: businesses.id,
      businessName: businesses.businessName,
      businessType: businesses.businessType,
      industry: businesses.industry,
      state: businesses.state,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) {
    return null;
  }

  let energyRecord: ReportEnergyRecord | null = null;

  if (prediction.energyRecordId) {
    const [ownedRecord] = await db
      .select()
      .from(energyRecords)
      .where(
        and(
          eq(energyRecords.id, prediction.energyRecordId),
          eq(energyRecords.businessId, businessId)
        )
      )
      .limit(1);

    energyRecord = ownedRecord ?? null;
  }

  const [ownedInsight] = await db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.predictionId, prediction.id),
        eq(insights.businessId, businessId)
      )
    )
    .orderBy(desc(insights.createdAt))
    .limit(1);

  const insight: ReportInsight | null = ownedInsight
    ? {
        id: ownedInsight.id,
        businessId: ownedInsight.businessId,
        predictionId: ownedInsight.predictionId,
        summary: ownedInsight.summary,
        keyInsights: asStringArray(ownedInsight.keyInsights),
        recommendations: asStringArray(ownedInsight.recommendations),
        riskLevel: ownedInsight.riskLevel,
        createdAt: ownedInsight.createdAt,
      }
    : null;

  return {
    business,
    report: {
      prediction: {
        id: prediction.id,
        businessId: prediction.businessId,
        energyRecordId: prediction.energyRecordId,
        predictedNextMonthEnergyCost:
          prediction.predictedNextMonthEnergyCost,
        predictedChange: prediction.predictedChange,
        predictedChangePercent: prediction.predictedChangePercent,
        predictedCostPerEmployee: prediction.predictedCostPerEmployee,
        predictedCostPerKwh: prediction.predictedCostPerKwh,
        generatorDependencyPercent:
          prediction.generatorDependencyPercent,
        outageHours: prediction.outageHours,
        predictedEnergyCostAsPercentOfRevenue:
          prediction.predictedEnergyCostAsPercentOfRevenue,
        model: prediction.model,
        createdAt: prediction.createdAt,
      },
      energyRecord,
      insight,
    },
  };
}

export function formatReportCurrency(
  value: number | null | undefined
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatReportSignedCurrency(
  value: number | null | undefined
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unavailable";
  }

  const formatted = formatReportCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatReportPercent(
  value: number | null | undefined
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unavailable";
  }

  const absolute = Math.abs(value).toFixed(1);
  if (value > 0) return `+${absolute}%`;
  if (value < 0) return `-${absolute}%`;
  return `${absolute}%`;
}

export function formatReportNumber(
  value: number | null | undefined,
  options?: {
    suffix?: string;
    fractionDigits?: number;
    asPercent?: boolean;
  }
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unavailable";
  }

  const digits = options?.fractionDigits ?? 2;
  if (options?.asPercent) {
    return `${(value * 100).toFixed(digits)}%`;
  }

  return `${value.toFixed(digits)}${options?.suffix ?? ""}`;
}

export function formatGesScore(
  energyRecord: ReportEnergyRecord | null | undefined
): string {
  if (!energyRecord) {
    return "Unavailable";
  }

  const ges = calculateGES({
    totalEnergyCost: energyRecord.totalEnergyCost,
    monthlyRevenue: energyRecord.monthlyRevenue,
    generatorHours: energyRecord.generatorHours,
    gridHours: energyRecord.gridHours,
    outageHours: energyRecord.outageHours,
    operatingHours: energyRecord.operatingHours,
    year: energyRecord.year,
    month: energyRecord.month,
  });

  if (!ges.available) {
    return "Unavailable";
  }

  const score = Number.isInteger(ges.score)
    ? ges.score.toFixed(0)
    : ges.score.toFixed(1);
  return `${score}/100 · ${ges.rating}`;
}

export function formatStoredPercent(
  value: number | null | undefined
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unavailable";
  }

  return `${value.toFixed(1)}%`;
}

function recordedLabel(period: string, noun: string): string {
  if (period === "Unavailable") {
    return `Recorded ${noun}`;
  }

  return `${period} recorded ${noun}`;
}

function forecastLabel(period: string): string {
  if (period === "Unavailable") {
    return "Forecast next-month cost";
  }

  return `${period} forecast`;
}

export function formatReportPeriod(
  year: number | null | undefined,
  month: number | null | undefined
): string {
  if (
    typeof year !== "number" ||
    typeof month !== "number" ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return "Unavailable";
  }

  return `${monthNames[month - 1]} ${year}`;
}

export function getForecastTargetPeriod(
  year: number | null | undefined,
  month: number | null | undefined
): string {
  if (
    typeof year !== "number" ||
    typeof month !== "number" ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return "Unavailable";
  }

  const next = new Date(year, month);
  return `${monthNames[next.getMonth()]} ${next.getFullYear()}`;
}

export function getForecastDirection(
  change: number | null | undefined
): string {
  if (typeof change !== "number" || !Number.isFinite(change)) {
    return "Unavailable";
  }

  if (change > 0) return "Increase";
  if (change < 0) return "Decrease";
  return "No change";
}

export function formatReportDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Unavailable";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function buildPdfFilename(
  energyRecord: Pick<ReportEnergyRecord, "year" | "month"> | null
): string {
  if (energyRecord) {
    const month = String(energyRecord.month).padStart(2, "0");
    return `gridsense-report-${energyRecord.year}-${month}.pdf`;
  }

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `gridsense-report-${now.getFullYear()}-${month}.pdf`;
}

function writeKeyValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#0f172a")
    .text(`${label}: `, { continued: true })
    .font("Helvetica")
    .fillColor("#334155")
    .text(value);
}

function writeSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#0f172a")
    .text(title);
  doc
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor("#cbd5e1")
    .lineWidth(0.8)
    .stroke();
  doc.moveDown(0.6);
}

function writeBulletList(doc: PDFKit.PDFDocument, items: string[]) {
  if (items.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("None");
    return;
  }

  for (const item of items) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#334155")
      .text(`• ${item}`, {
        width:
          doc.page.width - doc.page.margins.left - doc.page.margins.right,
      });
  }
}

export async function buildReportPdfBuffer(
  payload: ReportPayload
): Promise<Buffer> {
  const { business, report } = payload;
  const { prediction, energyRecord, insight } = report;

  const actualPeriod = energyRecord
    ? formatReportPeriod(energyRecord.year, energyRecord.month)
    : "Unavailable";
  const forecastPeriod = energyRecord
    ? getForecastTargetPeriod(energyRecord.year, energyRecord.month)
    : "Unavailable";
  const generatedDate = formatReportDate(new Date());

  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    info: {
      Title: "GridSense Energy Report",
      Author: "GridSense",
    },
  });

  const chunks: Buffer[] = [];

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#0f172a")
    .text("GridSense Energy Report");

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#64748b")
    .text("Energy performance and forecast summary");

  doc.moveDown(0.8);
  writeKeyValue(doc, "Business name", business.businessName);
  writeKeyValue(doc, "Business type", business.businessType);
  writeKeyValue(doc, "Industry", business.industry);
  writeKeyValue(doc, "State", business.state);
  writeKeyValue(doc, "Report / forecast period", `${actualPeriod} → ${forecastPeriod}`);
  writeKeyValue(doc, "Generated date", generatedDate);

  writeSectionTitle(doc, "Executive Summary");
  writeKeyValue(
    doc,
    `Actual energy cost (${recordedLabel(actualPeriod, "cost")})`,
    formatReportCurrency(energyRecord?.totalEnergyCost)
  );
  writeKeyValue(
    doc,
    `Forecasted next-month cost (${forecastLabel(forecastPeriod)})`,
    formatReportCurrency(prediction.predictedNextMonthEnergyCost)
  );
  writeKeyValue(
    doc,
    "Forecast absolute change",
    formatReportSignedCurrency(prediction.predictedChange)
  );
  writeKeyValue(
    doc,
    "Forecast percentage change",
    formatReportPercent(prediction.predictedChangePercent)
  );
  writeKeyValue(
    doc,
    "Forecast direction",
    getForecastDirection(prediction.predictedChange)
  );
  writeKeyValue(
    doc,
    `GridSense Energy Score (${recordedLabel(actualPeriod, "score")})`,
    formatGesScore(energyRecord)
  );

  writeSectionTitle(
    doc,
    actualPeriod === "Unavailable"
      ? "Energy Performance (Recorded)"
      : `Energy Performance (Recorded for ${actualPeriod})`
  );
  writeKeyValue(
    doc,
    "Energy consumption",
    formatReportNumber(energyRecord?.energyConsumptionKwh, {
      suffix: " kWh",
    })
  );
  writeKeyValue(
    doc,
    "Cost per kWh",
    formatReportCurrency(energyRecord?.costPerKwh)
  );
  writeKeyValue(
    doc,
    "GridSense Energy Score",
    formatGesScore(energyRecord)
  );
  writeKeyValue(
    doc,
    "Energy cost per employee",
    formatReportCurrency(energyRecord?.energyCostPerEmployee)
  );
  writeKeyValue(
    doc,
    "Revenue / energy ratio",
    formatReportNumber(energyRecord?.revenueEnergyRatio, {
      fractionDigits: 2,
    })
  );

  writeSectionTitle(
    doc,
    actualPeriod === "Unavailable"
      ? "Cost Breakdown (Recorded Costs)"
      : `Cost Breakdown (Recorded Costs for ${actualPeriod})`
  );
  writeKeyValue(
    doc,
    "Electricity",
    formatReportCurrency(energyRecord?.electricityBill)
  );
  writeKeyValue(
    doc,
    "Diesel",
    formatReportCurrency(energyRecord?.dieselCost)
  );
  writeKeyValue(
    doc,
    "Petrol",
    formatReportCurrency(energyRecord?.petrolCost)
  );
  writeKeyValue(
    doc,
    "Maintenance",
    formatReportCurrency(energyRecord?.maintenanceCost)
  );
  writeKeyValue(
    doc,
    "Total energy cost",
    formatReportCurrency(energyRecord?.totalEnergyCost)
  );

  writeSectionTitle(
    doc,
    actualPeriod === "Unavailable"
      ? "Operational Metrics (Recorded)"
      : `Operational Metrics (Recorded for ${actualPeriod})`
  );
  writeKeyValue(
    doc,
    "Recorded generator dependency",
    formatReportNumber(energyRecord?.generatorDependency, {
      asPercent: true,
      fractionDigits: 1,
    })
  );
  writeKeyValue(
    doc,
    "Generator hours",
    formatReportNumber(energyRecord?.generatorHours, {
      suffix: " hrs",
    })
  );
  writeKeyValue(
    doc,
    "Grid hours",
    formatReportNumber(energyRecord?.gridHours, { suffix: " hrs" })
  );
  writeKeyValue(
    doc,
    "Outage hours",
    formatReportNumber(energyRecord?.outageHours, { suffix: " hrs" })
  );
  writeKeyValue(
    doc,
    "Operating hours",
    formatReportNumber(energyRecord?.operatingHours, {
      suffix: " hrs",
    })
  );

  writeSectionTitle(doc, "AI Insights");
  if (insight) {
    writeKeyValue(
      doc,
      "Analysis context",
      actualPeriod === "Unavailable"
        ? "Stored AI analysis for this forecast"
        : `Stored AI analysis for the ${actualPeriod} forecast`
    );
    writeKeyValue(doc, "Risk level", insight.riskLevel);
    writeKeyValue(doc, "Summary", insight.summary);
    doc.moveDown(0.3);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#0f172a")
      .text("Key insights");
    writeBulletList(doc, insight.keyInsights);
    doc.moveDown(0.3);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#0f172a")
      .text("Recommendations");
    writeBulletList(doc, insight.recommendations);
  } else {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#64748b")
      .text("AI insights were not available for this forecast.");
  }

  writeSectionTitle(
    doc,
    forecastPeriod === "Unavailable"
      ? "Forecast Context (Saved Prediction)"
      : `Forecast Context (Targeting ${forecastPeriod})`
  );
  writeKeyValue(doc, "Model", prediction.model);
  writeKeyValue(doc, "Actual period", actualPeriod);
  writeKeyValue(doc, "Forecast target period", forecastPeriod);
  writeKeyValue(
    doc,
    `Actual cost (${recordedLabel(actualPeriod, "cost")})`,
    formatReportCurrency(energyRecord?.totalEnergyCost)
  );
  writeKeyValue(
    doc,
    `Forecasted cost (${forecastLabel(forecastPeriod)})`,
    formatReportCurrency(prediction.predictedNextMonthEnergyCost)
  );
  writeKeyValue(
    doc,
    "Forecast change",
    formatReportSignedCurrency(prediction.predictedChange)
  );
  writeKeyValue(
    doc,
    "Forecast percentage change",
    formatReportPercent(prediction.predictedChangePercent)
  );
  writeKeyValue(
    doc,
    "Forecast generator dependency",
    formatStoredPercent(prediction.generatorDependencyPercent)
  );
  writeKeyValue(
    doc,
    "Forecast input outage hours",
    formatReportNumber(prediction.outageHours, { suffix: " hrs" })
  );

  doc.end();
  return bufferPromise;
}
