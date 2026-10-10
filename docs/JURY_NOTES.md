# Pitch / jury notes — 3 minutes (Team Genesis)
1. **Hook (20s):** "Predict 'never fraud' and you're 99.8% accurate — and catch nothing." Show the amber row in *Command Center → Model benchmark*.
2. **Decision (30s):** Analysts can open 200 alerts a day. We rank every transaction; success = fraud inside those 200. Read the hero sentence aloud.
3. **Method (45s):** *How it works* page: time split, no SMOTE, class weights, time-ordered CV, PR-AUC, calibrated risk. Point at the green integrity checks.
4. **Result (30s):** Threat capture curve (cyan vs red), timeline of caught vs missed, the 200-tick strip.
5. **Live demo (40s):** Alert Queue → open an alert → signal fingerprint, reasons, note → Approve SMS → Audit Log. Then Live Scanner → drag V14 and watch the verdict flip.
6. **Value + next (15s):** Cost Optimizer → right cutoff for your costs. Next: streaming, SHAP.

Likely questions: Why not accuracy / ROC-AUC? Where do you scale and resample? Why a time split? Why logistic for reasons? What does recall @ 200 mean in plain words? Is the risk % a real probability? (Yes — Platt-calibrated on training-period out-of-fold predictions.) Are these real-data numbers? (Say which data the banner shows.)
