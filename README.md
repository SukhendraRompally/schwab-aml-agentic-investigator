# AML Agentic Investigator

A prototype demonstrating how Generative AI shifts Anti-Money Laundering operations from **rigid rule-based alerts** to **agentic risk reasoning**. Built as a proof-of-concept for financial services Risk organizations.

**Live demo:** [aml-agent.replit.app](https://aml-agent.replit.app)

---

## The Problem

AML analysts at financial institutions face a daily triage of 50–100 transaction alerts, of which **90%+ are false positives**. Writing a single Suspicious Activity Report (SAR) by hand takes 45–90 minutes. Missed SARs carry civil penalties up to $1M per violation under the Bank Secrecy Act.

Traditional rule-based systems flag transactions by static thresholds (e.g. `amount > $10,000`). They tell analysts **what** happened — not **why** it looks suspicious.

---

## What We Built

A 4-step agentic pipeline that mirrors how a real AML investigator thinks:

```
Step 1: Behavioral Triage     → 5 intent-based rules across 4 AML typologies
Step 2: LLM Investigation     → Blind GPT-4.1 analysis per flagged transaction
Step 3: SAR Drafting          → Structured FinCEN-format report for SUSPICIOUS cases
Step 4: Validation Reveal     → Live TP/FP/FN/TN scored against hidden ground truth
```

The scoreboard updates **after every single transaction** — not just at the end — so you can watch precision and recall build in real time.

---

## Architecture

```
┌─────────────────────────────────┐        ┌──────────────────────────┐
│     Replit Frontend             │        │   Azure VM Backend       │
│  (HTML / JS / React)            │◄──────►│   FastAPI on port 8005   │
│                                 │  HTTP  │                          │
│  • Progress bar                 │        │  triage.py               │
│  • Live TP/FP/FN/TN scoreboard  │        │  investigator.py         │
│  • Transaction feed w/ verdicts │        │  validation.py           │
│  • SAR viewer                   │        │  main.py                 │
└─────────────────────────────────┘        └────────────┬─────────────┘
                                                        │
                                           ┌────────────▼─────────────┐
                                           │   Azure OpenAI (GPT-4.1) │
                                           │   2 calls per transaction │
                                           │   1. Investigate (blind)  │
                                           │   2. Draft SAR            │
                                           └──────────────────────────┘
```

**Backend** — FastAPI on an Azure VM, CORS-open REST API.
**Frontend** — Replit, polls the backend every 2 seconds for live updates.
**LLM** — Azure OpenAI GPT-4.1. The `isFraud` label is never shown to the model (genuine blind test).

---

## Dataset

**PaySim Synthetic Financial Dataset** — [Kaggle: ealaxi/paysim1](https://www.kaggle.com/datasets/ealaxi/paysim1)

PaySim simulates mobile money transactions based on real anonymized data. It includes a labeled `isFraud` column used **only for validation** — never shown to the LLM.

| Field | Description |
|---|---|
| `type` | CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER |
| `amount` | Transaction amount |
| `nameOrig` | Origin account ID |
| `oldbalanceOrg` / `newbalanceOrig` | Origin balance before/after |
| `nameDest` | Destination account ID |
| `oldbalanceDest` / `newbalanceDest` | Destination balance before/after |
| `isFraud` | Ground truth label (hidden from LLM) |

The pipeline samples **100 rows** with at least 20 fraud cases guaranteed via stratified sampling across all transaction types.

---

## Step-by-Step Pipeline

### Step 1 — Behavioral Triage

Five rules detect different AML typologies. Each contributes a capped number of samples to ensure variety across the flagged set:

| Rule | Typology | Condition | Cap | Precision |
|---|---|---|---|---|
| `ACCOUNT_DRAINING` | Layering / Pass-Through | TRANSFER or CASH_OUT draining >90% of origin, destination zeroed | 5 | ~100% |
| `LARGE_TRANSFER` | Wire Fraud / Large-Scale Layering | TRANSFER ≥$500k clearing both origin and destination to $0 | 5 | ~89% |
| `HIGH_VALUE_CASHOUT` | Cash Placement | CASH_OUT ≥$1M fully clearing origin account | 5 | ~82% |
| `MID_TRANSFER_STRUCTURING` | Structuring | TRANSFER $50k–$500k clearing both accounts — below high-value monitoring thresholds | 5 | ~75% |
| `MODERATE_CASHOUT` | Suspicious Withdrawal | CASH_OUT $200k–$999k clearing origin — intentionally broader to surface realistic FPs | 2 | ~30–40% |

The last rule is **intentionally less precise** to produce 1–2 false positives, demonstrating that the system still requires human review.

Each flagged transaction carries a `flag_reason` explaining which behavioral signal was detected. This is injected into the LLM prompt so it reasons about the specific pattern, not just a generic "suspicious transaction."

### Step 2 — LLM Investigation (Blind Test)

Each flagged transaction is sent to GPT-4.1 as a **Senior AML Investigator**. The `isFraud` and `isFlaggedFraud` columns are stripped — this is a genuine blind test.

The model reasons about balance shift patterns, transaction type risk, and which AML typology applies:

```json
{
  "ai_decision": "SUSPICIOUS" | "LOW_RISK",
  "risk_level": "HIGH" | "MEDIUM" | "LOW",
  "behavioral_reasoning": "The origin account was completely drained in a single TRANSFER...",
  "pattern_type": "Layering" | "Structuring" | "Account Draining" | "Cash Placement"
}
```

### Step 3 — SAR Drafting

For every `SUSPICIOUS` decision, a second LLM call drafts a Suspicious Activity Report following **FinCEN's who/what/when/where/why/how** narrative structure:

```json
{
  "subject_id": "C1234567890",
  "narrative_of_suspicion": "Account C1234567890 initiated a TRANSFER of $273,821.76 that fully cleared the origin balance to $0. The destination account also recorded a post-transaction balance of $0, consistent with a pass-through account used to layer illicit funds...",
  "risk_level": "HIGH",
  "suspicious_activity_type": "Structuring / Below-Threshold Layering",
  "recommended_action": "File SAR with FinCEN. Freeze account pending review. Notify BSA Officer."
}
```

### Step 4 — Validation (The Reveal)

After each LLM decision, the result is immediately scored against the hidden `isFraud` ground truth and added to a live cumulative scoreboard.

**The full 2×2 confusion matrix accounts for all 100 sampled transactions:**

```
                     Actually Fraud    Actually Clean
  AI: SUSPICIOUS          TP                FP       ← flagged + LLM positive
  AI: LOW_RISK            FN                TN       ← flagged + LLM negative
  Not flagged (fraud)     FN baseline       —        ← triage missed these
  Not flagged (clean)     —                 TN baseline ← correctly ignored
```

- **TN baseline** (~78): Unflagged transactions that are actually clean — seeded at triage time, before LLM runs
- **FN baseline** (~8): Fraud transactions triage missed entirely — surfaces the blind spots in the rules
- **FP** (~2): Transactions the AI flagged as suspicious but are actually clean — the `MODERATE_CASHOUT` rule deliberately produces these
- **TP** (~12): Correctly identified fraud

Typical run results: **Precision ~86%, Recall ~60%, F1 ~71%**

---

## Confusion Matrix Explained

| Metric | Formula | AML Meaning |
|---|---|---|
| **Precision** | TP / (TP + FP) | When AI raises an alarm, how often is it right? |
| **Recall** | TP / (TP + FN) | Of all real fraud, how much did we catch? |
| **F1** | 2 × P × R / (P + R) | Balanced score — punishes if either metric is low |

In AML, **Recall is typically prioritized** — missing fraud is worse than a false alarm. But low precision causes analyst fatigue. This system makes that trade-off explicit and visible.

---

## API Reference

Base URL: `http://<VM_IP>:8005`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/pipeline/run-async` | Start pipeline in background, returns immediately |
| `GET` | `/pipeline/status` | Poll every 2s — returns live scoreboard + per-transaction feed |
| `GET` | `/pipeline/results` | Full results once `status === "done"` |
| `GET` | `/pipeline/sars` | SAR list only |
| `GET` | `/pipeline/validation` | Final precision/recall/F1 + FP/FN details |

### `/pipeline/status` response shape

```json
{
  "status": "running",
  "step": 2,
  "step_label": "LLM Investigation + SAR Drafting",
  "progress": 8,
  "progress_total": 14,
  "cumulative": {
    "true_positives": 7,
    "false_positives": 0,
    "false_negatives": 8,
    "true_negatives": 78,
    "precision": 1.0,
    "recall": 0.467,
    "sars_generated": 7,
    "completed_transactions": [
      {
        "nameOrig": "C1515790640",
        "amount": 1390332.39,
        "type": "CASH_OUT",
        "rule": "HIGH_VALUE_CASHOUT",
        "flag_reason": "CASH_OUT of $1390332.39 (≥$1M) fully cleared origin...",
        "ai_decision": "SUSPICIOUS",
        "risk_level": "HIGH",
        "pattern_type": "Account Draining",
        "behavioral_reasoning": "The origin account was completely drained...",
        "actual_fraud": 1,
        "verdict": "TP",
        "has_sar": true,
        "sar_report_id": "SAR-20260407-68B0C3"
      }
    ]
  }
}
```

**Note:** `true_negatives` and `false_negatives` are seeded from unflagged transactions at triage time, so they are non-zero from the very first poll.

---

## Project Structure

```
aml_agent/
├── main.py           # FastAPI — pipeline orchestration, all endpoints, live scoreboard
├── triage.py         # 5 behavioral triage rules across 4 AML typologies
├── investigator.py   # LLM investigation (GPT-4.1 blind test) + SAR drafting
├── validation.py     # Precision/recall/F1 + FP/FN breakdown with AI reasoning
├── setup_data.py     # One-time Kaggle dataset download
├── requirements.txt
├── start.sh          # uvicorn main:app --host 0.0.0.0 --port 8005
└── data/
    └── PS_*.csv      # PaySim dataset (downloaded via setup_data.py, gitignored)
```

---

## Setup

### Prerequisites
- Python 3.11+
- Azure OpenAI access (GPT-4.1 deployment)
- Kaggle account (for dataset download)

### 1. Clone and install

```bash
git clone https://github.com/SukhendraRompally/aml-agentic-investigator.git
cd aml-agentic-investigator
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
# Downloads PaySim CSV (~470MB) into data/
```

### 4. Start the backend

```bash
./start.sh
# API live at http://0.0.0.0:8005
```

### 5. Connect the frontend

Point your frontend at `http://<your-server-ip>:8005`. The API is CORS-open for all origins.

---

## Product Design Decisions & Tradeoffs

**Rules-first, LLM-second.**
The most consequential architectural decision in this system. Rather than sending all transactions to the LLM, deterministic triage rules reduce the surface area to a manageable flagged set before any model is invoked. At production scale — millions of transactions daily — LLM calls on everything would be economically untenable and operationally impractical. Beyond cost and latency, there is a regulatory dimension: examiners expect explainable, auditable logic behind AML decisions. "Our AI flagged it" is unlikely to be an acceptable SAR justification. "Rule `ACCOUNT_DRAINING` triggered based on a defined behavioral condition, then the AI explained the specific pattern" is a more defensible audit trail.

**Two-call LLM architecture.**
Investigation and SAR drafting are intentionally separated into two distinct LLM calls rather than combined into a single prompt. A single prompt asking the model to simultaneously analyze a transaction and produce a FinCEN-format narrative tends to produce generic output — the model splits attention between reasoning and writing. Separating the calls means the first produces structured analytical reasoning, and the second writes the SAR narrative using that reasoning as explicit input. The quality of SAR narratives is meaningfully better, and the cost of the additional call is justified given these are externally submitted compliance documents.

**Threshold calibration.**
Triage thresholds ($1M for `CASH_OUT`, $500k for `TRANSFER`) were derived empirically from PaySim's fraud distribution, not set arbitrarily. Lowering thresholds increases recall but causes flagged volume to grow unsustainably — analyst workload scales with false positives, not true ones. Raising thresholds reduces noise but allows smaller-value fraud to pass through. In production, thresholds should be calibrated against institutional historical data and tuned continuously as fraud patterns evolve.

**Precision vs. Recall tension.**
This system is optimized toward higher recall — catching more fraud — even at the cost of some false alarms. This is as much a business and compliance decision as a technical one. An institution with a large compliance team may accept lower precision to maximize fraud detection. A smaller institution with limited analyst capacity may need the inverse. The system makes this trade-off explicit and visible through the live confusion matrix, rather than hiding it behind a single accuracy number.

**Explainability over probabilistic scoring.**
The LLM returns narrative reasoning rather than a fraud probability score. A output like "fraud probability: 94%" cannot be submitted in a SAR. A narrative that states "this transaction drained 100% of the origin account via TRANSFER and the destination balance was immediately zeroed, consistent with pass-through layering behavior" can. In AML compliance, explainability is not a product preference — it is a regulatory requirement. The system is designed around that constraint from the ground up.

---

## Production Roadmap

### V2 — Identity Resolution Layer
The current prototype evaluates account behavior in isolation. Production AML requires cross-referencing against external data sources: OFAC SDN watchlists, PEP (Politically Exposed Person) databases, internal KYC profiles, and beneficial ownership records. A $2M transfer carries very different risk depending on whether the account holder is a registered import/export firm or an individual retail customer. An identity resolution layer would enrich each flagged transaction before LLM analysis, enabling more contextually accurate risk decisions.

### V2 — Full Account Context
Every transaction is currently evaluated as a standalone event. Production systems should feed the LLM a full behavioral window — 30, 60, or 90 days of account history. A single $200k transfer appears suspicious in isolation; it appears routine if that account has executed $200k transfers consistently for two years. Context window depth directly affects both precision and the quality of SAR narratives.

### V3 — Network Graph Analysis
Money laundering is structurally a network problem. The same funds typically move through 5–10 accounts before reaching their destination. A graph layer connecting accounts by transaction history would enable detection of account clusters controlled by the same beneficial owner, hub accounts receiving from many sources and distributing to many destinations, and multi-hop layering chains invisible to per-transaction analysis. LLMs can reason over graph summaries in natural language in ways that rule-based systems fundamentally cannot.

### V3 — RAG over Regulatory Corpus
The current LLM relies solely on pre-training knowledge. A production system should maintain a vector store of FinCEN SAR activity reviews, FATF typology reports, internal historical SARs, and institution-specific red flag indicators. Retrieval-augmented generation would allow the model to ground its reasoning in specific regulatory precedents — producing outputs such as "this pattern matches typology X from FinCEN's 2024 report on crypto-to-cash schemes" — significantly increasing confidence and auditability of AI-generated narratives.

### V3 — Multi-Turn Agentic Investigation
Rather than a single LLM call per transaction, the system can be extended into an agentic loop where the model requests additional context mid-investigation: pulling 90-day account history, looking up the counterparty, checking whether the destination account appears in other suspicious clusters. This iterative approach enables more confident decisions and richer SAR narratives, particularly for borderline cases that a single-pass analysis cannot resolve.

### V4 — Feedback Loop & Active Learning
Analyst decisions should feed back into rule and threshold refinement over time. When an analyst overrides the AI — marking a LOW_RISK transaction as fraud, or clearing a SUSPICIOUS flag — that signal should update triage thresholds and inform future model behavior. This is the mechanism by which the system improves with institutional knowledge rather than remaining static after deployment.

### V4 — Human-in-the-Loop Case Management
A production analyst interface would include: one-click accept/reject of AI decisions with mandatory reasoning capture, case notes and evidence attachment, escalation routing from junior analyst to senior reviewer to BSA officer, case status tracking (open / in-review / escalated / filed / closed), and SLA monitoring with breach alerting. The AI layer reduces analyst workload; the case management layer ensures institutional accountability over every decision.

### V4 — SAR Workflow & Regulatory Integration
The current prototype produces a SAR draft as structured JSON. A production workflow would route the draft through a multi-stage compliance officer review, submit directly to FinCEN's BSA E-Filing System via API, maintain a tamper-evident 5-year audit trail per BSA retention requirements, and optionally trigger downstream actions such as account freeze, enhanced transaction monitoring, or referral to law enforcement liaisons.

---

## Built With

- [FastAPI](https://fastapi.tiangolo.com/) — Backend API
- [Azure OpenAI (GPT-4.1)](https://azure.microsoft.com/en-us/products/ai-services/openai-service) — LLM investigation + SAR drafting
- [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1) — Synthetic financial transaction dataset
- [Pandas](https://pandas.pydata.org/) — Data processing and validation metrics
- [Replit](https://replit.com) — Frontend hosting
