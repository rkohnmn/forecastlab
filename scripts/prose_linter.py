#!/usr/bin/env python3
"""
DataSense Deterministic Prose Quality Auditor
Penalizes marketing superlatives and AI clichés; verifies technical clarity.
"""

import os
import re
import sys

BANNED_BUZZWORDS = [
    "synergistic",
    "paradigm shift",
    "holistic",
    "undisputed gold standard",
    "unrivaled",
    "flawlessly",
    "100% guaranteed",
    "magic bullet",
]


def audit_file(filepath: str) -> list[str]:
    issues = []
    if not os.path.isfile(filepath):
        return [f"{filepath}: File not found"]
    text = open(filepath, encoding="utf-8").read()
    lower = text.lower()
    for word in BANNED_BUZZWORDS:
        if word in lower:
            issues.append(f"{filepath}: Prohibited marketing buzzword '{word}' detected.")
    if len(text.strip()) < 200:
        issues.append(f"{filepath}: Document is too short (< 200 chars).")
    return issues


def main() -> int:
    targets = sys.argv[1:] or ["README.md"]
    all_issues = []
    for t in targets:
        all_issues.extend(audit_file(t))
    if all_issues:
        for iss in all_issues:
            print("LINT ISSUE:", iss)
        return 1
    print(f"PROSE AUDIT PASSED ({len(targets)} document(s) verified, 0 buzzword violations).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
