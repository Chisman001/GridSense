import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { energyRecords, predictions } from "@/lib/db/schema";
import {
  errorResponse,
  isEnergyRecordPeriodConflict,
  persistableEnergyRecord,
  resolveBusiness,
  validateEnergyRecord,
} from "@/lib/energy-records";

function parseIntegerFilter(
  value: string | null,
  field: "year" | "month"
): number | null | NextResponse {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  const valid =
    Number.isInteger(parsed) &&
    (field === "year"
      ? parsed >= 2000 && parsed <= 2100
      : parsed >= 1 && parsed <= 12);

  if (!valid) {
    return errorResponse(
      400,
      "INVALID_FILTER",
      `Invalid ${field} filter`,
      { field }
    );
  }

  return parsed;
}

export async function GET(request: Request) {
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

    const searchParams = new URL(request.url).searchParams;
    const year = parseIntegerFilter(searchParams.get("year"), "year");
    const month = parseIntegerFilter(searchParams.get("month"), "month");

    if (year instanceof NextResponse) {
      return year;
    }
    if (month instanceof NextResponse) {
      return month;
    }

    const source = searchParams.get("source");
    if (source !== null && source.trim().length === 0) {
      return errorResponse(
        400,
        "INVALID_FILTER",
        "Invalid source filter",
        { field: "source" }
      );
    }

    const conditions = [eq(energyRecords.businessId, business.id)];
    if (year !== null) {
      conditions.push(eq(energyRecords.year, year));
    }
    if (month !== null) {
      conditions.push(eq(energyRecords.month, month));
    }
    if (source !== null) {
      conditions.push(eq(energyRecords.energySource, source.trim()));
    }

    const records = await db
      .select()
      .from(energyRecords)
      .where(and(...conditions))
      .orderBy(desc(energyRecords.year), desc(energyRecords.month));

    const linkedIds = new Set<string>();
    if (records.length > 0) {
      const links = await db
        .select({ energyRecordId: predictions.energyRecordId })
        .from(predictions)
        .where(
          and(
            eq(predictions.businessId, business.id),
            inArray(
              predictions.energyRecordId,
              records.map((record) => record.id)
            )
          )
        );

      for (const link of links) {
        if (link.energyRecordId) {
          linkedIds.add(link.energyRecordId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      records: records.map((record) => ({
        ...record,
        hasLinkedPrediction: linkedIds.has(record.id),
      })),
    });
  } catch (error) {
    console.error("FAILED TO FETCH ENERGY RECORDS:", error);
    return errorResponse(
      500,
      "ENERGY_RECORDS_FETCH_FAILED",
      "Failed to load energy records"
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
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

    const validation = validateEnergyRecord(body);
    if (!validation.success) {
      return errorResponse(
        400,
        "INVALID_ENERGY_RECORD",
        "Energy record data is invalid",
        validation.issues
      );
    }

    const business = await resolveBusiness(userId);
    if (!business) {
      return errorResponse(
        404,
        "BUSINESS_NOT_FOUND",
        "Business profile not found"
      );
    }

    const [duplicate] = await db
      .select({ id: energyRecords.id })
      .from(energyRecords)
      .where(
        and(
          eq(energyRecords.businessId, business.id),
          eq(energyRecords.year, validation.data.year),
          eq(energyRecords.month, validation.data.month)
        )
      )
      .limit(1);

    if (duplicate) {
      return errorResponse(
        409,
        "DUPLICATE_ENERGY_RECORD_PERIOD",
        "An energy record already exists for this year and month",
        {
          year: validation.data.year,
          month: validation.data.month,
        }
      );
    }

    const persisted = await persistableEnergyRecord(
      validation.data,
      business.id
    );

    const [record] = await db
      .insert(energyRecords)
      .values({
        id: crypto.randomUUID(),
        businessId: business.id,
        ...persisted,
      })
      .returning();

    return NextResponse.json(
      { success: true, record },
      { status: 201 }
    );
  } catch (error) {
    if (isEnergyRecordPeriodConflict(error)) {
      return errorResponse(
        409,
        "DUPLICATE_ENERGY_RECORD_PERIOD",
        "An energy record already exists for this year and month"
      );
    }

    console.error("FAILED TO CREATE ENERGY RECORD:", error);
    return errorResponse(
      500,
      "ENERGY_RECORD_CREATE_FAILED",
      "Failed to create energy record"
    );
  }
}
