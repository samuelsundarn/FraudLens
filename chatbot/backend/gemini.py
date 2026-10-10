"""Minimal Gemini REST client (standard library only)."""
import json
import urllib.error
import urllib.request

from . import config


class GeminiError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def _call(body: dict) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.MODEL()}:generateContent"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": config.API_KEY()})
    try:
        with urllib.request.urlopen(req, timeout=config.TIMEOUT_S) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = json.loads(e.read()).get("error", {}).get("message", "")
        except Exception:
            pass
        raise GeminiError(detail or f"Gemini returned HTTP {e.code}", e.code)
    except (urllib.error.URLError, TimeoutError) as e:
        raise GeminiError(f"Could not reach Gemini: {getattr(e, 'reason', e)}", 504)


def generate(system: str, messages: list[dict]) -> str:
    """messages: [{role: 'user'|'bot', text}] oldest first. Returns the reply text."""
    if not config.API_KEY():
        raise GeminiError("GEMINI_API_KEY is not set. Add it to the .env file and restart the server.", 503)
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["text"]}]} for m in messages],
        "generationConfig": {"temperature": config.TEMPERATURE, "maxOutputTokens": config.MAX_OUTPUT_TOKENS},
    }
    model = config.MODEL()
    if "2.5" in model and "flash" in model:        # skip hidden "thinking" for fast, cheap answers
        body["generationConfig"]["thinkingConfig"] = {"thinkingBudget": 0}
    try:
        data = _call(body)
    except GeminiError as e:
        if e.status == 400 and "thinkingConfig" in body["generationConfig"]:
            body["generationConfig"].pop("thinkingConfig")
            data = _call(body)
        else:
            raise
    cands = data.get("candidates") or []
    parts = cands[0].get("content", {}).get("parts", []) if cands else []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        reason = (data.get("promptFeedback") or {}).get("blockReason") or (cands[0].get("finishReason") if cands else "empty")
        raise GeminiError(f"Gemini returned no answer ({reason}). Try rephrasing your question.", 502)
    return text
