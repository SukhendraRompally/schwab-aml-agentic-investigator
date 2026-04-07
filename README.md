# Schwab AI.x — AML Agentic Investigator

A prototype that demonstrates how Generative AI shifts Anti-Money Laundering operations from **rigid rule-based alerts** to **agentic risk reasoning**. Built for Schwab's AI.x team as a proof-of-concept for the Risk organization.

---

## The Problem

AML analysts at financial institutions face a daily triage of 50–100 transaction alerts, of which **90%+ are false positives**. Writing a single Suspicious Activity Report (SAR) by hand takes 45–90 minutes. Missed SARs carry civil penalties up to $1M per violation under the Bank Secrecy Act.

Traditional rule-based systems flag transactions by static thresholds (e.g. `amount > $10,000`). They tell analysts **what** happened — not **why** it looks suspicious.

---

## What We Built

A 4-step agentic pipeline that mirrors how a real AML investigator thinks:

```
Step 1: Behavioral Triage     → Intent-based flagging (not just dollar amounts)
Step 2: LLM Investigation     → Blind AI analysis of each flagged transaction
Step 3: SAR Drafting          → Structured report generated for suspicious cases
Step 4: Validation Reveal     → AI decisions scored against ground truth (live)
```

Each step updates a **live cumulative scoreboard** (Precision, Recall, TP/FP/FN/TN) as transactions are processed — not just at the end.

---

## Architecture

```
┌─────────────────────────────────┐        ┌──────────────────────────┐
│     Replit Frontend             │        │   Azure VM Backend       │
│  (HTML / JS / React)            │◄──────►│   FastAPI on port 8005   │
│                                 │  HTTP  │                          │
│  • Progress bar                 │        │  triage.py               │
│  • Live TP/FP/FN/TN scoreboard  │        │  investigator.py         │
│  • Transaction feed             │        │  validation.py           │
│  • SAR viewer                   │        │  main.py                 │
└─────────────────────────────────┘        └────────────┬─────────────┘
                                                        │
                                           ┌────────────▼─────────────┐
                                           │   Azure OpenAI (GPT-4.1) │
                                           │   2 calls per transaction │
                                           │   1. Investigate          │
                                           │   2. Draft SAR            │
                                           └──────────────────────────┘
```

**Backend** runs on an Azure VM, exposing a CORS-open REST API.
**Frontend** runs on Replit, polling the backend for live updates.
**LLM** runs on Azure OpenAI (GPT-4.1) — no isFraud label is shown to the model (blind test).

---

## Dataset

**PaySim Synthetic Financial Dataset** — [Kaggle: ealaxi/paysim1](https://www.kaggle.com/datasets/ealaxi/paysim1)

PaySim simulates mobile money transactions based on real anonymized data from a mobile money service. It includes labeled fraud (`isFraud`) used only for validation — never shown to the LLM.

| Field | Description |
|---|---|
| `type` | CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER |
| `amount` | Transaction amount |
| `nameOrig` | Origin account ID |
| `oldbalanceOrg` / `newbalanceOrig` | Origin account balance before/after |
| `nameDest` | Destination account ID |
| `oldbalanceDest` / `newbalanceDest` | Destination balance before/after |
| `isFraud` | Ground truth label (hidden from LLM) |

The pipeline samples **100 rows** with at least 20 fraud cases guaranteed via stratified sampling.

---

## Step-by-Step Pipeline

### Step 1 — Behavioral Triage

Instead of a static dollar threshold, we flag transactions based on **intent signals**:

```python
type in ('TRANSFER', 'CASH_OUT')     # High-risk transaction types
AND amount > 0.9 * oldbalanceOrg     # Draining >90% of origin account
AND newbalanceDest == 0              # Destination account completely cleared
```

This catches **account-clearing behavior** — a primary pattern in layering and structuring schemes — that a simple `amount > $10,000` rule misses entirely.

### Step 2 — LLM Investigation (Blind Test)

Each flagged transaction is sent to GPT-4.1 with a **Senior AML Investigator persona**. The `isFraud` and `isFlaggedFraud` columns are stripped before the LLM sees any data — this is a genuine blind test.

The model is asked to reason about:
- Balance shift patterns (origin drained, destination zeroed)
- Whether the amount and type combination suggests deliberate obfuscation
- Which AML typology applies: Structuring, Layering, or Account Draining

Output per transaction:
```json
{
  "ai_decision": "SUSPICIOUS" | "LOW_RISK",
  "risk_level": "HIGH" | "MEDIUM" | "LOW",
  "behavioral_reasoning": "The origin account held $82,400 and was drained to zero...",
  "pattern_type": "Account Draining"
}
```

### Step 3 — SAR Drafting

If the LLM decides `SUSPICIOUS`, a second LLM call generates a structured Suspicious Activity Report following **FinCEN's who/what/when/where/why/how** narrative structure:

```json
{
  "subject_id": "C1234567890",
  "narrative_of_suspicion": "On step 187 of the simulation, account C1234567890 initiated a TRANSFER of $82,400.00, representing 98.3% of its prior balance of $83,890.12. The destination account recorded a post-transaction balance of $0.00, consistent with a pass-through or mule account used to layer illicit funds...",
  "risk_level": "HIGH",
  "suspicious_activity_type": "Account Draining / Layering",
  "recommended_action": "File SAR with FinCEN. Freeze account pending review. Notify BSA Officer."
}
```

### Step 4 — Validation (The Reveal)

After each transaction is processed, the AI decision is immediately scored against the hidden `isFraud` ground truth:

| Verdict | Meaning |
|---|---|
| **TP** | AI said SUSPICIOUS — actually fraud |
| **FP** | AI said SUSPICIOUS — actually clean |
| **FN** | AI said LOW_RISK — actually fraud |
| **TN** | AI said LOW_RISK — actually clean |

Running **Precision** and **Recall** update live as the pipeline progresses. At completion, the full breakdown including False Positive and False Negative details (with the AI's own reasoning) is surfaced — showing exactly where and why the model was wrong.

---

## API Reference

Base URL: `http://<VM_IP>:8005`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/pipeline/run-async` | Start pipeline in background |
| `GET` | `/pipeline/status` | Poll for progress + live scoreboard |
| `GET` | `/pipeline/results` | Full results once complete |
| `GET` | `/pipeline/sars` | SAR list only |
| `GET` | `/pipeline/validation` | Final metrics only |

### `/pipeline/status` — Live Scoreboard

Poll every 2 seconds. The `cumulative` object updates after every transaction:

```json
{
  "status": "running",
  "step": 2,
  "step_label": "LLM Investigation + SAR Drafting",
  "progress": 12,
  "progress_total": 23,
  "cumulative": {
    "true_positives": 8,
    "false_positives": 3,
    "false_negatives": 1,
    "true_negatives": 0,
    "precision": 0.727,
    "recall": 0.889,
    "sars_generated": 8,
    "completed_transactions": [ ... ]
  }
}
```

---

## Project Structure

```
aml_agent/
├── main.py              # FastAPI app — pipeline orchestration + all endpoints
├── triage.py            # Behavioral triage: intent-based transaction flagging
├── investigator.py      # LLM investigation (GPT-4.1) + SAR drafting
├── validation.py        # Precision/recall + FP/FN breakdown
├── setup_data.py        # One-time Kaggle dataset download
├── requirements.txt
├── start.sh
└── data/
    └── PS_*.csv         # PaySim dataset (downloaded via setup_data.py)
```

---

## Setup

### Prerequisites
- Python 3.11+
- Azure OpenAI access (GPT-4.1 deployment)
- Kaggle account (for dataset download)

### 1. Clone and install

```bash
git clone <repo-url>
cd aml_agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

Create a `.env` file:

```env
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_API_VERSION=2025-01-01-preview
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_api_key
```

### 3. Download the dataset

```bash
python setup_data.py
```

Downloads the PaySim CSV (~470MB) from Kaggle into `data/`.

### 4. Start the backend

```bash
./start.sh
# Server running at http://0.0.0.0:8005
```

### 5. Connect the frontend

Point your Replit (or any) frontend at `http://<your-server-ip>:8005`. The API is CORS-open.

---

## Key Design Decisions

**Rules first, LLM second.** The triage step uses deterministic, auditable logic to pre-filter transactions. The LLM only engages on flagged cases — this bounds cost and keeps the AI's role explainable to regulators. *"We don't let AI decide; we use AI to explain what the rules detected."*

**Blind test design.** The ground truth label is never shown to the LLM. This forces genuine behavioral reasoning rather than label regurgitation, and makes the validation reveal meaningful.

**Two LLM calls per suspicious transaction.** Investigation (reasoning) is separated from SAR drafting (output). This produces better narratives and avoids generating paperwork for low-risk transactions.

**Live cumulative scoring.** Rather than waiting until all transactions are processed, the scoreboard updates in real-time. This makes the demo interactive and shows the model "learning" its own limitations as it goes.

---

## Limitations

| Limitation | Notes |
|---|---|
| PaySim is mobile money, not bank wire transfers | Structuring/layering patterns still apply but channel context differs from Schwab's actual data |
| LLM thresholds not calibrated | Precision/recall numbers are illustrative; production tuning requires labeled historical data |
| No OFAC / PEP identity resolution | Production AML requires cross-referencing watchlists and KYC profiles |
| Stateless pipeline | Results reset on server restart; production needs a database with 5-year SAR retention (SOX) |
| Sequential LLM calls | ~23 transactions × ~2s each ≈ 60–90 seconds total; production would parallelize with rate-limit management |

---

## Built With

- [FastAPI](https://fastapi.tiangolo.com/) — Backend API
- [Azure OpenAI (GPT-4.1)](https://azure.microsoft.com/en-us/products/ai-services/openai-service) — LLM investigation + SAR drafting
- [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1) — Synthetic financial transaction dataset
- [Pandas](https://pandas.pydata.org/) — Data processing and validation metrics
- Replit — Frontend hosting
