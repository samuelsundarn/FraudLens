"""All chatbot settings in one place. Values come from .env (see .env.example)."""
import os
from pathlib import Path

from . import env  # noqa: F401  (loads .env on import)

CHATBOT_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = CHATBOT_DIR.parent

ENABLED = os.getenv("CHATBOT_ENABLED", "true").lower() != "false"
API_KEY = lambda: os.getenv("GEMINI_API_KEY", "").strip()          # read lazily so a restart is not needed after editing env
MODEL = lambda: os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
TEMPERATURE = float(os.getenv("CHATBOT_TEMPERATURE", "0.3"))
MAX_OUTPUT_TOKENS = int(os.getenv("CHATBOT_MAX_OUTPUT_TOKENS", "1500"))
CONTEXT_TURNS = int(os.getenv("CHATBOT_CONTEXT_TURNS", "20"))       # how many recent messages are sent to Gemini
STORE_LIMIT = int(os.getenv("CHATBOT_STORE_LIMIT", "200"))          # how many messages are kept on disk per session
TIMEOUT_S = int(os.getenv("CHATBOT_TIMEOUT_SECONDS", "40"))
HISTORY_DIR = Path(os.getenv("CHATBOT_HISTORY_DIR", CHATBOT_DIR / "data" / "history"))
KNOWLEDGE_DIR = CHATBOT_DIR / "knowledge"                           # drop extra .md files here to teach the bot
