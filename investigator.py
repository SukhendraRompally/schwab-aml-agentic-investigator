"""
LLM-powered AML investigation and SAR drafting.

Two-call design:
  1. investigate_transaction() — blind analysis, returns reasoning + decision
  2. draft_sar()              — structured SAR only for SUSPICIOUS transactions
"""
import json
import os
import time
import uuid
from datetime import datetime, timezone

import pandas as pd
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

_client: AzureOpenAI | None = None


def _get_client() -> AzureOpenAI:
    global _client
    if _client is None:
        _client = AzureOpenAI(
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
        )
    return _client


DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")

INVESTIGATOR_SYSTEM = """You are a Senior Schwab AML Investigator. Analyze the following transaction metadata for patterns of 'Structuring' or 'Layering'. Do not just state if it is fraud; explain the behavioral reasoning behind your decision.

Focus on:
- Balance shift patterns (origin drained, destination zeroed)
- Transaction type and channel risk profile
- Whether the amounts and timing suggest deliberate obfuscation

Respond ONLY with a valid JSON object — no markdown, no explanation outside the JSON."""

INVESTIGATOR_USER = """Transaction metadata:
{transaction_json}

Respond in this exact JSON format:
{{
  "ai_decision": "SUSPICIOUS" or "LOW_RISK",
  "risk_level": "HIGH" or "MEDIUM" or "LOW",
  "behavioral_reasoning": "<2-3 sentences explaining the specific balance shifts and why this pattern is or is not suspicious>",
  "pattern_type": "Structuring" or "Layering" or "Account Draining" or "None"
}}"""

SAR_SYSTEM = """You are a BSA Compliance Officer at Schwab preparing a Suspicious Activity Report (SAR). Write professional, factual SAR narratives that cite specific dollar amounts and balance movements.

Respond ONLY with a valid JSON object — no markdown, no explanation outside the JSON."""

SAR_USER = """Generate a SAR report for this suspicious transaction.

Transaction data:
{transaction_json}

Investigation findings:
- Pattern identified: {pattern_type}
- Risk level: {risk_level}
- Investigator reasoning: {reasoning}

Respond in this exact JSON format:
{{
  "subject_id": "<nameOrig from the transaction>",
  "narrative_of_suspicion": "<150-200 word SAR narrative citing specific amounts, the origin balance of ${old_balance}, amount transferred ${amount}, and destination balance zeroing. Follow FinCEN who/what/when/where/why/how structure>",
  "risk_level": "{risk_level}",
  "suspicious_activity_type": "<primary typology>",
  "recommended_action": "<e.g. File SAR with FinCEN. Monitor account for 90 days. Notify BSA Officer.>"
}}"""


def investigate_transaction(txn: dict) -> dict:
    """
    Send a single transaction to the LLM for blind AML analysis.
    isFraud/isFlaggedFraud must NOT be present in txn.

    Returns dict with keys: ai_decision, risk_level, behavioral_reasoning, pattern_type
    """
    txn_json = json.dumps(txn, indent=2, default=str)
    user_msg = INVESTIGATOR_USER.format(transaction_json=txn_json)

    response = _get_client().chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": INVESTIGATOR_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    result = json.loads(response.choices[0].message.content)
    # Normalize decision field to avoid case issues
    result["ai_decision"] = result.get("ai_decision", "LOW_RISK").upper().replace(" ", "_")
    if result["ai_decision"] not in ("SUSPICIOUS", "LOW_RISK"):
        result["ai_decision"] = "LOW_RISK"
    return result


def draft_sar(txn: dict, investigation: dict) -> dict:
    """
    Generate a structured SAR report for a transaction already flagged SUSPICIOUS.

    Returns dict with SAR fields including narrative_of_suspicion.
    """
    txn_json = json.dumps(txn, indent=2, default=str)
    user_msg = SAR_USER.format(
        transaction_json=txn_json,
        pattern_type=investigation.get("pattern_type", "Unknown"),
        risk_level=investigation.get("risk_level", "HIGH"),
        reasoning=investigation.get("behavioral_reasoning", ""),
        old_balance=txn.get("oldbalanceOrg", 0),
        amount=txn.get("amount", 0),
    )

    response = _get_client().chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": SAR_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    sar = json.loads(response.choices[0].message.content)
    sar["report_id"] = f"SAR-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    sar["generated_at"] = datetime.now(timezone.utc).isoformat()
    return sar


def run_investigation_batch(
    flagged_df: pd.DataFrame,
    progress_callback=None,
) -> list[dict]:
    """
    Investigate all flagged transactions sequentially.
    Generates SARs for SUSPICIOUS results.

    progress_callback(current, total) called after each transaction.

    Returns list of result dicts, one per flagged transaction, with keys:
      - txn: original transaction dict
      - investigation: LLM investigation output
      - sar: SAR dict (only if SUSPICIOUS, else None)
    """
    results = []
    rows = flagged_df.to_dict(orient="records")
    total = len(rows)

    for i, txn in enumerate(rows):
        investigation = investigate_transaction(txn)

        sar = None
        if investigation["ai_decision"] == "SUSPICIOUS":
            time.sleep(0.3)  # small gap between the two calls
            sar = draft_sar(txn, investigation)

        results.append({
            "txn": txn,
            "investigation": investigation,
            "sar": sar,
        })

        if progress_callback:
            progress_callback(i + 1, total)

        # Rate-limit: ~0.5s between transactions
        if i < total - 1:
            time.sleep(0.5)

    return results
