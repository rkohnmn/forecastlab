# ForecastLab Forecasting Models Specification

**Document Version:** 1.0.0  

## 1. Baseline Forecasting Models

| Model | Point Forecast $\hat{y}_{T+h|T}$ | Horizon Standard Error $\sigma_h$ | Degrees of Freedom |
|---|---|---|---|
| **Mean (`MEAN`)** | $\bar{y} = \frac{1}{T}\sum_{t=1}^T y_t$ | $s \sqrt{1 + \frac{1}{T}}$ | $T - 1$ (Student-$t$) |
| **Naïve (`NAIVE`)** | $y_T$ | $\hat{\sigma}\sqrt{h}$ | Normal ($z_{\alpha/2}$) |
| **Seasonal Naïve (`SNAIVE`)** | $y_{T+h-m(k+1)}, \; k = \lfloor(h-1)/m\rfloor$ | $\hat{\sigma}_m\sqrt{k + 1}$ | Normal ($z_{\alpha/2}$) |
| **Drift (`DRIFT`)** | $y_T + h\frac{y_T - y_1}{T - 1}$ | $\hat{\sigma}\sqrt{h\left(1 + \frac{h}{T - 1}\right)}$ | Normal ($z_{\alpha/2}$) |

## 2. Exponential Smoothing and ETS State-Space Models

ForecastLab implements five core ETS innovations state-space specifications plus automatic $\text{AIC}_c$ selection (`ETS_AUTO`):

1. **`ETS(A,N,N)` — Simple Exponential Smoothing**:
   - State recursion: $\ell_t = \alpha y_t + (1-\alpha)\ell_{t-1}$
   - Forecast: $\hat{y}_{T+h|T} = \ell_T$, with variance $\sigma_h^2 = \sigma^2[1 + \alpha^2(h-1)]$.
2. **`ETS(A,A,N)` — Holt's Linear Trend**:
   - State recursion: $\ell_t = \alpha y_t + (1-\alpha)(\ell_{t-1} + b_{t-1})$, $b_t = \beta^*(\ell_t - \ell_{t-1}) + (1-\beta^*)b_{t-1}$
   - Forecast: $\hat{y}_{T+h|T} = \ell_T + h b_T$, with variance $\sigma_h^2 = \sigma^2\left[1 + \sum_{j=1}^{h-1}(\alpha + j\beta)^2\right]$ where $\beta = \alpha\beta^*$.
3. **`ETS(A,Ad,N)` — Damped Trend**:
   - Introduces damping parameter $0.80 \le \phi \le 0.98$: $\hat{y}_{T+h|T} = \ell_T + \left(\sum_{j=1}^h \phi^j\right)b_T$.
4. **`ETS(A,A,A)` — Additive Holt–Winters Seasonal**:
   - Includes seasonal states $s_t$ with period $m$ and smoothing parameter $\gamma < 1 - \alpha$.
   - Forecast variance incorporates seasonal state updates at multiples of $m$: $\psi_j = \alpha + j\beta + \gamma \mathbb{I}(j \equiv 0 \pmod m)$.
5. **`ETS(M,A,M)` — Multiplicative Holt–Winters Seasonal**:
   - Requires $y_t > 0$. Fitted by minimizing the exact multiplicative Gaussian negative log-likelihood $T\ln(\text{SSE}_{\text{rel}}/T) + 2\sum \ln|\mu_t|$.
   - Prediction intervals are computed by simulating $B = 800$ future state-space trajectories using the seeded `Mulberry32` PRNG.

## 3. ARIMA and Seasonal ARIMA Engine (`ARIMA(p,d,q)(P,D,Q)_m`)

The multiplicative Seasonal ARIMA model is written:
$$\phi(B)\Phi(B^m)(1 - B)^d(1 - B^m)^D y_t = c + \theta(B)\Theta(B^m)\varepsilon_t$$
- **Lag Polynomial Expansion**: `expandMultiplicativePolynomial` computes the exact product of non-seasonal and seasonal polynomials up to lag $p + Pm$ and $q + Qm$.
- **Estimation**: Minimizes the Conditional Sum of Squares (CSS) via Nelder–Mead simplex optimization subject to an admissibility barrier ($\sum |\phi_i| < 0.985, \sum |\theta_j| < 0.985$).
- **Horizon Uncertainty**: Computes the exact Wold representation $\Psi(B) = (1-B)^{-d}(1-B^m)^{-D}\phi^{-1}(B)\Phi^{-1}(B^m)\theta(B)\Theta(B^m) = \sum_{j=0}^\infty \psi_j B^j$ so that:
  $$\sigma_h = \hat{\sigma}_\varepsilon \sqrt{\sum_{j=0}^{h-1} \psi_j^2}$$

## 4. Time-Series Regression and Dynamic Regression

- **`TS_REG`**: Fits $y_t = \mathbf{x}_t^T\boldsymbol{\beta} + \varepsilon_t$ via Gaussian elimination with partial pivoting ($|\text{pivot}| > 10^{-11}$). Supports linear/quadratic trends, $m-1$ seasonal indicators, Fourier harmonic pairs $\sin(2\pi k t/m), \cos(2\pi k t/m)$, intervention step indicators, and external predictors.
- **`DYN_REG`**: Fits $y_t = \mathbf{x}_t^T\boldsymbol{\beta} + \eta_t$ where $\eta_t$ follows an $\text{ARIMA}(p,0,q)$ disturbance process, combining regression parameter leverage variance $s_e^2 \mathbf{x}_0^T(\mathbf{X}^T\mathbf{X})^{-1}\mathbf{x}_0$ with ARIMA $\psi$-weight innovation variance.
- **Mandatory Ex-Ante Integrity**: Whenever external predictors are included, `fitTSRegressionModel` verifies that future predictor values $\mathbf{x}_{T+1 \dots T+H}$ are supplied; otherwise it halts with `MISSING_FUTURE_PREDICTORS`.
