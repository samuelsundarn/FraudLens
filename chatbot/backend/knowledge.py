"""Builds what the bot knows: README + docs + chatbot/knowledge/*.md + a live snapshot of today's numbers."""
import json

from . import config

_cache = {"sig": None, "text": ""}


def _files():
    root = config.PROJECT_ROOT
    out = [root / "README.md", *sorted((root / "docs").glob("*.md")), *sorted(config.KNOWLEDGE_DIR.glob("*.md"))]
    return [p for p in out if p.exists()]


def _live_snapshot() -> str:
    art = config.PROJECT_ROOT / "backend" / "artifacts"
    parts = []
    try:
        m = json.loads((art / "metrics.json").read_text())
        keep = {k: m.get(k) for k in ("model_version", "data_source", "is_demo_data", "best_model", "capacity", "test_frauds",
                                     "base_rate", "headline", "results", "calibration", "integrity")}
        a = m.get("analytics", {})
        keep["severity_mix"] = a.get("severity")
        keep["value"] = a.get("value")
        keep["top_signals"] = m.get("global_importance", [])[:8]
        parts.append("LIVE METRICS (current trained model):\n" + json.dumps(keep, default=str))
    except Exception:
        parts.append("LIVE METRICS: not available (model not trained yet).")
    try:
        q = json.loads((art / "queue.json").read_text())
        counts = {}
        for r in q:
            counts[r["action"]] = counts.get(r["action"], 0) + 1
        top = [{k: r[k] for k in ("rank", "tx_id", "amount", "score", "action", "note")} for r in q[:10]]
        parts.append(f"LIVE QUEUE: {len(q)} alerts, by tier {counts}. Top 10:\n" + json.dumps(top))
    except Exception:
        pass
    return "\n\n".join(parts)


def build_context() -> str:
    files = _files()
    sig = tuple((str(p), p.stat().st_mtime) for p in files)
    if _cache["sig"] != sig:                      # re-read docs only when they change
        docs = "\n\n".join(f"=== {p.name} ===\n{p.read_text(encoding='utf-8')}" for p in files)
        _cache.update(sig=sig, text=docs)
    return _cache["text"] + "\n\n" + _live_snapshot()
