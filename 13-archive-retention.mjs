import { encodeSave, decodeSave, utf8Bytes } from "./save-codec.mjs";
import { loadArchive } from "./archive-codec.mjs";
export const RETENTION_KEYS = ["return-lives.v4.a", "return-lives.v4.b", "return-lives.v4.cur"];
const parse = (raw) => {
  const a = JSON.parse(raw);
  if (!Array.isArray(a) || a.some((r) => !r || typeof r !== "object" || Array.isArray(r))) throw Error("retention-array");
  return a;
};
export function summarizeLife(record) {
  const r = structuredClone(record);
  if (!Object.hasOwn(r, "assetTrail")) return r;
  if (r.archiveDetail !== void 0 || Object.hasOwn(r, "assetTrailSummary")) throw Error("retention-marker-conflict");
  const trail = r.assetTrail;
  if (trail !== null && (!Array.isArray(trail) || trail.some((p) => !p || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.m) || !Number.isFinite(p.a)))) throw Error("retention-trail-invalid");
  const points = trail || [];
  if (points.some((p, i) => i && p.m <= points[i - 1].m)) throw Error("retention-trail-order");
  r.archiveDetail = { version: 1, level: "summary", policy: "latest-completed-1-v1", removed: ["assetTrail", "assetTrailFrom"], irreversible: true };
  r.assetTrailSummary = points.length ? { from: points[0].m, to: points[points.length - 1].m, recordedMonths: points.length, minAssets: Math.min(...points.map((p) => p.a)), maxAssets: Math.max(...points.map((p) => p.a)), firstAssets: points[0].a, lastAssets: points[points.length - 1].a } : null;
  delete r.assetTrail;
  delete r.assetTrailFrom;
  return r;
}
export function retainLatest(raw) {
  const a = parse(raw);
  return JSON.stringify(a.map((r, i) => i === a.length - 1 ? r : summarizeLife(r)));
}
export function coveredBy(oldRaw, newRaw) {
  const old = parse(oldRaw), next = parse(newRaw);
  return old.length <= next.length && old.every((r, i) => JSON.stringify(i < next.length - 1 ? summarizeLife(r) : r) === JSON.stringify(next[i]));
}
export async function encodeRetained(raw) {
  parse(raw);
  const e = await encodeSave(raw);
  const packed = JSON.stringify({ v: 4, enc: e.enc, src: utf8Bytes(raw), data: e.data });
  if (await decodeRetained(packed) !== raw) throw Error("retention-roundtrip");
  return packed;
}
export async function decodeRetained(packed) {
  const e = JSON.parse(packed);
  if (!e || e.v !== 4 || !["d", "r"].includes(e.enc) || !Number.isInteger(e.src) || e.src < 2 || e.src > 2e6 || typeof e.data !== "string") throw Error("retention-envelope");
  const raw = await decodeSave(e.enc, e.data);
  if (utf8Bytes(raw) !== e.src) throw Error("retention-length");
  parse(raw);
  return raw;
}
export async function readRetention({ legacy, v3cur, v3a, v3b, v4cur, v4a, v4b }) {
  if (v3cur !== null && !["a", "b"].includes(v3cur)) throw Error("retention-v3-pointer");
  const v3 = v3cur === null ? null : v3cur === "a" ? v3a : v3b;
  if (v3cur !== null && v3 === null) throw Error("retention-v3-slot");
  const old = await loadArchive(legacy, v3);
  if (v4cur === null) return { raw: old, current: "b", packed: null, other: v4a, orphanBytes: v4b === null ? 0 : utf8Bytes(JSON.stringify(v4b)) };
  if (!["a", "b"].includes(v4cur)) throw Error("retention-pointer");
  const packed = v4cur === "a" ? v4a : v4b, other = v4cur === "a" ? v4b : v4a;
  if (packed === null) throw Error("retention-slot");
  const raw = await decodeRetained(packed);
  if (old !== null && !coveredBy(old, raw)) throw Error("retention-legacy-conflict");
  if (retainLatest(raw) !== raw) throw Error("retention-policy");
  return { raw, current: v4cur, packed, other };
}
export async function commitRetained({ raw, current = "b", priorPacked = null, otherPacked = null, activeBytes = 0, legacyBytes = 0, extraBytes = 0, budget = 64500, write, read }) {
  raw = retainLatest(raw);
  const target = current === "a" ? "b" : "a", packed = await encodeRetained(raw), bytes = utf8Bytes(JSON.stringify(packed));
  const total = Math.max(bytes, otherPacked === null ? 0 : utf8Bytes(JSON.stringify(otherPacked))) + (priorPacked === null ? 0 : utf8Bytes(JSON.stringify(priorPacked))) + activeBytes + legacyBytes + extraBytes + 1024;
  if (bytes > 15360 || total > budget) throw Error("retention-transition-budget");
  const key = "return-lives.v4." + target;
  await write(key, JSON.stringify(packed));
  const observed = await read(key);
  if (observed !== JSON.stringify(packed) || await decodeRetained(JSON.parse(observed)) !== raw) throw Error("retention-readback");
  await write("return-lives.v4.cur", JSON.stringify(target));
  if (await read("return-lives.v4.cur") !== JSON.stringify(target)) throw Error("retention-pointer-readback");
  return { raw, current: target, packed, bytes, total };
}
