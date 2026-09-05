import assert from "node:assert/strict";

import {
  hasLimitedModelCoverage,
  isScenarioResponseFlat,
} from "./ml-guardrails";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run("validated business types are not marked as limited coverage", () => {
  assert.equal(hasLimitedModelCoverage("Factory"), false);
  assert.equal(hasLimitedModelCoverage("Hotel"), false);
  assert.equal(hasLimitedModelCoverage("Bakery"), false);
  assert.equal(hasLimitedModelCoverage("Cold Room"), false);
  assert.equal(hasLimitedModelCoverage("Hospital"), false);
  assert.equal(hasLimitedModelCoverage("School"), false);
});

run("untrained business types are marked as limited coverage", () => {
  assert.equal(hasLimitedModelCoverage("Retail Store"), true);
  assert.equal(hasLimitedModelCoverage("Restaurant"), true);
  assert.equal(hasLimitedModelCoverage("Office"), true);
});

run("empty business type does not trigger a coverage warning", () => {
  assert.equal(hasLimitedModelCoverage(""), false);
  assert.equal(hasLimitedModelCoverage("   "), false);
});

run("flat detection treats a zero delta as flat", () => {
  assert.equal(isScenarioResponseFlat(1_780_000, 1_780_000), true);
});

run("flat detection treats a sub-naira delta as flat", () => {
  assert.equal(isScenarioResponseFlat(1_780_000, 1_780_000.5), true);
});

run("flat detection treats a meaningful delta as not flat", () => {
  assert.equal(isScenarioResponseFlat(16_790_000, 16_785_000), false);
});
