/**
 * ForecastLab Curated Datasets, Searchable Forecasting Atlas & 18 Guided Investigations
 *
 * Original instructional content and curated datasets adhering to:
 * - DATA_CONVENTIONS.md (v1.0.0)
 * - STATISTICAL_STANDARDS.md (v1.0.0)
 * - Hyndman & Athanasopoulos, Forecasting: Principles and Practice (3rd ed.)
 */

export const PRESET_DATASETS = {
  airline_passengers: {
    id: "airline_passengers",
    title: "Transatlantic Air Passenger Volume (Monthly, Multiplicative Seasonality)",
    shortTitle: "Air Passengers (Monthly, m=12)",
    description: "Six years (T = 72 months) of monthly commercial passenger volume (thousands). Exhibits strong upward trend and seasonal amplitude that expands proportionally with the series level.",
    frequency: "monthly",
    seasonalPeriod: 12,
    unit: "thousand passengers",
    defaultModel: "ETS_MAM",
    comparisonModels: ["SNAIVE", "ETS_AAA", "ETS_MAM", "ARIMA_AUTO"],
    hasPredictors: false,
    observations: (() => {
      const baseSeason = [0.86, 0.83, 0.96, 0.98, 1.01, 1.16, 1.28, 1.27, 1.09, 0.95, 0.82, 0.93];
      const noise = [
        1.2, -0.8, 0.5, -1.1, 0.9, 1.5, -0.6, 0.4, 1.1, -0.9, 0.3, -0.5,
        -0.7, 1.3, -0.4, 0.8, -1.2, 0.6, 1.4, -0.8, 0.2, 1.0, -0.6, 0.7,
        0.9, -0.5, 1.1, -0.7, 0.4, -1.0, 0.8, 1.2, -0.9, 0.5, -0.3, 1.1,
        -0.8, 0.6, -1.1, 0.9, 1.3, -0.7, 0.5, -0.4, 1.2, -0.8, 0.6, -0.9,
        1.0, -0.7, 0.8, 1.1, -0.6, 0.4, -1.2, 0.9, -0.5, 1.3, -0.8, 0.4,
        -0.6, 1.1, -0.9, 0.7, -0.5, 1.4, 0.8, -1.1, 0.6, -0.4, 0.9, 1.2
      ];
      const obs = [];
      for (let t = 0; t < 72; t++) {
        const year = 2020 + Math.floor(t / 12);
        const month = (t % 12) + 1;
        const trend = 140 + 2.85 * t + 0.012 * t * t;
        const val = Math.round((trend * baseSeason[t % 12] + noise[t] * 2.2) * 10) / 10;
        obs.push({
          obs_id: `air_${t + 1}`,
          timestamp: `${year}-${String(month).padStart(2, "0")}`,
          value: val
        });
      }
      return obs;
    })()
  },

  retail_turnover: {
    id: "retail_turnover",
    title: "Commonwealth Retail Trade Turnover (Quarterly, Additive Seasonality)",
    shortTitle: "Retail Turnover (Quarterly, m=4)",
    description: "Twelve years (T = 48 quarters) of inflation-adjusted retail trade index ($B). Exhibits a steady Q4 holiday peak and gradually moderating secular growth.",
    frequency: "quarterly",
    seasonalPeriod: 4,
    unit: "AUD Billions",
    defaultModel: "ETS_AAA",
    comparisonModels: ["SNAIVE", "DRIFT", "ETS_AAA", "ARIMA_AUTO"],
    hasPredictors: false,
    observations: (() => {
      const qSeason = [-4.2, -1.8, 0.6, 5.4];
      const err = [
        0.4, -0.3, 0.5, -0.2, -0.6, 0.3, 0.2, 0.7, -0.4, 0.5, -0.3, 0.1,
        0.6, -0.5, 0.2, -0.4, 0.3, 0.7, -0.6, 0.2, -0.3, 0.4, 0.5, -0.7,
        0.2, -0.4, 0.6, 0.3, -0.5, 0.1, -0.2, 0.8, -0.6, 0.4, -0.3, 0.5,
        0.3, -0.7, 0.4, -0.2, 0.6, -0.3, 0.5, 0.1, -0.4, 0.7, -0.5, 0.3
      ];
      const obs = [];
      for (let t = 0; t < 48; t++) {
        const year = 2015 + Math.floor(t / 4);
        const q = (t % 4) + 1;
        const trend = 62.0 + 14.0 * (1.0 - Math.exp(-0.045 * t)) + 0.32 * t;
        const val = Math.round((trend + qSeason[t % 4] + err[t]) * 100) / 100;
        obs.push({
          obs_id: `ret_${t + 1}`,
          timestamp: `${year}-Q${q}`,
          value: val
        });
      }
      return obs;
    })()
  },

  energy_temp_demand: {
    id: "energy_temp_demand",
    title: "Regional Grid Peak Electricity Demand & Temperature (Exogenous Predictors)",
    shortTitle: "Electricity & Temp (Exogenous, m=12)",
    description: "Four years (T = 48 months) of peak electricity demand (GWh) paired with monthly Cooling/Heating Degree Index (temp_index) and Industrial Output Index (ind_index). Ideal for Time-Series Regression and Dynamic Regression with ARIMA errors.",
    frequency: "monthly",
    seasonalPeriod: 12,
    unit: "GWh",
    defaultModel: "DYN_REG",
    comparisonModels: ["SNAIVE", "TS_REG", "DYN_REG", "ETS_AAA"],
    hasPredictors: true,
    predictorNames: ["temp_index", "ind_index"],
    predictorUnits: { temp_index: "Degree-Days / 10", ind_index: "Index (2020=100)" },
    observations: (() => {
      const tempCycle = [24.0, 21.5, 14.0, 8.5, 9.0, 18.5, 27.0, 28.5, 19.0, 10.5, 15.0, 22.0];
      const arErr = new Array(48).fill(0.0);
      const rawShocks = [
        1.1, -0.8, 0.6, 1.4, -1.2, 0.5, -0.9, 1.3, 0.4, -1.1, 0.8, -0.5,
        0.7, 1.2, -0.9, -0.6, 1.5, -0.4, 0.9, -1.3, 0.6, 1.0, -0.7, 0.3,
        -1.0, 0.8, 1.1, -0.5, -0.9, 1.2, 0.4, -0.8, 1.3, -0.6, 0.5, -1.1,
        0.9, -0.4, 0.7, 1.2, -1.0, 0.6, -0.8, 0.9, -0.5, 1.1, -0.7, 0.8
      ];
      for (let t = 0; t < 48; t++) {
        arErr[t] = (t > 0 ? 0.58 * arErr[t - 1] : 0.0) + rawShocks[t] * 2.1;
      }
      const obs = [];
      for (let t = 0; t < 48; t++) {
        const year = 2022 + Math.floor(t / 12);
        const month = (t % 12) + 1;
        const tempIdx = Math.round((tempCycle[t % 12] + (t % 3 - 1) * 1.1) * 10) / 10;
        const indIdx = Math.round((100.0 + 0.35 * t + Math.sin(t * 0.4) * 1.8) * 10) / 10;
        const y = Math.round((180.0 + 0.45 * t + 3.4 * tempIdx + 0.85 * indIdx + arErr[t]) * 100) / 100;
        obs.push({
          obs_id: `eng_${t + 1}`,
          timestamp: `${year}-${String(month).padStart(2, "0")}`,
          value: y,
          predictors: { temp_index: tempIdx, ind_index: indIdx }
        });
      }
      return obs;
    })(),
    futurePredictorsBaseline: (() => {
      const tempCycle = [24.0, 21.5, 14.0, 8.5, 9.0, 18.5, 27.0, 28.5, 19.0, 10.5, 15.0, 22.0];
      const fut = [];
      for (let h = 0; h < 24; h++) {
        fut.push({
          temp_index: tempCycle[h % 12],
          ind_index: Math.round((116.8 + 0.35 * (h + 1)) * 10) / 10
        });
      }
      return fut;
    })()
  },

  macro_random_walk: {
    id: "macro_random_walk",
    title: "Industrial Commodity Spot Price Index (Random Walk with Drift)",
    shortTitle: "Commodity Spot Price (Random Walk, m=1)",
    description: "Sixty trading weeks (T = 60) of a stochastic random-walk commodity index with drift. Demonstrates why Naïve and Drift baselines often beat complex seasonal or high-order polynomial models on efficient market prices.",
    frequency: "weekly",
    seasonalPeriod: 1,
    unit: "USD / Metric Ton",
    defaultModel: "DRIFT",
    comparisonModels: ["MEAN", "NAIVE", "DRIFT", "ARIMA_AUTO"],
    hasPredictors: false,
    observations: (() => {
      const shocks = [
        2.1, -1.4, 3.2, -2.5, 1.8, 0.9, -3.1, 2.4, -0.8, 1.7,
        -2.2, 3.5, 1.1, -1.9, 2.8, -0.6, -2.7, 3.1, 0.5, -1.5,
        2.6, -1.8, 1.4, 2.9, -3.3, 1.2, 2.0, -1.1, 0.7, -2.4,
        3.0, -0.9, 1.6, -2.1, 2.5, 1.3, -1.7, 2.2, -0.4, 1.9,
        -2.8, 3.4, -1.2, 0.8, 2.3, -1.6, 1.5, -2.0, 2.7, 0.6,
        -1.3, 2.1, -0.7, 1.8, -2.3, 3.0, -1.0, 1.4, 2.2, -0.5
      ];
      const obs = [];
      let level = 420.0;
      const startMs = Date.UTC(2025, 0, 6);
      for (let t = 0; t < 60; t++) {
        level = Math.round((level + 0.65 + shocks[t]) * 100) / 100;
        const d = new Date(startMs + t * 7 * 86400000);
        obs.push({
          obs_id: `rw_${t + 1}`,
          timestamp: d.toISOString().slice(0, 10),
          value: level
        });
      }
      return obs;
    })()
  },

  structural_break_supply: {
    id: "structural_break_supply",
    title: "Port Container Throughput (Missing Values, Zero Closure & Structural Break)",
    shortTitle: "Port Throughput (Missing & Break, m=12)",
    description: "Four years (T = 48 months) of container throughput (TEU thousands). Contains 2 recorded missing observations (sensor outage), 1 genuine zero observation (port strike closure), and a permanent +45 TEU structural capacity shift at month 31.",
    frequency: "monthly",
    seasonalPeriod: 12,
    unit: "TEU (thousands)",
    defaultModel: "ETS_AAdN",
    comparisonModels: ["NAIVE", "SNAIVE", "ETS_AAdN", "TS_REG"],
    hasPredictors: false,
    interventionIndex: 31,
    observations: (() => {
      const season = [-8, -10, -2, 3, 6, 9, 11, 10, 5, 1, -11, -14];
      const obs = [];
      for (let t = 0; t < 48; t++) {
        const year = 2022 + Math.floor(t / 12);
        const month = (t % 12) + 1;
        const regimeShift = t >= 30 ? 45.0 : 0.0;
        let val = Math.round((210.0 + 0.5 * t + season[t % 12] + regimeShift + ((t * 7) % 5 - 2) * 1.3) * 10) / 10;
        let missingReason = null;
        if (t === 14 || t === 27) {
          val = null;
          missingReason = "missing_recorded_value";
        } else if (t === 21) {
          val = 0.0;
          missingReason = "structural_closure_zero";
        }
        obs.push({
          obs_id: `port_${t + 1}`,
          timestamp: `${year}-${String(month).padStart(2, "0")}`,
          value: val,
          missing_reason: missingReason
        });
      }
      return obs;
    })()
  },

  hourly_grid_load: {
    id: "hourly_grid_load",
    title: "Metropolitan Microgrid Load (Hourly High-Frequency Series)",
    shortTitle: "Microgrid Load (Hourly, m=24)",
    description: "Five days (T = 120 hours) of hourly metropolitan electricity load (MW). Demonstrates strong diurnal 24-hour cycles and multi-harmonic Fourier seasonal patterns.",
    frequency: "hourly",
    seasonalPeriod: 24,
    unit: "MW",
    defaultModel: "ETS_AAA",
    comparisonModels: ["SNAIVE", "ETS_AAA", "TS_REG", "ARIMA_AUTO"],
    hasPredictors: false,
    observations: (() => {
      const obs = [];
      const startMs = Date.UTC(2026, 9, 1, 0, 0, 0);
      for (let t = 0; t < 120; t++) {
        const hour = t % 24;
        const day = Math.floor(t / 24);
        const diurnal = -38 * Math.cos((2 * Math.PI * hour) / 24) - 14 * Math.sin((4 * Math.PI * hour) / 24);
        const dayEffect = day >= 3 ? -12.0 : 4.0;
        const noise = ((t * 13) % 7 - 3) * 1.1;
        const val = Math.round((310.0 + 0.08 * t + diurnal + dayEffect + noise) * 10) / 10;
        const d = new Date(startMs + t * 3600000);
        obs.push({
          obs_id: `hr_${t + 1}`,
          timestamp: `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`,
          value: val
        });
      }
      return obs;
    })()
  },

  short_startup_revenue: {
    id: "short_startup_revenue",
    title: "Early-Stage SaaS Quarterly Bookings (Short Series, T = 6, m = 4)",
    shortTitle: "Short SaaS Bookings (T=6, m=4)",
    description: "Only 6 quarters of historical bookings ($M) for a new enterprise software product. Designed for Acceptance Scenario 8: demonstrates how ForecastLab restricts seasonal ARIMA/ETS when T < 2m and recommends valid low-sample baselines.",
    frequency: "quarterly",
    seasonalPeriod: 4,
    unit: "USD Millions",
    defaultModel: "DRIFT",
    comparisonModels: ["MEAN", "NAIVE", "DRIFT", "SNAIVE"],
    hasPredictors: false,
    observations: [
      { obs_id: "saas_1", timestamp: "2025-Q1", value: 1.42 },
      { obs_id: "saas_2", timestamp: "2025-Q2", value: 1.68 },
      { obs_id: "saas_3", timestamp: "2025-Q3", value: 1.91 },
      { obs_id: "saas_4", timestamp: "2025-Q4", value: 2.35 },
      { obs_id: "saas_5", timestamp: "2026-Q1", value: 2.54 },
      { obs_id: "saas_6", timestamp: "2026-Q2", value: 2.89 }
    ]
  },

  regional_store_hierarchy: {
    id: "regional_store_hierarchy",
    title: "National Apparel Sales Hierarchy (Additive Parent-Child Regions)",
    shortTitle: "Regional Hierarchy (Total = N + S + W)",
    description: "Eight years (T = 32 quarters) of additive regional sales across North, South, and West divisions summing to National Total. Supports Bottom-Up, Top-Down, and Structural WLS Hierarchical Reconciliation.",
    frequency: "quarterly",
    seasonalPeriod: 4,
    unit: "USD Millions",
    defaultModel: "ETS_AAA",
    comparisonModels: ["SNAIVE", "ETS_AAA", "ARIMA_AUTO"],
    hasPredictors: false,
    isHierarchical: true,
    hierarchySpec: {
      totalName: "Total",
      bottomSeriesNames: ["North_Region", "South_Region", "West_Region"]
    },
    observations: (() => {
      const obs = [];
      const series = { North_Region: [], South_Region: [], West_Region: [] };
      const timestamps = [];
      for (let t = 0; t < 32; t++) {
        const year = 2018 + Math.floor(t / 4);
        const q = (t % 4) + 1;
        const ts = `${year}-Q${q}`;
        timestamps.push(ts);
        const sN = [-3.1, -0.8, 0.9, 3.0][t % 4];
        const sS = [-1.5, 0.4, 1.2, -0.1][t % 4];
        const sW = [-2.2, -0.5, 0.6, 2.1][t % 4];
        const vN = Math.round((45 + 0.55 * t + sN + ((t * 5) % 5 - 2) * 0.4) * 100) / 100;
        const vS = Math.round((32 + 0.35 * t + sS + ((t * 3) % 5 - 2) * 0.3) * 100) / 100;
        const vW = Math.round((38 + 0.72 * t + sW + ((t * 7) % 5 - 2) * 0.5) * 100) / 100;
        series.North_Region.push(vN);
        series.South_Region.push(vS);
        series.West_Region.push(vW);
        obs.push({
          obs_id: `hier_${t + 1}`,
          timestamp: ts,
          value: Math.round((vN + vS + vW) * 100) / 100,
          North_Region: vN,
          South_Region: vS,
          West_Region: vW
        });
      }
      return obs;
    })()
  }
};

/* ==========================================================================
   PART 21: COMPREHENSIVE FORECASTING ATLAS (FPP3 CHAPTERS 1-13 + ADVANCED)
   ========================================================================== */

export const ATLAS_TOPICS = [
  {
    id: "forecast_fundamentals",
    title: "1. What Is a Statistical Forecast? (Conditional Expectation & Horizon)",
    chapter: "FPP3 Ch. 1 — Getting Started",
    category: "Foundations",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "studio",
    simple: "A forecast is not a single lucky guess about the future—it is the range of plausible future values given everything measured up to today, along with an honest measure of how uncertain we are as we look farther ahead.",
    standard: "A statistical forecast at origin T for horizon h is the conditional probability distribution P(y_{T+h} | I_T) given historical information set I_T. The point forecast is typically the conditional mean E[y_{T+h} | I_T] (which minimizes squared error) or conditional median (which minimizes absolute error).",
    technical: "Let \\mathcal{I}_T = \\{y_1, \\dots, y_T, \\mathbf{x}_1, \\dots, \\mathbf{x}_T\\} denote the \\sigma-algebra of information available at origin T. The optimal L_2 point forecast is \\hat{y}_{T+h|T} = \\mathbb{E}[Y_{T+h} \\mid \\mathcal{I}_T], and the (1-\\alpha) prediction interval [L_h, U_h] satisfies P(L_h \\le Y_{T+h} \\le U_h \\mid \\mathcal{I}_T) = 1 - \\alpha.",
    strengths: ["Separates systematic signal from irreducible future shocks", "Quantifies horizon-dependent risk"],
    limitations: ["Assumes historical structural relationships persist over horizon h"],
    commonErrors: ["Confusing in-sample R² fit with out-of-sample predictive accuracy", "Treating point forecasts as deterministic certainties"]
  },
  {
    id: "temporal_indexing_frequency",
    title: "2. Temporal Indexing, Regular Spacing & Calendar Semantics",
    chapter: "FPP3 Ch. 2 — Time Series Graphics",
    category: "Data Foundations",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "understand",
    simple: "Time-series data isn't just a spreadsheet of numbers—the exact calendar spacing between rows matters. Skipping a month or mixing 28-day and 31-day months changes how seasonal patterns align.",
    standard: "Forecasting models indexed by discrete steps t = 1, ..., T assume uniform temporal spacing. Data validation must distinguish missing values recorded as NA, omitted calendar dates (implicit gaps), genuine zero observations, and structural closures.",
    technical: "Lag operators B^k y_t = y_{t-k} are mathematically well-defined only when t indexes a regular lattice t_k = t_0 + k\\Delta t. For weekly data, 365.25 / 7 \\approx 52.1786, so integer period m=52 introduces phase drift over multi-decade spans unless harmonic Fourier terms are used.",
    strengths: ["Prevents silent lag misalignment", "Identifies implicit missing timestamps"],
    limitations: ["Irregularly spaced high-frequency event logs require aggregation or continuous-time state space models"],
    commonErrors: ["Converting missing values to zero", "Ignoring missing timestamps before computing lag-k ACF"]
  },
  {
    id: "seasonal_subseries_lag_plots",
    title: "3. Seasonal Plots, Subseries Facets & Lag Geometry",
    chapter: "FPP3 Ch. 2 — Time Series Graphics",
    category: "Exploration",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "lab",
    simple: "Seasonal plots stack each year on top of the others so you can immediately see if December is always high or if the pattern is shifting.",
    standard: "Seasonal plots overlap cycles by season index s = 1..m; seasonal subseries plots group all observations for each season (e.g., all Januaries) against their season-specific mean; lag plots graph y_t against y_{t-k} to reveal nonlinear dependence and outliers.",
    technical: "For period m, observation t maps to cycle c_t = \\lfloor (t-1)/m \\rfloor + 1 and season s_t = ((t-1) \\bmod m) + 1. Subseries facets plot \\{y_{c, s}\\}_{c=1}^C around subseries mean \\bar{y}_{\\bullet, s}.",
    strengths: ["Reveals evolving seasonal shape and phase shifts", "Detects outliers specific to one season"],
    limitations: ["Requires known integer seasonal period m"],
    commonErrors: ["Mistaking a multi-year business cycle of variable length for fixed-period seasonality"]
  },
  {
    id: "autocorrelation_pacf_wn",
    title: "4. Autocorrelation (ACF), Partial Autocorrelation (PACF) & White Noise",
    chapter: "FPP3 Ch. 2 & Ch. 9 — Autocorrelation & White Noise",
    category: "Exploration",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "lab",
    simple: "Autocorrelation measures how strongly today's value echoes yesterday's value or the same month last year. White noise means there are no predictable echoes left in the data.",
    standard: "The ACF r_k measures linear correlation between y_t and y_{t-k}. The PACF alpha_k measures correlation between y_t and y_{t-k} after removing the linear effects of intermediate lags 1..k-1. Under i.i.d. white noise, 95% of sample ACF spikes fall within ±1.96/sqrt(T).",
    technical: "Sample autocovariance \\hat{\\gamma}_k = \\frac{1}{T}\\sum_{t=k+1}^T (y_t - \\bar{y})(y_{t-k} - \\bar{y}), \\hat{r}_k = \\hat{\\gamma}_k / \\hat{\\gamma}_0. PACF \\hat{\\phi}_{kk} is solved exactly via Durbin-Levinson recursion on the Yule-Walker Toeplitz system. Note: uncorrelatedness (r_k = 0) does not imply statistical independence (e.g., GARCH processes).",
    strengths: ["Identifies persistence, seasonality (peaks at multiples of m), and ARMA structure"],
    limitations: ["Measures only linear dependence; distorted by unmodeled trend"],
    commonErrors: ["Treating a single spike slightly outside ±1.96/sqrt(T) at lag 17 as proof of seasonality (multiple testing)"]
  },
  {
    id: "boxcox_transformations",
    title: "5. Box–Cox Transformations & Back-Transformation Bias Adjustment",
    chapter: "FPP3 Ch. 3 & Ch. 5.6 — Transformations",
    category: "Transformations",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "lab",
    simple: "When seasonal swings grow wider as the numbers get bigger, taking a logarithm or Box–Cox transform evens out the swings so additive models work properly.",
    standard: "Box-Cox transformations stabilize variance across level changes. Guerrero's method selects lambda to minimize the coefficient of variation across seasonal subseries. When back-transforming to the original scale, simple inverse transformation yields the forecast median; bias adjustment adds a variance correction to recover the forecast mean.",
    technical: "Forward transform: w_t = \\ln(y_t) if \\lambda = 0 else (y_t^\\lambda - 1)/\\lambda for y_t > 0. Second-order Taylor mean back-transformation: \\hat{y}_{T+h|T} = (\\lambda \\hat{w}_h + 1)^{1/\\lambda}\\left[1 + \\frac{\\sigma_h^2(1-\\lambda)}{2(\\lambda \\hat{w}_h + 1)^2}\\right].",
    strengths: ["Stabilizes proportional variance", "Enforces positivity when lambda = 0"],
    limitations: ["Undefined for zero or negative observations unless shifted"],
    commonErrors: ["Forgetting that naive exp(w_hat) is the median, which systematically under-forecasts the mean under skewed log-normal errors"]
  },
  {
    id: "classical_stl_decomposition",
    title: "6. Classical, STL (LOESS) & MSTL Time-Series Decomposition",
    chapter: "FPP3 Ch. 3 — Time Series Decomposition",
    category: "Decomposition",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "lab",
    simple: "Decomposition splits a series into three clear pieces: the long-term direction (Trend-Cycle), the repeating calendar pattern (Seasonal), and the leftover bumps (Remainder).",
    standard: "Additive decomposition writes y_t = T_t + S_t + R_t; multiplicative writes y_t = T_t * S_t * R_t. Unlike classical moving-average decomposition (which loses end-point trend values and assumes fixed seasonality), STL uses locally weighted regression (LOESS) to allow evolving seasonality and optional bisquare robustness against outliers.",
    technical: "STL executes an inner loop (detrending -> cycle-subseries LOESS with span n_s -> low-pass filtering m-MA x m-MA x 3-MA -> deseasonalizing -> trend LOESS with span n_t) and an outer robustness loop updating bisquare weights \\rho_t = (1 - (|R_t| / 6\\text{MAD})^2)^2. MSTL iterates STL across ordered seasonal periods m_1 < m_2 < \\dots.",
    strengths: ["STL handles any seasonal period m, estimates endpoints, and resists outliers when robust=true"],
    limitations: ["STL is natively additive (use Box-Cox lambda=0 for multiplicative decomposition)"],
    commonErrors: ["Labeling a simple moving average subtraction as STL"]
  },
  {
    id: "timeseries_features",
    title: "7. Time-Series Features: Trend & Seasonal Strength (F_T, F_S)",
    chapter: "FPP3 Ch. 4 — Time Series Features",
    category: "Exploration",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "understand",
    simple: "By comparing the size of the leftover noise to the trend and seasonal components, we can summarize Trend Strength and Seasonal Strength on a clean 0 to 1 scale.",
    standard: "Following Hyndman & Athanasopoulos (FPP3 Section 4.3), Trend Strength F_T and Seasonal Strength F_S quantify how much variance is explained by T_t and S_t relative to the remainder R_t.",
    technical: "Given STL decomposition y_t = T_t + S_t + R_t: F_T = \\max\\left(0, 1 - \\frac{\\operatorname{Var}(R_t)}{\\operatorname{Var}(T_t + R_t)}\\right), \\quad F_S = \\max\\left(0, 1 - \\frac{\\operatorname{Var}(R_t)}{\\operatorname{Var}(S_t + R_t)}\\right) \\in [0, 1].",
    strengths: ["Scale-free summary across thousands of series", "Directly informs model selection"],
    limitations: ["Depends on decomposition bandwidths n_s and n_t"],
    commonErrors: ["Inventing arbitrary ad-hoc 'forecastability scores' without variance decomposition grounding"]
  },
  {
    id: "baseline_forecasters",
    title: "8. Baseline Forecasters: Mean, Naïve, Seasonal Naïve & Drift",
    chapter: "FPP3 Ch. 5 — The Forecaster's Toolbox",
    category: "Baseline Models",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "studio",
    simple: "Before trusting a complicated statistical model, always check if simply repeating the last value (Naïve), repeating last year's season (Seasonal Naïve), or drawing a line from start to finish (Drift) is more accurate.",
    standard: "Baseline methods establish the minimum accuracy threshold any complex model must beat out-of-sample. Moreover, Seasonal Naïve and Naïve define the denominator of MASE.",
    technical: "Mean: \\hat{y}_{T+h|T}=\\bar{y}, \\sigma_h = s\\sqrt{1+1/T}. Naïve: \\hat{y}_{T+h|T}=y_T, \\sigma_h = \\hat{\\sigma}\\sqrt{h}. Seasonal Naïve: \\hat{y}_{T+h|T}=y_{T+h-m(k+1)}, \\sigma_h = \\hat{\\sigma}_m\\sqrt{k+1}. Drift: \\hat{y}_{T+h|T}=y_T + h\\frac{y_T-y_1}{T-1}, \\sigma_h = \\hat{\\sigma}\\sqrt{h(1+h/(T-1))}.",
    strengths: ["Zero optimization failure risk", "Exact analytical horizon intervals", "Often optimal for random walks"],
    limitations: ["Cannot combine trend, seasonality, and exogenous predictors simultaneously"],
    commonErrors: ["Drawing fixed-width uncertainty bands instead of sqrt(h) widening fans"]
  },
  {
    id: "exponential_smoothing_ets",
    title: "9. Exponential Smoothing & ETS State-Space Models",
    chapter: "FPP3 Ch. 8 — Exponential Smoothing",
    category: "Exponential Smoothing",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "studio",
    simple: "Exponential smoothing predicts the future using a weighted average of past observations where recent months get the highest weight and older months fade away exponentially.",
    standard: "The ETS(Error, Trend, Seasonal) taxonomy unifies Simple Exponential Smoothing (A,N,N), Holt's Linear Trend (A,A,N), Damped Trend (A,Ad,N), Additive Holt-Winters (A,A,A), and Multiplicative Holt-Winters (M,A,M) inside an innovations state-space framework with likelihood-based AICc selection and analytical or simulated prediction intervals.",
    technical: "State vector \\mathbf{x}_t = [\\ell_t, b_t, s_t, \\dots, s_{t-m+1}]^T evolves via y_t = w(\\mathbf{x}_{t-1}) + r(\\mathbf{x}_{t-1})\\varepsilon_t, \\mathbf{x}_t = f(\\mathbf{x}_{t-1}) + g(\\mathbf{x}_{t-1})\\varepsilon_t with \\varepsilon_t \\sim \\mathcal{N}(0, \\sigma^2). Parameters (\\alpha, \\beta^*, \\gamma, \\phi) satisfy admissibility constraints 0 < \\alpha < 1, 0 \\le \\beta^* < \\alpha, 0 \\le \\gamma < 1-\\alpha, 0.8 \\le \\phi \\le 0.98.",
    strengths: ["Adapts smoothly to evolving level, slope, and seasonality", "Damped trend (A,Ad,N) excels in empirical forecasting competitions"],
    limitations: ["Does not natively include exogenous predictor variables (use Dynamic Regression instead)"],
    commonErrors: ["Using unconstrained smoothing parameters > 1", "Using additive error bands for multiplicative ETS(M,A,M)"]
  },
  {
    id: "arima_seasonal_arima",
    title: "10. Stationarity, Differencing & Seasonal ARIMA(p,d,q)(P,D,Q)_m",
    chapter: "FPP3 Ch. 9 — ARIMA Models",
    category: "ARIMA",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "studio",
    simple: "While exponential smoothing focuses on trend and season states, ARIMA models focus on the autocorrelation patterns left after differencing the series to make it stationary.",
    standard: "ARIMA combines autoregressive (AR) terms on lagged observations, integration (I) via ordinary (d) and seasonal (D) differencing, and moving-average (MA) terms on past forecast innovations. Information criteria (AICc) can only compare ARIMA models that share the exact same differencing orders (d, D).",
    technical: "\\phi(B)\\Phi(B^m)(1-B)^d(1-B^m)^D y_t = c + \\theta(B)\\Theta(B^m)\\varepsilon_t. Expanding the Wold representation \\Psi(B) = \\sum_{j=0}^\\infty \\psi_j B^j yields exact h-step forecast error variance \\sigma_h^2 = \\sigma_\\varepsilon^2 \\sum_{j=0}^{h-1} \\psi_j^2.",
    strengths: ["Captures rich short-memory and seasonal autocorrelation structures"],
    limitations: ["Over-differencing introduces artificial negative MA(1) autocorrelation and inflates forecast variance"],
    commonErrors: ["Confusing Moving-Average (MA) error models with moving-average data smoothing", "Comparing AIC across different differencing orders d"]
  },
  {
    id: "timeseries_dynamic_regression",
    title: "11. Time-Series Regression, Fourier Harmonics & Dynamic Regression",
    chapter: "FPP3 Ch. 7 & Ch. 10 — Time Series & Dynamic Regression",
    category: "Regression",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "studio",
    simple: "When external drivers like temperature, promotions, or calendar holidays affect your series, regression incorporates those predictors—provided you supply or assume their future values.",
    standard: "Ordinary regression fits deterministic trend, seasonal dummies, Fourier terms, and external predictors x_t via OLS. Because time-series residuals are often autocorrelated, Dynamic Regression models the disturbance term eta_t as an ARIMA(p,d,q) process, yielding valid prediction intervals.",
    technical: "y_t = \\mathbf{x}_t^T\\boldsymbol{\\beta} + \\eta_t, \\quad \\phi(B)(1-B)^d \\eta_t = \\theta(B)\\varepsilon_t. Fourier seasonal terms \\sin(2\\pi k t/m), \\cos(2\\pi k t/m) for k=1\\dots K \\le m/2 smoothly handle large or non-integer periods m.",
    strengths: ["Incorporates domain predictors and intervention step/pulse dummies", "Separates Confidence Interval for Mean Response from Prediction Interval"],
    limitations: ["Mandatory integrity rule: Exogenous predictors x_{T+h} must be known or scenario-assumed at forecast time"],
    commonErrors: ["Leaking realized future predictor values during historical backtesting when those values were unknown at the forecast origin"]
  },
  {
    id: "residual_diagnostics_ljungbox",
    title: "12. Residual Diagnostics & Ljung–Box Portmanteau Testing",
    chapter: "FPP3 Ch. 5.4 — Residual Diagnostics",
    category: "Diagnostics",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "studio",
    simple: "Good forecasting residuals should look like pure white noise with an average of zero. If patterns remain in the residuals, the model left predictable signal on the table.",
    standard: "Innovation residuals e_t = y_t - \\hat{y}_{t|t-1} should satisfy two essential properties: (1) uncorrelatedness (checked via Residual ACF and Ljung-Box Q* test) and (2) zero mean (unbiasedness). Constant variance and normality are helpful for analytical prediction intervals, though point forecasts remain valid without normality.",
    technical: "Ljung-Box statistic: Q^* = T(T+2)\\sum_{k=1}^\\ell (T-k)^{-1}\\hat{r}_k^2 \\sim \\chi^2(\\ell - K) under H_0 of white noise, where K is the number of estimated ARMA/smoothing parameters.",
    strengths: ["Detects unmodeled autocorrelation, seasonal spikes, bias, and heteroscedasticity"],
    limitations: ["Passing Ljung-Box does not prove the model is optimal out-of-sample (e.g., overfitted models pass in-sample checks)"],
    commonErrors: ["Failing to subtract fitted parameter count K from Ljung-Box degrees of freedom"]
  },
  {
    id: "temporal_cv_evaluation_metrics",
    title: "13. Rolling-Origin Backtesting, MASE & Data Leakage Prevention",
    chapter: "FPP3 Ch. 5.8–5.10 — Evaluating Forecast Accuracy",
    category: "Evaluation",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "evaluation",
    simple: "You can never judge a forecasting model by how well it memorizes the past. You must hide the most recent observations, fit the model only on earlier data, and test how closely it predicts the hidden future.",
    standard: "Time-series cross-validation advances the forecast origin T_1, T_2, ... chronologically using expanding or sliding training windows. Accuracy is summarized by MAE, RMSE, and Mean Absolute Scaled Error (MASE), while interval calibration is evaluated by empirical coverage and the Winkler Score.",
    technical: "\\text{MASE} = \\frac{\\text{MAE}_{\\text{test}}}{\\frac{1}{T-m}\\sum_{t=m+1}^T |y_t - y_{t-m}|}. Crucial Leakage Rule: The scaling denominator, Box-Cox \\lambda, standardization moments, and missing-data imputations must be computed strictly within each training origin [1, T_k].",
    strengths: ["Eliminates look-ahead bias", "Evaluates accuracy separately at each horizon h = 1..H"],
    limitations: ["Computationally intensive across many origins"],
    commonErrors: ["Using random k-fold cross-validation on time series", "Computing MAPE when y_t contains zeros"]
  },
  {
    id: "prediction_intervals_uncertainty",
    title: "14. Prediction Intervals vs. Confidence Intervals & Winkler Calibration",
    chapter: "FPP3 Ch. 5.5 & 5.9 — Distributional Forecasts",
    category: "Uncertainty",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "evaluation",
    simple: "A Confidence Interval measures uncertainty about the average trend line, while a Prediction Interval is always wider because it also accounts for the unpredictable random bounce of a single future month.",
    standard: "ForecastLab displays nested 80% and 95% prediction intervals. As sample size T grows to infinity, a confidence interval for the mean shrinks to zero width, whereas a prediction interval converges to a positive width determined by innovation variance sigma^2.",
    technical: "For regression at x_0: \\text{CI}_{95}(\\mathbb{E}[Y|x_0]) = \\hat{y}_0 \\pm t_{\\alpha/2, df} s_e \\sqrt{\\mathbf{x}_0^T(\\mathbf{X}^T\\mathbf{X})^{-1}\\mathbf{x}_0}, whereas \\text{PI}_{95}(Y_{\\text{new}}|x_0) = \\hat{y}_0 \\pm t_{\\alpha/2, df} s_e \\sqrt{1 + \\mathbf{x}_0^T(\\mathbf{X}^T\\mathbf{X})^{-1}\\mathbf{x}_0}. Proper interval scoring uses the Winkler Score W_\\alpha = (u - \\ell) + \\frac{2}{\\alpha}(\\ell - y)\\mathbb{I}(y < \\ell) + \\frac{2}{\\alpha}(y - u)\\mathbb{I}(y > u).",
    strengths: ["Prevents false precision", "Rewards both sharpness (narrow width) and calibration (coverage)"],
    limitations: ["Conditional on model specification and structural stability"],
    commonErrors: ["Calling a prediction interval a confidence interval", "Assuming narrow intervals always mean better forecasts"]
  },
  {
    id: "judgmental_scenarios",
    title: "15. Judgmental Adjustments & Conditional Scenario Forecasting",
    chapter: "FPP3 Ch. 6 — Judgmental Forecasts",
    category: "Scenarios",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "scenarios",
    simple: "When you know a major policy change, factory expansion, or price shock is coming that never happened in the historical data, you should explore transparent 'What-If' scenarios and document any manual adjustments.",
    standard: "Scenario forecasting computes conditional predictions under explicitly stated future predictor paths (Baseline, Optimistic, Pessimistic). When domain experts apply manual judgmental adjustments to statistical forecasts, both the unadjusted statistical baseline and the audited override must be preserved.",
    technical: "Statistical conditional expectation \\hat{y}_{T+h|T}(\\mathbf{x}^*_h) = \\mathbb{E}[Y_{T+h} \\mid \\mathcal{I}_T, \\mathbf{X}_{T+h} = \\mathbf{x}^*_h] is distinct from an expert judgmental additive/multiplicative override \\tilde{y}_{T+h} = \\hat{y}_{T+h|T} + \\Delta_h.",
    strengths: ["Maintains audit trail separating algorithmic output from human override"],
    limitations: ["Subjective scenarios do not have calibrated probabilities attached unless a prior distribution is specified"],
    commonErrors: ["Overwriting statistical forecasts with ad-hoc multipliers and presenting them as causal model outputs"]
  },
  {
    id: "hierarchical_reconciliation",
    title: "16. Hierarchical & Grouped Forecast Reconciliation (Bottom-Up, Top-Down, WLS)",
    chapter: "FPP3 Ch. 11 — Forecasting Hierarchical and Grouped Time Series",
    category: "Hierarchical",
    implementationStatus: "Fully Working Analytical Model",
    targetWorkspace: "studio",
    simple: "If you forecast national sales and regional sales separately, the regions usually won't add up to the national total. Reconciliation ensures every level of your organization adds up coherently.",
    standard: "Let S be the summing matrix mapping bottom-level series b_t to all hierarchy levels y_t = S b_t. Base forecasts y_hat_h generated independently across levels are generally incoherent (y_hat_h != S b_hat_h). ForecastLab implements Bottom-Up, Top-Down (historical proportions), and Structural WLS optimal reconciliation.",
    technical: "Coherent reconciled forecasts take the form \\tilde{\\mathbf{y}}_h = \\mathbf{S}(\\mathbf{S}^T\\mathbf{W}_h^{-1}\\mathbf{S})^{-1}\\mathbf{S}^T\\mathbf{W}_h^{-1}\\hat{\\mathbf{y}}_h. Under structural WLS, \\mathbf{W}_h = \\operatorname{diag}(\\mathbf{S}\\mathbf{1}_{n_b}), weighting each aggregate level proportionally to the number of bottom series it sums.",
    strengths: ["Guarantees exact numerical coherence across all parent-child nodes", "Combines signal from both aggregate and disaggregate levels"],
    limitations: ["Rates, prices, and percentages are non-additive and require denominator-weighted aggregation"],
    commonErrors: ["Summing marginal 95% interval endpoints directly without accounting for cross-series correlation"]
  },
  {
    id: "prophet_neural_var_reference",
    title: "17. Advanced Reference: Prophet, Neural Autoregression (NNAR) & VAR",
    chapter: "FPP3 Ch. 12 — Advanced Forecasting Methods",
    category: "Advanced Reference",
    implementationStatus: "Complete Educational Reference",
    targetWorkspace: "atlas",
    simple: "Beyond ETS, ARIMA, and Dynamic Regression, specialized methods like Prophet (piecewise trends with holiday effects), Vector Autoregression (multiple mutually dependent series), and Neural Autoregression exist for specialized settings.",
    standard: "In accordance with ForecastLab's scientific integrity mandate, methods requiring heavy external runtime backends or large training corpora (such as deep architectures or full MCMC Prophet) are documented here as complete mathematical references rather than faked with untrained browser heuristics. Note that Dynamic Harmonic Regression (Fourier + ARIMA errors) IS fully implemented in Forecast Studio and often outperforms Prophet on seasonal benchmarks.",
    technical: "Prophet: y_t = g(t) + s(t) + h(t) + \\varepsilon_t with piecewise linear/logistic growth g(t) and Fourier seasonality s(t). VAR(p): \\mathbf{y}_t = \\mathbf{c} + \\mathbf{A}_1\\mathbf{y}_{t-1} + \\dots + \\mathbf{A}_p\\mathbf{y}_{t-p} + \\boldsymbol{\\varepsilon}_t. NNAR(p,P,k)_m: feed-forward neural network taking lagged inputs (y_{t-1},\\dots,y_{t-p},y_{t-m},\\dots,y_{t-Pm}) through k hidden sigmoid units.",
    strengths: ["VAR models bidirectional feedback across endogenous variables", "NNAR captures nonlinear autoregression"],
    limitations: ["NNAR and deep models require large sample sizes (T >> 100) and Monte Carlo simulation for intervals; often lose to ETS/ARIMA on short macroeconomic/business series"],
    commonErrors: ["Deploying complex neural models without benchmarking against Seasonal Naïve, ETS, and Dynamic Harmonic Regression"]
  },
  {
    id: "practical_forecasting_issues",
    title: "18. Practical Forecasting Issues: Count Data, Bounds, Backcasting & Structural Breaks",
    chapter: "FPP3 Ch. 13 — Some Practical Forecasting Issues",
    category: "Practical Issues",
    implementationStatus: "Working Interactive Demonstration",
    targetWorkspace: "scenarios",
    simple: "Real-world data comes with messy edges: sales can't be negative, capacities have upper limits, and sudden economic shifts can make old history obsolete.",
    standard: "Positivity constraints are best enforced via log/Box-Cox transformations (lambda=0) or explicit post-hoc floor constraints with documented interval adjustments. Structural breaks can be handled via intervention step indicators in Regression or by restricting the training window to post-break observations.",
    technical: "For bounded forecasts a < y_t < b, the scaled logit transform w_t = \\ln\\left(\\frac{y_t - a}{b - y_t}\\right) maps (a,b) \\to (-\\infty, \\infty) with inverse y_t = a + \\frac{(b-a)e^{w_t}}{1 + e^{w_t}}. Backcasting reverses time index t^* = T - t + 1 to impute pre-sample history.",
    strengths: ["Respects physical and domain bounds", "Handles structural regime changes"],
    limitations: ["Clipping point forecasts at zero without reporting the constraint distorts expectation and interval calibration"],
    commonErrors: ["Silently clipping negative forecasts to zero while claiming the statistical model is unchanged"]
  }
];

/* ==========================================================================
   PART 22: 18 GUIDED FORECASTING INVESTIGATIONS (REPRODUCIBLE INTERACTIVE LABS)
   ========================================================================== */

export const GUIDED_INVESTIGATIONS = [
  {
    id: 1,
    title: "1. Why Does a Forecast Become Less Certain Farther into the Future?",
    objective: "Observe how random innovations accumulate across forecast steps h = 1..H, causing prediction intervals to widen with horizon.",
    presetId: "macro_random_walk",
    primaryModel: "NAIVE",
    comparisonModel: "MEAN",
    horizon: 16,
    seed: 101,
    controlHint: "Adjust the Forecast Horizon slider from h=4 to h=24 and inspect the 80% and 95% prediction interval fan widths.",
    question: "Under a Random Walk (Naïve) model with one-step innovation standard deviation σ, how does the width of the 95% prediction interval scale with horizon h?",
    options: [
      "It remains constant at ±1.96σ for all future horizons h.",
      "It grows proportionally to the square root of the horizon: ±1.96σ√h.",
      "It shrinks toward zero as h increases because random errors cancel out."
    ],
    correctIndex: 1,
    feedback: "Correct! In a random walk y_{T+h} = y_T + ε_{T+1} + ... + ε_{T+h}, the variance of h independent shocks is hσ², so the standard error grows as σ√h.",
    simpleExplanation: "Each future step adds a fresh unpredictable bump on top of all previous bumps, so the fan of possible outcomes spreads wider the farther ahead you look.",
    standardExplanation: "For non-stationary unit-root processes, forecast error variance grows linearly with h (σ_h² = hσ²), producing a parabolic √h prediction fan.",
    technicalExplanation: "Because \\psi_j = 1 for all j \\ge 0 in ARIMA(0,1,0), \\operatorname{Var}(y_{T+h} - \\hat{y}_{T+h|T}) = \\sigma^2 \\sum_{j=0}^{h-1} \\psi_j^2 = h\\sigma^2."
  },
  {
    id: 2,
    title: "2. When Does the Naïve Method Outperform a Complicated Model?",
    objective: "Compare out-of-sample accuracy of Naïve/Drift against high-order regression or seasonal models on a stochastic random walk.",
    presetId: "macro_random_walk",
    primaryModel: "DRIFT",
    comparisonModel: "TS_REG",
    horizon: 12,
    seed: 102,
    controlHint: "Compare Drift vs. Polynomial/Seasonal Regression on the Commodity Spot Price dataset in Evaluation Lab.",
    question: "Why does a complex polynomial or seasonal regression model often produce worse out-of-sample RMSE than Naïve/Drift on financial spot prices?",
    options: [
      "Complex models fit spurious historical noise and extrapolate non-existent deterministic curves into the holdout period.",
      "Naïve models always have smaller in-sample training residuals than regression.",
      "Regression cannot compute point forecasts for weekly data."
    ],
    correctIndex: 0,
    feedback: "Exactly right. Fitting deterministic curves to a stochastic random walk mistakes random drift for a repeatable pattern, leading to severe out-of-sample overfitting.",
    simpleExplanation: "When a series wanders randomly like a stock price, trying to memorize complicated curves from the past backfires when predicting the future.",
    standardExplanation: "By the bias-variance trade-off, extra parameters estimated on unit-root noise increase forecast variance without reducing out-of-sample bias.",
    technicalExplanation: "For y_t = y_{t-1} + c + \\varepsilon_t, the conditional expectation is exactly y_T + hc. Any additional estimated parameters \\hat{\\boldsymbol{\\theta}} inflate MSFE by O(p/T)."
  },
  {
    id: 3,
    title: "3. How Do Trend and Seasonality Differ?",
    objective: "Distinguish long-term secular evolution (Trend-Cycle) from fixed-period calendar fluctuations (Seasonality).",
    presetId: "retail_turnover",
    primaryModel: "ETS_AAA",
    comparisonModel: "DRIFT",
    horizon: 8,
    seed: 103,
    controlHint: "Open Time-Series Laboratory -> Decomposition to inspect the separate Trend-Cycle T_t and Seasonal S_t panels.",
    question: "What distinguishes a Seasonal pattern from a general Trend-Cycle in time-series analysis?",
    options: [
      "Seasonality occurs at a fixed, known calendar frequency (such as m=4 quarters or m=12 months), whereas cycles have variable, aperiodic duration.",
      "Trend is always strictly linear, whereas seasonality is always random.",
      "Seasonality only exists in daily data."
    ],
    correctIndex: 0,
    feedback: "Correct. Seasonality is tied to a fixed calendar period m, whereas business cycles fluctuate over irregular multi-year spans and are grouped with Trend into the Trend-Cycle component T_t.",
    simpleExplanation: "Seasonality repeats on the calendar like clockwork (every Q4 holiday season), while trends and economic cycles move slowly without a fixed calendar schedule.",
    standardExplanation: "FPP3 combines trend and aperiodic cycles into T_t and reserves S_t strictly for periodic fluctuations of known frequency m.",
    technicalExplanation: "Seasonal operators (1 - B^m) and seasonal subseries averages operate at fixed period m, whereas low-pass LOESS filters extract low-frequency trend-cycle T_t."
  },
  {
    id: 4,
    title: "4. Why Does Temporal Ordering Matter?",
    objective: "Understand why permuting rows destroys autocorrelation, lag alignment, and differencing.",
    presetId: "airline_passengers",
    primaryModel: "SNAIVE",
    comparisonModel: "MEAN",
    horizon: 12,
    seed: 104,
    controlHint: "Inspect the temporal validation summary in 'Understand Your Series' and the Lag Plot in 'Time-Series Laboratory'.",
    question: "If you randomly shuffle the rows of a monthly time series before analysis, which quantity remains unchanged while all temporal models break?",
    options: [
      "Sample autocorrelation r_1 and first differences Δy_t remain unchanged.",
      "Univariate sample mean ȳ and sample standard deviation s_y remain unchanged, but lag relationships (r_k, Δy_t, seasonality) are completely destroyed.",
      "STL decomposition remains identical."
    ],
    correctIndex: 1,
    feedback: "Spot on. Marginal moments (mean, variance) are permutation-invariant, but temporal operators (B^k, ∇, ACF) depend strictly on the ordered index t.",
    simpleExplanation: "The average passenger count doesn't care what order the months are in, but predicting next month requires knowing which month came before which.",
    standardExplanation: "Cross-sectional summaries ignore row order, whereas time-series dynamics reside in the joint distribution of (y_t, y_{t-k}).",
    technicalExplanation: "For any permutation \\pi \\neq \\text{id}, \\sum_t y_{\\pi(t)} = \\sum_t y_t, but \\sum_t (y_{\\pi(t)} - \\bar{y})(y_{\\pi(t-k)} - \\bar{y}) \\neq \\hat{\\gamma}_k."
  },
  {
    id: 5,
    title: "5. What Does Autocorrelation Reveal?",
    objective: "Read an ACF correlogram to diagnose trend persistence (slow decay) versus seasonality (spikes at multiples of m).",
    presetId: "airline_passengers",
    primaryModel: "ARIMA_AUTO",
    comparisonModel: "ETS_MAM",
    horizon: 12,
    seed: 105,
    controlHint: "View the ACF & PACF plots in Time-Series Laboratory for Air Passengers (m=12).",
    question: "When a monthly time series (m=12) has both a strong upward trend and strong seasonality, what pattern appears in the sample ACF plot?",
    options: [
      "All lags k=1..24 are close to zero inside the dashed Bartlett bands.",
      "Large positive correlations that decay slowly as lag k increases, with prominent scalloped peaks at lags k = 12 and k = 24.",
      "A single negative spike at lag 1 and zero everywhere else."
    ],
    correctIndex: 1,
    feedback: "Correct! Trend causes nearby observations to stay on the same side of the mean (slow positive decay), while seasonality produces recurring peaks at multiples of m=12.",
    simpleExplanation: "A trending seasonal series shows slowly fading bars in the ACF chart with noticeable bumps at lag 12 and lag 24.",
    standardExplanation: "Slow decay in ACF indicates non-stationarity (trend), while local maxima at k = m, 2m, 3m indicate seasonal persistence.",
    technicalExplanation: "For y_t = T_t + S_t + R_t with dominant T_t, \\hat{r}_k \\to 1 as T \\to \\infty for fixed k, modulated by periodic covariance \\operatorname{Cov}(S_t, S_{t-k}) peaking at k \\equiv 0 \\pmod m."
  },
  {
    id: 6,
    title: "6. Why Do We Difference Some Time Series?",
    objective: "Use first differencing (∇y_t) and seasonal differencing (∇_m y_t) to transform a non-stationary series into a stationary series.",
    presetId: "airline_passengers",
    primaryModel: "ARIMA",
    comparisonModel: "NAIVE",
    horizon: 12,
    seed: 106,
    controlHint: "In Time-Series Laboratory, switch the Transformation selector from 'Original' to 'First Difference' and 'Seasonal Difference'.",
    question: "What is the primary mathematical purpose of applying differencing ∇y_t = y_t - y_{t-1} before fitting an ARMA model?",
    options: [
      "To stabilize the mean of the series by removing stochastic trend / level changes so the differenced series is covariance stationary.",
      "To increase the sample size T of the dataset.",
      "To convert negative numbers into positive numbers."
    ],
    correctIndex: 0,
    feedback: "Correct. Differencing removes stochastic trend (unit roots) and seasonal non-stationarity so that ARMA parameters can be validly estimated on a stationary process.",
    simpleExplanation: "Differencing looks at month-to-month changes instead of raw totals, flattening out a rising trend so the series hovers around a steady level.",
    standardExplanation: "Ordinary differencing eliminates unit roots at frequency 0; seasonal differencing eliminates unit roots at seasonal frequencies 2πj/m.",
    technicalExplanation: "Applying (1-B)^d(1-B^m)^D maps an integrated I(d,D)_m process to a weakly stationary ARMA process w_t with constant mean and time-invariant autocovariance \\gamma_w(k)."
  },
  {
    id: 7,
    title: "7. How Does Seasonal Naïve Forecasting Work?",
    objective: "Verify how Seasonal Naïve maps each future horizon h to the corresponding season from the final observed cycle.",
    presetId: "retail_turnover",
    primaryModel: "SNAIVE",
    comparisonModel: "NAIVE",
    horizon: 8,
    seed: 107,
    controlHint: "Compare Seasonal Naïve (SNAIVE) and Naïve (NAIVE) in Forecast Studio on Quarterly Retail Turnover (m=4).",
    question: "For quarterly data (m=4) ending at 2026-Q4, what value does Seasonal Naïve predict for 2027-Q3 (h=3) and 2028-Q3 (h=7)?",
    options: [
      "Both h=3 and h=7 are predicted to equal the observed value from 2026-Q3.",
      "Both are predicted to equal the last observed value from 2026-Q4.",
      "It averages all Q3 values across the entire 12-year history."
    ],
    correctIndex: 0,
    feedback: "Correct! Seasonal Naïve repeats the most recent observation from that exact season: y_{T+h-m(k+1)} where k = floor((h-1)/m).",
    simpleExplanation: "Seasonal Naïve predicts that next summer will look just like last summer, and the summer after that will also equal last summer.",
    standardExplanation: "Multi-cycle horizons h > m wrap back to the final observed seasonal cycle T - m + 1 .. T, while prediction intervals widen by √(k+1) with each completed seasonal cycle k.",
    technicalExplanation: "\\hat{y}_{T+h|T} = y_{T+h-m(\\lfloor(h-1)/m\\rfloor + 1)}, \\quad \\sigma_h = \\hat{\\sigma}_m \\sqrt{\\lfloor(h-1)/m\\rfloor + 1}."
  },
  {
    id: 8,
    title: "8. How Does Exponential Smoothing Respond to Recent Observations?",
    objective: "Explore how the smoothing parameter α ∈ (0, 1) controls memory decay between the Mean model (α→0) and Naïve model (α→1).",
    presetId: "macro_random_walk",
    primaryModel: "ETS_ANN",
    comparisonModel: "NAIVE",
    horizon: 10,
    seed: 108,
    controlHint: "In Forecast Studio, select ETS(A,N,N) and compare small α (0.05) vs. large α (0.95).",
    question: "In Simple Exponential Smoothing, what happens to the level estimate ℓ_T and point forecast as the smoothing parameter α approaches 1.0?",
    options: [
      "The forecast puts nearly 100% weight on the most recent observation y_T, converging to the Naïve forecast.",
      "The forecast puts equal weight on all historical observations, converging to the sample mean.",
      "The forecast grows exponentially toward infinity."
    ],
    correctIndex: 0,
    feedback: "Correct! Since ℓ_t = αy_t + (1-α)ℓ_{t-1}, setting α → 1 makes ℓ_T → y_T (Naïve), while α → 0 freezes the level near initial state ℓ_0.",
    simpleExplanation: "A high alpha means rapid adaptation to the latest news; a tiny alpha means slow, heavy averaging over the distant past.",
    standardExplanation: "Past observations receive geometric weights α(1-α)^j; the effective memory half-life is ln(0.5)/ln(1-α).",
    technicalExplanation: "\\ell_T = \\sum_{j=0}^{T-1} \\alpha(1-\\alpha)^j y_{T-j} + (1-\\alpha)^T \\ell_0 \\xrightarrow{\\alpha \\to 1} y_T."
  },
  {
    id: 9,
    title: "9. Why Do ETS and ARIMA Produce Different Forecasts?",
    objective: "Compare state-space structural extrapolation (ETS) against autocovariance recursion (ARIMA) on the same series.",
    presetId: "retail_turnover",
    primaryModel: "ETS_AAA",
    comparisonModel: "ARIMA_AUTO",
    horizon: 12,
    seed: 109,
    controlHint: "Compare ETS(A,A,A) and Auto-ARIMA in Model Comparison Studio.",
    question: "Although linear additive ETS models and ARIMA models overlap mathematically in some special cases, how do their general modeling philosophies differ?",
    options: [
      "ETS models explicitly decompose state evolution into Error, Trend, and Seasonal components (including nonlinear multiplicative states), whereas ARIMA models describe autocorrelation dynamics in differenced stationary series.",
      "ARIMA can only forecast 1 step ahead, whereas ETS can forecast any horizon.",
      "ETS requires external predictors, whereas ARIMA does not."
    ],
    correctIndex: 0,
    feedback: "Correct. ETS models state-space components directly (including multiplicative error/seasonality), whereas ARIMA operates via lag polynomials on differenced series.",
    simpleExplanation: "ETS tracks evolving level, slope, and season states directly, while ARIMA models how each change correlates with previous changes and errors.",
    standardExplanation: "While ETS(A,N,N) is equivalent to ARIMA(0,1,1), multiplicative ETS models have no exact linear ARIMA counterpart, and higher-order AR(p) cycles have no simple ETS counterpart.",
    technicalExplanation: "Linear ETS state-space innovations models have reduced-form ARIMA representations, but parameter spaces and multiplicative observation equations y_t = w(\\mathbf{x}_{t-1})(1+\\varepsilon_t) diverge."
  },
  {
    id: 10,
    title: "10. What Happens When an ARIMA Model Is Over-Differenced?",
    objective: "Examine how taking unnecessary extra differences (d=2 when d=1 suffices) inflates residual variance and induces negative lag-1 autocorrelation.",
    presetId: "macro_random_walk",
    primaryModel: "ARIMA",
    comparisonModel: "NAIVE",
    horizon: 12,
    seed: 110,
    controlHint: "In Forecast Studio, fit ARIMA(0,1,0) vs. ARIMA(0,2,0) on the Random Walk dataset and inspect Residual ACF and σ.",
    question: "If a series is already stationary after first differencing (w_t = ∇y_t is white noise with variance σ²), what happens if you difference it a second time (∇²y_t = w_t - w_{t-1})?",
    options: [
      "The variance doubles to 2σ² and an artificial negative autocorrelation of r_1 = -0.5 is introduced at lag 1.",
      "The variance drops to zero and the forecast becomes exact.",
      "All autocorrelations remain zero and variance decreases by half."
    ],
    correctIndex: 0,
    feedback: "Exact mathematical hit! If w_t is i.i.d. (0, σ²), then z_t = w_t - w_{t-1} has Var(z_t) = 2σ² and Cov(z_t, z_{t-1}) = -σ², so ρ_1 = -0.5.",
    simpleExplanation: "Differencing a series that is already flat adds extra noise and creates a sawtooth bounce back and forth (negative lag-1 correlation).",
    standardExplanation: "Over-differencing introduces a non-invertible unit MA root (1 - B), increasing innovation variance and widening prediction intervals unnecessarily.",
    technicalExplanation: "For w_t \\sim \\text{WN}(0, \\sigma^2), \\operatorname{Var}(\\nabla w_t) = \\operatorname{Var}(w_t) + \\operatorname{Var}(w_{t-1}) = 2\\sigma^2 and \\rho_1(\\nabla w_t) = \\frac{-\\sigma^2}{2\\sigma^2} = -0.5."
  },
  {
    id: 11,
    title: "11. Why Do Future Predictors Need to Be Known or Assumed?",
    objective: "Verify the mandatory ex-ante forecasting requirement for regression models with external predictors x_{T+h}.",
    presetId: "energy_temp_demand",
    primaryModel: "DYN_REG",
    comparisonModel: "ETS_AAA",
    horizon: 12,
    seed: 111,
    controlHint: "Open Scenario Studio or Forecast Studio with the Electricity & Temp dataset and toggle future predictor assumptions.",
    question: "Suppose you fit a regression of monthly electricity demand on observed monthly temperature x_t. Why can't you produce an unconditional ex-ante forecast for next year without supplying or forecasting future temperatures x_{T+h}?",
    options: [
      "Because the regression equation y_{T+h} = β_0 + β_1 x_{T+h} + η_{T+h} directly requires x_{T+h} as an input at future horizon T+h.",
      "Because OLS slopes β_1 become zero in the future.",
      "Because temperature is a categorical variable."
    ],
    correctIndex: 0,
    feedback: "Correct. Unlike deterministic calendar predictors (trend t, Fourier terms, month dummies) which are known forever in advance, stochastic external predictors x_{T+h} must be forecast or scenario-assumed.",
    simpleExplanation: "A formula that calculates electricity demand from tomorrow's weather can't give you a number until you plug in a weather forecast or scenario for tomorrow.",
    standardExplanation: "FPP3 distinguishes ex-ante forecasts (using only information genuinely available at origin T, requiring forecast/scenario predictors) from ex-post forecasts (using realized future predictors).",
    technicalExplanation: "\\mathbb{E}[Y_{T+h} \\mid \\mathcal{I}_T] = \\mathbf{x}_{T+h|T}^T \\boldsymbol{\\beta} + \\hat{\\eta}_{T+h|T}; omitting predictor uncertainty in \\mathbf{x}_{T+h} yields conditional rather than unconditional prediction intervals."
  },
  {
    id: 12,
    title: "12. Why Does Ordinary Random Cross-Validation Leak Information?",
    objective: "Demonstrate why random row splitting violates temporal causality by using future observations to predict the past.",
    presetId: "airline_passengers",
    primaryModel: "ETS_MAM",
    comparisonModel: "SNAIVE",
    horizon: 12,
    seed: 112,
    controlHint: "Open Forecast Evaluation Lab to see how Chronological Holdout and Rolling-Origin Backtesting strictly separate past training from future testing.",
    question: "Why is standard random k-fold cross-validation invalid for evaluating ordinary time-series forecasting models?",
    options: [
      "It trains the model and estimates transformations using observations from timestamps t > T_origin that occur AFTER the held-out points being predicted, leaking future level, trend, and shock information.",
      "It requires too much memory in JavaScript.",
      "Random numbers cannot be generated deterministically."
    ],
    correctIndex: 0,
    feedback: "Correct! In a serially correlated or trending series, knowing y_{t+1} and y_{t-1} makes interpolating y_t trivial, grossly overstating true future forecasting accuracy.",
    simpleExplanation: "Guessing 2023 passenger numbers when you've already peeked at 2024 and 2025 is interpolation, not forecasting.",
    standardExplanation: "Valid forecast evaluation requires causal conditioning: every parameter, imputation, and Box-Cox lambda used to predict y_{T+h} must be estimated solely from t <= T.",
    technicalExplanation: "Under autocorrelation \\operatorname{Cov}(Y_t, Y_{t+1}) \\neq 0, \\mathbb{E}[(Y_t - \\hat{Y}_t(\\mathcal{I}_{\\text{past}} \\cup \\mathcal{I}_{\\text{future}}))^2] < \\mathbb{E}[(Y_t - \\hat{Y}_t(\\mathcal{I}_{\\text{past}}))^2], inducing downward bias in estimated MSFE."
  },
  {
    id: 13,
    title: "13. How Do Forecast Errors Differ Across Horizons?",
    objective: "Inspect Error-by-Horizon (h = 1..H) curves from Rolling-Origin Cross-Validation.",
    presetId: "airline_passengers",
    primaryModel: "ETS_MAM",
    comparisonModel: "NAIVE",
    horizon: 12,
    seed: 113,
    controlHint: "Run Rolling-Origin Backtesting in Forecast Evaluation Lab and inspect the RMSE-by-Horizon chart.",
    question: "Why must rolling-origin cross-validation report RMSE and MAE separately for each forecast horizon h = 1, 2, ..., H rather than only pooling all errors together?",
    options: [
      "Because forecast difficulty and error variance typically change with lead time h, and one model may excel at 1-step-ahead forecasts (h=1) while another excels at long horizons (h=12).",
      "Because h=1 errors are always zero.",
      "Because MASE cannot be computed for h > 1."
    ],
    correctIndex: 0,
    feedback: "Correct! Horizon-specific evaluation reveals whether a model's advantage holds at your actual operational decision horizon.",
    simpleExplanation: "A model that is great at predicting tomorrow might drift badly when predicting next year—checking error by horizon shows where each model shines.",
    standardExplanation: "Multi-step error distributions depend on horizon h; aggregating across h mixes heterogeneous variance scales σ_1² < σ_2² < ... < σ_H².",
    technicalExplanation: "\\text{RMSE}(h) = \\sqrt{\\frac{1}{K_h}\\sum_{k=1}^{K_h} (y_{T_k+h} - \\hat{y}_{T_k+h|T_k})^2} isolates horizon-h predictive risk."
  },
  {
    id: 14,
    title: "14. Why Does the Lowest Training Error Not Guarantee the Best Forecast?",
    objective: "Contrast in-sample residual standard error against out-of-sample test RMSE and MASE.",
    presetId: "retail_turnover",
    primaryModel: "ETS_AAA",
    comparisonModel: "TS_REG",
    horizon: 8,
    seed: 114,
    controlHint: "Compare in-sample σ vs. out-of-sample Holdout MASE and RMSE in Model Comparison Studio.",
    question: "If you keep adding polynomial trend terms and extra parameters to a time-series model, what happens to in-sample training error versus out-of-sample test error?",
    options: [
      "In-sample training error monotonically decreases (or stays flat), but out-of-sample test error eventually increases due to overfitting.",
      "Both in-sample and out-of-sample errors always decrease together.",
      "In-sample error increases when parameters are added."
    ],
    correctIndex: 0,
    feedback: "Correct! In-sample SSE can always be driven toward zero by adding parameters, which is why AICc and out-of-sample backtesting are essential.",
    simpleExplanation: "Memorizing every wiggle in historical data makes training error look tiny but causes wild misses on new future data.",
    standardExplanation: "Penalized criteria (AICc, BIC) add complexity penalties 2k and k ln(T), while temporal cross-validation directly measures out-of-sample generalization.",
    technicalExplanation: "\\text{AIC}_c = T\\ln(\\text{SSE}/T) + 2k + \\frac{2k(k+1)}{T-k-1} penalizes parameter dimension k to approximate out-of-sample Kullback-Leibler divergence."
  },
  {
    id: 15,
    title: "15. How Can Structural Breaks Undermine Forecasts?",
    objective: "Analyze how a sudden level shift distorts full-history models and how intervention indicators or damped smoothing adapt.",
    presetId: "structural_break_supply",
    primaryModel: "TS_REG",
    comparisonModel: "MEAN",
    horizon: 12,
    seed: 115,
    controlHint: "Load the Port Container Throughput dataset (which has a +45 TEU structural shift at t=31) and compare Mean vs. Regression with Intervention Step.",
    question: "When a permanent structural level shift occurs midway through a time series (e.g., port expansion at t=31), how does an unadjusted long-memory model (like Sample Mean or un-intervened trend regression) fail?",
    options: [
      "It averages pre-break and post-break regimes together, producing systematic bias in post-break residuals and miscalibrated prediction intervals.",
      "It automatically detects and deletes pre-break observations.",
      "Structural breaks only affect seasonal periods, not the series level."
    ],
    correctIndex: 0,
    feedback: "Correct! Ignoring a structural break biases level and slope estimates and inflates residual variance, ruining both point forecasts and interval coverage.",
    simpleExplanation: "Averaging old pre-expansion numbers with new post-expansion numbers produces a forecast that sits awkwardly in the middle of the two eras.",
    standardExplanation: "Remedies include adding an intervention step indicator I(t >= t_break), using higher smoothing weight α in ETS, or training only on post-break data.",
    technicalExplanation: "If y_t = \\mu_1 + \\delta \\mathbb{I}(t \\ge \\tau) + \\varepsilon_t, omitting the step variable biases \\hat{\\mu} by -((\\tau-1)/T)\\delta in the post-break regime."
  },
  {
    id: 16,
    title: "16. Why Do Forecast Intervals Sometimes Fail to Contain Future Observations?",
    objective: "Examine empirical interval coverage and the four sources of uncertainty omitted by standard textbook intervals.",
    presetId: "structural_break_supply",
    primaryModel: "NAIVE",
    comparisonModel: "ETS_AAdN",
    horizon: 12,
    seed: 116,
    controlHint: "Inspect the Empirical Coverage % and Winkler Score in Forecast Evaluation Lab.",
    question: "Why do nominal 95% prediction intervals in practice often cover fewer than 95% of realized future observations?",
    options: [
      "Standard prediction intervals account for future random shocks (and sometimes parameter estimation error), but typically condition on the chosen model being true and ignore structural breaks, model-selection uncertainty, and heavy-tailed shocks.",
      "Because 1.96 is an incorrect normal quantile.",
      "Because prediction intervals are always narrower than confidence intervals."
    ],
    correctIndex: 0,
    feedback: "Correct! Model misspecification, structural regime changes, and ignored model-selection uncertainty cause empirical intervals to be too narrow in practice.",
    simpleExplanation: "Prediction intervals assume the rules of the game stay the same; when the rules change or the model is wrong, reality jumps outside the shaded fan.",
    standardExplanation: "Evaluating empirical coverage % and Winkler scores on rolling backtests checks whether nominal 80%/95% bands are genuinely calibrated.",
    technicalExplanation: "Nominal intervals evaluate P(Y_{T+h} \\in C_h \\mid \\mathcal{M}, \\hat{\\boldsymbol{\\theta}}), neglecting model space uncertainty P(\\mathcal{M} \\mid \\mathcal{I}_T) and parameter drift \\boldsymbol{\\theta}_{T+h} \\neq \\boldsymbol{\\theta}_T."
  },
  {
    id: 17,
    title: "17. How Do Hierarchical Forecasts Become Inconsistent?",
    objective: "Observe why independent base forecasts of Total and Regions fail to sum coherently, and how reconciliation restores additivity.",
    presetId: "regional_store_hierarchy",
    primaryModel: "ETS_AAA",
    comparisonModel: "SNAIVE",
    horizon: 8,
    seed: 117,
    controlHint: "Select the National Apparel Sales Hierarchy dataset and open the Hierarchical Reconciliation panel in Forecast Studio.",
    question: "If you fit separate ETS or ARIMA models independently to National Total sales and to North, South, and West regional sales, why is Reconciliation required?",
    options: [
      "Because independent nonlinear optimizations across different series levels almost never satisfy ŷ_Total = ŷ_North + ŷ_South + ŷ_West without an explicit reconciliation projection.",
      "Because regional sales are always negative.",
      "Because ETS cannot fit quarterly data."
    ],
    correctIndex: 0,
    feedback: "Correct! Independent base forecasts have non-zero coherence discrepancy; Bottom-Up, Top-Down, or WLS Structural Reconciliation projects them onto the coherent subspace.",
    simpleExplanation: "When different managers forecast their own regions and headquarters forecasts the national total with different models, the numbers won't add up unless reconciled.",
    standardExplanation: "Reconciliation maps incoherent base forecasts y_hat_h onto the coherent manifold y_tilde_h = S G y_hat_h where S is the summing matrix.",
    technicalExplanation: "Projection operator \\mathbf{P} = \\mathbf{S}(\\mathbf{S}^T\\mathbf{W}^{-1}\\mathbf{S})^{-1}\\mathbf{S}^T\\mathbf{W}^{-1} satisfies \\mathbf{P}\\mathbf{S} = \\mathbf{S}, guaranteeing unbiasedness and exact additivity \\|\\tilde{\\mathbf{y}}_h - \\mathbf{S}\\tilde{\\mathbf{b}}_h\\| = 0."
  },
  {
    id: 18,
    title: "18. Why Do Aggregation and Disaggregation Change Forecasting Behavior?",
    objective: "Compare signal-to-noise ratios at the aggregate National Total level versus noisy disaggregate bottom levels.",
    presetId: "regional_store_hierarchy",
    primaryModel: "ETS_AAA",
    comparisonModel: "ARIMA_AUTO",
    horizon: 8,
    seed: 118,
    controlHint: "Compare Bottom-Up vs. Top-Down vs. Structural WLS Reconciliation on the Regional Hierarchy dataset.",
    question: "How does aggregating time series (summing stores into regions, or days into months) affect the signal-to-noise ratio and optimal reconciliation strategy?",
    options: [
      "Aggregation cancels out idiosyncratic noise so macro trends and seasonality appear cleaner at the top level, while disaggregate series preserve local heterogeneity—WLS reconciliation balances information from both.",
      "Bottom-level series always have zero noise.",
      "Top-down disaggregation never loses individual series trends."
    ],
    correctIndex: 0,
    feedback: "Correct! Bottom-Up excels when bottom series have distinct local dynamics and high signal, Top-Down excels when bottom series are extremely noisy, and WLS combines both!",
    simpleExplanation: "Individual store sales are bumpy and noisy, while the national total is much smoother. Optimal reconciliation uses the best of both worlds.",
    standardExplanation: "By the law of large numbers, summing uncorrelated idiosyncratic errors reduces relative coefficient of variation at aggregate levels, while WLS weights levels by their error variance.",
    technicalExplanation: "For bottom series y_{i,t} = \\mu_{i,t} + \\varepsilon_{i,t} with \\operatorname{Var}(\\varepsilon_{i,t}) = \\sigma^2, aggregate CV scales as O(n_b^{-1/2}), motivates weighting matrix \\mathbf{W}_h = \\operatorname{diag}(\\mathbf{S}\\mathbf{1})."
  }
];
