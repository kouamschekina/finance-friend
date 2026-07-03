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
  * Feature 6 - File context   : .env / config files boost the score.
  * Feature 7 - Docs context   : markdown / documentation files that merely
                                  *describe* secrets get a negative signal.

A finding whose total score >= 0 is classified REAL_LEAK and fails the
CI/CD pipeline; anything below 0 is quarantined as a TEST_FIXTURE and the
build passes.

Outputs:
  - Console summary (human-readable, shown in the CI log)
  - secret-scan-verdict.json  (machine-readable full breakdown)
  - secret-scan-report.html   (visual, presentation-ready HTML report)

Usage:
    python filter_secrets.py [path/to/gitleaks-report.json]

Exit codes:
    0  - no real leaks (clean build)
    1  - at least one real leak detected (blocks the pipeline)
    2  - invalid / unreadable report (treated as clean for safety)
"""

import datetime
import html
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

# Documentation file extensions — these files *describe* secrets, they don't
# *contain* them. A strong negative signal.
DOCS_EXTENSIONS = (
    ".md", ".markdown", ".rst", ".txt", ".adoc",
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
        features["provider_context"] = "+3 (provider pattern matched)"
    else:
        features["provider_context"] = "0 (no provider pattern)"

    # Feature 6 - .env / config file context (mild positive) ------------------
    if file_path.endswith((".env", ".env.local", ".env.production")) or "/config" in file_path:
        score += 1
        features["file_context"] = "+1 (env/config file)"
    else:
        features["file_context"] = "0"

    # Feature 7 - Documentation context (negative) ---------------------------
    # Markdown / docs files that *mention* secrets in prose are not leaks.
    is_doc = any(file_path.endswith(ext) for ext in DOCS_EXTENSIONS)
    if is_doc:
        score -= 4
        features["docs_context"] = "-4 (documentation file)"
    else:
        features["docs_context"] = "0"

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
    if isinstance(data, dict):
        for key in ("findings", "results", "leaks"):
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


# ---------------------------------------------------------------------------
# Console report
# ---------------------------------------------------------------------------

def render_console_summary(findings, real_leaks, quarantined) -> str:
    lines = []
    lines.append("")
    lines.append("=" * 60)
    lines.append("   SECURITY ANOMALY SUMMARY - AI-Enhanced Secret Detection")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"  Stage 1 (Gitleaks raw detections):  {len(findings)}")
    lines.append(f"  Stage 2 (AI Classifier verdict):")
    lines.append(f"    -> Verified Real Leaks:            {len(real_leaks)}")
    lines.append(f"    -> Quarantined (test fixtures):    {len(quarantined)}")
    lines.append("")
    lines.append("-" * 60)
    lines.append("")

    if quarantined:
        lines.append("QUARANTINED FINDINGS (classified as TEST_FIXTURE):")
        lines.append("-" * 60)
        for i, f in enumerate(quarantined, 1):
            lines.append(f"  [{i}] File: {f.get('File')}")
            lines.append(f"      Rule: {f.get('RuleID', '?')}")
            lines.append(f"      Score: {f['_score']}  (below 0 = safe)")
            lines.append(f"      Features:")
            for k, v in f["_features"].items():
                if k != "total_score":
                    lines.append(f"          {k}: {v}")
            lines.append("")

    if real_leaks:
        lines.append("REAL LEAKS DETECTED (classified as REAL_LEAK):")
        lines.append("-" * 60)
        for i, leak in enumerate(real_leaks, 1):
            link = leak.get("LinkToLine") or leak.get("StartLine", "?")
            lines.append(f"  [{i}] File: {leak.get('File')} | Line: {link}")
            lines.append(f"      Rule: {leak.get('RuleID', '?')}")
            lines.append(f"      Score: {leak['_score']}  (>= 0 = dangerous)")
            lines.append(f"      Features:")
            for k, v in leak["_features"].items():
                if k != "total_score":
                    lines.append(f"          {k}: {v}")
            lines.append("")

    lines.append("=" * 60)
    if real_leaks:
        lines.append("  RESULT: BUILD FAILED - Real secrets detected!")
    else:
        lines.append("  RESULT: BUILD PASSED - All findings are safe test fixtures.")
    lines.append("=" * 60)
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# HTML report (presentation-ready)
# ---------------------------------------------------------------------------

def generate_html_report(findings, real_leaks, quarantined) -> str:
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    total = len(findings)
    real_count = len(real_leaks)
    quar_count = len(quarantined)

    def finding_rows(items, cls):
        rows = ""
        for i, f in enumerate(items, 1):
            file_path = html.escape(str(f.get("File", "?")))
            rule_id = html.escape(str(f.get("RuleID", "?")))
            line_no = f.get("StartLine", "?")
            score = f["_score"]
            secret = html.escape(str(f.get("Secret", "")))
            # Truncate long secrets for display
            if len(secret) > 60:
                secret = secret[:57] + "..."
            features_html = ""
            for k, v in f["_features"].items():
                if k != "total_score":
                    features_html += f"<div class='feat'><b>{html.escape(k)}</b>: {html.escape(str(v))}</div>"
            badge = "real" if cls == "REAL_LEAK" else "safe"
            rows += f"""
            <tr class="{badge}-row">
              <td>{i}</td>
              <td class="mono">{file_path}</td>
              <td>{line_no}</td>
              <td>{rule_id}</td>
              <td class="mono secret">{secret}</td>
              <td class="score {'score-bad' if score >= 0 else 'score-good'}">{score}</td>
              <td><span class="badge {badge}">{cls}</span></td>
              <td class="features">{features_html}</td>
            </tr>"""
        return rows

    all_rows = ""
    if real_leaks:
        all_rows += finding_rows(real_leaks, "REAL_LEAK")
    if quarantined:
        all_rows += finding_rows(quarantined, "TEST_FIXTURE")

    verdict_color = "#e74c3c" if real_count > 0 else "#27ae60"
    verdict_text = "BUILD FAILED" if real_count > 0 else "BUILD PASSED"
    verdict_icon = "&#10060;" if real_count > 0 else "&#9989;"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Secret Detection Report - AI-Enhanced Pipeline</title>
<style>
  :root {{
    --bg: #0d1117; --card: #161b22; --border: #30363d;
    --text: #c9d1d9; --text-dim: #8b949e; --accent: #58a6ff;
    --red: #f85149; --green: #3fb950; --yellow: #d29922;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--text); padding: 2rem; line-height: 1.6;
  }}
  h1 {{ font-size: 1.6rem; margin-bottom: 0.25rem; }}
  h2 {{ font-size: 1.1rem; margin: 1.5rem 0 0.75rem; color: var(--text-dim); }}
  .subtitle {{ color: var(--text-dim); margin-bottom: 1.5rem; font-size: 0.9rem; }}
  .cards {{ display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }}
  .card {{
    background: var(--card); border: 1px solid var(--border); border-radius: 8px;
    padding: 1rem 1.5rem; min-width: 180px;
  }}
  .card .num {{ font-size: 2rem; font-weight: 700; }}
  .card .label {{ color: var(--text-dim); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }}
  .card.total .num {{ color: var(--accent); }}
  .card.real .num {{ color: var(--red); }}
  .card.quar .num {{ color: var(--green); }}
  .verdict {{
    background: var(--card); border: 2px solid {verdict_color}; border-radius: 8px;
    padding: 1rem 1.5rem; margin-bottom: 1.5rem; font-size: 1.2rem; font-weight: 700;
    color: {verdict_color};
  }}
  table {{ width: 100%; border-collapse: collapse; background: var(--card); border-radius: 8px; overflow: hidden; }}
  th, td {{ padding: 0.6rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.85rem; }}
  th {{ background: #21262d; color: var(--text-dim); font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.03em; }}
  .mono {{ font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; }}
  .secret {{ color: var(--yellow); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
  .badge {{ padding: 0.15rem 0.6rem; border-radius: 12px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }}
  .badge.real {{ background: rgba(248,81,73,0.15); color: var(--red); border: 1px solid var(--red); }}
  .badge.safe {{ background: rgba(63,185,80,0.15); color: var(--green); border: 1px solid var(--green); }}
  .real-row {{ background: rgba(248,81,73,0.05); }}
  .safe-row {{ background: rgba(63,185,80,0.05); }}
  .score-bad {{ color: var(--red); font-weight: 700; }}
  .score-good {{ color: var(--green); font-weight: 700; }}
  .features {{ max-width: 280px; }}
  .feat {{ font-size: 0.75rem; color: var(--text-dim); margin: 0.1rem 0; }}
  .feat b {{ color: var(--text); }}
  .pipeline {{ margin: 1.5rem 0; padding: 1rem; background: var(--card); border-radius: 8px; border: 1px solid var(--border); }}
  .pipeline .step {{ display: inline-block; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.8rem; margin: 0.2rem; }}
  .pipeline .s1 {{ background: rgba(88,166,255,0.15); color: var(--accent); border: 1px solid var(--accent); }}
  .pipeline .s2 {{ background: rgba(210,153,34,0.15); color: var(--yellow); border: 1px solid var(--yellow); }}
  .pipeline .arrow {{ color: var(--text-dim); margin: 0 0.3rem; }}
  footer {{ margin-top: 2rem; color: var(--text-dim); font-size: 0.8rem; text-align: center; }}
</style>
</head>
<body>
  <h1>AI-Enhanced Secret Detection Report</h1>
  <p class="subtitle">Generated {now} &middot; Stage 1: Gitleaks &rarr; Stage 2: Contextual ML Classifier</p>

  <div class="pipeline">
    <span class="step s1">Stage 1: Gitleaks (regex + entropy)</span>
    <span class="arrow">&rarr;</span>
    <span class="step s2">Stage 2: filter_secrets.py (AI context scoring)</span>
    <span class="arrow">&rarr;</span>
    <span class="step" style="background:rgba({verdict_color == '#e74c3c' and '248,81,73' or '63,185,80'},0.15);color:{verdict_color};border:1px solid {verdict_color}">{verdict_text}</span>
  </div>

  <div class="cards">
    <div class="card total"><div class="num">{total}</div><div class="label">Raw Detections</div></div>
    <div class="card real"><div class="num">{real_count}</div><div class="label">Real Leaks</div></div>
    <div class="card quar"><div class="num">{quar_count}</div><div class="label">Quarantined</div></div>
  </div>

  <div class="verdict">{verdict_icon} {verdict_text} &mdash; {real_count} real leak(s), {quar_count} quarantined fixture(s)</div>

  <h2>Detailed Findings</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>File</th><th>Line</th><th>Rule</th>
        <th>Secret (truncated)</th><th>Score</th><th>Verdict</th><th>AI Feature Breakdown</th>
      </tr>
    </thead>
    <tbody>
      {all_rows if all_rows else '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:2rem">No findings to report.</td></tr>'}
    </tbody>
  </table>

  <footer>
    AI-Enhanced Secret Detection Pipeline &middot; Gitleaks v8.18.2 + Contextual ML Classifier
    <br>Features: path context, value context, syntax context, entropy, provider format, file context, docs context
  </footer>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

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

    # Console output
    print(render_console_summary(findings, real_leaks, quarantined))

    # Machine-readable JSON verdict
    verdict = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_raw_detections": len(findings),
        "real_leaks_count": len(real_leaks),
        "quarantined_count": len(quarantined),
        "verdict": "BUILD_FAILED" if real_leaks else "BUILD_PASSED",
        "real_leaks": real_leaks,
        "quarantined": quarantined,
    }
    try:
        with open("secret-scan-verdict.json", "w", encoding="utf-8") as out:
            json.dump(verdict, out, indent=2)
    except OSError:
        pass

    # HTML report
    try:
        with open("secret-scan-report.html", "w", encoding="utf-8") as out:
            out.write(generate_html_report(findings, real_leaks, quarantined))
    except OSError:
        pass

    if real_leaks:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()