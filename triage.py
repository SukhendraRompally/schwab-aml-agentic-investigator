"""
Behavioral triage: intent-based transaction flagging.
Goes beyond static dollar thresholds — detects account-clearing patterns.
"""
import glob
import os
from pathlib import Path

import pandas as pd


CSV_GLOB = str(Path(__file__).parent / "data" / "PS_*.csv")

# Columns sent to LLM (isFraud + isFlaggedFraud are stripped — blind test)
BLIND_COLUMNS = [
    "step", "type", "amount",
    "nameOrig", "oldbalanceOrg", "newbalanceOrig",
    "nameDest", "oldbalanceDest", "newbalanceDest",
]


def find_csv() -> str:
    matches = glob.glob(CSV_GLOB)
    if not matches:
        raise FileNotFoundError(
            "PaySim CSV not found. Run: python setup_data.py"
        )
    return matches[0]


def load_sample(
    csv_path: str | None = None,
    n: int = 500,
    min_fraud: int = 20,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Load a stratified sample of n rows from PaySim CSV.
    Guarantees at least min_fraud rows with isFraud==1.

    Returns:
        df_blind:      DataFrame with isFraud/isFlaggedFraud removed (for LLM)
        ground_truth:  Series of isFraud values aligned to df_blind's index
    """
    if csv_path is None:
        csv_path = find_csv()

    full = pd.read_csv(csv_path)

    fraud_rows = full[full["isFraud"] == 1]
    clean_rows = full[full["isFraud"] == 0]

    # Sample fraud rows (use all if fewer than min_fraud)
    n_fraud = min(min_fraud, len(fraud_rows))
    n_clean = n - n_fraud

    sampled_fraud = fraud_rows.sample(n=n_fraud, random_state=seed)
    sampled_clean = clean_rows.sample(n=n_clean, random_state=seed)

    combined = pd.concat([sampled_fraud, sampled_clean]).sample(
        frac=1, random_state=seed
    ).reset_index(drop=True)

    ground_truth = combined["isFraud"].copy()

    df_blind = combined[BLIND_COLUMNS].copy()
    df_blind.index = combined.index  # preserve alignment

    return df_blind, ground_truth


def flag_transactions(df: pd.DataFrame) -> pd.DataFrame:
    """
    Intent-based behavioral triage. Flags transactions where ALL of:
      1. type in ('TRANSFER', 'CASH_OUT')          — high-risk transaction types
      2. amount > 0.9 * oldbalanceOrg               — draining >90% of origin account
      3. newbalanceDest == 0                         — destination account completely cleared

    This catches account-clearing patterns that a simple amount threshold misses.
    Returns flagged rows with a 'flag_reason' column appended.
    """
    mask = (
        df["type"].isin(["TRANSFER", "CASH_OUT"])
        & (df["amount"] > 0.9 * df["oldbalanceOrg"])
        & (df["oldbalanceOrg"] > 0)          # exclude already-empty source accounts
        & (df["newbalanceDest"] == 0)
    )

    flagged = df[mask].copy()
    flagged["flag_reason"] = (
        "TRANSFER/CASH_OUT draining >"
        + (df.loc[mask, "amount"] / df.loc[mask, "oldbalanceOrg"] * 100)
        .round(1)
        .astype(str)
        + "% of origin balance; destination balance zeroed"
    )
    return flagged


def triage_summary(flagged: pd.DataFrame, total: int) -> dict:
    return {
        "total_sampled": total,
        "flagged_count": len(flagged),
        "flag_rate_pct": round(len(flagged) / total * 100, 1),
        "by_type": flagged["type"].value_counts().to_dict(),
    }
