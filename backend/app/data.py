"""Data loading. Uses the real Kaggle file if present, else a synthetic stand-in."""
import json
from pathlib import Path
import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
REAL_CSV = DATA_DIR / "creditcard.csv"
SOURCE_INFO = DATA_DIR / "source.json"   # present when the active dataset came from the upload page
V_COLS = [f"V{i}" for i in range(1, 29)]
FEATURES = ["Time", "Amount"] + V_COLS

# Features that separate fraud most in the public dataset (used by the generator)
_SIGNAL = {"V14": -6.0, "V17": -5.5, "V12": -5.0, "V10": -4.5, "V3": -4.0,
           "V16": -3.5, "V7": -3.0, "V11": 3.0, "V4": 3.5, "V2": 2.5}


def generate_synthetic(n=284_807, fraud_rate=0.00173, seed=42) -> pd.DataFrame:
    """Demo data with the same schema as creditcard.csv (NOT real transactions)."""
    rng = np.random.default_rng(seed)
    X = rng.normal(0, 1, size=(n, 28))
    y = (rng.random(n) < fraud_rate).astype(int)
    df = pd.DataFrame(X, columns=V_COLS)
    for c in V_COLS:
        df[c] *= rng.uniform(0.6, 2.0)
    fraud_idx = np.where(y == 1)[0]
    for col, shift in _SIGNAL.items():
        mix = rng.random(len(fraud_idx)) < 0.75  # noisy mixture keeps the problem realistically hard
        df.loc[fraud_idx, col] += np.where(mix, shift * 0.85 * rng.uniform(0.2, 1.0, len(fraud_idx)), 0)
    t = np.sort(rng.uniform(0, 172_792, n))
    amt = np.where(y == 1, rng.lognormal(3.6, 1.6, n), rng.lognormal(3.9, 1.4, n)).round(2)
    df.insert(0, "Time", t.round(0))
    df.insert(29, "Amount", amt)
    df["Class"] = y
    return df


def validate_frame(df: pd.DataFrame):
    """Fail early with a message an analyst can act on (the upload page shows it verbatim)."""
    missing = [c for c in FEATURES + ["Class"] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {', '.join(missing)}. Expected Time, V1..V28, Amount, Class.")
    bad = [c for c in FEATURES + ["Class"] if not pd.api.types.is_numeric_dtype(df[c])]
    if bad:
        raise ValueError(f"Non-numeric values in: {', '.join(bad)}.")
    if df[FEATURES + ["Class"]].isna().any().any():
        raise ValueError("The file has empty cells in required columns.")
    if not set(df["Class"].unique()) <= {0, 1}:
        raise ValueError("Class must contain only 0 (normal) and 1 (fraud).")


def load_data():
    """Returns (dataframe sorted by Time with tx_id, source_label)."""
    if REAL_CSV.exists():
        df = pd.read_csv(REAL_CSV)
        validate_frame(df)
        source = "Kaggle mlg-ulb/creditcardfraud (real data)"
        if SOURCE_INFO.exists():   # written by the upload page
            source = f"Uploaded file: {json.loads(SOURCE_INFO.read_text())['name']}"
    else:
        df = generate_synthetic()
        source = "SYNTHETIC demo data - put creditcard.csv in backend/data/ for real results"
    df = df.sort_values("Time").reset_index(drop=True)
    df.insert(0, "tx_id", np.arange(len(df)))
    return df, source
