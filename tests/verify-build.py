#!/usr/bin/env python3
"""
ForecastLab Static Deployment, Subpath Safety, and Zero-Dependency Build Verifier
Complies with APPLICATION_GUIDELINES.md Section B & Section J.2.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REQUIRED_FILES = [
    "index.html",
    "DESIGN.md",
    "package.json",
    "css/tokens.css",
    "css/base.css",
    "css/components.css",
    "css/print.css",
    "js/app.js",
    "js/math-engine.js",
    "js/renderer.js",
    "js/presets.js",
    "js/exporters.js",
    "js/storage.js",
    "js/worker.js",
    "tests/math-engine.test.js",
    "tests/exporters-storage.test.js",
    "tests/acceptance-scenarios.test.js",
    "README.md",
    "ARCHITECTURE.md",
    "METHODS.md",
    "FORECAST_MODELS.md",
    "EVALUATION.md",
    "DATA_FORMATS.md",
    "NUMERICAL_VALIDATION.md",
    "TESTING.md",
    "COVERAGE_MATRIX.md",
    "DEVELOPMENT.md",
    "docs/ARCHITECTURE.md",
    "docs/RESEARCH.md",
    "docs/PRIVACY.md",
    "docs/LAUNCH_PLAN.md",
]


def main() -> int:
    errors = []

    # 1. Check required files exist and are non-empty
    for rel_path in REQUIRED_FILES:
        abs_path = os.path.join(ROOT, rel_path)
        if not os.path.isfile(abs_path):
            errors.append(f"MISSING_FILE: {rel_path}")
        elif os.path.getsize(abs_path) == 0:
            errors.append(f"EMPTY_FILE: {rel_path}")

    # 2. Verify index.html relative asset paths & zero external CDNs
    index_path = os.path.join(ROOT, "index.html")
    if os.path.isfile(index_path):
        html = open(index_path, encoding="utf-8").read()
        # Fail if any root-absolute href="/..." or src="/..." is present
        root_abs = re.findall(r'(?:href|src)=["\']/[^"\']*["\']', html)
        if root_abs:
            errors.append(f"ROOT_ABSOLUTE_PATH_DETECTED: {root_abs}")

        # Fail if any external HTTP/HTTPS script or stylesheet CDN is loaded
        ext_cdn = re.findall(r'<(?:script|link)[^>]+(?:src|href)=["\']https?://[^"\']+["\']', html)
        if ext_cdn:
            errors.append(f"EXTERNAL_CDN_PROHIBITED: {ext_cdn}")

        # Verify all referenced local assets exist
        local_refs = re.findall(r'(?:href|src)=["\'](\./[^"\']+)["\']', html)
        for ref in local_refs:
            ref_path = os.path.join(ROOT, ref.lstrip("./"))
            if not os.path.isfile(ref_path):
                errors.append(f"BROKEN_RELATIVE_ASSET: {ref}")

    # 3. Verify zero runtime npm dependencies in package.json
    pkg_path = os.path.join(ROOT, "package.json")
    if os.path.isfile(pkg_path):
        pkg_text = open(pkg_path, encoding="utf-8").read()
        if '"dependencies"' in pkg_text:
            errors.append("RUNTIME_DEPENDENCIES_PROHIBITED: package.json must have zero runtime dependencies.")

    # 4. Verify tabular-nums enforcement in CSS
    base_css_path = os.path.join(ROOT, "css/base.css")
    if os.path.isfile(base_css_path):
        css_text = open(base_css_path, encoding="utf-8").read()
        if "tabular-nums" not in css_text:
            errors.append("MISSING_TABULAR_NUMS: css/base.css must enforce font-variant-numeric: tabular-nums.")

    # 5. Scan JS and CSS source files for unresolved TODO / FIXME markers
    for folder in ["js", "css"]:
        folder_path = os.path.join(ROOT, folder)
        if not os.path.isdir(folder_path):
            continue
        for fname in os.listdir(folder_path):
            fpath = os.path.join(folder_path, fname)
            if os.path.isfile(fpath):
                content = open(fpath, encoding="utf-8").read()
                if re.search(r"\b(?:TODO|FIXME)\b", content):
                    errors.append(f"UNRESOLVED_MARKER in {folder}/{fname}")

    if errors:
        print("BUILD VERIFICATION FAILED:")
        for err in errors:
            print("  -", err)
        return 1

    print(f"BUILD VERIFICATION PASSED: All {len(REQUIRED_FILES)} required files, relative paths, zero-CDN rules, and design standards verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
