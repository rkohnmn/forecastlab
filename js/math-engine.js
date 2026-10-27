/**
 * ForecastLab Mathematical, Statistical, and Time-Series Engine
 * 
 * Complies with:
 * - STATISTICAL_STANDARDS.md (v1.0.0)
 * - DATA_CONVENTIONS.md (v1.0.0)
 * - APPLICATION_GUIDELINES.md (v1.0.0)
 * - Hyndman & Athanasopoulos, Forecasting: Principles and Practice (3rd ed., FPP3)
 *
 * Pure ES2022 module with zero external runtime dependencies.
 * Executes deterministically in both Web Browsers and Node.js (`node --test`).
 */

export const ENGINE_VERSION = "1.0.0";
export const EPSILON = 1.0e-12;
export const SINGULAR_THRESHOLD = 1.0e-11;

/* ==========================================================================
   SECTION 1: SEEDABLE PRNG & SPECIAL MATHEMATICAL FUNCTIONS
   ========================================================================== */

/**
 * Deterministic 32-bit Mulberry32 Pseudorandom Number Generator
 * @param {number} seed - Integer seed
 */
export function createPRNG(seed = 4289104) {
  let a = (seed >>> 0) || 4289104;
  function nextUniform() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  let hasSpare = false;
  let spare = 0;
  function nextGaussian(mean = 0, stdDev = 1) {
    if (hasSpare) {
      hasSpare = false;
      return mean + stdDev * spare;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    while (s >= 1 || s === 0) {
      u = nextUniform() * 2 - 1;
      v = nextUniform() * 2 - 1;
      s = u * u + v * v;
    }
    const mul = Math.sqrt((-2.0 * Math.log(s)) / s);
    spare = v * mul;
    hasSpare = true;
    return mean + stdDev * (u * mul);
  }
  return { nextUniform, nextGaussian, seed: a };
}

/**
 * Lanczos approximation (g = 7, n = 9) for ln(Gamma(z))
 */
export function logGamma(z) {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1.0 - z);
  }
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  let x = c[0];
  const zm1 = z - 1.0;
  for (let i = 1; i < 9; i++) {
    x += c[i] / (zm1 + i);
  }
  const t = zm1 + 7.5;
  return 0.5 * Math.log(2.0 * Math.PI) + (zm1 + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Regularized Incomplete Beta function I_x(a, b) via Lentz continued fraction
 */
export function regularizedBeta(x, a, b) {
  if (x <= 0) return 0.0;
  if (x >= 1) return 1.0;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1.0 - x)
  );
  if (x < (a + 1.0) / (a + b + 2.0)) {
    return (bt * betacf(x, a, b)) / a;
  }
  return 1.0 - (bt * betacf(1.0 - x, b, a)) / b;
}

function betacf(x, a, b) {
  const MAXIT = 200;
  const EPS = 3.0e-14;
  const FPMIN = 1.0e-30;
  const qab = a + b;
  const qap = a + 1.0;
  const qam = a - 1.0;
  let c = 1.0;
  let d = 1.0 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1.0 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < EPS) break;
  }
  return h;
}

/**
 * Upper Regularized Incomplete Gamma Q(a, x) for Chi-Squared p-values (Ljung-Box)
 */
export function regularizedGammaQ(a, x) {
  if (x <= 0.0 || a <= 0.0) return 1.0;
  if (x < a + 1.0) {
    let ap = a;
    let del = 1.0 / a;
    let sum = del;
    for (let n = 1; n <= 200; n++) {
      ap += 1.0;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 3.0e-14) {
        const p = sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
        return Math.max(0.0, Math.min(1.0, 1.0 - p));
      }
    }
    return 0.0;
  } else {
    const FPMIN = 1.0e-30;
    let b = x + 1.0 - a;
    let c = 1.0 / FPMIN;
    let d = 1.0 / b;
    let h = d;
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a);
      b += 2.0;
      d = an * d + b;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1.0 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1.0) < 3.0e-14) break;
    }
    const q = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
    return Math.max(0.0, Math.min(1.0, q));
  }
}

/**
 * Chi-Squared upper-tail p-value P(Chi^2_df >= qStat)
 */
export function chiSquarePValue(qStat, df) {
  if (!Number.isFinite(qStat) || qStat <= 0 || df <= 0) return 1.0;
  return regularizedGammaQ(0.5 * df, 0.5 * qStat);
}

/**
 * Two-sided Student-t p-value
 */
export function studentTTwoSidedPValue(tStat, df) {
  if (!Number.isFinite(tStat) || df <= 0) return 1.0;
  const x = df / (df + tStat * tStat);
  return Math.max(0.0, Math.min(1.0, regularizedBeta(x, 0.5 * df, 0.5)));
}

/**
 * Acklam's rational minimax approximation for Inverse Normal CDF Phi^-1(p)
 */
export function inverseNormalCDF(p) {
  const prob = Math.max(1e-12, Math.min(1 - 1e-12, p));
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
    3.754408661907416e+00
  ];
  const pLow = 0.02425;
  const pHigh = 1.0 - pLow;
  if (prob < pLow) {
    const q = Math.sqrt(-2.0 * Math.log(prob));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0);
  }
  if (prob <= pHigh) {
    const q = prob - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0);
  }
  const q = Math.sqrt(-2.0 * Math.log(1.0 - prob));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
          ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0);
}

/**
 * Student-t Critical Value for central confidence level (e.g. level = 0.95 -> two-sided alpha = 0.05)
 * Uses Cornish-Fisher initial expansion + 6 Newton-Raphson exact steps
 */
export function studentTCritical(df, level = 0.95) {
  const alpha = Math.max(1e-6, Math.min(0.9999, 1.0 - level));
  if (df <= 0 || !Number.isFinite(df)) return inverseNormalCDF(1.0 - 0.5 * alpha);
  if (df > 1e5) return inverseNormalCDF(1.0 - 0.5 * alpha);
  const z = inverseNormalCDF(1.0 - 0.5 * alpha);
  const g1 = (z * z * z + z) / 4.0;
  const g2 = (5 * Math.pow(z, 5) + 16 * Math.pow(z, 3) + 3 * z) / 96.0;
  let t = z + g1 / df + g2 / (df * df);
  for (let iter = 0; iter < 6; iter++) {
    const currentP = studentTTwoSidedPValue(t, df);
    const err = currentP - alpha;
    if (Math.abs(err) < 1e-12) break;
    const logPdf = logGamma(0.5 * (df + 1)) - logGamma(0.5 * df) - 0.5 * Math.log(df * Math.PI)
                   - 0.5 * (df + 1) * Math.log(1 + (t * t) / df);
    const twoSidedPdf = 2.0 * Math.exp(logPdf);
    if (twoSidedPdf > 1e-14) {
      t += err / twoSidedPdf;
    }
  }
  return Math.max(0.0, t);
}

export function studentTCritical95(df) {
  return studentTCritical(df, 0.95);
}

/**
 * Hyndman-Fan Type 7 Sample Quantile on a pre-sorted ascending array
 */
export function quantileSorted(sortedArr, q) {
  const n = sortedArr.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedArr[0];
  const prob = Math.max(0.0, Math.min(1.0, q));
  const k = (n - 1) * prob + 1;
  const j = Math.floor(k);
  const gamma = k - j;
  if (j <= 1 && gamma === 0) return sortedArr[0];
  if (j >= n) return sortedArr[n - 1];
  return (1.0 - gamma) * sortedArr[j - 1] + gamma * sortedArr[j];
}

/* ==========================================================================
   SECTION 2: DESCRIPTIVE STATISTICS & MATRIX SOLVERS
   ========================================================================== */

/**
 * Two-pass numerically stable univariate descriptive statistics
 */
export function computeUnivariateStats(values) {
  const valid = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== null && v !== undefined && Number.isFinite(Number(v))) {
      valid.push(Number(v));
    }
  }
  const n = valid.length;
  if (n === 0) {
    return {
      n: 0, missingCount: values.length, mean: NaN, variance: NaN, stdDev: NaN,
      median: NaN, q1: NaN, q3: NaN, iqr: NaN, mad: NaN, min: NaN, max: NaN,
      skewness: NaN, kurtosis: NaN
    };
  }
  let sum = 0.0;
  for (let i = 0; i < n; i++) sum += valid[i];
  const mean = sum / n;

  let m2 = 0.0;
  let m3 = 0.0;
  let m4 = 0.0;
  for (let i = 0; i < n; i++) {
    const d = valid[i] - mean;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
    m4 += d2 * d2;
  }
  const variance = n > 1 ? m2 / (n - 1) : 0.0;
  const stdDev = Math.sqrt(variance);
  const sorted = [...valid].sort((a, b) => a - b);
  const median = quantileSorted(sorted, 0.5);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;

  const absDevs = valid.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = 1.482602218505602 * quantileSorted(absDevs, 0.5);

  const popM2 = m2 / n;
  const g1 = popM2 > EPSILON ? (m3 / n) / Math.pow(popM2, 1.5) : 0.0;
  const skewness = n >= 3 ? (Math.sqrt(n * (n - 1)) / (n - 2)) * g1 : g1;
  const kurtosis = popM2 > EPSILON ? (m4 / n) / (popM2 * popM2) - 3.0 : 0.0;

  return {
    n,
    missingCount: values.length - n,
    mean,
    variance,
    stdDev,
    seMean: n > 0 ? stdDev / Math.sqrt(n) : NaN,
    median,
    q1,
    q3,
    iqr,
    mad,
    min: sorted[0],
    max: sorted[n - 1],
    skewness,
    kurtosis
  };
}

/**
 * Gaussian Elimination with Partial Pivoting for linear system A * x = b
 * Returns null if matrix is singular (pivot < SINGULAR_THRESHOLD)
 */
export function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, idx) => [...row, b[idx]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(M[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }
    if (maxVal < SINGULAR_THRESHOLD) return null;
    if (maxRow !== col) {
      const tmp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = tmp;
    }
    const pivot = M[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }
  const x = new Array(n).fill(0.0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }
  return x;
}

/**
 * Invert symmetric positive-definite matrix via Gauss-Jordan with partial pivoting
 */
export function invertMatrix(A) {
  const n = A.length;
  const M = A.map((row, i) => {
    const ext = new Array(n).fill(0.0);
    ext[i] = 1.0;
    return [...row, ...ext];
  });
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < SINGULAR_THRESHOLD) return null;
    if (maxRow !== col) {
      const tmp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = tmp;
    }
    const pivot = M[col][col];
    for (let k = 0; k < 2 * n; k++) M[col][k] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = M[row][col];
        for (let k = 0; k < 2 * n; k++) {
          M[row][k] -= factor * M[col][k];
        }
      }
    }
  }
  return M.map(row => row.slice(n, 2 * n));
}

/**
 * Nelder-Mead Derivative-Free Simplex Optimizer
 */
export function nelderMeadOptimize(objectiveFn, x0, options = {}) {
  const maxIter = options.maxIter || 350;
  const tol = options.tol || 1e-7;
  const step = options.step || 0.08;
  const n = x0.length;
  const alpha = 1.0;
  const gamma = 2.0;
  const rho = 0.5;
  const sigma = 0.5;

  const simplex = [{ x: [...x0], fx: objectiveFn(x0) }];
  for (let i = 0; i < n; i++) {
    const pt = [...x0];
    pt[i] += pt[i] !== 0 ? step * Math.abs(pt[i]) : step;
    simplex.push({ x: pt, fx: objectiveFn(pt) });
  }

  let iter = 0;
  let converged = false;
  while (iter < maxIter) {
    iter++;
    simplex.sort((a, b) => a.fx - b.fx);
    const fSpread = Math.abs(simplex[n].fx - simplex[0].fx);
    if (fSpread < tol) {
      converged = true;
      break;
    }
    const centroid = new Array(n).fill(0.0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i].x[j] / n;
    }
    const xr = centroid.map((c, j) => c + alpha * (c - simplex[n].x[j]));
    const fxr = objectiveFn(xr);

    if (fxr >= simplex[0].fx && fxr < simplex[n - 1].fx) {
      simplex[n] = { x: xr, fx: fxr };
      continue;
    }
    if (fxr < simplex[0].fx) {
      const xe = centroid.map((c, j) => c + gamma * (xr[j] - c));
      const fxe = objectiveFn(xe);
      simplex[n] = fxe < fxr ? { x: xe, fx: fxe } : { x: xr, fx: fxr };
      continue;
    }
    const xc = centroid.map((c, j) => c + rho * (simplex[n].x[j] - c));
    const fxc = objectiveFn(xc);
    if (fxc < simplex[n].fx) {
      simplex[n] = { x: xc, fx: fxc };
      continue;
    }
    for (let i = 1; i <= n; i++) {
      simplex[i].x = simplex[0].x.map((b, j) => b + sigma * (simplex[i].x[j] - b));
      simplex[i].fx = objectiveFn(simplex[i].x);
    }
  }
  simplex.sort((a, b) => a.fx - b.fx);
  return {
    x: simplex[0].x,
    fx: simplex[0].fx,
    iterations: iter,
    converged
  };
}

/* ==========================================================================
   SECTION 3: TEMPORAL DATA ENGINE, FREQUENCY INFERENCE & VALIDATION
   ========================================================================== */

export const SUPPORTED_FREQUENCIES = {
  annual: { label: "Annual (Y)", seasonalPeriod: 1, approxDays: 365.25 },
  quarterly: { label: "Quarterly (Q)", seasonalPeriod: 4, approxDays: 91.3125 },
  monthly: { label: "Monthly (M)", seasonalPeriod: 12, approxDays: 30.4375 },
  weekly: {
    label: "Weekly (W)",
    seasonalPeriod: 52,
    approxDays: 7,
    caveat: "Exact calendar year has 365.25/7 ≈ 52.18 weeks; m=52 is a discrete seasonal approximation."
  },
  daily: { label: "Daily (D)", seasonalPeriod: 7, secondaryPeriod: 365, approxDays: 1 },
  hourly: { label: "Hourly (H)", seasonalPeriod: 24, secondaryPeriod: 168, approxDays: 1 / 24 },
  subhourly: { label: "Half-Hourly (30m)", seasonalPeriod: 48, approxDays: 1 / 48 },
  index: { label: "Regular Integer Index", seasonalPeriod: 1, approxDays: null }
};

/**
 * Parse diverse temporal strings (YYYY, YYYY-Q1, YYYY-MM, YYYY-MM-DD, ISO timestamps, or integer index)
 * into a standardized numeric epoch millisecond or index value and canonical label.
 */
export function parseTimeToken(rawToken) {
  if (rawToken === null || rawToken === undefined) {
    return { valid: false, raw: String(rawToken) };
  }
  const str = String(rawToken).trim();
  if (!str) return { valid: false, raw: str };

  // Check YYYY-Q[1-4] or YYYYQ[1-4]
  const qMatch = str.match(/^(\d{4})[-/\s]?[Qq]([1-4])$/);
  if (qMatch) {
    const year = Number(qMatch[1]);
    const q = Number(qMatch[2]);
    const month = (q - 1) * 3;
    const ms = Date.UTC(year, month, 1);
    return {
      valid: true,
      kind: "quarterly",
      epochMs: ms,
      year,
      quarter: q,
      month: month + 1,
      canonical: `${year}-Q${q}`
    };
  }

  // Check YYYY-MM
  const mMatch = str.match(/^(\d{4})[-/](\d{1,2})$/);
  if (mMatch) {
    const year = Number(mMatch[1]);
    const month = Number(mMatch[2]);
    if (month >= 1 && month <= 12) {
      const ms = Date.UTC(year, month - 1, 1);
      return {
        valid: true,
        kind: "monthly",
        epochMs: ms,
        year,
        month,
        canonical: `${year}-${String(month).padStart(2, "0")}`
      };
    }
  }

  // Check pure 4-digit year YYYY
  const yMatch = str.match(/^(\d{4})$/);
  if (yMatch) {
    const year = Number(yMatch[1]);
    if (year >= 1000 && year <= 2999) {
      return {
        valid: true,
        kind: "annual",
        epochMs: Date.UTC(year, 0, 1),
        year,
        canonical: `${year}`
      };
    }
  }

  // Check pure integer index (e.g. 1, 2, 3...)
  if (/^-?\d+$/.test(str)) {
    const idx = Number(str);
    return {
      valid: true,
      kind: "index",
      epochMs: idx,
      indexValue: idx,
      canonical: String(idx)
    };
  }

  // Standard ISO YYYY-MM-DD or datetime
  const isoDateMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:Z|([+-]\d{2}:?\d{2}))?)?$/);
  if (isoDateMatch) {
    const year = Number(isoDateMatch[1]);
    const month = Number(isoDateMatch[2]);
    const day = Number(isoDateMatch[3]);
    const hour = isoDateMatch[4] !== undefined ? Number(isoDateMatch[4]) : 0;
    const minute = isoDateMatch[5] !== undefined ? Number(isoDateMatch[5]) : 0;
    const second = isoDateMatch[6] !== undefined ? Number(isoDateMatch[6]) : 0;
    const ms = Date.UTC(year, month - 1, day, hour, minute, second);
    const hasTime = isoDateMatch[4] !== undefined;
    const canonical = hasTime
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      : `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      valid: true,
      kind: hasTime ? "datetime" : "date",
      epochMs: ms,
      year,
      month,
      day,
      hour,
      minute,
      canonical
    };
  }

  const parsedMs = Date.parse(str);
  if (Number.isFinite(parsedMs)) {
    const d = new Date(parsedMs);
    return {
      valid: true,
      kind: "date",
      epochMs: parsedMs,
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      canonical: d.toISOString().slice(0, 10)
    };
  }

  return { valid: false, raw: str };
}

/**
 * Advance a canonical timestamp by h steps according to frequency semantics
 * Respects variable month lengths and leap years rather than assuming 30-day months.
 */
export function generateFutureTimestamps(lastTimeStr, frequency, horizon, seasonalPeriod = 12) {
  const parsed = parseTimeToken(lastTimeStr);
  const out = [];
  if (!parsed.valid || parsed.kind === "index" || frequency === "index") {
    const base = parsed.valid && Number.isFinite(parsed.epochMs) ? parsed.epochMs : 0;
    for (let h = 1; h <= horizon; h++) {
      out.push(String(base + h));
    }
    return out;
  }

  for (let h = 1; h <= horizon; h++) {
    if (frequency === "annual" || parsed.kind === "annual") {
      out.push(`${parsed.year + h}`);
    } else if (frequency === "quarterly" || parsed.kind === "quarterly") {
      const totalQ = (parsed.year * 4 + ((parsed.quarter || Math.ceil((parsed.month || 1) / 3)) - 1)) + h;
      const y = Math.floor(totalQ / 4);
      const q = (totalQ % 4) + 1;
      out.push(`${y}-Q${q}`);
    } else if (frequency === "monthly" || parsed.kind === "monthly") {
      const totalM = (parsed.year * 12 + ((parsed.month || 1) - 1)) + h;
      const y = Math.floor(totalM / 12);
      const m = (totalM % 12) + 1;
      out.push(`${y}-${String(m).padStart(2, "0")}`);
    } else if (frequency === "weekly") {
      const d = new Date(parsed.epochMs + h * 7 * 86400000);
      out.push(d.toISOString().slice(0, 10));
    } else if (frequency === "daily") {
      const d = new Date(parsed.epochMs + h * 86400000);
      out.push(d.toISOString().slice(0, 10));
    } else if (frequency === "hourly") {
      const d = new Date(parsed.epochMs + h * 3600000);
      out.push(`${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`);
    } else if (frequency === "subhourly") {
      const d = new Date(parsed.epochMs + h * 1800000);
      out.push(`${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`);
    } else {
      const d = new Date(parsed.epochMs + h * 86400000);
      out.push(d.toISOString().slice(0, 10));
    }
  }
  return out;
}

/**
 * Validate and profile a temporal series, checking chronological order, duplicates,
 * missing calendar dates vs missing numerical values, genuine zeros, and structural breaks.
 */
export function validateTemporalSeries(records, options = {}) {
  const timeField = options.timeField || "timestamp";
  const valueField = options.valueField || "value";
  const keyField = options.keyField || null;
  const targetKey = options.targetKey || null;

  const warnings = [];
  const errors = [];
  const filtered = keyField && targetKey !== null
    ? records.filter(r => String(r[keyField]) === String(targetKey))
    : records;

  if (!filtered || filtered.length === 0) {
    return {
      valid: false,
      errors: ["No observations found for selected series."],
      warnings: [],
      observations: []
    };
  }

  const parsedRows = [];
  let unparseableDateCount = 0;
  let wasOutOfOrder = false;
  let prevEpoch = -Infinity;

  for (let i = 0; i < filtered.length; i++) {
    const row = filtered[i];
    const tParsed = parseTimeToken(row[timeField]);
    if (!tParsed.valid) {
      unparseableDateCount++;
      continue;
    }
    if (tParsed.epochMs < prevEpoch) {
      wasOutOfOrder = true;
    }
    prevEpoch = tParsed.epochMs;

    const rawVal = row[valueField];
    let numVal = null;
    let missingReason = null;
    if (rawVal === null || rawVal === undefined || String(rawVal).trim() === "" || String(rawVal).trim() === "NA" || String(rawVal).trim() === "null") {
      numVal = null;
      missingReason = row.missing_reason || "missing_recorded_value";
    } else {
      const parsedNum = Number(rawVal);
      if (Number.isFinite(parsedNum)) {
        numVal = parsedNum;
      } else {
        numVal = null;
        missingReason = "nonfinite_token";
      }
    }

    parsedRows.push({
      originalRowIndex: i,
      obs_id: row.obs_id || `t_${i + 1}`,
      timestamp: tParsed.canonical,
      epochMs: tParsed.epochMs,
      kind: tParsed.kind,
      value: numVal,
      isZero: numVal === 0,
      isMissing: numVal === null,
      missingReason,
      isImputed: Boolean(row.is_imputed),
      predictors: row.predictors || {},
      rawRow: row
    });
  }

  if (unparseableDateCount > 0) {
    warnings.push(`${unparseableDateCount} row(s) had unparseable timestamps and were excluded.`);
  }
  if (parsedRows.length < 3) {
    return {
      valid: false,
      errors: ["At least 3 valid time-indexed observations are required."],
      warnings,
      observations: parsedRows
    };
  }

  // Sort chronologically if out of order
  if (wasOutOfOrder) {
    warnings.push("Observations were not in strict chronological order; sorted ascending by timestamp.");
    parsedRows.sort((a, b) => a.epochMs - b.epochMs);
  }

  // Detect duplicate timestamps
  const deduped = [];
  let duplicateCount = 0;
  for (let i = 0; i < parsedRows.length; i++) {
    if (i > 0 && parsedRows[i].epochMs === parsedRows[i - 1].epochMs) {
      duplicateCount++;
      continue;
    }
    deduped.push(parsedRows[i]);
  }
  if (duplicateCount > 0) {
    warnings.push(`Detected ${duplicateCount} duplicate timestamp(s); retained first occurrence per timestamp.`);
  }

  // Infer frequency from deltas
  const deltas = [];
  for (let i = 1; i < deduped.length; i++) {
    deltas.push(deduped[i].epochMs - deduped[i - 1].epochMs);
  }
  const sortedDeltas = [...deltas].sort((a, b) => a - b);
  const medianDelta = quantileSorted(sortedDeltas, 0.5);

  let inferredFrequency = options.frequencyOverride || null;
  if (!inferredFrequency) {
    const firstKind = deduped[0].kind;
    if (firstKind === "quarterly") inferredFrequency = "quarterly";
    else if (firstKind === "monthly") inferredFrequency = "monthly";
    else if (firstKind === "annual") inferredFrequency = "annual";
    else if (firstKind === "index") inferredFrequency = "index";
    else {
      const days = medianDelta / 86400000;
      if (days >= 350 && days <= 380) inferredFrequency = "annual";
      else if (days >= 85 && days <= 95) inferredFrequency = "quarterly";
      else if (days >= 27 && days <= 32) inferredFrequency = "monthly";
      else if (days >= 6.5 && days <= 7.5) inferredFrequency = "weekly";
      else if (days >= 0.9 && days <= 1.1) inferredFrequency = "daily";
      else if (Math.abs(days - 1 / 24) < 0.01) inferredFrequency = "hourly";
      else if (Math.abs(days - 1 / 48) < 0.005) inferredFrequency = "subhourly";
      else inferredFrequency = "index";
    }
  }

  const freqMeta = SUPPORTED_FREQUENCIES[inferredFrequency] || SUPPORTED_FREQUENCIES.index;
  const seasonalPeriod = options.seasonalPeriodOverride !== undefined
    ? Number(options.seasonalPeriodOverride)
    : freqMeta.seasonalPeriod;

  // Detect irregular intervals and implicit calendar gaps
  let gapCount = 0;
  let irregularCount = 0;
  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i];
    if (inferredFrequency === "monthly") {
      const days = d / 86400000;
      if (days > 35) gapCount += Math.round(days / 30.4375) - 1;
      else if (days < 27) irregularCount++;
    } else if (inferredFrequency === "quarterly") {
      const days = d / 86400000;
      if (days > 100) gapCount += Math.round(days / 91.3125) - 1;
    } else if (medianDelta > 0) {
      const ratio = d / medianDelta;
      if (ratio > 1.8 && Math.abs(ratio - Math.round(ratio)) < 0.15) {
        gapCount += Math.round(ratio) - 1;
      } else if (Math.abs(ratio - 1.0) > 0.15) {
        irregularCount++;
      }
    }
  }

  if (gapCount > 0) {
    warnings.push(`Detected ${gapCount} implicit calendar gap(s) where expected timestamps are missing.`);
  }
  if (irregularCount > 0) {
    warnings.push(`Detected ${irregularCount} irregular spacing interval(s). Classical time-series models require regular spacing.`);
  }
  if (inferredFrequency === "weekly") {
    warnings.push(SUPPORTED_FREQUENCIES.weekly.caveat);
  }

  const numericValues = deduped.map(d => d.value);
  const stats = computeUnivariateStats(numericValues);
  const zeroCount = deduped.filter(d => d.isZero).length;
  const missingValueCount = deduped.filter(d => d.isMissing).length;

  if (stats.stdDev < EPSILON) {
    warnings.push("Series is constant (zero variance). Autocorrelation and dynamic parameters are undefined.");
  }
  if (seasonalPeriod > 1 && stats.n < 2 * seasonalPeriod) {
    warnings.push(`Series has ${stats.n} complete observations (< 2 seasonal cycles of m=${seasonalPeriod}). Full seasonal decomposition and seasonal ARIMA are restricted.`);
  }

  return {
    valid: true,
    inferredFrequency,
    seasonalPeriod,
    secondaryPeriod: freqMeta.secondaryPeriod || null,
    totalRows: deduped.length,
    completeCount: stats.n,
    missingValueCount,
    implicitGapCount: gapCount,
    irregularIntervalCount: irregularCount,
    duplicateTimestampCount: duplicateCount,
    zeroValueCount: zeroCount,
    wasOutOfOrder,
    stats,
    warnings,
    errors,
    observations: deduped
  };
}

/**
 * Training-only imputation for missing recorded values (null / NaN).
 * Never leaks future test observations into training imputation.
 */
export function imputeSeriesTrainingOnly(observations, method = "linear") {
  const out = observations.map(o => ({ ...o }));
  if (method === "none") return out;

  const n = out.length;
  if (method === "locf") {
    let lastValid = null;
    for (let i = 0; i < n; i++) {
      if (out[i].value !== null && Number.isFinite(out[i].value)) {
        lastValid = out[i].value;
      } else if (lastValid !== null) {
        out[i].value = lastValid;
        out[i].isImputed = true;
        out[i].isMissing = false;
      }
    }
    // Backfill leading missing values from first valid within this window
    const firstValid = out.find(o => o.value !== null && Number.isFinite(o.value));
    if (firstValid) {
      for (let i = 0; i < n; i++) {
        if (out[i].value === null) {
          out[i].value = firstValid.value;
          out[i].isImputed = true;
          out[i].isMissing = false;
        }
      }
    }
    return out;
  }

  // Linear interpolation inside the provided (training) array
  for (let i = 0; i < n; i++) {
    if (out[i].value === null || !Number.isFinite(out[i].value)) {
      let prevIdx = i - 1;
      while (prevIdx >= 0 && (out[prevIdx].value === null || !Number.isFinite(out[prevIdx].value))) {
        prevIdx--;
      }
      let nextIdx = i + 1;
      while (nextIdx < n && (out[nextIdx].value === null || !Number.isFinite(out[nextIdx].value))) {
        nextIdx++;
      }
      if (prevIdx >= 0 && nextIdx < n) {
        const weight = (i - prevIdx) / (nextIdx - prevIdx);
        out[i].value = out[prevIdx].value + weight * (out[nextIdx].value - out[prevIdx].value);
        out[i].isImputed = true;
        out[i].isMissing = false;
      } else if (prevIdx >= 0) {
        out[i].value = out[prevIdx].value;
        out[i].isImputed = true;
        out[i].isMissing = false;
      } else if (nextIdx < n) {
        out[i].value = out[nextIdx].value;
        out[i].isImputed = true;
        out[i].isMissing = false;
      }
    }
  }
  return out;
}

/* ==========================================================================
   SECTION 4: TRANSFORMATIONS & BACK-TRANSFORMATIONS (WITH BIAS ADJUSTMENT)
   ========================================================================== */

/**
 * Guerrero's (1993) method to select Box-Cox lambda minimizing the coefficient of variation
 * across seasonal subseries on positive data.
 */
export function estimateBoxCoxLambda(values, seasonalPeriod = 12) {
  const clean = values.filter(v => Number.isFinite(v) && v > 0);
  const subLen = Math.max(2, seasonalPeriod > 1 ? seasonalPeriod : 4);
  if (clean.length < 2 * subLen) return 1.0;

  const numGroups = Math.floor(clean.length / subLen);
  const groupMeans = [];
  const groupStds = [];
  for (let g = 0; g < numGroups; g++) {
    const slice = clean.slice(g * subLen, (g + 1) * subLen);
    const st = computeUnivariateStats(slice);
    if (st.mean > 0 && st.stdDev > 0) {
      groupMeans.push(st.mean);
      groupStds.push(st.stdDev);
    }
  }
  if (groupMeans.length < 2) return 1.0;

  let bestLambda = 1.0;
  let bestCV = Infinity;
  for (let l = -100; l <= 200; l++) {
    const lambda = l / 100.0;
    const ratios = groupMeans.map((m, idx) => groupStds[idx] / Math.pow(m, 1.0 - lambda));
    const st = computeUnivariateStats(ratios);
    if (st.mean > EPSILON) {
      const cv = st.stdDev / st.mean;
      if (cv < bestCV) {
        bestCV = cv;
        bestLambda = lambda;
      }
    }
  }
  return Math.round(bestLambda * 100) / 100;
}

/**
 * Forward Box-Cox or mathematical transformation
 */
export function applyForwardTransform(values, config = { type: "none" }) {
  const type = config.type || "none";
  if (type === "none") {
    return { valid: true, type: "none", values: [...values], params: {} };
  }
  if (type === "log") {
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== null && values[i] <= 0) {
        return { valid: false, reason: "Logarithmic transformation requires strictly positive observations (y_t > 0)." };
      }
    }
    return {
      valid: true,
      type: "log",
      values: values.map(v => (v === null ? null : Math.log(v))),
      params: { lambda: 0.0 }
    };
  }
  if (type === "boxcox") {
    const lambda = config.lambda !== undefined ? Number(config.lambda) : 0.5;
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== null && values[i] <= 0) {
        return { valid: false, reason: "Box-Cox transformation requires strictly positive observations (y_t > 0)." };
      }
    }
    const transformed = values.map(v => {
      if (v === null) return null;
      return Math.abs(lambda) < 1e-8 ? Math.log(v) : (Math.pow(v, lambda) - 1.0) / lambda;
    });
    return {
      valid: true,
      type: "boxcox",
      values: transformed,
      params: { lambda }
    };
  }
  if (type === "diff1") {
    const out = [null];
    for (let i = 1; i < values.length; i++) {
      out.push(values[i] !== null && values[i - 1] !== null ? values[i] - values[i - 1] : null);
    }
    return {
      valid: true,
      type: "diff1",
      values: out,
      params: { initialValue: values[0], lastValue: values[values.length - 1] }
    };
  }
  if (type === "seasonal_diff") {
    const m = Math.max(1, Number(config.seasonalPeriod || 12));
    const out = new Array(values.length).fill(null);
    for (let i = m; i < values.length; i++) {
      out[i] = values[i] !== null && values[i - m] !== null ? values[i] - values[i - m] : null;
    }
    return {
      valid: true,
      type: "seasonal_diff",
      values: out,
      params: { seasonalPeriod: m, tailSeason: values.slice(-m) }
    };
  }
  if (type === "standardize") {
    const st = computeUnivariateStats(values);
    const sd = st.stdDev > EPSILON ? st.stdDev : 1.0;
    return {
      valid: true,
      type: "standardize",
      values: values.map(v => (v === null ? null : (v - st.mean) / sd)),
      params: { mean: st.mean, stdDev: sd }
    };
  }
  if (type === "growth_rate") {
    const out = [null];
    for (let i = 1; i < values.length; i++) {
      if (values[i] !== null && values[i - 1] !== null && Math.abs(values[i - 1]) > EPSILON) {
        out.push(((values[i] - values[i - 1]) / values[i - 1]) * 100.0);
      } else {
        out.push(null);
      }
    }
    return { valid: true, type: "growth_rate", values: out, params: {} };
  }
  return { valid: true, type: "none", values: [...values], params: {} };
}

/**
 * Inverse Box-Cox / Log / Standardization back-transformation with optional FPP3 Section 5.6
 * second-order Taylor bias adjustment so point forecasts represent original-scale means rather than medians.
 */
export function backTransformValue(w, variance = 0.0, transformConfig = { type: "none" }, biasAdjust = false) {
  if (w === null || !Number.isFinite(w)) return null;
  const type = transformConfig.type || "none";
  if (type === "none") return w;

  if (type === "log" || (type === "boxcox" && Math.abs(transformConfig.lambda || 0) < 1e-8)) {
    const medianBack = Math.exp(w);
    if (biasAdjust && Number.isFinite(variance) && variance > 0) {
      return medianBack * (1.0 + 0.5 * variance);
    }
    return medianBack;
  }

  if (type === "boxcox") {
    const lambda = Number(transformConfig.lambda);
    const base = lambda * w + 1.0;
    if (base <= 0) return 0.0;
    const medianBack = Math.pow(base, 1.0 / lambda);
    if (biasAdjust && Number.isFinite(variance) && variance > 0) {
      const correction = 1.0 + (variance * (1.0 - lambda)) / (2.0 * base * base);
      return medianBack * Math.max(0.1, correction);
    }
    return medianBack;
  }

  if (type === "standardize") {
    const mean = transformConfig.mean || 0.0;
    const sd = transformConfig.stdDev || 1.0;
    return mean + sd * w;
  }
  return w;
}

/* ==========================================================================
   SECTION 5: EXPLORATORY TIME-SERIES ANALYSIS (ACF, PACF, LJUNG-BOX, FEATURES)
   ========================================================================== */

/**
 * Sample Autocorrelation Function (ACF) up to maxLag
 * Returns lags k = 1 ... maxLag, values r_k, and Bartlett 95% white-noise bounds
 */
export function computeACF(values, maxLag = 24) {
  const clean = values.filter(v => v !== null && Number.isFinite(v));
  const T = clean.length;
  if (T < 3) {
    return { valid: false, n: T, lags: [], acf: [], bartlettBound: NaN };
  }
  const st = computeUnivariateStats(clean);
  const mean = st.mean;
  let gamma0 = 0.0;
  for (let t = 0; t < T; t++) {
    const d = clean[t] - mean;
    gamma0 += d * d;
  }
  gamma0 /= T;

  const K = Math.min(maxLag, T - 1);
  const lags = [];
  const acf = [];
  if (gamma0 < EPSILON) {
    for (let k = 1; k <= K; k++) {
      lags.push(k);
      acf.push(0.0);
    }
    return { valid: true, n: T, lags, acf, bartlettBound: 1.96 / Math.sqrt(T), isConstant: true };
  }

  for (let k = 1; k <= K; k++) {
    let cov = 0.0;
    for (let t = k; t < T; t++) {
      cov += (clean[t] - mean) * (clean[t - k] - mean);
    }
    cov /= T;
    lags.push(k);
    acf.push(Math.max(-1.0, Math.min(1.0, cov / gamma0)));
  }

  return {
    valid: true,
    n: T,
    lags,
    acf,
    bartlettBound: 1.96 / Math.sqrt(T),
    isConstant: false
  };
}

/**
 * Sample Partial Autocorrelation Function (PACF) via Durbin-Levinson Recursion
 */
export function computePACF(values, maxLag = 24) {
  const acfRes = computeACF(values, maxLag);
  if (!acfRes.valid) return { valid: false, n: acfRes.n, lags: [], pacf: [], bound: NaN };
  const K = acfRes.lags.length;
  if (K === 0 || acfRes.isConstant) {
    return { valid: true, n: acfRes.n, lags: acfRes.lags, pacf: new Array(K).fill(0.0), bound: acfRes.bartlettBound };
  }

  const r = acfRes.acf;
  const phi = Array.from({ length: K + 1 }, () => new Array(K + 1).fill(0.0));
  const pacf = [];

  phi[1][1] = r[0];
  pacf.push(phi[1][1]);

  for (let k = 2; k <= K; k++) {
    let num = r[k - 1];
    let den = 1.0;
    for (let j = 1; j <= k - 1; j++) {
      num -= phi[k - 1][j] * r[k - 1 - j];
      den -= phi[k - 1][j] * r[j - 1];
    }
    const phikk = Math.abs(den) > EPSILON ? Math.max(-1.0, Math.min(1.0, num / den)) : 0.0;
    phi[k][k] = phikk;
    for (let j = 1; j <= k - 1; j++) {
      phi[k][j] = phi[k - 1][j] - phikk * phi[k - 1][k - j];
    }
    pacf.push(phikk);
  }

  return {
    valid: true,
    n: acfRes.n,
    lags: acfRes.lags,
    pacf,
    bound: acfRes.bartlettBound
  };
}

/**
 * Ljung-Box Portmanteau Q* test for serial correlation in residuals
 * Q* = T(T + 2) * sum_{k=1}^L (r_k^2 / (T - k))
 * Degrees of freedom = max(1, L - fittedParamCount)
 */
export function ljungBoxTest(residuals, maxLag = 10, fittedParamCount = 0) {
  const clean = residuals.filter(v => v !== null && Number.isFinite(v));
  const T = clean.length;
  if (T < 4) {
    return { valid: false, Q: 0, df: 1, pValue: 1.0, lag: 0, significant: false };
  }
  const L = Math.min(maxLag, Math.floor(T / 2));
  const acfRes = computeACF(clean, L);
  let sum = 0.0;
  for (let k = 1; k <= L; k++) {
    const rk = acfRes.acf[k - 1] || 0.0;
    sum += (rk * rk) / (T - k);
  }
  const Q = T * (T + 2) * sum;
  const df = Math.max(1, L - fittedParamCount);
  const pValue = chiSquarePValue(Q, df);
  return {
    valid: true,
    Q,
    df,
    lag: L,
    fittedParamCount,
    pValue,
    significant: pValue < 0.05
  };
}

/**
 * Aligned Lag Pairs (y_{t-k}, y_t) for Lag Plot inspection
 */
export function computeLagPairs(values, timestamps, lag = 1) {
  const k = Math.max(1, Math.floor(lag));
  const pairs = [];
  for (let t = k; t < values.length; t++) {
    if (values[t] !== null && values[t - k] !== null && Number.isFinite(values[t]) && Number.isFinite(values[t - k])) {
      pairs.push({
        tIndex: t,
        timestamp: timestamps ? timestamps[t] : `t_${t + 1}`,
        lagTimestamp: timestamps ? timestamps[t - k] : `t_${t - k + 1}`,
        xLag: values[t - k],
        yCurrent: values[t]
      });
    }
  }
  let r = 0.0;
  if (pairs.length >= 3) {
    const mx = pairs.reduce((s, p) => s + p.xLag, 0) / pairs.length;
    const my = pairs.reduce((s, p) => s + p.yCurrent, 0) / pairs.length;
    let sxy = 0, sxx = 0, syy = 0;
    for (const p of pairs) {
      sxy += (p.xLag - mx) * (p.yCurrent - my);
      sxx += (p.xLag - mx) ** 2;
      syy += (p.yCurrent - my) ** 2;
    }
    r = sxx > EPSILON && syy > EPSILON ? sxy / Math.sqrt(sxx * syy) : 0.0;
  }
  return { lag: k, count: pairs.length, correlation: r, pairs };
}

/* ==========================================================================
   SECTION 6: DECOMPOSITION LABORATORY (MA, CLASSICAL, STL LOESS, MSTL)
   ========================================================================== */

/**
 * Symmetric Moving-Average Smoothing (supports k-MA and centered 2xK-MA for even m)
 */
export function movingAverageSmooth(values, order = 5, centerEven = true) {
  const n = values.length;
  const k = Math.max(1, Math.floor(order));
  if (k === 1) return [...values];

  const simpleMA = (arr, windowSize) => {
    const res = new Array(arr.length).fill(null);
    const half = Math.floor(windowSize / 2);
    for (let i = 0; i < arr.length; i++) {
      const start = windowSize % 2 === 1 ? i - half : i - half;
      const end = windowSize % 2 === 1 ? i + half : i + half - 1;
      if (start < 0 || end >= arr.length) continue;
      let sum = 0;
      let ok = true;
      for (let j = start; j <= end; j++) {
        if (arr[j] === null || !Number.isFinite(arr[j])) {
          ok = false;
          break;
        }
        sum += arr[j];
      }
      if (ok) res[i] = sum / windowSize;
    }
    return res;
  };

  if (k % 2 === 1) {
    return simpleMA(values, k);
  }
  // Even order: apply 2 x k-MA centered symmetric average
  const res = new Array(n).fill(null);
  const half = k / 2;
  for (let i = half; i < n - half; i++) {
    let sum = 0.0;
    let ok = true;
    for (let j = i - half; j <= i + half; j++) {
      if (values[j] === null || !Number.isFinite(values[j])) {
        ok = false;
        break;
      }
      const weight = (j === i - half || j === i + half) ? 0.5 / k : 1.0 / k;
      sum += weight * values[j];
    }
    if (ok) res[i] = sum;
  }
  return res;
}

/**
 * Local linear regression (LOESS) smoother at target index t0 with tricube kernel
 * and optional outer-loop robustness weights rho_i.
 */
function loessSmoothPoint(y, t0, span, degree = 1, robustnessWeights = null) {
  const n = y.length;
  const q = Math.max(3, Math.min(n, Math.floor(span)));
  // Find q nearest valid neighbors to t0
  const dists = [];
  for (let i = 0; i < n; i++) {
    if (y[i] !== null && Number.isFinite(y[i])) {
      dists.push({ idx: i, dist: Math.abs(i - t0) });
    }
  }
  if (dists.length === 0) return null;
  dists.sort((a, b) => a.dist - b.dist);
  const neighbors = dists.slice(0, Math.min(q, dists.length));
  const maxDist = Math.max(1.0, neighbors[neighbors.length - 1].dist);

  let sw = 0.0;
  let swx = 0.0;
  let swy = 0.0;
  let swxx = 0.0;
  let swxy = 0.0;

  for (let k = 0; k < neighbors.length; k++) {
    const idx = neighbors[k].idx;
    const u = neighbors[k].dist / (maxDist * 1.0001);
    const tricube = Math.pow(1.0 - Math.pow(u, 3), 3);
    const rob = robustnessWeights ? robustnessWeights[idx] : 1.0;
    const w = tricube * rob;
    const x = idx - t0;
    const val = y[idx];
    sw += w;
    swx += w * x;
    swy += w * val;
    swxx += w * x * x;
    swxy += w * x * val;
  }

  if (sw < EPSILON) {
    return neighbors.reduce((s, nb) => s + y[nb.idx], 0) / neighbors.length;
  }
  if (degree === 0) {
    return swy / sw;
  }
  const denom = sw * swxx - swx * swx;
  if (Math.abs(denom) < EPSILON) {
    return swy / sw;
  }
  // Intercept at x = 0 corresponds to fitted value at t0
  return (swxx * swy - swx * swxy) / denom;
}

function loessSmoothArray(y, span, degree = 1, robustnessWeights = null) {
  const n = y.length;
  const out = new Array(n);
  for (let t = 0; t < n; t++) {
    out[t] = loessSmoothPoint(y, t, span, degree, robustnessWeights);
  }
  return out;
}

/**
 * Classical Additive or Multiplicative Time-Series Decomposition
 */
export function classicalDecomposition(values, seasonalPeriod = 12, type = "additive") {
  const n = values.length;
  const m = Math.max(1, Math.floor(seasonalPeriod));
  if (type === "multiplicative") {
    for (let i = 0; i < n; i++) {
      if (values[i] !== null && values[i] <= 0) {
        return {
          valid: false,
          reason: "Multiplicative decomposition requires strictly positive values (y_t > 0). Use additive decomposition or Box-Cox transformation."
        };
      }
    }
  }
  if (m > 1 && n < 2 * m) {
    return {
      valid: false,
      reason: `Classical decomposition with period m=${m} requires at least 2 full seasonal cycles (${2 * m} observations).`
    };
  }

  const trend = m > 1
    ? movingAverageSmooth(values, m, true)
    : loessSmoothArray(values, Math.max(5, Math.floor(n * 0.3)), 1);

  const seasonal = new Array(n).fill(type === "multiplicative" ? 1.0 : 0.0);
  if (m > 1) {
    const detrended = values.map((v, i) => {
      if (v === null || trend[i] === null) return null;
      return type === "multiplicative" ? v / trend[i] : v - trend[i];
    });
    const seasonalMeans = new Array(m).fill(0.0);
    for (let s = 0; s < m; s++) {
      let sum = 0.0;
      let count = 0;
      for (let i = s; i < n; i += m) {
        if (detrended[i] !== null && Number.isFinite(detrended[i])) {
          sum += detrended[i];
          count++;
        }
      }
      seasonalMeans[s] = count > 0 ? sum / count : (type === "multiplicative" ? 1.0 : 0.0);
    }
    // Normalize seasonal indices so they average to 0 (additive) or 1 (multiplicative)
    const avgS = seasonalMeans.reduce((a, b) => a + b, 0) / m;
    for (let s = 0; s < m; s++) {
      seasonalMeans[s] = type === "multiplicative"
        ? (avgS > EPSILON ? seasonalMeans[s] / avgS : 1.0)
        : seasonalMeans[s] - avgS;
    }
    for (let i = 0; i < n; i++) {
      seasonal[i] = seasonalMeans[i % m];
    }
  }

  const remainder = new Array(n).fill(null);
  const seasonallyAdjusted = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (values[i] !== null) {
      seasonallyAdjusted[i] = type === "multiplicative" ? values[i] / seasonal[i] : values[i] - seasonal[i];
      if (trend[i] !== null) {
        remainder[i] = type === "multiplicative"
          ? values[i] / (trend[i] * seasonal[i])
          : values[i] - trend[i] - seasonal[i];
      }
    }
  }

  return {
    valid: true,
    method: `classical_${type}`,
    type,
    seasonalPeriod: m,
    observed: [...values],
    trend,
    seasonal,
    remainder,
    seasonallyAdjusted,
    strengths: computeComponentStrengths(trend, seasonal, remainder)
  };
}

/**
 * Genuine STL Decomposition (Seasonal and Trend decomposition using LOESS, Cleveland et al. 1990)
 * Implements inner loop (cycle-subseries LOESS + low-pass filter + trend LOESS)
 * and optional bisquare outer robustness loop.
 */
export function stlDecomposition(values, seasonalPeriod = 12, options = {}) {
  const n = values.length;
  const m = Math.max(1, Math.floor(seasonalPeriod));
  if (m > 1 && n < 2 * m) {
    return {
      valid: false,
      reason: `STL decomposition with period m=${m} requires at least 2 full seasonal cycles (${2 * m} observations).`
    };
  }

  const sWindow = options.sWindow || Math.max(7, 2 * Math.floor(n / m / 2) + 1);
  const defaultTWindow = Math.ceil((1.5 * m) / (1.0 - 1.5 / Math.max(7, sWindow)));
  const tWindow = options.tWindow || (defaultTWindow % 2 === 0 ? defaultTWindow + 1 : defaultTWindow);
  const robust = Boolean(options.robust);
  const innerPasses = options.innerPasses || 2;
  const outerPasses = robust ? (options.outerPasses || 3) : 1;

  // Fill any interior missing values temporarily for continuous LOESS filtering
  const tempObs = values.map(v => ({ value: v }));
  const filled = imputeSeriesTrainingOnly(tempObs, "linear").map(o => o.value ?? 0.0);

  let trend = new Array(n).fill(0.0);
  let seasonal = new Array(n).fill(0.0);
  const robustnessWeights = new Array(n).fill(1.0);

  if (m === 1) {
    trend = loessSmoothArray(filled, Math.max(5, tWindow), 1, robustnessWeights);
    const remainder = filled.map((v, i) => v - trend[i]);
    return {
      valid: true,
      method: "stl",
      type: "additive",
      seasonalPeriod: 1,
      sWindow,
      tWindow,
      robust,
      observed: [...values],
      trend,
      seasonal,
      remainder,
      seasonallyAdjusted: [...values],
      strengths: computeComponentStrengths(trend, seasonal, remainder)
    };
  }

  for (let outer = 0; outer < outerPasses; outer++) {
    for (let inner = 0; inner < innerPasses; inner++) {
      // Step 1: Detrending
      const detrended = filled.map((v, i) => v - trend[i]);

      // Step 2: Cycle-subseries LOESS smoothing with 1-cycle padding at each end
      const paddedC = new Array(n + 2 * m).fill(0.0);
      for (let s = 0; s < m; s++) {
        const subVals = [];
        const subWeights = [];
        for (let i = s; i < n; i += m) {
          subVals.push(detrended[i]);
          subWeights.push(robustnessWeights[i]);
        }
        const subN = subVals.length;
        const subSpan = Math.min(subN, Math.max(3, sWindow));
        // Smooth at -1, 0..subN-1, subN
        for (let k = -1; k <= subN; k++) {
          const val = loessSmoothPoint(subVals, k, subSpan, 1, subWeights);
          const targetIdx = (k + 1) * m + s;
          if (targetIdx >= 0 && targetIdx < paddedC.length) {
            paddedC[targetIdx] = val ?? 0.0;
          }
        }
      }

      // Step 3: Low-pass filtering of smoothed cycle-subseries (m-MA -> m-MA -> 3-MA -> LOESS)
      const ma1 = movingAverageSmooth(paddedC, m, false);
      const ma2 = movingAverageSmooth(ma1.map(v => v ?? 0), m, false);
      const ma3 = movingAverageSmooth(ma2.map(v => v ?? 0), 3, false);
      const lowPassSlice = paddedC.slice(m, m + n).map((_, idx) => ma3[idx + m] ?? paddedC[idx + m]);
      const L = loessSmoothArray(lowPassSlice, Math.min(n, m + 1), 1);

      // Step 4: Detrending of smoothed cycle-subseries
      for (let i = 0; i < n; i++) {
        seasonal[i] = paddedC[i + m] - L[i];
      }

      // Step 5: Deseasonalizing
      const deseasonalized = filled.map((v, i) => v - seasonal[i]);

      // Step 6: Trend smoothing via LOESS
      trend = loessSmoothArray(deseasonalized, Math.min(n, Math.max(5, tWindow)), 1, robustnessWeights);
    }

    // Outer loop bisquare robustness weights update
    if (robust && outer < outerPasses - 1) {
      const rem = filled.map((v, i) => Math.abs(v - trend[i] - seasonal[i]));
      const sortedRem = [...rem].sort((a, b) => a - b);
      const h = 6.0 * Math.max(EPSILON, quantileSorted(sortedRem, 0.5));
      for (let i = 0; i < n; i++) {
        const u = rem[i] / h;
        if (u >= 1.0) robustnessWeights[i] = 0.0;
        else robustnessWeights[i] = Math.pow(1.0 - u * u, 2);
      }
    }
  }

  const remainder = values.map((v, i) => (v === null ? null : v - trend[i] - seasonal[i]));
  const seasonallyAdjusted = values.map((v, i) => (v === null ? null : v - seasonal[i]));

  return {
    valid: true,
    method: "stl",
    type: "additive",
    seasonalPeriod: m,
    sWindow,
    tWindow,
    robust,
    robustnessWeights,
    observed: [...values],
    trend,
    seasonal,
    remainder,
    seasonallyAdjusted,
    strengths: computeComponentStrengths(trend, seasonal, remainder)
  };
}

/**
 * Multiple Seasonal-Trend Decomposition using LOESS (MSTL, Bandara et al., 2021)
 * Iteratively extracts multiple seasonal periods (e.g., [24, 168] for hourly series)
 */
export function mstlDecomposition(values, seasonalPeriods = [7, 30], options = {}) {
  const n = values.length;
  const sortedPeriods = [...seasonalPeriods].map(Number).filter(p => p > 1 && n >= 2 * p).sort((a, b) => a - b);
  if (sortedPeriods.length === 0) {
    return stlDecomposition(values, 1, options);
  }
  const seasonalComponents = sortedPeriods.map(() => new Array(n).fill(0.0));
  let trend = new Array(n).fill(0.0);
  const iterations = 2;

  for (let iter = 0; iter < iterations; iter++) {
    for (let pIdx = 0; pIdx < sortedPeriods.length; pIdx++) {
      const m = sortedPeriods[pIdx];
      // Remove all other seasonal components
      const deflated = values.map((v, i) => {
        if (v === null) return null;
        let sumOther = 0.0;
        for (let k = 0; k < sortedPeriods.length; k++) {
          if (k !== pIdx) sumOther += seasonalComponents[k][i];
        }
        return v - sumOther;
      });
      const stlRes = stlDecomposition(deflated, m, options);
      if (stlRes.valid) {
        seasonalComponents[pIdx] = stlRes.seasonal;
        trend = stlRes.trend;
      }
    }
  }

  const combinedSeasonal = new Array(n).fill(0.0);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < sortedPeriods.length; k++) {
      combinedSeasonal[i] += seasonalComponents[k][i];
    }
  }
  const remainder = values.map((v, i) => (v === null ? null : v - trend[i] - combinedSeasonal[i]));
  const seasonallyAdjusted = values.map((v, i) => (v === null ? null : v - combinedSeasonal[i]));

  return {
    valid: true,
    method: "mstl",
    type: "additive",
    seasonalPeriod: sortedPeriods[0],
    seasonalPeriods: sortedPeriods,
    seasonalComponents,
    observed: [...values],
    trend,
    seasonal: combinedSeasonal,
    remainder,
    seasonallyAdjusted,
    strengths: computeComponentStrengths(trend, combinedSeasonal, remainder)
  };
}

/**
 * Compute FPP3 Section 4.3 Trend Strength (F_T) and Seasonal Strength (F_S)
 */
export function computeComponentStrengths(trend, seasonal, remainder) {
  const trRem = [];
  const seasRem = [];
  const remValid = [];
  for (let i = 0; i < remainder.length; i++) {
    if (remainder[i] !== null && Number.isFinite(remainder[i])) {
      remValid.push(remainder[i]);
      if (trend[i] !== null && Number.isFinite(trend[i])) {
        trRem.push(trend[i] + remainder[i]);
      }
      if (seasonal[i] !== null && Number.isFinite(seasonal[i])) {
        seasRem.push(seasonal[i] + remainder[i]);
      }
    }
  }
  const varR = computeUnivariateStats(remValid).variance || 0.0;
  const varTR = computeUnivariateStats(trRem).variance || 0.0;
  const varSR = computeUnivariateStats(seasRem).variance || 0.0;

  const trendStrength = varTR > EPSILON ? Math.max(0.0, Math.min(1.0, 1.0 - varR / varTR)) : 0.0;
  const seasonalStrength = varSR > EPSILON ? Math.max(0.0, Math.min(1.0, 1.0 - varR / varSR)) : 0.0;
  return { trendStrength, seasonalStrength, remainderVariance: varR };
}

/**
 * Comprehensive Time-Series Feature Extraction (FPP3 Chapter 4)
 */
export function extractSeriesFeatures(values, seasonalPeriod = 12) {
  const stats = computeUnivariateStats(values);
  const acfRes = computeACF(values, Math.max(12, seasonalPeriod * 2));
  const pacfRes = computePACF(values, Math.max(12, seasonalPeriod));
  const diffRes = applyForwardTransform(values, { type: "diff1" });
  const diffAcf = computeACF(diffRes.values, 10);

  let decomp = stlDecomposition(values, seasonalPeriod);
  if (!decomp.valid) {
    decomp = stlDecomposition(values, 1);
  }

  const acf1 = acfRes.acf[0] ?? 0.0;
  const acf10SumSq = acfRes.acf.slice(0, 10).reduce((s, r) => s + r * r, 0.0);
  const seasonalAcf = seasonalPeriod > 1 && acfRes.acf.length >= seasonalPeriod
    ? acfRes.acf[seasonalPeriod - 1]
    : 0.0;

  // Variance stability ratio (second half variance / first half variance)
  const clean = values.filter(v => v !== null && Number.isFinite(v));
  const mid = Math.floor(clean.length / 2);
  const v1 = computeUnivariateStats(clean.slice(0, mid)).variance || 1.0;
  const v2 = computeUnivariateStats(clean.slice(mid)).variance || 1.0;
  const varianceRatio = v1 > EPSILON ? v2 / v1 : 1.0;

  const recommendedLambda = clean.every(v => v > 0) ? estimateBoxCoxLambda(clean, seasonalPeriod) : null;

  return {
    n: stats.n,
    mean: stats.mean,
    variance: stats.variance,
    stdDev: stats.stdDev,
    cv: Math.abs(stats.mean) > EPSILON ? stats.stdDev / Math.abs(stats.mean) : NaN,
    skewness: stats.skewness,
    kurtosis: stats.kurtosis,
    trendStrength: decomp.strengths ? decomp.strengths.trendStrength : 0.0,
    seasonalStrength: decomp.strengths ? decomp.strengths.seasonalStrength : 0.0,
    acf1,
    acf10SumSq,
    seasonalAcf,
    diff1Acf1: diffAcf.acf[0] ?? 0.0,
    pacf1: pacfRes.pacf[0] ?? 0.0,
    varianceRatio,
    recommendedLambda
  };
}

/* ==========================================================================
   SECTION 7: UNIFIED FORECASTING MODEL REGISTRY & METADATA
   ========================================================================== */

export const MODEL_REGISTRY = {
  MEAN: {
    id: "MEAN",
    name: "Sample Mean Method",
    family: "Baseline",
    minObservations: 3,
    supportsSeasonality: false,
    requiresPredictors: false,
    equation: "\\hat{y}_{T+h|T} = \\bar{y}",
    intervalMethod: "Exact Student-t prediction interval: s * sqrt(1 + 1/T)",
    assumptions: "Constant level over time; i.i.d. normal innovations with constant variance.",
    limitations: "Fails when series exhibits trend, unit-root persistence, or seasonality."
  },
  NAIVE: {
    id: "NAIVE",
    name: "Naïve (Random Walk)",
    family: "Baseline",
    minObservations: 3,
    supportsSeasonality: false,
    requiresPredictors: false,
    equation: "\\hat{y}_{T+h|T} = y_T",
    intervalMethod: "Random walk horizon scaling: \\hat{\\sigma} \\sqrt{h}",
    assumptions: "First differences are uncorrelated zero-mean white noise.",
    limitations: "Flat point forecast cannot extrapolate deterministic trends or seasonal cycles."
  },
  SNAIVE: {
    id: "SNAIVE",
    name: "Seasonal Naïve",
    family: "Baseline",
    minObservations: 4,
    supportsSeasonality: true,
    requiresPredictors: false,
    equation: "\\hat{y}_{T+h|T} = y_{T+h-m(k+1)}, \\; k=\\lfloor(h-1)/m\\rfloor",
    intervalMethod: "Seasonal cycle variance scaling: \\hat{\\sigma}_m \\sqrt{k+1}",
    assumptions: "Seasonal differences are uncorrelated zero-mean white noise.",
    limitations: "Requires at least one full seasonal cycle (T >= m); does not extrapolate secular trend."
  },
  DRIFT: {
    id: "DRIFT",
    name: "Random Walk with Drift",
    family: "Baseline",
    minObservations: 3,
    supportsSeasonality: false,
    requiresPredictors: false,
    equation: "\\hat{y}_{T+h|T} = y_T + h \\frac{y_T - y_1}{T - 1}",
    intervalMethod: "Drift variance scaling: \\hat{\\sigma} \\sqrt{h(1 + h/(T-1))}",
    assumptions: "First differences have constant drift mean c and uncorrelated errors.",
    limitations: "Sensitive to endpoints y_1 and y_T; does not model seasonality."
  },
  ETS_ANN: {
    id: "ETS_ANN",
    name: "ETS(A,N,N) — Simple Exponential Smoothing",
    family: "Exponential Smoothing (ETS)",
    minObservations: 4,
    supportsSeasonality: false,
    requiresPredictors: false,
    equation: "\\ell_t = \\alpha y_t + (1-\\alpha)\\ell_{t-1}, \\; \\hat{y}_{T+h|T} = \\ell_T",
    intervalMethod: "State-space variance: \\sigma^2 [1 + \\alpha^2(h-1)]",
    assumptions: "Locally evolving level with no systematic trend or seasonality.",
    limitations: "Flat forecast function; unsuitable for trending or seasonal series."
  },
  ETS_AAN: {
    id: "ETS_AAN",
    name: "ETS(A,A,N) — Holt's Linear Trend",
    family: "Exponential Smoothing (ETS)",
    minObservations: 5,
    supportsSeasonality: false,
    requiresPredictors: false,
    equation: "\\hat{y}_{T+h|T} = \\ell_T + h b_T",
    intervalMethod: "State-space variance: \\sigma^2 [1 + \\sum_{j=1}^{h-1} (\\alpha + j\\alpha\\beta^*)^2]",
    assumptions: "Locally evolving level and linear slope with additive Gaussian innovations.",
    limitations: "Can over-forecast at long horizons; consider ETS(A,Ad,N) damped trend."
  },
  ETS_AAdN: {
    id: "ETS_AAdN",
    name: "ETS(A,Ad,N) — Damped Trend Smoothing",
    family: "Exponential Smoothing (ETS)",
    minObservations: 6,
    supportsSeasonality: false,
    requiresPredictors: false,
    equation: "\\hat{y}_{T+h|T} = \\ell_T + (\\phi + \\phi^2 + \\dots + \\phi^h) b_T",
    intervalMethod: "Exact linear state-space innovation variance multiplier",
    assumptions: "Local trend dampens geometrically toward an asymptote as horizon h grows.",
    limitations: "Does not capture seasonal fluctuations."
  },
  ETS_AAA: {
    id: "ETS_AAA",
    name: "ETS(A,A,A) — Additive Holt-Winters Seasonal",
    family: "Exponential Smoothing (ETS)",
    minObservations: 8,
    supportsSeasonality: true,
    requiresPredictors: false,
    equation: "\\hat{y}_{T+h|T} = \\ell_T + h b_T + s_{T+h-m(k+1)}",
    intervalMethod: "Exact additive state-space horizon variance formula",
    assumptions: "Seasonal amplitude is constant across level changes; additive innovations.",
    limitations: "Requires T >= 2m for reliable seasonal state initialization."
  },
  ETS_MAM: {
    id: "ETS_MAM",
    name: "ETS(M,A,M) — Multiplicative Holt-Winters Seasonal",
    family: "Exponential Smoothing (ETS)",
    minObservations: 8,
    supportsSeasonality: true,
    requiresPredictors: false,
    equation: "\\hat{y}_{T+h|T} = (\\ell_T + h b_T) s_{T+h-m(k+1)}",
    intervalMethod: "Seeded state-space Monte Carlo trajectory simulation (B=800 paths)",
    assumptions: "Strictly positive data (y_t > 0); seasonal amplitude scales proportionally with level.",
    limitations: "Ineligible when data contains zeros or negative numbers."
  },
  ETS_AUTO: {
    id: "ETS_AUTO",
    name: "Automatic ETS (AICc State-Space Selection)",
    family: "Exponential Smoothing (ETS)",
    minObservations: 4,
    supportsSeasonality: true,
    requiresPredictors: false,
    equation: "\\min_{\\mathcal{M} \\in \\text{ETS}} \\text{AIC}_c(\\mathcal{M})",
    intervalMethod: "Delegated to selected optimal ETS state-space specification",
    assumptions: "Evaluates eligible candidate ETS models on identical scale.",
    limitations: "Selection restricted to implemented candidate set {ANN, AAN, AAdN, AAA, MAM}."
  },
  ARIMA: {
    id: "ARIMA",
    name: "ARIMA(p,d,q)(P,D,Q)_m",
    family: "ARIMA",
    minObservations: 8,
    supportsSeasonality: true,
    requiresPredictors: false,
    equation: "\\phi(B)\\Phi(B^m)(1-B)^d(1-B^m)^D y_t = c + \\theta(B)\\Theta(B^m)\\varepsilon_t",
    intervalMethod: "Exact Wold \\psi-weight expansion: \\hat{\\sigma}^2 \\sum_{j=0}^{h-1} \\psi_j^2",
    assumptions: "Differenced series is covariance stationary; innovations are uncorrelated.",
    limitations: "Fitted via CSS + Innovations Nelder-Mead optimization; requires stationary/invertible roots."
  },
  ARIMA_AUTO: {
    id: "ARIMA_AUTO",
    name: "Auto-ARIMA (Guided Candidate Search)",
    family: "ARIMA",
    minObservations: 8,
    supportsSeasonality: true,
    requiresPredictors: false,
    equation: "\\min_{(p,d,q)(P,D,Q)_m} \\text{AIC}_c",
    intervalMethod: "Exact Wold \\psi-weight expansion on selected model",
    assumptions: "Searches bounded candidate grid for fixed differencing (d, D) so AICc is comparable.",
    limitations: "Local candidate search; does not guarantee global optimum across unbounded orders."
  },
  TS_REG: {
    id: "TS_REG",
    name: "Time-Series Regression (Trend / Seasonal / Fourier / Exogenous)",
    family: "Regression",
    minObservations: 5,
    supportsSeasonality: true,
    requiresPredictors: true,
    equation: "y_t = \\beta_0 + \\sum_j \\beta_j x_{j,t} + \\varepsilon_t",
    intervalMethod: "Exact OLS leverage prediction interval: s_e \\sqrt{1 + \\mathbf{x}_0^T(\\mathbf{X}^T\\mathbf{X})^{-1}\\mathbf{x}_0}",
    assumptions: "Linearity, uncorrelated homoscedastic errors, and known/assumed future predictors.",
    limitations: "Autocorrelated residuals understate OLS standard errors; requires future predictor values."
  },
  DYN_REG: {
    id: "DYN_REG",
    name: "Dynamic Regression (Regression with ARIMA Errors)",
    family: "Dynamic Regression",
    minObservations: 10,
    supportsSeasonality: true,
    requiresPredictors: true,
    equation: "y_t = \\mathbf{x}_t^T\\boldsymbol{\\beta} + \\eta_t, \\; \\phi(B)(1-B)^d\\eta_t = \\theta(B)\\varepsilon_t",
    intervalMethod: "Combined regression leverage variance + ARIMA \\psi-weight innovation variance",
    assumptions: "Deterministic/exogenous structure plus stationary ARMA disturbance process.",
    limitations: "Requires known or scenario-assumed future predictor values x_{T+h} for forecasting."
  },
  ENSEMBLE: {
    id: "ENSEMBLE",
    name: "Forecast Combination (Equal / Inverse-AICc Ensemble)",
    family: "Ensemble",
    minObservations: 6,
    supportsSeasonality: true,
    requiresPredictors: false,
    equation: "\\hat{y}_{T+h|T}^{\\text{comb}} = \\sum_{m=1}^M w_m \\hat{y}_{T+h|T}^{(m)}",
    intervalMethod: "Combined variance accounting for component forecast covariance",
    assumptions: "Combining diverse model families reduces model-selection variance.",
    limitations: "Less interpretable than a single parametric data-generating model."
  }
};

/**
 * Helper to build interval arrays for requested levels (default [80, 95])
 */
function buildPredictionIntervals(pointForecasts, stdErrors, df = Infinity, levels = [80, 95], transformConfig = { type: "none" }, biasAdjust = false) {
  const intervals = {};
  for (const lvl of levels) {
    const p = lvl / 100.0;
    const crit = Number.isFinite(df) && df > 0 && df < 500
      ? studentTCritical(df, p)
      : inverseNormalCDF(1.0 - 0.5 * (1.0 - p));
    intervals[lvl] = pointForecasts.map((pt, idx) => {
      const se = stdErrors[idx];
      if (!Number.isFinite(pt) || !Number.isFinite(se)) return [null, null];
      const loW = pt - crit * se;
      const hiW = pt + crit * se;
      const lo = backTransformValue(loW, 0, transformConfig, false);
      const hi = backTransformValue(hiW, 0, transformConfig, false);
      return [Math.min(lo, hi), Math.max(lo, hi)];
    });
  }
  const backPoint = pointForecasts.map((pt, idx) => {
    const se = stdErrors[idx];
    const variance = Number.isFinite(se) ? se * se : 0.0;
    return backTransformValue(pt, variance, transformConfig, biasAdjust);
  });
  return { pointForecasts: backPoint, intervals };
}

/* ==========================================================================
   SECTION 8: BASELINE FORECASTING MODELS (MEAN, NAIVE, SNAIVE, DRIFT)
   ========================================================================== */

export function fitBaselineModel(rawValues, timestamps, config = {}) {
  const method = (config.modelType || "NAIVE").toUpperCase();
  const horizon = Math.max(1, Number(config.horizon || 12));
  const m = Math.max(1, Number(config.seasonalPeriod || 12));
  const frequency = config.frequency || "monthly";
  const levels = config.levels || [80, 95];
  const transformCfg = config.transform || { type: "none" };
  const biasAdjust = Boolean(config.biasAdjust);

  const forward = applyForwardTransform(rawValues, transformCfg);
  if (!forward.valid) {
    return { valid: false, modelType: method, reason: forward.reason };
  }
  const y = forward.values;
  const T = y.length;
  if (T < 3 || y.some(v => v === null || !Number.isFinite(v))) {
    return { valid: false, modelType: method, reason: "Series contains unhandled missing values or fewer than 3 observations." };
  }

  if (method === "SNAIVE" && T < m) {
    return {
      valid: false,
      modelType: "SNAIVE",
      reason: `Seasonal Naïve requires at least one full seasonal cycle (m=${m}), but training series has only T=${T} observations.`
    };
  }

  const fittedW = new Array(T).fill(null);
  const residuals = new Array(T).fill(null);
  const pointW = new Array(horizon).fill(0.0);
  const seW = new Array(horizon).fill(0.0);
  const params = {};
  let df = T - 1;

  if (method === "MEAN") {
    const st = computeUnivariateStats(y);
    params.mean = st.mean;
    params.sigma = st.stdDev;
    for (let t = 0; t < T; t++) {
      fittedW[t] = st.mean;
      residuals[t] = y[t] - st.mean;
    }
    for (let h = 1; h <= horizon; h++) {
      pointW[h - 1] = st.mean;
      seW[h - 1] = st.stdDev * Math.sqrt(1.0 + 1.0 / T);
    }
  } else if (method === "NAIVE") {
    let sse = 0.0;
    let count = 0;
    for (let t = 1; t < T; t++) {
      fittedW[t] = y[t - 1];
      residuals[t] = y[t] - fittedW[t];
      sse += residuals[t] * residuals[t];
      count++;
    }
    const sigma = count > 0 ? Math.sqrt(sse / count) : 0.0;
    params.lastValue = y[T - 1];
    params.sigma = sigma;
    df = Infinity;
    for (let h = 1; h <= horizon; h++) {
      pointW[h - 1] = y[T - 1];
      seW[h - 1] = sigma * Math.sqrt(h);
    }
  } else if (method === "SNAIVE") {
    let sse = 0.0;
    let count = 0;
    for (let t = m; t < T; t++) {
      fittedW[t] = y[t - m];
      residuals[t] = y[t] - fittedW[t];
      sse += residuals[t] * residuals[t];
      count++;
    }
    const sigma = count > 0 ? Math.sqrt(sse / count) : 0.0;
    params.seasonalPeriod = m;
    params.sigma = sigma;
    df = Infinity;
    for (let h = 1; h <= horizon; h++) {
      const k = Math.floor((h - 1) / m);
      const srcIdx = T + h - 1 - m * (k + 1);
      pointW[h - 1] = y[srcIdx];
      seW[h - 1] = sigma * Math.sqrt(k + 1);
    }
  } else if (method === "DRIFT") {
    const drift = (y[T - 1] - y[0]) / (T - 1);
    let sse = 0.0;
    let count = 0;
    for (let t = 1; t < T; t++) {
      fittedW[t] = y[t - 1] + drift;
      residuals[t] = y[t] - fittedW[t];
      sse += residuals[t] * residuals[t];
      count++;
    }
    const sigma = count > 1 ? Math.sqrt(sse / (count - 1)) : 0.0;
    params.drift = drift;
    params.lastValue = y[T - 1];
    params.sigma = sigma;
    df = Infinity;
    for (let h = 1; h <= horizon; h++) {
      pointW[h - 1] = y[T - 1] + h * drift;
      seW[h - 1] = sigma * Math.sqrt(h * (1.0 + h / (T - 1)));
    }
  } else {
    return { valid: false, modelType: method, reason: `Unknown baseline method: ${method}` };
  }

  const fitted = fittedW.map(w => (w === null ? null : backTransformValue(w, params.sigma ** 2, forward.params ? { ...transformCfg, ...forward.params } : transformCfg, biasAdjust)));
  const origResiduals = rawValues.map((rv, i) => (fitted[i] === null || rv === null ? null : rv - fitted[i]));
  const built = buildPredictionIntervals(pointW, seW, df, levels, { ...transformCfg, ...forward.params }, biasAdjust);
  const futureTimestamps = timestamps && timestamps.length > 0
    ? generateFutureTimestamps(timestamps[timestamps.length - 1], frequency, horizon, m)
    : Array.from({ length: horizon }, (_, i) => String(T + i + 1));

  const lb = ljungBoxTest(residuals, Math.min(10, Math.floor(T / 3)), method === "DRIFT" || method === "MEAN" ? 1 : 0);

  return {
    valid: true,
    modelType: method,
    modelName: MODEL_REGISTRY[method]?.name || method,
    family: "Baseline",
    trainingSampleSize: T,
    seasonalPeriod: m,
    horizon,
    parameters: params,
    fittedValues: fitted,
    residuals: origResiduals,
    transformedResiduals: residuals,
    futureTimestamps,
    pointForecasts: built.pointForecasts,
    intervals: built.intervals,
    stdErrors: seW,
    diagnostics: {
      sigma: params.sigma,
      ljungBox: lb,
      residualStats: computeUnivariateStats(origResiduals)
    },
    estimationStatus: "Exact Closed-Form",
    warnings: [],
    reproducibility: { engineVersion: ENGINE_VERSION, transform: transformCfg, biasAdjust }
  };
}

/* ==========================================================================
   SECTION 9: EXPONENTIAL SMOOTHING & ETS INNOVATIONS STATE-SPACE ENGINE
   ========================================================================== */

/**
 * Evaluate a specific ETS state-space recursion given parameters
 * Supports:
 * - ETS(A,N,N): Simple Exponential Smoothing
 * - ETS(A,A,N): Holt's Linear Trend
 * - ETS(A,Ad,N): Damped Trend
 * - ETS(A,A,A): Additive Holt-Winters
 * - ETS(M,A,M): Multiplicative Holt-Winters
 */
function evaluateETSRecursion(y, spec, params, m = 12) {
  const T = y.length;
  const alpha = Math.max(0.0001, Math.min(0.9999, params.alpha));
  const beta = params.beta !== undefined ? Math.max(0.0, Math.min(alpha, params.beta)) : 0.0;
  const gamma = params.gamma !== undefined ? Math.max(0.0, Math.min(1.0 - alpha, params.gamma)) : 0.0;
  const phi = params.phi !== undefined ? Math.max(0.80, Math.min(0.999, params.phi)) : 1.0;

  let l = params.l0 !== undefined ? params.l0 : y[0];
  let b = params.b0 !== undefined ? params.b0 : (T > 1 ? y[1] - y[0] : 0.0);
  const s = params.s0 ? [...params.s0] : new Array(m).fill(spec === "ETS_MAM" ? 1.0 : 0.0);

  const fitted = new Array(T);
  const residuals = new Array(T);
  const innovations = new Array(T);
  let sse = 0.0;
  let logLikTerm = 0.0;

  for (let t = 0; t < T; t++) {
    const sPrev = m > 1 ? s[t % m] : (spec === "ETS_MAM" ? 1.0 : 0.0);
    let mu = l;
    if (spec === "ETS_ANN") {
      mu = l;
      const err = y[t] - mu;
      fitted[t] = mu;
      residuals[t] = err;
      innovations[t] = err;
      l = l + alpha * err;
      sse += err * err;
    } else if (spec === "ETS_AAN" || spec === "ETS_AAdN") {
      const phiUse = spec === "ETS_AAdN" ? phi : 1.0;
      mu = l + phiUse * b;
      const err = y[t] - mu;
      fitted[t] = mu;
      residuals[t] = err;
      innovations[t] = err;
      l = mu + alpha * err;
      b = phiUse * b + beta * err;
      sse += err * err;
    } else if (spec === "ETS_AAA") {
      mu = l + phi * b + sPrev;
      const err = y[t] - mu;
      fitted[t] = mu;
      residuals[t] = err;
      innovations[t] = err;
      l = l + phi * b + alpha * err;
      b = phi * b + beta * err;
      s[t % m] = sPrev + gamma * err;
      sse += err * err;
    } else if (spec === "ETS_MAM") {
      const base = (l + phi * b) * sPrev;
      mu = Math.abs(base) > EPSILON ? base : EPSILON;
      const rawErr = y[t] - mu;
      const relErr = rawErr / mu;
      fitted[t] = mu;
      residuals[t] = rawErr;
      innovations[t] = relErr;
      l = (l + phi * b) * (1.0 + alpha * relErr);
      b = phi * b + beta * (l + phi * b) * relErr;
      s[t % m] = sPrev * (1.0 + gamma * relErr);
      sse += relErr * relErr;
      logLikTerm += Math.log(Math.abs(mu));
    }
  }

  return { fitted, residuals, innovations, sse, logLikTerm, finalState: { l, b, s: [...s] }, params: { alpha, beta, gamma, phi } };
}

/**
 * Compute initial heuristic state estimates for ETS
 */
function initializeETSStates(y, spec, m = 12) {
  const T = y.length;
  if (spec === "ETS_ANN") {
    return { l0: y[0], b0: 0.0, s0: [] };
  }
  if (spec === "ETS_AAN" || spec === "ETS_AAdN") {
    const k = Math.min(T, 5);
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < k; i++) {
      sx += i; sy += y[i]; sxx += i * i; sxy += i * y[i];
    }
    const b0 = (k * sxy - sx * sy) / Math.max(1, k * sxx - sx * sx);
    const l0 = (sy - b0 * sx) / k;
    return { l0, b0, s0: [] };
  }
  // Seasonal initialization using classical decomposition of first 2-3 cycles
  const decompType = spec === "ETS_MAM" ? "multiplicative" : "additive";
  const decomp = classicalDecomposition(y, m, decompType);
  if (decomp.valid) {
    const s0 = decomp.seasonal.slice(0, m);
    const sa = decomp.seasonallyAdjusted;
    const b0 = (sa[Math.min(T - 1, m)] - sa[0]) / Math.min(T - 1, m);
    const l0 = sa[0];
    return { l0, b0, s0 };
  }
  return { l0: y[0], b0: 0.0, s0: new Array(m).fill(spec === "ETS_MAM" ? 1.0 : 0.0) };
}

/**
 * Fit an Exponential Smoothing / ETS model with parameter optimization or fixed parameters
 */
export function fitETSModel(rawValues, timestamps, config = {}) {
  const rawSpec = (config.modelType || "ETS_ANN").toUpperCase();
  const requestedSpec = rawSpec === "ETS_AADN" ? "ETS_AAdN" : rawSpec;
  const m = Math.max(1, Number(config.seasonalPeriod || 12));
  if (requestedSpec === "ETS_AUTO") {
    return autoSelectETS(rawValues, timestamps, config);
  }

  const horizon = Math.max(1, Number(config.horizon || 12));
  const frequency = config.frequency || "monthly";
  const levels = config.levels || [80, 95];
  const transformCfg = config.transform || { type: "none" };
  const biasAdjust = Boolean(config.biasAdjust);

  const forward = applyForwardTransform(rawValues, transformCfg);
  if (!forward.valid) return { valid: false, modelType: requestedSpec, reason: forward.reason };
  const y = forward.values;
  const T = y.length;

  if (T < 4 || y.some(v => v === null || !Number.isFinite(v))) {
    return { valid: false, modelType: requestedSpec, reason: "ETS requires at least 4 complete observations." };
  }
  if ((requestedSpec === "ETS_AAA" || requestedSpec === "ETS_MAM") && (m < 2 || T < 2 * m)) {
    return {
      valid: false,
      modelType: requestedSpec,
      reason: `${requestedSpec} requires seasonal period m >= 2 and at least 2 full seasonal cycles (2m = ${2 * m} observations, got T = ${T}).`
    };
  }
  if (requestedSpec === "ETS_MAM" && y.some(v => v <= 0)) {
    return {
      valid: false,
      modelType: "ETS_MAM",
      reason: "ETS(M,A,M) requires strictly positive observations (y_t > 0)."
    };
  }

  const init = initializeETSStates(y, requestedSpec, m);
  let optResult = { converged: true, iterations: 0 };
  let bestParams = {
    alpha: config.alpha !== undefined ? Number(config.alpha) : 0.3,
    beta: config.beta !== undefined ? Number(config.beta) : 0.05,
    gamma: config.gamma !== undefined ? Number(config.gamma) : 0.1,
    phi: config.phi !== undefined ? Number(config.phi) : (requestedSpec === "ETS_AAdN" ? 0.92 : 1.0),
    l0: init.l0,
    b0: init.b0,
    s0: init.s0
  };

  const optimizeParams = config.optimize !== false;
  if (optimizeParams) {
    if (requestedSpec === "ETS_ANN") {
      const obj = (vec) => {
        const a = vec[0];
        if (a <= 0.001 || a >= 0.999) return 1e18;
        return evaluateETSRecursion(y, "ETS_ANN", { alpha: a, l0: vec[1] }, m).sse;
      };
      optResult = nelderMeadOptimize(obj, [bestParams.alpha, init.l0]);
      bestParams.alpha = Math.max(0.001, Math.min(0.999, optResult.x[0]));
      bestParams.l0 = optResult.x[1];
    } else if (requestedSpec === "ETS_AAN") {
      const obj = (vec) => {
        const [a, bRatio, l0, b0] = vec;
        if (a <= 0.001 || a >= 0.999 || bRatio < 0 || bRatio > 0.999) return 1e18;
        return evaluateETSRecursion(y, "ETS_AAN", { alpha: a, beta: a * bRatio, l0, b0 }, m).sse;
      };
      optResult = nelderMeadOptimize(obj, [0.3, 0.15, init.l0, init.b0]);
      bestParams.alpha = Math.max(0.001, Math.min(0.999, optResult.x[0]));
      bestParams.beta = bestParams.alpha * Math.max(0.0, Math.min(0.999, optResult.x[1]));
      bestParams.l0 = optResult.x[2];
      bestParams.b0 = optResult.x[3];
    } else if (requestedSpec === "ETS_AAdN") {
      const obj = (vec) => {
        const [a, bRatio, phi] = vec;
        if (a <= 0.001 || a >= 0.999 || bRatio < 0 || bRatio > 0.999 || phi < 0.80 || phi > 0.98) return 1e18;
        return evaluateETSRecursion(y, "ETS_AAdN", { alpha: a, beta: a * bRatio, phi, l0: init.l0, b0: init.b0 }, m).sse;
      };
      optResult = nelderMeadOptimize(obj, [0.3, 0.15, 0.92]);
      bestParams.alpha = Math.max(0.001, Math.min(0.999, optResult.x[0]));
      bestParams.beta = bestParams.alpha * Math.max(0.0, Math.min(0.999, optResult.x[1]));
      bestParams.phi = Math.max(0.80, Math.min(0.98, optResult.x[2]));
    } else if (requestedSpec === "ETS_AAA" || requestedSpec === "ETS_MAM") {
      const obj = (vec) => {
        const [a, bRatio, gRatio] = vec;
        if (a <= 0.001 || a >= 0.98 || bRatio < 0 || bRatio > 0.98 || gRatio < 0 || gRatio > 0.98) return 1e18;
        const beta = a * bRatio;
        const gamma = (1.0 - a) * gRatio;
        const res = evaluateETSRecursion(y, requestedSpec, { alpha: a, beta, gamma, phi: 1.0, l0: init.l0, b0: init.b0, s0: init.s0 }, m);
        return requestedSpec === "ETS_MAM" ? T * Math.log(Math.max(EPSILON, res.sse / T)) + 2 * res.logLikTerm : res.sse;
      };
      optResult = nelderMeadOptimize(obj, [0.25, 0.10, 0.15]);
      bestParams.alpha = Math.max(0.001, Math.min(0.98, optResult.x[0]));
      bestParams.beta = bestParams.alpha * Math.max(0.0, Math.min(0.98, optResult.x[1]));
      bestParams.gamma = (1.0 - bestParams.alpha) * Math.max(0.0, Math.min(0.98, optResult.x[2]));
    }
  }

  const evalRes = evaluateETSRecursion(y, requestedSpec, bestParams, m);
  let kParams = 2; // alpha, l0, sigma^2
  if (requestedSpec === "ETS_ANN") kParams = 3;
  else if (requestedSpec === "ETS_AAN") kParams = 5;
  else if (requestedSpec === "ETS_AAdN") kParams = 6;
  else if (requestedSpec === "ETS_AAA" || requestedSpec === "ETS_MAM") kParams = 5 + m;

  const sigma2 = evalRes.sse / Math.max(1, T - kParams);
  const sigma = Math.sqrt(sigma2);
  const aic = T * Math.log(Math.max(EPSILON, evalRes.sse / T)) + 2 * evalRes.logLikTerm + 2 * kParams;
  const aicc = aic + (2 * kParams * (kParams + 1)) / Math.max(1, T - kParams - 1);
  const bic = T * Math.log(Math.max(EPSILON, evalRes.sse / T)) + 2 * evalRes.logLikTerm + kParams * Math.log(T);

  // Generate horizon forecasts & analytical/simulated state-space prediction intervals
  const pointW = new Array(horizon).fill(0.0);
  const seW = new Array(horizon).fill(0.0);
  const { l: lT, b: bT, s: sT } = evalRes.finalState;
  const { alpha, beta, gamma, phi } = evalRes.params;

  if (requestedSpec !== "ETS_MAM") {
    for (let h = 1; h <= horizon; h++) {
      let phiSum = h;
      if (requestedSpec === "ETS_AAdN") {
        phiSum = phi * (1.0 - Math.pow(phi, h)) / (1.0 - phi);
      } else if (requestedSpec === "ETS_ANN") {
        phiSum = 0.0;
      }
      const sIdx = (T + h - 1) % m;
      const sVal = requestedSpec === "ETS_AAA" ? sT[sIdx] : 0.0;
      pointW[h - 1] = lT + phiSum * bT + sVal;

      // Exact state-space forecast variance formula (Hyndman et al., 2008 / FPP3 Table 8.8)
      let varMult = 1.0;
      for (let j = 1; j <= h - 1; j++) {
        let psiJ = alpha;
        if (requestedSpec === "ETS_AAN") {
          psiJ += j * beta;
        } else if (requestedSpec === "ETS_AAdN") {
          psiJ += beta * phi * (1.0 - Math.pow(phi, j)) / (1.0 - phi);
        } else if (requestedSpec === "ETS_AAA") {
          psiJ += j * beta + (j % m === 0 ? gamma : 0.0);
        }
        varMult += psiJ * psiJ;
      }
      seW[h - 1] = sigma * Math.sqrt(varMult);
    }
  } else {
    // Multiplicative ETS(M,A,M): Parametric state-space simulation (FPP3 Section 8.7)
    const prng = createPRNG(config.seed || 4289104);
    const B = 800;
    const simPaths = Array.from({ length: horizon }, () => new Array(B));
    for (let h = 1; h <= horizon; h++) {
      pointW[h - 1] = (lT + h * bT) * sT[(T + h - 1) % m];
    }
    for (let rep = 0; rep < B; rep++) {
      let simL = lT;
      let simB = bT;
      const simS = [...sT];
      for (let h = 1; h <= horizon; h++) {
        const sIdx = (T + h - 1) % m;
        const eps = prng.nextGaussian(0, sigma);
        const ySim = (simL + simB) * simS[sIdx] * (1.0 + eps);
        simPaths[h - 1][rep] = ySim;
        simL = (simL + simB) * (1.0 + alpha * eps);
        simB = simB + beta * (simL + simB) * eps;
        simS[sIdx] = simS[sIdx] * (1.0 + gamma * eps);
      }
    }
    for (let h = 0; h < horizon; h++) {
      seW[h] = computeUnivariateStats(simPaths[h]).stdDev;
    }
  }

  const fitted = evalRes.fitted.map(w => backTransformValue(w, sigma2, { ...transformCfg, ...forward.params }, biasAdjust));
  const origResiduals = rawValues.map((rv, i) => rv - fitted[i]);
  const built = buildPredictionIntervals(pointW, seW, Infinity, levels, { ...transformCfg, ...forward.params }, biasAdjust);
  const futureTimestamps = timestamps && timestamps.length > 0
    ? generateFutureTimestamps(timestamps[timestamps.length - 1], frequency, horizon, m)
    : Array.from({ length: horizon }, (_, i) => String(T + i + 1));

  const lb = ljungBoxTest(evalRes.innovations, Math.min(10, Math.floor(T / 3)), kParams - 1);

  return {
    valid: true,
    modelType: requestedSpec,
    modelName: MODEL_REGISTRY[requestedSpec]?.name || requestedSpec,
    family: "Exponential Smoothing (ETS)",
    trainingSampleSize: T,
    seasonalPeriod: m,
    horizon,
    parameters: {
      alpha: evalRes.params.alpha,
      beta: requestedSpec === "ETS_ANN" ? null : evalRes.params.beta,
      gamma: (requestedSpec === "ETS_AAA" || requestedSpec === "ETS_MAM") ? evalRes.params.gamma : null,
      phi: requestedSpec === "ETS_AAdN" ? evalRes.params.phi : null,
      l0: bestParams.l0,
      b0: bestParams.b0,
      sigma
    },
    informationCriteria: { aic, aicc, bic, logLikelihood: -0.5 * aic + kParams },
    fittedValues: fitted,
    residuals: origResiduals,
    transformedResiduals: evalRes.innovations,
    futureTimestamps,
    pointForecasts: built.pointForecasts,
    intervals: built.intervals,
    stdErrors: seW,
    diagnostics: {
      sigma,
      aic,
      aicc,
      bic,
      ljungBox: lb,
      residualStats: computeUnivariateStats(origResiduals)
    },
    estimationStatus: optimizeParams ? (optResult.converged ? "Nelder-Mead Converged" : "Nelder-Mead Max Iterations") : "User-Specified Fixed Parameters",
    warnings: [],
    reproducibility: { engineVersion: ENGINE_VERSION, transform: transformCfg, biasAdjust, seed: config.seed || 4289104 }
  };
}

/**
 * Automatic ETS Selection across eligible candidate models using AICc
 */
export function autoSelectETS(rawValues, timestamps, config = {}) {
  const m = Math.max(1, Number(config.seasonalPeriod || 12));
  const candidates = ["ETS_ANN", "ETS_AAN", "ETS_AAdN"];
  if (m >= 2 && rawValues.length >= 2 * m) {
    candidates.push("ETS_AAA");
    if (rawValues.every(v => v !== null && v > 0)) {
      candidates.push("ETS_MAM");
    }
  }
  const results = [];
  for (const spec of candidates) {
    const res = fitETSModel(rawValues, timestamps, { ...config, modelType: spec });
    if (res.valid) results.push(res);
  }
  if (results.length === 0) {
    return { valid: false, modelType: "ETS_AUTO", reason: "No candidate ETS model could be fitted to the series." };
  }
  results.sort((a, b) => a.informationCriteria.aicc - b.informationCriteria.aicc);
  const best = results[0];
  return {
    ...best,
    selectedFromAuto: true,
    searchedCandidates: results.map(r => ({
      modelType: r.modelType,
      modelName: r.modelName,
      aic: r.informationCriteria.aic,
      aicc: r.informationCriteria.aicc,
      bic: r.informationCriteria.bic,
      sigma: r.diagnostics.sigma
    }))
  };
}

/* ==========================================================================
   SECTION 10: ARIMA & SEASONAL ARIMA ENGINE — ARIMA(p,d,q)(P,D,Q)_m
   ========================================================================== */

/**
 * Apply ordinary (d) and seasonal (D) differencing to a series
 */
export function differenceSeries(y, d = 0, D = 0, m = 1) {
  let curr = [...y];
  const history = [];
  for (let s = 0; s < D; s++) {
    history.push({ type: "seasonal", m, tail: curr.slice(-m) });
    const next = [];
    for (let i = m; i < curr.length; i++) {
      next.push(curr[i] - curr[i - m]);
    }
    curr = next;
  }
  for (let ord = 0; ord < d; ord++) {
    history.push({ type: "ordinary", m: 1, tail: [curr[curr.length - 1]] });
    const next = [];
    for (let i = 1; i < curr.length; i++) {
      next.push(curr[i] - curr[i - 1]);
    }
    curr = next;
  }
  return { differenced: curr, history };
}

/**
 * Expand multiplicative AR or MA lag polynomials:
 * Non-seasonal (1 +/- c_1 B +/- ... +/- c_p B^p) * Seasonal (1 +/- C_1 B^m +/- ... +/- C_P B^{Pm})
 */
export function expandMultiplicativePolynomial(nonSeasonalCoeffs, seasonalCoeffs, m = 1, isAR = true) {
  const p = nonSeasonalCoeffs.length;
  const P = seasonalCoeffs.length;
  const maxLag = p + P * m;
  const combined = new Array(maxLag + 1).fill(0.0);

  const aPoly = [1.0, ...nonSeasonalCoeffs.map(c => (isAR ? -c : c))];
  const APoly = new Array(P * m + 1).fill(0.0);
  APoly[0] = 1.0;
  for (let J = 1; J <= P; J++) {
    APoly[J * m] = isAR ? -seasonalCoeffs[J - 1] : seasonalCoeffs[J - 1];
  }

  for (let i = 0; i <= p; i++) {
    for (let j = 0; j <= P * m; j++) {
      combined[i + j] += aPoly[i] * APoly[j];
    }
  }
  // Return lag coefficients 1..maxLag with original sign convention
  return combined.slice(1).map(v => (isAR ? -v : v));
}

/**
 * Compute Wold psi-weights for ARIMA(p,d,q)(P,D,Q)_m so h-step forecast variance
 * is exact: Var(e_{T+h}) = sigma^2 * sum_{j=0}^{h-1} psi_j^2
 */
export function computeArimaPsiWeights(arExpanded, maExpanded, d = 0, D = 0, m = 1, horizon = 12) {
  // Combine AR operator with differencing operator (1 - B)^d (1 - B^m)^D
  let arPoly = [1.0, ...arExpanded.map(c => -c)];
  for (let i = 0; i < d; i++) {
    const next = new Array(arPoly.length + 1).fill(0.0);
    for (let k = 0; k < arPoly.length; k++) {
      next[k] += arPoly[k];
      next[k + 1] -= arPoly[k];
    }
    arPoly = next;
  }
  for (let i = 0; i < D; i++) {
    const next = new Array(arPoly.length + m).fill(0.0);
    for (let k = 0; k < arPoly.length; k++) {
      next[k] += arPoly[k];
      next[k + m] -= arPoly[k];
    }
    arPoly = next;
  }
  const fullAR = arPoly.slice(1).map(v => -v);
  const psi = new Array(horizon).fill(0.0);
  psi[0] = 1.0;
  for (let j = 1; j < horizon; j++) {
    let val = j <= maExpanded.length ? maExpanded[j - 1] : 0.0;
    for (let k = 1; k <= Math.min(j, fullAR.length); k++) {
      val += fullAR[k - 1] * psi[j - k];
    }
    psi[j] = val;
  }
  return psi;
}

/**
 * Fit ARIMA(p,d,q)(P,D,Q)_m via Conditional Sum of Squares / Innovations Likelihood
 */
export function fitARIMAModel(rawValues, timestamps, config = {}) {
  if ((config.modelType || "").toUpperCase() === "ARIMA_AUTO") {
    return autoSelectARIMA(rawValues, timestamps, config);
  }
  const p = Math.max(0, Math.min(5, Number(config.p ?? 1)));
  const d = Math.max(0, Math.min(2, Number(config.d ?? 1)));
  const q = Math.max(0, Math.min(5, Number(config.q ?? 1)));
  const P = Math.max(0, Math.min(2, Number(config.P ?? 0)));
  const D = Math.max(0, Math.min(1, Number(config.D ?? 0)));
  const Q = Math.max(0, Math.min(2, Number(config.Q ?? 0)));
  const m = Math.max(1, Number(config.seasonalPeriod || 12));
  const includeConstant = config.includeConstant !== undefined ? Boolean(config.includeConstant) : (d + D <= 1);
  const horizon = Math.max(1, Number(config.horizon || 12));
  const frequency = config.frequency || "monthly";
  const levels = config.levels || [80, 95];
  const transformCfg = config.transform || { type: "none" };
  const biasAdjust = Boolean(config.biasAdjust);

  const forward = applyForwardTransform(rawValues, transformCfg);
  if (!forward.valid) return { valid: false, modelType: "ARIMA", reason: forward.reason };
  const y = forward.values;
  const T = y.length;

  const minRequired = Math.max(8, d + D * m + p + q + (P + Q) * m + 4);
  if (T < minRequired || y.some(v => v === null || !Number.isFinite(v))) {
    return {
      valid: false,
      modelType: "ARIMA",
      reason: `ARIMA(${p},${d},${q})(${P},${D},${Q})_${m} requires at least ${minRequired} complete observations (got T = ${T}).`
    };
  }

  const diffObj = differenceSeries(y, d, D, m);
  const w = diffObj.differenced;
  const nW = w.length;
  const wStats = computeUnivariateStats(w);
  const wMean = includeConstant ? wStats.mean : 0.0;
  const wc = w.map(val => val - wMean);

  const totalParams = p + q + P + Q;
  let arCoeffs = new Array(p).fill(0.0);
  let maCoeffs = new Array(q).fill(0.0);
  let sarCoeffs = new Array(P).fill(0.0);
  let smaCoeffs = new Array(Q).fill(0.0);
  let optResult = { converged: true, iterations: 0 };

  if (totalParams > 0) {
    // Initialize AR1 from sample lag-1 autocorrelation of differenced series
    const wAcf = computeACF(wc, Math.max(2, m));
    const x0 = [];
    for (let i = 0; i < p; i++) x0.push(i === 0 ? Math.max(-0.7, Math.min(0.7, wAcf.acf[0] || 0.2)) : 0.05);
    for (let j = 0; j < q; j++) x0.push(0.1);
    for (let i = 0; i < P; i++) x0.push(i === 0 && wAcf.acf[m - 1] ? Math.max(-0.6, Math.min(0.6, wAcf.acf[m - 1] * 0.5)) : 0.05);
    for (let j = 0; j < Q; j++) x0.push(0.1);

    const evaluateCSS = (vec) => {
      const ar = vec.slice(0, p);
      const ma = vec.slice(p, p + q);
      const sar = vec.slice(p + q, p + q + P);
      const sma = vec.slice(p + q + P, p + q + P + Q);

      // Enforce admissibility bounds (sum of absolute coefficients < 0.985)
      const arSum = ar.reduce((s, c) => s + Math.abs(c), 0);
      const maSum = ma.reduce((s, c) => s + Math.abs(c), 0);
      const sarSum = sar.reduce((s, c) => s + Math.abs(c), 0);
      const smaSum = sma.reduce((s, c) => s + Math.abs(c), 0);
      if (arSum >= 0.985 || maSum >= 0.985 || sarSum >= 0.985 || smaSum >= 0.985) {
        return 1e18 + 1e10 * (arSum + maSum + sarSum + smaSum);
      }

      const fullAR = expandMultiplicativePolynomial(ar, sar, m, true);
      const fullMA = expandMultiplicativePolynomial(ma, sma, m, false);
      const eps = new Array(nW).fill(0.0);
      let sse = 0.0;
      for (let t = 0; t < nW; t++) {
        let pred = 0.0;
        for (let k = 1; k <= fullAR.length; k++) {
          if (t - k >= 0) pred += fullAR[k - 1] * wc[t - k];
        }
        for (let k = 1; k <= fullMA.length; k++) {
          if (t - k >= 0) pred += fullMA[k - 1] * eps[t - k];
        }
        eps[t] = wc[t] - pred;
        if (!Number.isFinite(eps[t]) || Math.abs(eps[t]) > 1e12) return 1e18;
        sse += eps[t] * eps[t];
      }
      return sse;
    };

    optResult = nelderMeadOptimize(evaluateCSS, x0, { maxIter: 400, tol: 1e-8 });
    arCoeffs = optResult.x.slice(0, p);
    maCoeffs = optResult.x.slice(p, p + q);
    sarCoeffs = optResult.x.slice(p + q, p + q + P);
    smaCoeffs = optResult.x.slice(p + q + P, p + q + P + Q);
  }

  const fullAR = expandMultiplicativePolynomial(arCoeffs, sarCoeffs, m, true);
  const fullMA = expandMultiplicativePolynomial(maCoeffs, smaCoeffs, m, false);

  const epsW = new Array(nW).fill(0.0);
  const fittedDiff = new Array(nW).fill(0.0);
  let sse = 0.0;
  for (let t = 0; t < nW; t++) {
    let pred = 0.0;
    for (let k = 1; k <= fullAR.length; k++) {
      if (t - k >= 0) pred += fullAR[k - 1] * wc[t - k];
    }
    for (let k = 1; k <= fullMA.length; k++) {
      if (t - k >= 0) pred += fullMA[k - 1] * epsW[t - k];
    }
    fittedDiff[t] = wMean + pred;
    epsW[t] = wc[t] - pred;
    sse += epsW[t] * epsW[t];
  }

  // Reconstruct fitted values on undifferenced transformed scale
  const lostObs = T - nW;
  const fittedW = new Array(T).fill(null);
  const residualsW = new Array(T).fill(null);
  for (let t = lostObs; t < T; t++) {
    residualsW[t] = epsW[t - lostObs];
    fittedW[t] = y[t] - residualsW[t];
  }

  const kParams = totalParams + (includeConstant ? 1 : 0) + 1;
  const sigma2 = sse / Math.max(1, nW - totalParams - (includeConstant ? 1 : 0));
  const sigma = Math.sqrt(sigma2);
  const aic = nW * Math.log(Math.max(EPSILON, sse / nW)) + 2 * kParams;
  const aicc = aic + (2 * kParams * (kParams + 1)) / Math.max(1, nW - kParams - 1);
  const bic = nW * Math.log(Math.max(EPSILON, sse / nW)) + kParams * Math.log(nW);

  // Forecast on differenced scale, then invert differencing
  const wcExt = [...wc];
  const epsExt = [...epsW];
  const diffForecasts = [];
  for (let h = 1; h <= horizon; h++) {
    const tIdx = nW + h - 1;
    let pred = 0.0;
    for (let k = 1; k <= fullAR.length; k++) {
      if (tIdx - k >= 0) pred += fullAR[k - 1] * wcExt[tIdx - k];
    }
    for (let k = 1; k <= fullMA.length; k++) {
      if (tIdx - k >= 0 && tIdx - k < nW) pred += fullMA[k - 1] * epsExt[tIdx - k];
    }
    wcExt.push(pred);
    epsExt.push(0.0);
    diffForecasts.push(wMean + pred);
  }

  // Invert ordinary differencing d times, then seasonal differencing D times
  let invForecasts = [...diffForecasts];
  for (let idx = diffObj.history.length - 1; idx >= 0; idx--) {
    const step = diffObj.history[idx];
    if (step.type === "ordinary") {
      const next = [];
      let prev = step.tail[0];
      for (let h = 0; h < invForecasts.length; h++) {
        const val = prev + invForecasts[h];
        next.push(val);
        prev = val;
      }
      invForecasts = next;
    } else if (step.type === "seasonal") {
      const next = [];
      const buf = [...step.tail];
      for (let h = 0; h < invForecasts.length; h++) {
        const val = buf[h] + invForecasts[h];
        next.push(val);
        buf.push(val);
      }
      invForecasts = next;
    }
  }

  // Exact Wold psi-weights for horizon forecast standard errors
  const psiWeights = computeArimaPsiWeights(fullAR, fullMA, d, D, m, horizon);
  const seW = new Array(horizon).fill(0.0);
  let cumPsi2 = 0.0;
  for (let h = 0; h < horizon; h++) {
    cumPsi2 += psiWeights[h] * psiWeights[h];
    seW[h] = sigma * Math.sqrt(cumPsi2);
  }

  const fitted = fittedW.map(val => (val === null ? null : backTransformValue(val, sigma2, { ...transformCfg, ...forward.params }, biasAdjust)));
  const origResiduals = rawValues.map((rv, i) => (fitted[i] === null ? null : rv - fitted[i]));
  const built = buildPredictionIntervals(invForecasts, seW, Infinity, levels, { ...transformCfg, ...forward.params }, biasAdjust);
  const futureTimestamps = timestamps && timestamps.length > 0
    ? generateFutureTimestamps(timestamps[timestamps.length - 1], frequency, horizon, m)
    : Array.from({ length: horizon }, (_, i) => String(T + i + 1));

  const lb = ljungBoxTest(epsW, Math.min(10, Math.floor(nW / 3)), totalParams);
  const label = (P > 0 || D > 0 || Q > 0)
    ? `ARIMA(${p},${d},${q})(${P},${D},${Q})[${m}]`
    : `ARIMA(${p},${d},${q})`;

  return {
    valid: true,
    modelType: "ARIMA",
    modelName: label,
    family: "ARIMA",
    trainingSampleSize: T,
    effectiveSampleSize: nW,
    seasonalPeriod: m,
    horizon,
    orders: { p, d, q, P, D, Q, m, includeConstant },
    parameters: {
      ar: arCoeffs,
      ma: maCoeffs,
      sar: sarCoeffs,
      sma: smaCoeffs,
      driftOrMean: wMean,
      sigma
    },
    informationCriteria: { aic, aicc, bic },
    fittedValues: fitted,
    residuals: origResiduals,
    transformedResiduals: residualsW,
    futureTimestamps,
    pointForecasts: built.pointForecasts,
    intervals: built.intervals,
    stdErrors: seW,
    psiWeights,
    diagnostics: {
      sigma,
      aic,
      aicc,
      bic,
      ljungBox: lb,
      residualStats: computeUnivariateStats(origResiduals)
    },
    estimationStatus: totalParams === 0 ? "Exact Closed-Form" : (optResult.converged ? "CSS-Innovations Nelder-Mead Converged" : "CSS-Innovations Max Iterations"),
    estimationMethod: "Conditional Sum of Squares (CSS) with Admissibility Root Barrier",
    warnings: [],
    reproducibility: { engineVersion: ENGINE_VERSION, transform: transformCfg, biasAdjust }
  };
}

/**
 * Automatic / Guided ARIMA Candidate Search
 * Keeps differencing orders (d, D) fixed across the candidate comparison so AICc values
 * are evaluated on the exact same differenced likelihood scale (FPP3 Section 9.7).
 */
export function autoSelectARIMA(rawValues, timestamps, config = {}) {
  const m = Math.max(1, Number(config.seasonalPeriod || 12));
  const feats = extractSeriesFeatures(rawValues, m);
  const d = config.d !== undefined ? Number(config.d) : (feats.trendStrength > 0.45 || Math.abs(feats.acf1) > 0.65 ? 1 : 0);
  const D = config.D !== undefined ? Number(config.D) : (m > 1 && rawValues.length >= 2 * m && feats.seasonalStrength > 0.55 ? 1 : 0);

  const candidateOrders = [
    { p: 0, q: 0, P: 0, Q: 0 },
    { p: 1, q: 0, P: 0, Q: 0 },
    { p: 0, q: 1, P: 0, Q: 0 },
    { p: 1, q: 1, P: 0, Q: 0 },
    { p: 2, q: 0, P: 0, Q: 0 },
    { p: 0, q: 2, P: 0, Q: 0 },
    { p: 2, q: 1, P: 0, Q: 0 }
  ];
  if (m > 1 && rawValues.length >= 2 * m + 6) {
    candidateOrders.push(
      { p: 0, q: 1, P: 0, Q: 1 },
      { p: 1, q: 0, P: 1, Q: 0 },
      { p: 1, q: 1, P: 0, Q: 1 },
      { p: 1, q: 1, P: 1, Q: 1 }
    );
  }

  const results = [];
  for (const ord of candidateOrders) {
    const res = fitARIMAModel(rawValues, timestamps, {
      ...config,
      modelType: "ARIMA",
      p: ord.p,
      d,
      q: ord.q,
      P: ord.P,
      D,
      Q: ord.Q
    });
    if (res.valid) results.push(res);
  }
  if (results.length === 0) {
    return { valid: false, modelType: "ARIMA_AUTO", reason: "No candidate ARIMA model could be fitted." };
  }
  results.sort((a, b) => a.informationCriteria.aicc - b.informationCriteria.aicc);
  const best = results[0];
  return {
    ...best,
    selectedFromAuto: true,
    searchedCandidates: results.map(r => ({
      modelName: r.modelName,
      orders: r.orders,
      aic: r.informationCriteria.aic,
      aicc: r.informationCriteria.aicc,
      bic: r.informationCriteria.bic,
      sigma: r.diagnostics.sigma
    }))
  };
}

/* ==========================================================================
   SECTION 11: TIME-SERIES REGRESSION & DYNAMIC REGRESSION (ARIMA ERRORS)
   ========================================================================== */

/**
 * Build deterministic and exogenous design matrix row at time index t (1-indexed)
 */
function buildRegressionDesignRow(tIndex1Based, m, regConfig, extPredictorRow = null) {
  const row = [1.0]; // Intercept
  const termNames = ["(Intercept)"];

  if (regConfig.includeTrend !== false) {
    row.push(tIndex1Based);
    termNames.push("trend_t");
    if (regConfig.polynomialDegree >= 2) {
      row.push(tIndex1Based * tIndex1Based);
      termNames.push("trend_t2");
    }
  }

  if (regConfig.seasonalType === "dummies" && m > 1) {
    const seasonIdx = (tIndex1Based - 1) % m;
    for (let s = 1; s < m; s++) {
      row.push(seasonIdx === s ? 1.0 : 0.0);
      termNames.push(`season_${s + 1}`);
    }
  } else if (regConfig.seasonalType === "fourier" && m > 1) {
    const K = Math.min(Math.floor(m / 2), Math.max(1, Number(regConfig.fourierK || 2)));
    for (let k = 1; k <= K; k++) {
      const angle = (2.0 * Math.PI * k * tIndex1Based) / m;
      row.push(Math.sin(angle));
      termNames.push(`sin_k${k}`);
      if (k < m / 2) {
        row.push(Math.cos(angle));
        termNames.push(`cos_k${k}`);
      }
    }
  }

  if (regConfig.interventionIndex && Number(regConfig.interventionIndex) > 0) {
    const stepIdx = Number(regConfig.interventionIndex);
    row.push(tIndex1Based >= stepIdx ? 1.0 : 0.0);
    termNames.push(`intervention_step_t${stepIdx}`);
  }

  if (regConfig.predictorNames && regConfig.predictorNames.length > 0) {
    for (const pName of regConfig.predictorNames) {
      const val = extPredictorRow && extPredictorRow[pName] !== undefined ? Number(extPredictorRow[pName]) : NaN;
      row.push(val);
      termNames.push(pName);
    }
  }

  return { row, termNames };
}

/**
 * Fit Time-Series Regression or Dynamic Regression (Regression with ARIMA errors)
 * Enforces strict validation of future predictors x_{T+h} (Part 13.5 Mandatory Integrity Requirement)
 */
export function fitTSRegressionModel(rawValues, timestamps, config = {}) {
  const isDynamic = (config.modelType || "").toUpperCase() === "DYN_REG";
  const m = Math.max(1, Number(config.seasonalPeriod || 12));
  const horizon = Math.max(1, Number(config.horizon || 12));
  const frequency = config.frequency || "monthly";
  const levels = config.levels || [80, 95];
  const transformCfg = config.transform || { type: "none" };
  const biasAdjust = Boolean(config.biasAdjust);

  const forward = applyForwardTransform(rawValues, transformCfg);
  if (!forward.valid) return { valid: false, modelType: config.modelType || "TS_REG", reason: forward.reason };
  const y = forward.values;
  const T = y.length;

  const predictorNames = config.predictorNames || [];
  const trainPredictors = config.trainPredictors || [];
  const futurePredictors = config.futurePredictors || [];

  // Mandatory Future Predictor Validation (Part 13.5 & Scenario 7)
  if (predictorNames.length > 0) {
    if (!futurePredictors || futurePredictors.length < horizon) {
      return {
        valid: false,
        code: "MISSING_FUTURE_PREDICTORS",
        modelType: config.modelType || "TS_REG",
        reason: `Regression model includes external predictor(s) [${predictorNames.join(", ")}], which require known or scenario-assumed future values for all h=1..${horizon} forecast steps. Supply future predictor scenarios or remove external predictors to prevent data leakage.`
      };
    }
    for (let h = 0; h < horizon; h++) {
      for (const pName of predictorNames) {
        if (futurePredictors[h] === undefined || !Number.isFinite(Number(futurePredictors[h][pName]))) {
          return {
            valid: false,
            code: "MISSING_FUTURE_PREDICTORS",
            modelType: config.modelType || "TS_REG",
            reason: `Missing or non-numeric future predictor '${pName}' at forecast step h=${h + 1}.`
          };
        }
      }
    }
  }

  const X = [];
  let termNames = [];
  for (let t = 0; t < T; t++) {
    const built = buildRegressionDesignRow(t + 1, m, config, trainPredictors[t] || {});
    if (built.row.some(v => !Number.isFinite(v))) {
      return {
        valid: false,
        modelType: config.modelType || "TS_REG",
        reason: `Training predictor matrix contains missing or non-finite values at index t=${t + 1}.`
      };
    }
    X.push(built.row);
    if (t === 0) termNames = built.termNames;
  }

  const pCols = termNames.length;
  if (T <= pCols + 1) {
    return {
      valid: false,
      modelType: config.modelType || "TS_REG",
      reason: `Insufficient degrees of freedom: T=${T} observations for p=${pCols} regression parameters.`
    };
  }

  // Compute X^T X and X^T y
  const XtX = Array.from({ length: pCols }, () => new Array(pCols).fill(0.0));
  const Xty = new Array(pCols).fill(0.0);
  for (let i = 0; i < T; i++) {
    for (let j = 0; j < pCols; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let k = j; k < pCols; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  for (let j = 0; j < pCols; j++) {
    for (let k = 0; k < j; k++) XtX[j][k] = XtX[k][j];
  }

  const XtXInv = invertMatrix(XtX);
  if (!XtXInv) {
    return {
      valid: false,
      code: "SINGULAR_MATRIX",
      modelType: config.modelType || "TS_REG",
      reason: "Design matrix X^T X is singular or collinear. Reduce Fourier order or remove collinear predictors."
    };
  }

  const beta = solveLinearSystem(XtX, Xty);
  if (!beta) {
    return { valid: false, code: "SINGULAR_MATRIX", modelType: config.modelType || "TS_REG", reason: "Failed to solve normal equations." };
  }

  const regFittedW = new Array(T);
  const regResidW = new Array(T);
  let sse = 0.0;
  const yMean = computeUnivariateStats(y).mean;
  let sst = 0.0;
  for (let t = 0; t < T; t++) {
    let yh = 0.0;
    for (let j = 0; j < pCols; j++) yh += X[t][j] * beta[j];
    regFittedW[t] = yh;
    regResidW[t] = y[t] - yh;
    sse += regResidW[t] * regResidW[t];
    sst += (y[t] - yMean) ** 2;
  }

  const df = T - pCols;
  const s2 = sse / df;
  const se = Math.sqrt(s2);
  const rSquared = sst > EPSILON ? Math.max(0.0, 1.0 - sse / sst) : 0.0;
  const adjRSquared = 1.0 - ((1.0 - rSquared) * (T - 1)) / df;

  const coefficients = termNames.map((name, j) => {
    const seBeta = se * Math.sqrt(Math.max(0.0, XtXInv[j][j]));
    const tStat = seBeta > EPSILON ? beta[j] / seBeta : 0.0;
    const pVal = studentTTwoSidedPValue(tStat, df);
    const tCrit = studentTCritical(df, 0.95);
    return {
      term: name,
      estimate: beta[j],
      standardError: seBeta,
      tStatistic: tStat,
      pValue: pVal,
      confidenceInterval95: [beta[j] - tCrit * seBeta, beta[j] + tCrit * seBeta]
    };
  });

  // If Dynamic Regression, fit ARIMA(p,0,q) to regression error process eta_t
  let arimaErrorFit = null;
  if (isDynamic) {
    arimaErrorFit = fitARIMAModel(regResidW, timestamps, {
      p: config.arimaP ?? 1,
      d: 0,
      q: config.arimaQ ?? 1,
      P: 0,
      D: 0,
      Q: 0,
      includeConstant: false,
      seasonalPeriod: m,
      horizon
    });
  }

  const finalFittedW = new Array(T);
  const finalResidW = new Array(T);
  for (let t = 0; t < T; t++) {
    if (isDynamic && arimaErrorFit && arimaErrorFit.valid && arimaErrorFit.fittedValues[t] !== null) {
      finalFittedW[t] = regFittedW[t] + arimaErrorFit.fittedValues[t];
      finalResidW[t] = y[t] - finalFittedW[t];
    } else {
      finalFittedW[t] = regFittedW[t];
      finalResidW[t] = regResidW[t];
    }
  }

  // Forecast future h = 1..horizon
  const pointW = new Array(horizon);
  const sePredW = new Array(horizon);
  const seMeanResponseW = new Array(horizon);

  for (let h = 1; h <= horizon; h++) {
    const x0 = buildRegressionDesignRow(T + h, m, config, futurePredictors[h - 1] || {}).row;
    let yh = 0.0;
    for (let j = 0; j < pCols; j++) yh += x0[j] * beta[j];
    if (isDynamic && arimaErrorFit && arimaErrorFit.valid) {
      yh += arimaErrorFit.pointForecasts[h - 1];
    }
    pointW[h - 1] = yh;

    // Out-of-sample leverage h_0 = x_0^T (X^T X)^{-1} x_0
    let h0 = 0.0;
    for (let j = 0; j < pCols; j++) {
      for (let k = 0; k < pCols; k++) {
        h0 += x0[j] * XtXInv[j][k] * x0[k];
      }
    }
    h0 = Math.max(0.0, h0);
    seMeanResponseW[h - 1] = se * Math.sqrt(h0);
    if (isDynamic && arimaErrorFit && arimaErrorFit.valid) {
      const arimaVar = arimaErrorFit.stdErrors[h - 1] ** 2;
      sePredW[h - 1] = Math.sqrt(arimaVar + s2 * h0);
    } else {
      sePredW[h - 1] = se * Math.sqrt(1.0 + h0);
    }
  }

  const finalSigma = isDynamic && arimaErrorFit?.valid ? arimaErrorFit.diagnostics.sigma : se;
  const kTotal = pCols + (isDynamic && arimaErrorFit?.valid ? (config.arimaP ?? 1) + (config.arimaQ ?? 1) : 0) + 1;
  const finalSSE = finalResidW.reduce((s, r) => s + (r !== null ? r * r : 0), 0);
  const aic = T * Math.log(Math.max(EPSILON, finalSSE / T)) + 2 * kTotal;
  const aicc = aic + (2 * kTotal * (kTotal + 1)) / Math.max(1, T - kTotal - 1);
  const bic = T * Math.log(Math.max(EPSILON, finalSSE / T)) + kTotal * Math.log(T);

  const fitted = finalFittedW.map(val => backTransformValue(val, finalSigma ** 2, { ...transformCfg, ...forward.params }, biasAdjust));
  const origResiduals = rawValues.map((rv, i) => rv - fitted[i]);
  const built = buildPredictionIntervals(pointW, sePredW, isDynamic ? Infinity : df, levels, { ...transformCfg, ...forward.params }, biasAdjust);
  const meanBuilt = buildPredictionIntervals(pointW, seMeanResponseW, df, [95], { ...transformCfg, ...forward.params }, false);

  const futureTimestamps = timestamps && timestamps.length > 0
    ? generateFutureTimestamps(timestamps[timestamps.length - 1], frequency, horizon, m)
    : Array.from({ length: horizon }, (_, i) => String(T + i + 1));

  const lb = ljungBoxTest(finalResidW, Math.min(10, Math.floor(T / 3)), kTotal - 1);

  return {
    valid: true,
    modelType: isDynamic ? "DYN_REG" : "TS_REG",
    modelName: isDynamic ? "Dynamic Regression (ARIMA Errors)" : "Time-Series Linear Regression",
    family: isDynamic ? "Dynamic Regression" : "Regression",
    trainingSampleSize: T,
    degreesOfFreedom: df,
    seasonalPeriod: m,
    horizon,
    coefficients,
    parameters: {
      coefficients,
      rSquared,
      adjRSquared,
      sigma: finalSigma,
      arimaErrorOrders: isDynamic && arimaErrorFit?.valid ? arimaErrorFit.orders : null,
      arimaErrorParams: isDynamic && arimaErrorFit?.valid ? arimaErrorFit.parameters : null
    },
    informationCriteria: { aic, aicc, bic },
    fittedValues: fitted,
    residuals: origResiduals,
    transformedResiduals: finalResidW,
    futureTimestamps,
    pointForecasts: built.pointForecasts,
    intervals: built.intervals,
    meanResponseConfidenceInterval95: meanBuilt.intervals[95],
    stdErrors: sePredW,
    diagnostics: {
      sigma: finalSigma,
      rSquared,
      adjRSquared,
      aic,
      aicc,
      bic,
      ljungBox: lb,
      residualStats: computeUnivariateStats(origResiduals)
    },
    estimationStatus: isDynamic ? "GLS / Two-Stage ARIMA Error Fit" : "Exact OLS QR/Gaussian Solution",
    warnings: lb.significant && !isDynamic
      ? ["Residual autocorrelation is statistically significant (Ljung-Box p < 0.05). Ordinary OLS standard errors may be understated; consider Dynamic Regression with ARIMA errors."]
      : [],
    reproducibility: { engineVersion: ENGINE_VERSION, transform: transformCfg, biasAdjust, predictorNames }
  };
}

/* ==========================================================================
   SECTION 12: UNIFIED MODEL DISPATCHER, ENSEMBLES, SCENARIOS & HIERARCHIES
   ========================================================================== */

/**
 * Master dispatcher to fit any registered forecasting model by modelType
 */
export function fitForecastModel(rawValues, timestamps, config = {}) {
  const modelType = (config.modelType || "NAIVE").toUpperCase();
  if (["MEAN", "NAIVE", "SNAIVE", "DRIFT"].includes(modelType)) {
    return fitBaselineModel(rawValues, timestamps, config);
  }
  if (modelType.startsWith("ETS")) {
    return fitETSModel(rawValues, timestamps, config);
  }
  if (modelType.startsWith("ARIMA")) {
    return fitARIMAModel(rawValues, timestamps, config);
  }
  if (modelType === "TS_REG" || modelType === "DYN_REG") {
    return fitTSRegressionModel(rawValues, timestamps, config);
  }
  if (modelType === "ENSEMBLE") {
    return fitEnsembleModel(rawValues, timestamps, config);
  }
  return { valid: false, modelType, reason: `Unsupported model type: ${modelType}` };
}

/**
 * Forecast Combination (Ensemble of ETS + ARIMA + Seasonal Naive / Drift)
 */
export function fitEnsembleModel(rawValues, timestamps, config = {}) {
  const m = Math.max(1, Number(config.seasonalPeriod || 12));
  const memberSpecs = config.members || (m > 1 && rawValues.length >= 2 * m ? ["SNAIVE", "ETS_AUTO", "ARIMA_AUTO"] : ["DRIFT", "ETS_AUTO", "ARIMA_AUTO"]);
  const memberFits = [];
  for (const spec of memberSpecs) {
    const fit = fitForecastModel(rawValues, timestamps, { ...config, modelType: spec });
    if (fit.valid) memberFits.push(fit);
  }
  if (memberFits.length === 0) {
    return { valid: false, modelType: "ENSEMBLE", reason: "No ensemble member models succeeded." };
  }

  const T = rawValues.length;
  const horizon = Math.max(1, Number(config.horizon || 12));
  const weights = new Array(memberFits.length).fill(1.0 / memberFits.length);

  const fittedValues = new Array(T).fill(null);
  const residuals = new Array(T).fill(null);
  for (let t = 0; t < T; t++) {
    let sum = 0.0;
    let wSum = 0.0;
    for (let k = 0; k < memberFits.length; k++) {
      const fv = memberFits[k].fittedValues[t];
      if (fv !== null && Number.isFinite(fv)) {
        sum += weights[k] * fv;
        wSum += weights[k];
      }
    }
    if (wSum > 0) {
      fittedValues[t] = sum / wSum;
      residuals[t] = rawValues[t] - fittedValues[t];
    }
  }

  const pointForecasts = new Array(horizon).fill(0.0);
  const stdErrors = new Array(horizon).fill(0.0);
  for (let h = 0; h < horizon; h++) {
    let pt = 0.0;
    let varComb = 0.0;
    for (let k = 0; k < memberFits.length; k++) {
      pt += weights[k] * memberFits[k].pointForecasts[h];
    }
    for (let k = 0; k < memberFits.length; k++) {
      const seK = memberFits[k].stdErrors[h] || 0;
      const diffK = memberFits[k].pointForecasts[h] - pt;
      varComb += weights[k] * (seK * seK + diffK * diffK);
    }
    pointForecasts[h] = pt;
    stdErrors[h] = Math.sqrt(varComb);
  }

  const levels = config.levels || [80, 95];
  const intervals = {};
  for (const lvl of levels) {
    const z = inverseNormalCDF(1.0 - 0.5 * (1.0 - lvl / 100.0));
    intervals[lvl] = pointForecasts.map((pt, h) => [pt - z * stdErrors[h], pt + z * stdErrors[h]]);
  }

  const cleanRes = residuals.filter(v => v !== null && Number.isFinite(v));
  const sigma = computeUnivariateStats(cleanRes).stdDev || 0.0;
  const lb = ljungBoxTest(cleanRes, Math.min(10, Math.floor(T / 3)), memberFits.length);

  return {
    valid: true,
    modelType: "ENSEMBLE",
    modelName: `Forecast Combination (${memberFits.map(f => f.modelType).join(" + ")})`,
    family: "Ensemble",
    trainingSampleSize: T,
    seasonalPeriod: m,
    horizon,
    parameters: {
      members: memberFits.map((f, i) => ({ modelType: f.modelType, modelName: f.modelName, weight: weights[i] })),
      sigma
    },
    fittedValues,
    residuals,
    transformedResiduals: residuals,
    futureTimestamps: memberFits[0].futureTimestamps,
    pointForecasts,
    intervals,
    stdErrors,
    diagnostics: {
      sigma,
      ljungBox: lb,
      residualStats: computeUnivariateStats(origResidualsSafe(residuals))
    },
    estimationStatus: "Equal-Weight Model Combination",
    warnings: [],
    reproducibility: { engineVersion: ENGINE_VERSION, members: memberSpecs }
  };
}

function origResidualsSafe(arr) {
  return arr.filter(v => v !== null && Number.isFinite(v));
}

/**
 * Transparent Model Recommendation Engine (Part 17.4 & 17.5)
 * Uses actual extracted series features, sample size, seasonality, and predictor availability.
 */
export function recommendForecastModels(validationResult, features, hasExternalPredictors = false) {
  const T = validationResult.completeCount;
  const m = validationResult.seasonalPeriod || 1;
  const recommendations = [];

  // Always include appropriate baseline benchmark
  if (m > 1 && T >= m) {
    recommendations.push({
      modelType: "SNAIVE",
      priority: "Mandatory Seasonal Benchmark",
      score: 75,
      rationale: `Repeats the last observed cycle of period m=${m}. Essential baseline before adopting complex seasonal models.`,
      assumptions: "Seasonal differences are uncorrelated noise.",
      failureMode: "Cannot extrapolate secular upward or downward trends."
    });
  } else {
    recommendations.push({
      modelType: "NAIVE",
      priority: "Mandatory Baseline Benchmark",
      score: 72,
      rationale: "Random-walk benchmark forecasting the most recent observation y_T.",
      assumptions: "First differences are white noise.",
      failureMode: "Does not capture seasonality or deterministic trend."
    });
  }

  if (features.trendStrength > 0.40) {
    recommendations.push({
      modelType: "ETS_AAdN",
      priority: "Recommended for Damped Trend",
      score: 86,
      rationale: `Series exhibits strong trend (F_T = ${features.trendStrength.toFixed(2)}). Damped trend prevents unrealistic long-horizon overshooting.`,
      assumptions: "Local level and damped slope evolve smoothly.",
      failureMode: "Does not model seasonal patterns unless combined with seasonal states."
    });
  }

  if (m > 1 && T >= 2 * m && features.seasonalStrength > 0.35) {
    const useMult = validationResult.observations.every(o => o.value === null || o.value > 0) && features.varianceRatio > 1.6;
    recommendations.push({
      modelType: useMult ? "ETS_MAM" : "ETS_AAA",
      priority: "Primary Seasonal State-Space Candidate",
      score: 92,
      rationale: `Strong seasonality detected (F_S = ${features.seasonalStrength.toFixed(2)}, m = ${m})${useMult ? " with expanding variance (ratio = " + features.varianceRatio.toFixed(2) + ")" : ""}.`,
      assumptions: useMult ? "Positive data with multiplicative seasonality and error." : "Additive trend and seasonal state transitions.",
      failureMode: "Sensitive to structural breaks or sudden regime shifts."
    });
  }

  if (T >= Math.max(12, 2 * m + 4)) {
    recommendations.push({
      modelType: "ARIMA_AUTO",
      priority: "Recommended Autocorrelation Candidate",
      score: 90,
      rationale: `Lag-1 autocorrelation r_1 = ${features.acf1.toFixed(2)}. Guided ARIMA search evaluates differencing and ARMA polynomials via AICc.`,
      assumptions: "Differenced series is covariance stationary.",
      failureMode: "Overdifferencing inflates variance; local search covers bounded (p,q) grid."
    });
  }

  if (hasExternalPredictors) {
    recommendations.push({
      modelType: "DYN_REG",
      priority: "Recommended Exogenous Candidate",
      score: 94,
      rationale: "Dataset includes external predictor variables. Dynamic regression fits exogenous effects jointly with ARIMA disturbance errors.",
      assumptions: "Future values of predictors x_{T+h} must be known or scenario-assumed.",
      failureMode: "Requires valid future predictor scenarios; cannot extrapolate unmodeled predictor shocks."
    });
  }

  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * Scenario & Judgmental Adjustment Engine (Part 18)
 * Keeps statistical model forecast distinct from documented expert judgment overrides.
 */
export function buildScenarioForecast(baseFit, scenarioConfig = {}) {
  if (!baseFit || !baseFit.valid) return { valid: false, reason: "Invalid base forecast." };
  const horizon = baseFit.horizon;
  const adjustmentType = scenarioConfig.adjustmentType || "none"; // "none" | "level_shift" | "percent_scaling" | "custom_vector"
  const amount = Number(scenarioConfig.amount || 0);
  const reason = scenarioConfig.reason || "Unspecified scenario assumption";
  const author = scenarioConfig.author || "Analyst";

  const statisticalPoint = [...baseFit.pointForecasts];
  const adjustedPoint = new Array(horizon);
  const adjustedIntervals = {};
  for (const lvl of Object.keys(baseFit.intervals)) {
    adjustedIntervals[lvl] = [];
  }

  for (let h = 0; h < horizon; h++) {
    let adj = statisticalPoint[h];
    if (adjustmentType === "level_shift") {
      adj = statisticalPoint[h] + amount;
    } else if (adjustmentType === "percent_scaling") {
      adj = statisticalPoint[h] * (1.0 + amount / 100.0);
    } else if (adjustmentType === "custom_vector" && Array.isArray(scenarioConfig.customAdjustments)) {
      adj = statisticalPoint[h] + Number(scenarioConfig.customAdjustments[h] || 0);
    }
    if (scenarioConfig.enforceNonNegative) {
      adj = Math.max(0.0, adj);
    }
    adjustedPoint[h] = adj;
    const delta = adj - statisticalPoint[h];
    for (const lvl of Object.keys(baseFit.intervals)) {
      const [lo, hi] = baseFit.intervals[lvl][h];
      const newLo = scenarioConfig.enforceNonNegative ? Math.max(0.0, lo + delta) : lo + delta;
      const newHi = scenarioConfig.enforceNonNegative ? Math.max(0.0, hi + delta) : hi + delta;
      adjustedIntervals[lvl].push([newLo, newHi]);
    }
  }

  return {
    valid: true,
    scenarioName: scenarioConfig.name || "Custom Scenario",
    isJudgmentallyAdjusted: adjustmentType !== "none" || Boolean(scenarioConfig.enforceNonNegative),
    auditLog: {
      author,
      timestamp: new Date().toISOString(),
      adjustmentType,
      amount,
      enforceNonNegative: Boolean(scenarioConfig.enforceNonNegative),
      reason
    },
    futureTimestamps: baseFit.futureTimestamps,
    statisticalPointForecasts: statisticalPoint,
    adjustedPointForecasts: adjustedPoint,
    statisticalIntervals: baseFit.intervals,
    adjustedIntervals
  };
}

/**
 * Hierarchical & Grouped Forecast Reconciliation (Part 19)
 * Supports Additive Hierarchies: Total = sum of Bottom-Level Series
 * Methods:
 * - "bottom_up": Sum bottom-level forecasts directly
 * - "top_down": Disaggregate top-level forecast using historical training proportions
 * - "wls_structural": Structural WLS reconciliation (Hyndman et al., 2011 / FPP3 Section 11.3)
 */
export function reconcileHierarchicalForecasts(hierarchyData, config = {}) {
  const method = config.reconciliationMethod || "bottom_up";
  const modelType = config.modelType || "ETS_AUTO";
  const horizon = Math.max(1, Number(config.horizon || 8));
  const m = Math.max(1, Number(config.seasonalPeriod || 4));

  const bottomNames = hierarchyData.bottomSeriesNames || [];
  if (bottomNames.length === 0) {
    return { valid: false, reason: "No bottom-level series defined in hierarchy." };
  }

  const T = hierarchyData.timestamps.length;
  const totalActual = new Array(T).fill(0.0);
  const bottomActuals = {};
  const bottomBaseFits = {};

  for (const name of bottomNames) {
    const vals = hierarchyData.series[name];
    bottomActuals[name] = vals;
    for (let t = 0; t < T; t++) totalActual[t] += vals[t];
    bottomBaseFits[name] = fitForecastModel(vals, hierarchyData.timestamps, { modelType, horizon, seasonalPeriod: m, frequency: hierarchyData.frequency });
    if (!bottomBaseFits[name].valid) {
      return { valid: false, reason: `Failed to fit base model for bottom series ${name}: ${bottomBaseFits[name].reason}` };
    }
  }

  const totalBaseFit = fitForecastModel(totalActual, hierarchyData.timestamps, { modelType, horizon, seasonalPeriod: m, frequency: hierarchyData.frequency });
  if (!totalBaseFit.valid) {
    return { valid: false, reason: `Failed to fit base model for Total series: ${totalBaseFit.reason}` };
  }

  const nB = bottomNames.length;
  const reconciledBottom = {};
  for (const name of bottomNames) reconciledBottom[name] = new Array(horizon).fill(0.0);
  const reconciledTotal = new Array(horizon).fill(0.0);
  const reconciledTotalSE = new Array(horizon).fill(0.0);

  // Historical proportions for top-down
  const sumTotalHist = totalActual.reduce((a, b) => a + b, 0);
  const histProps = bottomNames.map(name => {
    const s = bottomActuals[name].reduce((a, b) => a + b, 0);
    return Math.abs(sumTotalHist) > EPSILON ? s / sumTotalHist : 1.0 / nB;
  });

  for (let h = 0; h < horizon; h++) {
    const yHatTotal = totalBaseFit.pointForecasts[h];
    const yHatBottom = bottomNames.map(name => bottomBaseFits[name].pointForecasts[h]);
    const sumBottomBase = yHatBottom.reduce((a, b) => a + b, 0);

    if (method === "bottom_up") {
      for (let i = 0; i < nB; i++) reconciledBottom[bottomNames[i]][h] = yHatBottom[i];
      reconciledTotal[h] = sumBottomBase;
    } else if (method === "top_down") {
      reconciledTotal[h] = yHatTotal;
      for (let i = 0; i < nB; i++) reconciledBottom[bottomNames[i]][h] = histProps[i] * yHatTotal;
    } else {
      // Structural WLS Reconciliation for a 2-level hierarchy with nB bottom nodes:
      // W = diag(nB, 1, 1, ..., 1). Closed-form solution of S (S^T W^{-1} S)^{-1} S^T W^{-1} y_hat:
      // Let discrepancy d = yHatTotal - sum(yHatBottom).
      // Under structural WLS (w_Total = nB, w_i = 1), each bottom series adjusts by +d / (2 * nB)
      // and under OLS (W = I), each bottom series adjusts by +d / (nB + 1).
      const d = yHatTotal - sumBottomBase;
      const denom = method === "ols_reconciliation" ? (nB + 1) : (2.0 * nB);
      let sumRec = 0.0;
      for (let i = 0; i < nB; i++) {
        const val = yHatBottom[i] + d / denom;
        reconciledBottom[bottomNames[i]][h] = val;
        sumRec += val;
      }
      reconciledTotal[h] = sumRec;
    }

    // Coherent aggregate standard error accounting for empirical residual covariance across bottom series
    let varSum = 0.0;
    for (let i = 0; i < nB; i++) {
      for (let j = 0; j < nB; j++) {
        const seI = bottomBaseFits[bottomNames[i]].stdErrors[h] || 0;
        const seJ = bottomBaseFits[bottomNames[j]].stdErrors[h] || 0;
        if (i === j) {
          varSum += seI * seI;
        } else {
          // Estimate cross-series residual correlation r_{ij}
          const rI = bottomBaseFits[bottomNames[i]].residuals;
          const rJ = bottomBaseFits[bottomNames[j]].residuals;
          const corr = computePairCorrelation(rI, rJ);
          varSum += corr * seI * seJ;
        }
      }
    }
    reconciledTotalSE[h] = Math.sqrt(Math.max(0.0, varSum));
  }

  // Verify numerical coherence within tolerance 1e-10
  let maxCoherenceDiscrepancy = 0.0;
  const baseCoherenceDiscrepancies = [];
  for (let h = 0; h < horizon; h++) {
    const sumRec = bottomNames.reduce((s, name) => s + reconciledBottom[name][h], 0);
    maxCoherenceDiscrepancy = Math.max(maxCoherenceDiscrepancy, Math.abs(reconciledTotal[h] - sumRec));
    const sumBase = bottomNames.reduce((s, name) => s + bottomBaseFits[name].pointForecasts[h], 0);
    baseCoherenceDiscrepancies.push(totalBaseFit.pointForecasts[h] - sumBase);
  }

  return {
    valid: true,
    reconciliationMethod: method,
    modelType,
    horizon,
    futureTimestamps: totalBaseFit.futureTimestamps,
    isCoherent: maxCoherenceDiscrepancy <= 1e-10,
    maxCoherenceDiscrepancy,
    baseCoherenceDiscrepancies,
    historicalProportions: histProps,
    baseForecasts: {
      Total: totalBaseFit.pointForecasts,
      ...Object.fromEntries(bottomNames.map(n => [n, bottomBaseFits[n].pointForecasts]))
    },
    reconciledForecasts: {
      Total: reconciledTotal,
      ...reconciledBottom
    },
    reconciledTotalIntervals95: reconciledTotal.map((pt, h) => [
      pt - 1.95996 * reconciledTotalSE[h],
      pt + 1.95996 * reconciledTotalSE[h]
    ])
  };
}

function computePairCorrelation(a, b) {
  const pairs = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== null && b[i] !== null && Number.isFinite(a[i]) && Number.isFinite(b[i])) {
      pairs.push([a[i], b[i]]);
    }
  }
  if (pairs.length < 3) return 0.0;
  const ma = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const mb = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let sab = 0, saa = 0, sbb = 0;
  for (const [va, vb] of pairs) {
    sab += (va - ma) * (vb - mb);
    saa += (va - ma) ** 2;
    sbb += (vb - mb) ** 2;
  }
  return saa > EPSILON && sbb > EPSILON ? Math.max(-1, Math.min(1, sab / Math.sqrt(saa * sbb))) : 0.0;
}

/* ==========================================================================
   SECTION 13: FORECAST EVALUATION, METRICS & ROLLING-ORIGIN BACKTESTING
   ========================================================================== */

/**
 * Compute comprehensive out-of-sample forecast accuracy and interval calibration metrics
 * Crucially, MASE and RMSSE denominators are computed strictly from the training series!
 */
export function computeAccuracyMetrics(actual, predicted, trainSeries = [], seasonalPeriod = 1, intervals95 = null) {
  const m = Math.max(1, Math.floor(seasonalPeriod));
  const errors = [];
  const absErrors = [];
  const sqErrors = [];
  const pctErrors = [];
  const symPctErrors = [];
  let zeroActualCount = 0;

  const N = Math.min(actual.length, predicted.length);
  for (let i = 0; i < N; i++) {
    const y = actual[i];
    const yh = predicted[i];
    if (y === null || yh === null || !Number.isFinite(y) || !Number.isFinite(yh)) continue;
    const e = y - yh;
    errors.push(e);
    absErrors.push(Math.abs(e));
    sqErrors.push(e * e);

    if (Math.abs(y) < 1e-8) {
      zeroActualCount++;
    } else {
      pctErrors.push(Math.abs(e / y) * 100.0);
    }
    const denomSym = Math.abs(y) + Math.abs(yh);
    if (denomSym > 1e-8) {
      symPctErrors.push((200.0 * Math.abs(e)) / denomSym);
    }
  }

  const count = errors.length;
  if (count === 0) {
    return { valid: false, count: 0 };
  }

  const me = errors.reduce((a, b) => a + b, 0) / count;
  const mae = absErrors.reduce((a, b) => a + b, 0) / count;
  const mse = sqErrors.reduce((a, b) => a + b, 0) / count;
  const rmse = Math.sqrt(mse);
  const mape = zeroActualCount === 0 && pctErrors.length > 0
    ? pctErrors.reduce((a, b) => a + b, 0) / pctErrors.length
    : null;
  const smape = symPctErrors.length > 0
    ? symPctErrors.reduce((a, b) => a + b, 0) / symPctErrors.length
    : null;

  // Compute in-sample naive/seasonal-naive scaling denominator from training data only
  let mase = null;
  let rmsse = null;
  const cleanTrain = trainSeries.filter(v => v !== null && Number.isFinite(v));
  const lagStep = m > 1 && cleanTrain.length > m ? m : 1;
  if (cleanTrain.length > lagStep) {
    let sumAbsDiff = 0.0;
    let sumSqDiff = 0.0;
    let dCount = 0;
    for (let t = lagStep; t < cleanTrain.length; t++) {
      const diff = cleanTrain[t] - cleanTrain[t - lagStep];
      sumAbsDiff += Math.abs(diff);
      sumSqDiff += diff * diff;
      dCount++;
    }
    const scaleMAE = dCount > 0 ? sumAbsDiff / dCount : 0.0;
    const scaleMSE = dCount > 0 ? sumSqDiff / dCount : 0.0;
    if (scaleMAE > EPSILON) mase = mae / scaleMAE;
    if (scaleMSE > EPSILON) rmsse = Math.sqrt(mse / scaleMSE);
  }

  // Empirical Interval Coverage, Average Width, and Winkler Score (FPP3 Section 5.9)
  let coverage95 = null;
  let avgWidth95 = null;
  let winklerScore95 = null;
  if (Array.isArray(intervals95) && intervals95.length >= N) {
    let covered = 0;
    let widthSum = 0.0;
    let winklerSum = 0.0;
    let intCount = 0;
    const alpha = 0.05;
    for (let i = 0; i < N; i++) {
      const y = actual[i];
      const bounds = intervals95[i];
      if (y !== null && Number.isFinite(y) && Array.isArray(bounds) && Number.isFinite(bounds[0]) && Number.isFinite(bounds[1])) {
        const [lo, hi] = bounds;
        const w = hi - lo;
        widthSum += w;
        if (y >= lo && y <= hi) covered++;
        let ws = w;
        if (y < lo) ws += (2.0 / alpha) * (lo - y);
        else if (y > hi) ws += (2.0 / alpha) * (y - hi);
        winklerSum += ws;
        intCount++;
      }
    }
    if (intCount > 0) {
      coverage95 = (covered / intCount) * 100.0;
      avgWidth95 = widthSum / intCount;
      winklerScore95 = winklerSum / intCount;
    }
  }

  const warnings = [];
  if (zeroActualCount > 0) {
    warnings.push(`MAPE is undefined because ${zeroActualCount} evaluation observation(s) equal zero. Prefer MASE or RMSE.`);
  }

  return {
    valid: true,
    count,
    me,
    mae,
    mse,
    rmse,
    mape,
    smape,
    mase,
    rmsse,
    scaleLagUsed: lagStep,
    coverage95,
    avgWidth95,
    winklerScore95,
    warnings
  };
}

/**
 * Chronological Holdout Train/Test Split Evaluation
 * Prevents data leakage by fitting imputation, transformations, and parameters strictly on y[0..splitIdx-1].
 */
export function evaluateChronologicalHoldout(rawValues, timestamps, modelConfig = {}, splitIndex = null) {
  const T = rawValues.length;
  const split = splitIndex !== null
    ? Math.max(4, Math.min(T - 1, Number(splitIndex)))
    : Math.max(4, Math.floor(T * 0.8));
  const horizon = T - split;

  const trainRaw = rawValues.slice(0, split);
  const testActual = rawValues.slice(split);
  const trainTimestamps = timestamps ? timestamps.slice(0, split) : [];
  const testTimestamps = timestamps ? timestamps.slice(split) : [];

  // Impute only within training window
  const trainImputed = imputeSeriesTrainingOnly(
    trainRaw.map(v => ({ value: v })),
    modelConfig.imputationMethod || "linear"
  ).map(o => o.value);

  // Check if external predictors are used and whether future predictors are genuinely allowed
  const cfg = {
    ...modelConfig,
    horizon,
    trainPredictors: modelConfig.allPredictors ? modelConfig.allPredictors.slice(0, split) : modelConfig.trainPredictors,
    futurePredictors: modelConfig.allowRealizedPredictorsInBacktest && modelConfig.allPredictors
      ? modelConfig.allPredictors.slice(split, split + horizon)
      : modelConfig.futurePredictors
  };

  const fit = fitForecastModel(trainImputed, trainTimestamps, cfg);
  if (!fit.valid) {
    return { valid: false, modelType: modelConfig.modelType, reason: fit.reason, code: fit.code };
  }

  const metrics = computeAccuracyMetrics(
    testActual,
    fit.pointForecasts,
    trainImputed,
    modelConfig.seasonalPeriod || 1,
    fit.intervals ? fit.intervals[95] : null
  );

  return {
    valid: true,
    modelType: fit.modelType,
    modelName: fit.modelName,
    splitIndex: split,
    trainSize: split,
    testSize: horizon,
    trainTimestamps,
    testTimestamps,
    trainActual: trainImputed,
    testActual,
    fit,
    metrics
  };
}

/**
 * Rolling-Origin Cross-Validation (Time-Series Backtesting)
 * Supports Expanding Window and Fixed-Width Sliding Window designs across multiple forecast origins.
 * Reports both overall metrics and horizon-specific accuracy (h = 1..H).
 */
export function runRollingOriginBacktest(rawValues, timestamps, modelConfig = {}, backtestConfig = {}) {
  const T = rawValues.length;
  const windowType = backtestConfig.windowType || "expanding"; // "expanding" | "sliding"
  const horizon = Math.max(1, Number(backtestConfig.horizon || 6));
  const stepSize = Math.max(1, Number(backtestConfig.stepSize || 1));
  const initialWindow = Math.max(
    6,
    Number(backtestConfig.initialWindow || Math.floor(T * 0.6))
  );

  if (initialWindow + 1 > T) {
    return {
      valid: false,
      reason: `Initial training window (${initialWindow}) leaves no held-out observations in series of length T=${T}.`
    };
  }

  const origins = [];
  const errorsByHorizon = Array.from({ length: horizon }, () => []);
  const allActual = [];
  const allPred = [];
  const allIntervals95 = [];

  for (let originIdx = initialWindow; originIdx <= T - 1; originIdx += stepSize) {
    const startIdx = windowType === "sliding" ? Math.max(0, originIdx - initialWindow) : 0;
    const trainSliceRaw = rawValues.slice(startIdx, originIdx);
    const trainSliceTime = timestamps ? timestamps.slice(startIdx, originIdx) : [];
    const evalSteps = Math.min(horizon, T - originIdx);
    const actualSlice = rawValues.slice(originIdx, originIdx + evalSteps);

    const trainImputed = imputeSeriesTrainingOnly(
      trainSliceRaw.map(v => ({ value: v })),
      modelConfig.imputationMethod || "linear"
    ).map(o => o.value);

    const cfg = {
      ...modelConfig,
      horizon: evalSteps,
      trainPredictors: modelConfig.allPredictors ? modelConfig.allPredictors.slice(startIdx, originIdx) : undefined,
      futurePredictors: modelConfig.allowRealizedPredictorsInBacktest && modelConfig.allPredictors
        ? modelConfig.allPredictors.slice(originIdx, originIdx + evalSteps)
        : modelConfig.futurePredictors
    };

    const fit = fitForecastModel(trainImputed, trainSliceTime, cfg);
    if (!fit.valid) {
      return { valid: false, reason: `Backtest failed at origin t=${originIdx}: ${fit.reason}`, code: fit.code };
    }

    const originForecasts = [];
    for (let h = 0; h < evalSteps; h++) {
      const yAct = actualSlice[h];
      const yPred = fit.pointForecasts[h];
      const int95 = fit.intervals?.[95]?.[h] || null;
      if (yAct !== null && Number.isFinite(yAct) && Number.isFinite(yPred)) {
        errorsByHorizon[h].push({ actual: yAct, predicted: yPred, error: yAct - yPred });
        allActual.push(yAct);
        allPred.push(yPred);
        if (int95) allIntervals95.push(int95);
      }
      originForecasts.push({
        step: h + 1,
        timestamp: timestamps ? timestamps[originIdx + h] : String(originIdx + h + 1),
        actual: yAct,
        predicted: yPred,
        interval95: int95
      });
    }

    origins.push({
      originIndex: originIdx,
      originTimestamp: timestamps ? timestamps[originIdx - 1] : String(originIdx),
      trainStartIndex: startIdx,
      trainSize: originIdx - startIdx,
      forecasts: originForecasts
    });
  }

  const horizonMetrics = errorsByHorizon.map((list, idx) => {
    if (list.length === 0) return { horizon: idx + 1, count: 0, mae: null, rmse: null, me: null };
    const count = list.length;
    const me = list.reduce((s, x) => s + x.error, 0) / count;
    const mae = list.reduce((s, x) => s + Math.abs(x.error), 0) / count;
    const rmse = Math.sqrt(list.reduce((s, x) => s + x.error * x.error, 0) / count);
    return { horizon: idx + 1, count, me, mae, rmse };
  });

  // Scale MASE using initial training window benchmark
  const overallMetrics = computeAccuracyMetrics(
    allActual,
    allPred,
    rawValues.slice(0, initialWindow),
    modelConfig.seasonalPeriod || 1,
    allIntervals95.length === allActual.length ? allIntervals95 : null
  );

  return {
    valid: true,
    windowType,
    initialWindow,
    horizon,
    stepSize,
    originCount: origins.length,
    totalEvaluatedForecasts: allActual.length,
    overallMetrics,
    horizonMetrics,
    origins
  };
}


/* ==========================================================================
   SECTION 14: STOCHASTIC TRAJECTORY SIMULATION & WHITE-NOISE INDEPENDENCE LAB
   ========================================================================== */

/**
 * Simulate future stochastic sample paths from the fitted model (Part 16.5)
 * Preserves temporal dependence (random walk accumulation, state-space evolution,
 * or Wold psi-weight innovation convolution) rather than adding i.i.d. noise around point forecasts.
 */
export function simulateModelTrajectories(fitResult, numPaths = 15, seed = 4289104) {
  if (!fitResult || !fitResult.valid) return [];
  const H = fitResult.horizon;
  const sigma = Math.max(EPSILON, fitResult.diagnostics?.sigma || 1.0);
  const prng = createPRNG(seed);
  const paths = [];

  // Obtain Wold psi-weights or state-space shock multipliers so shocks accumulate over time
  const psi = new Array(H).fill(0.0);
  psi[0] = 1.0;
  if (Array.isArray(fitResult.psiWeights) && fitResult.psiWeights.length >= H) {
    for (let j = 0; j < H; j++) psi[j] = fitResult.psiWeights[j];
  } else if (fitResult.modelType === "MEAN" || fitResult.modelType === "TS_REG") {
    // Stationary around mean/trend: future shocks do not accumulate across steps
    for (let j = 1; j < H; j++) psi[j] = 0.0;
  } else if (fitResult.modelType === "SNAIVE") {
    const m = Math.max(1, fitResult.seasonalPeriod || 12);
    for (let j = 1; j < H; j++) psi[j] = (j % m === 0) ? 1.0 : 0.0;
  } else if (fitResult.modelType.startsWith("ETS_")) {
    const alpha = fitResult.parameters?.alpha ?? 0.4;
    const beta = fitResult.parameters?.beta ?? 0.0;
    for (let j = 1; j < H; j++) psi[j] = alpha + j * beta;
  } else {
    // Random walk / Drift default accumulation
    for (let j = 1; j < H; j++) psi[j] = 1.0;
  }

  for (let p = 0; p < numPaths; p++) {
    const shocks = new Array(H);
    for (let h = 0; h < H; h++) shocks[h] = prng.nextGaussian(0, sigma);
    const trajectory = new Array(H);
    for (let h = 0; h < H; h++) {
      let accumShock = 0.0;
      for (let j = 0; j <= h; j++) {
        accumShock += psi[j] * shocks[h - j];
      }
      trajectory[h] = fitResult.pointForecasts[h] + accumShock;
    }
    paths.push(trajectory);
  }
  return paths;
}

/**
 * Interactive White Noise, Serial Correlation & Statistical Independence Simulator (Part 7.7)
 * Distinguishes:
 * - "iid_wn": i.i.d. Gaussian White Noise (uncorrelated AND independent)
 * - "ar1": AR(1) process y_t = phi * y_{t-1} + e_t (serially correlated)
 * - "arch": ARCH(1) process y_t = sigma_t * z_t, sigma_t^2 = 1 + 0.85 * y_{t-1}^2
 *   (Uncorrelated in level E[y_t y_{t-k}] = 0, but NOT statistically independent because volatility clusters!)
 */
export function simulateWhiteNoiseProcess(mode = "iid_wn", n = 100, phi = 0.7, seed = 4289104) {
  const prng = createPRNG(seed);
  const y = new Array(n).fill(0.0);
  for (let t = 0; t < n; t++) {
    const z = prng.nextGaussian(0, 1);
    if (mode === "iid_wn") {
      y[t] = z;
    } else if (mode === "ar1") {
      y[t] = (t > 0 ? phi * y[t - 1] : 0.0) + z;
    } else if (mode === "arch") {
      const prevSq = t > 0 ? y[t - 1] * y[t - 1] : 1.0;
      const sigmaT = Math.sqrt(0.25 + 0.82 * Math.min(25.0, prevSq));
      y[t] = sigmaT * z;
    }
  }
  const ySquared = y.map(v => v * v);
  const acfLevel = computeACF(y, 16);
  const acfSquared = computeACF(ySquared, 16);
  const lbLevel = ljungBoxTest(y, 10, 0);
  const lbSquared = ljungBoxTest(ySquared, 10, 0);

  return {
    mode,
    n,
    phi,
    seed,
    series: y,
    squaredSeries: ySquared,
    acfLevel,
    acfSquared,
    lbLevel,
    lbSquared
  };
}
