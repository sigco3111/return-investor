export const PROPERTY_RULES = Object.freeze({ version: 1, buyFeeBps: 200, sellFeeBps: 100, settlementMonths: 1, maxUnitsPerRegion: 1 });
const monthOK = (m) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const safe = (n) => Number.isSafeInteger(n) && n >= 0;
const regionOK = (r) => ["seoul", "gyeonggi"].includes(r);
export function nextMonth(m) {
  if (!monthOK(m)) throw Error("invalid-month");
  const [y, x] = m.split("-").map(Number);
  return x === 12 ? `${y + 1}-01` : `${y}-${String(x + 1).padStart(2, "0")}`;
}
export function freshPropertyState() {
  return { version: 1, holdings: {}, contracts: [], ledger: [], nextId: 1 };
}
export function inspectProperty(p) {
  if (!p || p.version !== 1 || !p.holdings || typeof p.holdings !== "object" || Array.isArray(p.holdings) || !Array.isArray(p.contracts) || !Array.isArray(p.ledger) || !safe(p.nextId) || p.nextId < 1) return false;
  for (const [r, h] of Object.entries(p.holdings)) if (!regionOK(r) || !h || h.units !== 1 || !safe(h.cost) || !monthOK(h.acquiredMonth)) return false;
  const seen = /* @__PURE__ */ new Set();
  for (const c of p.contracts) {
    if (!c || !safe(c.id) || c.id < 1 || seen.has(c.id) || !regionOK(c.region) || !["buy", "sell"].includes(c.kind) || c.units !== 1 || !monthOK(c.placedMonth) || !monthOK(c.dueMonth) || c.dueMonth !== nextMonth(c.placedMonth) || !safe(c.price) || c.price <= 0 || !safe(c.fee) || !safe(c.lockedCash) || !["pending", "settled", "cancelled"].includes(c.status)) return false;
    seen.add(c.id);
    if (c.fee !== Math.ceil(c.price * (c.kind === "buy" ? PROPERTY_RULES.buyFeeBps : PROPERTY_RULES.sellFeeBps) / 1e4)) return false;
    if (c.lockedCash !== (c.kind === "buy" ? c.price + c.fee : 0)) return false;
  }
  if (p.contracts.some((c) => c.id >= p.nextId)) return false;
  for (const r of ["seoul", "gyeonggi"]) if (p.contracts.filter((c) => c.region === r && c.status === "pending").length > 1) return false;
  for (const c of p.contracts.filter((c2) => c2.status === "pending")) if (c.kind === "buy" && p.holdings[c.region] || c.kind === "sell" && !p.holdings[c.region]) return false;
  const buys = /* @__PURE__ */ new Map(), terminals = /* @__PURE__ */ new Map(), replayed = {};
  for (const x of p.ledger) {
    if (!x || !monthOK(x.month) || !safe(x.cashIn) || !safe(x.cashOut) || !regionOK(x.region) || !safe(x.id)) return false;
    const c = p.contracts.find((c2) => c2.id === x.id);
    if (!c || c.region !== x.region || x.month < c.placedMonth) return false;
    if (x.kind === c.kind + "-contract") {
      if (buys.has(c.id) || x.month !== c.placedMonth || x.cashIn !== 0 || x.cashOut !== c.lockedCash) return false;
      buys.set(c.id, x);
    } else if (x.kind === c.kind + "-settled") {
      if (!buys.has(c.id) || terminals.has(c.id) || c.status !== "settled" || x.month < c.dueMonth || x.cashOut !== 0 || x.cashIn !== (c.kind === "sell" ? c.price - c.fee : 0)) return false;
      terminals.set(c.id, x);
      if (c.kind === "buy") {
        if (replayed[c.region]) return false;
        replayed[c.region] = { units: 1, cost: c.price + c.fee, acquiredMonth: x.month };
      } else {
        if (!replayed[c.region]) return false;
        delete replayed[c.region];
      }
    } else if (x.kind === "contract-cancel") {
      if (!buys.has(c.id) || terminals.has(c.id) || c.status !== "cancelled" || x.cashOut !== 0 || x.cashIn !== c.lockedCash) return false;
      terminals.set(c.id, x);
    } else return false;
  }
  if (p.contracts.some((c) => !buys.has(c.id) || (c.status === "pending" ? terminals.has(c.id) : !terminals.has(c.id)))) return false;
  return Object.keys(replayed).length === Object.keys(p.holdings).length && Object.entries(replayed).every(([r, h]) => p.holdings[r] && ["units", "cost", "acquiredMonth"].every((k) => p.holdings[r][k] === h[k]));
}
const invalid = (reason) => ({ ok: false, reason });
function guard(cash, p, month) {
  return safe(cash) && inspectProperty(p) && monthOK(month) && p.contracts.every((c) => c.placedMonth <= month) && p.ledger.every((r) => r.month <= month);
}
export function quoteProperty(p, region, kind, price, month) {
  if (!inspectProperty(p) || !regionOK(region) || !["buy", "sell"].includes(kind) || !safe(price) || !price || !monthOK(month)) return invalid("invalid-input");
  if (p.contracts.some((c) => c.region === region && c.status === "pending")) return invalid("contract-pending");
  if (kind === "buy" && p.holdings[region]) return invalid("already-owned");
  if (kind === "sell" && !p.holdings[region]) return invalid("not-owned");
  const fee = Math.ceil(price * (kind === "buy" ? PROPERTY_RULES.buyFeeBps : PROPERTY_RULES.sellFeeBps) / 1e4), lockedCash = kind === "buy" ? price + fee : 0;
  if (!safe(lockedCash) || fee >= price) return invalid("invalid-amount");
  return { ok: true, quote: { id: p.nextId, region, kind, units: 1, price, fee, lockedCash, placedMonth: month, dueMonth: nextMonth(month), status: "pending", basis: "estimated-home-game-contract-v1" } };
}
export function placeProperty(cash, p, region, kind, price, month) {
  if (!guard(cash, p, month)) return invalid("invalid-state");
  const q = quoteProperty(p, region, kind, price, month);
  if (!q.ok) return q;
  if (cash < q.quote.lockedCash) return invalid("insufficient-cash");
  if (!safe(p.nextId + 1)) return invalid("id-overflow");
  const n = structuredClone(p);
  n.contracts.push(q.quote);
  n.nextId++;
  n.ledger.push({ month, kind: `${kind}-contract`, region, id: q.quote.id, cashIn: 0, cashOut: q.quote.lockedCash });
  return { ok: true, cash: cash - q.quote.lockedCash, property: n, contract: q.quote };
}
export function cancelProperty(cash, p, id, month) {
  if (!guard(cash, p, month)) return invalid("invalid-state");
  const c = p.contracts.find((x) => x.id === id);
  if (!c || c.status !== "pending") return invalid("not-pending");
  const refund = c.kind === "buy" ? c.lockedCash : 0;
  if (!safe(cash + refund)) return invalid("overflow");
  const n = structuredClone(p);
  n.contracts.find((x) => x.id === id).status = "cancelled";
  n.ledger.push({ month, kind: "contract-cancel", region: c.region, id, cashIn: refund, cashOut: 0 });
  return { ok: true, cash: cash + refund, property: n };
}
export function settleProperty(cash, p, month) {
  if (!guard(cash, p, month)) return invalid("invalid-state");
  let money = cash;
  const n = structuredClone(p), receipts = [];
  for (const c of n.contracts.filter((x) => x.status === "pending" && x.dueMonth <= month)) {
    let cashIn = 0;
    if (c.kind === "buy") n.holdings[c.region] = { units: 1, cost: c.price + c.fee, acquiredMonth: month };
    else {
      delete n.holdings[c.region];
      cashIn = c.price - c.fee;
      if (!safe(money + cashIn)) return invalid("overflow");
      money += cashIn;
    }
    c.status = "settled";
    n.ledger.push({ month, kind: `${c.kind}-settled`, region: c.region, id: c.id, cashIn, cashOut: 0 });
    receipts.push({ id: c.id, region: c.region, kind: c.kind, price: c.price, fee: c.fee, cashIn });
  }
  return { ok: true, cash: money, property: n, receipts };
}
export function closePropertyContracts(cash, p, month) {
  if (!guard(cash, p, month)) return invalid("invalid-state");
  let n = p, money = cash;
  for (const c of p.contracts.filter((x) => x.status === "pending")) {
    const x = cancelProperty(money, n, c.id, month);
    if (!x.ok) return x;
    money = x.cash;
    n = x.property;
  }
  return { ok: true, cash: money, property: n };
}
export function propertySnapshot(p, prices) {
  if (!inspectProperty(p)) return invalid("invalid-state");
  let valuation = 0, lockedCash = 0;
  const rows = [];
  for (const [region, h] of Object.entries(p.holdings)) {
    const price = prices[region];
    if (!safe(price) || !price) return invalid("missing-estimated-price");
    valuation += price;
    rows.push({ region, units: h.units, estimatedValue: price, cost: h.cost, unrealized: price - h.cost, selling: p.contracts.some((c) => c.region === region && c.kind === "sell" && c.status === "pending") });
  }
  for (const c of p.contracts.filter((x) => x.status === "pending")) lockedCash += c.lockedCash;
  if (!safe(valuation) || !safe(lockedCash) || !safe(valuation + lockedCash)) return invalid("overflow");
  return { ok: true, valuation, lockedCash, total: valuation + lockedCash, rows };
}
