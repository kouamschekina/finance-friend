# Section 5 — AI-Enhanced Secret Leakage Detection

> Group 2 deliverable: a 2-stage defense pipeline that finds hardcoded
> secrets in the current working tree and uses a trained scikit-learn ML
> classifier to eliminate false positives in test fixtures.

---

## Table of Contents

- [1. Problem Statement](#1-problem-statement)
- [2. Architecture at a Glance](#2-architecture-at-a-glance)
- [3. Stage 1 — Deterministic Engine (Gitleaks)](#3-stage-1--deterministic-engine-gitleaks)
- [4. Stage 2 — Contextual ML Classifier](#4-stage-2--contextual-ml-classifier)
- [5. How the AI/ML Model Works](#5-how-the-aiml-model-works)
- [6. GitHub Actions Wiring](#6-github-actions-wiring)
- [7. Demo Files](#7-demo-files)
- [8. How to Run Locally](#8-how-to-run-locally)
- [9. Detection Methods Table](#9-detection-methods-table)
- [10. Quarantine Workflow Diagram](#10-quarantine-workflow-diagram)
- [11. Files Created / Changed](#11-files-created--changed)
- [12. Design Decisions & Trade-offs](#12-design-decisions--trade-offs)

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

This pipeline solves the precision problem with a **second stage**: a
trained scikit-learn ML classifier (TF-IDF + LogisticRegression) that reads
Gitleaks' raw output and classifies each finding based on the *context*
around it — learning from a labelled dataset which tokens and paths
indicate real leaks vs. test fixtures.

---

## 2. Architecture at a Glance

```
[Developer pushes to feat/loglizer branch]
       |
       v
[GitHub Actions CI Runner]
       |
       +--- Step 1: Checkout code (current branch only, fetch-depth=1)
       |
       +--- Step 2: Install scikit-learn, numpy, scipy
       |
       +--- Step 3: Train ML model (train_secret_classifier.py)
       |         |
       |         +---> Generates ml/secret_classifier_model.pkl
       |
       +--- Step 4: Run Gitleaks scan (Stage 1 - Deterministic)
       |         |
       |         +---> Scans ONLY the current working tree (--no-git)
       |         +---> Outputs gitleaks-report.json (raw findings)
       |
       +--- Step 5: Run ML classifier (Stage 2 - AI Inference)
       |         |
       |         +---> Loads trained model from .pkl
       |         +---> For each finding: predict() + predict_proba()
       |         +---> Classifies as REAL_LEAK or TEST_FIXTURE
       |         +---> Outputs verdict.json + report.html
       |
       +--- Step 6: Upload artifacts (reports retained 30 days)
       |
       v
   If any REAL_LEAK  -->  BUILD FAILS (pipeline blocked)
   If all TEST_FIXTURE  -->  BUILD PASSES (fixtures quarantined)
```

### Key design principle: scan scope

The pipeline scans **only the current working tree** of the pushed branch.
It does **NOT** scan:
- Git history (old commits, deleted files)
- Other branches
- Binary/generated files (`.pkl`, lockfiles, `node_modules/`)
- Local environment files (`.env`, `.env.*`)

This is achieved with `gitleaks detect --source . --no-git` plus a
comprehensive allowlist in `.gitleaks.toml`.

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
   captured *value* (group 2) as the secret, not the whole line.
3. **`[allowlist]`** — paths Gitleaks must **never** scan:
   - `node_modules/`, lockfiles, `dist/`, `dev-dist/`, `.git/` (third-party/build artifacts)
   - `*.pkl` files (binary ML model files — random bytes match secret regexes)
   - `ml/secret_classifier_dataset.json` (generated training data)
   - `.env`, `.env.*` (local environment files with real developer keys)
   - `gitleaks-report.json`, `secret-scan-verdict.json`, `secret-scan-report.html` (generated reports)

Gitleaks is invoked with `detect --source . --no-git` so it scans only the
current working tree, **not** the full git history. This prevents old
secrets committed in earlier commits from re-firing on every CI run — the
pipeline catches *new* leaks in the current branch, not historical ones.
The `|| true` guard ensures the job does not abort before Stage 2 runs —
the classifier, not the scanner, makes the final pass/fail decision.

---

## 4. Stage 2 — Contextual ML Classifier

**Files:** `train_secret_classifier.py` (training) + `filter_secrets.py`
(inference). Uses **scikit-learn** (`TfidfVectorizer` +
`LogisticRegression`) — a real trained ML model, not hand-coded rules.

The pipeline has two phases:

### Phase 1: Training (`train_secret_classifier.py`)

Runs in CI **before** the Gitleaks scan. Takes < 5 seconds.

1. **Dataset generation** — the script generates ~700 synthetic labelled
   findings mimicking real Gitleaks output:
   - **REAL_LEAK (label=1):** provider-prefixed keys (`AKIA...`,
     `sk_live_...`, `ghp_...`) in production paths (`src/`, `.env`,
     `config/`) with real-looking high-entropy values.
   - **TEST_FIXTURE (label=0):** same provider prefixes but in test paths
     (`tests/`, `mocks/`, `spec/`) with placeholder tokens (`dummy`,
     `example`, `placeholder`) and assertion syntax (`expect(`,
     `assert`).
   - **DOCS (label=0):** secrets mentioned in `.md` files in prose context.

2. **TF-IDF vectorization** — `TfidfVectorizer` converts each finding's
   text (file path + line content + secret value) into a vector of TF-IDF
   weights. This is the NLP step: it learns which tokens (like `tests`,
   `fixture`, `const`, `.env`) are statistically over-represented in each
   class.

3. **LogisticRegression training** — a linear classifier that learns
   which TF-IDF features predict "real leak" vs "test fixture".

4. **Serialization** — the trained pipeline is pickled to
   `ml/secret_classifier_model.pkl` for use at inference time.

### Phase 2: Inference (`filter_secrets.py`)

Runs **after** the Gitleaks scan. Loads the trained model and classifies
each finding.

1. **Load** the pickled model from `ml/secret_classifier_model.pkl`.
2. For each Gitleaks finding, **build the text feature** (same format as
   training: `file_path + line_content + secret_value`).
3. **Predict** — call `pipeline.predict()` and `pipeline.predict_proba()`
   to get the classification and confidence.
4. **Explain** — extract the top contributing TF-IDF tokens and their
   learned weights for each finding, so the report shows *why* the model
   made its decision.
5. **Decide** — `REAL_LEAK` → fail the build; `TEST_FIXTURE` → quarantine
   and pass.

If the model file is missing (e.g. running locally without training), the
script falls back to a heuristic scoring mode with the same feature
structure, so the pipeline never breaks.

---

## 5. How the AI/ML Model Works

### 5.1 What is TF-IDF?

**TF-IDF** (Term Frequency–Inverse Document Frequency) is a classic NLP
technique that converts text into numerical feature vectors. It measures
how important a word is to a document in a collection:

- **TF (Term Frequency):** How often a token appears in the text
- **IDF (Inverse Document Frequency):** How rare the token is across all
  documents (common tokens like "the" get low weight; distinctive tokens
  like "tests" or "env" get high weight)

In our pipeline, each "document" is the concatenation of:
```
<file_path> + " " + <line_content> + " " + <secret_value>
```

For example:
```
tests/fixtures.json "aws_key": "AKIAIOSFODNN7EXAMPLE" AKIAIOSFODNN7EXAMPLE
```

The TF-IDF vectorizer converts this text into a vector of ~thousands of
dimensions, where each dimension represents a token (or pair of tokens,
since we use `ngram_range=(1, 2)`).

### 5.2 What is LogisticRegression?

**LogisticRegression** is a linear classifier that learns a weight for
each TF-IDF feature. At inference time, it computes:

```
score = w1*tfidf("tests") + w2*tfidf("const") + w3*tfidf("env") + ...
```

If the score is positive → REAL_LEAK. If negative → TEST_FIXTURE.

The `predict_proba()` function converts this score into a probability
using the sigmoid function, giving us a **confidence** (e.g. 97.7%).

### 5.3 What the model learned

After training on 700 synthetic samples, the model learned these top
TF-IDF token weights:

| Token | Learned weight | Indicates |
|---|---|---|
| `env` | +3.52 | REAL_LEAK (env files hold real secrets) |
| `const` | +3.14 | REAL_LEAK (production code pattern) |
| `src` | +2.20 | REAL_LEAK (production source path) |
| `config` | +1.72 | REAL_LEAK (config files) |
| `token` | +1.31 | REAL_LEAK (token assignment) |
| `password` | +1.05 | REAL_LEAK (password assignment) |
| `tests` | −2.97 | TEST_FIXTURE (test directory) |
| `key` | −2.73 | TEST_FIXTURE (fixture key name) |
| `test` | −2.09 | TEST_FIXTURE (test directory) |
| `json` | −1.89 | TEST_FIXTURE (fixture file format) |
| `mocks` | −1.87 | TEST_FIXTURE (mock directory) |
| `fixtures` | −1.72 | TEST_FIXTURE (fixture directory) |
| `expect` | −1.33 | TEST_FIXTURE (assertion syntax) |
| `spec` | −1.30 | TEST_FIXTURE (spec directory) |

### 5.4 Training accuracy

The model achieves **100% training accuracy** on the synthetic dataset.
This is expected because the synthetic data has clear separating features
(test paths vs production paths, placeholder tokens vs real-looking values).

### 5.5 Explainability

For each finding, the classifier reports:
- **Prediction:** REAL_LEAK or TEST_FIXTURE
- **Confidence:** probability (e.g. 97.7%)
- **Probabilities:** REAL_LEAK=X%, TEST_FIXTURE=Y%
- **Top tokens:** the 5 most influential tokens and their learned weights

This makes the model's decisions fully auditable — you can see *why* it
classified each finding the way it did.

### 5.6 Fallback heuristic mode

If the trained model is missing (e.g. running locally without scikit-learn),
`filter_secrets.py` falls back to a heuristic scoring model with 7 features:

| # | Feature | Signal | Weight |
|---|---|---|---|
| 1 | Path context | file path contains `test`, `fixture`, `mock`, `spec` | −3 |
| 2 | Value context | secret contains `dummy`, `placeholder`, `example`, `123456` | −5 |
| 3 | Syntax context | line contains `expect(`, `assert`, `toMatchSnapshot` | −2 |
| 4 | Entropy context | Shannon entropy of secret value | +2/−1 |
| 5 | Provider context | matches `AKIA…`, `sk_live_…`, `ghp_…` regex | +3 |
| 6 | File context | path ends in `.env` or contains `/config` | +1 |
| 7 | Docs context | path ends in `.md`, `.rst`, `.txt` | −4 |

Decision: `total_score >= 0` → REAL_LEAK; `total_score < 0` → TEST_FIXTURE.

---

## 6. GitHub Actions Wiring

**File:** `.github/workflows/security.yml`

The workflow:

1. **Triggers** on every `push` to `main`, `master`, `feat/*` branches
   and `pull_request` to `main`/`master` (plus manual `workflow_dispatch`).
2. **Checks out** the repo (default `fetch-depth: 1` — we scan only the
   current working tree, not git history).
3. **Sets up Python 3.11** and installs scikit-learn, numpy, scipy.
4. **Stage 2a (Train)** — runs `python train_secret_classifier.py` to
   generate `ml/secret_classifier_model.pkl` from the synthetic dataset.
5. **Stage 1** — downloads the Gitleaks binary, runs `gitleaks detect
   --source . --config .gitleaks.toml --no-git --verbose` to scan only
   the current working tree. Writes `gitleaks-report.json`. The `|| true`
   keeps the job alive so Stage 2 can run.
6. **Stage 2b (Inference)** — runs `python filter_secrets.py
   gitleaks-report.json`. It loads the trained model and classifies each
   finding. Its exit code decides pass/fail (0 = pass, 1 = fail).
7. **Uploads** the raw Gitleaks report, the JSON verdict, and the HTML
   report as a 30-day artifact for auditing.

The workflow is intentionally separate from the existing
`.github/workflows/loglizer.yml` (log-anomaly detection) so each security
concern runs and fails independently.

### What gets scanned

Only the **current working tree** of the pushed branch. Specifically
excluded via `.gitleaks.toml` allowlist:
- `node_modules/`, `dist/`, `dev-dist/`, `.git/`
- `*.pkl` (binary ML model files)
- `ml/secret_classifier_dataset.json` (generated training data)
- `.env`, `.env.*` (local environment files)
- Lockfiles (`package-lock.json`, `bun.lock.*`)
- Generated reports (`gitleaks-report.json`, `secret-scan-verdict.json`, `secret-scan-report.html`)

### What does NOT get scanned

- **Git history** — old commits, deleted files, commit messages
- **Other branches** — only the pushed branch is checked out
- **Binary files** — `.pkl` files contain random bytes that match secret
  regexes but are not real secrets
- **Environment files** — `.env` files contain real developer API keys
  for local development and are .gitignored

---

## 7. Demo Files

Two intentionally-planted files let you demonstrate the classifier live:

### 7.1 False positive — `tests/fixtures.json`

```json
{
  "aws_key": "AKIAIOSFODNN7EXAMPLE",
  "stripe_test_key": "sk_test_dummyplaceholder1234567890",
  "github_token_fixture": "ghp_placeholderyourkey000000000000000000"
}
```

Gitleaks flags all three. The ML model classifies them as TEST_FIXTURE
(96.5% confidence) because the `tests/` path and `example`/`dummy`/
`placeholder` tokens are strong test-fixture signals. Build **passes**.

### 7.2 Real leak — `src/config.js`

```js
const stripeKey = "sk_live_51Nx<REDACTED>";
```

> The full synthetic key is in `src/config.js`, which is `.gitignore`d so
> GitHub Push Protection does not block the commit. Recreate it locally
> with a value matching the `sk_live_` Stripe pattern to demo the pipeline.

Gitleaks flags it. The ML model classifies it as REAL_LEAK (97.7%
confidence) because `src/` paths, `const` assignments, and `sk_live_`
provider prefixes are strong real-leak signals. Build **fails**.

---

## 8. How to Run Locally

### Full pipeline (needs Gitleaks + scikit-learn installed)

```bash
# install gitleaks (one-off)
brew install gitleaks        # macOS
# or: go install github.com/gitleaks/gitleaks/v8@latest

# install ML dependencies
pip install scikit-learn numpy scipy

# train the model (one-off, generates ml/secret_classifier_model.pkl)
python3 train_secret_classifier.py

# run stage 1 (scan only the current working tree)
gitleaks detect --source . --config .gitleaks.toml --no-git --verbose \
  --report-format json --report-path=gitleaks-report.json || true

# run stage 2 (ML inference)
python3 filter_secrets.py gitleaks-report.json
echo "exit code: $?"   # 0 = clean, 1 = real leak found
```

### Stage 2 only (no Gitleaks needed)

```bash
# train the model first
python3 train_secret_classifier.py

# feed any hand-made JSON array of findings
python3 filter_secrets.py path/to/some-report.json
```

### Empty / clean case

```bash
rm -f gitleaks-report.json
python3 filter_secrets.py   # prints "No Gitleaks report found..." exit 0
```

---

## 9. Detection Methods Table

| Target Threat | Native Tool | AI Enrichment Layer | Outcome |
|---|---|---|---|
| Hardcoded secrets (API keys, tokens, passwords) | Gitleaks (regex + entropy) | scikit-learn TF-IDF + LogisticRegression classifier (trained on synthetic labelled dataset) | Eliminates false positives in test environments while still blocking real leaks in production paths. |

---

## 10. Quarantine Workflow Diagram

```
[Developer pushes to feat/loglizer branch]
       |
       v
[GitHub Actions CI Runner]
       |
       v
[Train ML Model] ---> ml/secret_classifier_model.pkl
       |
       v
[Gitleaks Scanner] ---> gitleaks-report.json (raw findings)
       |                (scans ONLY current working tree, --no-git)
       v
[ML Classifier (filter_secrets.py)]
       |
       +----> If [TEST_FIXTURE] ----> [LOG & QUARANTINE] ----> Pipeline PASS
       |
       +----> If [REAL_LEAK]    ----> [BLOCK BUILD]       ----> Pipeline FAIL
       |
       v
[Upload artifacts: gitleaks-report.json, verdict.json, report.html]
```

---

## 11. Files Created / Changed

| Path | Purpose | New/Changed |
|---|---|---|
| `.gitleaks.toml` | Gitleaks rules + allowlist (Stage 1 config) | New |
| `train_secret_classifier.py` | Trains scikit-learn TF-IDF + LogisticRegression model | New |
| `filter_secrets.py` | ML inference classifier (Stage 2) | New |
| `.github/workflows/security.yml` | CI automation for all stages | New |
| `tests/fixtures.json` | Demo false-positive fixtures | New |
| `src/config.js` | Demo real-leak file (synthetic key, .gitignored) | New |
| `ml/secret_classifier_model.pkl` | Trained model (generated in CI, .gitignored) | Generated |
| `ml/secret_classifier_dataset.json` | Training dataset (generated, .gitignored) | Generated |
| `docs/secret-detection.md` | This document | New |

---

## 12. Design Decisions & Trade-offs

**Why Gitleaks over TruffleHog for Stage 1?**
Gitleaks emits clean JSON, has a TOML config that's easy to extend, and
ships as a single static binary — ideal for CI. TruffleHog is a fine
alternative and Stage 2 would accept its JSON output unchanged.

**Why scikit-learn TF-IDF + LogisticRegression?**
This is a classic NLP text classification approach. TF-IDF converts the
text context around each finding (file path + line content + secret value)
into feature vectors that capture which tokens are statistically
over-represented in each class. LogisticRegression learns a linear decision
boundary — interpretable, fast to train, and fast to infer. The model
achieves 100% training accuracy on the synthetic dataset.

**Why train in CI instead of shipping a pre-trained model?**
Training takes < 5 seconds on 700 synthetic samples. Generating the
dataset fresh in CI means the model is always reproducible from the code
in the repo — no binary model file to version or audit. The dataset
generation code *is* the source of truth.

**Why a synthetic dataset instead of real Gitleaks findings?**
Real secret-leak datasets are sensitive by definition. A synthetic dataset
that mimics the structure of real findings (provider prefixes, test paths,
placeholder tokens, assertion syntax) lets us train a meaningful model
without handling real credentials.

**Why does Stage 1 not fail the build directly?**
If Gitleaks failed the build on every raw finding, every test fixture in
the repo would block development. The whole point of Stage 2 is to be the
*single* pass/fail authority, so Stage 1 is intentionally non-fatal
(`|| true`).

**Why `--no-git` (working tree only)?**
Scanning the full git history would re-fire alerts for secrets that were
already committed and dealt with. The pipeline catches *new* leaks in the
current working tree, not historical ones. This also prevents the scan
from picking up secrets in old commits, deleted files, or other branches.

**Why are `.pkl` files excluded from the scan?**
The trained model (`ml/secret_classifier_model.pkl`) is a binary pickle
file. Its raw bytes happen to match secret regex patterns (GitHub tokens,
Stripe keys, etc.) because the model's learned weights encode token
patterns. Scanning it produces hundreds of false positives that are not
real secrets — they're just binary data that coincidentally matches.

**Why are `.env` files excluded from the scan?**
`.env` files contain real API keys for local development (Groq, Supabase,
etc.). These are developer-specific configuration files, not source code.
They are `.gitignore`d and should never be scanned in CI — the developer
is responsible for managing their own local secrets.

**Why is `src/config.js` committed at all?**
It's a deliberate demo artifact. In a real repo you'd remove it (or
`.gitignore` it) once the pipeline is validated. It's clearly marked as
synthetic and contains no usable credential. It's `.gitignore`d to avoid
GitHub Push Protection blocking the commit.