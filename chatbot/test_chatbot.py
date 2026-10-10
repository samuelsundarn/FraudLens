"""Chatbot tests - no API key or internet needed (Gemini is faked). Run: python chatbot/test_chatbot.py"""
import sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "backend"))
from fastapi.testclient import TestClient
from chatbot.backend import config, gemini, router, history
from chatbot.backend.knowledge import build_context
from app.main import app

config.HISTORY_DIR = Path(tempfile.mkdtemp())
c, SID, seen = TestClient(app), "test-session-1234", {}

def fake(system, msgs):
    seen["system"], seen["msgs"] = system, list(msgs)
    return f"echo {len(msgs)}"
router.generate = fake

def test_knowledge():
    k = build_context(); assert "app guide" in k.lower() and "LIVE METRICS" in k and "LIVE QUEUE" in k
def test_status_and_key_not_leaked():
    s = c.get("/api/chat/status").json(); assert set(s) == {"enabled", "configured", "model"}
def test_memory():
    r1 = c.post("/api/chat", json={"session_id": SID, "message": "hello", "page": "Alert Queue"}).json(); assert r1["reply"] == "echo 1"
    assert "Alert Queue" in seen["system"]
    r2 = c.post("/api/chat", json={"session_id": SID, "message": "again"}).json(); assert r2["reply"] == "echo 3"   # remembers turn 1
    h = c.get(f"/api/chat/history?session_id={SID}").json(); assert [m["role"] for m in h] == ["user", "bot", "user", "bot"]
def test_clear():
    c.delete(f"/api/chat/history?session_id={SID}"); assert c.get(f"/api/chat/history?session_id={SID}").json() == []
def test_bad_session():
    assert c.get("/api/chat/history?session_id=../etc").status_code == 400
def test_missing_key_and_rollback():
    router.generate = gemini.generate; old = config.API_KEY; config.API_KEY = lambda: ""
    r = c.post("/api/chat", json={"session_id": SID, "message": "hi"}); assert r.status_code == 503 and "GEMINI_API_KEY" in r.json()["detail"]
    assert c.get(f"/api/chat/history?session_id={SID}").json() == []       # failed question not stored
    config.API_KEY = old; router.generate = fake
def test_gemini_parsing():
    gemini._call = lambda body: {"candidates": [{"content": {"parts": [{"text": "ok "}, {"text": "done"}]}}]}
    old = config.API_KEY; config.API_KEY = lambda: "k"
    assert gemini.generate("s", [{"role": "user", "text": "q"}]) == "ok done"; config.API_KEY = old

if __name__ == "__main__":
    t = [(n, f) for n, f in globals().items() if n.startswith("test_")]
    for n, f in t: f(); print("PASS", n)
    print(f"{len(t)} chatbot checks passed")
