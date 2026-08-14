import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type BusinessProfileFields = {
  businessName: string;
  businessType: string;
  industry: string;
  state: string;
};

function errorResponse(
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

function parseProfileFields(
  body: unknown
):
  | { success: true; data: BusinessProfileFields }
  | { success: false; error: string; details?: unknown } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      success: false,
      error: "Request body must be a JSON object",
    };
  }

  const record = body as Record<string, unknown>;
  const fields = [
    "businessName",
    "businessType",
    "industry",
    "state",
  ] as const;

  const data = {} as BusinessProfileFields;
  const issues: { field: string; reason: string }[] = [];

  for (const field of fields) {
    const value = record[field];

    if (typeof value !== "string") {
      issues.push({
        field,
        reason: `${field} must be a string`,
      });
      continue;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      issues.push({
        field,
        reason: `${field} is required`,
      });
      continue;
    }

    data[field] = trimmed;
  }

  if (issues.length > 0) {
    return {
      success: false,
      error: "businessName, businessType, industry and state are required",
      details: issues,
    };
  }

  return {
    success: true,
    data,
  };
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const result = await db
      .select()
      .from(businesses)
      .where(eq(businesses.clerkUserId, userId))
      .limit(1);

    return NextResponse.json({
      business: result[0] ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch business:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch business",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request.json();

    const {
      businessName,
      businessType,
      industry,
      state,
    } = body;

    if (
      !businessName ||
      !businessType ||
      !industry ||
      !state
    ) {
      return NextResponse.json(
        {
          error:
            "businessName, businessType, industry and state are required",
        },
        {
          status: 400,
        }
      );
    }

    // Prevent duplicate business profiles
    const existing = await db
      .select()
      .from(businesses)
      .where(eq(businesses.clerkUserId, userId))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        business: existing[0],
      });
    }

    const businessId = crypto.randomUUID();

    const [business] = await db
      .insert(businesses)
      .values({
        id: businessId,
        clerkUserId: userId,
        businessName,
        businessType,
        industry,
        state,
      })
      .returning();

    return NextResponse.json(
      {
        business,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Failed to create business:", error);

    return NextResponse.json(
      {
        error: "Failed to create business",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const [existing] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.clerkUserId, userId))
      .limit(1);

    if (!existing) {
      return errorResponse(
        404,
        "BUSINESS_NOT_FOUND",
        "Business profile not found"
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

    const parsed = parseProfileFields(body);

    if (!parsed.success) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        parsed.error,
        parsed.details
      );
    }

    const [business] = await db
      .update(businesses)
      .set({
        businessName: parsed.data.businessName,
        businessType: parsed.data.businessType,
        industry: parsed.data.industry,
        state: parsed.data.state,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, existing.id))
      .returning();

    if (!business) {
      return errorResponse(
        500,
        "BUSINESS_UPDATE_FAILED",
        "Failed to update business"
      );
    }

    return NextResponse.json({
      business,
    });
  } catch (error) {
    console.error("Failed to update business:", error);

    return errorResponse(
      500,
      "BUSINESS_UPDATE_FAILED",
      "Failed to update business"
    );
  }
}