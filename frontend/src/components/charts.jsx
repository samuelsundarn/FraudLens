import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,
  PieChart, Pie, Cell, ComposedChart, Bar, Legend, ScatterChart, Scatter, ZAxis, Treemap,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Line,
} from "recharts";
import { COLORS, SEV_COLOR, SEVERITY, pct, money } from "../api.js";
import { ChartTooltip } from "./ui.jsx";

const axis = { stroke: "var(--border-2)", tick: { fill: "var(--muted)", fontSize: 11.5 } };
const short = (l) => l.replace("pattern ", "").replace("unusual amount", "Amount").replace("unusual time of day", "Time of day");

/** 200 ticks, one per alert, in rank order. Red = confirmed fraud. */
export function QueueStrip({ queue }) {
  return (
    <>
      <div className="strip" role="img" aria-label="Each tick is one alert in rank order. Red ticks are confirmed fraud.">
        {queue.map((q, i) => <span key={q.rank} style={{ "--i": i }} className={q.is_fraud ? "hit" : ""} title={`#${q.rank} · ${q.is_fraud ? "confirmed fraud" : "false alarm"}`} />)}
      </div>
      <div className="legend">
        <span><i style={{ background: COLORS.red }} />Confirmed fraud</span>
        <span><i style={{ background: "var(--neutral)" }} />False alarm</span>
        <span>Rank 1 → 200, left to right, two rows of 100</span>
      </div>
    </>
  );
}

/** Cumulative fraud caught as analysts work down the queue vs random review. */
export function CaptureCurve({ s }) {
  const rate = s.test_frauds / s.analytics.test_volume;
  const data = s.topk_curve.filter((p) => p.k <= 600).map((p) => ({
    k: p.k, model: p.caught, random: +(p.k * rate).toFixed(2), perfect: Math.min(p.k, s.test_frauds),
  }));
  return (
    <div style={{ height: 290 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 14 }}>
          <defs><linearGradient id="capg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={COLORS.cyan} stopOpacity=".5" /><stop offset="1" stopColor={COLORS.cyan} stopOpacity=".02" /></linearGradient></defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="k" {...axis} label={{ value: "Alerts reviewed (rank order)", position: "insideBottom", offset: -8, fill: "var(--muted)", fontSize: 11.5 }} />
          <YAxis {...axis} width={46} />
          <Tooltip content={<ChartTooltip labelFormatter={(k) => `Top ${k} alerts`} />} />
          <Legend verticalAlign="top" height={26} iconType="plainline" />
          <ReferenceLine x={s.capacity} stroke={COLORS.amber} strokeDasharray="4 4" label={{ value: "Analyst capacity", fill: COLORS.amber, fontSize: 11, position: "insideTopRight" }} />
          <Area name="Perfect ranking" dataKey="perfect" stroke="var(--faint)" strokeDasharray="5 4" fill="none" dot={false} />
          <Area name="FraudLens" dataKey="model" stroke={COLORS.cyan} strokeWidth={2.5} fill="url(#capg)" dot={false} />
          <Area name="Random review" dataKey="random" stroke={COLORS.red} strokeWidth={1.5} fill="none" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Severity mix of the queue with per-tier hit-rate. */
export function SeverityDonut({ s }) {
  const sev = s.analytics.severity;
  const keys = ["BLOCK_AND_CALL", "HOLD_FOR_REVIEW", "MONITOR"];
  const data = keys.map((k) => ({ key: k, name: SEVERITY[k], value: sev[k].alerts }));
  return (
    <div>
      <div style={{ position: "relative", height: 200 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none" cornerRadius={5}>
              {data.map((d) => <Cell key={d.key} fill={SEV_COLOR[d.key]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} alerts`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="gauge-num"><div><b>{s.capacity}</b><small>alerts / day</small></div></div>
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
        {keys.map((k) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", fontSize: 12.5 }}>
            <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: SEV_COLOR[k], marginRight: 8 }} />{SEVERITY[k]} · {sev[k].alerts} alerts</span>
            <span style={{ color: "var(--muted)" }}>{sev[k].frauds} fraud</span>
            <b style={{ minWidth: 44, textAlign: "right" }}>{pct(sev[k].frauds / Math.max(sev[k].alerts, 1))}</b>
          </div>
        ))}
        <p className="sub" style={{ marginTop: 2 }}>Right-hand figure = hit rate inside each tier.</p>
      </div>
    </div>
  );
}

/** Hour-by-hour threat timeline of the held-out day. */
export function ThreatTimeline({ s }) {
  const data = s.analytics.hourly.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}h` }));
  return (
    <div style={{ height: 290 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...axis} interval={1} />
          <YAxis {...axis} width={40} allowDecimals={false} />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => `Hour ${l}`} />} cursor={{ fill: "var(--hover)" }} />
          <Legend verticalAlign="top" height={26} iconType="circle" iconSize={8} />
          <Bar name="Fraud caught" dataKey="caught" stackId="a" fill={COLORS.red} radius={[0, 0, 0, 0]} />
          <Bar name="Fraud missed" dataKey="missed" stackId="a" fill={COLORS.amber} />
          <Bar name="False alarms" dataKey="false_alarms" stackId="a" fill="var(--neutral-2)" radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Threat landscape: every alert and every missed fraud, amount vs risk. */
export function ThreatLandscape({ queue, missed }) {
  const f = (a) => ({ amount: Math.max(a.amount, 1), score: a.score * 100, tx: a.tx_id, rank: a.rank });
  const hit = queue.filter((q) => q.is_fraud).map(f);
  const fa = queue.filter((q) => !q.is_fraud).map(f);
  const ms = missed.map(f);
  const maxA = Math.max(10, ...queue.map((q) => q.amount), ...missed.map((m) => m.amount));
  const top = 10 ** Math.ceil(Math.log10(maxA));
  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return <div className="tt"><b>TX {p.tx} · rank #{p.rank}</b><div>Amount: <span style={{ color: "var(--text)" }}>${p.amount.toLocaleString()}</span></div><div>Risk: <span style={{ color: "var(--text)" }}>{p.score.toFixed(1)}</span></div></div>;
  };
  return (
    <div style={{ height: 290 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 14, left: -8, bottom: 14 }}>
          <CartesianGrid />
          <XAxis type="number" dataKey="amount" scale="log" domain={[1, top]} ticks={[1, 10, 100, 1000, top].filter((v, i, a) => a.indexOf(v) === i)} tickFormatter={money} {...axis}
            label={{ value: "Transaction amount (log scale)", position: "insideBottom", offset: -8, fill: "var(--muted)", fontSize: 11.5 }} />
          <YAxis type="number" dataKey="score" domain={[0, 100]} {...axis} width={44} label={{ value: "Risk", angle: -90, position: "insideLeft", offset: 18, fill: "var(--muted)", fontSize: 11.5 }} />
          <ZAxis range={[46, 46]} />
          <Tooltip content={<Tip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--border-2)" }} />
          <Legend verticalAlign="top" height={26} iconType="circle" iconSize={8} />
          <Scatter name="False alarm" data={fa} fill="var(--neutral-3)" fillOpacity={0.75} />
          <Scatter name="Confirmed fraud" data={hit} fill={COLORS.red} fillOpacity={0.9} />
          <Scatter name="Missed fraud" data={ms} fill={COLORS.amber} shape="cross" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Precision-recall curve (the honest curve for rare fraud) with the operating point at 200 alerts. */
export function PRCurve({ s }) {
  const data = [...s.pr_curve].sort((a, b) => a.recall - b.recall);
  return (
    <div style={{ height: 290 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 14, left: -8, bottom: 14 }}>
          <defs><linearGradient id="prg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={COLORS.violet} stopOpacity=".45" /><stop offset="1" stopColor={COLORS.violet} stopOpacity=".02" /></linearGradient></defs>
          <CartesianGrid />
          <XAxis dataKey="recall" type="number" domain={[0, 1]} tickFormatter={(v) => pct(v)} {...axis} label={{ value: "Recall: share of all fraud caught", position: "insideBottom", offset: -8, fill: "var(--muted)", fontSize: 11.5 }} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => pct(v)} {...axis} width={46} label={{ value: "Precision", angle: -90, position: "insideLeft", offset: 16, fill: "var(--muted)", fontSize: 11.5 }} />
          <Tooltip content={<ChartTooltip valueFormatter={(v) => pct(v, 1)} labelFormatter={(r) => `Recall ${pct(r, 1)}`} />} />
          <ReferenceLine y={s.base_rate} stroke={COLORS.red} strokeDasharray="4 4" label={{ value: "Random baseline", fill: COLORS.red, fontSize: 11, position: "insideTopRight" }} />
          <Area name="Precision" dataKey="precision" stroke={COLORS.violet} strokeWidth={2.5} fill="url(#prg)" dot={false} />
          <ReferenceDot x={s.headline.recall} y={s.headline.precision} r={7} fill={COLORS.cyan} stroke="#fff" strokeWidth={2}
            label={{ value: `${s.capacity} alerts`, fill: COLORS.cyan, fontSize: 11.5, position: "top" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Attack-vector map: which signals lead the alerts. */
export function AttackVectors({ vectors }) {
  const data = vectors.map((v) => ({ name: short(v.label), size: v.alerts }));
  const palette = [COLORS.cyan, COLORS.blue, COLORS.violet, "#d97706", "#b45309", "#fbbf24"];
  const Cell_ = (p) => {
    const { x, y, width, height, index, name, size } = p;
    if (!name) return null;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx={6} fill={palette[index % palette.length]} fillOpacity={0.2} stroke={palette[index % palette.length]} strokeOpacity={0.8} />
        {width > 46 && height > 34 && (<>
          <text x={x + 10} y={y + 20} fill="var(--text)" fontSize={13} fontWeight={700}>{name}</text>
          <text x={x + 10} y={y + 37} fill="var(--muted)" fontSize={11}>{size} alerts</text>
        </>)}
      </g>
    );
  };
  return (
    <div style={{ height: 290 }}>
      <ResponsiveContainer>
        <Treemap data={data} dataKey="size" content={<Cell_ />} isAnimationActive={false}><Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} alerts`} />} /></Treemap>
      </ResponsiveContainer>
    </div>
  );
}

/** Per-alert signal fingerprint. */
export function SignalRadar({ signals, color = COLORS.cyan, height = 240 }) {
  const data = signals.map((s) => ({ signal: short(s.label), impact: s.impact }));
  const max = Math.max(1, ...data.map((d) => d.impact));
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--border-2)" />
          <PolarAngleAxis dataKey="signal" tick={{ fill: "var(--text-2)", fontSize: 11.5 }} />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          <Radar dataKey="impact" name="Signal strength" stroke={color} fill={color} fillOpacity={0.3} strokeWidth={2} />
          <Tooltip content={<ChartTooltip valueFormatter={(v) => Number(v).toFixed(2)} />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cost curve for the optimizer. */
export function CostCurve({ data, capacity, bestK }) {
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer>
        <AreaChart data={data.curve} margin={{ top: 10, right: 12, left: 0, bottom: 14 }}>
          <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={COLORS.blue} stopOpacity=".4" /><stop offset="1" stopColor={COLORS.blue} stopOpacity=".02" /></linearGradient></defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="k" {...axis} label={{ value: "Alerts reviewed per day", position: "insideBottom", offset: -8, fill: "var(--muted)", fontSize: 11.5 }} />
          <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} {...axis} width={52} />
          <Tooltip content={<ChartTooltip valueFormatter={(v) => `$${v.toLocaleString()}`} labelFormatter={(k) => `Top ${k} alerts`} />} />
          <ReferenceLine x={capacity} stroke={COLORS.amber} strokeDasharray="4 4" label={{ value: "Your capacity", fill: COLORS.amber, fontSize: 11, position: "insideTopRight" }} />
          <Area name="Total cost" dataKey="cost" stroke={COLORS.blue} strokeWidth={2.5} fill="url(#cg)" dot={false} />
          <ReferenceDot x={bestK} y={data.best_cost} r={7} fill={COLORS.green} stroke="#fff" strokeWidth={2} label={{ value: "Lowest cost", fill: COLORS.green, fontSize: 11.5, position: "top" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Triage funnel: volume -> alerts -> confirmed fraud (-> missed). */
export function Funnel({ s }) {
  const vol = s.analytics.test_volume, a = s.capacity, hit = Math.round(s.headline.frauds_in_queue), miss = s.test_frauds - hit;
  const rows = [
    ["Transactions scanned", vol, "var(--neutral-2)", "100%"],
    ["Alerts raised", a, COLORS.cyan, pct(a / vol, 2)],
    ["Fraud confirmed", hit, COLORS.red, `${pct(hit / a)} of alerts`],
    ["Fraud missed", miss, COLORS.amber, `${pct(miss / Math.max(s.test_frauds, 1))} of fraud`],
  ];
  return (
    <div className="funnel">
      {rows.map(([name, v, color, note]) => (
        <div key={name}>
          <div className="funnel-label"><span>{name}</span><span style={{ color: "var(--muted)", fontSize: 12 }}>{note}</span></div>
          <div className="bar" style={{ width: `${Math.max(Math.sqrt(v / vol) * 100, 9)}%`, background: color }}>{v.toLocaleString()}</div>
        </div>
      ))}
      <p className="sub">Bar widths use a square-root scale so small numbers stay visible.</p>
    </div>
  );
}
