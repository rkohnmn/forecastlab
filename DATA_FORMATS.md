# ForecastLab Data Formats, Schemas, and Interoperability

**Document Version:** 1.0.0  
**Complies with:** `DATA_CONVENTIONS.md` (v1.0.0)  

## 1. Delimited Text (CSV / TSV) Import and Export

- **RFC 4180 Compliance**: All exported CSV files include a standardized header row, CRLF (`\r\n`) record termination, and double-quote escaping for fields containing commas or quotes.
- **Spreadsheet Formula Injection Sanitization**: `escapeCsvCell` in `js/exporters.js` inspects every string field and prefixes any string starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a literal apostrophe (`'`), while preserving valid signed IEEE 754 floating-point numbers.

## 2. Canonical DataSense JSON Schemas (v1.0.0)

ForecastLab imports and exports versioned JSON documents conforming to the DataSense Studio ecosystem contracts:
1. **`DataSenseDataset` (`https://datasense-studio.github.io/schemas/v1/dataset.json`)**: Stores dataset metadata, variable roles (`timestamp`, `response`, `explanatory`), measurement units, and observation records.
2. **`DataSenseForecastResult` (`https://datasense-studio.github.io/schemas/v1/forecast-result.json`)**: Stores fitted model identifier, seasonal period, parameter estimates, in-sample criteria ($\hat{\sigma}, \text{AIC}, \text{AIC}_c$), out-of-sample holdout metrics (`mae`, `rmse`, `mase`, `rmsse`, `coverage95`), and step-by-step point forecasts with 80% and 95% prediction intervals.
3. **Cross-Application Handoffs**:
   - **VisualGrammar**: Exports observed values, STL components ($T_t, S_t, R_t$), and recommended chart taxonomy metadata.
   - **ResampleLab**: Exports innovation residuals paired with **Moving-Block Bootstrap** replicates (`blockLength = floor(sqrt(T))`) to preserve serial dependence.
   - **QuartetLab**: Exports aligned lag-1 bivariate pairs $(y_{t-1}, y_t)$ with an explicit warning that serial correlation violates ordinary OLS i.i.d. assumptions.

## 3. URL Hash State Serialization

Workspace configurations serialize into `#state=<base64-payload>` via `encodeStateToHash` and `decodeStateFromHash`. Numeric values are preserved to 4 decimal places without server transmission.
