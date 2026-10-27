# ForecastLab Capability and Knowledge Coverage Matrix

**Document Version:** 1.0.0  

Every forecasting method and concept in Hyndman & Athanasopoulos (*Forecasting: Principles and Practice*, 3rd ed.) is classified below into one of four transparent categories:
- **Full Working Analysis**: End-to-end computational implementation with automated tests and interactive UI controls.
- **Interactive Demonstration**: Working specialized exploration or guided scenario workflow.
- **Complete Reference Coverage**: Detailed mathematical, conceptual, and practical coverage in the Forecasting Atlas (`js/presets.js`), explicitly identified as reference material rather than a simulated model.
- **Not Implemented**: Out-of-scope for browser-only static execution.

| Topic / Method | FPP3 Chapter | Classification | Where Located in ForecastLab |
|---|---|---|---|
| **Temporal Indexing, Frequency Inference & Missingness Audit** | Ch. 1–2 | Full Working Analysis | Workspace 2 (`validateTemporalSeries`) |
| **Time Plots, Seasonal Plots, Subseries Facets & Lag Plots** | Ch. 2 | Full Working Analysis | Workspaces 1 & 3 (`renderer.js`) |
| **Sample ACF, Durbin–Levinson PACF & White Noise Bounds** | Ch. 2 & 9 | Full Working Analysis | Workspace 3 (`computeACF`, `computePACF`) |
| **Box–Cox Transformations, Guerrero's $\lambda$ & Mean Bias Adjustment** | Ch. 3 & 5 | Full Working Analysis | Workspaces 1 & 3 (`estimateBoxCoxLambda`, `backTransformValue`) |
| **Classical Additive & Multiplicative Decomposition** | Ch. 3 | Full Working Analysis | Workspace 3 (`classicalDecomposition`) |
| **STL Decomposition (LOESS Inner/Outer Bisquare Loop)** | Ch. 3 | Full Working Analysis | Workspace 3 (`stlDecomposition`) |
| **Multiple Seasonal Decomposition (MSTL)** | Ch. 12 | Full Working Analysis | Workspace 3 (`mstlDecomposition`) |
| **Time-Series Features ($F_T, F_S, r_1, r_m$, Variance Stability)** | Ch. 4 | Full Working Analysis | Workspaces 1 & 2 (`extractSeriesFeatures`) |
| **Baseline Models (Mean, Naïve, Seasonal Naïve, Drift)** | Ch. 5 | Full Working Analysis | Workspace 1 (`fitBaselineModel`) |
| **Ljung–Box $Q^*$ Portmanteau & 4-Panel Residual Diagnostics** | Ch. 5 | Full Working Analysis | Workspace 1 (`ljungBoxTest`, `renderDiagnosticsCanvas`) |
| **Chronological Holdout & Rolling-Origin Cross-Validation** | Ch. 5 | Full Working Analysis | Workspace 5 (`evaluateChronologicalHoldout`, `runRollingOriginBacktest`) |
| **Accuracy Metrics (ME, MAE, RMSE, MAPE, sMAPE, MASE, RMSSE)** | Ch. 5 | Full Working Analysis | Workspaces 4 & 5 (`computeAccuracyMetrics`) |
| **Distributional Evaluation (Empirical Coverage & Winkler Score)** | Ch. 5 | Full Working Analysis | Workspaces 4 & 5 (`computeAccuracyMetrics`) |
| **Judgmental Adjustments & Conditional Scenario Forecasting** | Ch. 6 | Full Working Analysis | Workspace 6 (`buildScenarioForecast`) |
| **Time-Series Regression (Trend, Seasonal Dummies, Fourier, Intervention)** | Ch. 7 | Full Working Analysis | Workspace 1 (`fitTSRegressionModel`) |
| **Exogenous Predictor Leakage Prevention & Mean CI vs. PI** | Ch. 7 & 10 | Full Working Analysis | Workspaces 1 & 5 (`fitTSRegressionModel`) |
| **Exponential Smoothing & ETS (`ANN`, `AAN`, `AAdN`, `AAA`, `MAM`, `AUTO`)** | Ch. 8 | Full Working Analysis | Workspace 1 (`fitETSModel`, `autoSelectETS`) |
| **Non-Seasonal & Seasonal ARIMA $(p,d,q)(P,D,Q)_m$ & Wold $\psi$-Weights** | Ch. 9 | Full Working Analysis | Workspace 1 (`fitARIMAModel`, `autoSelectARIMA`) |
| **Dynamic Regression & Dynamic Harmonic Regression (ARIMA Errors)** | Ch. 10 & 12 | Full Working Analysis | Workspace 1 (`fitTSRegressionModel` with `DYN_REG`) |
| **Hierarchical & Grouped Reconciliation (Bottom-Up, Top-Down, OLS, WLS)** | Ch. 11 | Full Working Analysis | Workspace 6 (`reconcileHierarchicalForecasts`) |
| **Forecast Combinations (Ensembles)** | Ch. 13 | Full Working Analysis | Workspace 1 (`fitEnsembleModel`) |
| **Positivity Floor Constraints & Structural Break Interventions** | Ch. 13 | Interactive Demonstration | Workspaces 1, 6 & 8 (`GUIDED_INVESTIGATIONS`) |
| **Moving-Block Time-Series Bootstrap** | Ch. 12 | Interactive Demonstration | Workspace 9 (`ResampleLab` Handoff Exporter) |
| **Prophet Piecewise Growth, Neural Autoregression (NNAR) & VAR** | Ch. 12 | Complete Reference Coverage | Workspace 7 (`ATLAS_TOPICS` #17) |
| **Count Time Series (Croston's Method) & Scaled Logit Bounds** | Ch. 13 | Complete Reference Coverage | Workspace 7 (`ATLAS_TOPICS` #18) |
