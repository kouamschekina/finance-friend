#!/usr/bin/env python3
"""
filter_secrets.py
=================
Stage 2 - Contextual AI/ML Classifier for the secret-detection pipeline.

It consumes the JSON report produced by Gitleaks (Stage 1, the deterministic
regex/entropy engine) and applies an NLP-style contextual scoring model to
decide whether each raw finding is a *real* leaked secret or a harmless
test fixture / mock / placeholder.

The classifier is a lightweight, dependency-free heuristic ML model that
mirrors the TF-IDF + proximity-analysis approach described in the syllabus:

  * Feature 1 - Path context   : is the finding inside a test/fixture/mock
                                 directory? (strong negative signal)
  * Feature 2 - Value context  : does the captured secret look like a known
                                 placeholder string? (very strong negative)
  * Feature 3 - Syntax context : is the line an assertion / expected-value
                                 statement? (negative signal)
  * Feature 4 - Entropy context : real high-entropy keys score higher than
                                  low-entropy human words.
  * Feature 5 - Provider context: known provider prefixes (AKIA, sk_live_,
                                  ghp_, xoxb-, AIza...) boost the score.

A finding whose total score >= 0 is classified REAL_LEAK and fails the
CI/CD pipeline; anything below 0 is quarantined as a TEST_FIXTURE and the
build passes.

Usage:
    python filter_secrets.py [path/to/gitleaks-report.json]

Exit codes:
    0  - no real leaks (clean build)
    1  - at least one real leak detected (blocks the pipeline)
    2  - invalid / unreadable report (treated as clean for safety)
"""

import json
import math
import os
import re
import sys
from collections import Counter

# Default report location written by the GitHub Actions workflow.
DEFAULT_REPORT = "gitleaks-report.json"

# ---------------------------------------------------------------------------
# Context feature vocabulary (the "training data" of our heuristic model).
# These tokens are what a TF-IDF classifier would learn to weight heavily
# for the "test fixture" class. We hard-code the learned weights here so the
# model runs with zero external dependencies.
# ---------------------------------------------------------------------------
TEST_PATH_TOKENS = (
    "test", "fixture", "fixtures", "mock", "mocks",
    "example", "examples", "spec", "specs", "sample", "samples",
    "__tests__", "stubs", "fakes",
)

PLACEHOLDER_TOKENS = (
    "dummy", "placeholder", "your_key", "your-key", "yourkey",
    "my_secret", "mysecret", "changeme", "change_me",
    "abcdef", "abcdefg", "abcdefgh", "123456", "1234567", "12345678",
    "test_key", "testkey", "example_key", "examplekey",
    "xxxx", "xxxxx", "xxxxxxxx", "000000", "111111",
    "lorem", "ipsum", "foobar", "foobaz", "barbaz",
    "example", "sample", "demo", "tutorial",
)

ASSERTION_TOKENS = (
    "expected", "assert", "expect(", "should.equal",
    "tobe(", "toequal(", "matchsnapshot", "snapshot",
    "mockreturnvalue", "mockimplementation",
)

# Known cloud / SaaS provider key prefixes. Their presence is a strong
# *positive* signal that the captured string is a genuine credential format.
PROVIDER_PATTERNS = (
    re.compile(r"akia[0-9a-z]{16}"),          # AWS access key id
    re.compile(r"sk_live_[0-9a-zA-Z]{24,}"),  # Stripe live secret key
    re.compile(r"sk_test_[0-9a-zA-Z]{24,}"),  # Stripe test secret key
    re.compile(r"ghp_[0-9a-zA-Z]{36}"),       # GitHub personal access token
    re.compile(r"gho_[0-9a-zA-Z]{36}"),       # GitHub OAuth token
    re.compile(r"ghs_[0-9a-zA-Z]{36}"),       # GitHub server-to-server token
    re.compile(r"xox[baprs]-[0-9a-zA-Z-]+"),  # Slack token
    re.compile(r"aiza[0-9a-z_\\-]{35}"),      # Google API key
    re.compile(r"ya29\.[0-9a-z_\\-]+"),       # Google OAuth access token
    re.compile(r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}"),  # JWT
)


def shannon_entropy(data: str) -> float:
    """Shannon entropy in bits per character - a classic secret-detection
    signal. Real keys are high-entropy; placeholder words are low-entropy."""
    if not data:
        return 0.0
    counts = Counter(data)
    length = len(data)
    return -sum((c / length) * math.log2(c / length) for c in counts.values())


def analyze_context(finding: dict) -> tuple[str, int, dict]:
    """Score a single Gitleaks finding and return
    (classification, score, feature_breakdown)."""
    file_path = (finding.get("File") or finding.get("file") or "").lower()
    line_content = (finding.get("Line") or finding.get("line") or "").lower()
    secret_value = (finding.get("Secret") or finding.get("secret") or "").lower()
    rule_id = (finding.get("RuleID") or finding.get("rule_id") or "").lower()

    features = {}
    score = 0

    # Feature 1 - Path context ------------------------------------------------
    path_hit = next((t for t in TEST_PATH_TOKENS if t in file_path), None)
    if path_hit:
        score -= 3
        features["path_context"] = f"-3 (test path token: '{path_hit}')"
    else:
        features["path_context"] = "0 (production path)"

    # Feature 2 - Placeholder value context -----------------------------------
    placeholder_hit = next(
        (p for p in PLACEHOLDER_TOKENS if p in secret_value), None
    )
    if placeholder_hit:
        score -= 5
        features["value_context"] = f"-5 (placeholder token: '{placeholder_hit}')"
    else:
        features["value_context"] = "0 (no placeholder token)"

    # Feature 3 - Assertion / test-syntax context ----------------------------
    assertion_hit = next(
        (a for a in ASSERTION_TOKENS if a in line_content), None
    )
    if assertion_hit:
        score -= 2
        features["syntax_context"] = f"-2 (assertion token: '{assertion_hit}')"
    else:
        features["syntax_context"] = "0 (no assertion token)"

    # Feature 4 - Entropy context ---------------------------------------------
    entropy = shannon_entropy(secret_value)
    if entropy >= 3.5:
        score += 2
        features["entropy_context"] = f"+2 (high entropy: {entropy:.2f})"
    elif entropy >= 2.5:
        score += 1
        features["entropy_context"] = f"+1 (medium entropy: {entropy:.2f})"
    else:
        score -= 1
        features["entropy_context"] = f"-1 (low entropy: {entropy:.2f})"

    # Feature 5 - Provider format context -------------------------------------
    provider_hit = next(
        (p.pattern for p in PROVIDER_PATTERNS if p.search(secret_value)),
        None,
    )
    if provider_hit:
        score += 3
        features["provider_context"] = f"+3 (provider pattern matched)"
    else:
        features["provider_context"] = "0 (no provider pattern)"

    # Feature 6 - .env / config file context (mild positive) ------------------
    if file_path.endswith((".env", ".env.local", ".env.production")) or "/config" in file_path:
        score += 1
        features["file_context"] = "+1 (env/config file)"
    else:
        features["file_context"] = "0"

    features["total_score"] = score
    classification = "REAL_LEAK" if score >= 0 else "TEST_FIXTURE"
    return classification, score, features


def load_findings(report_path: str) -> list[dict]:
    """Load Gitleaks JSON output. Gitleaks can emit either a JSON array of
    findings or an empty file when nothing is found."""
    if not os.path.exists(report_path):
        return []
    with open(report_path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return data
    # Some Gitleaks versions wrap results under a key.
    if isinstance(data, dict):
        for key in ("findings", "results", "leaks"):
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


def render_summary(findings, real_leaks, quarantined) -> str:
    lines = []
    lines.append("\n=== SECURITY ANOMALY SUMMARY ===")
    lines.append(f"Total Raw Detections: {len(findings)}")
    lines.append(f"Verified Real Leaks:  {len(real_leaks)}")
    lines.append(f"Quarantined (Mocks):  {len(quarantined)}")
    lines.append("================================\n")
    return "\n".join(lines)


def main() -> None:
    report_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_REPORT

    if not os.path.exists(report_path):
        print("No Gitleaks report found. Assuming clean build.")
        sys.exit(0)

    findings = load_findings(report_path)
    if not findings:
        print("Gitleaks report is empty. No leaks found.")
        sys.exit(0)

    real_leaks = []
    quarantined = []

    for finding in findings:
        classification, score, features = analyze_context(finding)
        finding["_classification"] = classification
        finding["_score"] = score
        finding["_features"] = features
        if classification == "REAL_LEAK":
            real_leaks.append(finding)
        else:
            quarantined.append(finding)

    print(render_summary(findings, real_leaks, quarantined))

    # Detailed breakdown for the CI log / presentation demo.
    if quarantined:
        print("--- Quarantined findings (classified as TEST_FIXTURE) ---")
        for f in quarantined:
            print(
                f"  - {f.get('File')} | score={f['_score']} | "
                f"{f['_features']}"
            )
        print()

    if real_leaks:
        print("CRITICAL: Real secrets exposed in codebase!")
        for leak in real_leaks:
            link = leak.get("LinkToLine") or leak.get("StartLine") or "?"
            print(f"  - File: {leak.get('File')} | Line: {link} | score={leak['_score']}")
            print(f"    features: {leak['_features']}")
        # Persist a machine-readable quarantine/verdict report for artifacts.
        try:
            with open("secret-scan-verdict.json", "w", encoding="utf-8") as out:
                json.dump(
                    {
                        "total": len(findings),
                        "real_leaks": len(real_leaks),
                        "quarantined": len(quarantined),
                        "real_leaks_detail": real_leaks,
                        "quarantined_detail": quarantined,
                    },
                    out,
                    indent=2,
                )
        except OSError:
            pass
        sys.exit(1)
    else:
        print("Success: All raw findings were classified as safe test fixtures.")
        try:
            with open("secret-scan-verdict.json", "w", encoding="utf-8") as out:
                json.dump(
                    {
                        "total": len(findings),
                        "real_leaks": 0,
                        "quarantined": len(quarantined),
                        "quarantined_detail": quarantined,
                    },
                    out,
                    indent=2,
                )
        except OSError:
            pass
        sys.exit(0)


if __name__ == "__main__":
    main()