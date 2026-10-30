# ForecastLab — Interactive Time-Series Exploration, Forecasting, and Uncertainty Laboratory

**Tagline:** Understand patterns. Evaluate models. Forecast uncertainty.  
**Version:** 1.0.0  
**Ecosystem:** DataSense Studio (Companion to QuartetLab, VisualGrammar, and ResampleLab)  
**Primary Conceptual Reference:** Rob J Hyndman and George Athanasopoulos, *Forecasting: Principles and Practice* (3rd ed., FPP3)  

## 1. Overview and Philosophy

ForecastLab is a client-side, zero-dependency statistical forecasting workbench designed for students, instructors, analysts, and researchers. A defensible forecast is not merely a line drawn beyond the most recent observation. ForecastLab operationalizes the analytical workflow:

**Import → Validate → Explore → Decompose → Model → Diagnose → Backtest → Compare → Forecast → Interpret → Export**

Every calculation runs locally in modern web browsers using IEEE 754 double-precision arithmetic (`Float64`) with zero external runtime packages, zero CDN calls, and zero server dependencies.

## 2. Core Features and Laboratories

1. **Forecast Studio (Home Workbench)**:
   - Interactive 3-column bento workbench with synchronized High-DPI time-series fan plots and 4-panel innovation residual diagnostics.
   - Supports direct pointer inspection, vertical sensitivity dragging of historical observations with a 40-step Undo/Redo stack (`Ctrl+Z` / `Ctrl+Y`), and time-axis zoom.
   - Three explanation modes (**Simple**, **Standard**, and **Technical**) adjust pedagogical depth without altering underlying calculations.
2. **Understand Your Series (Temporal Data Engine)**:
   - Imports RFC 4180 CSV, TSV, DataSense JSON, or manual table entries.
   - Infers or overrides temporal frequency (`annual`, `quarterly`, `monthly`, `weekly`, `daily`, `hourly`, `subhourly`, `index`).
   - Distinguishes recorded missing values (`NA`/`null`), implicit missing calendar timestamps (gaps), genuine recorded zeros (`0.0`), and structural closures.
   - Extracts FPP3 Chapter 4 features: Trend Strength ($F_T$), Seasonal Strength ($F_S$), lag-1 autocorrelation ($r_1$), seasonal autocorrelation ($r_m$), variance stability ratio, and Guerrero's optimal Box–Cox $\lambda$.
3. **Time-Series Laboratory & Decomposition**:
   - Forward and inverse transformations: Natural Logarithm, Box–Cox power transform ($\lambda$) with second-order Taylor mean bias adjustment, First Differences ($\nabla y_t$), Seasonal Differences ($\nabla_m y_t$), and Growth Rates.
   - Validated decomposition methods: Classical Additive, Classical Multiplicative, genuine LOESS-based **STL Decomposition** (inner detrending/cycle-subseries/low-pass loop + outer bisquare robustness loop), and multi-seasonal **MSTL**.
   - Exploratory graphics: Year-over-Year Seasonal Plots, Faceted Seasonal Subseries Plots, Bivariate Lag Plots ($y_t$ vs $y_{t-k}$), Sample ACF, and Durbin–Levinson Sample PACF with Bartlett $\pm 1.96/\sqrt{T}$ bands.
4. **Forecasting Model Families**:
   - **Baseline Benchmarks**: Sample Mean, Naïve (Random Walk), Seasonal Naïve, and Random Walk with Drift.
   - **Exponential Smoothing & ETS State-Space Models**: `ETS(A,N,N)` (Simple Exponential Smoothing), `ETS(A,A,N)` (Holt's Linear Trend), `ETS(A,Ad,N)` (Damped Trend), `ETS(A,A,A)` (Additive Holt–Winters), `ETS(M,A,M)` (Multiplicative Holt–Winters with seeded state-space Monte Carlo interval simulation), and `ETS_AUTO` ($\text{AIC}_c$ state-space selection).
   - **ARIMA & Seasonal ARIMA**: Configurable $\text{ARIMA}(p,d,q)(P,D,Q)_m$ with multiplicative lag-polynomial expansion, Conditional Sum of Squares (CSS) Nelder–Mead optimization with root admissibility barriers, exact Wold $\psi$-weight horizon variance calculation, and guided `ARIMA_AUTO` candidate search.
   - **Time-Series & Dynamic Regression**: Linear/polynomial trends, seasonal dummy indicators, Fourier harmonic terms, intervention step indicators, exogenous predictors ($\mathbf{x}_t$), and Dynamic Regression with $\text{ARIMA}(p,d,q)$ errors (`DYN_REG`). Distinguishes the **95% Confidence Interval for the Mean Response** from the **95% Prediction Interval for Individual Future Observations**.
   - **Forecast Combinations**: Equal-weight ensemble combining diverse model families.
5. **Forecast Evaluation & Rolling-Origin Backtesting Lab**:
   - Chronological Train/Test Holdout splits and Rolling-Origin Cross-Validation (Expanding Window and Fixed-Width Sliding Window).
   - Computes ME (bias), MAE, MSE, RMSE, MAPE (with zero-denominator warnings), sMAPE, training-scaled **MASE** and **RMSSE**, empirical 95% interval coverage, and the **Winkler Score**.
   - Enforces strict ex-ante data leakage prevention across transformations, imputations, scaling denominators, and exogenous predictors.
6. **Scenario Studio & Hierarchical Reconciliation**:
   - Conditional predictor scenarios and audited judgmental adjustments that preserve the original statistical forecast alongside documented human overrides.
   - Additive Hierarchical Reconciliation supporting **Bottom-Up**, **Top-Down** (historical proportions), **OLS**, and **Structural WLS** reconciliation with verified numerical coherence ($|\tilde{y}_{\text{Total}} - \sum \tilde{y}_{\text{Bottom}}| \le 10^{-10}$).
7. **Forecasting Atlas & 18 Guided Investigations**:
   - Searchable 18-topic reference covering all 13 FPP3 chapters plus advanced methods (Prophet, NNAR, VAR, count series, bounded logit transforms).
   - 18 interactive classroom investigations with deterministic seeds, observation questions, and 1-click studio loading.

## 3. Local Setup, Testing, and Deployment

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge) for running the application.
- Node.js (`>= 18.0`) and Python (`>= 3.10`) for running the automated verification suites.

### Commands
```bash
# Run all automated statistical unit tests and 15 acceptance scenarios
npm test
# or directly:
node --test tests/*.test.js

# Run static build, relative path, and zero-CDN verification
npm run verify
# or directly:
python tests/verify-build.py

# Run all test and verification suites together
npm run check

# Run prose quality linter
npm run lint:prose

# Serve locally on port 8000
python -m http.server 8000
```

### GitHub Pages Deployment
ForecastLab uses explicit relative paths (`./css/...`, `./js/...`) so it deploys to any root domain or GitHub Pages repository subpath (`https://<org>.github.io/forecastlab/`) via `.github/workflows/deploy.yml` without build-step transpilation or external runtime dependencies.


## Product quality and browser checks

See [PRODUCT_AUDIT.md](PRODUCT_AUDIT.md) for the responsive-interface changes, import contracts and limits, regression coverage, and remaining work. After installing the development requirements and Chromium, run `npm run test:browser` for actual browser validation.
