# ForecastLab Numerical Validation and Reference Benchmarks

**Document Version:** 1.0.0  

## 1. Special Function and Distribution Accuracy

| Function | Benchmark Test Input | Exact Reference Value | ForecastLab Tolerance | Verified Status |
|---|---|---|---|---|
| `logGamma(5.0)` | $\ln(\Gamma(5)) = \ln(24)$ | `3.1780538303479458` | $< 1.0 \times 10^{-12}$ | PASS |
| `inverseNormalCDF(0.975)` | $\Phi^{-1}(0.975)$ | `1.959963984540054` | $< 1.0 \times 10^{-7}$ | PASS |
| `studentTCritical95(9)` | $t_{0.975, 9}$ | `2.2621571628` | $< 1.0 \times 10^{-4}$ | PASS |
| `studentTTwoSidedPValue(2.262157, 9)` | $P(|T_9| \ge 2.262157)$ | `0.050000` | $< 1.0 \times 10^{-4}$ | PASS |
| `chiSquarePValue(3.8414588, 1)` | $P(\chi^2_1 \ge 3.8414588)$ | `0.050000` | $< 1.0 \times 10^{-4}$ | PASS |

## 2. Time-Series Decomposition & Model Invariants

1. **Additive Decomposition Reconstruction**: For both Classical Additive and STL (LOESS) decompositions, $T_t + S_t + R_t \equiv y_t$ holds across all interior and endpoint timestamps to within $1.0 \times 10^{-10}$.
2. **Multiplicative Decomposition Reconstruction**: $T_t \times S_t \times R_t \equiv y_t$ holds across all valid timestamps to within $1.0 \times 10^{-10}$.
3. **Durbin–Levinson PACF Identity**: At lag $k = 1$, $\hat{\phi}_{11} \equiv \hat{r}_1$ to within $1.0 \times 10^{-12}$.
4. **OLS Residual Orthogonality**: In `TS_REG` with an intercept, $\sum_{t=1}^T e_t = 0$ holds to within $1.0 \times 10^{-9}$, and the 95% Prediction Interval is strictly wider than the 95% Confidence Interval for the Mean Response at every horizon $h$.
5. **Hierarchical Reconciliation Coherence**: Across `bottom_up`, `top_down`, `ols_reconciliation`, and `wls_structural`, reconciled forecasts satisfy $|\tilde{y}_{\text{Total}, h} - \sum_i \tilde{y}_{i, h}| \le 1.0 \times 10^{-10}$.

## 3. Documented Differences from R (`fable` / `stats`)

- **Optimization Routine**: ForecastLab uses a deterministic client-side Nelder–Mead simplex optimizer on exact ETS recursions and ARIMA Conditional Sum of Squares (CSS) with an admissibility barrier ($\sum |\phi_i| < 0.985$). R's `fable::ARIMA` uses BFGS on the exact Kalman-filter Gaussian likelihood after CSS initialization. Point forecasts and parameter estimates agree closely on moderate-to-long series, with small finite-sample differences at $T < 25$.
