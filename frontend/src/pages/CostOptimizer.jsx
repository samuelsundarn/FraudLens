import { useEffect, useState } from "react";
import { PiggyBank, Gauge as GaugeIcon, Users } from "lucide-react";
import { api, money } from "../api.js";
import { Card, Kpi } from "../components/ui.jsx";
import { CostCurve } from "../components/charts.jsx";

export default function CostOptimizer({ s }) {
  const [miss, setMiss] = useState(500);
  const [alarm, setAlarm] = useState(15);
  const [data, setData] = useState(null);
  useEffect(() => { api.cost(miss, alarm).then(setData).catch(() => setData(null)); }, [miss, alarm]);
  const cap = s.capacity;
  return (
    <>
      <div className="grid g3">
        <Kpi icon={PiggyBank} color="var(--green)" label="Saved at 200 alerts" value={data ? money(data.saving_vs_nothing_at_capacity) : "–"} meta="versus doing nothing"
          tip="Cost of missed fraud if nobody reviewed anything, minus today's cost with the 200-alert queue." />
        <Kpi icon={GaugeIcon} color="var(--accent)" label="Lowest-cost cutoff" value={data ? `${data.best_k} alerts` : "–"} meta="where total cost is minimal"
          tip="The number of alerts per day that minimises (missed fraud × cost) + (false alarms × cost) with the values you set." />
        <Kpi icon={Users} color="var(--orange)" label="Capacity check" value={data ? (data.best_k > cap ? "Add analysts" : "Capacity is enough") : "–"} meta={data ? (data.best_k > cap ? `${data.best_k - cap} extra reviews/day would pay off` : "reviewing more costs more than it saves") : ""} />
      </div>
      <div className="grid g-12">
        <Card title="Set your costs" sub="What does each mistake cost the business?" tip="A missed fraud costs the stolen amount plus chargeback and trust damage. A false alarm costs analyst time and an annoyed customer.">
          <div className="slider-row" style={{ gridTemplateColumns: "1fr" }}><label htmlFor="miss">Cost of a <b>missed fraud</b>: <b style={{ color: "var(--red)" }}>${miss}</b></label>
            <input id="miss" type="range" min="50" max="3000" step="50" value={miss} onChange={(e) => setMiss(+e.target.value)} /></div>
          <div className="slider-row" style={{ gridTemplateColumns: "1fr", marginTop: 8 }}><label htmlFor="alarm">Cost of a <b>false alarm</b>: <b style={{ color: "var(--orange)" }}>${alarm}</b></label>
            <input id="alarm" type="range" min="1" max="200" step="1" value={alarm} onChange={(e) => setAlarm(+e.target.value)} /></div>
          {data && <p className="sub" style={{ marginTop: 16 }}>With these costs, total daily cost bottoms out at <b style={{ color: "var(--text)" }}>{data.best_k} alerts</b> ({money(data.best_cost)}). Doing nothing costs {money(data.do_nothing_cost)}.</p>}
        </Card>
        <Card title="Total cost vs alerts reviewed" sub="Green dot = cheapest cutoff"><>{data && <CostCurve data={data} capacity={cap} bestK={data.best_k} />}</></Card>
      </div>
    </>
  );
}
