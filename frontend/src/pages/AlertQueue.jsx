import { useEffect, useMemo, useState } from "react";
import { Download, Search, X, ChevronLeft, ChevronRight, Copy, Check, Send, ArrowUpRight, Ban, AlertTriangle } from "lucide-react";
import { ACTION_LABEL, SEVERITY, SEV_COLOR, COLORS, money2, riskIndex } from "../api.js";
import { Card, InfoTip, Empty } from "../components/ui.jsx";
import { SignalRadar } from "../components/charts.jsx";

const DECISION_LABEL = { APPROVE_SMS: "SMS approved", ESCALATE: "Escalated", DISMISS: "Dismissed" };

function Drawer({ item, onClose, onPrev, onNext, decision, decide }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { setErr(null); setCopied(false); }, [item?.tx_id]);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowDown") onNext(); if (e.key === "ArrowUp") onPrev(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose, onNext, onPrev]);
  if (!item) return null;
  const why = item.why;
  const details = item.details || [];
  const max = Math.max(...details.map((d) => d.impact), ...item.reasons.map((r) => r.impact), 1);
  const go = async (d) => { setBusy(true); setErr(null); try { await decide(item, d); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const needsSms = item.draft.channel !== "none";
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Alert ${item.rank} details`}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button className="btn sm" onClick={onPrev} aria-label="Previous alert"><ChevronLeft size={15} /></button>
          <button className="btn sm" onClick={onNext} aria-label="Next alert"><ChevronRight size={15} /></button>
          <span className="sub" style={{ marginLeft: 6 }}>↑ ↓ to navigate · Esc to close</span>
          <button className="btn sm" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="sub">Alert #{item.rank} of 200</div>
            <h2 style={{ fontSize: 22, margin: "2px 0 6px" }}>TX <span className="mono" style={{ fontSize: 20 }}>{item.tx_id}</span></h2>
            <span className={"badge " + item.action}>{ACTION_LABEL[item.action]}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: SEV_COLOR[item.action], lineHeight: 1 }}>{riskIndex(item.score)}</div>
            <div className="sub">risk score / 100</div>
            <div style={{ fontWeight: 600, marginTop: 6 }}>{money2(item.amount)}</div>
          </div>
        </div>

        <div className="sect">Signal fingerprint <InfoTip>The shape shows which behaviour patterns pushed this transaction toward fraud, and how hard. A spike means one signal dominates.</InfoTip></div>
        <SignalRadar signals={item.signals} color={SEV_COLOR[item.action]} />

        {why && (
          <>
            <div className="sect">Why it was flagged</div>
            <div className={"why " + why.verdict}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className={"badge " + why.verdict}><AlertTriangle size={13} />{why.verdict_label}</span>
                <InfoTip>"Likely fraud" means a risk score of 90 or more. "Suspected fraud" is still in the top 200 and needs a look, but the model is less sure.</InfoTip>
              </div>
              <ul>{why.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          </>
        )}

        <div className="sect">Transaction details</div>
        <dl className="kv">
          <dt>Transaction ID</dt><dd className="mono">{item.tx_id}</dd>
          <dt>Amount</dt><dd>{money2(item.amount)}</dd>
          <dt>Time of day</dt><dd>{String(item.hour).padStart(2, "0")}:00</dd>
          <dt>Queue rank</dt><dd>#{item.rank} of 200</dd>
          <dt>Risk score</dt><dd>{riskIndex(item.score)} / 100</dd>
          <dt>Severity</dt><dd>{SEVERITY[item.action]}</dd>
          <dt>Recommended action</dt><dd>{ACTION_LABEL[item.action].split("· ")[1]}</dd>
        </dl>

        <div className="sect">Signal evidence <InfoTip>V1–V28 are anonymised behaviour patterns (the bank hides what they mean for privacy). "Typical" is the average across normal training transactions; "Std devs" is how many standard deviations this transaction is away from it. "Push" is that signal's share of everything pushing the transaction toward fraud, from the interpretable linear model.</InfoTip></div>
        {details.length ? (
          <div className="evidence">
            <div className="ev-head"><span>Signal</span><span className="num">Value</span><span className="num">Typical</span><span className="num">Std devs</span><span>Push toward fraud</span></div>
            {details.map((d) => (
              <div key={d.label} className="ev-row" title={d.text}>
                <span>{d.label}</span>
                <span className="num mono">{d.display ?? "–"}</span>
                <span className="num mono">{d.typical == null ? "–" : d.feature === "log_amount" ? money2(d.typical) : d.typical.toFixed(2)}</span>
                <span className="num mono" style={{ color: Math.abs(d.z ?? 0) >= 3 ? "var(--red)" : "inherit" }}>{d.z == null ? "–" : `${d.z > 0 ? "+" : ""}${d.z.toFixed(1)}`}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--track)" }}><span className="grow" style={{ display: "block", width: `${(d.impact / max) * 100}%`, height: "100%", borderRadius: 4, background: SEV_COLOR[item.action] }} /></span>
                  <span className="mono" style={{ width: 34, textAlign: "right" }}>{Math.round(d.share * 100)}%</span>
                </span>
                <span className="ev-text">{d.text}</span>
              </div>
            ))}
          </div>
        ) : <p className="sub">No single signal dominates this alert.</p>}

        <div className="sect">Analyst note</div>
        <div className="note">{item.note}</div>
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => { navigator.clipboard?.writeText(item.note); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy note"}
        </button>

        <div className="sect">Cardholder message · {decision === "APPROVE_SMS" ? "APPROVED" : item.draft.status.replace("_", " ")}</div>
        <div className="sms">{item.draft.text}</div>

        <div className="sect">Decision</div>
        {decision ? (
          <div className="badge ok" style={{ padding: "8px 14px", fontSize: 13 }}><Check size={14} />{DECISION_LABEL[decision]} · recorded in audit log</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {needsSms && <button className="btn primary" disabled={busy} onClick={() => go("APPROVE_SMS")}><Send size={14} />Approve &amp; send SMS</button>}
            <button className="btn" disabled={busy} onClick={() => go("ESCALATE")}><ArrowUpRight size={14} />Escalate</button>
            <button className="btn danger" disabled={busy} onClick={() => go("DISMISS")}><Ban size={14} />Dismiss</button>
          </div>
        )}
        {err && <p className="sub" style={{ color: "var(--red)", marginTop: 8 }}>{err}</p>}
        <p className="sub" style={{ marginTop: 10 }}>Human in the loop: nothing is sent to a customer without analyst approval. Every decision is logged. (No real SMS is sent in this build.)</p>

        <div className="sect">Actual outcome</div>
        <span className={"badge " + (item.is_fraud ? "fraud" : "fa")}>{item.is_fraud ? "Confirmed fraud" : "False alarm"}</span>
      </aside>
    </>
  );
}

/** One-line table reason: the two strongest signals with how far they are from normal. */
function whyShort(r) {
  const d = (r.details || []).slice(0, 2);
  if (!d.length) return r.reasons[0]?.label || "–";
  return d.map((x) => x.z == null ? x.label : `${x.label} (${Math.abs(x.z).toFixed(1)}σ ${x.z > 0 ? "high" : "low"})`).join(", ");
}

export default function AlertQueue({ queue, decisions, decide }) {
  const [sev, setSev] = useState("ALL");
  const [outcome, setOutcome] = useState("ALL");
  const [verdict, setVerdict] = useState("ALL");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);

  const rows = useMemo(() => queue.filter((r) =>
    (sev === "ALL" || r.action === sev) &&
    (verdict === "ALL" || r.why?.verdict === verdict) &&
    (outcome === "ALL" || (outcome === "FRAUD" ? r.is_fraud : !r.is_fraud)) &&
    (!q || String(r.tx_id).includes(q.trim()) || String(r.rank) === q.trim().replace("#", ""))), [queue, sev, verdict, outcome, q]);
  const idx = rows.findIndex((r) => r.tx_id === sel);
  const item = idx >= 0 ? rows[idx] : null;
  const step = (d) => rows.length && setSel(rows[(Math.max(idx, 0) + d + rows.length) % rows.length].tx_id);

  return (
    <>
      <Card title="Ranked top-200 alert queue" sub="Open the highest-risk transactions first. Every alert says why it was flagged. Click a row for the full evidence, transaction details, the analyst note and the decision panel."
        right={<a className="btn sm" href="/api/queue/export.csv" download><Download size={14} />Export CSV</a>}
        tip="Alerts are ranked by risk score. The top 20 are Critical, ranks 21–100 are High and 101–200 are Watch.">
        <div className="toolbar">
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 11, top: 11, color: "var(--faint)" }} />
            <input className="input" style={{ paddingLeft: 32, width: 210 }} placeholder="Search TX id or rank…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search alerts" />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Filter by severity">
            {["ALL", "BLOCK_AND_CALL", "HOLD_FOR_REVIEW", "MONITOR"].map((f) => (
              <button key={f} className="pill" aria-pressed={sev === f} onClick={() => setSev(f)}>{f === "ALL" ? `All ${queue.length}` : SEVERITY[f]}</button>
            ))}
          </div>
          <div className="spacer" />
          <select className="select" value={verdict} onChange={(e) => setVerdict(e.target.value)} aria-label="Filter by verdict">
            <option value="ALL">Verdict: all</option><option value="LIKELY_FRAUD">Likely fraud</option><option value="SUSPECTED_FRAUD">Suspected fraud</option>
          </select>
          <select className="select" value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="Filter by backtest outcome">
            <option value="ALL">Outcome: all</option><option value="FRAUD">Confirmed fraud</option><option value="FA">False alarms</option>
          </select>
        </div>
        {rows.length === 0 ? <Empty>No alerts match these filters.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rank</th><th>Transaction</th><th className="num">Amount</th><th>Risk</th><th>Severity</th><th>Verdict</th><th>Why flagged</th><th>Outcome</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.tx_id} className={"click" + (sel === r.tx_id ? " sel" : "")} tabIndex={0} onClick={() => setSel(r.tx_id)} onKeyDown={(e) => e.key === "Enter" && setSel(r.tx_id)}>
                    <td className="mono">#{r.rank}</td>
                    <td className="mono">{r.tx_id}</td>
                    <td className="num">{money2(r.amount)}</td>
                    <td><span className="riskbar"><i style={{ width: `${r.score * 100}%` }} /></span><span className="mono">{riskIndex(r.score)}</span></td>
                    <td><span className={"badge " + r.action}>{SEVERITY[r.action]}</span></td>
                    <td>{r.why && <span className={"badge " + r.why.verdict}>{r.why.verdict_label}</span>}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{whyShort(r)}</td>
                    <td><span className={"badge " + (r.is_fraud ? "fraud" : "fa")}>{r.is_fraud ? "Fraud" : "False alarm"}</span></td>
                    <td>{decisions[r.tx_id] ? <span className="badge ok">{DECISION_LABEL[decisions[r.tx_id]]}</span> : <span style={{ color: "var(--faint)" }}>Open</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Drawer item={item} onClose={() => setSel(null)} onPrev={() => step(-1)} onNext={() => step(1)} decision={item && decisions[item.tx_id]} decide={decide} />
    </>
  );
}
