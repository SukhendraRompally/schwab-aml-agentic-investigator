"""
Validation dashboard: compares LLM decisions against hidden ground truth.
Computes precision, recall, and produces FP/FN breakdowns with AI reasoning.
"""
import pandas as pd


def compute_metrics(
    flagged_df: pd.DataFrame,
    results: list[dict],
    ground_truth: pd.Series,
) -> dict:
    """
    Compare AI decisions against isFraud ground truth.

    The LLM only sees flagged transactions, so:
      - Unflagged transactions are treated as TRUE NEGATIVES by the triage rule (not evaluated by LLM).
      - Among flagged transactions: SUSPICIOUS = positive prediction, LOW_RISK = negative prediction.

    Args:
        flagged_df:   DataFrame of flagged transactions (triage output)
        results:      List of investigation result dicts from run_investigation_batch()
        ground_truth: Full ground truth Series (all 500 sampled rows, isFraud values)

    Returns dict with precision, recall, counts, FP details, FN details.
    """
    # Build per-transaction records for flagged rows
    records = []
    for r in results:
        txn = r["txn"]
        inv = r["investigation"]
        sar = r["sar"]

        # Match back to ground truth by nameOrig + amount
        orig = txn.get("nameOrig")
        amount = txn.get("amount")
        matches = ground_truth[
            (flagged_df["nameOrig"] == orig) & (flagged_df["amount"] == amount)
        ]
        actual_fraud = int(matches.iloc[0]) if len(matches) > 0 else 0

        records.append({
            "nameOrig": orig,
            "amount": amount,
            "type": txn.get("type"),
            "ai_decision": inv["ai_decision"],
            "risk_level": inv["risk_level"],
            "pattern_type": inv["pattern_type"],
            "behavioral_reasoning": inv["behavioral_reasoning"],
            "actual_fraud": actual_fraud,
            "has_sar": sar is not None,
            "sar_report_id": sar["report_id"] if sar else None,
        })

    df = pd.DataFrame(records)

    # Confusion matrix components (among flagged transactions only)
    ai_positive = df["ai_decision"] == "SUSPICIOUS"
    actually_fraud = df["actual_fraud"] == 1

    tp = int((ai_positive & actually_fraud).sum())
    fp = int((ai_positive & ~actually_fraud).sum())
    fn = int((~ai_positive & actually_fraud).sum())
    tn = int((~ai_positive & ~actually_fraud).sum())

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    # FP details: AI said SUSPICIOUS but actually clean
    fp_details = df[ai_positive & ~actually_fraud][[
        "nameOrig", "amount", "type", "pattern_type", "behavioral_reasoning"
    ]].to_dict(orient="records")

    # FN details: AI said LOW_RISK but actually fraud
    fn_details = df[~ai_positive & actually_fraud][[
        "nameOrig", "amount", "type", "pattern_type", "behavioral_reasoning"
    ]].to_dict(orient="records")

    return {
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negatives": tn,
        "total_flagged": len(df),
        "sars_generated": int(df["has_sar"].sum()),
        "false_positive_details": fp_details,
        "false_negative_details": fn_details,
        "all_results": df.to_dict(orient="records"),
    }
