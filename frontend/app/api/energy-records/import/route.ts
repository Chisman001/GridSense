import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { energyRecords } from "@/lib/db/schema";
import {
  csvHeaders,
  csvRowToPayload,
  EnergyRecordPayload,
  errorResponse,
  isEnergyRecordPeriodConflict,
  optionalCsvHeaders,
  parseCsv,
  requiredCsvHeaders,
  resolveBusiness,
  validateEnergyRecord,
  withDerivedEnergyRecordFields,
  withPersistedEnergyEfficiencyScore,
} from "@/lib/energy-records";

type ImportError = {
  row: number;
  reason: string;
  field?: string;
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const business = await resolveBusiness(userId);
    if (!business) {
      return errorResponse(
        404,
        "BUSINESS_NOT_FOUND",
        "Business profile not found"
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse(
        400,
        "INVALID_MULTIPART_FORM",
        "Request must be valid multipart form data"
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return errorResponse(
        400,
        "CSV_FILE_REQUIRED",
        "A CSV file is required in multipart field 'file'"
      );
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      return errorResponse(
        400,
        "CSV_READ_FAILED",
        "The CSV file could not be read"
      );
    }

    const parsed = parseCsv(text);
    if (!parsed.success) {
      return errorResponse(
        400,
        "INVALID_CSV",
        "CSV validation failed",
        { errors: [{ row: parsed.row, reason: parsed.reason }] }
      );
    }

    if (parsed.rows.length === 0) {
      return errorResponse(
        400,
        "INVALID_CSV",
        "CSV validation failed",
        { errors: [{ row: 1, reason: "CSV file is empty" }] }
      );
    }

    const [headerRow, ...dataRows] = parsed.rows;
    const headers = headerRow.values.map((header, index) =>
      index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim()
    );
    const errors: ImportError[] = [];
    const seenHeaders = new Set<string>();

    for (const header of headers) {
      if (seenHeaders.has(header)) {
        errors.push({
          row: headerRow.row,
          reason: "Duplicate CSV header",
          field: header,
        });
      }
      seenHeaders.add(header);
    }

    for (const requiredHeader of requiredCsvHeaders) {
      if (!seenHeaders.has(requiredHeader)) {
        errors.push({
          row: headerRow.row,
          reason: "Required CSV header is missing",
          field: requiredHeader,
        });
      }
    }

    const allowedHeaders = new Set([
      ...requiredCsvHeaders,
      ...optionalCsvHeaders,
    ]);

    for (const header of headers) {
      if (!allowedHeaders.has(header)) {
        errors.push({
          row: headerRow.row,
          reason: "Unexpected CSV header",
          field: header,
        });
      }
    }

    if (errors.length > 0) {
      return errorResponse(
        400,
        "INVALID_CSV_HEADERS",
        "CSV headers are invalid",
        { errors }
      );
    }

    const existingRecords = await db
      .select({
        year: energyRecords.year,
        month: energyRecords.month,
      })
      .from(energyRecords)
      .where(eq(energyRecords.businessId, business.id));

    const existingPeriods = new Set(
      existingRecords.map((record) => `${record.year}-${record.month}`)
    );
    const filePeriods = new Set<string>();
    const validRecords: Array<{
      row: number;
      data: EnergyRecordPayload;
    }> = [];

    for (const csvRow of dataRows) {
      if (csvRow.values.every((value) => value.trim().length === 0)) {
        continue;
      }

      if (csvRow.values.length !== headers.length) {
        errors.push({
          row: csvRow.row,
          reason: `Expected ${headers.length} columns but found ${csvRow.values.length}`,
        });
        continue;
      }

      const validation = validateEnergyRecord(
        csvRowToPayload(headers, csvRow.values)
      );

      if (!validation.success) {
        for (const issue of validation.issues) {
          errors.push({
            row: csvRow.row,
            reason: issue.reason,
            field: csvHeaders[issue.field],
          });
        }
        continue;
      }

      const period = `${validation.data.year}-${validation.data.month}`;
      if (filePeriods.has(period)) {
        errors.push({
          row: csvRow.row,
          reason: "Duplicate year and month in CSV file",
          field: "month",
        });
      } else {
        filePeriods.add(period);
      }

      if (existingPeriods.has(period)) {
        errors.push({
          row: csvRow.row,
          reason: "An energy record already exists for this year and month",
          field: "month",
        });
      }

      validRecords.push({ row: csvRow.row, data: validation.data });
    }

    if (validRecords.length === 0 && errors.length === 0) {
      errors.push({ row: 2, reason: "CSV contains no data rows" });
    }

    if (errors.length > 0) {
      return errorResponse(
        400,
        "CSV_VALIDATION_FAILED",
        "CSV validation failed; no records were inserted",
        { errors }
      );
    }

    const chronological = [...validRecords].sort(
      (left, right) =>
        left.data.year * 12 +
        left.data.month -
        (right.data.year * 12 + right.data.month)
    );
    const derivedByRow = new Map<number, EnergyRecordPayload>();
    let runningTotal = 0;

    chronological.forEach((record, index) => {
      runningTotal += record.data.totalEnergyCost;
      derivedByRow.set(
        record.row,
        withDerivedEnergyRecordFields(
          record.data,
          runningTotal / (index + 1)
        )
      );
    });

    const insertedRecords = await db
      .insert(energyRecords)
      .values(
        validRecords.map((record) => {
          const derived = derivedByRow.get(record.row);

          if (!derived) {
            throw new Error("Derived energy record payload is missing");
          }

          return {
            id: crypto.randomUUID(),
            businessId: business.id,
            ...withPersistedEnergyEfficiencyScore(derived),
          };
        })
      )
      .returning();

    return NextResponse.json(
      {
        success: true,
        count: insertedRecords.length,
        records: insertedRecords,
      },
      { status: 201 }
    );
  } catch (error) {
    if (isEnergyRecordPeriodConflict(error)) {
      return errorResponse(
        409,
        "DUPLICATE_ENERGY_RECORD_PERIOD",
        "One or more CSV periods already have an energy record; no records were inserted"
      );
    }

    console.error("FAILED TO IMPORT ENERGY RECORDS:", error);
    return errorResponse(
      500,
      "ENERGY_RECORD_IMPORT_FAILED",
      "Failed to import energy records"
    );
  }
}
