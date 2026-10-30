import { assertInputSize, assertTableSize, assertHeaders, missingNumber, readDelimitedRecords } from './import-safety.js';
/** Normalize an observation import before replacing the current analysis. */
export function parseObservationJSON(text) {
  assertInputSize(text);
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error("This file is not valid JSON. Check its syntax and try again."); }
  if (!json || !Array.isArray(json.observations) || json.observations.length < 3) {
    throw new Error("Expected an observations array with at least 3 rows. A forecast-results export does not contain the source observations.");
  }
  const predictorKeys = new Set(json.observations.flatMap(row => Object.keys(row?.predictors || {})));
  assertTableSize(json.observations.length, 2 + predictorKeys.size);
  const numeric = (value, label) => {
    if (value == null || (typeof value === "string" && !value.trim())) return null;
    if (!["number", "string"].includes(typeof value) || !Number.isFinite(Number(value))) {
      throw new Error(`${label} must be a finite number or null.`);
    }
    return Number(value);
  };
  const observations = json.observations.map((row, i) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`Row ${i + 1} must be an observation object.`);
    const timestamp = row.timestamp ?? row.label ?? String(i + 1);
    if (!["string", "number"].includes(typeof timestamp)) throw new Error(`Row ${i + 1} has an invalid timestamp.`);
    const predictors = {};
    if (row.predictors != null) {
      if (typeof row.predictors !== "object" || Array.isArray(row.predictors)) throw new Error(`Row ${i + 1} has invalid predictors.`);
      for (const [key, value] of Object.entries(row.predictors)) {
        Object.defineProperty(predictors, key, {value: numeric(value, `Row ${i + 1}, predictor ${key}`), enumerable: true, writable: true, configurable: true});
      }
    }
    return {obs_id: String(row.obs_id ?? `t_${i + 1}`), timestamp: String(timestamp),
      value: numeric(row.value ?? row.response_y ?? row.observed_y, `Row ${i + 1}, value`), predictors};
  });
  if (observations.filter(o => o.value !== null).length < 3) throw new Error("Provide at least 3 numeric values; missing values can be represented by null.");
  return {observations, metadata: {
    id: typeof json.metadata?.id === "string" ? json.metadata.id : "imported_json",
    title: typeof json.metadata?.title === "string" ? json.metadata.title : "Imported Time Series",
    unit: typeof json.variables?.[1]?.unit === "string" ? json.variables[1].unit : "Units",
    predictorNames: [...new Set(observations.flatMap(o => Object.keys(o.predictors)))],
    hasPredictors: observations.some(o => Object.keys(o.predictors).length > 0)
  }};
}
