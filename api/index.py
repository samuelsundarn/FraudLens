"""Vercel entrypoint: serves the FastAPI app as a Python serverless function."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))   # model pickle references `app.*`

from app.main import app  # noqa: E402,F401
