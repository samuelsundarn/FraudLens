"""FastAPI router for the chatbot. Mounted by backend/app/main.py with two lines."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from . import config, history
from .gemini import GeminiError, generate
from .knowledge import build_context
from .prompts import SYSTEM_PROMPT

router = APIRouter(prefix="/api/chat", tags=["chatbot"])


class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(..., min_length=1, max_length=2000)
    page: str | None = Field(None, max_length=80)     # screen the user is on, gives the bot context


def _sid(sid: str) -> str:
    if not history.valid_sid(sid):
        raise HTTPException(400, "Invalid session id")
    return sid


@router.get("/status")
def status():
    return {"enabled": config.ENABLED, "configured": bool(config.API_KEY()), "model": config.MODEL()}


@router.get("/history")
def get_history(session_id: str = Query(...)):
    return history.load(_sid(session_id))


@router.delete("/history")
def clear_history(session_id: str = Query(...)):
    history.clear(_sid(session_id))
    return {"ok": True}


@router.post("")
def chat(req: ChatRequest):
    if not config.ENABLED:
        raise HTTPException(503, "The assistant is switched off (CHATBOT_ENABLED=false).")
    sid = _sid(req.session_id)
    msgs = history.append(sid, "user", req.message.strip())
    system = SYSTEM_PROMPT + "\n\nKNOWLEDGE:\n" + build_context()
    if req.page:
        system += f"\n\nThe user is currently looking at the \"{req.page}\" screen."
    try:
        reply = generate(system, msgs[-config.CONTEXT_TURNS:])
    except GeminiError as e:
        # keep history consistent: drop the unanswered question so a retry does not duplicate it
        stored = history.load(sid)[:-1]
        history.clear(sid)
        for m in stored:
            history.append(sid, m["role"], m["text"])
        raise HTTPException(e.status if 400 <= e.status < 600 else 502, str(e))
    history.append(sid, "bot", reply)
    return {"reply": reply, "session_id": sid}
