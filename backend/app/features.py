"""Leakage-free feature pipeline: row-wise features + a scaler fitted on TRAIN only."""
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, FunctionTransformer
from .data import V_COLS

MODEL_COLS = V_COLS + ["log_amount", "hour_sin", "hour_cos"]


def add_features(X: pd.DataFrame) -> pd.DataFrame:
    X = X.copy()
    X["log_amount"] = np.log1p(X["Amount"])
    hour = (X["Time"] // 3600) % 24
    X["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    X["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    return X[MODEL_COLS]


def make_preprocessor():
    return Pipeline([
        ("feat", FunctionTransformer(add_features)),
        ("scale", StandardScaler()),
    ])


def fit_calibrator(y_oof, d_oof):
    """Platt scaling on out-of-fold raw log-odds (training period only)."""
    from sklearn.linear_model import LogisticRegression
    return LogisticRegression(C=1e4, max_iter=1000).fit(np.asarray(d_oof).reshape(-1, 1), y_oof)


def calibrate(cal, d_raw):
    return cal.predict_proba(np.asarray(d_raw, dtype=float).reshape(-1, 1))[:, 1]
