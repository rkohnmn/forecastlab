# ForecastLab Educational and Market Research Teardown

**Document Version:** 1.0.0  

## 1. Problem Statement in Time-Series Education

Introductory and intermediate statistics courses frequently struggle to bridge the gap between point-click spreadsheet trendlines (which ignore autocorrelation, seasonal state dynamics, and temporal cross-validation) and command-line R/Python ecosystems (`fable`, `statsmodels`) that impose a steep syntax barrier on beginners.

## 2. Comparative Positioning

| Capability | Spreadsheet Trendlines | Command-Line R / Python | ForecastLab (DataSense Studio) |
|---|---|---|---|
| **Setup Friction** | Low | High (package installation) | Zero (instant static browser load) |
| **STL & State-Space ETS/ARIMA** | Missing or rudimentary | Full | Full client-side mathematical engine |
| **Rolling-Origin Cross-Validation** | Manual & error-prone | Requires custom scripting | Interactive visual backtester |
| **Ex-Ante Data Leakage Guardrails** | None | Manual | Automated programmatic checks |
| **Explanation Levels** | None | Technical docs only | Live Simple / Standard / Technical switcher |
| **Code Interoperability** | None | Native | One-click R (`fable`) & Python (`statsmodels`) export |
