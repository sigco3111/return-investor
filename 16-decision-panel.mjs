export function lastDay(m) {
  const y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
  return m + "-" + String(new Date(y, mo, 0).getDate()).padStart(2, "0");
}
export function monthStart(m) {
  return m + "-01";
}
export function addMonths(m, n) {
  let y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) + n;
  while (mo > 12) {
    mo -= 12;
    y += 1;
  }
  while (mo < 1) {
    mo += 12;
    y -= 1;
  }
  return y + "-" + String(mo).padStart(2, "0");
}
export function minusOneMonth(dateStr) {
  const m = addMonths(dateStr.slice(0, 7), -1);
  return dateStr.slice(8, 10) > lastDay(m).slice(8, 10) ? lastDay(m) : m + dateStr.slice(7);
}
export function observableAt(p, effDate, postClose) {
  if (p.uncertain || p.unverified) return false;
  if (p.model === "b-monthly-2019q3") return false;
  if (p.usable_from) return p.usable_from <= effDate;
  return postClose ? p.date <= effDate : p.date < effDate;
}
export function visiblePoint(prices, series, effDate, postClose) {
  let best = null;
  for (const p of prices) {
    if (p.series !== series) continue;
    if (!observableAt(p, effDate, postClose)) continue;
    if (!best || p.date > best.date) best = p;
  }
  return best;
}
export const TAG_SERIES = { "\uC8FC\uC2DD": "kospi", "\uCF54\uC2A4\uB2E5": "kosdaq", "\uD658\uC728": "fx", "\uC678\uD654": "fx" };
export const SERIES_LABEL = { kospi: "\uCF54\uC2A4\uD53C", kosdaq: "\uCF54\uC2A4\uB2E5", fx: "\uC6D0/\uB2EC\uB7EC \uD658\uC728" };
function dayDiff(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
}
export function spanText(days) {
  if (days <= 45) return days + "\uC77C \uC804";
  return "\uC57D " + Math.round(days / 30.4) + "\uAC1C\uC6D4 \uC804";
}
export function marketSnapshot(prices, effDate, postClose) {
  const prevCutoff = minusOneMonth(effDate);
  const out = [];
  for (const s of ["kospi", "kosdaq", "fx"]) {
    const cur = visiblePoint(prices, s, effDate, postClose);
    if (!cur) {
      out.push({ series: s, label: SERIES_LABEL[s], point: null });
      continue;
    }
    const prev = visiblePoint(prices, s, prevCutoff, postClose);
    const same = !prev || prev.date === cur.date;
    const pct = !same && prev.value ? Math.round((cur.value / prev.value - 1) * 1e3) / 10 : null;
    out.push({
      series: s,
      label: SERIES_LABEL[s],
      point: { date: cur.date, value: cur.value },
      ageDays: dayDiff(cur.date, effDate),
      comparisonCutoff: prevCutoff,
      pct,
      prevDate: same ? null : prev.date,
      spanDays: same ? null : dayDiff(prev.date, cur.date)
    });
  }
  return out;
}
export function priorCases(events, prices, currentEvent, effDate, postClose, maxN = 3) {
  const tags = (currentEvent.impact_tags || []).filter((t) => TAG_SERIES[t]);
  if (!tags.length) return [];
  const priors = events.filter((e) => e.date < currentEvent.date && (e.impact_tags || []).some((t) => tags.includes(t))).sort((a, b) => b.date.localeCompare(a.date));
  const res = [];
  for (const e of priors) {
    const shared = [...new Set((e.impact_tags || []).filter((t) => tags.includes(t)))];
    const series = [...new Set(shared.map((t) => TAG_SERIES[t]))];
    const changes = [];
    for (const s of series) {
      const m = e.date.slice(0, 7);
      let base = null;
      for (const p of prices) {
        if (p.series !== s || p.date > e.date) continue;
        if (p.uncertain || p.unverified) continue;
        if (p.model === "b-monthly-2019q3") continue;
        if (!base || p.date > base.date) base = p;
      }
      if (!base || !observableAt(base, effDate, postClose) || base.date < monthStart(addMonths(m, -2))) continue;
      const win = (n) => {
        let w = null;
        for (const p of prices) {
          if (p.series !== s || p.uncertain || p.unverified) continue;
          if (p.date > lastDay(addMonths(m, n))) continue;
          if (!observableAt(p, effDate, postClose)) continue;
          if (!w || p.date > w.date) w = p;
        }
        if (!w || w.date === base.date || w.date <= e.date) return null;
        if (w.date < monthStart(addMonths(m, n - 1))) return null;
        return { date: w.date, value: w.value, pct: Math.round((w.value / base.value - 1) * 1e3) / 10 };
      };
      const fwd1 = win(1), fwd3 = win(3);
      if (fwd1 === null && fwd3 === null) continue;
      changes.push({ series: s, label: SERIES_LABEL[s], baseDate: base.date, baseValue: base.value, fwd1, fwd3 });
    }
    if (changes.length) res.push({ title: e.card_title, month: e.date.slice(0, 7), shared, changes });
    if (res.length >= maxN) break;
  }
  return res;
}
export function settlementEffDate(events, month) {
  const prev = events.filter((e) => e.date.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (prev && prev.date.length === 10) return { effDate: prev.date, postClose: true };
  return { effDate: month + "-01", postClose: false };
}
export function serieslessProducts(unlocks, prices) {
  const have = new Set(prices.map((p) => p.series));
  return unlocks.filter((u) => {
    const s = u.rule === "fxprice" ? u.series || "sp500" : u.series || u.product;
    return u.rule !== "accrual" && u.rule !== "unpriced" && !have.has(s);
  }).map((u) => u.name);
}
