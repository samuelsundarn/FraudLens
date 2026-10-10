#!/usr/bin/env bash
# One-command launcher (macOS / Linux / Git-Bash). Serves UI + API together on http://localhost:8000
set -e
cd "$(dirname "$0")/backend"
python3 -m venv .venv 2>/dev/null || python -m venv .venv
source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate
pip install -q -r requirements.txt
if [ -f data/creditcard.csv ]; then
  echo ">> Kaggle dataset found - training on REAL data"; python train.py
elif [ ! -f artifacts/metrics.json ]; then
  echo ">> No dataset found - training on SYNTHETIC demo data"; python train.py
fi
if [ ! -d ../frontend/dist ]; then (cd ../frontend && npm install && npm run build); fi
echo ">> Open http://localhost:8000"
exec uvicorn app.main:app --port 8000
