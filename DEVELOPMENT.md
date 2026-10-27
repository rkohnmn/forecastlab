# ForecastLab Maintainer and Developer Guide

**Document Version:** 1.0.0  

## 1. Engineering Rules for Future Maintainers

1. **Preserve Zero Runtime Dependencies**: Do not add npm dependencies to `package.json` or external `<script>` / `<link>` CDNs to `index.html`.
2. **Relative Path Discipline**: Always reference CSS and JS files using `./css/...` and `./js/...` so GitHub Pages subpath hosting works without reconfiguration.
3. **Pure Math Engine**: Keep `js/math-engine.js` free of DOM (`window`, `document`) references so all functions can be unit-tested directly under Node.js (`node --test`).
4. **Add Tests for Every New Model**: Any new forecasting model added to `MODEL_REGISTRY` must include deterministic fixture tests in `tests/math-engine.test.js` and an entry in `COVERAGE_MATRIX.md`.

## 2. Verification Workflow Before Committing

```bash
node --test tests/*.test.js
python3 tests/verify-build.py
python3 scripts/prose_linter.py README.md ARCHITECTURE.md METHODS.md FORECAST_MODELS.md EVALUATION.md
```
