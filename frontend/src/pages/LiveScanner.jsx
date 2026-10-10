import { useEffect, useMemo, useRef, useState } from "react";
import { ScanSearch, Radio } from "lucide-react";
import { api, ACTION_LABEL, SEV_COLOR, money2, riskIndex } from "../api.js";
import { Card, Gauge } from "../components/ui.jsx";
import { SignalRadar } from "../components/charts.jsx";

export default function LiveScanner({ s }) {
  const [samples, setSamples] = useState(null);
  const [f, setF] = useState(null);                 // full feature dict being scored
  const [json, setJson] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef();

  const drivers = useMemo(() => s.global_importance.filter((d) => /^V\d+$/.test(d.feature)).slice(0, 6).map((d) => d.feature), [s]);

  useEffect(() => { api.samples().then((x) => { setSamples(x); load(x.fraud_example); }).catch((e) => setErr(e.message)); }, []); // eslint-disable-line
  const load = (obj) => { setF(obj); setJson(JSON.stringify(obj, null, 2)); };

  useEffect(() => {   // live re-score, debounced, whenever a control changes
    if (!f) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true); setErr(null);
      try { setRes(await api.score(f)); } catch (e) { setErr(e.message); } finally { setBusy(false); }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [f]);

  const set = (k, v) => { const n = { ...f, [k]: v }; setF(n); setJson(JSON.stringify(n, null, 2)); };
  const applyJson = () => { try { const o = JSON.parse(json); setF(o); setErr(null); } catch { setErr('That is not valid JSON. Example: {"Amount": 25, "V14": -5}'); } };

  return (
    <div className="grid g2" style={{ alignItems: "start" }}>
      <Card title="Transaction signals" sub="Drag a signal and the verdict updates live"
        tip="Pick a preset, then move the sliders. V-signals are anonymised features from the card network; the six shown are the ones the model relies on most.">
        <div className="toolbar">
          <button className="pill" onClick={() => samples && load(samples.fraud_example)}>Load fraud example</button>
          <button className="pill" onClick={() => samples && load(samples.legit_example)}>Load normal example</button>
        </div>
        {f && (
          <>
            <div className="slider-row"><label htmlFor="amt">Amount ($)</label>
              <input id="amt" type="range" min="0" max="2500" step="5" value={Math.min(f.Amount ?? 0, 2500)} onChange={(e) => set("Amount", +e.target.value)} /><output>{Math.round(f.Amount ?? 0)}</output></div>
            {drivers.map((k) => (
              <div className="slider-row" key={k}><label htmlFor={k}>Signal {k}</label>
                <input id={k} type="range" min="-15" max="15" step="0.1" value={Math.max(-15, Math.min(15, f[k] ?? 0))} onChange={(e) => set(k, +e.target.value)} /><output>{(f[k] ?? 0).toFixed(1)}</output></div>
            ))}
          </>
        )}
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>Advanced: edit raw JSON (Time, Amount, V1–V28)</summary>
          <textarea className="input" style={{ marginTop: 10 }} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} aria-label="Transaction JSON" />
          <button className="btn sm" style={{ marginTop: 8 }} onClick={applyJson}>Apply JSON</button>
        </details>
        {err && <p className="sub" style={{ color: "var(--red)", marginTop: 10 }}>{err}</p>}
      </Card>

      <Card title="Verdict" sub="Risk, reasons and recommended action" right={busy ? <span className="chip live"><Radio size={13} />scoring…</span> : null} aria-live="polite">
        {!res && <p className="sub">Scoring…</p>}
        {res && (
          <>
            <Gauge value={res.score} label="risk score" color={SEV_COLOR[res.action]} size={230} display={riskIndex(res.score)} />
            <div style={{ textAlign: "center", margin: "6px 0 4px" }}><span className={"badge " + res.action}>{ACTION_LABEL[res.action]}</span></div>
            <p className="sub" style={{ textAlign: "center" }}>
              Would rank <b style={{ color: "var(--text)" }}>#{res.would_rank_on_test_day.toLocaleString()}</b> among today's transactions — {res.in_daily_queue ? "inside" : "outside"} the 200-alert queue.
            </p>
            <div className="sect">Signal fingerprint</div>
            <SignalRadar signals={res.signals} color={SEV_COLOR[res.action]} height={220} />
            <div className="sect">Analyst note</div>
            <div className="note">{res.note}</div>
            <div className="sect">Cardholder message · {res.draft.status.replace("_", " ")}</div>
            <div className="sms">{res.draft.text}</div>
          </>
        )}
      </Card>
    </div>
  );
}
