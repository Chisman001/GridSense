/**
 * Single source of truth for the Aba Packaging & Plastics demo.
 *
 * Landing preview, sample CSV, onboarding fill, and in-app load
 * all read from this file. Measurement numbers are computed with
 * the same profile helpers as the dashboard.
 */

import { buildEnergyProfile, type EnergyProfile } from "@/lib/energy-profile";
import { type RawEnergyRecord } from "@/lib/energy-record-pipeline";

export const ABA_DEMO_PROFILE = {
  businessName: "Aba Packaging & Plastics Ltd.",
  businessType: "Factory",
  industry: "Manufacturing",
  state: "Abia",
} as const;

const PLANT = {
  energySource: "Hybrid" as const,
  employees: 96,
  occupancyRate: 82,
  floorAreaSqm: 2400,
  solarCapacityKw: 0,
  renewableEnergyPercentage: 0,
  operatingHours: 16,
};

function month(
  year: number,
  monthNumber: number,
  values: {
    electricityBill: number;
    dieselCost: number;
    petrolCost: number;
    energyConsumptionKwh: number;
    fuelConsumptionLiters: number;
    generatorHours: number;
    gridHours: number;
    outageHours: number;
    monthlyRevenue: number;
    maintenanceCost: number;
    weatherAvgTemp: number;
    occupancyRate?: number;
  }
): RawEnergyRecord {
  return {
    year,
    month: monthNumber,
    ...PLANT,
    occupancyRate: values.occupancyRate ?? PLANT.occupancyRate,
    ...values,
  };
}

/**
 * Sep 2025 – Aug 2026. Latest month is the dashboard “this month.”
 * Generator share stays 35–45%. Diesel is the largest bill.
 * Energy / revenue stays under 20%.
 */
export const ABA_DEMO_RECORDS: RawEnergyRecord[] = [
  month(2025, 9, {
    electricityBill: 1_180_000,
    dieselCost: 1_520_000,
    petrolCost: 72_000,
    energyConsumptionKwh: 17_200,
    fuelConsumptionLiters: 1_180,
    generatorHours: 168,
    gridHours: 292,
    outageHours: 42,
    monthlyRevenue: 28_400_000,
    maintenanceCost: 86_000,
    weatherAvgTemp: 27.2,
  }),
  month(2025, 10, {
    electricityBill: 1_210_000,
    dieselCost: 1_610_000,
    petrolCost: 75_000,
    energyConsumptionKwh: 17_600,
    fuelConsumptionLiters: 1_240,
    generatorHours: 176,
    gridHours: 284,
    outageHours: 46,
    monthlyRevenue: 28_600_000,
    maintenanceCost: 88_000,
    weatherAvgTemp: 27.8,
  }),
  month(2025, 11, {
    electricityBill: 1_150_000,
    dieselCost: 1_780_000,
    petrolCost: 80_000,
    energyConsumptionKwh: 18_100,
    fuelConsumptionLiters: 1_360,
    generatorHours: 192,
    gridHours: 268,
    outageHours: 54,
    monthlyRevenue: 28_200_000,
    maintenanceCost: 92_000,
    weatherAvgTemp: 27.1,
    occupancyRate: 80,
  }),
  month(2025, 12, {
    electricityBill: 1_080_000,
    dieselCost: 1_920_000,
    petrolCost: 88_000,
    energyConsumptionKwh: 18_400,
    fuelConsumptionLiters: 1_480,
    generatorHours: 204,
    gridHours: 256,
    outageHours: 58,
    monthlyRevenue: 29_100_000,
    maintenanceCost: 98_000,
    weatherAvgTemp: 26.4,
    occupancyRate: 78,
  }),
  month(2026, 1, {
    electricityBill: 1_120_000,
    dieselCost: 1_860_000,
    petrolCost: 84_000,
    energyConsumptionKwh: 17_900,
    fuelConsumptionLiters: 1_420,
    generatorHours: 198,
    gridHours: 262,
    outageHours: 56,
    monthlyRevenue: 27_800_000,
    maintenanceCost: 94_000,
    weatherAvgTemp: 26.8,
    occupancyRate: 79,
  }),
  month(2026, 2, {
    electricityBill: 1_190_000,
    dieselCost: 1_700_000,
    petrolCost: 78_000,
    energyConsumptionKwh: 17_700,
    fuelConsumptionLiters: 1_300,
    generatorHours: 184,
    gridHours: 276,
    outageHours: 48,
    monthlyRevenue: 28_000_000,
    maintenanceCost: 90_000,
    weatherAvgTemp: 28.2,
  }),
  month(2026, 3, {
    electricityBill: 1_240_000,
    dieselCost: 1_580_000,
    petrolCost: 74_000,
    energyConsumptionKwh: 18_000,
    fuelConsumptionLiters: 1_220,
    generatorHours: 172,
    gridHours: 288,
    outageHours: 40,
    monthlyRevenue: 29_200_000,
    maintenanceCost: 87_000,
    weatherAvgTemp: 29.1,
  }),
  month(2026, 4, {
    electricityBill: 1_280_000,
    dieselCost: 1_640_000,
    petrolCost: 76_000,
    energyConsumptionKwh: 18_300,
    fuelConsumptionLiters: 1_260,
    generatorHours: 178,
    gridHours: 282,
    outageHours: 44,
    monthlyRevenue: 29_400_000,
    maintenanceCost: 89_000,
    weatherAvgTemp: 29.8,
  }),
  month(2026, 5, {
    electricityBill: 1_320_000,
    dieselCost: 1_710_000,
    petrolCost: 79_000,
    energyConsumptionKwh: 18_600,
    fuelConsumptionLiters: 1_320,
    generatorHours: 182,
    gridHours: 278,
    outageHours: 47,
    monthlyRevenue: 29_600_000,
    maintenanceCost: 91_000,
    weatherAvgTemp: 30.2,
  }),
  month(2026, 6, {
    electricityBill: 1_260_000,
    dieselCost: 1_880_000,
    petrolCost: 86_000,
    energyConsumptionKwh: 18_800,
    fuelConsumptionLiters: 1_440,
    generatorHours: 196,
    gridHours: 264,
    outageHours: 52,
    monthlyRevenue: 29_000_000,
    maintenanceCost: 96_000,
    weatherAvgTemp: 29.4,
  }),
  month(2026, 7, {
    electricityBill: 1_220_000,
    dieselCost: 1_950_000,
    petrolCost: 90_000,
    energyConsumptionKwh: 19_000,
    fuelConsumptionLiters: 1_500,
    generatorHours: 202,
    gridHours: 258,
    outageHours: 55,
    monthlyRevenue: 28_800_000,
    maintenanceCost: 99_000,
    weatherAvgTemp: 27.8,
  }),
  month(2026, 8, {
    electricityBill: 1_250_000,
    dieselCost: 1_820_000,
    petrolCost: 82_000,
    energyConsumptionKwh: 18_700,
    fuelConsumptionLiters: 1_380,
    generatorHours: 188,
    gridHours: 272,
    outageHours: 49,
    monthlyRevenue: 29_500_000,
    maintenanceCost: 93_000,
    weatherAvgTemp: 27.5,
  }),
];

export type AbaDemoCostPoint = {
  year: number;
  month: number;
  total: number;
};

export type AbaDemoLandingSnapshot = {
  business: typeof ABA_DEMO_PROFILE;
  profile: EnergyProfile;
  costSeries: AbaDemoCostPoint[];
};

export function getAbaDemoLatestRecord(): RawEnergyRecord {
  const latest = ABA_DEMO_RECORDS[ABA_DEMO_RECORDS.length - 1];
  if (!latest) {
    throw new Error("Aba demo fixture has no records.");
  }
  return latest;
}

export function getAbaDemoPreviousRecord(): RawEnergyRecord | undefined {
  return ABA_DEMO_RECORDS[ABA_DEMO_RECORDS.length - 2];
}

export function getAbaDemoLandingSnapshot(): AbaDemoLandingSnapshot {
  const latest = getAbaDemoLatestRecord();
  const previous = getAbaDemoPreviousRecord();

  return {
    business: ABA_DEMO_PROFILE,
    profile: buildEnergyProfile(latest, previous),
    costSeries: ABA_DEMO_RECORDS.map((record) => ({
      year: record.year,
      month: record.month,
      total: record.electricityBill + record.dieselCost + record.petrolCost,
    })),
  };
}
