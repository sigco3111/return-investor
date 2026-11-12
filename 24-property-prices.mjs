export const PROPERTY_PRICE_MODEL = Object.freeze({ version: 1, id: "estimated-regional-home-v1", unit: "KRW-per-whole-home", interpolation: "linear-monthly-rounded-10000", sourceNotes: [
  { url: "https://www.hankookilbo.com/news/article/201602091120933930", used: "2016-01 Seoul KB reported survey average 552.82m KRW: scale reference only, rounded to game 550m. Survey sample update is not identical-house appreciation." },
  { url: "https://www.hani.co.kr/arti/economy/property/992626.html", used: "Reported KB survey averages Gyeonggi2016-01 311.04m,2020-07 408.06m,2021-04 511.61m; Seoul2020-09 1003.12m,2021-04 1111.23m. Scale references only, rounded game anchors. Not actual sales." }
], anchors: [
  ["1990-01", 8e7, 5e7, "design"],
  ["1997-01", 18e7, 12e7, "design"],
  ["1998-12", 14e7, 9e7, "design"],
  ["2006-01", 4e8, 25e7, "design"],
  ["2008-01", 43e7, 26e7, "design"],
  ["2009-01", 39e7, 23e7, "design"],
  ["2016-01", 55e7, 31e7, "survey-scale-reference"],
  ["2020-09", 1e9, 41e7, "survey-scale-reference-nearby-month"],
  ["2021-04", 111e7, 51e7, "survey-scale-reference"],
  ["2022-01", 12e8, 62e7, "design"],
  ["2023-01", 105e7, 52e7, "design"],
  ["2026-11", 13e8, 65e7, "design"]
] });
function mi(m) {
  if (typeof m !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return null;
  const [y, n] = m.split("-").map(Number);
  return y * 12 + n - 1;
}
export function estimatedPropertyPrice(region, month) {
  const k = region === "seoul" ? 1 : region === "gyeonggi" ? 2 : null, t = mi(month), a = PROPERTY_PRICE_MODEL.anchors;
  if (k === null || t === null || t < mi(a[0][0]) || t > mi(a[a.length - 1][0])) return null;
  const hi = a.findIndex((x) => mi(x[0]) >= t);
  if (hi === 0 || mi(a[hi][0]) === t) return a[hi][k];
  const l = a[hi - 1], r = a[hi];
  return Math.round((l[k] + (r[k] - l[k]) * (t - mi(l[0])) / (mi(r[0]) - mi(l[0]))) / 1e4) * 1e4;
}
export function propertyPrices(month) {
  return { seoul: estimatedPropertyPrice("seoul", month), gyeonggi: estimatedPropertyPrice("gyeonggi", month) };
}
