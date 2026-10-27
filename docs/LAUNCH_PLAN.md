# ForecastLab Static Deployment and Launch Plan

**Document Version:** 1.0.0  

## 1. GitHub Pages Deployment Checklist

1. Push the repository to GitHub (`main` branch).
2. In repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
3. The included workflow `.github/workflows/deploy.yml` automatically executes:
   - `node --test tests/*.test.js`
   - `python3 tests/verify-build.py`
   - `python3 scripts/prose_linter.py`
   and deploys the static artifact to `https://<organization>.github.io/forecastlab/`.

## 2. Classroom & Curriculum Integration

- Instructors can configure any dataset, transformation, or model in **Forecast Studio**, click **Share State**, and distribute the `#state=` link to students.
- Clicking **Print FRQ** generates a clean, high-contrast printable worksheet suitable for AP Statistics, econometrics, and business forecasting assessments.
