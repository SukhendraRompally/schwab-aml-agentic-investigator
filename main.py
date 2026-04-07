"""
FastAPI backend for the Schwab AI.x AML Agentic Investigator.
Exposes a 4-step pipeline via async endpoints for the Replit frontend.

Pipeline: triage → per-transaction LLM investigation + SAR draft → live cumulative validation.
"""
import time
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from investigator import investigate_transaction, draft_sar
from triage import flag_transactions, load_sample, triage_summary
from validation import compute_metrics

# ---------------------------------------------------------------------------
# In-memory pipeline state
# ---------------------------------------------------------------------------

_state: dict = {
    "status": "idle",           # idle | running | done | error
    "step": 0,                  # 1=triage, 2=investigating+SAR, 3=done
    "step_label": "",
    "progress": 0,              # transactions completed so far
    "progress_total": 0,        # total flagged transactions
    "error": None,
    # Live cumulative scoreboard — updated after every transaction
    "cumulative": {
        "true_positives": 0,
        "false_positives": 0,
        "false_negatives": 0,
        "true_negatives": 0,
        "precision": None,
        "recall": None,
        "sars_generated": 0,
        "completed_transactions": [],   # grows as each txn finishes
    },
    "results": None,            # full results dict once done
}


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Schwab AI.x — AML Agentic Investigator", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Background pipeline task
# ---------------------------------------------------------------------------

def _run_pipeline():
    global _state

    try:
        # ── Step 1: Load sample + behavioral triage ──────────────────────────
        _state["step"] = 1
        _state["step_label"] = "Behavioral Triage"

        blind_df, ground_truth = load_sample(n=100, min_fraud=20)
        flagged = flag_transactions(blind_df)
        summary = triage_summary(flagged, total=len(blind_df))

        if len(flagged) == 0:
            _state["status"] = "error"
            _state["error"] = "No transactions flagged by triage. Check dataset."
            return

        # Pre-build ground truth lookup keyed by (nameOrig, amount)
        # so we can score each result immediately after it comes back
        gt_lookup: dict[tuple, int] = {}
        for idx in flagged.index:
            key = (flagged.loc[idx, "nameOrig"], flagged.loc[idx, "amount"])
            gt_lookup[key] = int(ground_truth.loc[idx])

        _state["progress_total"] = len(flagged)
        _state["step"] = 2
        _state["step_label"] = "LLM Investigation + SAR Drafting"

        # Reset cumulative scoreboard
        _state["cumulative"] = {
            "true_positives": 0,
            "false_positives": 0,
            "false_negatives": 0,
            "true_negatives": 0,
            "precision": None,
            "recall": None,
            "sars_generated": 0,
            "completed_transactions": [],
        }

        all_results = []
        rows = flagged.to_dict(orient="records")

        # ── Step 2: Per-transaction LLM investigation ─────────────────────────
        for i, txn in enumerate(rows):
            # --- LLM call 1: investigate ---
            investigation = investigate_transaction(txn)

            # --- LLM call 2: draft SAR if suspicious ---
            sar = None
            if investigation["ai_decision"] == "SUSPICIOUS":
                time.sleep(0.3)
                sar = draft_sar(txn, investigation)

            all_results.append({"txn": txn, "investigation": investigation, "sar": sar})

            # --- Score this transaction immediately against ground truth ---
            key = (txn.get("nameOrig"), txn.get("amount"))
            actual_fraud = gt_lookup.get(key, 0)
            ai_suspicious = investigation["ai_decision"] == "SUSPICIOUS"

            c = _state["cumulative"]
            if ai_suspicious and actual_fraud:
                c["true_positives"] += 1
            elif ai_suspicious and not actual_fraud:
                c["false_positives"] += 1
            elif not ai_suspicious and actual_fraud:
                c["false_negatives"] += 1
            else:
                c["true_negatives"] += 1

            if sar:
                c["sars_generated"] += 1

            # Running precision & recall (avoid div-by-zero)
            tp, fp, fn = c["true_positives"], c["false_positives"], c["false_negatives"]
            c["precision"] = round(tp / (tp + fp), 3) if (tp + fp) > 0 else None
            c["recall"] = round(tp / (tp + fn), 3) if (tp + fn) > 0 else None

            # Append this transaction's result to the live list
            c["completed_transactions"].append({
                "nameOrig": txn.get("nameOrig"),
                "amount": txn.get("amount"),
                "type": txn.get("type"),
                "ai_decision": investigation["ai_decision"],
                "risk_level": investigation["risk_level"],
                "pattern_type": investigation["pattern_type"],
                "behavioral_reasoning": investigation["behavioral_reasoning"],
                "actual_fraud": actual_fraud,
                "verdict": (
                    "TP" if ai_suspicious and actual_fraud else
                    "FP" if ai_suspicious and not actual_fraud else
                    "FN" if not ai_suspicious and actual_fraud else
                    "TN"
                ),
                "has_sar": sar is not None,
                "sar_report_id": sar["report_id"] if sar else None,
            })

            _state["progress"] = i + 1

            if i < len(rows) - 1:
                time.sleep(0.5)

        # ── Step 3: Final validation metrics ─────────────────────────────────
        _state["step"] = 3
        _state["step_label"] = "Complete"

        metrics = compute_metrics(flagged, all_results, ground_truth)

        sars = [
            {"txn": r["txn"], **r["sar"]}
            for r in all_results
            if r["sar"] is not None
        ]

        _state["results"] = {
            "triage_summary": summary,
            "flagged_transactions": _state["cumulative"]["completed_transactions"],
            "sars": sars,
            "validation": metrics,
        }
        _state["status"] = "done"

    except Exception as exc:
        _state["status"] = "error"
        _state["error"] = str(exc)
        raise


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "AML Agentic Investigator"}


@app.get("/pipeline/status")
def pipeline_status():
    """
    Poll every 2 seconds while running.
    Returns live cumulative scoreboard so the UI can update in real-time.
    """
    return {
        "status": _state["status"],
        "step": _state["step"],
        "step_label": _state["step_label"],
        "progress": _state["progress"],
        "progress_total": _state["progress_total"],
        "error": _state["error"],
        "cumulative": _state["cumulative"],
    }


@app.post("/pipeline/run-async")
def run_pipeline_async(background_tasks: BackgroundTasks):
    """Kick off pipeline in background. Poll /pipeline/status, then fetch /pipeline/results."""
    if _state["status"] == "running":
        raise HTTPException(status_code=409, detail="Pipeline already running.")

    _state.update({
        "status": "running",
        "step": 0,
        "step_label": "Starting...",
        "progress": 0,
        "progress_total": 0,
        "error": None,
        "results": None,
        "cumulative": {
            "true_positives": 0,
            "false_positives": 0,
            "false_negatives": 0,
            "true_negatives": 0,
            "precision": None,
            "recall": None,
            "sars_generated": 0,
            "completed_transactions": [],
        },
    })

    background_tasks.add_task(_run_pipeline)
    return {"status": "started", "message": "Pipeline running. Poll /pipeline/status for updates."}


@app.post("/pipeline/run")
def run_pipeline_sync():
    """Synchronous run — blocks until complete. Use for testing."""
    if _state["status"] == "running":
        raise HTTPException(status_code=409, detail="Pipeline already running.")

    _state.update({
        "status": "running",
        "step": 0,
        "step_label": "Starting...",
        "progress": 0,
        "progress_total": 0,
        "error": None,
        "results": None,
        "cumulative": {
            "true_positives": 0,
            "false_positives": 0,
            "false_negatives": 0,
            "true_negatives": 0,
            "precision": None,
            "recall": None,
            "sars_generated": 0,
            "completed_transactions": [],
        },
    })

    _run_pipeline()
    return _state["results"]


@app.get("/pipeline/results")
def pipeline_results():
    """Fetch full results once /pipeline/status shows status=done."""
    if _state["status"] == "idle":
        raise HTTPException(status_code=404, detail="No pipeline has been run yet.")
    if _state["status"] == "running":
        raise HTTPException(status_code=202, detail="Pipeline still running.")
    if _state["status"] == "error":
        raise HTTPException(status_code=500, detail=_state["error"])
    return _state["results"]


@app.get("/pipeline/sars")
def list_sars():
    if _state["results"] is None:
        raise HTTPException(status_code=404, detail="No results yet.")
    return {"sars": _state["results"]["sars"]}


@app.get("/pipeline/validation")
def get_validation():
    if _state["results"] is None:
        raise HTTPException(status_code=404, detail="No results yet.")
    return _state["results"]["validation"]
