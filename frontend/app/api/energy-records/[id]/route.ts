import { auth } from "@clerk/nextjs/server";
import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { energyRecords, predictions } from "@/lib/db/schema";
import {
  errorResponse,
  isEnergyRecordPeriodConflict,
  resolveBusiness,
  validateEnergyRecord,
  withPersistedEnergyEfficiencyScore,
} from "@/lib/energy-records";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function findOwnedRecord(id: string, businessId: string) {
  const [record] = await db
    .select()
    .from(energyRecords)
    .where(
      and(
        eq(energyRecords.id, id),
        eq(energyRecords.businessId, businessId)
      )
    )
    .limit(1);

  return record ?? null;
}

async function hasLinkedPrediction(id: string, businessId: string) {
  const [prediction] = await db
    .select({ id: predictions.id })
    .from(predictions)
    .where(
      and(
        eq(predictions.energyRecordId, id),
        eq(predictions.businessId, businessId)
      )
    )
    .limit(1);

  return Boolean(prediction);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const { id } = await context.params;
    const business = await resolveBusiness(userId);
    if (!business) {
      return errorResponse(
        404,
        "BUSINESS_NOT_FOUND",
        "Business profile not found"
      );
    }

    const ownedRecord = await findOwnedRecord(id, business.id);
    if (!ownedRecord) {
      return errorResponse(
        404,
        "ENERGY_RECORD_NOT_FOUND",
        "Energy record not found"
      );
    }

    if (await hasLinkedPrediction(id, business.id)) {
      return errorResponse(
        409,
        "ENERGY_RECORD_LINKED_TO_PREDICTION",
        "Energy records linked to a prediction cannot be updated"
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

    const validation = validateEnergyRecord(body);
    if (!validation.success) {
      return errorResponse(
        400,
        "INVALID_ENERGY_RECORD",
        "Energy record data is invalid",
        validation.issues
      );
    }

    const [duplicate] = await db
      .select({ id: energyRecords.id })
      .from(energyRecords)
      .where(
        and(
          eq(energyRecords.businessId, business.id),
          eq(energyRecords.year, validation.data.year),
          eq(energyRecords.month, validation.data.month),
          ne(energyRecords.id, id)
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

    const [record] = await db
      .update(energyRecords)
      .set(
        withPersistedEnergyEfficiencyScore(
          validation.data,
          ownedRecord.energyEfficiencyScore
        )
      )
      .where(
        and(
          eq(energyRecords.id, id),
          eq(energyRecords.businessId, business.id)
        )
      )
      .returning();

    return NextResponse.json({ success: true, record });
  } catch (error) {
    if (isEnergyRecordPeriodConflict(error)) {
      return errorResponse(
        409,
        "DUPLICATE_ENERGY_RECORD_PERIOD",
        "An energy record already exists for this year and month"
      );
    }

    console.error("FAILED TO UPDATE ENERGY RECORD:", error);
    return errorResponse(
      500,
      "ENERGY_RECORD_UPDATE_FAILED",
      "Failed to update energy record"
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const { id } = await context.params;
    const business = await resolveBusiness(userId);
    if (!business) {
      return errorResponse(
        404,
        "BUSINESS_NOT_FOUND",
        "Business profile not found"
      );
    }

    const ownedRecord = await findOwnedRecord(id, business.id);
    if (!ownedRecord) {
      return errorResponse(
        404,
        "ENERGY_RECORD_NOT_FOUND",
        "Energy record not found"
      );
    }

    if (await hasLinkedPrediction(id, business.id)) {
      return errorResponse(
        409,
        "ENERGY_RECORD_LINKED_TO_PREDICTION",
        "Energy records linked to a prediction cannot be deleted"
      );
    }

    await db
      .delete(energyRecords)
      .where(
        and(
          eq(energyRecords.id, id),
          eq(energyRecords.businessId, business.id)
        )
      );

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("FAILED TO DELETE ENERGY RECORD:", error);
    return errorResponse(
      500,
      "ENERGY_RECORD_DELETE_FAILED",
      "Failed to delete energy record"
    );
  }
}
