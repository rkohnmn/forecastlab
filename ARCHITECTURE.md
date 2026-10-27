# ForecastLab Software Architecture Specification

**Document Version:** 1.0.0  
**Applies to:** ForecastLab (`v1.0.0`)  

## 1. Architectural Principles

ForecastLab follows the canonical DataSense Studio architecture defined in `APPLICATION_GUIDELINES.md`:
1. **100% Client-Side Static Execution**: All time-series parsing, STL decomposition, Nelder–Mead optimization, ARIMA recursion, Wold $\psi$-weight expansion, and High-DPI Canvas rendering run locally in the browser without backend servers.
2. **Zero External Runtime Dependencies**: No third-party npm runtime libraries or external CDN requests are used. Special mathematical functions, linear algebra solvers, and charting pipelines are implemented in self-contained ES2022 modules.
3. **Strict Layer Separation**: Mathematical algorithms in `js/math-engine.js` have zero DOM dependencies and execute identically under `node --test` and inside browser Web Workers (`js/worker.js`).

## 2. Module Boundaries and Responsibilities

```
forecastlab/
├── index.html                  # Semantic HTML5 shell, 9 workspace panels, ARIA landmarks
├── DESIGN.md                   # Canonical visual & typographic specification
├── package.json                # Zero-dependency manifest & test scripts
├── css/
│   ├── tokens.css              # Archival light (#F6F4EE) & dark instrument (#0D1014) tokens
│   ├── base.css                # Typography, tabular-nums, responsive bento grids
│   ├── components.css          # Instrument header, cards, tables, badges, controls
│   └── print.css               # High-contrast print stylesheet for classroom FRQ worksheets
├── js/
│   ├── math-engine.js          # Pure statistical, decomposition, ETS, ARIMA, regression & CV engine
│   ├── presets.js              # 8 curated time-series datasets, 18 Atlas entries, 18 Guided Lessons
│   ├── renderer.js             # Stateless High-DPI Canvas 2D & sanitized vector SVG plotting engine
│   ├── exporters.js            # RFC 4180 CSV (formula-sanitized), DataSense JSON, R, Python, LaTeX, URL hash
│   ├── storage.js              # Safe try/catch localStorage wrapper & privacy audit
│   ├── worker.js               # Background Web Worker for rolling-origin CV and candidate searches
│   └── app.js                  # Reactive UI state coordinator, pointer drag lifecycle, 40-step Undo/Redo
└── tests/
    ├── math-engine.test.js     # Unit & property-based invariant tests
    ├── exporters-storage.test.js # Serialization, CSV injection & state round-trip tests
    ├── acceptance-scenarios.test.js # Automated verification of all 15 acceptance scenarios
    └── verify-build.py         # Static subpath, zero-CDN, and asset integrity verifier
```

## 3. Unified Model Registry Contract

Every model in `MODEL_REGISTRY` (`MEAN`, `NAIVE`, `SNAIVE`, `DRIFT`, `ETS_ANN`, `ETS_AAN`, `ETS_AAdN`, `ETS_AAA`, `ETS_MAM`, `ETS_AUTO`, `ARIMA`, `ARIMA_AUTO`, `TS_REG`, `DYN_REG`, `ENSEMBLE`) returns a standardized result object containing:
- `valid`: Boolean status flag (with `reason` and `code` on rejection).
- `modelType`, `modelName`, `family`, `trainingSampleSize`, `seasonalPeriod`, `horizon`.
- `parameters` and `informationCriteria` (`aic`, `aicc`, `bic`).
- `fittedValues`, `residuals` (original scale), and `transformedResiduals` (innovation scale).
- `futureTimestamps`, `pointForecasts`, `intervals` (`80` and `95`), and `stdErrors`.
- `diagnostics`: Residual standard error $\hat{\sigma}$, Ljung–Box portmanteau test ($Q^*, df, p\text{-value}$), and univariate residual moments.
- `reproducibility`: Engine version, transformation metadata, bias-adjustment flag, and PRNG seed.

## 4. State Management and Undo/Redo Architecture

`js/app.js` maintains a single deterministic `appState` object:
- Mutating operations (editing observation cells, dragging points vertically on the canvas, adding/deleting rows, switching presets) push a serialized snapshot onto `undoStack` (depth $\le 40$) and clear `redoStack`.
- Switching explanation levels (`Simple`, `Standard`, `Technical`) updates the narrative interpretation layer without mutating numerical model outputs.
- Shareable workspace states encode losslessly into `#state=<base64>` URL fragments.
