async function req(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) {
    let msg = r.statusText;
    try { const j = await r.json(); msg = typeof j.detail === "string" ? j.detail : msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return r.json();
}
const post = (path, body) => req(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  health: () => req("/api/health"),
  summary: () => req("/api/summary"),
  queue: () => req("/api/queue"),
  cost: (miss, alarm) => req(`/api/cost?miss_cost=${miss}&alarm_cost=${alarm}`),
  samples: () => req("/api/samples"),
  score: (features) => post("/api/score", { features }),
  act: (body) => post("/api/actions", body),
  actions: () => req("/api/actions"),
  dataStatus: () => req("/api/data/status"),
};

/** Stream a (possibly very large) CSV as the raw request body; XHR because fetch has no upload progress. */
export function uploadDataset(file, onProgress) {
  const xhr = new XMLHttpRequest();
  const done = new Promise((resolve, reject) => {
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded, e.total);
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      xhr.status < 300 ? resolve(body) : reject(new Error(typeof body.detail === "string" ? body.detail : xhr.statusText || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
  });
  xhr.open("PUT", `/api/data/upload?filename=${encodeURIComponent(file.name)}`);
  xhr.setRequestHeader("Content-Type", "text/csv");
  xhr.send(file);
  return { done, cancel: () => xhr.abort() };
}

export const ACTION_LABEL = {
  BLOCK_AND_CALL: "Critical · Block & call",
  HOLD_FOR_REVIEW: "High · Hold for review",
  MONITOR: "Watch · Monitor",
  CLEAR: "Clear · Below cutoff",
};
export const SEVERITY = { BLOCK_AND_CALL: "Critical", HOLD_FOR_REVIEW: "High", MONITOR: "Watch", CLEAR: "Clear" };
export const COLORS = { red: "var(--red)", amber: "var(--orange)", cyan: "var(--accent)", blue: "var(--bronze)", violet: "var(--steel)", green: "var(--green)", slate: "var(--neutral)" };
export const SEV_COLOR = { BLOCK_AND_CALL: COLORS.red, HOLD_FOR_REVIEW: COLORS.amber, MONITOR: COLORS.cyan, CLEAR: COLORS.green };
export const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
export const money = (x) => `$${Math.round(x).toLocaleString()}`;
export const money2 = (x) => `$${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const riskIndex = (s) => Math.min(99.9, s * 100).toFixed(1);  // capped: a model never knows it is 100% sure
