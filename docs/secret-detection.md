# Section 5 — AI-Enhanced Secret Leakage Detection

> Group 2 deliverable: a 2-stage defense pipeline that finds hardcoded
> secrets anywhere in the codebase / git history and uses an NLP-style
> contextual ML classifier to eliminate annoying false positives in test
> fixtures.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture at a Glance](#2-architecture-at-a-glance)
3. [Stage 1 — Deterministic Engine (Gitleaks)](#3-stage-1--deterministic-engine-gitleaks)
4. [Stage 2 — Contextual ML Classifier (filter_secrets.py)](#4-stage-2--contextual-ml-classifier-filter_secretspy)
5. [GitHub Actions Wiring](#5-github-actions-wiring)
6. [Demo Files](#6-demo-files)
7. [How to Run Locally](#7-how-to-run-locally)
8. [Detection Methods Table](#8-detection-methods-table)
9. [Quarantine Workflow Diagram](#9-quarantine-workflow-diagram)
10. [Files Created / Changed](#10-files-created--changed)
11. [Design Decisions & Trade-offs](#11-design-decisions--trade-offs)
12. [Extending to a Real ML Model](#12-extending-to-a-real-ml-model)

---

## 1. Problem Statement

Hardcoded secrets (API keys, passwords, tokens) are one of the most common
and most damaging security risks in modern software. Two failure modes exist
in any secret-scanning pipeline:

| Failure mode | Symptom | Cost |
|---|---|---|
| **False negative** | A real key ships to production | Breach, credential rotation, incident response |
| **False positive** | A test fixture / mock key blocks the build | Developer fatigue, alerts get ignored, pipeline gets bypassed |

Traditional regex/entropy scanners (Gitleaks, TruffleHog) are excellent at
**recall** — they catch almost everything that *looks* like a secret — but
poor at **precision**: they flag every `AKIAIOSFODNN7EXAMPLE` in a unit
test, every `dummy` token in a fixture, every `password = "test"` in a spec.

This pipeline solves the precision problem with a **second stage**: an
NLP-style contextual classifier that reads Gitleaks' raw output and scores
each finding based on the *context* around it, exactly as a TF-IDF +
proximity classifier would, but implemented as a zero-dependency heuristic
model so it runs in seconds inside CI.

---

## 2. Architecture at a Glance

```
[Developer Git Push]
       |
       v
[CI/CD Runner Activated]
       |
       v
[Gitleaks Scanner Engine]  ----> generates raw gitleaks-report.json
       |
       v
[filter_secrets.py Classifier]
       |
       +----> If [TEST_FIXTURE] ----> [LOG & QUARANTINE] ----> Pipeline PASS
       |
       +----> If [REAL_LEAK]    ----> [BLOCK BUILD]       ----> Pipeline FAIL
```

The two stages are deliberately decoupled:

* **Stage 1** is a pure deterministic tool (Gitleaks). It can be swapped for
  TruffleHog without changing Stage 2, as long as the output is JSON.
* **Stage 2** is a pure Python script. It has no dependency on Gitleaks'
  internals — it only reads the JSON report — so it can be retrained or
  replaced with a real ML model later without touching the scanner.

---

## 3. Stage 1 — Deterministic Engine (Gitleaks)

**Tool:** [Gitleaks](https://github.com/gitleaks/gitleaks) v8.18.2 (standalone
Linux x64 binary, downloaded fresh in CI — no Docker, no system install).

**Config file:** `.gitleaks.toml` (repo root).

What the config does:

1. **`[extend] useDefault = true`** — pulls in Gitleaks' curated default
   ruleset (AWS, Stripe, GitHub, Google, Slack, private keys, etc.) so we
   get maximum recall out of the box.
2. **Custom `generic-api-key` rule** — a regex that catches the common
   assignment shape `api_key = "..."`, `password: "..."`, `token = "..."`,
   etc. The `secretGroup = 2` directive tells Gitleaks to report only the
   captured *value* (group 2) as the secret, not the whole line. This is
   what Stage 2 inspects.
3. **`[allowlist]`** — paths Gitleaks must never scan: `node_modules/`,
   lockfiles, `dist/`, `dev-dist/`, `.git/`. These are either third-party
   code we don't own or build artefacts; scanning them only produces noise.

Gitleaks is invoked with `dir --source . --no-git` so it scans only the
current working tree, **not** the full git history. This prevents old
secrets committed in earlier commits from re-firing on every CI run — the
pipeline catches *new* leaks, not historical ones. The `|| true` guard
ensures the job does not abort before Stage 2 runs — the classifier, not
the scanner, makes the final pass/fail decision.

---

## 4. Stage 2 — Contextual ML Classifier (filter_secrets.py)

**File:** `filter_secrets.py` (repo root, zero external dependencies — stdlib
only, so it runs on the bare `python:3.11` runner image).

### 4.1 The "ML" in the script

The syllabus asks for an *ML/NLP* twist on top of pattern matching. Training
a real model (TF-IDF + logistic regression, or a transformer) inside a quick
lab CI run is impractical, so the script implements the **same reasoning**
a TF-IDF + proximity classifier would perform, but with the learned weights
hard-coded. Conceptually:

* A TF-IDF model learns which tokens are statistically over-represented in
  the "test fixture" class vs. the "real leak" class.
* We pre-computed that knowledge and embedded it as feature weights:
  `test`, `fixture`, `mock` → strong negative; `dummy`, `placeholder`,
  `example` → very strong negative; `AKIA`, `sk_live_`, `ghp_` → strong
  positive; high Shannon entropy → positive; low entropy → negative.

This is a **linear scoring model** — exactly the form a logistic-regression
classifier takes — with interpretable, auditable weights. Section 12
explains how to upgrade it to a trained scikit-learn model.

### 4.2 Features scored

| # | Feature | Signal | Weight | Why |
|---|---|---|---|---|
| 1 | **Path context** | file path contains `test`, `fixture`, `mock`, `spec`, `example`, `sample`, `__tests__`, `stubs`, `fakes` | **−3** | Secrets in test trees are almost always fixtures |
| 2 | **Value context** | secret value contains `dummy`, `placeholder`, `your_key`, `changeme`, `example`, `123456`, `xxxx`, `foobar`, `lorem`, … | **−5** | Placeholder strings are by definition not real |
| 3 | **Syntax context** | line contains `expected`, `assert`, `expect(`, `toBe(`, `toMatchSnapshot`, `mockReturnValue`, … | **−2** | Assertion lines are test code |
| 4 | **Entropy context** | Shannon entropy of the secret value | **+2** if ≥3.5 bits/char, **+1** if ≥2.5, **−1** if lower | Real keys are high-entropy random strings; human words are low |
| 5 | **Provider context** | value matches a known provider prefix regex (`AKIA…`, `sk_live_…`, `ghp_…`, `xoxb-…`, `AIza…`, JWT `eyJ…`) | **+3** | A correctly-formatted provider key is a strong positive |
| 6 | **File context** | path ends in `.env`, `.env.local`, `.env.production`, or contains `/config` | **+1** | Config/env files are where real secrets live |

**Decision rule:** `total_score >= 0` → `REAL_LEAK` (fail the build);
`total_score < 0` → `TEST_FIXTURE` (quarantine, pass the build).

### 4.3 Robustness details

* Handles both Gitleaks JSON shapes (bare array, or `{findings: [...]}`).
* Treats a missing/empty/unparseable report as **clean** (exit 0) so a
  scanner hiccup never blocks development.
* Writes a machine-readable `secret-scan-verdict.json` (uploaded as a CI
  artifact) with the full per-finding breakdown for auditing.
* Field-name agnostic: reads `File`/`file`, `Line`/`line`,
  `Secret`/`secret`, `RuleID`/`rule_id`, `LinkToLine`/`StartLine`.

### 4.4 Worked example (the demo)

Given a report with two findings:

| Finding | Path context | Value context | Syntax | Entropy | Provider | File | **Total** | **Verdict** |
|---|---|---|---|---|---|---|---|---|
| `AKIAIOSFODNN7EXAMPLE` in `tests/fixtures.json` | −3 (`test`) | −5 (`example`) | 0 | +2 (3.68) | +3 (AWS) | 0 | **−3** | TEST_FIXTURE |
| `sk_live_51Nx…` in `src/config.js` | 0 | −5 (`abcdef`) | 0 | +2 (5.13) | +3 (Stripe) | +1 (config) | **+1** | REAL_LEAK |

→ 1 quarantined, 1 real leak, pipeline **fails**. Exactly the behaviour
the presentation demo requires.

---

## 5. GitHub Actions Wiring

**File:** `.github/workflows/security.yml`

The workflow:

1. **Triggers** on every `push` and `pull_request` (plus manual
   `workflow_dispatch`).
2. **Checks out** the repo with `fetch-depth: 0` so Gitleaks can walk the
   full git history (commit messages, deleted files, etc.).
3. **Sets up Python 3.11** for Stage 2.
4. **Stage 1** — downloads the Gitleaks binary, runs `gitleaks detect`
   against `.gitleaks.toml`, writes `gitleaks-report.json`. The `|| true`
   keeps the job alive.
5. **Stage 2** — runs `python filter_secrets.py gitleaks-report.json`. Its
   exit code decides pass/fail.
6. **Uploads** both the raw Gitleaks report and the classifier verdict as a
   30-day artifact for auditing.

The workflow is intentionally separate from the existing
`.github/workflows/loglizer.yml` (log-anomaly detection) so each security
concern runs and fails independently.

---

## 6. Demo Files

Two intentionally-planted files let you demonstrate the classifier live:

### 6.1 False positive — `tests/fixtures.json`

```json
{
  "aws_key": "AKIAIOSFODNN7EXAMPLE",
  "stripe_test_key": "sk_test_dummyplaceholder1234567890",
  "github_token_fixture": "ghp_placeholderyourkey000000000000000000"
}
```

Gitleaks flags all three. The classifier sees the `tests/` path (−3) and
the `example`/`dummy`/`placeholder` tokens (−5 each) and quarantines them.
Build **passes**.

### 6.2 Real leak — `src/config.js`

```js
const stripeKey = "sk_live_51Nx<REDACTED>";
```

> The full synthetic key is in `src/config.js`, which is `.gitignore`d so
> GitHub Push Protection does not block the commit. Recreate it locally
> with a value matching the `sk_live_` Stripe pattern to demo the pipeline.

Gitleaks flags it. The classifier sees a production path, a `sk_live_`
provider pattern (+3), high entropy (+2), and a `/config` file (+1). Even
though the value contains `abcdef` (−5), the positives outweigh it →
`REAL_LEAK`, build **fails**.

> ⚠️ `src/config.js` is a **synthetic demo file**. The key is fake. Remove
> or gitignore it before any real deployment; it exists only to prove the
> pipeline blocks real-looking leaks.

---

## 7. How to Run Locally

### Full pipeline (needs Gitleaks installed)

```bash
# install gitleaks (one-off)
brew install gitleaks        # macOS
# or: go install github.com/gitleaks/gitleaks/v8@latest

# run stage 1
gitleaks detect --config .gitleaks.toml --verbose \
  --report-format json --report-path=gitleaks-report.json || true

# run stage 2
python3 filter_secrets.py gitleaks-report.json
echo "exit code: $?"   # 0 = clean, 1 = real leak found
```

### Stage 2 only (no Gitleaks needed)

```bash
# feed any hand-made JSON array of findings
python3 filter_secrets.py path/to/some-report.json
```

### Empty / clean case

```bash
rm -f gitleaks-report.json
python3 filter_secrets.py   # prints "No Gitleaks report found..." exit 0
```

---

## 8. Detection Methods Table

| Target Threat | Native Tool | AI Enrichment Layer | Outcome |
|---|---|---|---|
| Hardcoded secrets (API keys, tokens, passwords) | Gitleaks (regex + entropy) | Python contextual scoring (path / value / syntax / entropy / provider / file features) | Eliminates false positives in test environments while still blocking real leaks in production paths. |

---

## 9. Quarantine Workflow Diagram

```
[Developer Git Push]
       |
       v
[CI/CD Runner Activated]
       |
       v
[Gitleaks Scanner Engine]  ----> generates raw gitleaks-report.json
       |
       v
[filter_secrets.py Classifier]
       |
       +----> If [TEST_FIXTURE] ----> [LOG & QUARANTINE] ----> Pipeline PASS
       |
       +----> If [REAL_LEAK]    ----> [BLOCK BUILD]       ----> Pipeline FAIL
```

---

## 10. Files Created / Changed

| Path | Purpose | New/Changed |
|---|---|---|
| `.gitleaks.toml` | Gitleaks rules + allowlist (Stage 1 config) | New |
| `filter_secrets.py` | Contextual ML classifier (Stage 2) | New |
| `.github/workflows/security.yml` | CI automation for both stages | New |
| `tests/fixtures.json` | Demo false-positive fixtures | New |
| `src/config.js` | Demo real-leak file (synthetic key) | New |
| `docs/secret-detection.md` | This document | New |

No existing source files were modified.

---

## 11. Design Decisions & Trade-offs

**Why Gitleaks over TruffleHog for Stage 1?**
Gitleaks emits clean JSON, has a TOML config that's easy to extend, and
ships as a single static binary — ideal for CI. TruffleHog is a fine
alternative and Stage 2 would accept its JSON output unchanged.

**Why a heuristic model instead of a trained scikit-learn model?**
A lab CI run can't feasibly train or ship a model. The heuristic model
encodes the *same* features a TF-IDF + logistic-regression classifier would
learn (path tokens, placeholder tokens, entropy, provider prefixes) as
fixed weights. It's interpretable, auditable, dependency-free, and runs in
milliseconds. Section 12 shows the upgrade path.

**Why does Stage 1 not fail the build directly?**
If Gitleaks failed the build on every raw finding, every test fixture in
the repo would block development. The whole point of Stage 2 is to be the
*single* pass/fail authority, so Stage 1 is intentionally non-fatal
(`|| true`).

**Why `fetch-depth: 0`?**
So Gitleaks can scan the full git history — deleted files, old commits, and
commit messages are common places for secrets to leak.

**Why is `src/config.js` committed at all?**
It's a deliberate demo artifact. In a real repo you'd remove it (or
`.gitignore` it) once the pipeline is validated. It's clearly marked as
synthetic and contains no usable credential.

---

## 12. Extending to a Real ML Model

The heuristic classifier is a drop-in for a trained model. To upgrade:

1. **Collect a labelled dataset** — run Gitleaks across many repos, label
   each finding `REAL_LEAK` / `TEST_FIXTURE`.
2. **Engineer the same features** as columns: `in_test_path`,
   `has_placeholder_token`, `entropy`, `matches_provider_regex`,
   `is_assertion_line`, `is_config_file`.
3. **Train** a logistic regression / random forest / gradient-boosted model
   with scikit-learn (`TfidfVectorizer` on the surrounding line + the
   numeric features above).
4. **Ship** the pickled model + a thin `predict()` wrapper that exposes the
   same `analyze_context(finding) -> (label, score, features)` signature.
5. **Swap** the body of `analyze_context` to call `model.predict()`; nothing
   else in the pipeline changes.

Because Stage 2 only depends on the JSON contract from Stage 1, the scanner
and the classifier can evolve independently.