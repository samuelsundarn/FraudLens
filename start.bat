@echo off
REM One-command launcher for Windows. Serves UI + API together on http://localhost:8000
cd /d "%~dp0backend"
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -q -r requirements.txt
if exist data\creditcard.csv (
  echo Kaggle dataset found - training on REAL data
  python train.py
) else if not exist artifacts\metrics.json (
  echo No dataset found - training on SYNTHETIC demo data
  python train.py
)
if not exist ..\frontend\dist ( cd ..\frontend && call npm install && call npm run build && cd ..\backend )
echo Open http://localhost:8000
uvicorn app.main:app --port 8000
