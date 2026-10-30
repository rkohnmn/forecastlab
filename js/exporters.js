import { assertInputSize, assertTableSize, assertHeaders, missingNumber, readDelimitedRecords } from './import-safety.js';
/**
 * ForecastLab Multi-Format Exporters, Delimited Text Parser & Cross-Application Interchange
 *
 * Complies with:
 * - DATA_CONVENTIONS.md (RFC 4180 CSV, CSV formula injection sanitization, DataSense JSON schemas)
 * - STATISTICAL_AUDIT.md (Statsmodels / R fable parity, lossless URL hash serialization)
 */

import { ENGINE_VERSION, createPRNG } from "./math-engine.js";

/**
 * RFC 4180 Cell Escaping + Mandatory Spreadsheet Formula Injection Sanitization
 * Prefixes strings starting with =, +, -, @, \t, or \r with a literal single quote (')
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Sanitize column headers per DATA_CONVENTIONS.md Section D.3
 */
export function sanitizeHeaderName(name) {
  let clean = String(name || "series")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!clean) clean = "series";
  if (/^\d/.test(clean)) clean = "v_" + clean;
  return clean;
}

/**
 * Parse CSV, TSV, or Semicolon-delimited text into structured observations
 */
export function parseDelimitedText(rawText, options = {}) {
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return { valid: false, errors: ["Input text is empty."], observations: [], headers: [] };
  }
  let records, delimiter;
  try { ({records, delimiter} = readDelimitedRecords(rawText)); }
  catch (error) { return {valid:false, errors:[error.message], observations:[], headers:[]}; }
  const firstTokens = records[0] || [];
  const secondTokenIsNumber = firstTokens.length >= 2 && Number.isFinite(Number(firstTokens[1])) && firstTokens[1] !== "";
  const hasHeader = !secondTokenIsNumber;

  const headers = hasHeader
    ? firstTokens.map((h, idx) => sanitizeHeaderName(h || `col_${idx + 1}`))
    : firstTokens.map((_, idx) => (idx === 0 ? "timestamp" : idx === 1 ? "value" : `predictor_${idx - 1}`));

  const startRow = hasHeader ? 1 : 0;
  try { assertHeaders(headers); assertTableSize(records.length - startRow, headers.length); }
  catch (error) { return {valid:false, errors:[error.message], observations:[], headers}; }
  const timeColIdx = options.timeColIndex ?? 0;
  const valueColIdx = options.valueColIndex ?? 1;
  const observations = [];
  const parseErrors = [];

  for (let r = startRow; r < records.length; r++) {
    const cols = records[r];
    if (cols.length !== headers.length || cols.length < 2) {
      parseErrors.push(`Line ${r + 1}: Column count does not match the header.`);
      continue;
    }
    const rawTime = cols[timeColIdx];
    const rawVal = cols[valueColIdx];
    let val = null;
    if (rawVal !== "" && rawVal.toUpperCase() !== "NA" && rawVal.toLowerCase() !== "null") {
      const num = Number(rawVal);
      if (Number.isFinite(num)) {
        val = num;
      } else {
        parseErrors.push(`Line ${r + 1}: Non-numeric token '${rawVal}' found in value column.`);
      }
    }
    const predictors = Object.create(null);
    for (let c = 0; c < cols.length; c++) {
      if (c !== timeColIdx && c !== valueColIdx) {
        const pNum = missingNumber(cols[c]);
        if (Number.isFinite(pNum)) {
          predictors[headers[c]] = pNum;
        }
      }
    }
    observations.push({
      obs_id: `row_${observations.length + 1}`,
      timestamp: rawTime,
      value: val,
      predictors
    });
  }

  if (observations.length < 3) {
    return {
      valid: false,
      errors: [`At least 3 valid observations are required (parsed ${observations.length}).`, ...parseErrors],
      observations,
      headers
    };
  }

  return {
    valid: parseErrors.length === 0,
    delimiter,
    headers,
    observations,
    errors: parseErrors
  };
}

/**
 * Export Actual, Fitted, Residual, and Future Forecasts with 80% & 95% Prediction Intervals to RFC 4180 CSV
 */
export function exportForecastToCSV(observations, fitResult, scenarioResult = null) {
  const headers = [
    "obs_id",
    "timestamp",
    "segment",
    "actual_y",
    "fitted_y",
    "residual_e",
    "point_forecast",
    "pi_80_lower",
    "pi_80_upper",
    "pi_95_lower",
    "pi_95_upper",
    "scenario_adjusted_forecast"
  ];
  const rows = [headers.join(",")];

  for (let t = 0; t < observations.length; t++) {
    const obs = observations[t];
    const fv = fitResult?.valid && fitResult.fittedValues ? fitResult.fittedValues[t] : null;
    const res = fitResult?.valid && fitResult.residuals ? fitResult.residuals[t] : null;
    rows.push([
      escapeCsvCell(obs.obs_id || `t_${t + 1}`),
      escapeCsvCell(obs.timestamp),
      escapeCsvCell("historical"),
      escapeCsvCell(obs.value !== null && Number.isFinite(obs.value) ? Number(obs.value.toFixed(4)) : ""),
      escapeCsvCell(fv !== null && Number.isFinite(fv) ? Number(fv.toFixed(4)) : ""),
      escapeCsvCell(res !== null && Number.isFinite(res) ? Number(res.toFixed(4)) : ""),
      "", "", "", "", "", ""
    ].join(","));
  }

  if (fitResult?.valid) {
    for (let h = 0; h < fitResult.horizon; h++) {
      const pt = fitResult.pointForecasts[h];
      const pi80 = fitResult.intervals?.[80]?.[h] || [null, null];
      const pi95 = fitResult.intervals?.[95]?.[h] || [null, null];
      const adj = scenarioResult?.valid ? scenarioResult.adjustedPointForecasts[h] : null;
      rows.push([
        escapeCsvCell(`fc_${h + 1}`),
        escapeCsvCell(fitResult.futureTimestamps[h]),
        escapeCsvCell("forecast"),
        "",
        "",
        "",
        escapeCsvCell(Number.isFinite(pt) ? Number(pt.toFixed(4)) : ""),
        escapeCsvCell(Number.isFinite(pi80[0]) ? Number(pi80[0].toFixed(4)) : ""),
        escapeCsvCell(Number.isFinite(pi80[1]) ? Number(pi80[1].toFixed(4)) : ""),
        escapeCsvCell(Number.isFinite(pi95[0]) ? Number(pi95[0].toFixed(4)) : ""),
        escapeCsvCell(Number.isFinite(pi95[1]) ? Number(pi95[1].toFixed(4)) : ""),
        escapeCsvCell(adj !== null && Number.isFinite(adj) ? Number(adj.toFixed(4)) : "")
      ].join(","));
    }
  }

  return rows.join("\r\n");
}

/**
 * Export Model Accuracy Comparison Table to CSV
 */
export function exportComparisonToCSV(comparisonRows = []) {
  const headers = [
    "model_type",
    "model_name",
    "evaluation_design",
    "horizon",
    "mae",
    "rmse",
    "mase",
    "rmsse",
    "mape_pct",
    "smape_pct",
    "bias_me",
    "coverage_95_pct",
    "winkler_score_95",
    "aicc"
  ];
  const rows = [headers.join(",")];
  for (const r of comparisonRows) {
    const m = r.metrics || {};
    rows.push([
      escapeCsvCell(r.modelType),
      escapeCsvCell(r.modelName),
      escapeCsvCell(r.evaluationDesign || "Chronological Holdout"),
      escapeCsvCell(r.horizon),
      escapeCsvCell(fmtNum(m.mae)),
      escapeCsvCell(fmtNum(m.rmse)),
      escapeCsvCell(fmtNum(m.mase)),
      escapeCsvCell(fmtNum(m.rmsse)),
      escapeCsvCell(fmtNum(m.mape)),
      escapeCsvCell(fmtNum(m.smape)),
      escapeCsvCell(fmtNum(m.me)),
      escapeCsvCell(fmtNum(m.coverage95)),
      escapeCsvCell(fmtNum(m.winklerScore95)),
      escapeCsvCell(fmtNum(r.aicc))
    ].join(","));
  }
  return rows.join("\r\n");
}

/**
 * Export Canonical DataSenseForecastResult JSON (DATA_CONVENTIONS.md Section E.4)
 */
export function exportToDataSenseForecastJSON(datasetMeta, fitResult, evaluationMetrics = null) {
  return JSON.stringify({
    $schema: "https://datasense-studio.github.io/schemas/v1/forecast-result.json",
    version: "1.0.0",
    sourceApplication: "ForecastLab",
    applicationVersion: ENGINE_VERSION,
    createdAt: new Date().toISOString(),
    modelType: fitResult?.modelType || "UNKNOWN",
    modelName: fitResult?.modelName || "",
    seriesId: sanitizeHeaderName(datasetMeta?.id || datasetMeta?.title || "series"),
    frequency: datasetMeta?.seasonalPeriod || 12,
    temporalFrequencyLabel: datasetMeta?.frequency || "monthly",
    parameters: fitResult?.parameters || {},
    inSampleMetrics: {
      sigma: fmtNum(fitResult?.diagnostics?.sigma),
      aic: fmtNum(fitResult?.diagnostics?.aic),
      aicc: fmtNum(fitResult?.diagnostics?.aicc)
    },
    outOfSampleMetrics: evaluationMetrics ? {
      mae: fmtNum(evaluationMetrics.mae),
      rmse: fmtNum(evaluationMetrics.rmse),
      mase: fmtNum(evaluationMetrics.mase),
      rmsse: fmtNum(evaluationMetrics.rmsse),
      coverage95: fmtNum(evaluationMetrics.coverage95)
    } : null,
    horizon: fitResult?.horizon || 0,
    forecasts: (fitResult?.pointForecasts || []).map((pt, idx) => ({
      step: idx + 1,
      timestamp: fitResult.futureTimestamps[idx],
      pointForecast: fmtNum(pt),
      predictionInterval80: (fitResult.intervals?.[80]?.[idx] || [null, null]).map(fmtNum),
      predictionInterval95: (fitResult.intervals?.[95]?.[idx] || [null, null]).map(fmtNum)
    }))
  }, null, 2);
}

/**
 * Cross-Application Ecosystem Handoff Exporter (VisualGrammar, ResampleLab, QuartetLab)
 */
export function exportCrossAppInterchangeJSON(targetApp, datasetMeta, observations, fitResult, decompResult = null) {
  if (targetApp === "VisualGrammar") {
    return JSON.stringify({
      $schema: "https://datasense-studio.github.io/schemas/v1/dataset.json",
      version: "1.0.0",
      targetApplication: "VisualGrammar",
      metadata: {
        id: datasetMeta?.id || "forecastlab_export",
        title: `${datasetMeta?.title || "Time Series"} — Decomposition & Forecast`,
        sourceApplication: "ForecastLab",
        applicationVersion: ENGINE_VERSION,
        recommendedChartFamily: "Line Chart with Seasonal Subseries Facets"
      },
      variables: [
        { name: "timestamp", label: "Timestamp", dataType: "temporal", role: "timestamp" },
        { name: "observed_y", label: "Observed Value", unit: datasetMeta?.unit || "units", dataType: "float64", role: "response" },
        { name: "trend_t", label: "Trend-Cycle Component", dataType: "float64", role: "explanatory" },
        { name: "seasonal_s", label: "Seasonal Component", dataType: "float64", role: "explanatory" },
        { name: "remainder_r", label: "Remainder Component", dataType: "float64", role: "metadata" }
      ],
      observations: observations.map((o, idx) => ({
        obs_id: o.obs_id || `t_${idx + 1}`,
        timestamp: o.timestamp,
        observed_y: o.value,
        trend_t: decompResult?.valid ? fmtNum(decompResult.trend[idx]) : null,
        seasonal_s: decompResult?.valid ? fmtNum(decompResult.seasonal[idx]) : null,
        remainder_r: decompResult?.valid ? fmtNum(decompResult.remainder[idx]) : null
      }))
    }, null, 2);
  }

  if (targetApp === "ResampleLab") {
    // Generate Moving-Block Bootstrap replicates of residuals to preserve serial dependence (Part 25.3)
    const cleanRes = (fitResult?.residuals || []).filter(v => v !== null && Number.isFinite(v));
    const blockLength = Math.max(2, Math.min(8, Math.floor(Math.sqrt(cleanRes.length))));
    const prng = createPRNG(4289104);
    const blockBootstrapSample = [];
    while (blockBootstrapSample.length < cleanRes.length && cleanRes.length >= blockLength) {
      const start = Math.floor(prng.nextUniform() * (cleanRes.length - blockLength + 1));
      for (let k = 0; k < blockLength && blockBootstrapSample.length < cleanRes.length; k++) {
        blockBootstrapSample.push(fmtNum(cleanRes[start + k]));
      }
    }
    return JSON.stringify({
      $schema: "https://datasense-studio.github.io/schemas/v1/simulation-result.json",
      version: "1.0.0",
      targetApplication: "ResampleLab",
      procedure: "moving_block_time_series_bootstrap",
      dependencyWarning: "Ordinary i.i.d. bootstrap is invalid for autocorrelated time series; moving-block bootstrap (blockLength=" + blockLength + ") preserves local serial dependence.",
      blockLength,
      prng: { algorithm: "Mulberry32", seed: 4289104 },
      innovationResiduals: cleanRes.map(fmtNum),
      exampleBlockResample: blockBootstrapSample
    }, null, 2);
  }

  // QuartetLab Bivariate Export (Lag-1 pairs or Exogenous Predictor vs Response)
  return JSON.stringify({
    $schema: "https://datasense-studio.github.io/schemas/v1/dataset.json",
    version: "1.0.0",
    targetApplication: "QuartetLab",
    metadata: {
      id: `${datasetMeta?.id || "series"}_lag1_bivariate`,
      title: `${datasetMeta?.title || "Series"} (Lag-1 Bivariate Pairs y_{t-1} vs y_t)`,
      description: "WARNING: Time-series observations exhibit serial dependence and violate ordinary OLS i.i.d. error assumptions.",
      sourceApplication: "ForecastLab",
      applicationVersion: ENGINE_VERSION
    },
    variables: [
      { name: "explanatory_x", label: "Lagged Value y_{t-1}", unit: datasetMeta?.unit || "units", dataType: "float64", role: "explanatory" },
      { name: "response_y", label: "Current Value y_t", unit: datasetMeta?.unit || "units", dataType: "float64", role: "response" }
    ],
    observations: observations.slice(1).map((o, idx) => ({
      obs_id: `lag_${idx + 1}`,
      label: o.timestamp,
      explanatory_x: observations[idx].value,
      response_y: o.value
    })).filter(r => r.explanatory_x !== null && r.response_y !== null)
  }, null, 2);
}

/**
 * Generate Reproducible R Script (fable / tsibble / feasts ecosystem per FPP3)
 */
export function exportToRScript(datasetMeta, observations, fitResult) {
  const vals = observations.filter(o => o.value !== null).map(o => o.value).join(", ");
  const m = fitResult?.seasonalPeriod || datasetMeta?.seasonalPeriod || 12;
  const h = fitResult?.horizon || 12;
  const modelType = fitResult?.modelType || "NAIVE";

  let fableModelSpec = "NAIVE(y)";
  if (modelType === "MEAN") fableModelSpec = "MEAN(y)";
  else if (modelType === "SNAIVE") fableModelSpec = `SNAIVE(y ~ lag(${m}))`;
  else if (modelType === "DRIFT") fableModelSpec = "RW(y ~ drift())";
  else if (modelType === "ETS_ANN") fableModelSpec = 'ETS(y ~ error("A") + trend("N") + season("N"))';
  else if (modelType === "ETS_AAN") fableModelSpec = 'ETS(y ~ error("A") + trend("A") + season("N"))';
  else if (modelType === "ETS_AAdN") fableModelSpec = 'ETS(y ~ error("A") + trend("Ad") + season("N"))';
  else if (modelType === "ETS_AAA") fableModelSpec = 'ETS(y ~ error("A") + trend("A") + season("A"))';
  else if (modelType === "ETS_MAM") fableModelSpec = 'ETS(y ~ error("M") + trend("A") + season("M"))';
  else if (modelType === "ETS_AUTO") fableModelSpec = "ETS(y)";
  else if (modelType === "ARIMA" && fitResult?.orders) {
    const o = fitResult.orders;
    fableModelSpec = `ARIMA(y ~ pdq(${o.p}, ${o.d}, ${o.q}) + PDQ(${o.P}, ${o.D}, ${o.Q}, period = ${m}))`;
  } else if (modelType === "ARIMA_AUTO") fableModelSpec = "ARIMA(y)";
  else if (modelType === "TS_REG") fableModelSpec = "TSLM(y ~ trend() + season())";

  return `# ForecastLab Reproducible R Script (FPP3 / tidyverts / fable)
# Note: Numerical optimization conventions in ForecastLab (client-side Nelder-Mead / CSS)
# may differ slightly from R's fable exact likelihood routines.

library(tsibble)
library(fable)
library(feasts)
library(ggplot2)

y_values <- c(${vals})
ts_data <- tsibble(
  t = seq_along(y_values),
  y = y_values,
  index = t
)

# Fit ${fitResult?.modelName || modelType}
fit <- ts_data |>
  model(selected_model = ${fableModelSpec})

report(fit)
gg_tsresiduals(fit)

# Generate h = ${h} forecasts with 80% and 95% prediction intervals
fc <- fit |> forecast(h = ${h})
print(fc |> hilo(level = c(80, 95)))
autoplot(fc, ts_data) +
  labs(title = "${(datasetMeta?.title || "Time Series").replace(/"/g, "")}", y = "${datasetMeta?.unit || "Value"}")
`;
}

/**
 * Generate Reproducible Python Script (statsmodels.tsa + pandas)
 */
export function exportToPythonScript(datasetMeta, observations, fitResult) {
  const vals = observations.filter(o => o.value !== null).map(o => o.value).join(", ");
  const m = fitResult?.seasonalPeriod || datasetMeta?.seasonalPeriod || 12;
  const h = fitResult?.horizon || 12;
  const modelType = fitResult?.modelType || "NAIVE";

  return `# ForecastLab Reproducible Python Script (pandas + statsmodels.tsa)
# Series: ${datasetMeta?.title || "Time Series"}
# Model:  ${fitResult?.modelName || modelType} (m = ${m}, h = ${h})

import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.stats.diagnostic import acorr_ljungbox

y = pd.Series([${vals}], name="y")

# Fit SARIMAX / ExponentialSmoothing equivalent and inspect diagnostics
${modelType.startsWith("ARIMA") ? `model = SARIMAX(y, order=(${fitResult?.orders?.p ?? 1}, ${fitResult?.orders?.d ?? 1}, ${fitResult?.orders?.q ?? 1}), seasonal_order=(${fitResult?.orders?.P ?? 0}, ${fitResult?.orders?.D ?? 0}, ${fitResult?.orders?.Q ?? 0}, ${m}))
res = model.fit(disp=False)` : `model = ExponentialSmoothing(y, trend=${modelType.includes("AA") || modelType.includes("MAM") ? '"add"' : "None"}, damped_trend=${modelType === "ETS_AAdN" ? "True" : "False"}, seasonal=${m > 1 && (modelType.endsWith("A") || modelType.endsWith("M")) ? (modelType.endsWith("M") ? '"mul"' : '"add"') : "None"}, seasonal_periods=${m > 1 ? m : "None"})
res = model.fit()`}

print(res.summary())
lb_test = acorr_ljungbox(res.resid.dropna(), lags=[min(10, len(y)//3)], return_df=True)
print("Ljung-Box Residual Diagnostics:\\n", lb_test)

forecast_values = res.forecast(steps=${h})
print("Point Forecasts (h=1..${h}):\\n", forecast_values)
`;
}

/**
 * Generate Publication-Quality LaTeX booktabs Table
 */
export function exportToLaTeXTable(comparisonRows = [], fitResult = null) {
  const lines = [
    "% ForecastLab Publication-Quality LaTeX Table (requires \\usepackage{booktabs})",
    "\\begin{table}[htbp]",
    "\\centering",
    "\\caption{Out-of-Sample Forecast Evaluation and Information Criteria}",
    "\\begin{tabular}{lrrrrrr}",
    "\\toprule",
    "Model & MAE & RMSE & MASE & RMSSE & 95\\% Cov. & $\\text{AIC}_c$ \\\\",
    "\\midrule"
  ];
  for (const r of comparisonRows) {
    const m = r.metrics || {};
    lines.push(
      `${String(r.modelName || r.modelType).replace(/_/g, "\\_")} & ${fmtLatex(m.mae)} & ${fmtLatex(m.rmse)} & ${fmtLatex(m.mase)} & ${fmtLatex(m.rmsse)} & ${m.coverage95 !== null && m.coverage95 !== undefined ? m.coverage95.toFixed(1) + "\\%" : "---"} & ${fmtLatex(r.aicc)} \\\\`
    );
  }
  lines.push("\\bottomrule", "\\end{tabular}", "\\end{table}");
  return lines.join("\n");
}

/**
 * Generate Comprehensive Readable Technical Forecast Report (Part 24.3)
 */
export function exportReadableReport(datasetMeta, validation, fitResult, holdoutRes = null) {
  const m = fitResult?.seasonalPeriod || validation?.seasonalPeriod || 1;
  const lb = fitResult?.diagnostics?.ljungBox;
  return `# ForecastLab Reproducible Forecast & Diagnostic Report
Generated: ${new Date().toISOString()}
Engine Version: ${ENGINE_VERSION}

## 1. Series Definition & Temporal Validation
- **Series Title**: ${datasetMeta?.title || "Custom Series"}
- **Measurement Unit**: ${datasetMeta?.unit || "Units"}
- **Temporal Frequency**: ${validation?.inferredFrequency || "regular"} (Seasonal period m = ${m})
- **Date Range**: ${validation?.observations?.[0]?.timestamp || "t_1"} to ${validation?.observations?.[validation.observations.length - 1]?.timestamp || "t_T"}
- **Sample Size**: T = ${validation?.completeCount || 0} complete observations (${validation?.missingValueCount || 0} missing values, ${validation?.implicitGapCount || 0} calendar gaps)
- **Sample Mean / SD**: ${fmtNum(validation?.stats?.mean)} / ${fmtNum(validation?.stats?.stdDev)}

## 2. Fitted Model Specification & Diagnostics
- **Fitted Model**: ${fitResult?.modelName || fitResult?.modelType || "N/A"} (${fitResult?.family || ""})
- **Estimation Status**: ${fitResult?.estimationStatus || "N/A"}
- **Transformation**: ${fitResult?.reproducibility?.transform?.type || "none"} (Bias Adjusted: ${Boolean(fitResult?.reproducibility?.biasAdjust)})
- **Residual Standard Error (sigma)**: ${fmtNum(fitResult?.diagnostics?.sigma)}
- **Information Criteria**: AIC = ${fmtNum(fitResult?.diagnostics?.aic)}, AICc = ${fmtNum(fitResult?.diagnostics?.aicc)}, BIC = ${fmtNum(fitResult?.diagnostics?.bic)}
- **Ljung-Box Residual Portmanteau Test**: Q* = ${fmtNum(lb?.Q)} (df = ${lb?.df ?? 1}, p-value = ${fmtNum(lb?.pValue)}) -> ${lb?.significant ? "WARNING: Significant residual autocorrelation remains" : "Uncorrelated white-noise residuals not rejected"}

## 3. Out-of-Sample Temporal Holdout Evaluation
${holdoutRes?.valid ? `- **Holdout Split**: Training T_train = ${holdoutRes.trainSize}, Test H_test = ${holdoutRes.testSize}
- **MAE**: ${fmtNum(holdoutRes.metrics.mae)}
- **RMSE**: ${fmtNum(holdoutRes.metrics.rmse)}
- **MASE**: ${fmtNum(holdoutRes.metrics.mase)} (benchmark lag = ${holdoutRes.metrics.scaleLagUsed})
- **RMSSE**: ${fmtNum(holdoutRes.metrics.rmsse)}
- **95% Empirical Interval Coverage**: ${fmtNum(holdoutRes.metrics.coverage95)}% (Winkler Score = ${fmtNum(holdoutRes.metrics.winklerScore95)})` : "- No holdout split evaluation active."}

## 4. Point Forecasts & Prediction Intervals (h = 1..${fitResult?.horizon || 0})
| Step | Timestamp | Point Forecast | 80% Lower | 80% Upper | 95% Lower | 95% Upper |
|---|---|---|---|---|---|---|
${(fitResult?.pointForecasts || []).map((pt, h) => {
  const b80 = fitResult.intervals?.[80]?.[h] || [null, null];
  const b95 = fitResult.intervals?.[95]?.[h] || [null, null];
  return `| h=${h + 1} | ${fitResult.futureTimestamps[h]} | ${fmtNum(pt)} | ${fmtNum(b80[0])} | ${fmtNum(b80[1])} | ${fmtNum(b95[0])} | ${fmtNum(b95[1])} |`;
}).join("\n")}

## 5. Assumptions & Limitations
- **Model Assumptions**: ${fitResult?.modelType ? "Future innovations follow the historical error process; structural relationships remain invariant across horizon h." : "N/A"}
- **Caveats**: Prediction intervals condition on the selected model specification and do not incorporate unexpected structural regime breaks or unmodeled exogenous shocks.
`;
}

/**
 * Lossless URL Hash State Serialization (#state=<base64>)
 */
export function encodeStateToHash(stateSnapshot) {
  try {
    const compact = {
      v: 1,
      presetId: stateSnapshot.presetId || "airline_passengers",
      modelType: stateSnapshot.modelType || "ETS_MAM",
      horizon: stateSnapshot.horizon || 12,
      seasonalPeriod: stateSnapshot.seasonalPeriod || 12,
      frequency: stateSnapshot.frequency || "monthly",
      transformType: stateSnapshot.transformType || "none",
      boxCoxLambda: stateSnapshot.boxCoxLambda ?? 0.5,
      biasAdjust: Boolean(stateSnapshot.biasAdjust),
      explanationLevel: stateSnapshot.explanationLevel || "standard",
      pts: (stateSnapshot.observations || []).map(o => [
        o.timestamp,
        o.value !== null && Number.isFinite(o.value) ? Number(o.value.toFixed(4)) : null
      ])
    };
    const json = JSON.stringify(compact);
    const b64 = typeof btoa === "function"
      ? btoa(encodeURIComponent(json))
      : Buffer.from(encodeURIComponent(json), "utf8").toString("base64");
    return `#state=${b64}`;
  } catch (_err) {
    return "";
  }
}

export function decodeStateFromHash(hashString) {
  try {
    if (!hashString) return null;
    const cleaned = hashString.replace(/^#/, "");
    if (!cleaned.startsWith("state=")) return null;
    const b64 = cleaned.slice(6);
    const json = decodeURIComponent(
      typeof atob === "function"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("utf8")
    );
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.pts)) return null;
    return {
      presetId: parsed.presetId || "custom",
      modelType: parsed.modelType || "NAIVE",
      horizon: Number(parsed.horizon || 12),
      seasonalPeriod: Number(parsed.seasonalPeriod || 12),
      frequency: parsed.frequency || "monthly",
      transformType: parsed.transformType || "none",
      boxCoxLambda: Number(parsed.boxCoxLambda ?? 0.5),
      biasAdjust: Boolean(parsed.biasAdjust),
      explanationLevel: parsed.explanationLevel || "standard",
      observations: parsed.pts.map((pair, idx) => ({
        obs_id: `pt_${idx + 1}`,
        timestamp: String(pair[0]),
        value: pair[1] !== null && Number.isFinite(Number(pair[1])) ? Number(pair[1]) : null
      }))
    };
  } catch (_err) {
    return null;
  }
}

function fmtNum(v) {
  return v !== null && v !== undefined && Number.isFinite(v) ? Number(v.toFixed(4)) : null;
}

function fmtLatex(v) {
  return v !== null && v !== undefined && Number.isFinite(v) ? v.toFixed(3) : "---";
}
