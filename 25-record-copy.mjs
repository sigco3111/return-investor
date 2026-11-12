import { createSaveStore, STORE_KEYS } from "./save-store.mjs";
import { readRetention } from "./archive-retention.mjs";
const archives = ["return-lives.v2", "return-lives.v3.cur", "return-lives.v3.a", "return-lives.v3.b", "return-lives.v4.cur", "return-lives.v4.a", "return-lives.v4.b"];
const keys = [STORE_KEYS.cur, ...["a", "b"].flatMap((g) => [STORE_KEYS.genIdx(g), ...Array.from({ length: 6 }, (_, i) => STORE_KEYS.genPart(g, i))]), STORE_KEYS.v1Idx, ...Array.from({ length: 4 }, (_, i) => STORE_KEYS.v1Part(i)), ...archives];
export async function captureRecordCopy({ read, flush, current, now = () => (/* @__PURE__ */ new Date()).toISOString() }) {
  if (await flush() !== true) throw Error("\uC800\uC7A5 \uBC18\uC601\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC815\uC0C1 \uBCF4\uAD00 \uC0AC\uBCF8\uC744 \uB9CC\uB4E4\uC9C0 \uC54A\uC558\uC5B4\uC694.");
  const start = current();
  const take = async () => {
    const values = {}, statuses = [];
    for (const key of keys) {
      const r = await read(key);
      if (!r || !["saved", "memory"].includes(r.status)) throw Error("\uC800\uC7A5 \uC77D\uAE30\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      if (r.value !== null && typeof r.value !== "string") throw Error("\uC800\uC7A5 \uC751\uB2F5 \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      values[key] = r.value;
      statuses.push(r.status);
    }
    return { values, statuses };
  };
  const first = await take();
  const decoded = {};
  for (const key of keys) {
    const raw = first.values[key];
    decoded[key] = raw === null ? null : JSON.parse(raw);
  }
  const store = createSaveStore({ get: (k) => decoded[k] ?? null, set: () => {
    throw Error("\uC0AC\uBCF8\uC740 \uC800\uC7A5\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  } }, { maxParts: 6 });
  const boot = await store.loadBoot();
  if (boot.kind === "corrupt" || boot.recovered) throw Error("\uD604\uC7AC \uC800\uC7A5 \uC6D0\uBB38\uC744 \uADF8\uB300\uB85C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  const active = boot.kind === "empty" ? null : boot.saveJson;
  const archive = await readRetention({ legacy: decoded["return-lives.v2"], v3cur: decoded["return-lives.v3.cur"], v3a: decoded["return-lives.v3.a"], v3b: decoded["return-lives.v3.b"], v4cur: decoded["return-lives.v4.cur"], v4a: decoded["return-lives.v4.a"], v4b: decoded["return-lives.v4.b"] });
  if (active !== start.active || archive.raw !== start.archive) throw Error("\uD654\uBA74\uC758 \uAE30\uB85D\uACFC \uC77D\uC5B4 \uC628 \uAE30\uB85D\uC774 \uB2EC\uB77C \uC0AC\uBCF8\uC744 \uB9CC\uB4E4\uC9C0 \uC54A\uC558\uC5B4\uC694.");
  const second = await take();
  if (JSON.stringify(first) !== JSON.stringify(second) || JSON.stringify(start) !== JSON.stringify(current())) throw Error("\uAE30\uB85D\uC774 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uC9C4\uD589\uC744 \uBA48\uCD98 \uB4A4 \uB2E4\uC2DC \uC900\uBE44\uD574 \uC8FC\uC138\uC694.");
  if (active === null && archive.raw === null) throw Error("\uC544\uC9C1 \uB0B4\uB824\uBC1B\uC744 \uC9C4\uD589\uC774\uB098 \uC644\uB8CC \uD68C\uADC0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const parsed = active === null ? null : JSON.parse(active), lives = archive.raw === null ? [] : JSON.parse(archive.raw);
  if (!Array.isArray(lives) || parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed))) throw Error("\uAE30\uB85D \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  const scope = first.statuses.every((s) => s === "saved") ? "device-local-confirmed" : first.statuses.every((s) => s === "memory") ? "preview-memory-only" : "mixed-storage-status";
  if (scope === "mixed-storage-status") throw Error("\uAE30\uB85D\uC758 \uC800\uC7A5 \uBC94\uC704\uAC00 \uC11C\uB85C \uB2EC\uB77C \uC0AC\uBCF8\uC744 \uB9CC\uB4E4\uC9C0 \uC54A\uC558\uC5B4\uC694.");
  const result = { format: "return-record-copy", version: 1, title: "\uB9AC\uD134: \uD68C\uADC0 \uD22C\uC790\uC790", createdAt: now(), scope, notice: "\uD604\uC7AC \uC774 \uD398\uC774\uC9C0\uC5D0\uC11C \uC77D\uAE30 \uB300\uC870\uD55C \uC9C4\uD589\uACFC \uC644\uB8CC \uD68C\uADC0 \uC6D0\uBB38 \uC0AC\uBCF8\uC785\uB2C8\uB2E4. \uB2E4\uB978 \uAE30\uAE30 \uB3D9\uAE30\uD654\uB098 \uBCF5\uAD6C\uB97C \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC73C\uBA70, \uC774 \uC2E4\uD589\uBCF8\uC5D0\uB294 \uAC00\uC838\uC624\uAE30 \uAE30\uB2A5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC774\uC804 \uD68C\uADC0\uC5D0\uC11C \uC774\uBBF8 \uC694\uC57D\uD55C \uC6D4\uBCC4 \uC0C1\uC138\uB294 \uD3EC\uD568\uB418\uC9C0 \uC54A\uC73C\uBA70 \uBCF5\uC6D0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", activeSaveRaw: active, completedLivesRaw: archive.raw, summary: { currentMonth: parsed?.month ?? null, completedLives: lives.length, recordContext: parsed?.recordContext ?? null } };
  return { json: JSON.stringify(result, null, 2), scope, summary: result.summary };
}
