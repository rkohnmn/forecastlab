/**
 * Automated Unit Tests for Exporters, CSV Sanitization, Storage, and URL Hash Round-Tripping
 * Executed via Node.js native test runner: `node --test tests/exporters-storage.test.js`
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeCsvCell,
  parseDelimitedText,
  exportForecastToCSV,
  exportComparisonToCSV,
  exportToDataSenseForecastJSON,
  exportCrossAppInterchangeJSON,
  exportToRScript,
  exportToPythonScript,
  exportToLaTeXTable,
  exportReadableReport,
  encodeStateToHash,
  decodeStateFromHash
} from "../js/exporters.js";
import {
  saveSessionToStorage,
  loadSessionFromStorage,
  clearSessionStorage,
  getPrivacyAndStorageAudit
} from "../js/storage.js";
import { fitForecastModel, validateTemporalSeries } from "../js/math-engine.js";
import { PRESET_DATASETS } from "../js/presets.js";

test("1. CSV Formula Injection Sanitization escapes dangerous leading characters while preserving numbers", () => {
  assert.equal(escapeCsvCell("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
  assert.equal(escapeCsvCell("+SUM(A1:A10)"), "'+SUM(A1:A10)");
  assert.equal(escapeCsvCell("-1+1"), "'-1+1");
  assert.equal(escapeCsvCell("@import"), "'@import");
  assert.equal(escapeCsvCell(-42.5), "-42.5");
  assert.equal(escapeCsvCell("Series, \"A\""), "\"Series, \"\"A\"\"\"");
});

test("2. Delimited Text Parser handles CSV, TSV, missing tokens, and external predictors", () => {
  const sampleCsv = [
    "timestamp,demand,temp_c",
    "2026-01,120.5,14.2",
    "2026-02,NA,16.0",
    "2026-03,135.0,19.5",
    "2026-04,142.8,22.1"
  ].join("\n");

  const parsed = parseDelimitedText(sampleCsv);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.observations.length, 4);
  assert.equal(parsed.observations[1].value, null);
  assert.equal(parsed.observations[0].predictors.temp_c, 14.2);
});

test("3. Multi-Format Exporters (CSV, DataSense JSON, R, Python, LaTeX, Report) produce valid outputs", () => {
  const ds = PRESET_DATASETS.retail_turnover;
  const vals = ds.observations.map(o => o.value);
  const ts = ds.observations.map(o => o.timestamp);
  const valRes = validateTemporalSeries(ds.observations);
  const fit = fitForecastModel(vals, ts, { modelType: "ETS_AAA", horizon: 4, seasonalPeriod: 4, frequency: "quarterly" });

  const csv = exportForecastToCSV(ds.observations, fit);
  assert.ok(csv.includes("obs_id,timestamp,segment,actual_y"));
  assert.ok(csv.includes("forecast"));

  const compCsv = exportComparisonToCSV([{ modelType: "ETS_AAA", modelName: "ETS(A,A,A)", horizon: 4, metrics: { mae: 1.2, rmse: 1.5, mase: 0.7 } }]);
  assert.ok(compCsv.includes("ETS_AAA"));

  const dsJson = JSON.parse(exportToDataSenseForecastJSON(ds, fit));
  assert.equal(dsJson.$schema, "https://datasense-studio.github.io/schemas/v1/forecast-result.json");
  assert.equal(dsJson.forecasts.length, 4);

  const vgJson = JSON.parse(exportCrossAppInterchangeJSON("VisualGrammar", ds, ds.observations, fit));
  assert.equal(vgJson.targetApplication, "VisualGrammar");

  const rlJson = JSON.parse(exportCrossAppInterchangeJSON("ResampleLab", ds, ds.observations, fit));
  assert.equal(rlJson.procedure, "moving_block_time_series_bootstrap");

  const qlJson = JSON.parse(exportCrossAppInterchangeJSON("QuartetLab", ds, ds.observations, fit));
  assert.equal(qlJson.targetApplication, "QuartetLab");

  const rCode = exportToRScript(ds, ds.observations, fit);
  assert.ok(rCode.includes("library(fable)"));

  const pyCode = exportToPythonScript(ds, ds.observations, fit);
  assert.ok(pyCode.includes("statsmodels"));

  const latex = exportToLaTeXTable([{ modelType: "ETS_AAA", modelName: "ETS(A,A,A)", metrics: { mae: 1.2, rmse: 1.5, mase: 0.7 } }]);
  assert.ok(latex.includes("\\toprule"));

  const report = exportReadableReport(ds, valRes, fit);
  assert.ok(report.includes("Ljung-Box Residual Portmanteau Test"));
});

test("4. URL Hash State & LocalStorage Persistence round-trip losslessly", () => {
  const ds = PRESET_DATASETS.short_startup_revenue;
  const origState = {
    presetId: ds.id,
    modelType: "DRIFT",
    horizon: 6,
    seasonalPeriod: 4,
    frequency: "quarterly",
    transformType: "log",
    boxCoxLambda: 0,
    biasAdjust: true,
    explanationLevel: "technical",
    observations: ds.observations
  };
  const hash = encodeStateToHash(origState);
  assert.ok(hash.startsWith("#state="));
  const restored = decodeStateFromHash(hash);
  assert.equal(restored.modelType, "DRIFT");
  assert.equal(restored.horizon, 6);
  assert.equal(restored.biasAdjust, true);
  assert.equal(restored.observations.length, ds.observations.length);
  assert.ok(Math.abs(restored.observations[0].value - ds.observations[0].value) < 1e-4);

  saveSessionToStorage(origState);
  const loaded = loadSessionFromStorage();
  assert.equal(loaded.presetId, ds.id);
  clearSessionStorage();
  assert.equal(loadSessionFromStorage(), null);
  const audit = getPrivacyAndStorageAudit();
  assert.equal(audit.localFirstProcessing, true);
  assert.equal(audit.externalNetworkCalls, 0);
});
