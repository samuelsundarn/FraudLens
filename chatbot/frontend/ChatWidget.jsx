import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Trash2, RotateCw } from "lucide-react";
import { chatApi } from "./chatApi.js";
import "./chatbot.css";

// ---- easy tweaks -------------------------------------------------------
const TITLE = "FraudLens Assistant";
const SUBTITLE = "Ask anything about this app";
const WELCOME = "Hi, I can explain any screen, metric or setting in FraudLens. What would you like to know?";
const SUGGESTIONS = [
  "What does recall mean here?",
  "How is the risk score calculated?",
  "How do I review an alert?",
  "Why is there a Demo data banner?",
];
// -------------------------------------------------------------------------

/** Minimal, safe formatting: **bold**, `code`, "- " bullets and line breaks (no HTML injection). */
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((t, i) =>
    t.startsWith("**") ? <b key={i}>{t.slice(2, -2)}</b> : t.startsWith("`") ? <code key={i}>{t.slice(1, -1)}</code> : t);
}
function Rich({ text }) {
  const blocks = []; let list = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  text.split("\n").forEach((line) => {
    const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (m) list.push(m[1]); else { flush(); if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>); }
  });
  flush();
  return <>{blocks}</>;
}

export default function ChatWidget({ page }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { chatApi.status().then(setStatus).catch(() => setStatus({ configured: false, enabled: true, offline: true })); }, []);
  useEffect(() => {                                   // restore remembered conversation the first time it opens
    if (!open || loaded) return;
    chatApi.history().then((h) => setMsgs(h)).catch(() => {}).finally(() => setLoaded(true));
  }, [open, loaded]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput(""); setError(null); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: q }]);
    try {
      const r = await chatApi.send(q, page);
      setMsgs((m) => [...m, { role: "bot", text: r.reply }]);
    } catch (e) {
      setError({ message: e.message, retry: q });
      setMsgs((m) => m.slice(0, -1));                 // server drops the failed question too
    } finally { setBusy(false); }
  };
  const clear = async () => { try { await chatApi.clear(); } catch { /* ignore */ } setMsgs([]); setError(null); };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === "Escape") setOpen(false); };

  if (status && status.enabled === false) return null;
  const notReady = status && !status.configured && !status.offline;

  return (
    <>
      {open && (
        <section className="cb-panel" role="dialog" aria-label={TITLE}>
          <header className="cb-head">
            <div className="cb-avatar"><MessageCircle size={16} /></div>
            <div className="cb-title"><b>{TITLE}</b><small><span className={"cb-dot" + (status?.configured ? "" : " off")} />{SUBTITLE}</small></div>
            <button className="cb-icon" onClick={clear} title="Clear conversation" aria-label="Clear conversation" disabled={!msgs.length}><Trash2 size={15} /></button>
            <button className="cb-icon" onClick={() => setOpen(false)} title="Close" aria-label="Close assistant"><X size={17} /></button>
          </header>

          <div className="cb-body" aria-live="polite">
            {notReady && <div className="cb-note">The assistant needs a Gemini key. Add <code>GEMINI_API_KEY</code> to the <code>.env</code> file and restart the server.</div>}
            {status?.offline && <div className="cb-note">Cannot reach the API. Start the backend and reload.</div>}
            <div className="cb-msg bot"><div className="cb-bubble"><Rich text={WELCOME} /></div></div>
            {!msgs.length && (
              <div className="cb-chips">{SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} disabled={busy}>{s}</button>)}</div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={"cb-msg " + m.role}><div className="cb-bubble">{m.role === "bot" ? <Rich text={m.text} /> : m.text}</div></div>
            ))}
            {busy && <div className="cb-msg bot"><div className="cb-bubble cb-typing" aria-label="Assistant is typing"><i /><i /><i /></div></div>}
            {error && (
              <div className="cb-error" role="alert">
                <span>{error.message}</span>
                <button onClick={() => send(error.retry)}><RotateCw size={13} />Retry</button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <footer className="cb-foot">
            <textarea ref={inputRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} maxLength={2000}
              placeholder="Type your question…" aria-label="Message" />
            <button className="cb-send" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send"><Send size={16} /></button>
          </footer>
        </section>
      )}
      <button className={"cb-fab" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)} aria-label={open ? "Close assistant" : "Open assistant"} aria-expanded={open}>
        {open ? <X size={22} key="x" /> : <MessageCircle size={22} key="m" />}
      </button>
    </>
  );
}
