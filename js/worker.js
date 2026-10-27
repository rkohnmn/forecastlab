/**
 * ForecastLab Web Worker for Background Computation (Rolling-Origin Backtesting & Grid Searches)
 *
 * Complies with Part 26.5:
 * - Supports progress reporting, cancellation, error reporting, and deterministic execution.
 */

import {
  fitForecastModel,
  runRollingOriginBacktest,
  evaluateChronologicalHoldout
} from "./math-engine.js";

let activeJobCancelled = false;

self.onmessage = function (event) {
  const { type, jobId, payload } = event.data || {};
  if (type === "CANCEL") {
    activeJobCancelled = true;
    self.postMessage({ type: "CANCELLED", jobId });
    return;
  }

  activeJobCancelled = false;
  try {
    if (type === "RUN_BACKTEST") {
      self.postMessage({ type: "PROGRESS", jobId, progress: 0.25, message: "Running rolling-origin cross-validation..." });
      if (activeJobCancelled) return;
      const result = runRollingOriginBacktest(
        payload.values,
        payload.timestamps,
        payload.modelConfig,
        payload.backtestConfig
      );
      self.postMessage({ type: "COMPLETE", jobId, result });
    } else if (type === "COMPARE_MODELS") {
      const models = payload.models || ["MEAN", "NAIVE", "SNAIVE", "DRIFT", "ETS_AUTO", "ARIMA_AUTO"];
      const comparison = [];
      for (let i = 0; i < models.length; i++) {
        if (activeJobCancelled) return;
        const mType = models[i];
        self.postMessage({
          type: "PROGRESS",
          jobId,
          progress: (i + 1) / models.length,
          message: `Fitting and evaluating ${mType} (${i + 1}/${models.length})...`
        });
        const holdout = evaluateChronologicalHoldout(
          payload.values,
          payload.timestamps,
          { ...payload.baseConfig, modelType: mType },
          payload.splitIndex
        );
        if (holdout.valid) {
          comparison.push(holdout);
        }
      }
      self.postMessage({ type: "COMPLETE", jobId, result: comparison });
    } else if (type === "FIT_MODEL") {
      const fit = fitForecastModel(payload.values, payload.timestamps, payload.modelConfig);
      self.postMessage({ type: "COMPLETE", jobId, result: fit });
    }
  } catch (err) {
    self.postMessage({ type: "ERROR", jobId, error: err.message || "Worker computation error" });
  }
};
