# Loglizer Anomaly Detection Pipeline — Full Documentation

## Overview

This document explains the complete flow of how log anomaly detection works in this project: from log generation, through parsing and machine learning, to reading and interpreting the final report.

The goal is simple: **prove that Loglizer can look at logs from a personal finance app, learn what normal behavior looks like, and automatically flag anything suspicious — all triggered by a GitHub push with zero manual steps.**

---

## What We Expect From Loglizer

Before explaining the technical flow, it is important to be clear about what Loglizer is supposed to do and what a successful outcome looks like.

### What Loglizer is

Loglizer is a machine learning library designed for **log-based anomaly detection**. It was built for system reliability engineers who need to automatically detect problems in large volumes of server logs. Instead of reading logs manually, Loglizer:

1. Learns what "normal" looks like from a clean set of logs
2. Scans new logs and flags anything that looks different from normal

### What we expect it to detect

Given the logs our finance application produces, Loglizer should flag the following as anomalies:

| Scenario | What the logs look like | Why it is abnormal |
|---|---|---|
| Brute-force login attack | 5–15 consecutive `WARN Login failed` for the same user | Normal users never fail login more than once or twice |
| Server exceptions | 3–10 repeated `ERROR NullPointerException` or `IOException` | Exceptions should be rare, not repeated in bursts |
| Database unavailable | Multiple `ERROR Database connection timeout` in a row | A healthy session never has DB timeouts |
| Unauthorized access | Repeated `WARN Unauthorized access attempt endpoint=/admin` | Normal users never hit admin endpoints |
| Traffic spike / DDoS | Hundreds of rapid `GET /api/expenses` requests in seconds | A normal human session has 5–15 requests, not 500 |
| Slow responses | Multiple `WARN Request took unusually long response_time=15000ms` | Occasional slowness is normal, repeated slowness is not |

### What a successful result looks like

After Loglizer runs, we expect:

- Sessions containing the above patterns to be labeled **ANOMALY**
- Regular user sessions (login → browse → add expense → logout) to be labeled **NORMAL**
- A report showing exactly which sessions were flagged and why

If Loglizer correctly separates the anomalous sessions from the normal ones, the pipeline has worked as intended.

---

## The Core Problem: Where Do the Logs Come From?

This finance application is a React frontend + Supabase backend. It runs in the browser — there is no traditional server writing to `/var/log/app.log`.

In a real production deployment the flow would be:

```
Server runs → writes logs continuously → stored in S3 / CloudWatch / ELK
                                                    ↓
                                         GitHub Actions pulls logs
                                                    ↓
                                            Loglizer runs
```

Since we do not have that infrastructure, we use a **log simulation script** (`ml/generate_logs.py`) that produces realistic logs representing what the app would generate. This is a standard and accepted approach for demonstrating anomaly detection pipelines in research and academic contexts. The pipeline logic is identical — only the log source differs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Runner                     │
│                                                             │
│  1. Checkout code                                           │
│         │                                                   │
│         ▼                                                   │
│  2. Install Python dependencies                             │
│         │                                                   │
│         ▼                                                   │
│  3. generate_logs.py                                        │
│     ├── logs/normal.log      ← 100 clean user sessions      │
│     ├── logs/abnormal.log    ← 20 attack / failure scenarios│
│     └── logs/application.log ← mixed: 80 normal + 5 attacks│
│         │                                                   │
│         ▼                                                   │
│  4. train.py                                                │
│     └── reads normal.log → trains PCA model → model.pkl    │
│         │                                                   │
│         ▼                                                   │
│  5. detect.py                                               │
│     └── reads application.log → labels each session        │
│         │                                                   │
│         ▼                                                   │
│  6. report.py                                               │
│     ├── reports/index.html   ← visual dashboard with charts │
│     ├── reports/report.md    ← text report                  │
│     └── reports/anomalies.json ← raw data                  │
│         │                                                   │
│         ▼                                                   │
│  7. Deploy index.html → GitHub Pages (live URL)             │
│  8. Upload all reports as downloadable artifacts            │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### Step 1 — Log Generation (`ml/generate_logs.py`)

This script simulates application activity and writes three log files.

#### `logs/normal.log` — the training data

100 sessions of typical user behavior. Every session starts with a login, has some activity, and ends with a logout. Sessions are spaced 10–30 minutes apart so the parser can identify session boundaries by time gaps.

```
2026-07-01 09:00:00 INFO User login success user=alice
2026-07-01 09:00:03 INFO GET /dashboard user=alice
2026-07-01 09:00:08 INFO Added expense amount=250 category=Food user=alice
2026-07-01 09:00:35 INFO Added income amount=3000 user=alice
2026-07-01 09:00:42 INFO Budget created category=Food user=alice
2026-07-01 09:00:48 INFO Monthly report generated user=alice
2026-07-01 09:00:51 INFO User logout user=alice
```

This file is used **only for training**. The model learns from it what normal looks like.

#### `logs/abnormal.log` — reference anomalies

20 attack and failure scenarios. This file is not fed to the model — it exists as a reference to show what anomalous patterns look like, and can be used to verify the model's sensitivity.

```
# Brute-force login
2026-07-01 10:00:00 WARN Login failed user=bob attempt=1
2026-07-01 10:00:04 WARN Login failed user=bob attempt=2
2026-07-01 10:00:09 WARN Login failed user=bob attempt=3
...
2026-07-01 10:00:43 ERROR Account locked user=bob

# Database failure
2026-07-01 11:30:00 ERROR Database connection timeout
2026-07-01 11:30:08 ERROR Database connection timeout
2026-07-01 11:30:15 ERROR Database connection timeout

# Traffic spike
2026-07-01 14:00:00 INFO GET /api/expenses
2026-07-01 14:00:01 INFO GET /api/expenses
2026-07-01 14:00:01 INFO GET /api/income
... (400 more lines within 5 minutes)
```

#### `logs/application.log` — the test dataset

80 normal sessions with 5 anomaly scenarios mixed in at random positions. This is what Loglizer actually analyses. We know where the anomalies are, so we can verify whether Loglizer found them.

---

### Step 2 — Log Parsing (`ml/parser.py`)

Raw logs are text. The ML model needs numbers. The parser does two things.

#### Template extraction

Variable parts of each log line (usernames, amounts, IPs) are replaced with wildcards `*` to produce a fixed template. Each unique template gets an ID.

```
Raw:      2026-07-01 09:00:08 INFO Added expense amount=250 category=Food user=alice
Template: Added expense amount=* category=* user=*
ID:       2
```

All 17 event types found in these logs:

```
ID 0  → User login success user=*
ID 1  → GET /dashboard
ID 2  → Added expense amount=* category=* user=*
ID 3  → Added income amount=* user=*
ID 4  → User logout user=*
ID 5  → Budget created category=* user=*
ID 6  → Monthly report generated user=*
ID 7  → Unauthorized access attempt endpoint=* user=*
ID 8  → IOException
ID 9  → Request took unusually long response_time=*
ID 10 → SQLException
ID 11 → GET /api/income
ID 12 → GET /api/expenses
ID 13 → GET /api/budgets
ID 14 → Database connection timeout
ID 15 → Login failed user=* attempt=*
ID 16 → Account locked user=*
```

#### Session grouping

Log lines are grouped into sessions using time gaps. A gap of more than 5 minutes between two consecutive events creates a new session boundary.

```
Session 1: events at 09:00–09:05  [login, dashboard, expense, income, logout]
Session 2: events at 09:18–09:23  [login, dashboard, budget, logout]
Session 3: events at 10:00–10:01  [failed×10, locked]  ← clearly different
```

---

### Step 3 — Feature Extraction

Each session becomes a **count vector** — one number per event type, counting how many times that event appeared in the session.

```
              login  dash  expense  income  logout  budget  report  unauth  exception ...
Normal:       [  1,    1,      2,      1,      1,      0,      0,      0,       0, ... ]
Brute-force:  [  0,    0,      0,      0,      0,      0,      0,      0,       0, 0, 0, 0, 0, 0, 0, 10, 1 ]
DB timeout:   [  0,    0,      0,      0,      0,      0,      0,      0,       0, 0, 0, 0, 0, 0,  3,  0, 0 ]
```

You can already see visually that the anomaly vectors look completely different from normal ones. This is exactly what the model learns to detect.

---

### Step 4 — Model Training (`ml/train.py`)

**Input:** 100 normal session feature vectors from `logs/normal.log`

**Algorithm:** PCA (Principal Component Analysis)

PCA finds the mathematical patterns that explain normal behavior — which event types tend to appear together, in what proportions. It compresses the session data into its most important dimensions and builds a reconstruction model.

Once trained, it can take any new session and ask: *"How well does this fit the normal pattern I learned?"* The answer is a number called the **SPE (Squared Prediction Error)**.

- Low SPE → session looks like what the model learned → **NORMAL**
- High SPE → session is very different from normal → **ANOMALY**

The threshold is set automatically during training based on the spread of normal session scores. Sessions scoring above the threshold get flagged.

```
Training output:
  n_components: 3
  SPE threshold: 3.53
  Sanity check: 100/100 normal sessions correctly classified ✓
```

The trained model is saved to `ml/model.pkl`.

---

### Step 5 — Anomaly Detection (`ml/detect.py`)

The model is loaded and applied to every session in `logs/application.log`.

```
Session 0:   SPE = 0.4  → NORMAL
Session 1:   SPE = 0.7  → NORMAL
Session 2:   SPE = 1.1  → NORMAL
...
Session 82:  SPE = 89.3 → ANOMALY  (478 rapid GET requests)
Session 83:  SPE = 0.9  → NORMAL
Session 84:  SPE = 42.1 → ANOMALY  (239 rapid GET requests)
```

Results saved to `reports/anomalies.json`.

---

### Step 6 — Report Generation (`ml/report.py`)

Three output files are produced.

#### `reports/index.html` — the visual dashboard

An HTML page with:
- Stat cards showing total sessions, normal count, anomaly count, and anomaly rate
- A donut chart showing the normal vs anomaly split
- A bar chart showing what types of anomalies were detected
- Anomaly detail cards with a preview of the actual log lines
- The full list of event templates used

This is the main output intended for viewing. It is deployed to GitHub Pages automatically.

#### `reports/report.md` — text report

The same information in Markdown format. Useful for reading in the GitHub Actions summary tab without downloading anything.

#### `reports/anomalies.json` — raw data

The full machine-readable results including every session label and all anomaly details.

---

## How to Read the Report

### The dashboard (GitHub Pages)

After the workflow runs, the report is live at your GitHub Pages URL. Here is what each section tells you:

#### Stat cards (top row)

```
Total Sessions  |  Normal Sessions  |  Anomalous Sessions  |  Anomaly Rate
      85        |        83         |          2           |     2.4%
```

- **Total Sessions** — how many distinct activity periods were found in the log file
- **Normal Sessions** — sessions that matched the learned normal pattern
- **Anomalous Sessions** — sessions that deviated significantly from normal
- **Anomaly Rate** — the percentage that were flagged. For a healthy system this should be low. A rate above 5–10% during normal operations would be a concern.

#### Donut chart

Shows the proportion of normal vs anomalous sessions visually. In a healthy system you expect a large green slice (normal) and a very small red slice (anomaly). If red is large, something is seriously wrong.

#### Bar chart — Anomaly Types

Shows which kinds of anomalies were detected and how many of each. For example:

```
Traffic Spike        ██████  2
Brute-force Login    ████    1
DB Timeout           ██      1
```

This tells you at a glance whether you are dealing with an attack (brute-force, unauthorized access, traffic spike) or a system failure (DB timeout, server exceptions).

#### Anomaly detail cards

Each flagged session gets a card showing:

- **Session Index** — the position of this session in the log file (e.g. Session 82 out of 85)
- **Event Count** — how many log lines were in this session. A normal session has 5–10 events. Session 82 has 478 — that alone is a red flag.
- **Detected Issues** — plain-language description of what pattern triggered the anomaly flag (e.g. "Multiple failed logins (7 attempts)")
- **Log Preview** — the first 5 actual log lines from that session so you can see the raw evidence

**Example of reading a card:**

```
ANOMALY #1
Session Index: 82  ·  478 events

Detected Issues:
  • Traffic spike detected

Log Preview:
  2026-07-04 15:14:09 INFO GET /api/expenses
  2026-07-04 15:14:11 INFO GET /api/budgets
  2026-07-04 15:14:12 INFO GET /api/expenses
  2026-07-04 15:14:13 INFO GET /api/expenses
  2026-07-04 15:14:14 INFO GET /api/expenses
```

Reading this: Session 82 had 478 events, all of them GET requests firing every 1–2 seconds. A real human session would have 5–15 varied events over several minutes. This pattern matches a DDoS-like automated request flood, which is why the model flagged it.

#### Event Templates section

Lists all the event types the model knows about. If you see a template here that you do not recognize, it means the logs contain a new type of activity the model was not trained on — worth investigating.

---

## Accessing the Results After a GitHub Actions Run

### Option 1 — GitHub Pages (recommended)

Enable once: **Settings → Pages → Source → GitHub Actions**

After every push the dashboard is live at:
```
https://<your-username>.github.io/<your-repo-name>/
```

### Option 2 — Actions Artifacts

1. Go to your repo → **Actions** tab
2. Click the latest **Loglizer Anomaly Detection** run
3. Scroll to **Artifacts** at the bottom
4. Download **anomaly-reports** — contains `index.html`, `report.md`, `anomalies.json`, `summary.json`
5. Open `index.html` locally in any browser

### Option 3 — Inline in Actions

Click any completed run → **Summary** tab — the detection table is shown directly on the page without downloading anything.

---

## GitHub Actions Workflow

File: `.github/workflows/loglizer.yml`

### When It Runs

| Trigger | When |
|---|---|
| Push to `main` or `master` | Every merge |
| Push to `feat/loglizer` | Every push during development |
| Pull Request | Every PR opened or updated |
| Manual trigger | Actions tab → Run workflow button |
| Daily schedule | Every day at midnight UTC |

---

## Why PCA?

PCA is the right choice here because:

- **Unsupervised** — we do not need labeled anomaly examples to train it, only clean normal logs
- **Threshold-based** — the SPE score is a single interpretable number per session
- **Sensitive to pattern shifts** — a brute-force session or traffic spike looks radically different in vector space, producing a very high SPE
- **Proven** — PCA is one of the benchmark models in the original Loglizer research paper

---

## File Reference

```
ml/
├── generate_logs.py   # Simulates app logs (normal + anomaly scenarios)
├── parser.py          # Parses raw logs → event templates → sessions
├── train.py           # Trains PCA on normal.log → ml/model.pkl
├── detect.py          # Scores sessions, flags anomalies
├── report.py          # Generates index.html, report.md, anomalies.json
└── requirements.txt   # Python dependencies

logs/                  # Created fresh by CI (gitignored)
├── normal.log         # 100 normal sessions (training data)
├── abnormal.log       # 20 anomaly scenarios (reference)
└── application.log    # Mixed test dataset (what Loglizer analyses)

reports/               # Created fresh by CI, deployed to GitHub Pages
├── index.html         # Visual dashboard ← main output
├── report.md          # Text version
├── anomalies.json     # Raw detection data
└── summary.json       # Summary statistics

.github/workflows/
└── loglizer.yml       # Full CI/CD pipeline
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

# Open the visual report
open reports/index.html        # macOS
xdg-open reports/index.html   # Linux
```

---

## Enabling GitHub Pages (one-time setup)

1. Go to your repository → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

After the next push the report will be live at:
```
https://<your-username>.github.io/<your-repo-name>/
```

---

## Demo Script (Presentation)

1. Show the finance application running — demonstrate a normal user flow (login, add expense, view dashboard)
2. Open `ml/generate_logs.py` — explain: *"This simulates exactly what the server would log, including attack scenarios like brute-force login and traffic spikes"*
3. Push to `feat/loglizer` or click **Run workflow** manually in the Actions tab
4. Watch the workflow execute live — walk through each step (generate → train → detect → report)
5. Once complete, open the GitHub Pages URL
6. Walk through the dashboard — stat cards, donut chart, anomaly type bar chart
7. Click into an anomaly card — show the raw log lines and explain what the pattern means
8. Conclude: *"Loglizer correctly identified the anomalous sessions based purely on learning from normal behavior — no manual rules were written"*
