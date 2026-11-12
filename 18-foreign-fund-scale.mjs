import { FUND_SCALE_ROWS, FUND_SCALE_DATA_ID } from "./fund-scale-data.mjs";
export const FOREIGN_FUND_SCALE_RULES = Object.freeze({ version: 1, dataId: FUND_SCALE_DATA_ID, unit: "USD-fund-net-assets-not-underlying-market-cap", staleAfterDays: 550, monthlyScaleFactor: 100, saleScaleFactor: 100, publicGateDays: 2 });
const fundScaleDay = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  let t = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s ? t : null;
};
export function inspectForeignFundTag(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  if (!Object.prototype.hasOwnProperty.call(s, "foreignFundScale")) return true;
  const t = s.foreignFundScale;
  return !!t && typeof t === "object" && !Array.isArray(t) && Object.keys(t).sort().join(",") === "dataId,version" && t.version === 1 && t.dataId === FUND_SCALE_DATA_ID && s.foreignEtfRules === 1 && s.propertyRules === 1 && s.chaosExposureRules === 1 && s.coreRules === 4 && s.economyModel?.id === "career-cash-events-v1";
}
export function fundScaleAt(product, cutoff) {
  if (!["spy", "fxi"].includes(product) || fundScaleDay(cutoff) === null) return { status: "invalid", sizeUSD: null };
  const chosen = FUND_SCALE_ROWS.filter((r) => r.product === product && r.usableFrom <= cutoff).at(-1);
  if (!chosen) return { status: "unavailable", sizeUSD: null };
  const ageDays = (fundScaleDay(cutoff) - fundScaleDay(chosen.measuredAt)) / 864e5;
  if (ageDays > FOREIGN_FUND_SCALE_RULES.staleAfterDays) return { status: "stale", sizeUSD: null, ageDays, row: { ...chosen } };
  return { status: "available", sizeUSD: chosen.netAssetsUSD, ageDays, row: { ...chosen } };
}
export function foreignFundDenominator(product, cutoff, fx) {
  const scale = fundScaleAt(product, cutoff);
  if (scale.status !== "available") return { ...scale, sizeKRW: null };
  if (!fx || !Number.isFinite(fx.value) || fx.value <= 0 || fundScaleDay(fx.observedDate) === null || fundScaleDay(fx.usableFrom) === null || fx.observedDate > cutoff || fx.usableFrom > cutoff || fx.usableFrom < fx.observedDate) return { ...scale, status: "fx-unavailable", sizeKRW: null };
  const sizeKRW = scale.sizeUSD * fx.value;
  if (!Number.isFinite(sizeKRW) || sizeKRW <= 0) return { status: "invalid", sizeKRW: null };
  return { ...scale, sizeKRW, fx: { value: fx.value, observedDate: fx.observedDate, usableFrom: fx.usableFrom }, basis: "dated-fund-concentration-game-proxy-not-market-impact" };
}
export function foreignFundContribution(exposureKRW, denominator, kind = "monthly") {
  if (!Number.isFinite(exposureKRW) || exposureKRW < 0 || !["monthly", "sale"].includes(kind) || denominator?.status !== "available" || !Number.isFinite(denominator.sizeKRW) || denominator.sizeKRW <= 0) return { status: "unavailable", add: null, ratio: null };
  const ratio = exposureKRW / denominator.sizeKRW;
  const add = ratio * (kind === "sale" ? FOREIGN_FUND_SCALE_RULES.saleScaleFactor : FOREIGN_FUND_SCALE_RULES.monthlyScaleFactor);
  return Number.isFinite(add) ? { status: "available", add, ratio } : { status: "invalid", add: null, ratio: null };
}
export const FOREIGN_FUND_SCALE_IMPLEMENTATION = [fundScaleDay, inspectForeignFundTag, fundScaleAt, foreignFundDenominator].map((f) => f.toString()).join("\n");
