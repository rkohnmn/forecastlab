# ForecastLab Temporal Evaluation, Backtesting, and Leakage Prevention

**Document Version:** 1.0.0  

## 1. Temporal Ordering Mandate

Time-series observations are causally ordered. Ordinary random $k$-fold cross-validation is strictly prohibited in ForecastLab because training on observations at $t > T_{\text{origin}}$ leaks future level, trend, and seasonal shock information into historical predictions.

## 2. Evaluation Designs

1. **Chronological Holdout (`evaluateChronologicalHoldout`)**:
   - Partitions $y_{1 \dots T}$ at split index $T_{\text{split}}$ into a contiguous training prefix $y_{1 \dots T_{\text{split}}}$ and future test set $y_{T_{\text{split}}+1 \dots T}$.
2. **Expanding-Window Rolling-Origin Cross-Validation (`runRollingOriginBacktest`)**:
   - Anchors the start of the training window at $t = 1$ and advances the forecast origin $T_1, T_2, \dots, T_K$ by `stepSize`. At each origin $T_k$, the model is refitted from scratch on $y_{1 \dots T_k}$ and evaluated over $h = 1 \dots H$.
3. **Sliding-Window Rolling-Origin Cross-Validation**:
   - Maintains a fixed training window width $W = T_{\text{init}}$, training on $y_{T_k - W + 1 \dots T_k}$ at each origin $T_k$ to evaluate adaptation under non-stationary structural drift.

## 3. Point and Distributional Accuracy Metrics

Let $e_{t} = y_{t} - \hat{y}_{t}$ denote the out-of-sample forecast errors on the held-out set of size $H$:

- **Mean Error (Bias)**: $\text{ME} = \frac{1}{H}\sum e_t$
- **Mean Absolute Error**: $\text{MAE} = \frac{1}{H}\sum |e_t|$
- **Root Mean Squared Error**: $\text{RMSE} = \sqrt{\frac{1}{H}\sum e_t^2}$
- **Mean Absolute Scaled Error (MASE)** (Hyndman & Koehler, 2006):
  $$\text{MASE} = \frac{\text{MAE}}{\frac{1}{T_{\text{train}} - m}\sum_{t=m+1}^{T_{\text{train}}} |y_t - y_{t-m}|}$$
  where $m > 1$ for seasonal series and $m = 1$ for non-seasonal series. Notice that the scaling denominator is computed **exclusively from the training set**.
- **Root Mean Squared Scaled Error (RMSSE)**:
  $$\text{RMSSE} = \sqrt{\frac{\text{MSE}}{\frac{1}{T_{\text{train}} - m}\sum_{t=m+1}^{T_{\text{train}}} (y_t - y_{t-m})^2}}$$
- **Percentage Metrics (`MAPE`, `sMAPE`)**: When any held-out observation satisfies $|y_t| < 10^{-8}$, `MAPE` is suppressed (`null`) and an explicit warning is issued explaining zero-denominator instability.
- **Interval Calibration (`coverage95`, `winklerScore95`)**:
  For a $(1-\alpha) = 95\%$ prediction interval $[\ell_t, u_t]$, the Winkler Score is:
  $$W_{\alpha, t} = (u_t - \ell_t) + \frac{2}{\alpha}(\ell_t - y_t)\mathbb{I}(y_t < \ell_t) + \frac{2}{\alpha}(y_t - u_t)\mathbb{I}(y_t > u_t)$$

## 4. Data Leakage Guardrails

ForecastLab enforces five programmatic leakage checks during evaluation:
1. **Training-Only Imputation**: Missing values in $y_{1 \dots T_k}$ are interpolated without reading $y_{t > T_k}$.
2. **Training-Only Transformations**: Box–Cox $\lambda$ and standardization moments $(\bar{y}_{\text{train}}, s_{\text{train}})$ are estimated strictly inside $[1, T_k]$.
3. **Training-Only MASE Denominator**: Scaling benchmarks never touch test observations.
4. **Ex-Ante Exogenous Predictor Guard**: When `evalLeakageGuard` is enabled, regression backtests reject models that rely on unassumed future predictor realizations.
5. **Horizon-Stratified Reporting**: Rolling-origin errors are reported separately for each lead time $h = 1, 2, \dots, H$.
