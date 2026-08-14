import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { proxyMlRequest } from "@/lib/ml-api";

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

  return proxyMlRequest("/insights", body);
}
