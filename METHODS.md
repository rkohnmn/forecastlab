# ForecastLab Mathematical Methods and Algorithmic Conventions

**Document Version:** 1.0.0  
**Primary Reference:** Hyndman & Athanasopoulos, *Forecasting: Principles and Practice* (3rd ed.)  

## 1. Special Functions and Statistical Distributions

1. **Seedable PRNG (`createPRNG`)**: Implements the 32-bit `Mulberry32` algorithm paired with the polar Box–Muller transformation for reproducible standard normal variates.
2. **Log-Gamma (`logGamma`)**: Lanczos approximation ($g = 7$, 9 coefficients) with Euler's reflection formula $\Gamma(z)\Gamma(1-z) = \pi / \sin(\pi z)$ for $z < 0.5$, achieving $\approx 15$ significant digits.
3. **Regularized Incomplete Beta (`regularizedBeta`) & Gamma (`regularizedGammaQ`)**: Evaluated via Lentz's continued-fraction algorithm ($3 \times 10^{-14}$ convergence tolerance) to compute exact Student-$t$ and $\chi^2$ $p$-values.
4. **Student-$t$ Critical Values (`studentTCritical`)**: Initialized via the Hill / Cornish–Fisher asymptotic expansion and refined through 6 exact Newton–Raphson iterations against the analytic Student-$t$ density.

## 2. Transformations and Bias Adjustment

For strictly positive observations $y_t > 0$, the Box–Cox transformation is:
$$w_t = \begin{cases} \ln(y_t), & \lambda = 0 \\ \frac{y_t^\lambda - 1}{\lambda}, & \lambda \ne 0 \end{cases}$$

### Guerrero's $\lambda$ Selection (`estimateBoxCoxLambda`)
Partitions the series into seasonal subseries of length $m$, computes each subseries mean $\bar{y}_g$ and standard deviation $s_g$, and selects $\lambda \in [-1, 2]$ minimizing the coefficient of variation of $s_g / \bar{y}_g^{1-\lambda}$.

### Mean vs. Median Back-Transformation (`backTransformValue`)
Simple inverse transformation of $\hat{w}_{T+h|T}$ yields the **median** forecast on the original scale. When **Bias Adjustment** is enabled, ForecastLab applies the second-order Taylor series expansion using the $h$-step transformed forecast variance $\sigma_h^2$:
$$\hat{y}_{T+h|T} = \begin{cases} \exp(\hat{w}_{T+h|T})\left[1 + \frac{\sigma_h^2}{2}\right], & \lambda = 0 \\ (\lambda \hat{w}_{T+h|T} + 1)^{1/\lambda}\left[1 + \frac{\sigma_h^2(1-\lambda)}{2(\lambda \hat{w}_{T+h|T} + 1)^2}\right], & \lambda \ne 0 \end{cases}$$

## 3. Autocorrelation, PACF, and Ljung–Box Diagnostics

- **Sample ACF**: $\hat{r}_k = \hat{\gamma}_k / \hat{\gamma}_0$, where $\hat{\gamma}_k = \frac{1}{T}\sum_{t=k+1}^T (y_t - \bar{y})(y_{t-k} - \bar{y})$.
- **Sample PACF**: Computed via the exact Durbin–Levinson recursive solution to the Yule–Walker equations.
- **Ljung–Box Portmanteau Test**:
  $$Q^* = T(T+2)\sum_{k=1}^{\ell} \frac{\hat{r}_k^2}{T - k} \sim \chi^2(\max(1, \ell - K))$$
  where $K$ is the number of estimated parameters in the fitted model.

## 4. Decomposition Algorithms

1. **Symmetric Moving Averages (`movingAverageSmooth`)**: Odd orders $k$ use symmetric $(k-1)/2$ windows; even orders $m$ (such as $m=4$ or $m=12$) apply a centered $2 \times m$-MA with half-weight endpoints $w_{\pm m/2} = \frac{1}{2m}$.
2. **Classical Decomposition**: Extracts trend $T_t$ via $m$-MA (or $2 \times m$-MA), averages detrended values by season $s = 1 \dots m$, and centers seasonal indices to sum to $0$ (additive) or $m$ (multiplicative).
3. **STL Decomposition (`stlDecomposition`)**: Implements Cleveland et al. (1990) locally weighted regression (LOESS) with tricube distance weights $w(u) = (1 - u^3)^3$. The inner loop performs detrending, cycle-subseries LOESS smoothing with 1-cycle endpoint padding, low-pass filtering ($m\text{-MA} \times m\text{-MA} \times 3\text{-MA} \times \text{LOESS}$), seasonal centering, and trend LOESS smoothing. When `robust = true`, the outer loop updates bisquare weights $\rho_t = (1 - (|R_t| / 6\text{MAD})^2)^2$.
4. **MSTL (`mstlDecomposition`)**: Iteratively extracts multiple seasonal components $S_t^{(1)}, S_t^{(2)}, \dots$ across ordered periods $m_1 < m_2$ before smoothing the final trend component.
