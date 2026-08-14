import assert from "node:assert/strict";

import {
  GES_V1_D_MAX,
  GES_V1_D_MIN,
  GES_V1_S_MAX,
  GES_V1_S_MIN,
  calculateGesV1,
  calculateGesV1FromRecord,
  daysInCalendarMonth,
  type GesV1Available,
} from "./ges-v1";

const BASE = {
  generatorHours: 40,
  gridHours: 360,
  outageHours: 40,
  operatingHoursPerDay: 12,
  year: 2024,
  month: 1,
};

function available(result: ReturnType<typeof calculateGesV1>): GesV1Available {
  assert.equal(result.available, true);
  return result as GesV1Available;
}

function assertClose(actual: number, expected: number, digits = 2) {
  const factor = 10 ** digits;
  assert.equal(
    Math.round(actual * factor) / factor,
    Math.round(expected * factor) / factor
  );
}

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run("C = 0 -> CostScore = 100", () => {
  const result = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 0,
      monthlyRevenue: 1_000_000,
    })
  );
  assert.equal(result.components.costScore, 100);
});

run("C = 0.5 -> CostScore = 50", () => {
  const result = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 500_000,
      monthlyRevenue: 1_000_000,
    })
  );
  assert.equal(result.components.costScore, 50);
});

run("C >= 1 -> CostScore = 0", () => {
  const atOne = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 1_000_000,
      monthlyRevenue: 1_000_000,
    })
  );
  const aboveOne = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 1_500_000,
      monthlyRevenue: 1_000_000,
    })
  );
  assert.equal(atOne.components.costScore, 0);
  assert.equal(aboveOne.components.costScore, 0);
});

run("D at D_MIN -> GenScore = 100", () => {
  const poweredHours = 400;
  const result = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 300_000,
      monthlyRevenue: 1_000_000,
      generatorHours: GES_V1_D_MIN * poweredHours,
      gridHours: poweredHours - GES_V1_D_MIN * poweredHours,
    })
  );
  assertClose(result.components.generatorScore, 100, 4);
});

run("D at D_MAX -> GenScore = 0", () => {
  const poweredHours = 400;
  const result = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 300_000,
      monthlyRevenue: 1_000_000,
      generatorHours: GES_V1_D_MAX * poweredHours,
      gridHours: poweredHours - GES_V1_D_MAX * poweredHours,
    })
  );
  assertClose(result.components.generatorScore, 0, 4);
});

run("S at S_MIN -> OpScore = 100", () => {
  const days = daysInCalendarMonth(2024, 1);
  assert.ok(days);
  const monthlyOperatingHours = 12 * days;
  const result = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 300_000,
      monthlyRevenue: 1_000_000,
      outageHours: GES_V1_S_MIN * monthlyOperatingHours,
    })
  );
  assertClose(result.components.operationalScore, 100, 4);
});

run("S at S_MAX -> OpScore = 0", () => {
  const days = daysInCalendarMonth(2024, 1);
  assert.ok(days);
  const monthlyOperatingHours = 12 * days;
  const result = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 300_000,
      monthlyRevenue: 1_000_000,
      outageHours: GES_V1_S_MAX * monthlyOperatingHours,
    })
  );
  assertClose(result.components.operationalScore, 0, 4);
});

run("invalid revenue -> unavailable", () => {
  const result = calculateGesV1({
    ...BASE,
    totalEnergyCost: 300_000,
    monthlyRevenue: 0,
  });
  assert.equal(result.available, false);
  if (!result.available) {
    assert.equal(result.reason, "monthly_revenue_invalid");
  }
});

run("invalid operating hours -> unavailable", () => {
  const result = calculateGesV1({
    ...BASE,
    totalEnergyCost: 300_000,
    monthlyRevenue: 1_000_000,
    operatingHoursPerDay: 0,
  });
  assert.equal(result.available, false);
  if (!result.available) {
    assert.equal(result.reason, "operating_hours_invalid");
  }
});

run("zero generator + zero grid -> unavailable", () => {
  const result = calculateGesV1({
    ...BASE,
    totalEnergyCost: 300_000,
    monthlyRevenue: 1_000_000,
    generatorHours: 0,
    gridHours: 0,
  });
  assert.equal(result.available, false);
  if (!result.available) {
    assert.equal(result.reason, "powered_hours_invalid");
  }
});

run("calendar month handling works correctly", () => {
  assert.equal(daysInCalendarMonth(2024, 1), 31);
  assert.equal(daysInCalendarMonth(2024, 2), 29);
  assert.equal(daysInCalendarMonth(2025, 2), 28);
  assert.equal(daysInCalendarMonth(2024, 4), 30);
  assert.equal(daysInCalendarMonth(2024, 13), null);
  assert.equal(daysInCalendarMonth(2024, 0), null);

  const january = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 300_000,
      monthlyRevenue: 1_000_000,
      outageHours: 40,
      operatingHoursPerDay: 12,
      year: 2024,
      month: 1,
    })
  );
  const februaryLeap = available(
    calculateGesV1({
      ...BASE,
      totalEnergyCost: 300_000,
      monthlyRevenue: 1_000_000,
      outageHours: 40,
      operatingHoursPerDay: 12,
      year: 2024,
      month: 2,
    })
  );
  assert.ok(january.components.outageFraction < februaryLeap.components.outageFraction);

  const invalidMonth = calculateGesV1({
    ...BASE,
    totalEnergyCost: 300_000,
    monthlyRevenue: 1_000_000,
    month: 13,
  });
  assert.equal(invalidMonth.available, false);
});

run("REC-000049 should produce approximately 84.01", () => {
  const result = available(
    calculateGesV1({
      totalEnergyCost: 503928.23,
      monthlyRevenue: 5873751.66,
      generatorHours: 7.0,
      gridHours: 390.66,
      outageHours: 70.0,
      operatingHoursPerDay: 14.86,
      year: 2024,
      month: 1,
    })
  );
  assertClose(result.score, 84.01);
  assert.equal(result.rating, "Good");
});

run("REC-000001 should produce approximately 67.24", () => {
  const result = available(
    calculateGesV1({
      totalEnergyCost: 18452387.41,
      monthlyRevenue: 61846742.13,
      generatorHours: 43.21,
      gridHours: 358.71,
      outageHours: 48.01,
      operatingHoursPerDay: 13.12,
      year: 2024,
      month: 1,
    })
  );
  assertClose(result.score, 67.24);
  assert.equal(result.rating, "Needs Improvement");
});

run("REC-000005 should produce approximately 47.39", () => {
  const result = available(
    calculateGesV1({
      totalEnergyCost: 16201526.55,
      monthlyRevenue: 61846742.13,
      generatorHours: 82.91,
      gridHours: 314.6,
      outageHours: 92.12,
      operatingHoursPerDay: 13.12,
      year: 2024,
      month: 5,
    })
  );
  assertClose(result.score, 47.39);
  assert.equal(result.rating, "Critical");
});

run("REC-000025 should produce approximately 42.03", () => {
  const result = available(
    calculateGesV1({
      totalEnergyCost: 3024649.81,
      monthlyRevenue: 2805163.65,
      generatorHours: 33.7,
      gridHours: 639.47,
      outageHours: 56.17,
      operatingHoursPerDay: 22.44,
      year: 2024,
      month: 1,
    })
  );
  assertClose(result.score, 42.03);
  assert.equal(result.rating, "Critical");
});

run("REC-001241 should produce approximately 24.40", () => {
  const result = available(
    calculateGesV1({
      totalEnergyCost: 16611557.16,
      monthlyRevenue: 9420369.08,
      generatorHours: 111.67,
      gridHours: 632.33,
      outageHours: 111.67,
      operatingHoursPerDay: 24.0,
      year: 2025,
      month: 5,
    })
  );
  assertClose(result.score, 24.4);
  assert.equal(result.rating, "Critical");
});

run("REC-003386 should produce approximately 40.68", () => {
  const result = available(
    calculateGesV1({
      totalEnergyCost: 17087662.87,
      monthlyRevenue: 79217463.28,
      generatorHours: 74.53,
      gridHours: 253.13,
      outageHours: 106.47,
      operatingHoursPerDay: 12.4,
      year: 2024,
      month: 2,
    })
  );
  assertClose(result.score, 40.68);
  assert.equal(result.rating, "Critical");
});

run("24 hours per day remains valid for GES", () => {
  const result = available(
    calculateGesV1FromRecord({
      totalEnergyCost: 300_000,
      monthlyRevenue: 1_000_000,
      generatorHours: 40,
      gridHours: 360,
      outageHours: 40,
      operatingHours: 24,
      year: 2024,
      month: 1,
    })
  );
  assert.equal(result.available, true);
});

run("monthly-shaped operating hours 600 do not compute GES", () => {
  const result = calculateGesV1FromRecord({
    totalEnergyCost: 300_000,
    monthlyRevenue: 1_000_000,
    generatorHours: 40,
    gridHours: 360,
    outageHours: 40,
    operatingHours: 600,
    year: 2024,
    month: 1,
  });
  assert.equal(result.available, false);
  if (!result.available) {
    assert.equal(result.reason, "operating_hours_invalid");
  }
});

console.log("All GES v1 tests passed.");
