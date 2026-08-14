/**
 * Shared dropdown options for Onboarding, Businesses, and Forecast.
 *
 * Energy sources follow docs/Dataset-specification.md.
 * If a registered profile uses a value that is not in these lists,
 * include that stored value at the call site via optionsIncluding.
 */

export const BUSINESS_TYPES = [
  "Bakery",
  "Hotel",
  "Restaurant",
  "Retail Store",
  "Supermarket",
  "Hospital",
  "School",
  "Factory",
  "Office",
  "Pharmacy",
  "Farm",
  "Laundry",
  "Cold Room",
  "Warehouse",
  "Salon",
  "Clinic",
  "Gym",
  "Printing Press",
  "Fuel Station",
  "Event Center",
  "Mini Mart",
  "Bar / Lounge",
  "Poultry Farm",
  "Water Factory",
  "Bank Branch",
  "Telecom Shop",
  "Cyber Cafe",
] as const;

export const INDUSTRIES = [
  "Hospitality",
  "Food Production",
  "Healthcare",
  "Education",
  "Cold Storage",
  "Manufacturing",
  "Retail",
  "Agriculture",
  "Logistics",
  "Professional Services",
  "Financial Services",
  "Telecommunications",
  "Energy",
  "Construction",
] as const;

export const BUSINESS_STATES = [
  "Lagos",
  "Abuja",
  "Rivers",
  "Kano",
  "Oyo",
  "Anambra",
  "Enugu",
  "Delta",
  "Edo",
  "Kaduna",
  "Plateau",
  "Ogun",
  "Osun",
  "Ondo",
  "Imo",
  "Abia",
  "Akwa Ibom",
  "Cross River",
  "Kwara",
  "Benue",
] as const;

export const ENERGY_SOURCES = [
  "Grid",
  "Generator",
  "Solar",
  "Hybrid",
] as const;

export type BusinessProfile = {
  id: string;
  businessName: string;
  businessType: string;
  industry: string;
  state: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isBusinessProfile(value: unknown): value is BusinessProfile {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.businessName === "string" &&
    typeof value.businessType === "string" &&
    typeof value.industry === "string" &&
    typeof value.state === "string"
  );
}

export function parseBusinessResponse(value: unknown): BusinessProfile | null {
  if (!isRecord(value) || !("business" in value)) {
    throw new Error("Business API returned an invalid response.");
  }

  if (value.business === null) {
    return null;
  }

  if (!isBusinessProfile(value.business)) {
    throw new Error("Business API returned an invalid business profile.");
  }

  return value.business;
}

export function optionsIncluding(
  options: readonly string[],
  value: string
): string[] {
  const trimmed = value.trim();
  if (!trimmed || options.includes(trimmed)) {
    return [...options];
  }
  return [trimmed, ...options];
}
