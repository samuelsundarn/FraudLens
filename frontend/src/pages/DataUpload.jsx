import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Loader2, Database } from "lucide-react";
import { api, uploadDataset } from "../api.js";
import { Card } from "../components/ui.jsx";

const mb = (b) => `${(b / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;

export default function DataUpload({ onReload }) {
  const [info, setInfo] = useState(null);          // /api/data/status
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [up, setUp] = useState(null);              // { loaded, total, start }
  const [err, setErr] = useState(null);
  const cancelRef = useRef(null);
  const inputRef = useRef(null);
  const logRef = useRef(null);

  const refresh = useCallback(() => api.dataStatus().then((s) => { setInfo(s); return s; }), []);
  useEffect(() => { refresh().catch((e) => setErr(e.message)); }, [refresh]);

  // poll while the server is retraining; reload every page's data when it finishes
  const training = info?.status === "training";
  useEffect(() => {
    if (!training) return;
    const t = setInterval(() => refresh().then((s) => { if (s.status === "done") onReload(); }).catch(() => {}), 1500);
    return () => clearInterval(t);
  }, [training, refresh, onReload]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [info?.log?.length]);

  const pick = (f) => {
    setErr(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) return setErr("Please choose a .csv file.");
    if (info && f.size > info.max_upload_mb * 1e6 * 1.048576) return setErr(`File is larger than the ${info.max_upload_mb.toLocaleString()} MB limit.`);
    setFile(f);
  };

  const start = async () => {
    setErr(null);
    const startAt = Date.now();
    setUp({ loaded: 0, total: file.size, start: startAt });
    const { done, cancel } = uploadDataset(file, (loaded, total) => setUp({ loaded, total, start: startAt }));
    cancelRef.current = cancel;
    try {
      await done;
      setFile(null);
      await refresh();
    } catch (e) {
      setErr(e.message);
      refresh().catch(() => {});
    } finally {
      setUp(null); cancelRef.current = null;
    }
  };

  const ds = info?.dataset;
  const busy = !!up || training;
  const secs = up ? (Date.now() - up.start) / 1000 : 0;
  const rate = up && secs > 0.5 ? up.loaded / secs : 0;

  return (
    <>
      <Card title="Active dataset" sub="Every number, chart and alert in the app is computed from this data."
        right={<Database size={18} color="var(--muted)" />}>
        {ds ? (
          <dl className="kv">
            <dt>Source</dt><dd>{ds.source}</dd>
            <dt>Transactions</dt><dd>{ds.rows.toLocaleString()} <span className="sub">({ds.frauds.toLocaleString()} labelled fraud)</span></dd>
            <dt>Model trained</dt><dd>{ds.trained_at}</dd>
            <dt>Headline</dt><dd>{ds.statement}</dd>
          </dl>
        ) : <p className="sub">No trained model yet. Upload a file below.</p>}
      </Card>

      <Card title="Upload new transactions" sub="Upload a CSV and FraudLens retrains the model and recalculates the queue, reasons, dashboard, cost curve and scanner on the new data."
        tip="The file is streamed to the server in chunks, so large files (hundreds of MB) are fine. If training fails, the previous data stays in use.">
        <div
          className={"dropzone" + (drag ? " drag" : "") + (busy ? " disabled" : "")}
          role="button" tabIndex={0} aria-label="Choose a CSV file to upload"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) pick(e.dataTransfer.files[0]); }}>
          <UploadCloud size={30} />
          <b>Drop a CSV here or click to browse</b>
          <span className="sub">Up to {info ? info.max_upload_mb.toLocaleString() : "2,048"} MB · columns <span className="mono">Time, V1…V28, Amount, Class</span> (the Kaggle creditcard.csv layout)</span>
          <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
        </div>

        {file && !up && (
          <div className="file-row">
            <FileSpreadsheet size={18} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
            <span className="sub">{mb(file.size)}</span>
            <button className="btn sm" onClick={() => setFile(null)} aria-label="Remove file"><X size={14} /></button>
            <button className="btn primary sm" disabled={busy} onClick={start}><UploadCloud size={14} />Upload &amp; retrain</button>
          </div>
        )}

        {up && (
          <div className="progress-block">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Uploading… {mb(up.loaded)} of {mb(up.total)}{rate ? ` · ${mb(rate)}/s` : ""}</span>
              <b>{Math.floor((up.loaded / up.total) * 100)}%</b>
            </div>
            <div className="progress"><i style={{ width: `${(up.loaded / up.total) * 100}%` }} /></div>
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => cancelRef.current?.()}><X size={14} />Cancel</button>
          </div>
        )}

        {err && <div className="upload-msg fail"><AlertTriangle size={16} />{err}</div>}

        {info && info.status !== "idle" && !up && (
          <div style={{ marginTop: 16 }}>
            {training && <div className="upload-msg"><Loader2 size={16} className="spin" />Retraining on <b>{info.filename}</b> ({mb(info.bytes)})… this takes a minute or two for ~300k rows.</div>}
            {info.status === "done" && <div className="upload-msg ok"><CheckCircle2 size={16} />Retrained on <b>{info.filename}</b>. Every page now reflects the new data. Audit log decisions for the old queue were archived.</div>}
            {info.status === "failed" && !err && <div className="upload-msg fail"><AlertTriangle size={16} />{info.error}</div>}
            {info.log?.length > 0 && <pre className="train-log" ref={logRef}>{info.log.join("\n")}</pre>}
          </div>
        )}
      </Card>
    </>
  );
}
