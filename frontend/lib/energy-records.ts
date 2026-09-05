import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { businesses, energyRecords } from "@/lib/db/schema";
import {
  csvHeaders,
  derivedWritableFields,
  optionalCsvHeaders,
  rawWritableFields,
  requiredCsvHeaders,
  writableFields,
  type WritableField,
} from "@/lib/energy-record-fields";
import {
  buildPersistedEnergyRecord,
  nextAverageMonthlyEnergyCost,
  totalEnergyCostFromBills,
  validateRawEnergyRecord,
  type PersistedEnergyRecord,
  type RawEnergyRecord,
} from "@/lib/energy-record-pipeline";

export {
  csvHeaders,
  derivedWritableFields,
  optionalCsvHeaders,
  rawWritableFields,
  requiredCsvHeaders,
  writableFields,
  type WritableField,
};

export {
  buildImportWarnings,
  buildMlPredictionPayload,
  buildPersistedEnergyRecord,
  calculateGES,
  classifyCsvHeaders,
  csvRowToPayload,
  totalEnergyCostFromBills,
  deriveEnergyMetrics,
  detectTotalCostMismatch,
  nextAverageMonthlyEnergyCost,
  readOptionalCsvNumber,
  validateRawEnergyRecord,
  type BusinessProfileFeatures,
  type ImportWarning,
  type PersistedEnergyRecord,
  type RawEnergyRecord,
  type ValidationIssue,
} from "@/lib/energy-record-pipeline";

export type EnergyRecordPayload = PersistedEnergyRecord;

export const energyRecordPeriodUniqueConstraint =
  "energy_records_business_year_month_unique";

export function isEnergyRecordPeriodConflict(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;

  while (isPlainRecord(current) && !seen.has(current)) {
    seen.add(current);

    if (
      current.code === "23505" &&
      current.constraint === energyRecordPeriodUniqueConstraint
    ) {
      return true;
    }

    current = current.cause;
  }

  return false;
}

function isPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const validateEnergyRecord = validateRawEnergyRecord;

export function withDerivedEnergyRecordFields(
  data: RawEnergyRecord,
  averageMonthlyEnergyCost: number
): PersistedEnergyRecord {
  return buildPersistedEnergyRecord(data, { averageMonthlyEnergyCost }).record;
}

export function withComputedGesCache(
  data: RawEnergyRecord,
  averageMonthlyEnergyCost: number
): PersistedEnergyRecord {
  return buildPersistedEnergyRecord(data, { averageMonthlyEnergyCost }).record;
}

export async function resolveBusiness(userId: string) {
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

export async function loadEnergyCostTotals(
  businessId: string,
  excludeRecordId?: string
) {
  const records = await db
    .select({
      id: energyRecords.id,
      totalEnergyCost: energyRecords.totalEnergyCost,
    })
    .from(energyRecords)
    .where(eq(energyRecords.businessId, businessId));

  return records
    .filter((record) => record.id !== excludeRecordId)
    .map((record) => record.totalEnergyCost);
}

export async function persistableEnergyRecord(
  raw: RawEnergyRecord,
  businessId: string,
  excludeRecordId?: string
): Promise<PersistedEnergyRecord> {
  const existingTotals = await loadEnergyCostTotals(businessId, excludeRecordId);
  const { record } = buildPersistedEnergyRecord(raw, {
    averageMonthlyEnergyCost: nextAverageMonthlyEnergyCost(
      existingTotals,
      totalEnergyCostFromBills(
        raw.electricityBill,
        raw.dieselCost,
        raw.petrolCost
      )
    ),
  });

  return record;
}

export function errorResponse(
  status: number,
  code: string,
  error: string,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error,
      code,
      ...(details === undefined ? {} : { details }),
    },
    { status }
  );
}

export type CsvRow = {
  row: number;
  values: string[];
};

export function parseCsv(text: string):
  | { success: true; rows: CsvRow[] }
  | { success: false; row: number; reason: string } {
  const rows: CsvRow[] = [];
  let values: string[] = [];
  let value = "";
  let inQuotes = false;
  let closedQuote = false;
  let row = 1;
  let rowStart = 1;

  const finishValue = () => {
    values.push(value);
    value = "";
    closedQuote = false;
  };

  const finishRow = () => {
    finishValue();
    rows.push({ row: rowStart, values });
    values = [];
    rowStart = row + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
          closedQuote = true;
        }
      } else {
        value += character;
        if (character === "\n") {
          row += 1;
        }
      }
      continue;
    }

    if (closedQuote && character !== "," && character !== "\r" && character !== "\n") {
      return {
        success: false,
        row: rowStart,
        reason: "Unexpected character after closing quote",
      };
    }

    if (character === '"') {
      if (value.length > 0) {
        return {
          success: false,
          row: rowStart,
          reason: "Quote must begin at the start of a field",
        };
      }
      inQuotes = true;
    } else if (character === ",") {
      finishValue();
    } else if (character === "\n") {
      finishRow();
      row += 1;
    } else if (character === "\r") {
      if (text[index + 1] !== "\n") {
        finishRow();
        row += 1;
      }
    } else {
      value += character;
    }
  }

  if (inQuotes) {
    return {
      success: false,
      row: rowStart,
      reason: "Unterminated quoted field",
    };
  }

  if (value.length > 0 || values.length > 0 || closedQuote) {
    finishRow();
  }

  return { success: true, rows };
}
