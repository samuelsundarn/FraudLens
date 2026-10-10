# Approach review (Team Genesis self-audit)

## Verdict
The core approach is **correct** and answers every trap in the brief. Seven weaknesses were found and fixed in v2.0; four caveats remain that a judge may probe — know your answer to each.

## What was already right
| Trap in the brief | Handling | Verdict |
|---|---|---|
| Rare target makes accuracy a lie | Headline = PR-AUC and precision/recall @ 200; "never fraud" row shown on purpose | Correct |
| Resampling applied in the wrong place | No SMOTE; class weights only; scaler inside the sklearn Pipeline (fit on train only) | Correct |
| ROC-AUC flatters | Precision–recall curve is the main curve; ROC-AUC shown only for contrast | Correct |
| Time leakage | Train on day 1, test on day 2; model chosen by `TimeSeriesSplit` on train; test day scored once | Correct |

## Fixed in v2.0
1. **Ties at the top of the ranking.** `predict_proba` saturates at 1.0 for many strong frauds, creating ties and an arbitrary order. Ranking now uses the raw log-odds (`decision_function`).
2. **"Risk %" was not a probability.** Class weights inflate scores. Added Platt calibration fitted on out-of-fold *training-period* predictions only (monotonic, so ranking is unchanged). Displayed risk is capped at 99.9%.
3. **Tiers depended on uncalibrated score thresholds.** Tiers are now rank-based (1–20 Critical, 21–100 High, 101–200 Watch).
4. **Duplicate reasons.** `hour_sin` and `hour_cos` both appeared as "time of day"; they are merged.
5. **Precision–recall curve was sub-sampled badly** (it skipped the region analysts care about). It is now sampled along the ranking.
6. **Documented tests did not exist.** `test_fraudlens.py` (14 checks) is now included and passes.
7. **No audit trail.** Analyst decisions are validated and logged (`/api/actions`, CSV export).

## Caveats to be ready for
- **Real-data numbers are not in this package's demo build.** The shipped artifacts were trained on a synthetic stand-in (the Kaggle file was not available when this was built). Put `creditcard.csv` in `backend/data/` and run `python train.py`; every chart, the headline sentence and the tests then reflect real data. Expect lower precision than the demo and re-read the headline sentence before presenting.
- **Explanations vs ranking.** Reasons come from the logistic model. If gradient boosting wins on real data, the ranking and the reasons come from different models — say "linear surrogate explanation", or add SHAP.
- **`Time` is seconds since the first transaction, not clock time.** The hour-of-day features assume the first transaction was at midnight. Run an ablation (drop `hour_sin/cos`); keep them only if CV improves.
- **One test day.** Recall@200 is capped by the number of frauds that day and is a single-sample estimate. If time allows, report a rolling day-by-day backtest. The cost explorer is computed on that same day, so present it as a planning aid.
