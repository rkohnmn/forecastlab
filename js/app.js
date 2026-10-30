import { assertInputSize } from './import-safety.js';
let importGeneration = 0;
/**
 * ForecastLab Main Application Controller, Reactive State Coordinator & Undo/Redo Stack
 *
 * Coordinates:
 * - All 9 Interactive Workspaces (Forecast Studio, Understand Series, Lab & STL, Model Comparison,
 *   Evaluation & Backtest Lab, Scenarios & Hierarchy, Forecasting Atlas, 18 Guided Investigations, Methods)
 * - Direct Canvas Pointer Inspection & Point Sensitivity Dragging (with >= 30-step Undo/Redo)
 * - Simple / Standard / Technical Explanation Level Switcher (without altering numerical engine results)
 * - Multi-Format Exports, URL Hash State, and LocalStorage Persistence
 */

import {
  validateTemporalSeries,
  imputeSeriesTrainingOnly,
  estimateBoxCoxLambda,
  extractSeriesFeatures,
  computeACF,
  computePACF,
  computeLagPairs,
  classicalDecomposition,
  stlDecomposition,
  mstlDecomposition,
  fitForecastModel,
  recommendForecastModels,
  evaluateChronologicalHoldout,
  runRollingOriginBacktest,
  buildScenarioForecast,
  reconcileHierarchicalForecasts,
  simulateModelTrajectories,
  simulateWhiteNoiseProcess,
  MODEL_REGISTRY
} from "./math-engine.js";

import {
  PRESET_DATASETS,
  ATLAS_TOPICS,
  GUIDED_INVESTIGATIONS
} from "./presets.js";

import {
  renderMainForecastCanvas,
  renderDiagnosticsCanvas,
  renderDecompositionCanvas,
  renderSeasonalPlotCanvas,
  renderSubseriesCanvas,
  renderLagPlotCanvas,
  renderCorrelogramCanvas,
  renderBacktestHorizonCanvas,
  renderSeasonalHeatmapCanvas,
  renderWhiteNoiseDemoCanvas,
  renderActualVsFittedCanvas,
  renderHierarchyCanvas,
  exportForecastChartToSVG
} from "./renderer.js";

import {
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
} from "./exporters.js";

import {
  saveSessionToStorage,
  loadSessionFromStorage,
  clearSessionStorage,
  getPrivacyAndStorageAudit
} from "./storage.js";

import { parseObservationJSON } from "./import-validation.js";

function setImportError(message = "", state = "error") {
  const el = document.getElementById("import-validation-error");
  if (el) { el.textContent = message; el.dataset.state = state; }
}

const MAX_UNDO_DEPTH = 40;

const appState = {
  activeWorkspace: "studio",
  isDark: false,
  explanationLevel: "standard", // "simple" | "standard" | "technical"

  // Active dataset & validation
  presetId: "airline_passengers",
  datasetMeta: { ...PRESET_DATASETS.airline_passengers },
  rawObservations: PRESET_DATASETS.airline_passengers.observations.map(o => ({ ...o })),
  frequencyOverride: "auto",
  seasonalPeriodOverride: 12,
  imputationMethod: "linear",

  // Model & Forecast Studio settings
  modelType: "ETS_MAM",
  horizon: 12,
  transformType: "none",
  boxCoxLambda: 0.5,
  biasAdjust: false,
  etsOptimize: true,
  etsAlpha: 0.30,
  etsBeta: 0.05,
  etsPhi: 0.92,
  arimaOrders: { p: 1, d: 1, q: 1, P: 0, D: 1, Q: 1 },
  regSeasonalType: "dummies",
  regFourierK: 2,
  regUseIntervention: false,

  // Visual toggles
  showFitted: true,
  showIntervals: true,
  showHoldout: false,
  showMeanCI: false,
  showSimPaths: false,
  piLevels: [80, 95],
  diagViewMode: "4panel",
  zoomStartPct: 0,
  hoverIndex: null,

  // Lab & Decomposition settings
  decompMethod: "stl",
  decompTWindow: 15,
  decompShowSA: true,
  seasonalViewMode: "seasonal", // "seasonal" | "subseries" | "heatmap"
  lagK: 1,
  wnMode: "iid_wn",
  wnSeed: 4289104,
  hierarchySelectedNode: "Total",

  // Evaluation & Backtest settings
  evalWindowType: "expanding",
  evalInitPct: 75,
  evalHorizon: 6,
  evalStepSize: 2,
  evalLeakageGuard: true,

  // Scenario & Hierarchy settings
  scenarioPreset: "baseline",
  scenarioAmount: 0,
  scenarioAuthor: "Lead Forecaster",
  scenarioReason: "Baseline statistical forecast retained without override.",
  scenarioNonNegative: false,
  activeScenarioResult: null,
  hierarchyMethod: "wls_structural",
  hierarchyBaseModel: "ETS_AAA",

  // Guided Investigation state
  activeLessonId: 1,
  selectedQuizOption: null,

  // Computed outputs cache
  validation: null,
  imputedObservations: [],
  features: null,
  primaryFit: null,
  holdoutResult: null,
  comparisonResults: [],
  backtestResult: null,
  hierarchyResult: null,
  mainChartProjection: null,

  // Undo / Redo Stacks
  undoStack: [],
  redoStack: []
};

function pushUndoSnapshot() {
  appState.undoStack.push(
    JSON.stringify({
      presetId: appState.presetId,
      rawObservations: appState.rawObservations,
      modelType: appState.modelType,
      horizon: appState.horizon
    })
  );
  if (appState.undoStack.length > MAX_UNDO_DEPTH) {
    appState.undoStack.shift();
  }
  appState.redoStack = [];
}

function showToast(msg) {
  const el = document.getElementById("toast-notification");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("visible");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("visible"), 3200);
}

/**
 * Load a preset dataset into active state
 */
function loadPresetDataset(presetId, recordUndo = true) {
  ++importGeneration; setImportError();
  const preset = PRESET_DATASETS[presetId];
  if (!preset) return;
  if (recordUndo) pushUndoSnapshot();

  appState.presetId = presetId;
  appState.datasetMeta = { ...preset };
  appState.rawObservations = preset.observations.map(o => ({
    ...o,
    predictors: o.predictors ? { ...o.predictors } : {}
  }));
  appState.frequencyOverride = preset.frequency;
  appState.seasonalPeriodOverride = preset.seasonalPeriod;
  appState.modelType = preset.defaultModel || "NAIVE";
  appState.activeScenarioResult = null;

  const mInput = document.getElementById("val-m-override");
  if (mInput) mInput.value = String(preset.seasonalPeriod);
  const modelSelect = document.getElementById("studio-model-select");
  if (modelSelect) modelSelect.value = appState.modelType;
  const presetSelect = document.getElementById("global-preset-select");
  if (presetSelect) presetSelect.value = presetId;

  // Populate raw CSV textarea with current dataset for inspection/editing
  const csvArea = document.getElementById("raw-csv-textarea");
  if (csvArea) {
    const lines = ["timestamp,value"];
    appState.rawObservations.slice(0, 36).forEach(o => {
      lines.push(`${o.timestamp},${o.value === null ? "NA" : o.value}`);
    });
    csvArea.value = lines.join("\n");
  }

  recomputeAll();
}

/**
 * Core Mathematical Pipeline Execution
 */
function recomputeAll() {
  const freqOpt = appState.frequencyOverride === "auto" ? null : appState.frequencyOverride;
  const val = validateTemporalSeries(appState.rawObservations, {
    frequencyOverride: freqOpt,
    seasonalPeriodOverride: appState.seasonalPeriodOverride
  });
  appState.validation = val;

  if (!val.valid) {
    renderStudioInvalidState(val.errors.join(" "));
    return;
  }

  const imputed = imputeSeriesTrainingOnly(val.observations, appState.imputationMethod);
  appState.imputedObservations = imputed;
  const numericValues = imputed.map(o => o.value);
  const timestamps = imputed.map(o => o.timestamp);
  const m = val.seasonalPeriod || 1;

  appState.features = extractSeriesFeatures(numericValues, m);

  // Build model configuration
  const modelCfg = buildActiveModelConfig(imputed, m, val.inferredFrequency);
  appState.primaryFit = fitForecastModel(numericValues, timestamps, modelCfg);

  // Compute Chronological Holdout evaluation
  const splitIdx = Math.max(4, Math.floor(numericValues.length * (appState.evalInitPct / 100)));
  appState.holdoutResult = evaluateChronologicalHoldout(
    numericValues,
    timestamps,
    {
      ...modelCfg,
      allPredictors: imputed.map(o => o.predictors || {}),
      allowRealizedPredictorsInBacktest: !appState.evalLeakageGuard
    },
    splitIdx
  );

  // Update active workspace UI & charts
  updateStudioUI();
  if (appState.activeWorkspace === "understand") updateUnderstandUI();
  if (appState.activeWorkspace === "lab") updateLabUI();
  if (appState.activeWorkspace === "comparison") runModelComparisonSuite();
  if (appState.activeWorkspace === "evaluation") runEvaluationSuite();
  if (appState.activeWorkspace === "scenarios") updateScenariosAndHierarchyUI();
  if (appState.activeWorkspace === "atlas") renderAtlasCards();
  if (appState.activeWorkspace === "investigations") renderActiveInvestigation();
  if (appState.activeWorkspace === "methods") updateMethodsUI();
}

function buildActiveModelConfig(imputedObs, m, frequency) {
  const hasPreds = Boolean(appState.datasetMeta?.hasPredictors);
  const predictorNames = hasPreds ? (appState.datasetMeta.predictorNames || []) : [];
  const trainPredictors = imputedObs.map(o => o.predictors || {});
  const futurePredictors = hasPreds
    ? (appState.datasetMeta.futurePredictorsBaseline || []).slice(0, appState.horizon)
    : [];

  return {
    modelType: appState.modelType,
    horizon: appState.horizon,
    levels: appState.piLevels,
    seasonalPeriod: m,
    frequency,
    transform: {
      type: appState.transformType,
      lambda: appState.boxCoxLambda,
      seasonalPeriod: m
    },
    biasAdjust: appState.biasAdjust,
    optimize: appState.etsOptimize,
    alpha: appState.etsAlpha,
    beta: appState.etsBeta,
    phi: appState.etsPhi,
    ...appState.arimaOrders,
    includeTrend: true,
    seasonalType: appState.regSeasonalType,
    fourierK: appState.regFourierK,
    interventionIndex: appState.regUseIntervention ? (appState.datasetMeta.interventionIndex || Math.floor(imputedObs.length * 0.65)) : null,
    predictorNames,
    trainPredictors,
    futurePredictors
  };
}

/**
 * Update Workspace 1: Forecast Studio UI & Canvases
 */
function updateStudioUI() {
  const val = appState.validation;
  const fit = appState.primaryFit;
  const feats = appState.features;
  const holdout = appState.holdoutResult;

  document.getElementById("studio-chart-title").textContent = appState.datasetMeta.title || "Custom Time Series";
  document.getElementById("studio-freq-badge").textContent = `${val.inferredFrequency} · m = ${val.seasonalPeriod}`;
  document.getElementById("studio-family-tag").textContent = MODEL_REGISTRY[appState.modelType]?.family || appState.modelType;

  // Progressive disclosure of model controls
  document.getElementById("boxcox-lambda-box").style.display = appState.transformType === "boxcox" ? "block" : "none";
  document.getElementById("ets-manual-controls").style.display = appState.modelType.startsWith("ETS_") && appState.modelType !== "ETS_AUTO" ? "block" : "none";
  document.getElementById("ets-sliders-wrap").style.display = !appState.etsOptimize ? "block" : "none";
  document.getElementById("arima-manual-controls").style.display = appState.modelType === "ARIMA" ? "block" : "none";
  document.getElementById("regression-manual-controls").style.display = (appState.modelType === "TS_REG" || appState.modelType === "DYN_REG") ? "block" : "none";

  // Moment strip
  document.getElementById("stat-n").textContent = String(val.completeCount);
  document.getElementById("stat-mean").textContent = fmt(val.stats.mean, 2);
  document.getElementById("stat-sd").textContent = fmt(val.stats.stdDev, 2);
  document.getElementById("stat-ft").textContent = fmt(feats?.trendStrength, 3);
  document.getElementById("stat-fs").textContent = fmt(feats?.seasonalStrength, 3);
  document.getElementById("stat-sigma").textContent = fit?.valid ? fmt(fit.diagnostics?.sigma, 3) : "N/A";
  document.getElementById("stat-mase").textContent = holdout?.valid && holdout.metrics?.mase !== null ? fmt(holdout.metrics.mase, 3) : "N/A";

  const statusBadge = document.getElementById("fit-status-badge");
  const lbBadge = document.getElementById("ljung-box-badge");

  if (!fit || !fit.valid) {
    statusBadge.textContent = "Ineligible / Restricted";
    statusBadge.className = "status-pill status-err";
    document.getElementById("studio-interpretation-box").innerHTML = `<strong>Model Eligibility Restriction:</strong> ${escapeHtml(fit?.reason || "Unable to fit selected model.")}`;
    document.getElementById("studio-params-tbody").innerHTML = "";
    document.getElementById("studio-forecast-tbody").innerHTML = "";
  } else {
    statusBadge.textContent = fit.estimationStatus;
    statusBadge.className = "status-pill status-ok";

    const lb = fit.diagnostics?.ljungBox;
    if (lb && lb.valid) {
      lbBadge.textContent = `Ljung–Box p = ${lb.pValue < 0.0001 ? "< 0.0001" : lb.pValue.toFixed(4)}`;
      lbBadge.className = `status-pill ${lb.significant ? "status-warn" : "status-ok"}`;
    }

    renderStudioExplanation(fit, feats, holdout);
    renderStudioParametersTable(fit);
    renderStudioForecastTable(fit);
  }

  // Render Main Forecast Canvas & Residual Diagnostics Canvas
  const mainCanvas = document.getElementById("canvas-main-forecast");
  const simPaths = (appState.showSimPaths && fit?.valid) ? simulateModelTrajectories(fit, 15, 4289104) : [];
  appState.mainChartProjection = renderMainForecastCanvas(mainCanvas, {
    isDark: appState.isDark,
    observations: appState.imputedObservations,
    unit: appState.datasetMeta.unit || "Units",
    primaryFit: fit,
    holdoutResult: appState.showHoldout ? holdout : null,
    scenarioResult: appState.activeScenarioResult,
    showFitted: appState.showFitted,
    showIntervals: appState.showIntervals,
    showMeanCI: appState.showMeanCI,
    innerLevel: appState.piLevels[0],
    outerLevel: appState.piLevels[1],
    simulatedPaths: simPaths,
    zoomStartPct: appState.zoomStartPct / 100,
    hoverIndex: appState.hoverIndex
  });

  const diagCanvas = document.getElementById("canvas-diagnostics");
  if (appState.diagViewMode === "actual_fitted") {
    renderActualVsFittedCanvas(diagCanvas, appState.imputedObservations, fit, appState.isDark);
  } else {
    renderDiagnosticsCanvas(
      diagCanvas,
      fit?.valid ? fit.residuals : [],
      appState.imputedObservations.map(o => o.timestamp),
      appState.isDark
    );
  }

  // Screen-reader summary
  const a11yEl = document.getElementById("canvas-a11y-summary");
  if (a11yEl && fit?.valid) {
    a11yEl.textContent = `${appState.datasetMeta.title}: ${val.completeCount} historical observations. Fitted ${fit.modelName} produces step-1 forecast ${fmt(fit.pointForecasts[0], 2)} with 95% prediction interval [${fmt(fit.intervals[95][0][0], 2)}, ${fmt(fit.intervals[95][0][1], 2)}].`;
  }
}

function renderStudioExplanation(fit, feats, holdout) {
  const box = document.getElementById("studio-interpretation-box");
  const warnBox = document.getElementById("studio-warnings-box");
  const regMeta = MODEL_REGISTRY[fit.modelType] || MODEL_REGISTRY.NAIVE;
  const lvl = appState.explanationLevel;
  const maseNote = holdout?.valid && holdout.metrics?.mase !== null
    ? `Holdout MASE = <code>${fmt(holdout.metrics.mase, 3)}</code> (${holdout.metrics.mase < 1 ? "beats" : "trails"} naïve)`
    : "";

  if (lvl === "simple") {
    box.innerHTML = `<div><strong>${escapeHtml(fit.modelName)}</strong> &middot; ${fit.horizon}-step projection (Trend ${(feats.trendStrength * 100).toFixed(0)}%, Season ${(feats.seasonalStrength * 100).toFixed(0)}%).</div>
      <div class="equation-pill math-tex">${renderMathHTML(regMeta.equation)}</div>
      <details class="compact-details">
        <summary>What the Forecast &amp; Shaded Bands Mean</summary>
        Shaded bands show the ${appState.piLevels[0]}% and ${appState.piLevels[1]}% prediction intervals—wider bands farther ahead reflect growing future uncertainty. ${maseNote}
      </details>`;
  } else if (lvl === "standard") {
    box.innerHTML = `<div><strong>${escapeHtml(fit.modelName)}</strong> &middot; &sigma;&#770; = <code>${fmt(fit.diagnostics?.sigma, 4)}</code> ${maseNote ? ` &middot; ${maseNote}` : ""}</div>
      <div class="equation-pill math-tex">${renderMathHTML(regMeta.equation)}</div>
      <details class="compact-details">
        <summary>Assumptions, Interval Method &amp; Limitations</summary>
        <div><strong>Assumptions:</strong> ${renderMathHTML(regMeta.assumptions)}</div>
        <div><strong>Intervals:</strong> <span class="math-tex">${renderMathHTML(regMeta.intervalMethod)}</span></div>
        <div><strong>Limitation:</strong> ${renderMathHTML(regMeta.limitations)}</div>
      </details>`;
  } else {
    box.innerHTML = `<div><strong>${escapeHtml(fit.modelName)}</strong> &middot; ${escapeHtml(fit.estimationStatus)} &middot; &sigma;&#770; = <code>${fmt(fit.diagnostics?.sigma, 4)}</code></div>
      <div class="equation-pill math-tex">${renderMathHTML(regMeta.equation)}</div>
      <div class="equation-pill math-tex"><strong>PI:</strong> ${renderMathHTML(regMeta.intervalMethod)}</div>
      <details class="compact-details">
        <summary>Technical Assumptions &amp; Structural Limitations</summary>
        <div><strong>Assumptions:</strong> ${renderMathHTML(regMeta.assumptions)}</div>
        <div><strong>Limitation:</strong> ${renderMathHTML(regMeta.limitations)}</div>
      </details>`;
  }

  const allWarnings = [...(appState.validation?.warnings || []), ...(fit.warnings || [])];
  if (allWarnings.length > 0) {
    warnBox.style.display = "block";
    warnBox.innerHTML = `<details class="compact-details" style="margin:0; background:transparent; border:none; padding:0;">
      <summary style="color:var(--color-warning);">Diagnostic &amp; Validation Notes (${allWarnings.length})</summary>
      • ${allWarnings.map(renderMathHTML).join("<br>• ")}
    </details>`;
  } else {
    warnBox.style.display = "none";
  }
}

function renderStudioParametersTable(fit) {
  const tbody = document.getElementById("studio-params-tbody");
  const rows = [];
  const p = fit.parameters || {};

  if (fit.coefficients && Array.isArray(fit.coefficients)) {
    for (const c of fit.coefficients) {
      rows.push(`<tr>
        <td class="math-tex">${renderMathHTML(c.term)}</td>
        <td class="num">${fmt(c.estimate, 4)}</td>
        <td>SE=${fmt(c.standardError, 3)}, t=${fmt(c.tStatistic, 2)}, p=${c.pValue < 0.0001 ? "&lt;0.0001" : fmt(c.pValue, 4)}</td>
      </tr>`);
    }
  } else {
    for (const [k, v] of Object.entries(p)) {
      if (v === null || v === undefined || k === "coefficients" || k === "members") continue;
      if (Array.isArray(v)) {
        if (v.length > 0) {
          rows.push(`<tr><td>${escapeHtml(k)}</td><td class="num">[${v.map(x => fmt(x, 3)).join(", ")}]</td><td>Lag polynomial vector</td></tr>`);
        }
      } else if (typeof v === "number") {
        rows.push(`<tr><td>${escapeHtml(k)}</td><td class="num">${fmt(v, 4)}</td><td>Estimated model parameter</td></tr>`);
      }
    }
  }

  if (fit.informationCriteria) {
    rows.push(`<tr><td>AICc (Small-Sample Corrected)</td><td class="num">${fmt(fit.informationCriteria.aicc, 2)}</td><td>Comparable on identical scale/differencing</td></tr>`);
    rows.push(`<tr><td>BIC (Schwarz Bayesian)</td><td class="num">${fmt(fit.informationCriteria.bic, 2)}</td><td>Penalizes parameter dimension k ln(T)</td></tr>`);
  }
  const lb = fit.diagnostics?.ljungBox;
  if (lb && lb.valid) {
    rows.push(`<tr><td>Ljung–Box Q* (L=${lb.lag}, df=${lb.df})</td><td class="num">${fmt(lb.Q, 2)}</td><td>p = ${lb.pValue < 0.0001 ? "&lt; 0.0001" : fmt(lb.pValue, 4)} (${lb.significant ? "Autocorrelated" : "White Noise OK"})</td></tr>`);
  }
  tbody.innerHTML = rows.join("");
}

function renderStudioForecastTable(fit) {
  const [inLvl, outLvl] = appState.piLevels || [80, 95];
  const thIn = document.getElementById("th-pi-inner");
  const thOut = document.getElementById("th-pi-outer");
  if (thIn) thIn.textContent = `${inLvl}% PI`;
  if (thOut) thOut.textContent = `${outLvl}% PI`;
  const tbody = document.getElementById("studio-forecast-tbody");
  const rows = [];
  for (let h = 0; h < fit.horizon; h++) {
    const pt = fit.pointForecasts[h];
    const b80 = fit.intervals?.[inLvl]?.[h] || [null, null];
    const b95 = fit.intervals?.[outLvl]?.[h] || [null, null];
    rows.push(`<tr>
      <td>h=${h + 1}</td>
      <td>${escapeHtml(fit.futureTimestamps[h])}</td>
      <td class="num"><strong>${fmt(pt, 2)}</strong></td>
      <td class="num">[${fmt(b80[0], 1)}, ${fmt(b80[1], 1)}]</td>
      <td class="num">[${fmt(b95[0], 1)}, ${fmt(b95[1], 1)}]</td>
    </tr>`);
  }
  tbody.innerHTML = rows.join("");
}

function renderStudioInvalidState(reason) {
  const box = document.getElementById("studio-interpretation-box");
  if (box) box.innerHTML = `<span style="color:var(--color-error);"><strong>Validation Error:</strong> ${escapeHtml(reason)}</span>`;
}

/**
 * Update Workspace 2: Understand Your Series
 */
function updateUnderstandUI() {
  const val = appState.validation;
  const feats = appState.features;
  if (!val) return;

  const auditEl = document.getElementById("validation-audit-report");
  auditEl.innerHTML = `
    <div><strong>Audit:</strong> <code>${escapeHtml(val.inferredFrequency)}</code> (m = <code>${val.seasonalPeriod}</code>) &middot; Complete: <code>${val.completeCount}/${val.totalRows}</code> &middot; Missing: <code>${val.missingValueCount}</code> &middot; Gaps: <code>${val.implicitGapCount}</code></div>
    <details class="compact-details">
      <summary>Temporal Integrity &amp; Missingness Details</summary>
      • Missing Remedy: <code>${escapeHtml(appState.imputationMethod)}</code> &middot; Irregular Intervals: <code>${val.irregularIntervalCount}</code><br>
      • Genuine Recorded Zeros: <code>${val.zeroValueCount}</code> (preserved distinctly from NA/null)
    </details>
  `;

  const strip = document.getElementById("understand-feature-strip");
  if (feats) {
    strip.innerHTML = `
      <div class="metric-badge"><div class="metric-badge-label">Mean / Median</div><div class="metric-badge-value">${fmt(feats.mean, 2)} / ${fmt(val.stats.median, 2)}</div></div>
      <div class="metric-badge"><div class="metric-badge-label">IQR / MAD</div><div class="metric-badge-value">${fmt(val.stats.iqr, 2)} / ${fmt(val.stats.mad, 2)}</div></div>
      <div class="metric-badge"><div class="metric-badge-label">Lag-1 ACF (r<sub>1</sub>)</div><div class="metric-badge-value">${fmt(feats.acf1, 3)}</div></div>
      <div class="metric-badge"><div class="metric-badge-label">Seasonal ACF<sub>m</sub></div><div class="metric-badge-value">${fmt(feats.seasonalAcf, 3)}</div></div>
      <div class="metric-badge"><div class="metric-badge-label">Var Stability</div><div class="metric-badge-value">${fmt(feats.varianceRatio, 2)}x</div></div>
      <div class="metric-badge"><div class="metric-badge-label">Guerrero λ</div><div class="metric-badge-value">${feats.recommendedLambda !== null ? fmt(feats.recommendedLambda, 2) : "N/A"}</div></div>
    `;
  }

  const tbody = document.getElementById("understand-obs-tbody");
  tbody.innerHTML = appState.imputedObservations.map((obs, idx) => {
    const rawMissing = appState.rawObservations[idx]?.value === null;
    const statusBadge = rawMissing
      ? (obs.isImputed ? `<span class="status-pill status-warn">IMPUTED (${appState.imputationMethod})</span>` : `<span class="status-pill status-err">MISSING (NA)</span>`)
      : (obs.isZero ? `<span class="status-pill status-warn">GENUINE ZERO</span>` : `<span class="status-pill status-ok">OBSERVED</span>`);

    return `<tr>
      <td>${escapeHtml(obs.obs_id)}</td>
      <td><input type="text" class="control-input mono obs-ts-input" data-idx="${idx}" value="${escapeHtml(obs.timestamp)}" style="padding:2px 5px; font-size:12px;"></td>
      <td class="num"><input type="number" step="any" class="control-input mono obs-val-input" data-idx="${idx}" value="${obs.value !== null ? obs.value : ""}" style="padding:2px 5px; font-size:12px; text-align:right;"></td>
      <td>${statusBadge}</td>
      <td><button type="button" class="btn btn-sm obs-del-btn" data-idx="${idx}">✕</button></td>
    </tr>`;
  }).join("");
}

/**
 * Update Workspace 3: Time-Series Laboratory & Decomposition
 */
function updateLabUI() {
  const vals = appState.imputedObservations.map(o => o.value);
  const ts = appState.imputedObservations.map(o => o.timestamp);
  const m = appState.validation?.seasonalPeriod || 12;

  let decomp;
  if (appState.decompMethod === "stl") {
    decomp = stlDecomposition(vals, m, { tWindow: appState.decompTWindow, robust: false });
  } else if (appState.decompMethod === "stl_robust") {
    decomp = stlDecomposition(vals, m, { tWindow: appState.decompTWindow, robust: true });
  } else if (appState.decompMethod === "classical_additive") {
    decomp = classicalDecomposition(vals, m, "additive");
  } else if (appState.decompMethod === "classical_multiplicative") {
    decomp = classicalDecomposition(vals, m, "multiplicative");
  } else {
    decomp = mstlDecomposition(vals, [Math.max(2, Math.floor(m / 2)), m], { tWindow: appState.decompTWindow });
  }

  const callout = document.getElementById("decomp-summary-callout");
  if (decomp.valid) {
    callout.innerHTML = `<strong>${escapeHtml(decomp.method.toUpperCase())} (m = ${m}):</strong>
      Trend Strength F<sub>T</sub> = <code>${fmt(decomp.strengths.trendStrength, 3)}</code> &middot;
      Seasonal Strength F<sub>S</sub> = <code>${fmt(decomp.strengths.seasonalStrength, 3)}</code> &middot;
      Var(R<sub>t</sub>) = <code>${fmt(decomp.strengths.remainderVariance, 3)}</code>`;
  } else {
    callout.innerHTML = `<span style="color:var(--color-error);"><strong>Notice:</strong> ${escapeHtml(decomp.reason)}</span>`;
  }

  renderDecompositionCanvas(document.getElementById("canvas-decomposition"), decomp, ts, appState.isDark, appState.decompShowSA);

  const seasCanvas = document.getElementById("canvas-seasonal");
  if (appState.seasonalViewMode === "seasonal") {
    renderSeasonalPlotCanvas(seasCanvas, appState.imputedObservations, m, appState.isDark);
  } else if (appState.seasonalViewMode === "subseries") {
    renderSubseriesCanvas(seasCanvas, appState.imputedObservations, m, appState.isDark);
  } else {
    renderSeasonalHeatmapCanvas(seasCanvas, appState.imputedObservations, m, appState.isDark);
  }

  const wnSim = simulateWhiteNoiseProcess(appState.wnMode, 96, 0.70, appState.wnSeed);
  renderWhiteNoiseDemoCanvas(document.getElementById("canvas-wn-demo"), wnSim, appState.isDark);

  const lagRes = computeLagPairs(vals, ts, appState.lagK);
  renderLagPlotCanvas(document.getElementById("canvas-lag"), lagRes, appState.isDark);

  const acfRes = computeACF(vals, Math.min(24, vals.length - 1));
  const pacfRes = computePACF(vals, Math.min(24, vals.length - 1));
  renderCorrelogramCanvas(document.getElementById("canvas-acf"), acfRes, "Sample ACF rₖ", appState.isDark);
  renderCorrelogramCanvas(document.getElementById("canvas-pacf"), pacfRes, "Sample PACF φₖₖ", appState.isDark);
}

/**
 * Update Workspace 4: Model Comparison Studio
 */
function runModelComparisonSuite() {
  const val = appState.validation;
  const feats = appState.features;
  if (!val || !val.valid) return;

  const vals = appState.imputedObservations.map(o => o.value);
  const ts = appState.imputedObservations.map(o => o.timestamp);
  const m = val.seasonalPeriod || 1;
  const hasPreds = Boolean(appState.datasetMeta?.hasPredictors);

  // Render Recommendation Cards
  const recs = recommendForecastModels(val, feats, hasPreds);
  const recGrid = document.getElementById("recommendation-cards-grid");
  recGrid.innerHTML = recs.slice(0, 3).map(r => `
    <div class="callout-box" style="margin:0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <strong>${escapeHtml(MODEL_REGISTRY[r.modelType]?.name || r.modelType)}</strong>
        <span class="status-pill status-ok">${escapeHtml(r.priority)}</span>
      </div>
      <div style="font-size:12.5px;">${renderMathHTML(r.rationale)}</div>
      <details class="compact-details">
        <summary>Equation &amp; Failure Mode</summary>
        <div class="math-tex" style="margin-bottom:4px;">${renderMathHTML(MODEL_REGISTRY[r.modelType]?.equation || "")}</div>
        <div style="color:var(--color-text-muted);"><strong>Risk:</strong> ${renderMathHTML(r.failureMode)}</div>
      </details>
    </div>
  `).join("");

  const candidates = ["MEAN", "NAIVE", "SNAIVE", "DRIFT", "ETS_ANN", "ETS_AAN", "ETS_AAdN", "ETS_AAA", "ETS_MAM", "ARIMA_AUTO", "TS_REG", "ENSEMBLE"];
  if (hasPreds) candidates.push("DYN_REG");

  const splitIdx = Math.max(4, Math.floor(vals.length * (appState.evalInitPct / 100)));
  const baseCfg = buildActiveModelConfig(appState.imputedObservations, m, val.inferredFrequency);
  const rows = [];

  for (const cType of candidates) {
    const hRes = evaluateChronologicalHoldout(
      vals,
      ts,
      {
        ...baseCfg,
        modelType: cType,
        allPredictors: appState.imputedObservations.map(o => o.predictors || {}),
        allowRealizedPredictorsInBacktest: true
      },
      splitIdx
    );
    if (hRes.valid) {
      rows.push({
        modelType: cType,
        modelName: hRes.modelName,
        horizon: hRes.testSize,
        metrics: hRes.metrics,
        aicc: hRes.fit.diagnostics?.aicc ?? null
      });
    }
  }

  rows.sort((a, b) => (a.metrics.mase ?? 999) - (b.metrics.mase ?? 999));
  appState.comparisonResults = rows;

  // Render Synchronized Multi-Model Forecast Overlay (Part 17.2)
  const compCanvas = document.getElementById("canvas-comparison-overlay");
  if (compCanvas && rows.length > 0) {
    const topFits = rows.slice(0, 4).map(r => fitForecastModel(vals, ts, { ...baseCfg, modelType: r.modelType })).filter(f => f.valid);
    renderMainForecastCanvas(compCanvas, {
      isDark: appState.isDark,
      observations: appState.imputedObservations,
      unit: appState.datasetMeta.unit || "Units",
      primaryFit: topFits[0] || appState.primaryFit,
      comparisonFits: topFits.slice(1),
      showFitted: false,
      showIntervals: true,
      innerLevel: appState.piLevels[0],
      outerLevel: appState.piLevels[1]
    });
  }

  const tbody = document.getElementById("comparison-scorecard-tbody");
  tbody.innerHTML = rows.map((r, idx) => {
    const mt = r.metrics;
    return `<tr style="${idx === 0 ? "font-weight:600;" : ""}">
      <td>${idx === 0 ? "★ " : ""}${escapeHtml(r.modelName)} <span class="mono" style="color:var(--color-text-muted);">(${r.modelType})</span></td>
      <td class="num">${fmt(mt.mae, 3)}</td>
      <td class="num">${fmt(mt.rmse, 3)}</td>
      <td class="num"><strong>${fmt(mt.mase, 3)}</strong></td>
      <td class="num">${fmt(mt.rmsse, 3)}</td>
      <td class="num">${fmt(mt.smape, 2)}%</td>
      <td class="num">${fmt(mt.me, 3)}</td>
      <td class="num">${mt.coverage95 !== null ? fmt(mt.coverage95, 1) + "%" : "---"}</td>
      <td class="num">${fmt(mt.winklerScore95, 2)}</td>
      <td class="num">${r.aicc !== null ? fmt(r.aicc, 1) : "---"}</td>
      <td><button type="button" class="btn btn-sm select-comp-model-btn" data-model="${r.modelType}">Use in Studio</button></td>
    </tr>`;
  }).join("");
}

/**
 * Update Workspace 5: Forecast Evaluation & Rolling-Origin Backtesting Lab
 */
function runEvaluationSuite() {
  const val = appState.validation;
  if (!val || !val.valid) return;
  const vals = appState.imputedObservations.map(o => o.value);
  const ts = appState.imputedObservations.map(o => o.timestamp);
  const m = val.seasonalPeriod || 1;
  const initWin = Math.max(6, Math.floor(vals.length * (appState.evalInitPct / 100)));

  const cfg = {
    ...buildActiveModelConfig(appState.imputedObservations, m, val.inferredFrequency),
    allPredictors: appState.imputedObservations.map(o => o.predictors || {}),
    allowRealizedPredictorsInBacktest: !appState.evalLeakageGuard
  };

  const bt = runRollingOriginBacktest(vals, ts, cfg, {
    windowType: appState.evalWindowType,
    initialWindow: initWin,
    horizon: appState.evalHorizon,
    stepSize: appState.evalStepSize
  });
  appState.backtestResult = bt;

  const summaryBox = document.getElementById("backtest-summary-box");
  const badge = document.getElementById("backtest-origins-badge");
  const tbody = document.getElementById("backtest-horizon-tbody");

  if (!bt.valid) {
    badge.textContent = "Restricted (Leakage Prevented)";
    summaryBox.className = "callout-box callout-danger";
    summaryBox.innerHTML = `<strong>Temporal Integrity Guardrail Triggered:</strong> ${escapeHtml(bt.reason)}`;
    tbody.innerHTML = "";
    return;
  }

  badge.textContent = `${bt.originCount} Origins · ${bt.totalEvaluatedForecasts} Forecasts`;
  summaryBox.className = "callout-box";
  const om = bt.overallMetrics;
  summaryBox.innerHTML = `
    <div><strong>${escapeHtml(appState.modelType)} (${bt.windowType.toUpperCase()}):</strong> MASE = <code>${fmt(om.mase, 3)}</code> &middot; RMSE = <code>${fmt(om.rmse, 3)}</code> &middot; 95% PI Cov = <code>${om.coverage95 !== null ? fmt(om.coverage95, 1) + "%" : "N/A"}</code></div>
    <details class="compact-details">
      <summary>Full Cross-Validation Protocol &amp; Metrics</summary>
      • Origins: ${bt.originCount} (T<sub>1</sub> = ${bt.initialWindow}, stride = ${bt.stepSize})<br>
      • MAE = <code>${fmt(om.mae, 3)}</code> &middot; RMSSE = <code>${fmt(om.rmsse, 3)}</code> &middot; Winkler Score = <code>${fmt(om.winklerScore95, 2)}</code>
    </details>
  `;

  renderBacktestHorizonCanvas(document.getElementById("canvas-backtest-horizon"), bt, appState.isDark);

  tbody.innerHTML = bt.horizonMetrics.map(hm => `
    <tr>
      <td>Horizon h = ${hm.horizon}</td>
      <td class="num">${hm.count}</td>
      <td class="num">${fmt(hm.me, 3)}</td>
      <td class="num">${fmt(hm.mae, 3)}</td>
      <td class="num"><strong>${fmt(hm.rmse, 3)}</strong></td>
    </tr>
  `).join("");
}

/**
 * Update Workspace 6: Scenario & Hierarchy Studio
 */
function updateScenariosAndHierarchyUI() {
  // 1. Scenario audit display
  const auditBox = document.getElementById("scenario-audit-box");
  if (appState.activeScenarioResult?.valid) {
    const sc = appState.activeScenarioResult;
    auditBox.innerHTML = `
      <div><strong>Scenario Active (${escapeHtml(sc.scenarioName)}):</strong> h=1 Baseline <code>${fmt(sc.statisticalPointForecasts[0], 2)}</code> &rarr; Adjusted <code>${fmt(sc.adjustedPointForecasts[0], 2)}</code></div>
      <details class="compact-details">
        <summary>Audit Trail (${escapeHtml(sc.auditLog.author)})</summary>
        Reason: ${escapeHtml(sc.auditLog.reason)} &middot; Override: <code>${sc.isJudgmentallyAdjusted ? "Yes (Baseline Preserved)" : "None"}</code>
      </details>
    `;
  } else {
    auditBox.innerHTML = `<strong>Pure Statistical Forecast Active:</strong> No manual overrides applied.`;
  }

  // 2. Run National Apparel Hierarchy Reconciliation
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
  const hRes = reconcileHierarchicalForecasts(hInput, {
    reconciliationMethod: appState.hierarchyMethod,
    modelType: appState.hierarchyBaseModel,
    horizon: 8,
    seasonalPeriod: 4
  });
  appState.hierarchyResult = hRes;

  const cohBadge = document.getElementById("hierarchy-coherence-badge");
  const hCallout = document.getElementById("hierarchy-summary-callout");
  const hTbody = document.getElementById("hierarchy-reconciled-tbody");

  if (hRes.valid) {
    cohBadge.textContent = hRes.isCoherent ? `Coherent (Max Δ = ${hRes.maxCoherenceDiscrepancy.toExponential(1)})` : "Incoherent";
    hCallout.innerHTML = `
      <strong>Additive Reconciliation (${escapeHtml(hRes.reconciliationMethod.toUpperCase())}):</strong>
      Independent base models had an average additivity discrepancy of <code>${fmt(hRes.baseCoherenceDiscrepancies[0], 3)}</code> at h=1.
      After reconciliation, <code>Total ≡ North + South + West</code> holds across all horizons to within <code>${hRes.maxCoherenceDiscrepancy.toExponential(2)}</code>.
    `;
    renderHierarchyCanvas(
      document.getElementById("canvas-hierarchy"),
      hRes,
      hDs.observations,
      appState.hierarchySelectedNode,
      appState.isDark
    );
    hTbody.innerHTML = hRes.futureTimestamps.map((ts, h) => `
      <tr>
        <td>${escapeHtml(ts)} (h=${h + 1})</td>
        <td class="num">${fmt(hRes.baseForecasts.Total[h], 2)}</td>
        <td class="num" style="color:var(--color-secondary);">${fmt(hRes.baseCoherenceDiscrepancies[h], 3)}</td>
        <td class="num"><strong>${fmt(hRes.reconciledForecasts.Total[h], 2)}</strong></td>
        <td class="num">${fmt(hRes.reconciledForecasts.North_Region[h], 2)}</td>
        <td class="num">${fmt(hRes.reconciledForecasts.South_Region[h], 2)}</td>
        <td class="num">${fmt(hRes.reconciledForecasts.West_Region[h], 2)}</td>
      </tr>
    `).join("");
  }
}

/**
 * Update Workspace 7: Forecasting Atlas
 */
function renderAtlasCards() {
  const query = (document.getElementById("atlas-search-input")?.value || "").trim().toLowerCase();
  const catFilter = document.getElementById("atlas-category-filter")?.value || "all";
  const lvl = appState.explanationLevel;

  const filtered = ATLAS_TOPICS.filter(t => {
    const matchCat = catFilter === "all" || t.category.includes(catFilter) || (catFilter === "Baseline Models" && t.category.includes("Exponential"));
    const matchText = !query ||
      t.title.toLowerCase().includes(query) ||
      t.chapter.toLowerCase().includes(query) ||
      t.simple.toLowerCase().includes(query) ||
      t.standard.toLowerCase().includes(query) ||
      t.technical.toLowerCase().includes(query);
    return matchCat && matchText;
  });

  const container = document.getElementById("atlas-cards-container");
  container.innerHTML = filtered.map(t => {
    const statusClass = t.implementationStatus === "Fully Working Analytical Model"
      ? "status-ok"
      : (t.implementationStatus === "Working Interactive Demonstration" ? "status-warn" : "status-err");
    const bodyText = lvl === "simple" ? t.simple : (lvl === "standard" ? t.standard : t.technical);

    return `
      <article class="module-card" style="margin-bottom:0;">
        <div class="module-header">
          <div>
            <div class="mono" style="font-size:11px; color:var(--color-text-muted);">${escapeHtml(t.chapter)} · ${escapeHtml(t.category)}</div>
            <h3 class="module-title" style="font-size:16px;">${renderMathHTML(t.title)}</h3>
          </div>
          <span class="status-pill ${statusClass}">${escapeHtml(t.implementationStatus)}</span>
        </div>
        <div class="callout-box math-tex" style="margin-bottom:8px; font-family:var(--font-sans);">
          <strong>${lvl.toUpperCase()}:</strong> ${renderMathHTML(bodyText)}
        </div>
        <details class="compact-details" style="margin-bottom:8px;">
          <summary>Strengths, Limitations &amp; Common Pitfalls</summary>
          <div><strong>Strengths:</strong> ${t.strengths.map(renderMathHTML).join("; ")}</div>
          <div><strong>Limitations:</strong> ${t.limitations.map(renderMathHTML).join("; ")}</div>
          <div><strong>Pitfall:</strong> <span style="color:var(--color-secondary);">${t.commonErrors.map(renderMathHTML).join("; ")}</span></div>
        </details>
        <button type="button" class="btn btn-sm atlas-jump-btn" data-target="${t.targetWorkspace}">Open in ${t.targetWorkspace.toUpperCase()} Workspace →</button>
      </article>
    `;
  }).join("");
}

/**
 * Update Workspace 8: 18 Guided Forecasting Investigations
 */
function renderActiveInvestigation() {
  const selectEl = document.getElementById("lesson-select");
  if (selectEl && selectEl.options.length === 0) {
    selectEl.innerHTML = GUIDED_INVESTIGATIONS.map(l => `<option value="${l.id}">${escapeHtml(l.title)}</option>`).join("");
  }
  if (selectEl) selectEl.value = String(appState.activeLessonId);

  const lesson = GUIDED_INVESTIGATIONS.find(l => l.id === Number(appState.activeLessonId)) || GUIDED_INVESTIGATIONS[0];
  const lvl = appState.explanationLevel;
  const expText = lvl === "simple" ? lesson.simpleExplanation : (lvl === "standard" ? lesson.standardExplanation : lesson.technicalExplanation);

  const detailCard = document.getElementById("lesson-detail-card");
  detailCard.innerHTML = `
    <div class="callout-box">
      <div><strong>Objective:</strong> ${renderMathHTML(lesson.objective)}</div>
      <div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">Dataset: <code>${escapeHtml(PRESET_DATASETS[lesson.presetId]?.shortTitle || lesson.presetId)}</code> &middot; Models: <code>${lesson.primaryModel}</code> vs. <code>${lesson.comparisonModel}</code></div>
    </div>
    <p style="font-size:13px; margin:8px 0;"><strong>Try This:</strong> ${renderMathHTML(lesson.controlHint)}</p>
    <details class="compact-details" open>
      <summary>Mathematical &amp; Statistical Insight (${lvl.toUpperCase()})</summary>
      <div>${renderMathHTML(expText)}</div>
    </details>
  `;

  const quizContainer = document.getElementById("lesson-quiz-container");
  quizContainer.innerHTML = `
    <p style="font-weight:600; font-size:14px; margin-bottom:10px;">${renderMathHTML(lesson.question)}</p>
    <div style="display:grid; gap:8px; margin-bottom:12px;">
      ${lesson.options.map((opt, idx) => {
        const isSelected = appState.selectedQuizOption === idx;
        const isCorrect = idx === lesson.correctIndex;
        let borderStyle = "";
        if (isSelected) {
          borderStyle = isCorrect ? "border:2px solid var(--color-primary); background:var(--color-primary-soft);" : "border:2px solid var(--color-secondary); background:var(--color-secondary-soft);";
        }
        return `<button type="button" class="btn quiz-opt-btn" data-opt-idx="${idx}" style="justify-content:flex-start; text-align:left; padding:10px 12px; ${borderStyle}">
          <strong>${String.fromCharCode(65 + idx)}.</strong>&nbsp;<span>${renderMathHTML(opt)}</span>
        </button>`;
      }).join("")}
    </div>
    ${appState.selectedQuizOption !== null ? `
      <div class="callout-box ${appState.selectedQuizOption === lesson.correctIndex ? "" : "callout-danger"}">
        <strong>${appState.selectedQuizOption === lesson.correctIndex ? "✓ Correct!" : "✗ Re-examine the model mechanics:"}</strong>
        ${renderMathHTML(lesson.feedback)}
      </div>
    ` : ""}
  `;
}

/**
 * Update Workspace 9: Methods, Ecosystem & Privacy Audit
 */
function updateMethodsUI() {
  const audit = getPrivacyAndStorageAudit();
  const box = document.getElementById("privacy-audit-box");
  if (box) {
    box.innerHTML = `
      <strong>Live Privacy &amp; Local Storage Audit:</strong><br>
      • Client-Side Processing Only: <code>${audit.localFirstProcessing}</code> · External Network Requests: <code>${audit.externalNetworkCalls}</code> · Third-Party Trackers: <code>${audit.telemetryTrackers}</code><br>
      • Saved Browser Session Active: <code>${audit.hasStoredSession ? `Yes (${audit.storedBytes} bytes in ${audit.storageKey})` : "None (Ephemeral Memory Only)"}</code>
    `;
  }
}

/**
 * Download helper for exported files
 */
function triggerFileDownload(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported ${filename}`);
}

/**
 * Switch Active Workspace Tab
 */
function switchWorkspace(targetWs) {
  appState.activeWorkspace = targetWs;
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.workspace === targetWs);
  });
  document.querySelectorAll(".wf-step").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.wfTarget === targetWs);
  });
  document.querySelectorAll(".workspace-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `ws-${targetWs}`);
  });
  recomputeAll();
}

/**
 * Bind All DOM Event Listeners
 */
function bindAllEvents() {
  // Workspace Navigation Tabs & Workflow Steps
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.addEventListener("click", () => switchWorkspace(btn.dataset.workspace));
  });
  document.querySelectorAll(".wf-step").forEach(btn => {
    btn.addEventListener("click", () => switchWorkspace(btn.dataset.wfTarget));
  });

  // Global Preset Selector
  document.getElementById("global-preset-select")?.addEventListener("change", (e) => {
    loadPresetDataset(e.target.value, true);
  });

  // Explanation Level Switcher (Simple / Standard / Technical)
  document.querySelectorAll("[data-exp-level]").forEach(btn => {
    btn.addEventListener("click", () => {
      appState.explanationLevel = btn.dataset.expLevel;
      document.querySelectorAll("[data-exp-level]").forEach(b => b.classList.toggle("active", b === btn));
      recomputeAll();
    });
  });

  // Undo / Redo Buttons & Keyboard Shortcuts
  const performUndo = () => {
    if (appState.undoStack.length === 0) {
      showToast("Nothing to undo.");
      return;
    }
    appState.redoStack.push(JSON.stringify({
      presetId: appState.presetId,
      rawObservations: appState.rawObservations,
      modelType: appState.modelType,
      horizon: appState.horizon
    }));
    const prev = JSON.parse(appState.undoStack.pop());
    appState.presetId = prev.presetId;
    appState.rawObservations = prev.rawObservations;
    appState.modelType = prev.modelType;
    appState.horizon = prev.horizon;
    recomputeAll();
    showToast("Undid last change.");
  };

  const performRedo = () => {
    if (appState.redoStack.length === 0) {
      showToast("Nothing to redo.");
      return;
    }
    appState.undoStack.push(JSON.stringify({
      presetId: appState.presetId,
      rawObservations: appState.rawObservations,
      modelType: appState.modelType,
      horizon: appState.horizon
    }));
    const next = JSON.parse(appState.redoStack.pop());
    appState.presetId = next.presetId;
    appState.rawObservations = next.rawObservations;
    appState.modelType = next.modelType;
    appState.horizon = next.horizon;
    recomputeAll();
    showToast("Redid change.");
  };

  document.getElementById("btn-undo")?.addEventListener("click", performUndo);
  document.getElementById("btn-redo")?.addEventListener("click", performRedo);
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      performUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      performRedo();
    }
  });

  // Share State Hash Button
  document.getElementById("btn-share-url")?.addEventListener("click", () => {
    const hash = encodeStateToHash({
      presetId: appState.presetId,
      modelType: appState.modelType,
      horizon: appState.horizon,
      seasonalPeriod: appState.validation?.seasonalPeriod || 12,
      frequency: appState.validation?.inferredFrequency || "monthly",
      transformType: appState.transformType,
      boxCoxLambda: appState.boxCoxLambda,
      biasAdjust: appState.biasAdjust,
      explanationLevel: appState.explanationLevel,
      observations: appState.imputedObservations
    });
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", hash);
    }
    try {
      navigator.clipboard?.writeText(window.location.href);
    } catch (_e) {
      // Fallback handled silently
    }
    showToast("Workspace state encoded into URL hash!");
  });

  // Print Classroom FRQ Worksheet
  document.getElementById("btn-print-worksheet")?.addEventListener("click", () => {
    window.print();
  });

  // Theme Toggle
  document.getElementById("btn-theme-toggle")?.addEventListener("click", () => {
    appState.isDark = !appState.isDark;
    document.documentElement.setAttribute("data-theme", appState.isDark ? "dark" : "light");
    recomputeAll();
  });

  // Studio Model Configuration Controls
  document.getElementById("studio-model-select")?.addEventListener("change", (e) => {
    appState.modelType = e.target.value;
    recomputeAll();
  });

  document.getElementById("studio-horizon-slider")?.addEventListener("input", (e) => {
    appState.horizon = Number(e.target.value);
    document.getElementById("studio-horizon-val").textContent = `${appState.horizon} steps`;
    recomputeAll();
  });

  document.getElementById("studio-transform-select")?.addEventListener("change", (e) => {
    appState.transformType = e.target.value;
    recomputeAll();
  });

  document.getElementById("studio-lambda-slider")?.addEventListener("input", (e) => {
    appState.boxCoxLambda = Number(e.target.value);
    document.getElementById("studio-lambda-val").textContent = appState.boxCoxLambda.toFixed(2);
    recomputeAll();
  });

  document.getElementById("btn-auto-lambda")?.addEventListener("click", () => {
    const vals = appState.imputedObservations.map(o => o.value);
    const m = appState.validation?.seasonalPeriod || 12;
    const optL = estimateBoxCoxLambda(vals, m);
    appState.transformType = "boxcox";
    appState.boxCoxLambda = optL;
    document.getElementById("studio-transform-select").value = "boxcox";
    document.getElementById("studio-lambda-slider").value = String(optL);
    document.getElementById("studio-lambda-val").textContent = optL.toFixed(2);
    recomputeAll();
    showToast(`Guerrero optimal Box-Cox λ = ${optL.toFixed(2)} applied.`);
  });

  document.getElementById("studio-bias-adjust")?.addEventListener("change", (e) => {
    appState.biasAdjust = e.target.checked;
    recomputeAll();
  });

  document.getElementById("ets-optimize-toggle")?.addEventListener("change", (e) => {
    appState.etsOptimize = e.target.checked;
    recomputeAll();
  });

  ["alpha", "beta", "phi"].forEach(param => {
    document.getElementById(`ets-${param}-input`)?.addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (param === "alpha") appState.etsAlpha = val;
      if (param === "beta") appState.etsBeta = val;
      if (param === "phi") appState.etsPhi = val;
      document.getElementById(`ets-${param}-lbl`).textContent = val.toFixed(2);
      recomputeAll();
    });
  });

  ["p", "d", "q", "P", "D", "Q"].forEach(ord => {
    document.getElementById(`arima-${ord}`)?.addEventListener("change", (e) => {
      appState.arimaOrders[ord] = Number(e.target.value);
      recomputeAll();
    });
  });

  document.getElementById("reg-seasonal-type")?.addEventListener("change", (e) => {
    appState.regSeasonalType = e.target.value;
    recomputeAll();
  });

  document.getElementById("reg-fourier-k")?.addEventListener("input", (e) => {
    appState.regFourierK = Number(e.target.value);
    document.getElementById("reg-fourier-k-lbl").textContent = String(appState.regFourierK);
    recomputeAll();
  });

  document.getElementById("reg-use-intervention")?.addEventListener("change", (e) => {
    appState.regUseIntervention = e.target.checked;
    recomputeAll();
  });

  // Visual toggles
  document.getElementById("toggle-show-fitted")?.addEventListener("change", (e) => {
    appState.showFitted = e.target.checked;
    updateStudioUI();
  });
  document.getElementById("toggle-show-intervals")?.addEventListener("change", (e) => {
    appState.showIntervals = e.target.checked;
    updateStudioUI();
  });
  document.getElementById("toggle-show-holdout")?.addEventListener("change", (e) => {
    appState.showHoldout = e.target.checked;
    updateStudioUI();
  });
  document.getElementById("toggle-show-mean-ci")?.addEventListener("change", (e) => {
    appState.showMeanCI = e.target.checked;
    updateStudioUI();
  });
  document.getElementById("toggle-show-sim-paths")?.addEventListener("change", (e) => {
    appState.showSimPaths = e.target.checked;
    updateStudioUI();
  });
  document.getElementById("studio-pi-level-select")?.addEventListener("change", (e) => {
    const parts = String(e.target.value).split("_").map(Number);
    if (parts.length === 2) appState.piLevels = parts;
    recomputeAll();
  });
  document.getElementById("btn-diag-4panel")?.addEventListener("click", () => {
    appState.diagViewMode = "4panel";
    document.getElementById("btn-diag-4panel")?.classList.add("active");
    document.getElementById("btn-diag-actual-fitted")?.classList.remove("active");
    updateStudioUI();
  });
  document.getElementById("btn-diag-actual-fitted")?.addEventListener("click", () => {
    appState.diagViewMode = "actual_fitted";
    document.getElementById("btn-diag-actual-fitted")?.classList.add("active");
    document.getElementById("btn-diag-4panel")?.classList.remove("active");
    updateStudioUI();
  });
  document.getElementById("btn-export-png")?.addEventListener("click", () => {
    const c = document.getElementById("canvas-main-forecast");
    if (!c) return;
    const dataUrl = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${appState.presetId}_forecast.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Exported ${appState.presetId}_forecast.png`);
  });

  document.getElementById("studio-zoom-slider")?.addEventListener("input", (e) => {
    appState.zoomStartPct = Number(e.target.value);
    document.getElementById("studio-zoom-lbl").textContent = appState.zoomStartPct === 0 ? "Full Series" : `Last ${100 - appState.zoomStartPct}%`;
    updateStudioUI();
  });

  document.getElementById("btn-open-upload")?.addEventListener("click", () => switchWorkspace("understand"));
  document.getElementById("btn-export-svg")?.addEventListener("click", () => {
    const svg = exportForecastChartToSVG(appState.imputedObservations, appState.primaryFit, appState.datasetMeta.title);
    triggerFileDownload(`${appState.presetId}_forecast.svg`, svg, "image/svg+xml;charset=utf-8");
  });

  // Interactive Canvas Pointer Hover & Direct Observation Dragging
  const mainCanvas = document.getElementById("canvas-main-forecast");
  let isDraggingPoint = false;
  let draggedPointIndex = null;

  mainCanvas?.addEventListener("pointerdown", (e) => {
    const proj = appState.mainChartProjection;
    if (!proj) return;
    const rect = mainCanvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const idx = proj.toStepIndex(px);
    if (idx >= 0 && idx < appState.rawObservations.length) {
      const obsVal = appState.imputedObservations[idx]?.value;
      if (obsVal !== null && Math.abs(proj.toScreenY(obsVal) - py) <= 16) {
        pushUndoSnapshot();
        isDraggingPoint = true;
        draggedPointIndex = idx;
        mainCanvas.setPointerCapture?.(e.pointerId);
      }
    }
  });

  mainCanvas?.addEventListener("pointermove", (e) => {
    const proj = appState.mainChartProjection;
    if (!proj) return;
    const rect = mainCanvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (isDraggingPoint && draggedPointIndex !== null) {
      const newVal = Math.round(proj.toDataY(py) * 100) / 100;
      appState.rawObservations[draggedPointIndex].value = newVal;
      recomputeAll();
      return;
    }

    const stepIdx = proj.toStepIndex(px);
    if (stepIdx >= proj.startStep && stepIdx < proj.totalSteps) {
      appState.hoverIndex = stepIdx;
      const T = appState.imputedObservations.length;
      const readoutEl = document.getElementById("canvas-hover-readout");
      if (stepIdx < T) {
        const obs = appState.imputedObservations[stepIdx];
        const fv = appState.primaryFit?.fittedValues?.[stepIdx];
        readoutEl.textContent = `${obs.timestamp}: Actual y = ${fmt(obs.value, 2)} | Fitted ŷ = ${fmt(fv, 2)}`;
      } else if (appState.primaryFit?.valid) {
        const h = stepIdx - T;
        const pt = appState.primaryFit.pointForecasts[h];
        const b95 = appState.primaryFit.intervals?.[95]?.[h] || [null, null];
        readoutEl.textContent = `Forecast ${appState.primaryFit.futureTimestamps[h]} (h=${h + 1}): ŷ = ${fmt(pt, 2)} | 95% PI [${fmt(b95[0], 1)}, ${fmt(b95[1], 1)}]`;
      }
      updateStudioUI();
    }
  });

  window.addEventListener("pointerup", () => {
    isDraggingPoint = false;
    draggedPointIndex = null;
  });

  // One-click exports in Studio
  document.querySelectorAll("[data-export]").forEach(btn => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.export;
      const fit = appState.primaryFit;
      const obs = appState.imputedObservations;
      if (kind === "csv") {
        triggerFileDownload(`${appState.presetId}_forecasts.csv`, exportForecastToCSV(obs, fit, appState.activeScenarioResult), "text/csv;charset=utf-8");
      } else if (kind === "datasense-json") {
        triggerFileDownload(`${appState.presetId}_datasense_forecast.json`, exportToDataSenseForecastJSON(appState.datasetMeta, fit, appState.holdoutResult?.metrics), "application/json");
      } else if (kind === "r-script") {
        triggerFileDownload(`${appState.presetId}_fable.R`, exportToRScript(appState.datasetMeta, obs, fit));
      } else if (kind === "py-script") {
        triggerFileDownload(`${appState.presetId}_statsmodels.py`, exportToPythonScript(appState.datasetMeta, obs, fit));
      } else if (kind === "latex") {
        if (appState.comparisonResults.length === 0) runModelComparisonSuite();
        triggerFileDownload(`${appState.presetId}_table.tex`, exportToLaTeXTable(appState.comparisonResults, fit));
      } else if (kind === "report") {
        triggerFileDownload(`${appState.presetId}_forecast_report.md`, exportReadableReport(appState.datasetMeta, appState.validation, fit, appState.holdoutResult));
      }
    });
  });

  // Workspace 2: Understand Your Series Events
  document.getElementById("btn-parse-csv")?.addEventListener("click", () => {
    ++importGeneration;
    const raw = document.getElementById("raw-csv-textarea")?.value || "";
    const parsed = parseDelimitedText(raw);
    setImportError();
    if (!parsed.valid) {
      setImportError(parsed.errors[0] || "Failed to parse CSV.");
      return;
    }
    pushUndoSnapshot();
    appState.presetId = "custom_series";
    appState.datasetMeta = {
      id: "custom_series",
      title: "User Imported Time Series",
      unit: "Units",
      hasPredictors: Object.keys(parsed.observations[0]?.predictors || {}).length > 0,
      predictorNames: Object.keys(parsed.observations[0]?.predictors || {})
    };
    appState.rawObservations = parsed.observations;
    recomputeAll();
    showToast(`Imported ${parsed.observations.length} observations.`);
  });

  document.getElementById("file-upload-input")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const generation = ++importGeneration;
    try { assertInputSize(file.size); } catch (error) { setImportError(error.message); return; }
    setImportError(`Reading ${file.name} locally…`, "loading");
    const reader = new FileReader();
    reader.onerror = () => generation === importGeneration && setImportError("The file could not be read. Select it again or paste its contents below.");
    reader.onload = () => {
      if (generation !== importGeneration) return;
      setImportError();
      const text = String(reader.result || "");
      if (file.name.toLowerCase().endsWith(".json")) {
        let parsed;
        try { parsed = parseObservationJSON(text); }
        catch (error) { setImportError(error.message); return; }
        pushUndoSnapshot();
        appState.presetId = parsed.metadata.id;
        appState.datasetMeta = parsed.metadata;
        appState.rawObservations = parsed.observations;
        recomputeAll();
        showToast(`Loaded DataSense JSON (${parsed.observations.length} observations).`);
        return;
      }
      document.getElementById("raw-csv-textarea").value = text;
      document.getElementById("btn-parse-csv").click();
    };
    reader.readAsText(file);
  });

  document.getElementById("val-freq-override")?.addEventListener("change", (e) => {
    appState.frequencyOverride = e.target.value;
    recomputeAll();
  });
  document.getElementById("val-m-override")?.addEventListener("change", (e) => {
    appState.seasonalPeriodOverride = Math.max(1, Number(e.target.value));
    recomputeAll();
  });
  document.getElementById("val-impute-select")?.addEventListener("change", (e) => {
    appState.imputationMethod = e.target.value;
    recomputeAll();
  });

  document.getElementById("btn-add-observation")?.addEventListener("click", () => {
    pushUndoSnapshot();
    const lastObs = appState.rawObservations[appState.rawObservations.length - 1];
    appState.rawObservations.push({
      obs_id: `t_${appState.rawObservations.length + 1}`,
      timestamp: `${lastObs?.timestamp || "t"}_next`,
      value: lastObs?.value ?? 100
    });
    recomputeAll();
  });

  // Delegated inline editing on Observation Grid
  document.getElementById("understand-obs-tbody")?.addEventListener("change", (e) => {
    const target = e.target;
    const idx = Number(target.dataset.idx);
    if (!Number.isFinite(idx) || !appState.rawObservations[idx]) return;
    pushUndoSnapshot();
    if (target.classList.contains("obs-ts-input")) {
      appState.rawObservations[idx].timestamp = target.value;
    } else if (target.classList.contains("obs-val-input")) {
      appState.rawObservations[idx].value = target.value === "" ? null : Number(target.value);
    }
    recomputeAll();
  });

  document.getElementById("understand-obs-tbody")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".obs-del-btn");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    if (appState.rawObservations.length <= 3) {
      showToast("Cannot delete: at least 3 observations are required.");
      return;
    }
    pushUndoSnapshot();
    appState.rawObservations.splice(idx, 1);
    recomputeAll();
  });

  // Workspace 3: Time-Series Laboratory Events
  document.getElementById("decomp-method-select")?.addEventListener("change", (e) => {
    appState.decompMethod = e.target.value;
    updateLabUI();
  });
  document.getElementById("decomp-t-window")?.addEventListener("input", (e) => {
    appState.decompTWindow = Number(e.target.value);
    document.getElementById("decomp-t-window-lbl").textContent = String(appState.decompTWindow);
    updateLabUI();
  });
  document.getElementById("btn-view-seasonal")?.addEventListener("click", () => {
    appState.seasonalViewMode = "seasonal";
    document.getElementById("btn-view-seasonal")?.classList.add("active");
    document.getElementById("btn-view-subseries")?.classList.remove("active");
    document.getElementById("btn-view-heatmap")?.classList.remove("active");
    updateLabUI();
  });
  document.getElementById("decomp-sa-toggle")?.addEventListener("change", (e) => {
    appState.decompShowSA = e.target.checked;
    updateLabUI();
  });
  document.getElementById("btn-view-subseries")?.addEventListener("click", () => {
    appState.seasonalViewMode = "subseries";
    document.getElementById("btn-view-subseries")?.classList.add("active");
    document.getElementById("btn-view-seasonal")?.classList.remove("active");
    document.getElementById("btn-view-heatmap")?.classList.remove("active");
    updateLabUI();
  });
  document.getElementById("btn-view-heatmap")?.addEventListener("click", () => {
    appState.seasonalViewMode = "heatmap";
    document.getElementById("btn-view-heatmap")?.classList.add("active");
    document.getElementById("btn-view-seasonal")?.classList.remove("active");
    document.getElementById("btn-view-subseries")?.classList.remove("active");
    updateLabUI();
  });
  document.getElementById("wn-mode-select")?.addEventListener("change", (e) => {
    appState.wnMode = e.target.value;
    updateLabUI();
  });
  document.getElementById("btn-resimulate-wn")?.addEventListener("click", () => {
    appState.wnSeed = (appState.wnSeed + 104729) >>> 0;
    updateLabUI();
  });
  document.getElementById("hier-node-select")?.addEventListener("change", (e) => {
    appState.hierarchySelectedNode = e.target.value;
    updateScenariosAndHierarchyUI();
  });
  document.getElementById("lab-lag-slider")?.addEventListener("input", (e) => {
    appState.lagK = Number(e.target.value);
    document.getElementById("lab-lag-lbl").textContent = `k = ${appState.lagK}`;
    updateLabUI();
  });

  // Workspace 4: Model Comparison Events
  document.getElementById("btn-run-comparison")?.addEventListener("click", () => {
    runModelComparisonSuite();
    showToast("Completed out-of-sample model comparison.");
  });
  document.getElementById("btn-export-comp-csv")?.addEventListener("click", () => {
    if (appState.comparisonResults.length === 0) runModelComparisonSuite();
    triggerFileDownload(`${appState.presetId}_model_comparison.csv`, exportComparisonToCSV(appState.comparisonResults), "text/csv;charset=utf-8");
  });
  document.getElementById("comparison-scorecard-tbody")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".select-comp-model-btn");
    if (!btn) return;
    appState.modelType = btn.dataset.model;
    document.getElementById("studio-model-select").value = appState.modelType;
    switchWorkspace("studio");
  });

  // Workspace 5: Evaluation & Backtesting Events
  document.getElementById("eval-window-type")?.addEventListener("change", (e) => {
    appState.evalWindowType = e.target.value;
    runEvaluationSuite();
  });
  document.getElementById("eval-init-slider")?.addEventListener("input", (e) => {
    appState.evalInitPct = Number(e.target.value);
    document.getElementById("eval-init-lbl").textContent = `${appState.evalInitPct}% of series`;
    runEvaluationSuite();
  });
  document.getElementById("eval-horizon-input")?.addEventListener("change", (e) => {
    appState.evalHorizon = Math.max(1, Number(e.target.value));
    runEvaluationSuite();
  });
  document.getElementById("eval-step-input")?.addEventListener("change", (e) => {
    appState.evalStepSize = Math.max(1, Number(e.target.value));
    runEvaluationSuite();
  });
  document.getElementById("eval-leakage-guard")?.addEventListener("change", (e) => {
    appState.evalLeakageGuard = e.target.checked;
    runEvaluationSuite();
  });
  document.getElementById("btn-run-backtest")?.addEventListener("click", () => {
    runEvaluationSuite();
    showToast("Rolling-origin cross-validation updated.");
  });

  // Workspace 6: Scenarios & Hierarchy Events
  document.getElementById("scenario-preset-select")?.addEventListener("change", (e) => {
    const val = e.target.value;
    appState.scenarioPreset = val;
    const amtInput = document.getElementById("scenario-amount-input");
    const reasonInput = document.getElementById("scenario-reason-input");
    if (val === "optimistic") {
      amtInput.value = "8";
      reasonInput.value = "Optimistic demand expansion (+8% scaling override)";
    } else if (val === "pessimistic") {
      amtInput.value = "-8";
      reasonInput.value = "Macro contraction scenario (-8% scaling override)";
    } else if (val === "level_shift") {
      amtInput.value = "15";
      reasonInput.value = "Scheduled capacity commissioning (+15 units level shift)";
    } else {
      amtInput.value = "0";
      reasonInput.value = "Baseline statistical forecast retained without override.";
    }
  });

  document.getElementById("btn-apply-scenario")?.addEventListener("click", () => {
    const preset = document.getElementById("scenario-preset-select").value;
    const amount = Number(document.getElementById("scenario-amount-input").value || 0);
    const author = document.getElementById("scenario-author-input").value || "Analyst";
    const reason = document.getElementById("scenario-reason-input").value || "Scenario adjustment";
    const enforceNonNegative = document.getElementById("scenario-nonnegative").checked;

    const adjType = preset === "level_shift" ? "level_shift" : (preset === "baseline" && amount === 0 ? "none" : "percent_scaling");
    appState.activeScenarioResult = buildScenarioForecast(appState.primaryFit, {
      name: preset.toUpperCase(),
      adjustmentType: adjType,
      amount,
      author,
      reason,
      enforceNonNegative
    });
    updateScenariosAndHierarchyUI();
    updateStudioUI();
    showToast("Scenario applied and overlaid in Forecast Studio.");
  });

  document.getElementById("btn-reset-scenario")?.addEventListener("click", () => {
    appState.activeScenarioResult = null;
    updateScenariosAndHierarchyUI();
    updateStudioUI();
    showToast("Reset to unadjusted statistical forecast.");
  });

  document.getElementById("hier-method-select")?.addEventListener("change", (e) => {
    appState.hierarchyMethod = e.target.value;
    updateScenariosAndHierarchyUI();
  });
  document.getElementById("hier-base-model")?.addEventListener("change", (e) => {
    appState.hierarchyBaseModel = e.target.value;
    updateScenariosAndHierarchyUI();
  });
  document.getElementById("btn-run-hierarchy")?.addEventListener("click", () => {
    updateScenariosAndHierarchyUI();
    showToast("Hierarchical reconciliation verified.");
  });

  // Workspace 7: Atlas Search & Filter Events
  document.getElementById("atlas-search-input")?.addEventListener("input", renderAtlasCards);
  document.getElementById("atlas-category-filter")?.addEventListener("change", renderAtlasCards);
  document.getElementById("atlas-cards-container")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".atlas-jump-btn");
    if (!btn) return;
    switchWorkspace(btn.dataset.target || "studio");
  });

  // Workspace 8: Guided Investigations Events
  document.getElementById("lesson-select")?.addEventListener("change", (e) => {
    appState.activeLessonId = Number(e.target.value);
    appState.selectedQuizOption = null;
    renderActiveInvestigation();
  });
  document.getElementById("lesson-quiz-container")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".quiz-opt-btn");
    if (!btn) return;
    appState.selectedQuizOption = Number(btn.dataset.optIdx);
    renderActiveInvestigation();
  });
  document.getElementById("btn-launch-lesson-studio")?.addEventListener("click", () => {
    const lesson = GUIDED_INVESTIGATIONS.find(l => l.id === Number(appState.activeLessonId)) || GUIDED_INVESTIGATIONS[0];
    loadPresetDataset(lesson.presetId, true);
    appState.modelType = lesson.primaryModel;
    appState.horizon = lesson.horizon;
    document.getElementById("studio-model-select").value = appState.modelType;
    document.getElementById("studio-horizon-slider").value = String(appState.horizon);
    document.getElementById("studio-horizon-val").textContent = `${appState.horizon} steps`;
    switchWorkspace("studio");
    showToast(`Loaded Lesson ${lesson.id} configuration into Forecast Studio.`);
  });

  // Workspace 9: Cross-App Handoff & Storage Events
  document.querySelectorAll("[data-handoff]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetApp = btn.dataset.handoff;
      const decomp = stlDecomposition(
        appState.imputedObservations.map(o => o.value),
        appState.validation?.seasonalPeriod || 12
      );
      const payload = exportCrossAppInterchangeJSON(
        targetApp,
        appState.datasetMeta,
        appState.imputedObservations,
        appState.primaryFit,
        decomp
      );
      triggerFileDownload(`forecastlab_to_${targetApp.toLowerCase()}.json`, payload, "application/json");
    });
  });

  document.getElementById("btn-save-local-session")?.addEventListener("click", () => {
    saveSessionToStorage({
      presetId: appState.presetId,
      modelType: appState.modelType,
      horizon: appState.horizon,
      observations: appState.rawObservations
    });
    updateMethodsUI();
    showToast("Session saved to browser localStorage.");
  });

  document.getElementById("btn-clear-local-session")?.addEventListener("click", () => {
    clearSessionStorage();
    updateMethodsUI();
    showToast("Cleared saved session from browser localStorage.");
  });

  // Responsive canvas redraw
  window.addEventListener("resize", () => {
    recomputeAll();
  });
}

function fmt(val, digits = 2) {
  if (val === null || val === undefined || !Number.isFinite(Number(val))) return "---";
  return Number(val).toFixed(digits);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Zero-dependency LaTeX & mathematical notation to semantic HTML typesetter
 */
function renderMathHTML(input) {
  if (!input) return "";
  let s = escapeHtml(input);

  s = s.replace(/\\\{/g, "&#123;").replace(/\\\}/g, "&#125;").replace(/\\\|/g, "&Vert;");
  s = s.replace(/\\\(|\\\)|\\\[|\\\]/g, "");
  s = s.replace(/\\left\s*/g, "").replace(/\\right\s*/g, "");
  s = s.replace(/\\quad/g, " &nbsp; ").replace(/\\;/g, " ").replace(/\\,/g, "&#8239;");

  function replaceMacro1(str, cmd, replacer) {
    const token = "\\" + cmd + "{";
    let idx = str.indexOf(token);
    while (idx !== -1) {
      let start = idx + token.length;
      let depth = 1;
      let i = start;
      while (i < str.length && depth > 0) {
        if (str[i] === "{") depth++;
        else if (str[i] === "}") depth--;
        i++;
      }
      if (depth === 0) {
        const inner = str.slice(start, i - 1);
        const rep = replacer(inner);
        str = str.slice(0, idx) + rep + str.slice(i);
        idx = str.indexOf(token, idx + rep.length);
      } else {
        break;
      }
    }
    return str;
  }

  function replaceMacro2(str, cmd, replacer) {
    const token = "\\" + cmd + "{";
    let idx = str.indexOf(token);
    while (idx !== -1) {
      let start1 = idx + token.length;
      let depth = 1;
      let i = start1;
      while (i < str.length && depth > 0) {
        if (str[i] === "{") depth++;
        else if (str[i] === "}") depth--;
        i++;
      }
      if (depth !== 0) break;
      const arg1 = str.slice(start1, i - 1);
      while (i < str.length && str[i] === " ") i++;
      if (str[i] !== "{") {
        idx = str.indexOf(token, i);
        continue;
      }
      let start2 = i + 1;
      depth = 1;
      let j = start2;
      while (j < str.length && depth > 0) {
        if (str[j] === "{") depth++;
        else if (str[j] === "}") depth--;
        j++;
      }
      if (depth !== 0) break;
      const arg2 = str.slice(start2, j - 1);
      const rep = replacer(arg1, arg2);
      str = str.slice(0, idx) + rep + str.slice(j);
      idx = str.indexOf(token, idx + rep.length);
    }
    return str;
  }

  for (let pass = 0; pass < 3; pass++) {
    s = replaceMacro1(s, "widehat", (x) => `${x}&#770;`);
    s = replaceMacro1(s, "hat", (x) => `${x}&#770;`);
    s = replaceMacro1(s, "bar", (x) => `${x}&#772;`);
    s = replaceMacro1(s, "tilde", (x) => `${x}&#771;`);
    s = replaceMacro1(s, "boldsymbol", (x) => `<strong>${x}</strong>`);
    s = replaceMacro1(s, "mathbf", (x) => `<strong>${x}</strong>`);
    s = replaceMacro1(s, "mathcal", (x) => {
      const map = { I: "&#8464;", M: "&#8499;", N: "&#119977;", L: "&#8466;" };
      return map[x] || `<em>${x}</em>`;
    });
    s = replaceMacro1(s, "mathbb", (x) => {
      const map = { E: "&#120124;", I: "&#120128;", R: "&#8477;", Z: "&#8484;" };
      return map[x] || `<strong>${x}</strong>`;
    });
    s = replaceMacro1(s, "operatorname", (x) => `<span class="math-op">${x}</span>`);
    s = replaceMacro1(s, "text", (x) => `<span class="math-op">${x}</span>`);
    s = replaceMacro1(s, "xrightarrow", (x) => `&rarr;<sup>${x}</sup>`);
    s = replaceMacro1(s, "sqrt", (x) => `&radic;<span class="math-sqrt">${x}</span>`);
    s = replaceMacro2(s, "frac", (a, b) => `<span class="math-frac"><span class="math-num">${a}</span><span class="math-den">${b}</span></span>`);
  }

  const symbols = [
    ["\\varepsilon", "&epsilon;"],
    ["\\alpha", "&alpha;"],
    ["\\beta", "&beta;"],
    ["\\gamma", "&gamma;"],
    ["\\delta", "&delta;"],
    ["\\Delta", "&Delta;"],
    ["\\eta", "&eta;"],
    ["\\theta", "&theta;"],
    ["\\Theta", "&Theta;"],
    ["\\lambda", "&lambda;"],
    ["\\mu", "&mu;"],
    ["\\pi", "&pi;"],
    ["\\rho", "&rho;"],
    ["\\sigma", "&sigma;"],
    ["\\tau", "&tau;"],
    ["\\phi", "&#981;"],
    ["\\Phi", "&Phi;"],
    ["\\chi", "&chi;"],
    ["\\psi", "&psi;"],
    ["\\Psi", "&Psi;"],
    ["\\omega", "&omega;"],
    ["\\Omega", "&Omega;"],
    ["\\ell", "&#8467;"],
    ["\\nabla", "&nabla;"],
    ["\\sum", "&sum;"],
    ["\\prod", "&prod;"],
    ["\\infty", "&infin;"],
    ["\\lfloor", "&lfloor;"],
    ["\\rfloor", "&rfloor;"],
    ["\\dots", "&hellip;"],
    ["\\cdots", "&ctdot;"],
    ["\\pm", "&plusmn;"],
    ["\\le", "&le;"],
    ["\\ge", "&ge;"],
    ["\\neq", "&ne;"],
    ["\\approx", "&approx;"],
    ["\\equiv", "&equiv;"],
    ["\\sim", "&sim;"],
    ["\\in", "&isin;"],
    ["\\cup", "&cup;"],
    ["\\to", "&rarr;"],
    ["\\mid", " | "],
    ["\\bullet", "&bull;"],
    ["\\bmod", " mod "],
    ["\\pmod", " mod "],
    ["\\min", '<span class="math-op">min</span>'],
    ["\\max", '<span class="math-op">max</span>'],
    ["\\ln", '<span class="math-op">ln</span>'],
    ["\\log", '<span class="math-op">log</span>'],
    ["\\exp", '<span class="math-op">exp</span>'],
    ["\\sin", '<span class="math-op">sin</span>'],
    ["\\cos", '<span class="math-op">cos</span>']
  ];
  for (const [k, v] of symbols) {
    s = s.split(k).join(v);
  }

  s = s.replace(/\bsqrt\(([^()]+)\)/g, '&radic;<span class="math-sqrt">$1</span>')
       .replace(/-\&gt;/g, "&rarr;")
       .replace(/!=/g, "&ne;")
       .replace(/&lt;=/g, "&le;")
       .replace(/&gt;=/g, "&ge;")
       .replace(/\b([ybw])_hat/g, "$1&#770;")
       .replace(/\b([ybw])_tilde/g, "$1&#771;")
       .replace(/\bt_break\b/g, "t<sub>break</sub>")
       .replace(/\btrend_t2\b/g, "t<sup>2</sup> (Quadratic Trend)")
       .replace(/\btrend_t\b/g, "t (Linear Trend)")
       .replace(/\bseason_(\d+)\b/g, "Season<sub>$1</sub>")
       .replace(/\bsin_k(\d+)\b/g, "sin(2&pi;&middot;$1t/m)")
       .replace(/\bcos_k(\d+)\b/g, "cos(2&pi;&middot;$1t/m)")
       .replace(/\bintervention_step_t(\d+)\b/g, "Step<sub>t&ge;$1</sub>");

  for (let pass = 0; pass < 2; pass++) {
    s = s.replace(/_\{([^{}]+)\}/g, "<sub>$1</sub>");
    s = s.replace(/\^\{([^{}]+)\}/g, "<sup>$1</sup>");
  }
  s = s.replace(/_(&#[0-9]+;|&[a-zA-Z0-9]+;|[a-zA-Z0-9*+\-])(?![a-zA-Z0-9])/g, "<sub>$1</sub>");
  s = s.replace(/\^(&#[0-9]+;|&[a-zA-Z0-9]+;|[a-zA-Z0-9*+\-])(?![a-zA-Z0-9])/g, "<sup>$1</sup>");

  return s;
}

/**
 * Initialize ForecastLab on DOM Ready
 */
function initForecastLab() {
  bindAllEvents();

  // Check URL Hash State first, then saved localStorage session, else default preset
  const hashDecoded = decodeStateFromHash(window.location.hash);
  if (hashDecoded && Array.isArray(hashDecoded.observations) && hashDecoded.observations.length >= 3) {
    appState.presetId = hashDecoded.presetId;
    appState.modelType = hashDecoded.modelType;
    appState.horizon = hashDecoded.horizon;
    appState.seasonalPeriodOverride = hashDecoded.seasonalPeriod;
    appState.frequencyOverride = hashDecoded.frequency;
    appState.transformType = hashDecoded.transformType;
    appState.boxCoxLambda = hashDecoded.boxCoxLambda;
    appState.biasAdjust = hashDecoded.biasAdjust;
    appState.explanationLevel = hashDecoded.explanationLevel;
    appState.rawObservations = hashDecoded.observations;
    recomputeAll();
    return;
  }

  const saved = loadSessionFromStorage();
  if (saved && Array.isArray(saved.observations) && saved.observations.length >= 3) {
    appState.presetId = saved.presetId || "airline_passengers";
    appState.modelType = saved.modelType || "ETS_MAM";
    appState.horizon = saved.horizon || 12;
    appState.rawObservations = saved.observations;
    recomputeAll();
    return;
  }

  loadPresetDataset("airline_passengers", false);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initForecastLab);
  } else {
    initForecastLab();
  }
}
