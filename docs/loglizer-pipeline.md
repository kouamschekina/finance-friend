# Loglizer Anomaly Detection Pipeline — Full Documentation

## Overview

This document explains the complete flow of how log anomaly detection works in this project: from log generation, through parsing and machine learning, to report generation and CI/CD automation via GitHub Actions.

The goal is to prove that **Loglizer can automatically detect anomalous behavior** in logs produced by a personal finance management application, and that this entire process runs without manual intervention on every code push.

---

## The Core Problem

A running web application (React + Supabase) does not write logs to a file on a server you control. It runs in the user's browser and on Supabase's managed infrastructure. This means there is no `/var/log/app.log` to read from.

To bridge this gap, the pipeline uses a **log simulation script** (`ml/generate_logs.py`) that produces realistic log data representing what the application *would* generate if it had traditional server-side logging. This is a standard and accepted approach for demonstrating anomaly detection pipelines in academic and research contexts.

In a real production setup, the equivalent would be:

```
Real server → writes logs → S3 / CloudWatch / ELK Stack → CI pulls logs → Loglizer runs
```

In this project:

```
generate_logs.py → writes logs → logs/ folder → Loglizer runs → report uploaded
```

The pipeline is identical. Only the log source differs.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Runner                     │
│                                                             │
│  1. git checkout                                            │
│         │                                                   │
│         ▼                                                   │
│  2. pip install -r ml/requirements.txt                      │
│         │                                                   │
│         ▼                                                   │
│  3. python ml/generate_logs.py                              │
│     ├── logs/normal.log       (100 normal sessions)         │
│     ├── logs/abnormal.log     (20 anomaly scenarios)        │
│     └── logs/application.log (80 normal + 5 anomaly)       │
│         │                                                   │
│         ▼                                                   │
│  4. python ml/train.py                                      │
│     └── trains PCA model on normal.log → ml/model.pkl      │
│         │                                                   │
│         ▼                                                   │
│  5. python ml/detect.py                                     │
│     └── runs model on application.log → reports/anomalies.json │
│         │                                                   │
│         ▼                                                   │
│  6. python ml/report.py                                     │
│     ├── reports/report.md                                   │
│     └── reports/summary.json                               │
│         │                                                   │
│         ▼                                                   │
│  7. Upload artifacts (report.md, anomalies.json, summary.json) │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### Step 1 — Log Generation (`ml/generate_logs.py`)

This script simulates a full day of application activity. It creates three files:

#### `logs/normal.log`
Contains **100 sessions** of typical user behavior. Each session follows this pattern:

```
2026-07-01 09:00:00 INFO User login success user=alice
2026-07-01 09:00:03 INFO GET /dashboard user=alice
2026-07-01 09:00:08 INFO Added expense amount=250 category=Food user=alice
2026-07-01 09:00:35 INFO Added income amount=3000 user=alice
2026-07-01 09:00:42 INFO Budget created category=Food user=alice
2026-07-01 09:00:48 INFO Monthly report generated user=alice
2026-07-01 09:00:51 INFO User logout user=alice
```

Sessions are separated by 10–30 minute gaps in timestamp, which allows the parser to correctly identify session boundaries.

#### `logs/abnormal.log`
Contains **20 anomaly scenarios** covering 6 attack/failure types:

| Anomaly Type | Log Pattern |
|---|---|
| Brute-force login | 5–15 consecutive `WARN Login failed` lines |
| Server exception | 3–10 repeated `ERROR NullPointerException` / `IOException` |
| Database timeout | 2–5 repeated `ERROR Database connection timeout` |
| Unauthorized access | 2–6 `WARN Unauthorized access attempt endpoint=/admin` |
| Traffic spike | 100–500 rapid `INFO GET /dashboard` requests |
| Slow responses | 3–8 `WARN Request took unusually long response_time=15000ms` |

#### `logs/application.log`
The **test dataset** — 80 normal sessions mixed with 5 anomaly scenarios. This is what Loglizer runs detection on.

---

### Step 2 — Log Parsing (`ml/parser.py`)

Raw logs are human-readable text. Loglizer needs structured data. The parser does two things:

#### 2a. Template Extraction

Each log line's variable parts (usernames, amounts, timestamps) are replaced with wildcards to extract a reusable template:

```
# Raw log line:
2026-07-01 09:00:08 INFO Added expense amount=250 category=Food user=alice

# Extracted template:
Added expense amount=* category=* user=*

# Assigned Event ID: 2
```

This produces a vocabulary of event types. For this application, 17 distinct event types are identified, for example:

```
ID 0  → User login success user=*
ID 1  → GET /dashboard
ID 2  → Added expense amount=* category=* user=*
ID 3  → Added income amount=* user=*
ID 4  → User logout user=*
ID 7  → Unauthorized access attempt endpoint=* user=*
ID 8  → IOException
ID 14 → Database connection timeout
ID 15 → Login failed user=* attempt=*
```

#### 2b. Session Grouping

Log lines are grouped into **sessions** based on time gaps. Any gap larger than 5 minutes between consecutive events starts a new session.

```
Session 1:  [login, dashboard, expense, expense, logout]       → NORMAL
Session 2:  [login, dashboard, income, budget, report, logout] → NORMAL
Session 3:  [failed, failed, failed, failed, failed, locked]   → ANOMALY
```

Each session becomes a sequence of event IDs:
```
Session 1 → [0, 1, 2, 2, 4]
Session 3 → [15, 15, 15, 15, 15, 16]
```

---

### Step 3 — Feature Extraction

Each session's event ID sequence is converted into a **count vector** — one number per event type, representing how many times that event occurred in the session.

```
Event IDs:   [0,  1,  2,  3,  4,  5,  6,  7,  8, ...]
             ↓
Session 1:   [1,  1,  2,  1,  1,  0,  0,  0,  0, ...]  ← normal
Session 3:   [0,  0,  0,  0,  0,  0,  0,  0,  0, 0, 0, 0, 0, 0, 0, 5, 1, ...]  ← anomaly
```

This numerical matrix is what the machine learning model actually learns from.

---

### Step 4 — Model Training (`ml/train.py`)

The model is trained **exclusively on normal logs**. It never sees anomalies during training.

**Algorithm: PCA (Principal Component Analysis)**

PCA learns the patterns that explain normal behavior — which events appear together, in what proportions. It builds a mathematical model of "what a normal session looks like."

During training:
- Input: 100 normal session feature vectors
- PCA reduces the feature space to its principal components
- A **SPE threshold** (Squared Prediction Error) is computed — sessions that deviate beyond this threshold are considered anomalous

```
====== Model summary ======
n_components: 3
Project matrix shape: 7-by-7
SPE threshold: 3.53
```

The trained model is saved to `ml/model.pkl`.

**Sanity check:** After training, the model is tested on its own training data. A well-trained model should classify 100/100 normal sessions as normal. ✓

---

### Step 5 — Anomaly Detection (`ml/detect.py`)

The saved model is loaded and applied to `logs/application.log` (the mixed dataset).

For each session:
1. Convert to a feature vector (same process as training)
2. Project through the PCA model
3. Calculate the **SPE (reconstruction error)** — how different is this session from what "normal" looks like?
4. If SPE > threshold → `ANOMALY`, otherwise → `NORMAL`

```
Session 0:  NORMAL   (login, expenses, logout — expected pattern)
Session 1:  NORMAL
...
Session 82: ANOMALY  (478 rapid GET requests — traffic spike)
Session 84: ANOMALY  (239 rapid GET requests — another traffic spike)
```

Results are saved to `reports/anomalies.json`:

```json
{
  "summary": {
    "total_sessions": 85,
    "normal_count": 83,
    "anomaly_count": 2
  },
  "anomaly": [
    {
      "session_index": 82,
      "event_count": 478,
      "indicators": ["Traffic spike detected"],
      "events_preview": ["2026-07-04 14:42:58 INFO GET /api/expenses", ...]
    }
  ]
}
```

---

### Step 6 — Report Generation (`ml/report.py`)

Takes the detection results and model info and produces two output files:

#### `reports/report.md`
A human-readable Markdown report with:
- Summary table (total/normal/anomaly counts)
- Model metadata (algorithm, training size, threshold)
- Details for each detected anomaly (session index, event count, preview of raw log lines)
- Full list of event templates used

#### `reports/summary.json`
A machine-readable JSON summary suitable for dashboards or further processing.

---

## GitHub Actions Workflow

File: `.github/workflows/loglizer.yml`

### When It Runs

| Trigger | Description |
|---|---|
| Push to `main` | Runs on every merge to main branch |
| Push to `master` | Same, for repos using master |
| Push to `feat/loglizer` | Runs on the feature branch during development |
| Pull Request to `main`/`master`/`feat/loglizer` | Runs on every PR for review |
| Manual trigger | Via GitHub UI → Actions → Run workflow |
| Daily schedule | Runs every day at midnight UTC (cron: `0 0 * * *`) |

### Pipeline Steps

```yaml
1. actions/checkout@v4          # Pull the code
2. actions/setup-python@v5      # Python 3.10 clean environment
3. pip install -r ml/requirements.txt
4. python ml/generate_logs.py   # Create logs/
5. python ml/train.py           # Train model, save ml/model.pkl
6. python ml/detect.py          # Detect anomalies, save reports/
7. python ml/report.py          # Generate report.md and summary.json
8. actions/upload-artifact@v4   # Upload reports as downloadable artifact
9. Display summary in GitHub UI # Shows table directly in the Actions run page
```

### Artifacts

After each run, two artifacts are available for download for 30 days:

- **`anomaly-reports`** — contains `report.md`, `anomalies.json`, `summary.json`
- **`trained-model`** — contains `model.pkl` for inspection or reuse

### Viewing Results

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Click the latest **Loglizer Anomaly Detection** run
4. Scroll down to **Artifacts** → click `anomaly-reports` to download
5. The **Summary** tab also shows the detection table inline

---

## Why PCA for Anomaly Detection?

PCA is well-suited for log anomaly detection because:

- **Unsupervised** — no labeled anomaly data needed during training
- **Fast** — trains on hundreds of sessions in milliseconds
- **Interpretable** — the SPE score directly measures deviation from normal
- **Proven** — used in the original Loglizer paper on production system logs

The model learns the correlation structure of normal events. A session full of repeated `Login failed` events or hundreds of rapid API calls has a completely different structure, resulting in a high SPE that crosses the threshold.

---

## File Reference

```
ml/
├── generate_logs.py   # Simulates app log output (normal + anomalies)
├── parser.py          # Parses raw logs into event sequences and sessions
├── train.py           # Trains PCA model on normal.log
├── detect.py          # Detects anomalies in application.log
├── report.py          # Generates report.md and summary.json
└── requirements.txt   # loglizer, numpy, pandas, scikit-learn, scipy

logs/                  # Generated at runtime (gitignored)
├── normal.log
├── abnormal.log
└── application.log

reports/               # Generated at runtime (gitignored, uploaded as artifact)
├── report.md
├── anomalies.json
└── summary.json

.github/workflows/
└── loglizer.yml       # CI/CD pipeline definition
```

---

## Running Locally

```bash
# Install dependencies
pip install -r ml/requirements.txt

# Run the full pipeline
python3 ml/generate_logs.py
python3 ml/train.py
python3 ml/detect.py
python3 ml/report.py

# View the report
cat reports/report.md
```

---

## Demo Script (For Presentation)

1. Open the finance application and walk through normal actions (login, add expense, create budget)
2. Explain: *"In a real server deployment, these actions would write to application.log"*
3. Show `ml/generate_logs.py` — *"This simulates exactly those logs, including attack scenarios"*
4. Push to `feat/loglizer` or trigger the workflow manually
5. Switch to the GitHub Actions tab — show the workflow running live
6. Once complete, download the `anomaly-reports` artifact
7. Open `report.md` — show detected anomalies with session details
8. Explain what each anomaly represents (traffic spike = DDoS-like pattern, brute force login, etc.)
