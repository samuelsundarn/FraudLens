import { Component, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, TriangleAlert, ShieldCheck, ShieldX, Sun, Moon } from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";

/** "What does this mean?" plain-language tooltip — keyboard and hover accessible.
 *  The bubble is portalled to <body> with fixed positioning, so cards, tables and the drawer can't clip or cover it. */
export function InfoTip({ title = "In plain words", children }) {
  const id = useId();
  const iconRef = useRef(null);
  const bubbleRef = useRef(null);
  const [anchor, setAnchor] = useState(null);     // icon rect while open
  const [pos, setPos] = useState(null);
  const show = () => setAnchor(iconRef.current.getBoundingClientRect());
  const hide = () => { setAnchor(null); setPos(null); };

  useLayoutEffect(() => {
    if (!anchor || !bubbleRef.current) return;
    const gap = 8, pad = 8, { width: w, height: h } = bubbleRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(anchor.left + anchor.width / 2 - w / 2, pad), window.innerWidth - w - pad);
    let top = anchor.bottom + gap;
    if (top + h > window.innerHeight - pad) top = Math.max(pad, anchor.top - h - gap);   // flip above
    setPos({ left, top });
  }, [anchor]);
  useEffect(() => {   // a fixed bubble would drift away from its icon on scroll, so close it instead
    if (!anchor) return;
    window.addEventListener("scroll", hide, true); window.addEventListener("resize", hide);
    return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); };
  }, [anchor]);

  return (
    <span className="tip" ref={iconRef} tabIndex={0} role="button" aria-describedby={id} aria-label={title}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onKeyDown={(e) => e.key === "Escape" && hide()}>
      <HelpCircle size={16} />
      {createPortal(
        <span ref={bubbleRef} id={id} role="tooltip" className={"tip-bubble" + (pos ? " open" : "")}
          style={pos ? { left: pos.left, top: pos.top } : undefined}><b>{title}</b>{children}</span>,
        document.body)}
    </span>
  );
}

export function Card({ title, sub, tip, right, children, className = "", style }) {
  return (
    <section className={"card " + className} style={style}>
      {(title || right) && (
        <div className="card-head">
          <div><h2>{title}</h2>{sub && <p className="sub">{sub}</p>}</div>
          <div className="right">{right}{tip && <InfoTip>{tip}</InfoTip>}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ icon: Icon, label, value, meta, color = "var(--accent)", tip }) {
  return (
    <div className="card kpi" style={{ "--accent-c": color }}>
      <span className="accent-bar" />
      <div className="ico" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}><Icon size={18} /></div>
      <div className="label">{label}{tip && <InfoTip>{tip}</InfoTip>}</div>
      <div className="value"><AnimatedValue value={value} /></div>
      <div className="meta">{meta}</div>
    </div>
  );
}

/** Semicircle radial gauge with a centred number. */
export function Gauge({ value, label, color = "var(--accent)", size = 190, display }) {
  const v = Math.max(0, Math.min(1, value));
  const data = [{ v }, { v: 1 - v }];
  return (
    <div style={{ position: "relative", width: size, height: size * 0.62, margin: "0 auto" }}>
      <PieChart width={size} height={size * 0.62 + 30}>
        <Pie data={[{ v: 1 }]} dataKey="v" startAngle={180} endAngle={0} cx="50%" cy={size * 0.56} innerRadius={size * 0.36} outerRadius={size * 0.46} stroke="none" fill="var(--track)" isAnimationActive={false} />
        <Pie data={data} dataKey="v" startAngle={180} endAngle={0} cx="50%" cy={size * 0.56} innerRadius={size * 0.36} outerRadius={size * 0.46} stroke="none" cornerRadius={8} animationDuration={700}>
          <Cell fill={color} /><Cell fill="transparent" />
        </Pie>
      </PieChart>
      <div className="gauge-num" style={{ top: size * 0.22 }}><div><b style={{ color }}>{display ?? `${Math.round(v * 100)}%`}</b><small>{label}</small></div></div>
    </div>
  );
}

export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <b>{labelFormatter ? labelFormatter(label, payload) : label}</b>
      {payload.filter((p) => p.value != null).map((p, i) => (
        <div key={i}><i style={{ background: p.color || p.fill || p.stroke }} />{p.name}: <span style={{ color: "var(--text)" }}>{valueFormatter(p.value, p)}</span></div>
      ))}
    </div>
  );
}

export const Skeleton = ({ h = 160 }) => <div className="skel" style={{ minHeight: h }} />;
export const Empty = ({ children }) => <div className="card empty">{children}</div>;

export function DemoBanner() {
  return (
    <div className="warn-banner" role="status">
      <TriangleAlert size={18} />
      <div><b>Demo data in use.</b> Numbers on this screen come from a synthetic stand-in with the same schema as the Kaggle file, so they are <b>not real results</b>.
        Place <span className="mono">creditcard.csv</span> in <span className="mono">backend/data/</span> and run <span className="mono">python train.py</span> to switch to the real dataset.</div>
    </div>
  );
}

export const PassFail = ({ ok, size = 18 }) => ok ? <ShieldCheck size={size} color="var(--green)" /> : <ShieldX size={size} color="var(--red)" />;

export class ErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return <div className="card error-box"><h2>Something went wrong on this screen</h2><p className="sub">{String(this.state.err.message || this.state.err)}</p></div>;
    return this.props.children;
  }
}

/** Counts the first number inside a value up from zero ("$12,345", "87%", "42×"). Skips animation when motion is reduced. */
export function AnimatedValue({ value, duration = 900 }) {
  const text = String(value);
  const m = text.match(/\d[\d,]*\.?\d*/);
  const [shown, setShown] = useState(m ? 0 : 1);
  useEffect(() => {
    if (!m || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(1); return; }
    let raf, t0;
    const tick = (t) => {
      t0 ??= t;
      const k = Math.min(1, (t - t0) / duration);
      setShown(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return text;
  const raw = m[0], target = parseFloat(raw.replace(/,/g, ""));
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  const cur = target * shown;
  const out = raw.includes(",") ? cur.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : cur.toFixed(decimals);
  return text.replace(raw, out);
}

/** Light / dark switch. Choice is remembered; defaults to the OS setting. */
export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("fl-theme", next); } catch { /* storage blocked */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#14110c" : "#f7f2e8");
    setTheme(next);
  };
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button className="icon-btn" onClick={flip} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      <Icon key={theme} size={17} />
    </button>
  );
}

/** Soft amber glow that follows the pointer over any card. One listener for the whole app. */
export function useCardGlow() {
  useEffect(() => {
    const on = (e) => {
      const c = e.target.closest?.(".card");
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", `${e.clientX - r.left}px`);
      c.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, []);
}
