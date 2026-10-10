import { useCallback, useEffect, useState } from "react";
import { LayoutDashboard, ListChecks, ScanSearch, Calculator, ClipboardList, BookOpen, UploadCloud } from "lucide-react";
import { api } from "./api.js";
import { LensMark, PoweredByGenesis, GenesisMark } from "./components/Brand.jsx";
import { ErrorBoundary, Skeleton, DemoBanner, ThemeToggle, useCardGlow } from "./components/ui.jsx";
import ChatWidget from "@chatbot/ChatWidget.jsx";
import CommandCenter from "./pages/CommandCenter.jsx";
import AlertQueue from "./pages/AlertQueue.jsx";
import LiveScanner from "./pages/LiveScanner.jsx";
import CostOptimizer from "./pages/CostOptimizer.jsx";
import AuditLog from "./pages/AuditLog.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import DataUpload from "./pages/DataUpload.jsx";

const PAGES = [
  { id: "command", label: "Command Center", icon: LayoutDashboard, title: "Command Center", group: "Operate" },
  { id: "queue", label: "Alert Queue", icon: ListChecks, title: "Daily Alert Queue", group: "Operate" },
  { id: "scanner", label: "Live Scanner", icon: ScanSearch, title: "Live Transaction Scanner", group: "Operate" },
  { id: "optimizer", label: "Cost Optimizer", icon: Calculator, title: "Alert Cutoff Optimizer", group: "Analyse" },
  { id: "data", label: "Data Upload", icon: UploadCloud, title: "Upload & Retrain", group: "Govern" },
  { id: "audit", label: "Audit Log", icon: ClipboardList, title: "Analyst Audit Log", group: "Govern" },
  { id: "method", label: "How it works", icon: BookOpen, title: "How FraudLens Works", group: "Govern" },
];
const pageFromHash = () => PAGES.find((p) => p.id === window.location.hash.replace("#/", ""))?.id || "command";

export default function App() {
  useCardGlow();
  const [page, setPage] = useState(pageFromHash());
  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState([]);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [decisions, setDecisions] = useState({}); // tx_id -> decision (this session)

  useEffect(() => {
    const on = () => setPage(pageFromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const load = useCallback(() => Promise.all([api.summary(), api.queue()])
    .then(([s, q]) => { setSummary(s); setQueue(q); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const reload = useCallback(() => { setDecisions({}); load(); }, [load]);  // after a retrain on uploaded data
  useEffect(() => {
    const ping = () => api.health().then(setHealth).catch(() => setHealth({ ok: false }));
    ping(); const t = setInterval(ping, 30000); return () => clearInterval(t);
  }, []);

  const decide = useCallback(async (item, decision, comment = "") => {
    await api.act({ tx_id: item.tx_id, rank: item.rank, decision, comment });
    setDecisions((d) => ({ ...d, [item.tx_id]: decision }));
  }, []);

  const cur = PAGES.find((p) => p.id === page);
  const demo = summary?.is_demo_data;
  const critical = queue.filter((q) => q.action === "BLOCK_AND_CALL").length;
  const groups = [...new Set(PAGES.map((p) => p.group))];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <LensMark />
          <div><div className="brand-name">Fraud<i>Lens</i></div><div className="brand-sub">Triage Command</div></div>
        </div>
        <nav className="nav" aria-label="Main">
          {groups.map((g) => (
            <div key={g}>
              <div className="nav-label">{g}</div>
              {PAGES.filter((p) => p.group === g).map(({ id, label, icon: Icon }) => (
                <a key={id} href={`#/${id}`} aria-current={page === id ? "page" : undefined} title={label}>
                  <Icon size={18} /><span>{label}</span>
                  {id === "queue" && critical > 0 && <span className="count">{critical}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sys-card" aria-label="System status">
            <div className="sys-row"><span><span className={"dot" + (health?.ok ? "" : " off")} />API</span><b>{health?.ok ? "online" : "offline"}</b></div>
            <div className="sys-row"><span>Model</span><b>{summary?.model_version || "–"}</b></div>
            <div className="sys-row"><span>Engine</span><b>{summary ? (summary.best_model === "logistic_regression" ? "Logistic" : "Grad. boost") : "–"}</b></div>
          </div>
          <PoweredByGenesis />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div><div className="crumbs">FraudLens / {cur.group}</div><h1>{cur.title}</h1></div>
          <div className="spacer" />
          <ThemeToggle />
          <div className="user"><div className="avatar" aria-hidden>FA</div><div>Fraud Analyst<small>Genesis Risk Ops</small></div></div>
        </header>

        <main className="content">
          {error && <div className="card error-box"><h2>Could not reach the FraudLens API</h2><p className="sub">{error}. Start the backend (see README) and reload this page.</p></div>}
          {!error && !summary && <><Skeleton h={160} /><div className="grid g4"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div></>}
          {summary && demo && page !== "method" && <DemoBanner />}
          {summary && (
            <ErrorBoundary key={page}>
              {page === "command" && <CommandCenter s={summary} queue={queue} />}
              {page === "queue" && <AlertQueue queue={queue} decisions={decisions} decide={decide} />}
              {page === "scanner" && <LiveScanner s={summary} />}
              {page === "optimizer" && <CostOptimizer s={summary} />}
              {page === "audit" && <AuditLog />}
              {page === "data" && <DataUpload onReload={reload} />}
              {page === "method" && <HowItWorks s={summary} />}
            </ErrorBoundary>
          )}
        </main>

        <footer className="footer">
          {/*<span><GenesisMark size={14} /> <b>FraudLens</b> · Powered by <b>Genesis</b> · Built for the Maverick Skill Sprint</span> */}
          <span>Nothing is sent to customers without analyst approval.</span>
        </footer>
      </div>
      <ChatWidget page={cur.title} />
    </div>
  );
}
