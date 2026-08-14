import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { LEGACY_ENERGY_EFFICIENCY_SCORE } from "@/lib/ml-compat";
import { proxyMlRequest } from "@/lib/ml-api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function withModelCompatFields(body: unknown): unknown {
  if (!isRecord(body)) {
    return body;
  }

  if (
    typeof body.energy_efficiency_score === "number" &&
    Number.isFinite(body.energy_efficiency_score)
  ) {
    return body;
  }

  return {
    ...body,
    energy_efficiency_score: LEGACY_ENERGY_EFFICIENCY_SCORE,
  };
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Request body must be valid JSON",
        code: "INVALID_JSON",
      },
      { status: 400 }
    );
  }

  return proxyMlRequest("/predict", withModelCompatFields(body));
}
