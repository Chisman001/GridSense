import assert from "node:assert/strict";

import {
  ABA_DEMO_PROFILE,
  ABA_DEMO_RECORDS,
  getAbaDemoLandingSnapshot,
  getAbaDemoLatestRecord,
  getAbaDemoPreviousRecord,
} from "./aba-demo-fixture";
import { buildEnergyProfile } from "./energy-profile";
import { GENERATOR_DEPENDENCY_ELEVATED_THRESHOLD } from "./forecast-scenario";
import { buildSampleEnergyRecordsCsv } from "./energy-records-sample";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function generatorShare(record: {
  generatorHours: number;
  gridHours: number;
}) {
  return record.generatorHours / (record.generatorHours + record.gridHours);
}

run("demo profile is the Aba Factory in Abia", () => {
  assert.equal(ABA_DEMO_PROFILE.businessName, "Aba Packaging & Plastics Ltd.");
  assert.equal(ABA_DEMO_PROFILE.businessType, "Factory");
  assert.equal(ABA_DEMO_PROFILE.industry, "Manufacturing");
  assert.equal(ABA_DEMO_PROFILE.state, "Abia");
});

run("fixture has 12 consecutive months", () => {
  assert.equal(ABA_DEMO_RECORDS.length, 12);

  for (let index = 1; index < ABA_DEMO_RECORDS.length; index += 1) {
    const previous = ABA_DEMO_RECORDS[index - 1];
    const current = ABA_DEMO_RECORDS[index];
    if (!previous || !current) {
      throw new Error("Missing fixture month");
    }

    const previousKey = previous.year * 12 + previous.month;
    const currentKey = current.year * 12 + current.month;
    assert.equal(currentKey - previousKey, 1);
  }
});

run("every month keeps generator share above 30% and solar at zero", () => {
  for (const record of ABA_DEMO_RECORDS) {
    assert.ok(generatorShare(record) > GENERATOR_DEPENDENCY_ELEVATED_THRESHOLD);
    assert.equal(record.solarCapacityKw, 0);
    assert.equal(record.renewableEnergyPercentage, 0);
  }
});

run("latest month is generator-led, diesel-heavy, and under 20% of revenue", () => {
  const latest = getAbaDemoLatestRecord();
  const bills = latest.electricityBill + latest.dieselCost + latest.petrolCost;
  const dieselShare = latest.dieselCost / bills;
  const costShare = bills / latest.monthlyRevenue;

  assert.ok(generatorShare(latest) > 0.3);
  assert.ok(latest.dieselCost > latest.electricityBill);
  assert.ok(latest.dieselCost > latest.petrolCost);
  assert.ok(dieselShare > 0.3);
  assert.ok(costShare < 0.2);
});

run("landing snapshot matches buildEnergyProfile on the same months", () => {
  const latest = getAbaDemoLatestRecord();
  const previous = getAbaDemoPreviousRecord();
  const profile = buildEnergyProfile(latest, previous);
  const snapshot = getAbaDemoLandingSnapshot();

  assert.deepEqual(snapshot.business, ABA_DEMO_PROFILE);
  assert.deepEqual(snapshot.profile.cost, profile.cost);
  assert.deepEqual(snapshot.profile.dependency, profile.dependency);
  assert.equal(snapshot.profile.ges.available, profile.ges.available);
  if (snapshot.profile.ges.available && profile.ges.available) {
    assert.equal(snapshot.profile.ges.score, profile.ges.score);
    assert.equal(snapshot.profile.ges.rating, profile.ges.rating);
  }
  assert.equal(snapshot.profile.reading.headline, profile.reading.headline);
  assert.equal(snapshot.profile.reading.primaryFlagId, "generator-reliance");
  assert.equal(snapshot.costSeries.length, 12);
  assert.equal(snapshot.costSeries[11]?.total, profile.cost.total);
});

run("sample CSV is generated from the Aba fixture", () => {
  const csv = buildSampleEnergyRecordsCsv();
  assert.match(csv, /^year,month,/);
  assert.equal(csv.trim().split("\n").length, 13);
  assert.match(csv, /2026,8,/);
  assert.doesNotMatch(csv, /248500/);
});
