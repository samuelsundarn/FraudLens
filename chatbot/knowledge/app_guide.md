# FraudLens app guide (edit me to teach the assistant more)

## Screens
- **Command Center** - headline result ("Of 200 alerts, ~X are real fraud; we catch ~Y% of all fraud"), KPI tiles (fraud value intercepted, recall, precision, lift vs random), threat capture curve, severity mix, hourly timeline, amount-vs-risk scatter, precision-recall curve, attack-vector map, triage funnel, closest misses, model benchmark.
- **Alert Queue** - the 200 ranked alerts. Search and filter by tier. Click a row to open the side panel: signal fingerprint (radar), top reasons, one-line analyst note, a drafted SMS (needs analyst approval), and Approve / Escalate / Dismiss buttons. Export the queue as CSV.
- **Live Scanner** - move the signal sliders (Amount, Time, V1-V28) and watch the risk score, verdict, would-be rank and reasons update. Good for what-if checks, e.g. drag V14 and watch the verdict change.
- **Cost Optimizer** - enter the cost of a missed fraud and the cost of a false alarm; it plots total cost against alerts reviewed and marks the cheapest cutoff versus the analyst capacity of 200/day.
- **Audit Log** - every analyst decision: who, when, which transaction, what decision, comment. Exportable as CSV.
- **How it works** - plain-English method, hackathon pitfalls and the answers, live pipeline-integrity checks, glossary, roadmap.

## Tiers (action levels)
- **Critical - Block & call** (top-ranked alerts): block the card and call the cardholder.
- **High - Hold for review**: hold the transaction and ask for step-up verification.
- **Watch - Monitor**: allow but monitor.
- **Clear**: below the daily cutoff.

## Using the app
- Switch **light / dark** mode with the sun/moon button in the top bar. The choice is remembered.
- The assistant (this chat, bottom-left) remembers your conversation across reloads. The trash icon clears it.
- "Demo data" chip/banner = synthetic stand-in data. Put Kaggle `creditcard.csv` in `backend/data/` and run `python train.py` to use real data.
- Decisions made in the Alert Queue are saved to the audit log; no SMS is actually sent in this build.

## Setup
- Run `./start.sh` (macOS/Linux) or `start.bat` (Windows), then open http://localhost:8000.
- Put secrets in `.env` at the project root (copy `.env.example`). `GEMINI_API_KEY` powers this assistant; `GEMINI_MODEL` changes the model.
