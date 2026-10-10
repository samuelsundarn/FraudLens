/** Talks to /api/chat. The Gemini key never reaches the browser. */
const KEY = "fl-chat-sid";

export function sessionId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, ""); localStorage.setItem(KEY, id); }
    return id;
  } catch { return "anonymous-session"; }
}

async function j(r) {
  if (!r.ok) {
    let msg = r.statusText;
    try { const b = await r.json(); if (typeof b.detail === "string") msg = b.detail; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return r.json();
}

export const chatApi = {
  status: () => fetch("/api/chat/status").then(j),
  history: () => fetch(`/api/chat/history?session_id=${sessionId()}`).then(j),
  clear: () => fetch(`/api/chat/history?session_id=${sessionId()}`, { method: "DELETE" }).then(j),
  send: (message, page) => fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId(), message, page }) }).then(j),
};
