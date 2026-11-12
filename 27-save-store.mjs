import { encodeSave, decodeSave, planWrite, utf8Bytes } from "./save-codec.mjs";
export const STORE_KEYS = {
  cur: "return-save.v2.cur",
  genIdx: (g) => "return-save.v2." + g + ".idx",
  genPart: (g, i) => "return-save.v2." + g + ".p" + i,
  v1Idx: "return-save.v1.idx",
  v1Part: (i) => "return-save.v1.p" + i
};
export function createSaveStore(store, opts) {
  const MAX_PARTS = opts.maxParts;
  let cur = store.get(STORE_KEYS.cur) === "b" ? "b" : "a";
  let legacyClearPending = false;
  async function loadGen(g) {
    const idx = JSON.parse(store.get(STORE_KEYS.genIdx(g)) || "null");
    if (!idx || idx.v !== 2 || !Number.isInteger(idx.parts) || idx.parts < 1 || idx.parts > MAX_PARTS) throw new Error("index");
    const parts = [];
    for (let i = 0; i < idx.parts; i++) {
      const p = store.get(STORE_KEYS.genPart(g, i));
      if (typeof p !== "string") throw new Error("missing-part");
      parts.push(p);
    }
    const raw = await decodeSave(idx.enc || "r", parts.join(""));
    if (raw.length !== idx.src) throw new Error("length");
    JSON.parse(raw);
    return raw;
  }
  function measureGen(g) {
    let n = utf8Bytes(store.get(STORE_KEYS.genIdx(g)) || "");
    for (let i = 0; i < MAX_PARTS; i++) n += utf8Bytes(store.get(STORE_KEYS.genPart(g, i)) || "");
    return n;
  }
  function readLegacy() {
    const idxRaw = store.get(STORE_KEYS.v1Idx);
    if (idxRaw == null) return null;
    try {
      const idx = JSON.parse(idxRaw);
      const parts = [];
      for (let i = 0; i < (idx.parts || 0); i++) {
        const p = store.get(STORE_KEYS.v1Part(i));
        if (typeof p !== "string") throw new Error("missing");
        parts.push(p);
      }
      const joined = parts.join("");
      if (joined.length !== idx.bytes) throw new Error("length");
      JSON.parse(joined);
      return joined;
    } catch {
      return null;
    }
  }
  const commit = async (key, value) => {
    if (store.commit) await store.commit(key, value);
    else store.set(key, value);
  };
  async function clearLegacy() {
    await commit(STORE_KEYS.v1Idx, null);
    for (let i = 0; i < 4; i++) await commit(STORE_KEYS.v1Part(i), null);
  }
  async function loadBoot() {
    if (store.get(STORE_KEYS.cur) != null) {
      try {
        return { kind: "v2", saveJson: await loadGen(cur), recovered: false };
      } catch (e1) {
        try {
          return { kind: "v2", saveJson: await loadGen(cur === "a" ? "b" : "a"), recovered: true };
        } catch (e2) {
          return { kind: "corrupt" };
        }
      }
    }
    const legacy = readLegacy();
    if (legacy != null) {
      legacyClearPending = true;
      return { kind: "legacy", saveJson: legacy };
    }
    return { kind: "empty" };
  }
  async function writeSave(raw, budget) {
    const target = cur === "a" ? "b" : "a";
    const encoded = await encodeSave(raw);
    const plan = planWrite(encoded.data, budget.otherGenChars(), budget.livesChars(), {
      chunkSize: budget.chunkSize,
      maxParts: MAX_PARTS,
      totalBudget: budget.totalBudget
    });
    if (!plan.ok) return { ok: false, reason: plan.reason };
    for (let i = 0; i < MAX_PARTS; i++) await commit(STORE_KEYS.genPart(target, i), i < plan.parts.length ? plan.parts[i] : null);
    await commit(STORE_KEYS.genIdx(target), JSON.stringify({ v: 2, parts: plan.parts.length, enc: encoded.enc, src: raw.length }));
    await commit(STORE_KEYS.cur, target);
    cur = target;
    if (legacyClearPending) {
      await clearLegacy();
      legacyClearPending = false;
    }
    return { ok: true };
  }
  function removeSave() {
    store.set(STORE_KEYS.cur, null);
    cur = "a";
    for (const g of ["a", "b"]) {
      store.set(STORE_KEYS.genIdx(g), null);
      for (let i = 0; i < MAX_PARTS; i++) store.set(STORE_KEYS.genPart(g, i), null);
    }
  }
  return {
    loadBoot,
    writeSave,
    removeSave,
    measureGen,
    getCur: () => cur,
    legacyPending: () => legacyClearPending
  };
}
