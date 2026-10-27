# ForecastLab Privacy and Local-First Data Guarantee

**Document Version:** 1.0.0  

## 1. Zero-Telemetry, 100% Local Execution

ForecastLab processes all uploaded CSV, TSV, and JSON datasets exclusively inside the user's local browser memory:
1. **Zero Outbound Network Calls**: No user data, timestamps, or model configurations are ever transmitted to external servers or cloud APIs.
2. **Zero Third-Party Trackers or CDNs**: All stylesheets, scripts, and mathematical routines are bundled locally in the repository.
3. **Explicit Session Storage**: Browser `localStorage` persistence occurs only when the user clicks **Save Session to Browser Storage** and can be wiped immediately via **Clear Saved Browser Storage**.
4. **URL Hash Privacy**: Shareable links encode state into the `#state=` URL hash fragment, which browsers never send in HTTP request headers to web servers.
