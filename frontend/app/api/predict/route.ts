import { auth } from "@clerk/nextjs/server";

import {
  buildMlPredictionPayload,
  errorResponse,
  persistableEnergyRecord,
  resolveBusiness,
  validateEnergyRecord,
} from "@/lib/energy-records";
import { proxyMlRequest } from "@/lib/ml-api";

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const business = await resolveBusiness(userId);

  if (!business) {
    return errorResponse(
      404,
      "BUSINESS_NOT_FOUND",
      "Business profile not found"
    );
  }

  const validation = validateEnergyRecord(body);

  if (!validation.success) {
    return errorResponse(
      400,
      "INVALID_ENERGY_RECORD",
      "Forecast input data is invalid",
      validation.issues
    );
  }

  const persisted = await persistableEnergyRecord(
    validation.data,
    business.id
  );

  return proxyMlRequest(
    "/predict",
    buildMlPredictionPayload(validation.data, business, {
      averageMonthlyEnergyCost: persisted.averageMonthlyEnergyCost,
    })
  );
}
