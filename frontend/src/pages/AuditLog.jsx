import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { api, money2 } from "../api.js";
import { Card, Empty } from "../components/ui.jsx";

const LABEL = { APPROVE_SMS: ["ok", "SMS approved"], ESCALATE: ["MONITOR", "Escalated"], DISMISS: ["fa", "Dismissed"] };

export default function AuditLog() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => api.actions().then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  return (
    <Card title="Analyst audit trail" sub="Every decision taken on an alert, with who and when — required for regulated payments"
      right={<><button className="btn sm" onClick={load}><RefreshCw size={14} />Refresh</button><a className="btn sm" href="/api/actions/export.csv" download><Download size={14} />Export CSV</a></>}
      tip="Decisions are appended to a log file on the server (backend/artifacts/audit_log.jsonl). In production this would be an immutable, access-controlled store.">
      {err && <p className="sub" style={{ color: "var(--red)" }}>{err}</p>}
      {rows && rows.length === 0 && <Empty>No decisions yet. Open an alert in the Alert Queue and approve, escalate or dismiss it.</Empty>}
      {rows && rows.length > 0 && (
        <div className="table-wrap"><table>
          <thead><tr><th>Time (UTC)</th><th>Analyst</th><th>Transaction</th><th>Rank</th><th>Decision</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}><td className="mono">{r.ts.replace("T", " ").replace("+00:00", "")}</td><td>{r.analyst}</td><td className="mono">{r.tx_id}</td><td className="mono">#{r.rank}</td>
              <td><span className={"badge " + LABEL[r.decision][0]}>{LABEL[r.decision][1]}</span></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  );
}
