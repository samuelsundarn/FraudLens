import { Database, Split, Scale, Trophy, ListOrdered, ShieldCheck, Lightbulb, Rocket } from "lucide-react";
import { pct } from "../api.js";
import { Card, PassFail } from "../components/ui.jsx";

const STEPS = [
  ["1", "Split by time", "Train on day 1, test on day 2 — exactly like a real daily queue. The model never sees the future."],
  ["2", "Handle rarity safely", "Class weights, not SMOTE. The scaler learns from training data only, so nothing leaks."],
  ["3", "Compare two models", "Logistic regression vs gradient boosting, chosen by time-ordered cross-validation."],
  ["4", "Rank & explain", "Score every transaction, take the top 200, add reasons, a one-line note and an action."],
  ["5", "Human decides", "Analysts approve, escalate or dismiss. Every decision lands in the audit log."],
];
const TRAPS = [
  ["“99.8% accurate!”", "Predicting “never fraud” scores that and catches nothing. We headline PR-AUC and precision/recall at 200 alerts, and show the trap row on purpose."],
  ["Resampling leakage", "No SMOTE at all. Class weights are applied inside the training fold; the scaler sits inside the pipeline."],
  ["ROC-AUC flatters", "With 0.17% fraud, ROC-AUC looks great even for weak models. The precision–recall curve is the honest one."],
  ["Time-travel cheating", "No random split. Training data is strictly earlier than test data."],
];
const GLOSS = [
  ["Precision", "Of the alerts we raise, how many are real fraud?"],
  ["Recall", "Of all the fraud that happened, how much did we catch?"],
  ["PR-AUC", "One score (0–1) summarising precision vs recall. Random ≈ the fraud rate."],
  ["Lift", "How many times better than reviewing random transactions."],
  ["Risk score", "Estimated chance a transaction is fraud (calibrated on training data only). Rank, not score, decides the action."],
];

export default function HowItWorks({ s }) {
  return (
    <>
      <Card className="hero" title="FraudLens in one minute" sub="Built by Team Genesis for the Maverick Skill Sprint · Project 5">
        <p style={{ fontSize: 17, lineHeight: 1.55, maxWidth: 900, margin: "0 0 4px" }}>
          A card issuer sees ~300,000 transactions in two days and can review only <b style={{ color: "var(--accent)" }}>200 alerts a day</b>. FraudLens ranks every transaction so those 200 reviews
          find as much fraud as possible, explains <i>why</i> each one was flagged, and recommends <i>what to do</i> — with a human always approving customer contact.
        </p>
      </Card>

      <div className="steps" role="list">
        {STEPS.map(([n, t, d]) => <div className="step" role="listitem" key={n}><div className="n">{n}</div><h3>{t}</h3><p>{d}</p></div>)}
      </div>

      <div className="grid g2">
        <Card title="Pitfalls we designed around" sub="The hackathon traps, and our answer to each" right={<Scale size={18} color="var(--orange)" />}>
          <div className="grid" style={{ gap: 14 }}>
            {TRAPS.map(([q, a]) => <div className="trap-card" key={q}><div className="q">{q}</div><span className="sub" style={{ fontSize: 13 }}>{a}</span></div>)}
          </div>
        </Card>
        <Card title="Live pipeline integrity" sub="Checked at training time and re-checked by test_fraudlens.py" right={<ShieldCheck size={18} color="var(--green)" />}>
          {s.integrity.map((c) => (
            <div className="check" key={c.check}><PassFail ok={c.passed} /><div><b>{c.check}</b><span>{c.detail}</span></div></div>
          ))}
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Plain-English glossary" right={<Lightbulb size={18} color="var(--accent)" />}>
          {GLOSS.map(([t, d]) => <div className="check" key={t}><div><b>{t}</b><span>{d}</span></div></div>)}
        </Card>
        <Card title="Data & model facts" right={<Database size={18} color="var(--steel)" />}>
          <div className="check"><div><b>Data source</b><span>{s.data_source}</span></div></div>
          <div className="check"><div><b>Train → test</b><span>{s.train_rows.toLocaleString()} rows ({s.train_frauds} fraud) → {s.test_rows.toLocaleString()} rows ({s.test_frauds} fraud, {pct(s.base_rate, 2)})</span></div></div>
          <div className="check"><div><b>Cross-validation (PR-AUC, 4 time folds)</b><span>Logistic {s.cv.logistic_regression.mean_pr_auc.toFixed(3)} ± {s.cv.logistic_regression.std.toFixed(3)} · Boosting {s.cv.hist_gradient_boosting.mean_pr_auc.toFixed(3)} ± {s.cv.hist_gradient_boosting.std.toFixed(3)}</span></div></div>
          <div className="check"><div><b>Explanations</b><span>Reasons come from the interpretable logistic model (coefficient × standardised value). If boosting wins the ranking, reasons are an approximation from that linear model.</span></div></div>
          <div className="check"><div><b>Trained</b><span>{s.trained_at} · {s.model_version}</span></div></div>
        </Card>
      </div>

      <Card title="Roadmap" right={<Rocket size={18} color="var(--orange)" />}>
        <div className="grid g3" style={{ gap: 10 }}>
          {["Conversational analyst assistant (“why was TX 1234 flagged?”)", "Real-time scoring stream and feature store; drift monitoring and scheduled retraining",
            "SHAP explanations for the boosted model", "Analyst verdicts feed back as labels (active learning)", "Single sign-on, role-based access and an immutable audit store", "Containerised deployment on cloud with monitoring"]
            .map((t) => <div key={t} className="trap-card"><span style={{ fontSize: 13, color: "var(--muted)" }}>• {t}</span></div>)}
        </div>
      </Card>
    </>
  );
}
