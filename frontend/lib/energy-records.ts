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
import { daysInCalendarMonth } from "@/lib/ges-v1";
import { LEGACY_ENERGY_EFFICIENCY_SCORE } from "@/lib/ml-compat";

export { LEGACY_ENERGY_EFFICIENCY_SCORE };
export {
  csvHeaders,
  derivedWritableFields,
  optionalCsvHeaders,
  rawWritableFields,
  requiredCsvHeaders,
  writableFields,
  type WritableField,
};

export type EnergyRecordPayload = Omit<
  Pick<typeof energyRecords.$inferInsert, WritableField>,
  "energyEfficiencyScore"
> & {
  energyEfficiencyScore?: number;
};

export function withPersistedEnergyEfficiencyScore(
  data: EnergyRecordPayload,
  fallback = LEGACY_ENERGY_EFFICIENCY_SCORE
): EnergyRecordPayload & { energyEfficiencyScore: number } {
  return {
    ...data,
    energyEfficiencyScore: data.energyEfficiencyScore ?? fallback,
  };
}

export type ValidationIssue = {
  field: WritableField;
  reason: string;
};

export const energyRecordPeriodUniqueConstraint =
  "energy_records_business_year_month_unique";

export function isEnergyRecordPeriodConflict(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;

  while (isRecord(current) && !seen.has(current)) {
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

const integerFields = new Set<WritableField>([
  "year",
  "month",
  "quarter",
  "employeeCount",
  "employees",
]);

const signedFields = new Set<WritableField>([
  "weatherAvgTemp",
  "energyEfficiencyScore",
]);

const derivedFieldSet = new Set<WritableField>(derivedWritableFields);

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * Fill ratio columns from raw inputs. GES ignores these stored values
 * and recomputes from the same raw fields.
 */
export function withDerivedEnergyRecordFields(
  data: EnergyRecordPayload,
  averageMonthlyEnergyCost: number
): EnergyRecordPayload {
  const employees = data.employees;

  return {
    ...data,
    energyCostPerEmployee: roundTo(
      safeDivide(data.totalEnergyCost, employees),
      4
    ),
    costPerKwh: roundTo(
      safeDivide(data.totalEnergyCost, data.energyConsumptionKwh),
      4
    ),
    averageMonthlyEnergyCost: roundTo(averageMonthlyEnergyCost, 2),
    generatorDependency: roundTo(
      safeDivide(
        data.generatorHours,
        data.generatorHours + data.gridHours
      ),
      6
    ),
    revenueEnergyRatio: roundTo(
      safeDivide(data.monthlyRevenue, data.totalEnergyCost),
      6
    ),
    outageSeverity: roundTo(
      safeDivide(
        data.outageHours,
        data.operatingHours *
          (daysInCalendarMonth(data.year, data.month) ?? 0)
      ),
      6
    ),
  };
}

export function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateEnergyRecord(
  value: unknown
):
  | { success: true; data: EnergyRecordPayload }
  | { success: false; issues: ValidationIssue[] } {
  if (!isRecord(value)) {
    return {
      success: false,
      issues: [{ field: "year", reason: "Record must be an object" }],
    };
  }

  const issues: ValidationIssue[] = [];

  for (const field of writableFields) {
    const fieldValue = value[field];

    if (derivedFieldSet.has(field) && fieldValue === undefined) {
      continue;
    }

    if (field === "energySource") {
      if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
        issues.push({
          field,
          reason: "Must be a non-empty string",
        });
      }
      continue;
    }

    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
      issues.push({ field, reason: "Must be a finite number" });
      continue;
    }

    if (integerFields.has(field) && !Number.isInteger(fieldValue)) {
      issues.push({ field, reason: "Must be an integer" });
      continue;
    }

    if (!signedFields.has(field) && fieldValue < 0) {
      issues.push({ field, reason: "Must be nonnegative" });
    }
  }

  const year = value.year;
  const month = value.month;
  const quarter = value.quarter;
  const occupancyRate = value.occupancyRate;
  const renewablePercentage = value.renewableEnergyPercentage;

  if (
    typeof year === "number" &&
    Number.isInteger(year) &&
    (year < 2000 || year > 2100)
  ) {
    issues.push({ field: "year", reason: "Must be between 2000 and 2100" });
  }

  if (
    typeof month === "number" &&
    Number.isInteger(month) &&
    (month < 1 || month > 12)
  ) {
    issues.push({ field: "month", reason: "Must be between 1 and 12" });
  }

  if (
    typeof quarter === "number" &&
    Number.isInteger(quarter) &&
    (quarter < 1 || quarter > 4)
  ) {
    issues.push({ field: "quarter", reason: "Must be between 1 and 4" });
  }

  if (
    typeof occupancyRate === "number" &&
    Number.isFinite(occupancyRate) &&
    (occupancyRate < 0 || occupancyRate > 100)
  ) {
    issues.push({
      field: "occupancyRate",
      reason: "Must be between 0 and 100",
    });
  }

  if (
    typeof renewablePercentage === "number" &&
    Number.isFinite(renewablePercentage) &&
    (renewablePercentage < 0 || renewablePercentage > 100)
  ) {
    issues.push({
      field: "renewableEnergyPercentage",
      reason: "Must be between 0 and 100",
    });
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }

  const data = Object.fromEntries(
    writableFields
      .filter((field) => {
        if (!derivedFieldSet.has(field)) {
          return true;
        }

        const fieldValue = value[field];
        return typeof fieldValue === "number" && Number.isFinite(fieldValue);
      })
      .map((field) => [
        field,
        field === "energySource"
          ? (value[field] as string).trim()
          : value[field],
      ])
  ) as EnergyRecordPayload;

  return {
    success: true,
    data,
  };
}

export async function resolveBusiness(userId: string) {
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.clerkUserId, userId))
    .limit(1);

  return business ?? null;
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

export function csvRowToPayload(
  headers: string[],
  values: string[]
): Record<string, unknown> {
  const byHeader = new Map(
    headers.map((header, index) => [header, values[index] ?? ""])
  );

  return Object.fromEntries(
    rawWritableFields.map((field) => {
      const rawValue = byHeader.get(csvHeaders[field]) ?? "";
      return [
        field,
        field === "energySource"
          ? rawValue.trim()
          : rawValue.trim().length === 0
            ? Number.NaN
            : Number(rawValue),
      ];
    })
  );
}
