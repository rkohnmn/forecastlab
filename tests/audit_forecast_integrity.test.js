/** Batch 17 proposed, source-linked regression tests. Run only after local patch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimeToken, computeAccuracyMetrics, fitBaselineModel,
  evaluateChronologicalHoldout, runRollingOriginBacktest, fitTSRegressionModel
} from '../js/math-engine.js';

test('reject impossible civil dates and calendar rollovers', () => {
  for (const date of ['2026-02-30', '2025-02-29', '2026-04-31', '2026-01-01T24:00', '2026-01-01T10:61', '2026-01-01T10:00+24:00']) {
    assert.equal(parseTimeToken(date).valid, false, date);
  }
  assert.equal(parseTimeToken('2024-02-29').valid, true);
});

test('apply explicit timezone offsets before computing forecast chronology', () => {
  const parsed = parseTimeToken('2026-01-01T00:30:00+02:00');
  assert.equal(parsed.valid, true);
  assert.equal(parsed.epochMs, Date.parse('2025-12-31T22:30:00.000Z'));
  assert.equal(parseTimeToken('2026-01-01T00:30:00-05:00').epochMs, Date.parse('2026-01-01T05:30:00.000Z'));
});

test('preserve historical four-digit years 0000–0099', () => {
  const p = parseTimeToken('0099-12-31');
  assert.equal(p.valid, true);
  assert.equal(new Date(p.epochMs).getUTCFullYear(), 99);
  assert.equal(new Date(parseTimeToken('0099-12').epochMs).getUTCFullYear(), 99);
});

test('MASE scale retains time gaps instead of compressing missing training entries', () => {
  const scores = computeAccuracyMetrics([5], [4], [10, null, 30, null, 40], 2);
  assert.equal(scores.valid, true);
  assert.equal(scores.scaleLagUsed, 2);
  assert.ok(Math.abs(scores.mase - 1 / 15) < 1e-12);
  assert.ok(Math.abs(scores.rmsse - Math.sqrt(1 / 250)) < 1e-12);
});

test('nonseasonal MASE stays unavailable when no adjacent training pair exists', () => {
  const scores = computeAccuracyMetrics([5], [4], [10, null, 15], 1);
  assert.equal(scores.mase, null);
  assert.equal(scores.rmsse, null);
});

test('one-cycle seasonal-naive forecast preserves points but withholds unknown interval width', () => {
  const fit = fitBaselineModel([1, 2, 3, 4], [], {modelType:'SNAIVE', seasonalPeriod:4, horizon:2});
  assert.equal(fit.valid, true);
  assert.deepEqual(fit.pointForecasts, [1, 2]);
  assert.deepEqual(fit.intervals[95], [[null, null], [null, null]]);
  assert.ok(fit.warnings.some(w => /uncertainty/i.test(w)));
});

test('holdout cannot report valid with zero test observations', () => {
  for (const [y, split] of [ [[1, 2, 3, 4], 4], [[1, 2, 3, 4, 5], 5], [[1, 2, 3, 4, 5], 4.5] ]) {
    const result = evaluateChronologicalHoldout(y, [], {modelType:'NAIVE'}, split);
    assert.equal(result.valid, false);
    assert.equal(result.code, 'INVALID_HOLDOUT_SPLIT');
  }
});

test('valid chronological holdout still uses future observations only for evaluation', () => {
  const result = evaluateChronologicalHoldout([1, 2, 3, 4, 5, 6, 7], [], {modelType:'NAIVE'}, 5);
  assert.equal(result.valid, true);
  assert.equal(result.trainSize, 5);
  assert.equal(result.testSize, 2);
  assert.equal(result.metrics.count, 2);
});

test('rolling-window settings must be bounded positive integers', () => {
  const y = Array.from({length:16},(_,i)=>i+1);
  for (const bad of [{stepSize:0.5},{horizon:1.5},{initialWindow:6.5},{initialWindow:5},{horizon:100000},{windowType:'unrecognized'},{stepSize:Infinity}]) {
    const result = runRollingOriginBacktest(y, [], {modelType:'NAIVE'}, {...bad,initialWindow:bad.initialWindow??8});
    assert.equal(result.valid, false, JSON.stringify(bad));
    assert.equal(result.code,'INVALID_BACKTEST_CONFIG');
  }
});

test('valid expanding rolling-window backtest remains supported', () => {
  const y = Array.from({length:16},(_,i)=>i+1);
  const result = runRollingOriginBacktest(y, [], {modelType:'NAIVE'}, {initialWindow:8,horizon:2,stepSize:2});
  assert.equal(result.valid, true);
  assert.equal(result.originCount, 4);
  assert.equal(result.horizonMetrics.length, 2);
});

test('failed ARIMA error fit must not be labeled as successful dynamic regression', () => {
  const y = Array.from({length:10},(_,i)=>10+2*i);
  const fit = fitTSRegressionModel(y, [], {modelType:'DYN_REG', arimaP:5, arimaQ:5, seasonalPeriod:1, horizon:2});
  assert.equal(fit.valid,false);
  assert.equal(fit.code,'ARIMA_ERROR_FIT_FAILED');
});
