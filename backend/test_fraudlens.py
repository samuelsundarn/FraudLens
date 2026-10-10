"""FraudLens automated checks.  Run after training:  python test_fraudlens.py
Plain-Python (no pytest needed). Exits non-zero if any check fails."""
import json
import sys
from pathlib import Path

import joblib
import numpy as np

from app.data import load_data, FEATURES
from train import DAY, CAPACITY

ART = Path(__file__).parent / "artifacts"
M = json.loads((ART / "metrics.json").read_text())
Q = json.loads((ART / "queue.json").read_text())
S = json.loads((ART / "samples.json").read_text())
MODEL = joblib.load(ART / "model.joblib")
results = []


def check(name):
    def deco(fn):
        try:
            fn()
            results.append((name, True, ""))
        except Exception as e:  # noqa: BLE001
            results.append((name, False, repr(e)))
        return fn
    return deco


df, _ = load_data()
t_split = df["Time"].max() - DAY
train, test = df[df["Time"] <= t_split], df[df["Time"] > t_split]


@check("1. Train data comes strictly before test data (temporal split)")
def _():
    assert train["Time"].max() < test["Time"].min()


@check("2. Scaler statistics come from training data only (no leakage)")
def _():
    sc = MODEL["lr"].named_steps["prep"]
    expect = sc.named_steps["feat"].transform(train[FEATURES]).mean().values
    assert np.allclose(sc.named_steps["scale"].mean_, expect)


@check("3. Label and IDs are not used as features")
def _():
    assert "Class" not in FEATURES and "tx_id" not in FEATURES


@check("4. Queue has exactly 200 unique alerts, sorted by risk")
def _():
    assert len(Q) == CAPACITY and len({q["tx_id"] for q in Q}) == CAPACITY
    s = [q["score"] for q in Q]
    assert s == sorted(s, reverse=True) and [q["rank"] for q in Q] == list(range(1, CAPACITY + 1))


@check("5. Headline precision and recall match the queue")
def _():
    tp = sum(q["is_fraud"] for q in Q)
    assert tp == round(M["headline"]["frauds_in_queue"])
    assert abs(M["headline"]["precision"] - tp / CAPACITY) < 1e-9
    assert abs(M["headline"]["recall"] - tp / M["test_frauds"]) < 1e-9


@check("6. PR-AUC and precision@200 beat random review by a wide margin")
def _():
    b = M["results"][M["best_model"]]
    assert b["pr_auc"] > 20 * M["base_rate"] and b["precision_at_200"] > 20 * M["base_rate"]


@check('7. The "never fraud" trap scores >99% accuracy and catches zero fraud')
def _():
    t = M["results"]["accuracy_trap"]
    assert t["all_negative_accuracy"] > 0.99 and t["frauds_caught"] == 0


@check("8. No suspiciously perfect score (would signal leakage)")
def _():
    b = M["results"][M["best_model"]]
    assert b["pr_auc"] < 0.995 and b["precision_at_200"] < 1.0 or M["test_frauds"] < CAPACITY


@check("9. Every alert has reasons, a note, an action and an approval-gated draft")
def _():
    for q in Q:
        assert q["reasons"] and q["note"].startswith(f"#{q['rank']} |") and q["action"] in {
            "BLOCK_AND_CALL", "HOLD_FOR_REVIEW", "MONITOR"}
        if q["action"] != "MONITOR":
            assert q["draft"]["status"] == "PENDING_APPROVAL"


@check("10. Fraud example scores above normal example")
def _():
    f = MODEL["best"].predict_proba(__import__("pandas").DataFrame([S["fraud_example"]])[FEATURES])[:, 1][0]
    n = MODEL["best"].predict_proba(__import__("pandas").DataFrame([S["legit_example"]])[FEATURES])[:, 1][0]
    assert f > 0.5 > n


@check("11. Pipeline-integrity flags recorded at training time all pass")
def _():
    assert all(i["passed"] for i in M["integrity"]), [i for i in M["integrity"] if not i["passed"]]


@check("12. Dashboard analytics are internally consistent")
def _():
    a = M["analytics"]
    assert sum(h["caught"] + h["missed"] for h in a["hourly"]) == M["test_frauds"]
    assert sum(h["caught"] + h["false_alarms"] for h in a["hourly"]) == CAPACITY
    assert abs(a["value"]["fraud_caught_amount"] + a["value"]["fraud_missed_amount"] - a["value"]["total_fraud_amount"]) < 0.01


try:
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)

    @check("13. API: health, summary, queue, cost, score, export respond correctly")
    def _():
        assert c.get("/api/health").json()["model_ready"]
        assert c.get("/api/summary").json()["capacity"] == CAPACITY
        assert len(c.get("/api/queue").json()) == CAPACITY
        assert c.get("/api/cost?miss_cost=500&alarm_cost=15").json()["best_k"] > 0
        r = c.post("/api/score", json={"features": S["fraud_example"]}).json()
        assert r["score"] > 0.5 and r["note"]
        assert c.get("/api/queue/export.csv").text.count("\n") == CAPACITY + 1
        assert c.get("/api/queue/9999").status_code == 404

    @check("14. API: analyst actions are validated and written to the audit log")
    def _():
        bad = c.post("/api/actions", json={"tx_id": -1, "rank": 1, "decision": "DISMISS"})
        assert bad.status_code == 404
        assert c.post("/api/actions", json={"tx_id": Q[0]["tx_id"], "rank": 1, "decision": "NUKE"}).status_code == 422
except ImportError:
    print("(httpx not installed: API checks skipped. pip install httpx)")

for name, ok, err in results:
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -> {err}"))
failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
