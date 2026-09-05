import { NextResponse } from "next/server";

export function getMlApiBaseUrl(): string | null {
  const configured = (
    process.env.ML_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  return configured.length > 0 ? configured : null;
}

export async function proxyMlRequest(
  path: "/predict" | "/insights",
  body: unknown
) {
  const baseUrl = getMlApiBaseUrl();

  if (!baseUrl) {
    return NextResponse.json(
      {
        success: false,
        error: "Forecast API is not configured.",
        code: "FORECAST_API_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(`ML API ${path} unreachable:`, error);

    return NextResponse.json(
      {
        success: false,
        error:
          "The forecast service is unavailable. Confirm ML_API_URL is set and the GridSense ML API is running.",
        code: "FORECAST_SERVICE_UNAVAILABLE",
      },
      { status: 503 }
    );
  }

  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}
