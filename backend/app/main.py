"""FraudLens API.  Run:  uvicorn app.main:app --reload --port 8000"""
import csv
import io
import json
import os
import tempfile
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))   # project root, so `chatbot` is importable
from chatbot.backend.router import router as chat_router      # noqa: E402  (also loads .env)
from .data import FEATURES
from .features import MODEL_COLS, calibrate
from .dataset import router as data_router, on_retrained
from .explain import top_reasons, top_signals, tier, analyst_note, draft_message, signal_details, why_flagged

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "artifacts"
ON_VERCEL = bool(os.getenv("VERCEL"))   # serverless: read-only disk except /tmp
AUDIT = Path(tempfile.gettempdir(), "audit_log.jsonl") if ON_VERCEL else ART / "audit_log.jsonl"
STATIC = Path(os.getenv("FRAUDLENS_STATIC", ROOT.parent / "frontend" / "dist"))

app = FastAPI(title="FraudLens API", version="2.0.0", description="Fraud triage engine by Team Genesis")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("FRAUDLENS_CORS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(chat_router)   # chatbot module: /api/chat/*
app.include_router(data_router)   # dataset upload + retrain: /api/data/*

_state = {}
_lock = threading.Lock()
_load_lock = threading.Lock()
on_retrained.append(_state.clear)   # next request reloads the freshly trained artifacts


def state():
    """Lazy-load artifacts so the API explains itself if train.py hasn't been run."""
    if not _state:
        with _load_lock:   # parallel requests after a retrain must not see a half-filled cache
            if not _state:
                if not (ART / "metrics.json").exists():
                    raise HTTPException(503, "No trained model found. Run `python train.py` in /backend first.")
                s = {"metrics": json.loads((ART / "metrics.json").read_text()),
                     "queue": json.loads((ART / "queue.json").read_text()),
                     "samples": json.loads((ART / "samples.json").read_text()),
                     "model": joblib.load(ART / "model.joblib")}
                _explain_queue(s)
                _state.update(s)
    return _state


def _explain_queue(s):
    """Attach real signal values and a plain-English 'why flagged' to every alert (derived from the saved model)."""
    lr = s["model"]["lr"]
    scale, coef = lr.named_steps["prep"].named_steps["scale"], lr.named_steps["clf"].coef_[0]
    for item in s["queue"]:
        details = signal_details(item["signals"], MODEL_COLS, coef, scale.mean_, scale.scale_, item["amount"], item["hour"])
        item["details"] = details
        item["why"] = why_flagged(item, s["metrics"], details)


@app.get("/api/health")
def health():
    ready = (ART / "metrics.json").exists()
    out = {"ok": True, "model_ready": ready, "version": app.version}
    if ready:
        m = state()["metrics"]
        out.update(model=m["best_model"], model_version=m["model_version"], trained_at=m["trained_at"],
                   data_source=m["data_source"], demo_data=m["is_demo_data"])
    return out


@app.get("/api/summary")
def summary():
    return state()["metrics"]


@app.get("/api/queue")
def queue(limit: int = Query(200, ge=1, le=200), action: str | None = None):
    q = state()["queue"]
    if action:
        q = [r for r in q if r["action"] == action]
    return q[:limit]


@app.get("/api/queue/export.csv", response_class=PlainTextResponse)
def queue_export():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["rank", "tx_id", "amount", "risk_score", "action", "verdict", "why_flagged", "analyst_note", "backtest_outcome"])
    for r in state()["queue"]:
        w.writerow([r["rank"], r["tx_id"], f"{r['amount']:.2f}", f"{r['score']:.4f}", r["action"], r["why"]["verdict_label"],
                    " ".join(r["why"]["points"]), r["note"],
                    "fraud" if r["is_fraud"] else "false_alarm"])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=fraudlens_top200_queue.csv"})


@app.get("/api/queue/{rank}")
def queue_item(rank: int):
    q = state()["queue"]
    if not 1 <= rank <= len(q):
        raise HTTPException(404, "Rank not in queue")
    return q[rank - 1]


@app.get("/api/cost")
def cost_curve(miss_cost: float = Query(500, gt=0), alarm_cost: float = Query(15, gt=0)):
    """Expected cost of reviewing the top-k alerts: missed fraud * miss_cost + false alarms * alarm_cost."""
    m = state()["metrics"]
    total = m["test_frauds"]
    pts = []
    for p in m["topk_curve"]:
        c = (total - p["caught"]) * miss_cost + (p["k"] - p["caught"]) * alarm_cost
        pts.append({**p, "cost": round(c, 2)})
    best = min(pts, key=lambda d: d["cost"])
    at_cap = next(p for p in pts if p["k"] == m["capacity"])
    do_nothing = total * miss_cost
    return {"curve": pts, "best_k": best["k"], "best_cost": best["cost"], "capacity_cost": at_cap["cost"],
            "do_nothing_cost": do_nothing, "saving_vs_nothing_at_capacity": round(do_nothing - at_cap["cost"], 2)}


@app.get("/api/samples")
def samples():
    return state()["samples"]


class ScoreRequest(BaseModel):
    features: dict[str, float] = Field(..., description="Time, Amount, V1..V28 (missing V's default to 0)")


@app.post("/api/score")
def score(req: ScoreRequest):
    s = state()
    row = {f: float(req.features.get(f, 0.0)) for f in FEATURES}
    frame = pd.DataFrame([row])
    raw = float(s["model"]["best"].decision_function(frame)[0])
    prob = float(calibrate(s["model"]["calibrator"], [raw])[0])
    lr = s["model"]["lr"]
    contribs = (lr.named_steps["prep"].transform(frame) * lr.named_steps["clf"].coef_[0])[0]
    reasons = top_reasons(contribs, MODEL_COLS)
    scores = s["model"]["test_scores"]                      # descending, held-out day
    would_rank = int((scores > raw).sum()) + 1
    cap = s["metrics"]["capacity"]
    act = tier(would_rank, cap)
    return {
        "score": prob, "reasons": reasons, "signals": top_signals(contribs, MODEL_COLS), "action": act,
        "would_rank_on_test_day": would_rank, "in_daily_queue": would_rank <= cap,
        "note": analyst_note("LIVE", row["Amount"], prob, would_rank, reasons, act),
        "draft": draft_message("LIVE", row["Amount"], act),
    }


# ---------------------------------------------------------------- analyst audit trail
class ActionRequest(BaseModel):
    tx_id: int
    rank: int
    decision: Literal["APPROVE_SMS", "ESCALATE", "DISMISS"]
    analyst: str = Field("analyst@genesis", max_length=80)
    comment: str = Field("", max_length=300)


def _read_audit():
    if not AUDIT.exists():
        return []
    with _lock:
        lines = AUDIT.read_text().splitlines()
    return [json.loads(x) for x in lines if x.strip()]


@app.post("/api/actions")
def record_action(req: ActionRequest):
    """Every analyst decision is appended to an audit log. Nothing is actually sent in this build."""
    if not any(r["tx_id"] == req.tx_id for r in state()["queue"]):
        raise HTTPException(404, "Transaction is not in today's queue")
    entry = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), **req.model_dump()}
    with _lock:
        with AUDIT.open("a") as f:
            f.write(json.dumps(entry) + "\n")
    return entry


@app.get("/api/actions")
def list_actions(limit: int = Query(200, ge=1, le=1000)):
    return list(reversed(_read_audit()))[:limit]


@app.get("/api/actions/export.csv", response_class=PlainTextResponse)
def export_actions():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["timestamp_utc", "analyst", "tx_id", "rank", "decision", "comment"])
    for e in reversed(_read_audit()):
        w.writerow([e["ts"], e["analyst"], e["tx_id"], e["rank"], e["decision"], e["comment"]])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=fraudlens_audit_log.csv"})


# Serve the built UI from the same origin when `npm run build` has been run (single-process deployment).
if STATIC.exists():
    app.mount("/", StaticFiles(directory=STATIC, html=True), name="ui")
