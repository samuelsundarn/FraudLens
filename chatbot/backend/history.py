"""Per-session chat history, saved as JSON files so it survives reloads and restarts."""
import json
import re
import threading
from datetime import datetime, timezone

from . import config

_lock = threading.Lock()
_SID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def valid_sid(sid: str) -> bool:
    return bool(_SID.match(sid or ""))


def _path(sid: str):
    config.HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    return config.HISTORY_DIR / f"{sid}.json"


def load(sid: str) -> list[dict]:
    p = _path(sid)
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def append(sid: str, role: str, text: str) -> list[dict]:
    with _lock:
        msgs = load(sid)
        msgs.append({"role": role, "text": text, "ts": datetime.now(timezone.utc).isoformat(timespec="seconds")})
        msgs = msgs[-config.STORE_LIMIT:]
        _path(sid).write_text(json.dumps(msgs, ensure_ascii=False), encoding="utf-8")
        return msgs


def clear(sid: str) -> None:
    with _lock:
        p = _path(sid)
        if p.exists():
            p.unlink()
