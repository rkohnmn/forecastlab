/**
 * ForecastLab High-DPI Canvas 2D & Vector SVG Visualization Engine
 *
 * Complies with:
 * - DESIGN.md (Bell Labs statistical monograph + HP benchtop instrument aesthetic)
 * - VISUALIZATION_STANDARDS.md (Perceptual hierarchy, CVD safety, explicit interval labels)
 */

import { computeUnivariateStats, computeACF, inverseNormalCDF } from "./math-engine.js";

export function getThemePalette(isDark = false) {
  if (isDark) {
    return {
      bg: "#0D1014",
      surface: "#151921",
      gridMajor: "rgba(216, 212, 200, 0.14)",
      gridMinor: "rgba(216, 212, 200, 0.06)",
      text: "#F3F4F6",
      textMuted: "#9CA3AF",
      border: "#2A303C",
      observed: "#E5E7EB",
      primary: "#34D399",      // Phosphor Emerald
      primaryRibbon80: "rgba(52, 211, 153, 0.25)",
      primaryRibbon95: "rgba(52, 211, 153, 0.12)",
      secondary: "#F87171",    // Vermilion
      warning: "#F59E0B",      // Amber
      accent: "#60A5FA",       // Blue
      altModel1: "#60A5FA",
      altModel2: "#A78BFA",
      altModel3: "#FBBF24",
      meanCI: "rgba(96, 165, 250, 0.24)"
    };
  }
  return {
    bg: "#F6F4EE",
    surface: "#FFFFFF",
    gridMajor: "rgba(20, 22, 25, 0.10)",
    gridMinor: "rgba(20, 22, 25, 0.04)",
    text: "#141619",
    textMuted: "#525866",
    border: "#D8D4C8",
    observed: "#141619",
    primary: "#0F6E56",        // Phosphor Emerald
    primaryRibbon80: "rgba(15, 110, 86, 0.24)",
    primaryRibbon95: "rgba(15, 110, 86, 0.11)",
    secondary: "#D9381E",      // Vermilion
    warning: "#B45309",        // Amber
    accent: "#1D4ED8",         // Blue
    altModel1: "#1D4ED8",
    altModel2: "#7C3AED",
    altModel3: "#D97706",
    meanCI: "rgba(29, 78, 216, 0.20)"
  };
}

/**
 * Prepare High-DPI 2D Canvas context
 */
export function setupHighDPICanvas(canvas) {
  if (!canvas) return null;
  const dpr = Math.min(2.5, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(300, Math.floor(rect.width || canvas.width || 720));
  const height = Math.max(180, Math.floor(rect.height || canvas.height || 360));
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height, dpr };
}

/**
 * Primary Time-Series, Fitted Model, Prediction Interval Fan & Multi-Model Overlay Plot
 */
export function renderMainForecastCanvas(canvas, renderState = {}) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return null;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(renderState.isDark);

  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  const observations = renderState.observations || [];
  const primaryFit = renderState.primaryFit || null;
  const comparisonFits = renderState.comparisonFits || [];
  const scenarioResult = renderState.scenarioResult || null;
  const holdoutResult = renderState.holdoutResult || null;
  const showFitted = renderState.showFitted !== false;
  const showIntervals = renderState.showIntervals !== false;
  const showMeanCI = Boolean(renderState.showMeanCI);
  const hoverIndex = renderState.hoverIndex ?? null;
  const zoomStartPct = Math.max(0, Math.min(0.9, Number(renderState.zoomStartPct || 0)));

  const T = observations.length;
  const H = primaryFit && primaryFit.valid ? primaryFit.horizon : 0;
  const totalSteps = T + H;
  if (T === 0) {
    ctx.fillStyle = pal.textMuted;
    ctx.font = "13px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No time-series observations loaded.", width / 2, height / 2);
    return null;
  }

  const startStep = Math.floor(T * zoomStartPct);
  const visibleSteps = Math.max(2, totalSteps - startStep);

  const pad = { top: 34, right: 26, bottom: 42, left: 64 };
  const plotW = Math.max(100, width - pad.left - pad.right);
  const plotH = Math.max(80, height - pad.top - pad.bottom);

  // Determine vertical bounds across visible historical, fitted, and interval values
  let yMin = Infinity;
  let yMax = -Infinity;
  const includeVal = (v) => {
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  };

  for (let t = startStep; t < T; t++) {
    includeVal(observations[t].value);
    if (showFitted && primaryFit?.valid) includeVal(primaryFit.fittedValues[t]);
  }
  if (primaryFit?.valid) {
    for (let h = 0; h < H; h++) {
      includeVal(primaryFit.pointForecasts[h]);
      const inLvl = renderState.innerLevel || 80;
      const outLvl = renderState.outerLevel || 95;
      if (showIntervals && primaryFit.intervals?.[outLvl]?.[h]) {
        includeVal(primaryFit.intervals[outLvl][h][0]);
        includeVal(primaryFit.intervals[outLvl][h][1]);
      }
      if (showIntervals && primaryFit.intervals?.[inLvl]?.[h]) {
        includeVal(primaryFit.intervals[inLvl][h][0]);
        includeVal(primaryFit.intervals[inLvl][h][1]);
      }
    }
  }
  for (const cf of comparisonFits) {
    if (cf?.valid) {
      cf.pointForecasts.forEach(includeVal);
    }
  }
  if (scenarioResult?.valid) {
    scenarioResult.adjustedPointForecasts.forEach(includeVal);
  }

  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = 0;
    yMax = 100;
  }
  if (Math.abs(yMax - yMin) < 1e-6) {
    yMin -= 5;
    yMax += 5;
  } else {
    const padY = (yMax - yMin) * 0.10;
    yMin -= padY;
    yMax += padY;
  }

  const toScreenX = (stepIdx) => pad.left + ((stepIdx - startStep) / Math.max(1, visibleSteps - 1)) * plotW;
  const toScreenY = (val) => pad.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
  const toDataY = (py) => yMin + ((pad.top + plotH - py) / plotH) * (yMax - yMin);
  const toStepIndex = (px) => Math.round(startStep + ((px - pad.left) / plotW) * (visibleSteps - 1));

  // Draw Gridlines & Axes
  ctx.strokeStyle = pal.gridMajor;
  ctx.lineWidth = 1;
  const yTicks = 5;
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.fillStyle = pal.textMuted;
  ctx.textAlign = "right";
  for (let i = 0; i <= yTicks; i++) {
    const v = yMin + (i / yTicks) * (yMax - yMin);
    const py = toScreenY(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(pad.left + plotW, py);
    ctx.stroke();
    ctx.fillText(formatAxisNumber(v), pad.left - 8, py + 4);
  }

  // X-axis timestamp ticks
  const allLabels = observations.map(o => o.timestamp).concat(primaryFit?.futureTimestamps || []);
  const xTickCount = Math.min(8, visibleSteps);
  ctx.textAlign = "center";
  for (let i = 0; i < xTickCount; i++) {
    const idx = Math.min(totalSteps - 1, Math.round(startStep + (i / Math.max(1, xTickCount - 1)) * (visibleSteps - 1)));
    const px = toScreenX(idx);
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, pad.top + plotH);
    ctx.strokeStyle = pal.gridMinor;
    ctx.stroke();
    ctx.fillStyle = idx >= T ? pal.primary : pal.textMuted;
    ctx.fillText(allLabels[idx] || String(idx + 1), px, pad.top + plotH + 18);
  }

  // Y-axis unit label
  if (renderState.unit) {
    ctx.save();
    ctx.translate(15, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = "11px 'Inter', sans-serif";
    ctx.fillStyle = pal.textMuted;
    ctx.fillText(renderState.unit, 0, 0);
    ctx.restore();
  }

  // Forecast Origin Vertical Line (either T-1 or holdout splitIndex-1)
  const originIdx = holdoutResult?.valid ? holdoutResult.splitIndex - 1 : T - 1;
  if (originIdx >= startStep) {
    const ox = toScreenX(originIdx);
    ctx.save();
    ctx.strokeStyle = pal.warning;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(ox, pad.top);
    ctx.lineTo(ox, pad.top + plotH);
    ctx.stroke();
    ctx.fillStyle = pal.warning;
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(`Forecast Origin (${allLabels[originIdx] || "T"})`, ox - 6, pad.top + 14);
    ctx.restore();
  }

  // Draw Prediction Interval Ribbons (95% outer, 80% inner) starting from origin
  const activeFit = holdoutResult?.valid ? holdoutResult.fit : primaryFit;
  const fStartIdx = holdoutResult?.valid ? holdoutResult.splitIndex : T;
  if (activeFit?.valid && showIntervals) {
    const fLen = activeFit.pointForecasts.length;
    const drawRibbon = (levelKey, fillStyle) => {
      const bounds = activeFit.intervals?.[levelKey];
      if (!bounds || bounds.length === 0) return;
      ctx.save();
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      // Connect smoothly from last training observation
      const anchorVal = observations[fStartIdx - 1]?.value;
      if (anchorVal !== null && Number.isFinite(anchorVal)) {
        ctx.moveTo(toScreenX(fStartIdx - 1), toScreenY(anchorVal));
      } else {
        ctx.moveTo(toScreenX(fStartIdx), toScreenY(bounds[0][1]));
      }
      for (let h = 0; h < fLen; h++) {
        ctx.lineTo(toScreenX(fStartIdx + h), toScreenY(bounds[h][1]));
      }
      for (let h = fLen - 1; h >= 0; h--) {
        ctx.lineTo(toScreenX(fStartIdx + h), toScreenY(bounds[h][0]));
      }
      if (anchorVal !== null && Number.isFinite(anchorVal)) {
        ctx.lineTo(toScreenX(fStartIdx - 1), toScreenY(anchorVal));
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    const inLvl = renderState.innerLevel || 80;
    const outLvl = renderState.outerLevel || 95;
    drawRibbon(outLvl, pal.primaryRibbon95);
    drawRibbon(inLvl, pal.primaryRibbon80);

    // Optional Simulated Stochastic Sample Paths (Part 16.5)
    if (Array.isArray(renderState.simulatedPaths) && renderState.simulatedPaths.length > 0) {
      ctx.save();
      ctx.strokeStyle = renderState.isDark ? "rgba(96, 165, 250, 0.28)" : "rgba(29, 78, 216, 0.22)";
      ctx.lineWidth = 1.0;
      const anchorVal = observations[fStartIdx - 1]?.value;
      for (const pathVec of renderState.simulatedPaths) {
        ctx.beginPath();
        if (anchorVal !== null && Number.isFinite(anchorVal)) {
          ctx.moveTo(toScreenX(fStartIdx - 1), toScreenY(anchorVal));
        }
        for (let h = 0; h < pathVec.length; h++) {
          const px = toScreenX(fStartIdx + h);
          const py = toScreenY(pathVec[h]);
          if (h === 0 && (anchorVal === null || !Number.isFinite(anchorVal))) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Optional 95% Confidence Interval for Mean Response (Regression models)
    if (showMeanCI && activeFit.meanResponseConfidenceInterval95) {
      const mb = activeFit.meanResponseConfidenceInterval95;
      ctx.save();
      ctx.fillStyle = pal.meanCI;
      ctx.beginPath();
      for (let h = 0; h < fLen; h++) {
        const x = toScreenX(fStartIdx + h);
        const y = toScreenY(mb[h][1]);
        if (h === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let h = fLen - 1; h >= 0; h--) {
        ctx.lineTo(toScreenX(fStartIdx + h), toScreenY(mb[h][0]));
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw Historical Observed Series (breaking across missing gaps and marking missing/imputed points)
  ctx.save();
  ctx.strokeStyle = pal.observed;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  let penDown = false;
  let lastValidIdx = -1;
  for (let t = startStep; t < T; t++) {
    const val = observations[t].value;
    if (val === null || !Number.isFinite(val)) {
      penDown = false;
      continue;
    }
    const px = toScreenX(t);
    const py = toScreenY(val);
    if (!penDown) {
      // Draw dashed connector across missing gap to indicate missingness explicitly
      if (lastValidIdx >= startStep) {
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = pal.secondary;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(toScreenX(lastValidIdx), toScreenY(observations[lastValidIdx].value));
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
      }
      ctx.moveTo(px, py);
      penDown = true;
    } else {
      ctx.lineTo(px, py);
    }
    lastValidIdx = t;
  }
  ctx.stroke();
  ctx.restore();

  // Draw Observation Glyphs
  for (let t = startStep; t < T; t++) {
    const obs = observations[t];
    if (obs.value === null || !Number.isFinite(obs.value)) continue;
    const px = toScreenX(t);
    const py = toScreenY(obs.value);
    ctx.save();
    ctx.beginPath();
    if (obs.isImputed) {
      // Triangle marker for imputed values
      ctx.fillStyle = pal.warning;
      ctx.moveTo(px, py - 5);
      ctx.lineTo(px - 4.5, py + 4);
      ctx.lineTo(px + 4.5, py + 4);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = t >= fStartIdx ? pal.accent : pal.observed;
      ctx.arc(px, py, hoverIndex === t ? 5.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw In-Sample Fitted Values (Dashed Emerald Line)
  if (showFitted && activeFit?.valid && activeFit.fittedValues) {
    ctx.save();
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    let started = false;
    const fitEnd = Math.min(T, activeFit.fittedValues.length);
    for (let t = startStep; t < fitEnd; t++) {
      const fv = activeFit.fittedValues[t];
      if (fv === null || !Number.isFinite(fv)) {
        started = false;
        continue;
      }
      const px = toScreenX(t);
      const py = toScreenY(fv);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Draw Competing Model Overlays (Distinct stroke patterns + colors)
  const altColors = [pal.altModel1, pal.altModel2, pal.altModel3, pal.secondary];
  const altDashes = [[6, 3], [2, 3], [8, 3, 2, 3], [4, 4]];
  comparisonFits.forEach((cf, idx) => {
    if (!cf || !cf.valid) return;
    ctx.save();
    ctx.strokeStyle = altColors[idx % altColors.length];
    ctx.lineWidth = 2.0;
    ctx.setLineDash(altDashes[idx % altDashes.length]);
    ctx.beginPath();
    const anchor = observations[fStartIdx - 1]?.value;
    if (anchor !== null && Number.isFinite(anchor)) {
      ctx.moveTo(toScreenX(fStartIdx - 1), toScreenY(anchor));
    }
    for (let h = 0; h < cf.pointForecasts.length; h++) {
      const px = toScreenX(fStartIdx + h);
      const py = toScreenY(cf.pointForecasts[h]);
      if (h === 0 && (anchor === null || !Number.isFinite(anchor))) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  });

  // Draw Primary Point Forecast (Solid Emerald + Diamond Glyphs)
  if (activeFit?.valid) {
    ctx.save();
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    const anchor = observations[fStartIdx - 1]?.value;
    if (anchor !== null && Number.isFinite(anchor)) {
      ctx.moveTo(toScreenX(fStartIdx - 1), toScreenY(anchor));
    }
    for (let h = 0; h < activeFit.pointForecasts.length; h++) {
      const px = toScreenX(fStartIdx + h);
      const py = toScreenY(activeFit.pointForecasts[h]);
      if (h === 0 && (anchor === null || !Number.isFinite(anchor))) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Diamond glyphs at forecast points
    for (let h = 0; h < activeFit.pointForecasts.length; h++) {
      const px = toScreenX(fStartIdx + h);
      const py = toScreenY(activeFit.pointForecasts[h]);
      ctx.fillStyle = pal.primary;
      ctx.beginPath();
      ctx.moveTo(px, py - 4.2);
      ctx.lineTo(px + 4.2, py);
      ctx.lineTo(px, py + 4.2);
      ctx.lineTo(px - 4.2, py);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw Scenario / Judgmentally Adjusted Forecast Overlay if active
  if (scenarioResult?.valid && scenarioResult.isJudgmentallyAdjusted) {
    ctx.save();
    ctx.strokeStyle = pal.secondary;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([7, 3, 2, 3]);
    ctx.beginPath();
    const anchor = observations[fStartIdx - 1]?.value;
    if (anchor !== null && Number.isFinite(anchor)) {
      ctx.moveTo(toScreenX(fStartIdx - 1), toScreenY(anchor));
    }
    for (let h = 0; h < scenarioResult.adjustedPointForecasts.length; h++) {
      const px = toScreenX(fStartIdx + h);
      const py = toScreenY(scenarioResult.adjustedPointForecasts[h]);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    // Square markers for judgmental adjustments
    ctx.setLineDash([]);
    ctx.fillStyle = pal.secondary;
    for (let h = 0; h < scenarioResult.adjustedPointForecasts.length; h++) {
      const px = toScreenX(fStartIdx + h);
      const py = toScreenY(scenarioResult.adjustedPointForecasts[h]);
      ctx.fillRect(px - 3.2, py - 3.2, 6.4, 6.4);
    }
    ctx.restore();
  }

  // Draw Legend Header Bar
  ctx.save();
  ctx.font = "500 11px 'Inter', sans-serif";
  ctx.textAlign = "left";
  let lx = pad.left;
  const ly = 18;
  // Observed
  ctx.fillStyle = pal.observed;
  ctx.fillRect(lx, ly - 6, 12, 3);
  ctx.fillText("Observed (yₜ)", lx + 16, ly - 1);
  lx += 105;
  if (activeFit?.valid) {
    ctx.fillStyle = pal.primary;
    ctx.fillRect(lx, ly - 6, 12, 3);
    ctx.fillText(`Forecast (${activeFit.modelType})`, lx + 16, ly - 1);
    lx += 145;
    if (showIntervals) {
      ctx.fillStyle = pal.primaryRibbon80;
      ctx.fillRect(lx, ly - 9, 12, 9);
      ctx.fillStyle = pal.textMuted;
      ctx.fillText(`${renderState.innerLevel || 80}% & ${renderState.outerLevel || 95}% Prediction Intervals`, lx + 16, ly - 1);
      lx += 190;
    }
  }
  if (scenarioResult?.valid && scenarioResult.isJudgmentallyAdjusted) {
    ctx.fillStyle = pal.secondary;
    ctx.fillRect(lx, ly - 6, 12, 3);
    ctx.fillText("Adjusted Scenario", lx + 16, ly - 1);
  }
  ctx.restore();

  // Hover crosshair & readout
  if (hoverIndex !== null && hoverIndex >= startStep && hoverIndex < totalSteps) {
    const hx = toScreenX(hoverIndex);
    ctx.save();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(hx, pad.top);
    ctx.lineTo(hx, pad.top + plotH);
    ctx.stroke();
    ctx.restore();
  }

  return {
    toScreenX,
    toScreenY,
    toDataY,
    toStepIndex,
    pad,
    plotW,
    plotH,
    startStep,
    totalSteps
  };
}

/**
 * Seasonal Plot (Year-over-Year / Cycle-over-Cycle Overlay)
 */
export function renderSeasonalPlotCanvas(canvas, observations, seasonalPeriod = 12, isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  const m = Math.max(2, Math.floor(seasonalPeriod));
  const clean = observations.filter(o => o.value !== null && Number.isFinite(o.value));
  if (clean.length < m) {
    ctx.fillStyle = pal.textMuted;
    ctx.font = "12px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Seasonal plot requires m >= 2 and at least 1 cycle (current m=${seasonalPeriod}).`, width / 2, height / 2);
    return;
  }

  const pad = { top: 28, right: 54, bottom: 34, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  let yMin = Math.min(...clean.map(o => o.value));
  let yMax = Math.max(...clean.map(o => o.value));
  const range = Math.max(1, yMax - yMin);
  yMin -= range * 0.08;
  yMax += range * 0.08;

  const toX = (sIdx) => pad.left + (sIdx / Math.max(1, m - 1)) * plotW;
  const toY = (v) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Grid
  ctx.strokeStyle = pal.gridMajor;
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.fillStyle = pal.textMuted;
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const v = yMin + (i / 4) * (yMax - yMin);
    const py = toY(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(pad.left + plotW, py);
    ctx.stroke();
    ctx.fillText(formatAxisNumber(v), pad.left - 6, py + 4);
  }

  ctx.textAlign = "center";
  for (let s = 0; s < m; s++) {
    if (m <= 12 || s % Math.ceil(m / 12) === 0) {
      ctx.fillText(`S${s + 1}`, toX(s), pad.top + plotH + 18);
    }
  }

  const numCycles = Math.ceil(observations.length / m);
  const cycleColors = [pal.textMuted, pal.altModel1, pal.altModel2, pal.warning, pal.secondary, pal.primary];

  for (let c = 0; c < numCycles; c++) {
    const color = cycleColors[c % cycleColors.length];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = c === numCycles - 1 ? 2.4 : 1.5;
    ctx.beginPath();
    let started = false;
    let lastPt = null;
    for (let s = 0; s < m; s++) {
      const idx = c * m + s;
      if (idx >= observations.length) break;
      const v = observations[idx].value;
      if (v === null || !Number.isFinite(v)) continue;
      const px = toX(s);
      const py = toY(v);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
      lastPt = { px, py, label: observations[c * m]?.timestamp?.slice(0, 4) || `C${c + 1}` };
    }
    ctx.stroke();
    if (lastPt) {
      ctx.fillStyle = color;
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(lastPt.label, lastPt.px + 5, lastPt.py + 3);
    }
    ctx.restore();
  }
}

/**
 * Seasonal Subseries Faceted Plot (Each season s=1..m in its own mini-facet with horizontal mean bar)
 */
export function renderSubseriesCanvas(canvas, observations, seasonalPeriod = 12, isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  const m = Math.max(2, Math.min(24, Math.floor(seasonalPeriod)));
  const clean = observations.filter(o => o.value !== null && Number.isFinite(o.value));
  if (clean.length < m) return;

  const pad = { top: 24, right: 16, bottom: 32, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  let yMin = Math.min(...clean.map(o => o.value));
  let yMax = Math.max(...clean.map(o => o.value));
  const range = Math.max(1, yMax - yMin);
  yMin -= range * 0.08;
  yMax += range * 0.08;
  const toY = (v) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  ctx.strokeStyle = pal.gridMajor;
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.fillStyle = pal.textMuted;
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const v = yMin + (i / 4) * (yMax - yMin);
    const py = toY(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(pad.left + plotW, py);
    ctx.stroke();
    ctx.fillText(formatAxisNumber(v), pad.left - 6, py + 4);
  }

  const facetW = plotW / m;
  for (let s = 0; s < m; s++) {
    const fx0 = pad.left + s * facetW + 4;
    const fx1 = pad.left + (s + 1) * facetW - 4;
    const fw = Math.max(4, fx1 - fx0);

    // Vertical facet separator
    ctx.strokeStyle = pal.gridMinor;
    ctx.beginPath();
    ctx.moveTo(pad.left + s * facetW, pad.top);
    ctx.lineTo(pad.left + s * facetW, pad.top + plotH);
    ctx.stroke();

    const subVals = [];
    for (let i = s; i < observations.length; i += m) {
      if (observations[i].value !== null && Number.isFinite(observations[i].value)) {
        subVals.push(observations[i].value);
      }
    }
    if (subVals.length === 0) continue;
    const meanVal = subVals.reduce((a, b) => a + b, 0) / subVals.length;

    // Horizontal season mean bar
    ctx.strokeStyle = pal.secondary;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(fx0, toY(meanVal));
    ctx.lineTo(fx1, toY(meanVal));
    ctx.stroke();

    // Subseries trace
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    subVals.forEach((v, k) => {
      const px = fx0 + (subVals.length > 1 ? (k / (subVals.length - 1)) * fw : fw / 2);
      const py = toY(v);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    ctx.fillStyle = pal.textMuted;
    ctx.textAlign = "center";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillText(`S${s + 1}`, fx0 + fw / 2, pad.top + plotH + 16);
  }
}

/**
 * Lag Scatter Plot (y_t vs y_{t-k})
 */
export function renderLagPlotCanvas(canvas, lagResult, isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  const pairs = lagResult?.pairs || [];
  if (pairs.length < 2) return;

  const pad = { top: 26, right: 20, bottom: 36, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const allVals = pairs.flatMap(p => [p.xLag, p.yCurrent]);
  let vMin = Math.min(...allVals);
  let vMax = Math.max(...allVals);
  const span = Math.max(1, vMax - vMin);
  vMin -= span * 0.08;
  vMax += span * 0.08;

  const toX = (v) => pad.left + ((v - vMin) / (vMax - vMin)) * plotW;
  const toY = (v) => pad.top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

  // Identity line y = x
  ctx.save();
  ctx.strokeStyle = pal.gridMajor;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(toX(vMin), toY(vMin));
  ctx.lineTo(toX(vMax), toY(vMax));
  ctx.stroke();
  ctx.restore();

  // Points
  ctx.fillStyle = pal.primary;
  for (const p of pairs) {
    ctx.beginPath();
    ctx.arc(toX(p.xLag), toY(p.yCurrent), 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = pal.text;
  ctx.font = "600 11px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Lag k=${lagResult.lag} (n=${lagResult.count} pairs, r=${lagResult.correlation.toFixed(4)})`, pad.left, 16);
  ctx.fillStyle = pal.textMuted;
  ctx.textAlign = "center";
  ctx.fillText(`yₜ₋${String(lagResult.lag).replace(/[0-9]/g, d => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])}`, pad.left + plotW / 2, height - 8);
}

/**
 * ACF / PACF Correlogram Stem Plot with Bartlett ±1.96/sqrt(T) Confidence Bands
 */
export function renderCorrelogramCanvas(canvas, corrData, title = "ACF", isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  const lags = corrData?.lags || [];
  const vals = corrData?.acf || corrData?.pacf || [];
  const bound = corrData?.bartlettBound || corrData?.bound || 0.2;

  const pad = { top: 26, right: 16, bottom: 32, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const toX = (idx) => pad.left + ((idx + 0.5) / Math.max(1, lags.length)) * plotW;
  const toY = (v) => pad.top + plotH / 2 - (v * (plotH / 2 - 6));

  // Zero line
  ctx.strokeStyle = pal.text;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, toY(0));
  ctx.lineTo(pad.left + plotW, toY(0));
  ctx.stroke();

  // Bartlett 95% White-Noise bounds
  ctx.save();
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  for (const b of [bound, -bound]) {
    ctx.beginPath();
    ctx.moveTo(pad.left, toY(b));
    ctx.lineTo(pad.left + plotW, toY(b));
    ctx.stroke();
  }
  ctx.restore();

  // Y labels
  ctx.fillStyle = pal.textMuted;
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText("1.0", pad.left - 5, toY(1.0) + 3);
  ctx.fillText("0.0", pad.left - 5, toY(0.0) + 3);
  ctx.fillText("-1.0", pad.left - 5, toY(-1.0) + 3);

  // Stems
  for (let i = 0; i < lags.length; i++) {
    const r = vals[i];
    const px = toX(i);
    const py = toY(r);
    const exceeds = Math.abs(r) > bound;
    ctx.strokeStyle = exceeds ? pal.secondary : pal.primary;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(px, toY(0));
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.fillStyle = exceeds ? pal.secondary : pal.primary;
    ctx.beginPath();
    ctx.arc(px, py, 3.0, 0, Math.PI * 2);
    ctx.fill();

    if (lags.length <= 16 || lags[i] % 4 === 0 || lags[i] === 1) {
      ctx.fillStyle = pal.textMuted;
      ctx.textAlign = "center";
      ctx.fillText(String(lags[i]), px, pad.top + plotH + 15);
    }
  }

  ctx.fillStyle = pal.text;
  ctx.font = "600 11px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`${title} (±1.96/√T = ±${bound.toFixed(3)})`, pad.left, 16);
}

/**
 * 4-Panel Synchronized Decomposition Canvas (Observed, Trend-Cycle, Seasonal, Remainder)
 */
export function renderDecompositionCanvas(canvas, decomp, timestamps = [], isDark = false, showSeasonallyAdjusted = true) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  if (!decomp || !decomp.valid) {
    ctx.fillStyle = pal.secondary;
    ctx.font = "13px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(decomp?.reason || "Decomposition unavailable for current settings.", width / 2, height / 2);
    return;
  }

  const panels = [
    { label: "Observed (yₜ)", data: decomp.observed, color: pal.observed },
    { label: "Trend-Cycle (Tₜ)", data: decomp.trend, color: pal.primary },
    { label: "Seasonal (Sₜ)", data: decomp.seasonal, color: pal.accent },
    { label: "Remainder (Rₜ)", data: decomp.remainder, color: pal.secondary, zeroLine: decomp.type === "multiplicative" ? 1.0 : 0.0 }
  ];

  const padL = 60;
  const padR = 18;
  const topSpace = 14;
  const bottomSpace = 26;
  const panelH = (height - topSpace - bottomSpace) / 4;
  const plotW = width - padL - padR;
  const n = decomp.observed.length;
  const toX = (i) => padL + (i / Math.max(1, n - 1)) * plotW;

  panels.forEach((p, pIdx) => {
    const py0 = topSpace + pIdx * panelH + 6;
    const py1 = topSpace + (pIdx + 1) * panelH - 6;
    const ph = py1 - py0;

    const valid = p.data.filter(v => v !== null && Number.isFinite(v));
    let vMin = valid.length ? Math.min(...valid) : -1;
    let vMax = valid.length ? Math.max(...valid) : 1;
    if (Math.abs(vMax - vMin) < 1e-6) { vMin -= 1; vMax += 1; }
    const toY = (v) => py1 - ((v - vMin) / (vMax - vMin)) * ph;

    // Panel frame
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, py0, plotW, ph);

    if (p.zeroLine !== undefined && p.zeroLine >= vMin && p.zeroLine <= vMax) {
      ctx.save();
      ctx.strokeStyle = pal.gridMajor;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, toY(p.zeroLine));
      ctx.lineTo(padL + plotW, toY(p.zeroLine));
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      const v = p.data[i];
      if (v === null || !Number.isFinite(v)) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(toX(i), toY(v));
        started = true;
      } else {
        ctx.lineTo(toX(i), toY(v));
      }
    }
    ctx.stroke();

    // Overlay Seasonally Adjusted series on top panel (Observed)
    if (pIdx === 0 && showSeasonallyAdjusted && Array.isArray(decomp.seasonallyAdjusted)) {
      ctx.save();
      ctx.strokeStyle = pal.warning;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      let saStarted = false;
      for (let i = 0; i < n; i++) {
        const sv = decomp.seasonallyAdjusted[i];
        if (sv === null || !Number.isFinite(sv)) { saStarted = false; continue; }
        if (!saStarted) { ctx.moveTo(toX(i), toY(sv)); saStarted = true; }
        else ctx.lineTo(toX(i), toY(sv));
      }
      ctx.stroke();
      ctx.fillStyle = pal.warning;
      ctx.font = "500 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText("Dashed Amber: Seasonally Adjusted", padL + plotW - 6, py0 + 12);
      ctx.restore();
    }

    ctx.fillStyle = pal.text;
    ctx.font = "600 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(p.label, padL + 6, py0 + 12);

    ctx.fillStyle = pal.textMuted;
    ctx.textAlign = "right";
    ctx.fillText(formatAxisNumber(vMax), padL - 5, py0 + 10);
    ctx.fillText(formatAxisNumber(vMin), padL - 5, py1);
  });
}

/**
 * 4-Panel Residual Diagnostics Suite (Residuals over time, Residual ACF, Histogram, Normal Q-Q Plot)
 */
export function renderDiagnosticsCanvas(canvas, residuals = [], timestamps = [], isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  const clean = residuals.filter(v => v !== null && Number.isFinite(v));
  if (clean.length < 3) {
    ctx.fillStyle = pal.textMuted;
    ctx.font = "12px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Fit a model to inspect residual diagnostics.", width / 2, height / 2);
    return;
  }

  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);

  // Quadrant 1 (Top-Left): Innovation Residuals over Time
  drawResidualTimeQuadrant(ctx, residuals, { x: 46, y: 22, w: midX - 58, h: midY - 40 }, pal);

  // Quadrant 2 (Top-Right): Residual ACF
  const acfRes = computeACF(clean, Math.min(16, clean.length - 1));
  drawResidualACFQuadrant(ctx, acfRes, { x: midX + 38, y: 22, w: width - midX - 52, h: midY - 40 }, pal);

  // Quadrant 3 (Bottom-Left): Residual Histogram + Normal Density Curve
  drawResidualHistogramQuadrant(ctx, clean, { x: 46, y: midY + 22, w: midX - 58, h: height - midY - 40 }, pal);

  // Quadrant 4 (Bottom-Right): Normal Q-Q Plot (Blom Plotting Positions)
  drawResidualQQQuadrant(ctx, clean, { x: midX + 38, y: midY + 22, w: width - midX - 52, h: height - midY - 40 }, pal);
}

function drawResidualTimeQuadrant(ctx, residuals, box, pal) {
  const clean = residuals.filter(v => v !== null && Number.isFinite(v));
  const maxAbs = Math.max(1e-6, ...clean.map(Math.abs)) * 1.12;
  const toX = (i) => box.x + (i / Math.max(1, residuals.length - 1)) * box.w;
  const toY = (v) => box.y + box.h / 2 - (v / maxAbs) * (box.h / 2);

  ctx.strokeStyle = pal.border;
  ctx.strokeRect(box.x, box.y, box.w, box.h);

  ctx.strokeStyle = pal.textMuted;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(box.x, toY(0));
  ctx.lineTo(box.x + box.w, toY(0));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = pal.secondary;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  let started = false;
  residuals.forEach((r, i) => {
    if (r === null || !Number.isFinite(r)) { started = false; return; }
    if (!started) { ctx.moveTo(toX(i), toY(r)); started = true; }
    else ctx.lineTo(toX(i), toY(r));
  });
  ctx.stroke();

  ctx.fillStyle = pal.text;
  ctx.font = "600 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("1. Innovation Residuals eₜ", box.x, box.y - 6);
}

function drawResidualACFQuadrant(ctx, acfRes, box, pal) {
  ctx.strokeStyle = pal.border;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  const toY = (v) => box.y + box.h / 2 - v * (box.h / 2 - 4);
  ctx.strokeStyle = pal.textMuted;
  ctx.beginPath();
  ctx.moveTo(box.x, toY(0));
  ctx.lineTo(box.x + box.w, toY(0));
  ctx.stroke();

  const b = acfRes.bartlettBound || 0.2;
  ctx.strokeStyle = pal.accent;
  ctx.setLineDash([3, 3]);
  for (const boundVal of [b, -b]) {
    ctx.beginPath();
    ctx.moveTo(box.x, toY(boundVal));
    ctx.lineTo(box.x + box.w, toY(boundVal));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const K = acfRes.lags.length;
  for (let i = 0; i < K; i++) {
    const px = box.x + ((i + 0.5) / Math.max(1, K)) * box.w;
    const py = toY(acfRes.acf[i]);
    ctx.strokeStyle = Math.abs(acfRes.acf[i]) > b ? pal.secondary : pal.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, toY(0));
    ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.fillStyle = pal.text;
  ctx.font = "600 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("2. Residual ACF (White-Noise Check)", box.x, box.y - 6);
}

function drawResidualHistogramQuadrant(ctx, clean, box, pal) {
  ctx.strokeStyle = pal.border;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  const st = computeUnivariateStats(clean);
  const bins = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(clean.length))));
  const minV = st.min;
  const maxV = st.max > st.min ? st.max : st.min + 1;
  const binW = (maxV - minV) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of clean) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - minV) / binW)));
    counts[idx]++;
  }
  const maxC = Math.max(1, ...counts);
  const barW = box.w / bins;
  ctx.fillStyle = pal.primaryRibbon80;
  ctx.strokeStyle = pal.primary;
  for (let b = 0; b < bins; b++) {
    const bh = (counts[b] / maxC) * (box.h - 10);
    ctx.fillRect(box.x + b * barW + 1, box.y + box.h - bh, barW - 2, bh);
    ctx.strokeRect(box.x + b * barW + 1, box.y + box.h - bh, barW - 2, bh);
  }
  ctx.fillStyle = pal.text;
  ctx.font = "600 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("3. Residual Distribution", box.x, box.y - 6);
}

function drawResidualQQQuadrant(ctx, clean, box, pal) {
  ctx.strokeStyle = pal.border;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  const st = computeUnivariateStats(clean);
  const sd = st.stdDev > 1e-9 ? st.stdDev : 1.0;
  const sorted = [...clean].sort((a, b) => a - b).map(v => (v - st.mean) / sd);
  const n = sorted.length;

  const toX = (z) => box.x + ((z + 3) / 6) * box.w;
  const toY = (z) => box.y + box.h - ((z + 3) / 6) * box.h;

  // Identity reference y = x
  ctx.strokeStyle = pal.secondary;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(toX(-2.5), toY(-2.5));
  ctx.lineTo(toX(2.5), toY(2.5));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = pal.primary;
  for (let i = 1; i <= n; i++) {
    const p = (i - 0.375) / (n + 0.25); // Blom plotting position
    const zTheo = Math.max(-2.8, Math.min(2.8, inverseNormalCDF(p)));
    const zEmp = Math.max(-2.8, Math.min(2.8, sorted[i - 1]));
    ctx.beginPath();
    ctx.arc(toX(zTheo), toY(zEmp), 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = pal.text;
  ctx.font = "600 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("4. Normal Q-Q Plot (Blom)", box.x, box.y - 6);
}

/**
 * Rolling-Origin Backtest Error-by-Horizon Curve (RMSE / MAE across h = 1..H)
 */
export function renderBacktestHorizonCanvas(canvas, backtestResult, isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  if (!backtestResult || !backtestResult.valid) return;
  const hMetrics = backtestResult.horizonMetrics.filter(m => m.count > 0);
  if (hMetrics.length === 0) return;

  const pad = { top: 28, right: 24, bottom: 36, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxErr = Math.max(1e-6, ...hMetrics.map(m => Math.max(m.rmse || 0, m.mae || 0))) * 1.15;
  const toX = (idx) => pad.left + (idx / Math.max(1, hMetrics.length - 1)) * plotW;
  const toY = (v) => pad.top + plotH - (v / maxErr) * plotH;

  // Grid with zero baseline
  ctx.strokeStyle = pal.gridMajor;
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.fillStyle = pal.textMuted;
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const v = (i / 4) * maxErr;
    const py = toY(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(pad.left + plotW, py);
    ctx.stroke();
    ctx.fillText(formatAxisNumber(v), pad.left - 6, py + 3);
  }

  // RMSE curve
  ctx.strokeStyle = pal.secondary;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  hMetrics.forEach((m, i) => {
    const px = toX(i);
    const py = toY(m.rmse);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // MAE curve
  ctx.strokeStyle = pal.primary;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  hMetrics.forEach((m, i) => {
    const px = toX(i);
    const py = toY(m.mae);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "center";
  hMetrics.forEach((m, i) => {
    const px = toX(i);
    ctx.fillStyle = pal.secondary;
    ctx.beginPath();
    ctx.arc(px, toY(m.rmse), 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.primary;
    ctx.beginPath();
    ctx.arc(px, toY(m.mae), 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.textMuted;
    ctx.fillText(`h=${m.horizon}`, px, pad.top + plotH + 16);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = pal.text;
  ctx.font = "600 11px 'JetBrains Mono', monospace";
  ctx.fillText(`Forecast Error by Horizon (${backtestResult.originCount} Rolling Origins, ${backtestResult.windowType} window) — Solid: RMSE, Dashed: MAE`, pad.left, 16);
}

/**
 * Vector SVG Exporter for Active Forecast Plot (Script-Sanitized)
 */
export function exportForecastChartToSVG(observations, primaryFit, title = "ForecastLab Time-Series Forecast") {
  const width = 800;
  const height = 400;
  const pad = { top: 40, right: 30, bottom: 45, left: 65 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const T = observations.length;
  const H = primaryFit?.valid ? primaryFit.horizon : 0;
  const total = Math.max(2, T + H);

  const vals = [];
  observations.forEach(o => { if (o.value !== null && Number.isFinite(o.value)) vals.push(o.value); });
  if (primaryFit?.valid) {
    primaryFit.pointForecasts.forEach(v => vals.push(v));
    primaryFit.intervals?.[95]?.forEach(([lo, hi]) => { vals.push(lo, hi); });
  }
  const yMin = (vals.length ? Math.min(...vals) : 0) * 0.95;
  const yMax = (vals.length ? Math.max(...vals) : 100) * 1.05;

  const toX = (i) => (pad.left + (i / (total - 1)) * plotW).toFixed(1);
  const toY = (v) => (pad.top + plotH - ((v - yMin) / Math.max(1e-6, yMax - yMin)) * plotH).toFixed(1);

  const safeTitle = String(title).replace(/[<>&"']/g, "");
  let obsPoints = "";
  for (let t = 0; t < T; t++) {
    if (observations[t].value !== null && Number.isFinite(observations[t].value)) {
      obsPoints += `${toX(t)},${toY(observations[t].value)} `;
    }
  }

  let fcPoints = "";
  let ribbon95Points = "";
  if (primaryFit?.valid) {
    if (T > 0 && observations[T - 1].value !== null) {
      fcPoints += `${toX(T - 1)},${toY(observations[T - 1].value)} `;
    }
    for (let h = 0; h < H; h++) {
      fcPoints += `${toX(T + h)},${toY(primaryFit.pointForecasts[h])} `;
    }
    if (primaryFit.intervals?.[95]) {
      const upper = primaryFit.intervals[95].map((b, h) => `${toX(T + h)},${toY(b[1])}`).join(" ");
      const lower = [...primaryFit.intervals[95]].reverse().map((b, idx) => `${toX(T + H - 1 - idx)},${toY(b[0])}`).join(" ");
      ribbon95Points = `<polygon points="${upper} ${lower}" fill="rgba(15, 110, 86, 0.16)" stroke="none" />`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#FFFFFF" />
  <text x="${pad.left}" y="24" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#141619">${safeTitle}</text>
  <rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="none" stroke="#D8D4C8" stroke-width="1" />
  ${ribbon95Points}
  <polyline fill="none" stroke="#141619" stroke-width="2" points="${obsPoints.trim()}" />
  ${fcPoints ? `<polyline fill="none" stroke="#0F6E56" stroke-width="2.5" points="${fcPoints.trim()}" />` : ""}
</svg>`;
}

function formatAxisNumber(v) {
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}


/**
 * Cycle x Season Calendar Heatmap (Part 7.3)
 */
export function renderSeasonalHeatmapCanvas(canvas, observations, seasonalPeriod = 12, isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  const m = Math.max(2, Math.min(24, Math.floor(seasonalPeriod)));
  const clean = observations.filter(o => o.value !== null && Number.isFinite(o.value));
  if (clean.length < m) return;

  const numCycles = Math.ceil(observations.length / m);
  const pad = { top: 28, right: 20, bottom: 32, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const vMin = Math.min(...clean.map(o => o.value));
  const vMax = Math.max(...clean.map(o => o.value));
  const span = Math.max(1e-6, vMax - vMin);

  const cellW = plotW / m;
  const cellH = plotH / numCycles;

  for (let c = 0; c < numCycles; c++) {
    const rowLabel = observations[c * m]?.timestamp?.slice(0, 4) || `Cycle ${c + 1}`;
    ctx.fillStyle = pal.textMuted;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(rowLabel, pad.left - 6, pad.top + c * cellH + cellH / 2 + 3);

    for (let s = 0; s < m; s++) {
      const idx = c * m + s;
      const x = pad.left + s * cellW;
      const y = pad.top + c * cellH;
      if (idx >= observations.length || observations[idx].value === null || !Number.isFinite(observations[idx].value)) {
        ctx.fillStyle = pal.bg;
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
        continue;
      }
      const val = observations[idx].value;
      const norm = Math.max(0, Math.min(1, (val - vMin) / span));
      // Perceptually ordered emerald luminance gradient
      const r = Math.round(235 - norm * 215);
      const g = Math.round(245 - norm * 125);
      const b = Math.round(238 - norm * 145);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

      if (cellW >= 34 && cellH >= 18) {
        ctx.fillStyle = norm > 0.55 ? "#FFFFFF" : "#141619";
        ctx.font = "9.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(formatAxisNumber(val), x + cellW / 2, y + cellH / 2 + 3);
      }
    }
  }

  ctx.fillStyle = pal.textMuted;
  ctx.textAlign = "center";
  for (let s = 0; s < m; s++) {
    ctx.fillText(`S${s + 1}`, pad.left + s * cellW + cellW / 2, pad.top + plotH + 16);
  }
  ctx.fillStyle = pal.text;
  ctx.font = "600 11px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Seasonal Intensity Heatmap (Min: ${formatAxisNumber(vMin)} → Max: ${formatAxisNumber(vMax)})`, pad.left, 16);
}

/**
 * White Noise vs. Serial Correlation & Independence Demonstration Canvas (Part 7.7)
 */
export function renderWhiteNoiseDemoCanvas(canvas, simResult, isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  if (!simResult) return;
  const thirdW = Math.floor((width - 40) / 3);
  const boxH = height - 48;

  // Panel 1: Simulated Series y_t
  drawResidualTimeQuadrant(ctx, simResult.series, { x: 16, y: 24, w: thirdW - 12, h: boxH }, pal);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(16, 6, thirdW - 12, 16);
  ctx.fillStyle = pal.text;
  ctx.font = "600 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`1. Simulated Process yₜ (n=${simResult.n})`, 16, 17);

  // Panel 2: ACF of Level y_t
  drawResidualACFQuadrant(ctx, simResult.acfLevel, { x: 16 + thirdW + 6, y: 24, w: thirdW - 12, h: boxH }, pal);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(16 + thirdW + 6, 6, thirdW - 12, 16);
  ctx.fillStyle = pal.text;
  ctx.fillText(`2. Level ACF(yₜ) — LB p=${simResult.lbLevel.pValue.toFixed(3)}`, 16 + thirdW + 6, 17);

  // Panel 3: ACF of Squared y_t^2 (Tests nonlinear volatility dependence!)
  drawResidualACFQuadrant(ctx, simResult.acfSquared, { x: 16 + 2 * thirdW + 12, y: 24, w: thirdW - 12, h: boxH }, pal);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(16 + 2 * thirdW + 12, 6, thirdW - 12, 16);
  ctx.fillStyle = pal.text;
  ctx.fillText(`3. Squared ACF(yₜ²) — LB p=${simResult.lbSquared.pValue.toFixed(3)}`, 16 + 2 * thirdW + 12, 17);
}

/**
 * Actual vs. Fitted Calibration & Interval Coverage Canvas (Part 23.1)
 */
export function renderActualVsFittedCanvas(canvas, observations, fitResult, isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  if (!fitResult || !fitResult.valid) return;
  const pairs = [];
  for (let t = 0; t < observations.length; t++) {
    const y = observations[t]?.value;
    const yh = fitResult.fittedValues?.[t];
    if (y !== null && yh !== null && Number.isFinite(y) && Number.isFinite(yh)) {
      pairs.push({ y, yh });
    }
  }
  if (pairs.length < 2) return;

  const pad = { top: 28, right: 20, bottom: 36, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const allV = pairs.flatMap(p => [p.y, p.yh]);
  const vMin = Math.min(...allV) * 0.96;
  const vMax = Math.max(...allV) * 1.04;
  const toX = (v) => pad.left + ((v - vMin) / Math.max(1e-6, vMax - vMin)) * plotW;
  const toY = (v) => pad.top + plotH - ((v - vMin) / Math.max(1e-6, vMax - vMin)) * plotH;

  ctx.strokeStyle = pal.gridMajor;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);

  // 45-degree identity line y = y_hat
  ctx.save();
  ctx.strokeStyle = pal.secondary;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(toX(vMin), toY(vMin));
  ctx.lineTo(toX(vMax), toY(vMax));
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = pal.primary;
  for (const p of pairs) {
    ctx.beginPath();
    ctx.arc(toX(p.yh), toY(p.y), 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = pal.text;
  ctx.font = "600 11px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Actual yₜ vs. In-Sample Fitted ŷₜ (n=${pairs.length} pairs, dashed line: y = ŷ)`, pad.left, 16);
  ctx.fillStyle = pal.textMuted;
  ctx.textAlign = "center";
  ctx.fillText("Fitted Value ŷₜ", pad.left + plotW / 2, height - 8);
}

/**
 * Hierarchical Base vs. Reconciled Forecast Comparison Canvas (Part 19.6 & 23.1)
 */
export function renderHierarchyCanvas(canvas, hierarchyResult, observations, selectedNode = "Total", isDark = false) {
  const setup = setupHighDPICanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pal = getThemePalette(isDark);
  ctx.fillStyle = pal.surface;
  ctx.fillRect(0, 0, width, height);

  if (!hierarchyResult || !hierarchyResult.valid) return;
  const node = selectedNode || "Total";
  const histVals = observations.map(o => (node === "Total" ? o.value : o[node]));
  const baseFc = hierarchyResult.baseForecasts[node] || [];
  const recFc = hierarchyResult.reconciledForecasts[node] || [];

  const T = histVals.length;
  const H = recFc.length;
  const total = T + H;

  const allV = [...histVals, ...baseFc, ...recFc].filter(v => v !== null && Number.isFinite(v));
  const vMin = Math.min(...allV) * 0.94;
  const vMax = Math.max(...allV) * 1.06;

  const pad = { top: 28, right: 20, bottom: 34, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const toX = (idx) => pad.left + (idx / Math.max(1, total - 1)) * plotW;
  const toY = (v) => pad.top + plotH - ((v - vMin) / Math.max(1e-6, vMax - vMin)) * plotH;

  ctx.strokeStyle = pal.gridMajor;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);

  // Historical line
  ctx.strokeStyle = pal.observed;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  histVals.forEach((v, i) => {
    if (i === 0) ctx.moveTo(toX(i), toY(v));
    else ctx.lineTo(toX(i), toY(v));
  });
  ctx.stroke();

  // Base Forecast (Dashed Vermilion)
  ctx.save();
  ctx.strokeStyle = pal.secondary;
  ctx.lineWidth = 2.0;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(toX(T - 1), toY(histVals[T - 1]));
  baseFc.forEach((v, h) => ctx.lineTo(toX(T + h), toY(v)));
  ctx.stroke();
  ctx.restore();

  // Reconciled Forecast (Solid Emerald)
  ctx.strokeStyle = pal.primary;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(toX(T - 1), toY(histVals[T - 1]));
  recFc.forEach((v, h) => ctx.lineTo(toX(T + h), toY(v)));
  ctx.stroke();

  ctx.fillStyle = pal.text;
  ctx.font = "600 11px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Node: ${node} — Solid Emerald: Reconciled (${hierarchyResult.reconciliationMethod}) | Dashed Red: Unreconciled Base`, pad.left, 16);
}
