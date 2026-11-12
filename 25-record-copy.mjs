import { createSaveStore, STORE_KEYS } from "./save-store.mjs";
import { readRetention } from "./archive-retention.mjs";
const archives = ["return-lives.v2", "return-lives.v3.cur", "return-lives.v3.a", "return-lives.v3.b", "return-lives.v4.cur", "return-lives.v4.a", "return-lives.v4.b"];
const keys = [STORE_KEYS.cur, ...["a", "b"].flatMap((g) => [STORE_KEYS.genIdx(g), ...Array.from({ length: 6 }, (_, i) => STORE_KEYS.genPart(g, i))]), STORE_KEYS.v1Idx, ...Array.from({ length: 4 }, (_, i) => STORE_KEYS.v1Part(i)), ...archives];
export async function captureRecordCopy({ read, flush, current, now = () => (/* @__PURE__ */ new Date()).toISOString() }) {
  if (await flush() !== true) throw Error("저장 반영을 확인하지 못했습니다. 정상 보관 사본을 만들지 않았어요.");
  const start = current();
  const take = async () => {
    const values = {}, statuses = [];
    for (const key of keys) {
      const r = await read(key);
      if (!r || !["saved", "memory"].includes(r.status)) throw Error("저장 읽기를 확인하지 못했습니다.");
      if (r.value !== null && typeof r.value !== "string") throw Error("저장 응답 형식을 확인하지 못했습니다.");
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
    throw Error("사본은 저장을 바꾸지 않습니다.");
  } }, { maxParts: 6 });
  const boot = await store.loadBoot();
  if (boot.kind === "corrupt" || boot.recovered) throw Error("현재 저장 원문을 그대로 확인하지 못했습니다.");
  const active = boot.kind === "empty" ? null : boot.saveJson;
  const archive = await readRetention({ legacy: decoded["return-lives.v2"], v3cur: decoded["return-lives.v3.cur"], v3a: decoded["return-lives.v3.a"], v3b: decoded["return-lives.v3.b"], v4cur: decoded["return-lives.v4.cur"], v4a: decoded["return-lives.v4.a"], v4b: decoded["return-lives.v4.b"] });
  if (active !== start.active || archive.raw !== start.archive) throw Error("화면의 기록과 읽어 온 기록이 달라 사본을 만들지 않았어요.");
  const second = await take();
  if (JSON.stringify(first) !== JSON.stringify(second) || JSON.stringify(start) !== JSON.stringify(current())) throw Error("기록이 바뀌었습니다. 진행을 멈춘 뒤 다시 준비해 주세요.");
  if (active === null && archive.raw === null) throw Error("아직 내려받을 진행이나 완료 회귀가 없습니다.");
  const parsed = active === null ? null : JSON.parse(active), lives = archive.raw === null ? [] : JSON.parse(archive.raw);
  if (!Array.isArray(lives) || parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed))) throw Error("기록 형식을 확인하지 못했습니다.");
  const scope = first.statuses.every((s) => s === "saved") ? "device-local-confirmed" : first.statuses.every((s) => s === "memory") ? "preview-memory-only" : "mixed-storage-status";
  if (scope === "mixed-storage-status") throw Error("기록의 저장 범위가 서로 달라 사본을 만들지 않았어요.");
  const result = { format: "return-record-copy", version: 1, title: "리턴: 회귀 투자자", createdAt: now(), scope, notice: "현재 이 페이지에서 읽기 대조한 진행과 완료 회귀 원문 사본입니다. 다른 기기 동기화나 복구를 보장하지 않으며, 가져오기 화면에서 별도로 검사·확인해야 하며 일부 사본은 지원하지 않습니다. 이전 회귀에서 이미 요약한 월별 상세는 포함되지 않으며 복원할 수 없습니다.", activeSaveRaw: active, completedLivesRaw: archive.raw, summary: { currentMonth: parsed?.month ?? null, completedLives: lives.length, recordContext: parsed?.recordContext ?? null } };
  return { json: JSON.stringify(result, null, 2), scope, summary: result.summary };
}
