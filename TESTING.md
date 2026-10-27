# ForecastLab Automated Testing and Verification Guide

**Document Version:** 1.0.0  

## 1. Automated Test Suites

ForecastLab uses Node.js's built-in test runner (`node --test`) and Python static verification scripts:

1. **`tests/math-engine.test.js` (9 Test Suites)**:
   - Special functions (`logGamma`, `regularizedBeta`, `chiSquarePValue`, `studentTTwoSidedPValue`, `inverseNormalCDF`, `studentTCritical`, `quantileSorted`).
   - Temporal validation (out-of-order sorting, duplicate timestamp removal, implicit gap vs. recorded missing value vs. genuine zero preservation, frequency inference, and training-only linear interpolation).
   - Box–Cox / Log forward and inverse transformations with FPP3 second-order Taylor mean bias adjustment.
   - Sample ACF, Durbin–Levinson PACF ($\hat{\phi}_{11} \equiv \hat{r}_1$), and Ljung–Box $Q^*$ portmanteau tests.
   - Exact additive and multiplicative reconstruction in Classical, STL (LOESS), and MSTL decompositions.
   - Exact baseline formulas (`MEAN`, `NAIVE`, `SNAIVE`, `DRIFT`) and horizon interval scaling.
   - Parameter estimation and horizon intervals across `ETS_ANN`, `ETS_AAN`, `ETS_AAdN`, `ETS_AAA`, `ETS_MAM`, and `ETS_AUTO`.
   - Multiplicative Seasonal $\text{ARIMA}(p,d,q)(P,D,Q)_m$ estimation, differencing inversion, and Wold $\psi$-weight intervals.
   - OLS algebraic invariants ($\sum e_t \equiv 0$) and strict inequality between 95% Prediction Intervals and 95% Confidence Intervals for the Mean Response.
2. **`tests/exporters-storage.test.js` (4 Test Suites)**:
   - CSV formula injection sanitization (`=`, `+`, `-`, `@` string escaping vs. negative float preservation).
   - Delimited text parser (CSV, TSV, `NA` tokens, exogenous predictor extraction).
   - Multi-format exporters (Forecast CSV, Comparison CSV, `DataSenseForecastResult` JSON, VisualGrammar/ResampleLab/QuartetLab handoff JSON, R `fable`, Python `statsmodels`, LaTeX `booktabs`, and technical Markdown report).
   - Lossless URL hash state (`#state=`) and `localStorage` round-tripping.
3. **`tests/acceptance-scenarios.test.js` (All 15 Acceptance Scenarios)**:
   - End-to-end verification of Scenarios 1 through 15 from Part 29 of the specification.
4. **`tests/verify-build.py`**:
   - Verifies all required files, relative asset paths (`./css/...`, `./js/...`), zero external CDN links, zero runtime dependencies, `tabular-nums` CSS enforcement, and zero `TODO`/`FIXME` placeholders.

## 2. Running the Tests

```bash
node --test tests/*.test.js
python3 tests/verify-build.py
python3 scripts/prose_linter.py README.md ARCHITECTURE.md METHODS.md FORECAST_MODELS.md EVALUATION.md
```
