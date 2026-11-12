import { encodeSave, decodeSave, utf8Bytes } from "./save-codec.mjs";
const array = (raw) => {
  const x = JSON.parse(raw);
  if (!Array.isArray(x) || x.some((r) => !r || typeof r !== "object" || Array.isArray(r))) throw Error("invalid-archive");
  return x;
};
export async function encodeArchive(raw) {
  array(raw);
  const e = await encodeSave(raw);
  const envelope = JSON.stringify({ v: 3, enc: e.enc, src: utf8Bytes(raw), data: e.data });
  if (await decodeArchive(envelope) !== raw) throw Error("archive-roundtrip");
  return envelope;
}
export async function decodeArchive(envelope) {
  const e = JSON.parse(envelope);
  if (!e || e.v !== 3 || !["d", "r"].includes(e.enc) || !Number.isInteger(e.src) || e.src < 2 || e.src > 2e6 || typeof e.data !== "string") throw Error("archive-envelope");
  const raw = await decodeSave(e.enc, e.data);
  if (utf8Bytes(raw) !== e.src) throw Error("archive-length");
  array(raw);
  return raw;
}
export async function loadArchive(legacy, packed) {
  if (legacy !== null) array(legacy);
  if (packed === null) return legacy;
  const raw = await decodeArchive(packed);
  if (legacy !== null) {
    const prior = array(legacy), current = array(raw);
    if (prior.length > current.length || prior.some((r, i) => JSON.stringify(r) !== JSON.stringify(current[i]))) throw Error("archive-legacy-conflict");
  }
  return raw;
}
export function archiveBudget(envelope, legacyBytes, activeBytes, budget = 64500) {
  const bytes = utf8Bytes(JSON.stringify(envelope));
  return { ok: bytes <= 15360 && bytes + legacyBytes + activeBytes + 1024 <= budget, bytes, total: bytes + legacyBytes + activeBytes + 1024 };
}
export async function commitArchive({ raw, current = "b", priorPacked = null, otherPacked = null, legacyBytes = 0, activeBytes = 0, extraBytes = 0, budget = 64500, write, read }) {
  const target = current === "a" ? "b" : "a", envelope = await encodeArchive(raw);
  const bytes = utf8Bytes(JSON.stringify(envelope));
  const targetPeak = Math.max(bytes, otherPacked === null ? 0 : utf8Bytes(JSON.stringify(otherPacked)));
  const total = targetPeak + (priorPacked === null ? 0 : utf8Bytes(JSON.stringify(priorPacked))) + legacyBytes + activeBytes + extraBytes + 1024;
  if (bytes > 15360 || total > budget) throw Error("archive-total-budget");
  const key = "return-lives.v3." + target;
  await write(key, JSON.stringify(envelope));
  const observed = await read(key);
  if (observed !== JSON.stringify(envelope) || await decodeArchive(JSON.parse(observed)) !== raw) throw Error("archive-readback");
  await write("return-lives.v3.cur", JSON.stringify(target));
  if (await read("return-lives.v3.cur") !== JSON.stringify(target)) throw Error("archive-pointer-readback");
  return { current: target, envelope, bytes, total, allPackedBytes: bytes + (priorPacked === null ? 0 : utf8Bytes(JSON.stringify(priorPacked))) };
}
