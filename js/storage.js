/**
 * ForecastLab Local-First Storage Wrapper & Privacy Audit Module
 *
 * Complies with:
 * - APPLICATION_GUIDELINES.md (Safe localStorage try/catch wrapping, zero external telemetry)
 * - Part 30 (Explicit session persistence, reset/deletion, privacy transparency)
 */

const STORAGE_KEY = "datasense_forecastlab_session_v1";

const memoryFallbackStore = new Map();

function isLocalStorageAvailable() {
  try {
    if (typeof localStorage === "undefined" || typeof localStorage.setItem !== "function" || typeof localStorage.getItem !== "function") {
      return false;
    }
    const testKey = "__forecastlab_storage_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch (_e) {
    return false;
  }
}

export function saveSessionToStorage(sessionPayload) {
  try {
    const serialized = JSON.stringify({
      version: "1.0.0",
      savedAt: new Date().toISOString(),
      payload: sessionPayload
    });
    if (isLocalStorageAvailable()) {
      localStorage.setItem(STORAGE_KEY, serialized);
    } else {
      memoryFallbackStore.set(STORAGE_KEY, serialized);
    }
    return { saved: true, bytes: serialized.length };
  } catch (err) {
    memoryFallbackStore.set(STORAGE_KEY, JSON.stringify({ payload: sessionPayload }));
    return { saved: false, fallback: "memory", reason: err.message };
  }
}

export function loadSessionFromStorage() {
  try {
    let raw = null;
    if (isLocalStorageAvailable()) {
      raw = localStorage.getItem(STORAGE_KEY);
    }
    if (!raw) {
      raw = memoryFallbackStore.get(STORAGE_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.payload) return null;
    return parsed.payload;
  } catch (_err) {
    return null;
  }
}

export function clearSessionStorage() {
  try {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(STORAGE_KEY);
    }
    memoryFallbackStore.delete(STORAGE_KEY);
    return { cleared: true };
  } catch (_err) {
    memoryFallbackStore.delete(STORAGE_KEY);
    return { cleared: false };
  }
}

export function getPrivacyAndStorageAudit() {
  let hasStoredSession = false;
  let storedBytes = 0;
  try {
    if (isLocalStorageAvailable()) {
      const item = localStorage.getItem(STORAGE_KEY);
      if (item) {
        hasStoredSession = true;
        storedBytes = item.length;
      }
    } else {
      const item = memoryFallbackStore.get(STORAGE_KEY);
      if (item) {
        hasStoredSession = true;
        storedBytes = item.length;
      }
    }
  } catch (_err) {
    hasStoredSession = false;
  }
  return {
    localFirstProcessing: true,
    externalNetworkCalls: 0,
    telemetryTrackers: 0,
    storageKey: STORAGE_KEY,
    hasStoredSession,
    storedBytes
  };
}

