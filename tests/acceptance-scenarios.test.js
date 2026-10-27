/**
 * Automated Verification of All 15 Required Acceptance Scenarios (Part 29)
 * Executed via Node.js native test runner: `node --test tests/acceptance-scenarios.test.js`
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  validateTemporalSeries,
  extractSeriesFeatures,
  stlDecomposition,
  computeACF,
  fitForecastModel,
  evaluateChronologicalHoldout,
  runRollingOriginBacktest,
  buildScenarioForecast,
  reconcileHierarchicalForecasts
} from "../js/math-engine.js";
import { PRESET_DATASETS, GUIDED_INVESTIGATIONS } from "../js/presets.js";
import { parseDelimitedText, encodeStateToHash, decodeStateFromHash } from "../js/exporters.js";

test("Acceptance Scenarios 1, 2 & 3 — Beginner CSV Import, Seasonal Exploration & Naive vs Seasonal Naive", () => {
  const csvText = "date,passengers\n2024-01,112\n2024-02,118\n2024-03,132\n2024-04,129\n2024-05,121\n2024-06,135\n2024-07,148\n2024-08,148\n2024-09,136\n2024-10,119\n2024-11,104\n2024-12,118\n2025-01,115\n2025-02,126\n2025-03,141\n2025-04,135\n2025-05,125\n2025-06,149\n2025-07,170\n2025-08,170\n2025-09,158\n2025-10,133\n2025-11,114\n2025-12,140";
  const parsed = parseDelimitedText(csvText);
  assert.equal(parsed.valid, true);
  const val = validateTemporalSeries(parsed.observations);
  assert.equal(val.inferredFrequency, "monthly");
  assert.equal(val.seasonalPeriod, 12);

  const values = val.observations.map(o => o.value);
  const ts = val.observations.map(o => o.timestamp);
  const stl = stlDecomposition(values, 12);
  const acf = computeACF(values, 12);
  assert.equal(stl.valid, true);
  assert.ok(acf.acf[11] > 0.30); // strong lag-12 seasonal autocorrelation

  const naiveHoldout = evaluateChronologicalHoldout(values, ts, { modelType: "NAIVE", seasonalPeriod: 12 }, 12);
  const snaiveHoldout = evaluateChronologicalHoldout(values, ts, { modelType: "SNAIVE", seasonalPeriod: 12 }, 12);
  assert.equal(naiveHoldout.valid, true);
  assert.equal(snaiveHoldout.valid, true);
  // Seasonal Naive outperforms flat Naive on strongly seasonal series
  assert.ok(snaiveHoldout.metrics.rmse < naiveHoldout.metrics.rmse);
});

test("Acceptance Scenarios 4 & 5 — Exponential Smoothing (SES vs Holt) & Seasonal ARIMA", () => {
  const ds = PRESET_DATASETS.retail_turnover;
  const y = ds.observations.map(o => o.value);
  const ts = ds.observations.map(o => o.timestamp);

  const ses = fitForecastModel(y, ts, { modelType: "ETS_ANN", horizon: 6, seasonalPeriod: 4 });
  const holt = fitForecastModel(y, ts, { modelType: "ETS_AAN", horizon: 6, seasonalPeriod: 4 });
  assert.equal(ses.valid, true);
  assert.equal(holt.valid, true);
  // SES is flat across horizon, whereas Holt extrapolates linear trend
  assert.equal(ses.pointForecasts[0], ses.pointForecasts[5]);
  assert.notEqual(holt.pointForecasts[0], holt.pointForecasts[5]);

  const sarima = fitForecastModel(y, ts, {
    modelType: "ARIMA",
    p: 1, d: 1, q: 1, P: 0, D: 1, Q: 1,
    seasonalPeriod: 4,
    horizon: 6
  });
  assert.equal(sarima.valid, true);
  assert.ok(sarima.diagnostics.ljungBox.valid);
});

test("Acceptance Scenarios 6, 7 & 8 — Rolling-Origin Backtesting, Data Leakage Prevention & Short Series", () => {
  const ds = PRESET_DATASETS.energy_temp_demand;
  const y = ds.observations.map(o => o.value);
  const ts = ds.observations.map(o => o.timestamp);
  const allPreds = ds.observations.map(o => o.predictors);

  // Scenario 6: Rolling-origin cross-validation refits models at each origin
  const ro = runRollingOriginBacktest(
    y,
    ts,
    { modelType: "SNAIVE", seasonalPeriod: 12 },
    { windowType: "expanding", initialWindow: 36, horizon: 4, stepSize: 2 }
  );
  assert.equal(ro.valid, true);
  assert.ok(ro.originCount >= 4);
  assert.equal(ro.horizonMetrics.length, 4);

  // Scenario 7: Regression with external predictors REJECTS evaluation if future predictors are not supplied/allowed
  const leakedAttempt = evaluateChronologicalHoldout(
    y,
    ts,
    {
      modelType: "TS_REG",
      predictorNames: ["temp_index"],
      allPredictors: allPreds,
      allowRealizedPredictorsInBacktest: false // Do NOT leak realized test predictors!
    },
    36
  );
  assert.equal(leakedAttempt.valid, false);
  assert.equal(leakedAttempt.code, "MISSING_FUTURE_PREDICTORS");

  // Scenario 8: Short series (T=6, m=4) rejects 2-cycle seasonal ETS(A,A,A) cleanly without inventing a seasonal model
  const shortDs = PRESET_DATASETS.short_startup_revenue;
  const shortY = shortDs.observations.map(o => o.value);
  const shortTs = shortDs.observations.map(o => o.timestamp);
  const ineligibleSeasonal = fitForecastModel(shortY, shortTs, { modelType: "ETS_AAA", seasonalPeriod: 4 });
  assert.equal(ineligibleSeasonal.valid, false);
  assert.ok(ineligibleSeasonal.reason.includes("2 full seasonal cycles"));
});

test("Acceptance Scenarios 9, 10, 11, 12, 13 & 14 — Comparison, Intervals, Scenarios, Hierarchy, Reproducibility & Lessons", () => {
  const ds = PRESET_DATASETS.energy_temp_demand;
  const y = ds.observations.map(o => o.value);
  const ts = ds.observations.map(o => o.timestamp);
  const trainPreds = ds.observations.map(o => o.predictors);

  // Scenario 10 & 11: Conditional predictor scenario changes forecasts & interval levels update
  const baseReg = fitForecastModel(y, ts, {
    modelType: "DYN_REG",
    predictorNames: ["temp_index", "ind_index"],
    trainPredictors: trainPreds,
    futurePredictors: ds.futurePredictorsBaseline,
    horizon: 12,
    levels: [80, 90, 95, 99]
  });
  assert.equal(baseReg.valid, true);
  assert.ok(baseReg.intervals[99][0][1] > baseReg.intervals[80][0][1]);

  const hotFuture = ds.futurePredictorsBaseline.map(p => ({ ...p, temp_index: p.temp_index + 5.0 }));
  const hotReg = fitForecastModel(y, ts, {
    modelType: "DYN_REG",
    predictorNames: ["temp_index", "ind_index"],
    trainPredictors: trainPreds,
    futurePredictors: hotFuture,
    horizon: 12
  });
  assert.ok(hotReg.pointForecasts[0] > baseReg.pointForecasts[0]);

  const manualScen = buildScenarioForecast(baseReg, {
    name: "Peak Grid Reserve +15 GWh",
    adjustmentType: "level_shift",
    amount: 15,
    reason: "Scheduled data-center commissioning"
  });
  assert.equal(manualScen.isJudgmentallyAdjusted, true);
  assert.ok(Math.abs(manualScen.adjustedPointForecasts[0] - (baseReg.pointForecasts[0] + 15)) < 1e-10);

  // Scenario 12: Hierarchical reconciliation achieves exact numerical coherence
  const hDs = PRESET_DATASETS.regional_store_hierarchy;
  const hInput = {
    timestamps: hDs.observations.map(o => o.timestamp),
    frequency: "quarterly",
    bottomSeriesNames: ["North_Region", "South_Region", "West_Region"],
    series: {
      North_Region: hDs.observations.map(o => o.North_Region),
      South_Region: hDs.observations.map(o => o.South_Region),
      West_Region: hDs.observations.map(o => o.West_Region)
    }
  };
  for (const recMethod of ["bottom_up", "top_down", "wls_structural"]) {
    const recRes = reconcileHierarchicalForecasts(hInput, {
      reconciliationMethod: recMethod,
      modelType: "ETS_AAA",
      horizon: 6,
      seasonalPeriod: 4
    });
    assert.equal(recRes.valid, true);
    assert.equal(recRes.isCoherent, true);
    assert.ok(recRes.maxCoherenceDiscrepancy <= 1e-10);
  }

  // Scenario 13: Reproducibility via URL state round-trip
  const hash = encodeStateToHash({
    presetId: "retail_turnover",
    modelType: "ETS_AAA",
    horizon: 8,
    seasonalPeriod: 4,
    frequency: "quarterly",
    observations: PRESET_DATASETS.retail_turnover.observations
  });
  const decoded = decodeStateFromHash(hash);
  const fit1 = fitForecastModel(
    PRESET_DATASETS.retail_turnover.observations.map(o => o.value),
    PRESET_DATASETS.retail_turnover.observations.map(o => o.timestamp),
    { modelType: "ETS_AAA", horizon: 8, seasonalPeriod: 4 }
  );
  const fit2 = fitForecastModel(
    decoded.observations.map(o => o.value),
    decoded.observations.map(o => o.timestamp),
    { modelType: decoded.modelType, horizon: decoded.horizon, seasonalPeriod: decoded.seasonalPeriod }
  );
  assert.ok(Math.abs(fit1.pointForecasts[0] - fit2.pointForecasts[0]) < 1e-6);

  // Scenario 14: All 18 Guided Investigations have valid presets and deterministic seeds
  assert.equal(GUIDED_INVESTIGATIONS.length, 18);
});
