import { ShieldAlert, Crosshair, Target, Zap } from "lucide-react";
import { pct, money, money2 } from "../api.js";
import { Card, Kpi, Gauge } from "../components/ui.jsx";
import { QueueStrip, CaptureCurve, SeverityDonut, ThreatTimeline, ThreatLandscape, PRCurve, AttackVectors, Funnel } from "../components/charts.jsx";

const NAMES = { logistic_regression: "Logistic regression", hist_gradient_boosting: "Gradient boosting", naive_random_ranker: "Random review" };

export default function CommandCenter({ s, queue }) {
  const h = s.headline, a = s.analytics;
  const caught = Math.round(h.frauds_in_queue);
  const maxImp = Math.max(...s.global_importance.map((d) => d.weight));
  return (
    <>
      <section className="card hero">
        <div className="eyebrow"><ShieldAlert size={14} />Today's triage result</div>
        <p className="statement">
          Of {h.alerts} alerts, <b>~{caught}</b> are real fraud. We catch <b>~{pct(h.recall)}</b> of all fraud on the day{" "}
          <span style={{ color: "var(--muted)", fontWeight: 500 }}>while analysts open only {pct(h.alerts / a.test_volume, 2)} of transactions.</span>
        </p>
        <QueueStrip queue={queue} />
      </section>

      <div className="grid g4">
        <Kpi icon={ShieldAlert} color="var(--red)" label="Fraud value intercepted" value={money(a.value.fraud_caught_amount)}
          meta={`${pct(a.value.fraud_caught_amount / Math.max(a.value.total_fraud_amount, 1))} of ${money(a.value.total_fraud_amount)} at risk`}
          tip="The total dollar amount of the fraudulent transactions that sit inside the 200 alerts, so they can be stopped before money leaves." />
        <Kpi icon={Crosshair} color="var(--accent)" label="Fraud caught (recall)" value={pct(h.recall)} meta={`${caught} of ${s.test_frauds} fraudulent transactions`}
          tip="Out of every 100 real frauds that happened that day, how many appear in the 200 alerts. Higher is better." />
        <Kpi icon={Target} color="var(--steel)" label="Alert accuracy (precision)" value={pct(h.precision)} meta={`${200 - caught} false alarms out of ${h.alerts}`}
          tip="Out of every 100 alerts analysts open, how many are real fraud. Higher means less wasted analyst time and fewer annoyed customers." />
        <Kpi icon={Zap} color="var(--orange)" label="Lift vs random review" value={`${Math.round(h.lift_vs_random)}×`} meta={`PR-AUC ${s.results[s.best_model].pr_auc.toFixed(2)} · headline metric`}
          tip="How many times more fraud an analyst finds per alert compared with opening 200 random transactions. PR-AUC is our headline score because it stays honest when fraud is rare." />
      </div>

      <div className="grid g-21">
        <Card title="Threat capture curve" sub="Fraud found as analysts work down the ranked queue"
          tip="Each point shows how much fraud is found after reviewing that many alerts. The steeper the amber curve versus the red random line, the better the ranking. The dashed line is a perfect ranking.">
          <CaptureCurve s={s} />
        </Card>
        <Card title="Alert severity mix" sub="How the 200 alerts are tiered" tip="Critical alerts should be blocked and the cardholder called. High alerts are held for step-up verification. Watch alerts are approved but monitored.">
          <SeverityDonut s={s} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Threat timeline" sub="Hour-by-hour: fraud caught, fraud missed and false alarms" tip="Shows when fraud happens during the day and whether the queue caught it. Orange bars are fraud that fell outside the 200 alerts.">
          <ThreatTimeline s={s} />
        </Card>
        <Card title="Threat landscape" sub="Every alert plotted by amount and risk score" tip="Red dots are confirmed fraud, grey dots are false alarms, orange crosses are fraud the queue missed. Fraud clusters at high risk regardless of amount.">
          <ThreatLandscape queue={queue} missed={a.missed} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Precision–recall curve" sub={`The honest curve when only ${pct(s.base_rate, 2)} of transactions are fraud`}
          tip="ROC-AUC looks flattering when fraud is rare. The precision–recall curve shows the real trade-off: catching more fraud (right) usually means more false alarms (down). The amber dot is where we operate with 200 alerts.">
          <PRCurve s={s} />
        </Card>
        <Card title="Attack-vector map" sub="Lead signal behind each alert" tip="The anonymised card-network signals (V1–V28) that most often push a transaction to the top of the queue. Bigger block = more alerts led by that signal.">
          <AttackVectors vectors={a.attack_vectors} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Detection quality at 200 alerts" sub="Triage funnel and headline gauges">
          <div className="grid g2" style={{ gap: 0 }}>
            <div><Gauge value={h.precision} label="precision" color="var(--steel)" /></div>
            <div><Gauge value={h.recall} label="recall" color="var(--accent)" /></div>
          </div>
          <div style={{ marginTop: 14 }}><Funnel s={s} /></div>
        </Card>
        <div className="grid" style={{ alignContent: "start" }}>
          <Card title="Closest misses" sub={`Fraud that just fell outside the queue (${a.missed.length > 0 ? "highest-scored misses" : "none"})`}
            tip="These are real frauds ranked just below the 200 cutoff. If the team had spare capacity, reviewing these first would catch more fraud.">
            <div className="table-wrap" style={{ maxHeight: 210 }}>
              <table>
                <thead><tr><th>TX</th><th className="num">Rank</th><th className="num">Amount</th><th className="num">Risk</th></tr></thead>
                <tbody>{a.missed.slice(0, 6).map((m) => (
                  <tr key={m.tx_id}><td className="mono">{m.tx_id}</td><td className="num">#{m.rank}</td><td className="num">{money2(m.amount)}</td><td className="num">{(m.score * 100).toFixed(1)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
          <Card title="Model benchmark" sub={`Winner by time-ordered CV: ${NAMES[s.best_model]}`}>
            <div className="table-wrap" style={{ maxHeight: 260 }}>
              <table>
                <thead><tr><th>Approach</th><th className="num">PR-AUC</th><th className="num">ROC-AUC</th><th className="num">Fraud @200</th></tr></thead>
                <tbody>
                  {["logistic_regression", "hist_gradient_boosting", "naive_random_ranker"].map((n) => (
                    <tr key={n}><td>{NAMES[n]}{n === s.best_model && <span className="badge ok" style={{ marginLeft: 8 }}>selected</span>}</td>
                      <td className="num">{s.results[n].pr_auc.toFixed(3)}</td><td className="num">{s.results[n].roc_auc.toFixed(3)}</td><td className="num">{Math.round(s.results[n].tp_at_200)}</td></tr>
                  ))}
                  <tr className="trap"><td>“Never fraud” ({pct(s.results.accuracy_trap.all_negative_accuracy, 2)} accurate)</td><td className="num">–</td><td className="num">–</td><td className="num">0</td></tr>
                </tbody>
              </table>
            </div>
            <p className="sub" style={{ marginTop: 10 }}>The amber row is the accuracy trap: it looks excellent and catches nothing. ROC-AUC is shown only for comparison.</p>
          </Card>
        </div>
      </div>

      <Card title="What drives the risk score" sub="Largest weights of the interpretable model · V1–V28 are anonymised by the card network"
        tip="Longer bar = that signal moves the risk score more. Because the card network anonymises its features, we can name the signal but not its business meaning.">
        <div className="grid g2" style={{ gap: "6px 36px" }}>
          {s.global_importance.map((d) => (
            <div key={d.feature} style={{ display: "grid", gridTemplateColumns: "92px 1fr 44px", gap: 12, alignItems: "center", fontSize: 12.5 }}>
              <span className="mono">{d.feature.replace("log_amount", "Amount").replace("hour_sin", "Hour (sin)").replace("hour_cos", "Hour (cos)")}</span>
              <div style={{ height: 8, borderRadius: 4, background: "var(--track)" }}><div className="grow" style={{ width: `${(d.weight / maxImp) * 100}%`, height: "100%", borderRadius: 4, background: "linear-gradient(90deg, var(--accent), var(--orange))" }} /></div>
              <span className="mono" style={{ color: "var(--muted)", textAlign: "right" }}>{d.weight.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
