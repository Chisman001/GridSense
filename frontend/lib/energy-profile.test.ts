import assert from "node:assert/strict";

import {
  buildEnergyProfile,
  type EnergyProfileSource,
} from "./energy-profile";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function source(
  overrides: Partial<EnergyProfileSource> = {}
): EnergyProfileSource {
  return {
    year: 2025,
    month: 3,
    energySource: "Hybrid",
    electricityBill: 200_000,
    dieselCost: 80_000,
    petrolCost: 20_000,
    energyConsumptionKwh: 4_000,
    fuelConsumptionLiters: 80,
    generatorHours: 40,
    gridHours: 260,
    outageHours: 8,
    operatingHours: 12,
    employees: 20,
    monthlyRevenue: 5_000_000,
    ...overrides,
  };
}

run("high-generator diesel-heavy month flags generator or diesel", () => {
  const profile = buildEnergyProfile(
    source({
      electricityBill: 150_000,
      dieselCost: 400_000,
      petrolCost: 20_000,
      generatorHours: 180,
      gridHours: 220,
      monthlyRevenue: 8_000_000,
    })
  );

  const flagIds = profile.flags.map((flag) => flag.id);
  assert.ok(
    flagIds.includes("generator-reliance") || flagIds.includes("diesel-mix")
  );
  assert.ok(profile.dependency.generator >= 0.3);
  assert.match(
    profile.reading.headline,
    /Generator reliance|Diesel is the largest/
  );
});

run("low-generator grid-heavy month does not flag generator reliance", () => {
  const profile = buildEnergyProfile(
    source({
      generatorHours: 20,
      gridHours: 280,
      dieselCost: 40_000,
      electricityBill: 220_000,
    })
  );

  assert.ok(profile.dependency.generator < 0.3);
  assert.equal(
    profile.flags.some((flag) => flag.id === "generator-reliance"),
    false
  );
});

run("high cost-to-revenue flags cost burden as primary", () => {
  const profile = buildEnergyProfile(
    source({
      electricityBill: 800_000,
      dieselCost: 300_000,
      petrolCost: 100_000,
      monthlyRevenue: 4_000_000,
      generatorHours: 40,
      gridHours: 260,
    })
  );

  assert.ok(profile.intensity.costShareOfRevenue >= 0.2);
  assert.equal(profile.reading.primaryFlagId, "cost-burden");
  assert.match(profile.reading.headline, /large share of revenue/);
});

run("two months with a cost increase mark rising trend", () => {
  const latest = source({
    electricityBill: 300_000,
    dieselCost: 100_000,
    petrolCost: 20_000,
  });
  const previous = source({
    year: 2025,
    month: 2,
    electricityBill: 200_000,
    dieselCost: 80_000,
    petrolCost: 20_000,
  });
  const profile = buildEnergyProfile(latest, previous);

  assert.equal(profile.trend.available, true);
  assert.ok((profile.trend.costDeltaPercent ?? 0) > 2);
  assert.ok(profile.flags.some((flag) => flag.id === "rising-cost"));
});

run("one month only leaves trend unavailable", () => {
  const profile = buildEnergyProfile(source());

  assert.equal(profile.trend.available, false);
  assert.equal(profile.trend.costDeltaPercent, null);
  assert.equal(
    profile.flags.some(
      (flag) => flag.id === "rising-cost" || flag.id === "easing-cost"
    ),
    false
  );
});

run("identical energy numbers produce the same profile regardless of label", () => {
  const factory = buildEnergyProfile(source({ energySource: "Factory" }));
  const retail = buildEnergyProfile(source({ energySource: "Retail Store" }));

  assert.deepEqual(factory.cost, retail.cost);
  assert.deepEqual(factory.dependency, retail.dependency);
  assert.deepEqual(factory.intensity, retail.intensity);
  assert.deepEqual(factory.flags, retail.flags);
  assert.deepEqual(factory.reading, retail.reading);
});
