/**
 * Automated Unit & Property-Based Invariant Tests for ForecastLab Mathematical Engine
 * Executed via Node.js native test runner: `node --test tests/math-engine.test.js`
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  createPRNG,
  logGamma,
  regularizedBeta,
  chiSquarePValue,
  studentTTwoSidedPValue,
  inverseNormalCDF,
  studentTCritical,
  studentTCritical95,
  quantileSorted,
  computeUnivariateStats,
  validateTemporalSeries,
  imputeSeriesTrainingOnly,
  applyForwardTransform,
  backTransformValue,
  estimateBoxCoxLambda,
  computeACF,
  computePACF,
  ljungBoxTest,
  classicalDecomposition,
  stlDecomposition,
  mstlDecomposition,
  fitBaselineModel,
  fitETSModel,
  fitARIMAModel,
  fitTSRegressionModel,
  reconcileHierarchicalForecasts,
  simulateModelTrajectories,
  simulateWhiteNoiseProcess,
  computeAccuracyMetrics,
  evaluateChronologicalHoldout,
  runRollingOriginBacktest
} from "../js/math-engine.js";
import { PRESET_DATASETS } from "../js/presets.js";

test("1. Special Functions & Distributions match reference statistical tables", () => {
  // Gamma(5) = 24 -> ln(24) = 3.1780538303479458
  assert.ok(Math.abs(logGamma(5.0) - Math.log(24.0)) < 1e-12);
  // Inverse Normal CDF(0.975) = 1.959963984540054
  assert.ok(Math.abs(inverseNormalCDF(0.975) - 1.9599639845) < 1e-7);
  // Student-t critical value df=9, 95% = 2.262157
  assert.ok(Math.abs(studentTCritical95(9) - 2.262157) < 1e-4);
  assert.ok(Math.abs(studentTCritical(9, 0.80) - 1.383029) < 1e-4);
  // Two-sided t p-value at t=2.262157, df=9 is 0.05
  assert.ok(Math.abs(studentTTwoSidedPValue(2.262157, 9) - 0.05) < 1e-4);
  // Chi-square p-value: Q=3.8414588, df=1 -> p = 0.05
  assert.ok(Math.abs(chiSquarePValue(3.8414588, 1) - 0.05) < 1e-4);
  // Hyndman-Fan Type 7 quantile
  assert.equal(quantileSorted([10, 20, 30, 40, 50], 0.5), 30);
  assert.equal(quantileSorted([10, 20, 30, 40], 0.25), 17.5);
});

test("2. Temporal Data Engine validates ordering, duplicates, missing values, and frequency inference", () => {
  const unorderedWithDupes = [
    { timestamp: "2025-03", value: 130 },
    { timestamp: "2025-01", value: 110 },
    { timestamp: "2025-02", value: null },
    { timestamp: "2025-02", value: 999 }, // duplicate timestamp
    { timestamp: "2025-05", value: 0 },   // implicit gap at 2025-04 + genuine zero at 2025-05
    { timestamp: "2025-06", value: 150 }
  ];
  const val = validateTemporalSeries(unorderedWithDupes);
  assert.equal(val.valid, true);
  assert.equal(val.wasOutOfOrder, true);
  assert.equal(val.duplicateTimestampCount, 1);
  assert.equal(val.missingValueCount, 1);
  assert.equal(val.zeroValueCount, 1);
  assert.equal(val.implicitGapCount, 1);
  assert.equal(val.inferredFrequency, "monthly");
  assert.equal(val.observations[0].timestamp, "2025-01");

  // Training-only linear interpolation fills missing recorded value without altering genuine zero
  const imputed = imputeSeriesTrainingOnly(val.observations, "linear");
  assert.equal(imputed[1].value, 120); // midpoint between 110 and 130
  assert.equal(imputed[1].isImputed, true);
  assert.equal(imputed[3].value, 0);   // genuine zero preserved
});

test("3. Transformations & Back-Transformations preserve exact round-trip and FPP3 bias adjustment", () => {
  const y = [10, 20, 40, 80, 160];
  const logFwd = applyForwardTransform(y, { type: "log" });
  assert.equal(logFwd.valid, true);
  const backMedian = backTransformValue(logFwd.values[2], 0.04, { type: "log" }, false);
  const backMean = backTransformValue(logFwd.values[2], 0.04, { type: "log" }, true);
  assert.ok(Math.abs(backMedian - 40.0) < 1e-10);
  // Bias-adjusted mean = 40 * (1 + 0.04/2) = 40.8
  assert.ok(Math.abs(backMean - 40.8) < 1e-10);

  // Box-Cox rejects non-positive data
  const negCheck = applyForwardTransform([10, 0, 25], { type: "boxcox", lambda: 0.5 });
  assert.equal(negCheck.valid, false);
});

test("4. ACF, PACF (Durbin-Levinson) & Ljung-Box behave accurately on white noise and AR(1)", () => {
  const prng = createPRNG(999);
  const ar1 = [0.0];
  for (let t = 1; t < 120; t++) {
    ar1.push(0.75 * ar1[t - 1] + prng.nextGaussian(0, 1));
  }
  const acf = computeACF(ar1, 10);
  const pacf = computePACF(ar1, 10);
  assert.equal(acf.valid, true);
  assert.ok(acf.acf[0] > 0.55 && acf.acf[0] < 0.90);
  assert.ok(Math.abs(acf.acf[0] - pacf.pacf[0]) < 1e-12); // PACF(1) === ACF(1)
  const lb = ljungBoxTest(ar1, 8, 0);
  assert.equal(lb.significant, true);
});

test("5. Classical, STL (LOESS) & MSTL Decompositions reconstruct observed series exactly", () => {
  const air = PRESET_DATASETS.airline_passengers.observations.map(o => o.value);
  const ts = PRESET_DATASETS.airline_passengers.observations.map(o => o.timestamp);

  const cAdd = classicalDecomposition(air, 12, "additive");
  assert.equal(cAdd.valid, true);
  for (let i = 6; i < air.length - 6; i++) {
    const recon = cAdd.trend[i] + cAdd.seasonal[i] + cAdd.remainder[i];
    assert.ok(Math.abs(recon - air[i]) < 1e-10);
  }

  const cMul = classicalDecomposition(air, 12, "multiplicative");
  assert.equal(cMul.valid, true);
  for (let i = 6; i < air.length - 6; i++) {
    const recon = cMul.trend[i] * cMul.seasonal[i] * cMul.remainder[i];
    assert.ok(Math.abs(recon - air[i]) < 1e-10);
  }

  const stl = stlDecomposition(air, 12, { robust: true });
  assert.equal(stl.valid, true);
  assert.ok(stl.strengths.trendStrength > 0.85);
  assert.ok(stl.strengths.seasonalStrength > 0.80);
  for (let i = 0; i < air.length; i++) {
    const recon = stl.trend[i] + stl.seasonal[i] + stl.remainder[i];
    assert.ok(Math.abs(recon - air[i]) < 1e-10);
  }

  const mstl = mstlDecomposition(air, [4, 12]);
  assert.equal(mstl.valid, true);
  assert.equal(mstl.seasonalComponents.length, 2);
});

test("6. Baseline Models (Mean, Naive, Seasonal Naive, Drift) match exact analytical formulas", () => {
  const y = [10, 20, 15, 25, 12, 22, 18, 28];
  const ts = ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];

  const meanFit = fitBaselineModel(y, ts, { modelType: "MEAN", horizon: 4, seasonalPeriod: 4, frequency: "quarterly" });
  assert.equal(meanFit.valid, true);
  assert.ok(Math.abs(meanFit.pointForecasts[0] - 18.75) < 1e-10);

  const naiveFit = fitBaselineModel(y, ts, { modelType: "NAIVE", horizon: 4, seasonalPeriod: 4, frequency: "quarterly" });
  assert.equal(naiveFit.pointForecasts[0], 28);
  assert.equal(naiveFit.pointForecasts[3], 28);
  assert.ok(naiveFit.stdErrors[3] > naiveFit.stdErrors[0]); // Horizon-dependent widening

  const snaiveFit = fitBaselineModel(y, ts, { modelType: "SNAIVE", horizon: 6, seasonalPeriod: 4, frequency: "quarterly" });
  assert.deepEqual(snaiveFit.pointForecasts.slice(0, 4), [12, 22, 18, 28]);
  assert.equal(snaiveFit.pointForecasts[4], 12); // h=5 wraps to Q1

  const driftFit = fitBaselineModel(y, ts, { modelType: "DRIFT", horizon: 2, seasonalPeriod: 4, frequency: "quarterly" });
  const expectedDrift = (28 - 10) / 7;
  assert.ok(Math.abs(driftFit.pointForecasts[0] - (28 + expectedDrift)) < 1e-10);
  assert.ok(Math.abs(driftFit.pointForecasts[1] - (28 + 2 * expectedDrift)) < 1e-10);
});

test("7. Exponential Smoothing & ETS family optimize parameters and generate valid intervals", () => {
  const air = PRESET_DATASETS.airline_passengers.observations.map(o => o.value);
  const ts = PRESET_DATASETS.airline_passengers.observations.map(o => o.timestamp);

  const ses = fitETSModel(air, ts, { modelType: "ETS_ANN", horizon: 6, seasonalPeriod: 12 });
  assert.equal(ses.valid, true);
  assert.ok(ses.parameters.alpha > 0 && ses.parameters.alpha < 1);

  const holt = fitETSModel(air, ts, { modelType: "ETS_AAN", horizon: 6, seasonalPeriod: 12 });
  assert.equal(holt.valid, true);

  const damped = fitETSModel(air, ts, { modelType: "ETS_AAdN", horizon: 6, seasonalPeriod: 12 });
  assert.equal(damped.valid, true);
  assert.ok(damped.parameters.phi >= 0.80 && damped.parameters.phi <= 0.98);

  const hwAdd = fitETSModel(air, ts, { modelType: "ETS_AAA", horizon: 12, seasonalPeriod: 12 });
  assert.equal(hwAdd.valid, true);

  const hwMul = fitETSModel(air, ts, { modelType: "ETS_MAM", horizon: 12, seasonalPeriod: 12 });
  assert.equal(hwMul.valid, true);

  const autoEts = fitETSModel(air, ts, { modelType: "ETS_AUTO", horizon: 12, seasonalPeriod: 12 });
  assert.equal(autoEts.valid, true);
  assert.ok(autoEts.searchedCandidates.length >= 4);
});

test("8. ARIMA & Seasonal ARIMA fit, invert differencing, and compute Wold psi-weight intervals", () => {
  const ret = PRESET_DATASETS.retail_turnover.observations.map(o => o.value);
  const ts = PRESET_DATASETS.retail_turnover.observations.map(o => o.timestamp);

  const sarima = fitARIMAModel(ret, ts, {
    modelType: "ARIMA",
    p: 1, d: 1, q: 1, P: 0, D: 1, Q: 1,
    seasonalPeriod: 4,
    horizon: 8,
    frequency: "quarterly"
  });
  assert.equal(sarima.valid, true);
  assert.equal(sarima.pointForecasts.length, 8);
  assert.ok(sarima.stdErrors[7] > sarima.stdErrors[0]);

  const autoArima = fitARIMAModel(ret, ts, {
    modelType: "ARIMA_AUTO",
    seasonalPeriod: 4,
    horizon: 8,
    frequency: "quarterly"
  });
  assert.equal(autoArima.valid, true);
  assert.ok(autoArima.searchedCandidates.length >= 6);
});

test("9. Property-based invariants hold across regression residuals and prediction intervals", () => {
  const ret = PRESET_DATASETS.retail_turnover.observations.map(o => o.value);
  const ts = PRESET_DATASETS.retail_turnover.observations.map(o => o.timestamp);

  const reg = fitTSRegressionModel(ret, ts, {
    modelType: "TS_REG",
    includeTrend: true,
    seasonalType: "dummies",
    seasonalPeriod: 4,
    horizon: 8
  });
  assert.equal(reg.valid, true);
  // Algebraic property of OLS with intercept: sum of in-sample residuals === 0
  const sumRes = reg.residuals.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sumRes) < 1e-9);

  // Prediction interval for individual future observation is strictly wider than Confidence Interval for Mean Response
  for (let h = 0; h < 8; h++) {
    const piWidth = reg.intervals[95][h][1] - reg.intervals[95][h][0];
    const ciWidth = reg.meanResponseConfidenceInterval95[h][1] - reg.meanResponseConfidenceInterval95[h][0];
    assert.ok(piWidth > ciWidth);
    const pi80Width = reg.intervals[80][h][1] - reg.intervals[80][h][0];
    assert.ok(piWidth > pi80Width);
  }
});


test("10. Stochastic Trajectory Simulation & White-Noise vs ARCH Independence Simulator", () => {
  const ds = PRESET_DATASETS.retail_turnover;
  const fit = fitARIMAModel(
    ds.observations.map(o => o.value),
    ds.observations.map(o => o.timestamp),
    { p: 1, d: 1, q: 1, seasonalPeriod: 4, horizon: 8 }
  );
  const paths = simulateModelTrajectories(fit, 20, 4289104);
  assert.equal(paths.length, 20);
  assert.equal(paths[0].length, 8);

  const wn = simulateWhiteNoiseProcess("iid_wn", 150, 0.0, 4289104);
  assert.equal(wn.lbLevel.significant, false);

  const ar = simulateWhiteNoiseProcess("ar1", 150, 0.75, 4289104);
  assert.equal(ar.lbLevel.significant, true);

  const arch = simulateWhiteNoiseProcess("arch", 250, 0.0, 4289104);
  // ARCH(1) has strong autocorrelation in squared values y_t^2 (volatility clustering)
  assert.equal(arch.lbSquared.significant, true);
});
