"""Dataset upload: stream a CSV to disk, retrain in the background, then swap the live artifacts.

The file is never held in memory (it is written chunk by chunk), so large uploads are fine.
If training fails, the previous dataset and artifacts are restored, so the app keeps working.
"""
import json
import os
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Request

from .data import DATA_DIR, REAL_CSV, SOURCE_INFO, validate_frame

BACKEND = Path(__file__).resolve().parent.parent
ART = BACKEND / "artifacts"
BACKUP = BACKEND / "artifacts_previous"          # artifacts from before the last successful upload
INCOMING = DATA_DIR / "incoming.csv.part"
PREV_CSV = DATA_DIR / "creditcard.prev.csv"
AUDIT = ART / "audit_log.jsonl"
ARTIFACT_FILES = ["metrics.json", "queue.json", "samples.json", "model.joblib", "alert_queue_top200.csv"]
MAX_MB = int(os.getenv("FRAUDLENS_MAX_UPLOAD_MB", "2048"))
# Serverless hosts (Vercel) cap request bodies (~4.5 MB) and have a read-only disk, so retraining needs a server.
UPLOAD_ENABLED = not os.getenv("VERCEL")

router = APIRouter(prefix="/api/data", tags=["data"])
on_retrained = []          # callbacks run after a successful retrain (main.py clears its cached state)
_job = {"status": "idle", "log": []}
_lock = threading.Lock()
if UPLOAD_ENABLED:
    INCOMING.unlink(missing_ok=True)   # leftover from an upload interrupted by a server restart


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _current_dataset():
    p = ART / "metrics.json"
    if not p.exists():
        return None
    m = json.loads(p.read_text())
    return {"source": m["data_source"], "is_demo_data": m["is_demo_data"], "trained_at": m["trained_at"],
            "rows": m["train_rows"] + m["test_rows"], "frauds": m["train_frauds"] + m["test_frauds"],
            "statement": m["headline"]["statement"]}


@router.get("/status")
def status():
    return {**_job, "log": _job["log"][-60:], "max_upload_mb": MAX_MB, "upload_enabled": UPLOAD_ENABLED,
            "dataset": _current_dataset()}


@router.put("/upload")
async def upload(request: Request, filename: str = Query(..., min_length=1, max_length=200)):
    """Send the raw CSV as the request body (no multipart), e.g. `curl -T creditcard.csv ...`."""
    if not UPLOAD_ENABLED:
        raise HTTPException(501, "Upload and retrain are not available on this serverless deployment. "
                                 "Run FraudLens on a server (start.sh / start.bat) to use them.")
    name = Path(filename).name
    if not name.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file.")
    with _lock:
        if _job["status"] in ("uploading", "training"):
            raise HTTPException(409, "Another upload or retrain is already running.")
        _job.clear()
        _job.update(status="uploading", filename=name, bytes=0, log=[], error=None, started_at=_now())

    limit, size = MAX_MB * 1024 * 1024, 0
    try:
        with INCOMING.open("wb") as f:
            async for chunk in request.stream():
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"File is larger than the {MAX_MB:,} MB limit (FRAUDLENS_MAX_UPLOAD_MB).")
                f.write(chunk)
        if size == 0:
            raise HTTPException(400, "The uploaded file is empty.")
        try:   # quick schema check on the first rows; train.py validates the whole file
            validate_frame(pd.read_csv(INCOMING, nrows=2000))
        except (ValueError, pd.errors.ParserError, UnicodeDecodeError) as e:
            raise HTTPException(400, f"Not a valid transactions file: {e}")
    except Exception as e:
        INCOMING.unlink(missing_ok=True)
        _job.update(status="failed", error=getattr(e, "detail", None) or f"Upload interrupted: {e}", finished_at=_now())
        raise

    _job.update(status="training", bytes=size)
    threading.Thread(target=_retrain, args=(name, size), daemon=True).start()
    return {"status": "training", "bytes": size}


def _retrain(name, size):
    log = _job["log"]
    had_csv, prev_info = REAL_CSV.exists(), SOURCE_INFO.read_text() if SOURCE_INFO.exists() else None
    tmp_backup = BACKEND / "artifacts_rollback"
    shutil.rmtree(tmp_backup, ignore_errors=True)
    tmp_backup.mkdir()
    for f in ARTIFACT_FILES:
        if (ART / f).exists():
            shutil.copy2(ART / f, tmp_backup / f)
    if had_csv:
        os.replace(REAL_CSV, PREV_CSV)
    os.replace(INCOMING, REAL_CSV)
    SOURCE_INFO.write_text(json.dumps({"name": name, "bytes": size, "uploaded_at": _now()}))

    t0 = time.time()
    log.append(f"Uploaded {name} ({size / 1e6:,.1f} MB). Retraining on the new data...")
    try:
        proc = subprocess.Popen([sys.executable, "-u", "train.py"], cwd=BACKEND, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
        for line in proc.stdout:
            if line.strip():
                log.append(line.rstrip())
        ok = proc.wait() == 0
    except Exception as e:      # e.g. the interpreter could not start
        log.append(f"ERROR: {e}")
        ok = False

    if ok:
        shutil.rmtree(BACKUP, ignore_errors=True)
        os.replace(tmp_backup, BACKUP)
        PREV_CSV.unlink(missing_ok=True)
        if AUDIT.exists():   # decisions refer to the old queue; keep them, but start a fresh log
            os.replace(AUDIT, ART / f"audit_log.{time.strftime('%Y%m%d-%H%M%S')}.jsonl")
        for cb in on_retrained:
            cb()
        log.append(f"Done in {time.time() - t0:,.0f}s. Every page now uses the new data.")
        _job.update(status="done", finished_at=_now())
        return

    # roll back: previous dataset, label and artifacts
    REAL_CSV.unlink(missing_ok=True)
    if had_csv:
        os.replace(PREV_CSV, REAL_CSV)
    if prev_info is None:
        SOURCE_INFO.unlink(missing_ok=True)
    else:
        SOURCE_INFO.write_text(prev_info)
    for f in tmp_backup.iterdir():
        shutil.copy2(f, ART / f.name)
    shutil.rmtree(tmp_backup, ignore_errors=True)
    errors = [line for line in log if "Error" in line or "ERROR" in line]
    _job.update(status="failed", finished_at=_now(),
                error=(errors[-1] if errors else log[-1]).replace("ERROR: ", "") + " The previous data is still in use.")
