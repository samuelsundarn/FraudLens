"""Reasons, analyst notes, action tiers and PENDING_APPROVAL cardholder drafts."""
import numpy as np

CAPACITY_DEFAULT = 200
BLOCK_RANKS = 20      # top 20 alerts  -> block + call
HOLD_RANKS = 100      # ranks 21-100   -> hold + step-up verification

ACTIONS = {
    "BLOCK_AND_CALL": "Block card, call cardholder to verify",
    "HOLD_FOR_REVIEW": "Hold transaction, send step-up verification",
    "MONITOR": "Approve, watch next 24h",
    "CLEAR": "No action: below the alert cutoff",
}


def label(f):
    if f == "log_amount":
        return "unusual amount"
    if f in ("hour_sin", "hour_cos"):
        return "unusual time of day"
    return f"pattern {f}"


def aggregate(contribs, names):
    """Merge features that share a label (hour_sin + hour_cos -> one 'time of day' signal)."""
    agg = {}
    for c, n in zip(contribs, names):
        lab = label(n)
        if lab in agg:
            agg[lab]["impact"] += float(c)
        else:
            agg[lab] = {"feature": n if not n.startswith("hour_") else "hour", "label": lab, "impact": float(c)}
    return list(agg.values())


def top_reasons(contribs, names, k=3):
    """contribs = coef * standardised value (log-odds push toward fraud). Positive only."""
    items = sorted(aggregate(contribs, names), key=lambda d: -d["impact"])[:k]
    return [{**d, "impact": round(d["impact"], 3)} for d in items if d["impact"] > 0]


def top_signals(contribs, names, k=6):
    """Signal profile for the radar chart: top-k contributions, negatives clipped to 0."""
    items = sorted(aggregate(contribs, names), key=lambda d: -d["impact"])[:k]
    return [{**d, "impact": round(max(d["impact"], 0.0), 3)} for d in items]


def tier(rank, capacity=CAPACITY_DEFAULT):
    """Rank-based tiers. Scores are not calibrated probabilities, so rank (not score) drives the action."""
    if rank > capacity:
        return "CLEAR"
    if rank <= BLOCK_RANKS:
        return "BLOCK_AND_CALL"
    if rank <= HOLD_RANKS:
        return "HOLD_FOR_REVIEW"
    return "MONITOR"


LIKELY_FRAUD_SCORE = 0.90   # calibrated risk at/above which an alert is labelled "Likely fraud", else "Suspected fraud"
TIER_RULE = {
    "BLOCK_AND_CALL": f"Ranks 1-{BLOCK_RANKS} are Critical: the card is blocked and the cardholder is called.",
    "HOLD_FOR_REVIEW": f"Ranks {BLOCK_RANKS + 1}-{HOLD_RANKS} are High: the payment is held until the cardholder verifies it.",
    "MONITOR": f"Ranks {HOLD_RANKS + 1}-{CAPACITY_DEFAULT} are Watch: the payment goes through and the card is watched for 24h.",
}


def signal_details(signals, names, coef, mean, std, amount, hour):
    """Recover the real value behind each signal: impact = coef * z, z = (value - train mean) / train std."""
    col = {n: i for i, n in enumerate(names)}
    total = sum(s["impact"] for s in signals if s["impact"] > 0) or 1.0
    out = []
    for s in signals:
        if s["impact"] <= 0:
            continue
        f, d = s["feature"], {"feature": s["feature"], "label": s["label"], "impact": s["impact"],
                              "share": round(s["impact"] / total, 3)}
        if f == "hour":
            d.update(value=hour, display=f"{hour:02d}:00",
                     text=f"Made around {hour:02d}:00, a time of day when fraud is more common than usual.")
        elif f in col and abs(coef[col[f]]) > 1e-6:
            i = col[f]
            z = round(float(s["impact"] / coef[i]), 1)   # rounded once so the table and the sentence agree
            typical = float(mean[i])
            if f == "log_amount":
                typical = float(np.expm1(typical))
                d.update(value=amount, typical=round(typical, 2), z=z, display=f"${amount:,.2f}",
                         text=f"Amount ${amount:,.2f} vs a typical ${typical:,.2f}; "
                              f"{'unusually large' if z > 0 else 'unusually small'} for this card base.")
            else:
                value = float(s["impact"] / coef[i] * std[i] + mean[i])
                typical = round(typical, 2)
                d.update(value=round(value, 3), typical=typical, z=z, display=f"{value:.2f}",
                         text=f"{f} is {value:.2f} vs a typical {typical:.2f}: {abs(z):.1f} standard deviations "
                              f"{'above' if z > 0 else 'below'} normal transactions.")
        out.append(d)
    return out


def why_flagged(item, metrics, details):
    """Plain-English reasons this transaction is in the queue, and why it got its verdict and action."""
    score, rank, act = item["score"], item["rank"], item["action"]
    risk = min(score * 100, 99.9)
    volume, cap = metrics["test_rows"], metrics["capacity"]
    likely = score >= LIKELY_FRAUD_SCORE
    lead = ", ".join(d["label"] for d in details[:3]) or "no single dominant signal"
    strong = [d for d in details if abs(d.get("z", 0)) >= 3]
    points = [
        f"Risk score {risk:.1f}/100: the model estimates about a {risk:.0f}% chance this is fraud "
        f"({'at or above' if likely else 'below'} the {LIKELY_FRAUD_SCORE * 100:.0f} line for 'Likely fraud').",
        f"Ranked #{rank} of {volume:,} transactions on the day (top {rank / volume * 100:.3f}%). "
        f"Only the top {cap} are alerted (risk >= {metrics['threshold_score_at_capacity'] * 100:.1f}).",
        f"Strongest signals: {lead}." + (f" {len(strong)} of them are 3+ standard deviations away from normal behaviour."
                                          if strong else ""),
        TIER_RULE[act],
    ]
    tier_stats = metrics.get("analytics", {}).get("severity", {}).get(act)
    if tier_stats and tier_stats["alerts"]:
        points.append(f"On this data, {tier_stats['frauds']} of {tier_stats['alerts']} alerts in this tier turned out to be real fraud.")
    return {
        "verdict": "LIKELY_FRAUD" if likely else "SUSPECTED_FRAUD",
        "verdict_label": "Likely fraud" if likely else "Suspected fraud",
        "summary": (f"{'Likely' if likely else 'Suspected'} fraud: risk {risk:.0f}/100, rank #{rank}, driven mainly by {lead}."),
        "points": points,
    }


def analyst_note(tx_id, amount, score, rank, reasons, action):
    why = ", ".join(r["label"] for r in reasons) or "no dominant signal"
    return (f"#{rank} | TX {tx_id} | ${amount:,.2f} | risk {min(score*100, 99.9):.1f}% | "
            f"signals: {why} | action: {ACTIONS[action]}")


def draft_message(tx_id, amount, action):
    if action in ("MONITOR", "CLEAR"):
        return {"status": "NOT_REQUIRED", "channel": "none", "text": "No customer message needed."}
    return {
        "status": "PENDING_APPROVAL",
        "channel": "SMS",
        "text": (f"Bank alert: we noticed a ${amount:,.2f} card transaction that looks unusual. "
                 f"Reply YES if this was you, NO to block your card. (ref {tx_id})"),
    }
