import React, { useEffect, useRef, useState } from "react";
import { useLocalState, browserPersistence } from "./browser-storage";
import { captureRecordCopy } from "./record-copy.mjs";
import { storageScopeView } from "./storage-scope-view.mjs";
import { utf8Bytes } from "./save-codec.mjs";
import { readRetention, retainLatest, commitRetained, coveredBy } from "./archive-retention.mjs";
import { createSaveStore, STORE_KEYS } from "./save-store.mjs";
import { marketSnapshot, priorCases, serieslessProducts, settlementEffDate } from "./decision-panel.mjs";
import assetLicenseRaw from "./asset-license.txt?raw";
const GAME_DATA = window.__returnDataPayload;
const eventsRaw = GAME_DATA["data/events.json"], pricesRaw = GAME_DATA["data/prices.json"], turnsRaw = GAME_DATA["data/turns.json"], unlocksRaw = GAME_DATA["data/unlocks.json"];
const EVENTS = JSON.parse(eventsRaw);
const PRICES = JSON.parse(pricesRaw);
const UNLOCKS = JSON.parse(unlocksRaw);
const SERIESLESS = serieslessProducts(UNLOCKS, PRICES);
function installGameDataFetch() {
  const w = window;
  if (w.__returnDataFetchInstalled) return;
  w.__returnDataFetchInstalled = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (typeof url === "string" && Object.prototype.hasOwnProperty.call(GAME_DATA, url)) {
      return Promise.resolve(new Response(GAME_DATA[url], { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return original(input, init);
  };
}
const SAVE_KEY = "regression-invest-school-calendar-save-v1";
const LIVES_KEY = "regression-invest-school-calendar-lives-v1";
const LEGACY_KEY = "regression-invest-save-v1";
const CHUNK_BYTES = 12e3;
const MAX_PARTS = 6;
const TOTAL_BUDGET = 64500;
const ARCHIVE_KEYS = ["return-lives.v2", "return-lives.v3.cur", "return-lives.v3.a", "return-lives.v3.b", "return-lives.v4.cur", "return-lives.v4.a", "return-lives.v4.b"];
const physicalArchive = (v) => v === null ? 0 : utf8Bytes(JSON.stringify(v));
function archiveInputs(v) {
  return { legacy: v["return-lives.v2"], v3cur: v["return-lives.v3.cur"], v3a: v["return-lives.v3.a"], v3b: v["return-lives.v3.b"], v4cur: v["return-lives.v4.cur"], v4a: v["return-lives.v4.a"], v4b: v["return-lives.v4.b"] };
}
async function archiveRead(key) {
  const r = await browserPersistence.request("local.read", { key });
  if (!r || !["saved", "memory"].includes(r.status || "")) throw Error("retention-read-status");
  return r.value === null ? null : JSON.parse(r.value);
}
async function archiveSnapshot() {
  const values = {};
  for (const k of ARCHIVE_KEYS) values[k] = await archiveRead(k);
  return values;
}
async function cleanupRetained(st, current, write, read) {
  for (const k of ["return-lives.v3.cur", "return-lives.v2", "return-lives.v3.a", "return-lives.v3.b", "return-lives.v4." + (current === "a" ? "b" : "a")]) {
    if (st.values[k] === null) continue;
    await write(k, "null");
    if (await read(k) !== "null") throw Error("retention-cleanup-readback");
    st.values[k] = null;
  }
  st.chars = ARCHIVE_KEYS.reduce((n, k) => n + physicalArchive(st.values[k]), 0) + st.extraBytes;
}
async function persistRetained(st, ss, raw) {
  const fresh = await archiveSnapshot();
  if (ARCHIVE_KEYS.some((k) => fresh[k] !== st.values[k])) throw Error("retention-concurrent-change");
  const old = await readRetention(archiveInputs(fresh));
  const target = retainLatest(raw);
  if (old.raw !== null && !coveredBy(old.raw, target)) throw Error("retention-would-change-record");
  const bridge = browserPersistence;
  const read = async (k) => {
    const r2 = await bridge.request("local.read", { key: k });
    if (!r2 || !["saved", "memory"].includes(r2.status || "")) throw Error("retention-read-status");
    return r2.value;
  };
  const write = async (k, value) => {
    await bridge.request("local.write", { key: k, value });
  };
  const r = await commitRetained({ raw: target, current: old.current, priorPacked: old.packed, otherPacked: old.other, activeBytes: ss.measureGen("a") + ss.measureGen("b"), legacyBytes: ARCHIVE_KEYS.filter((k) => !k.startsWith("return-lives.v4.")).reduce((n, k) => n + physicalArchive(fresh[k]), 0), extraBytes: st.extraBytes + (old.orphanBytes || 0), budget: TOTAL_BUDGET, write, read });
  st.values["return-lives.v4." + r.current] = r.packed;
  st.values["return-lives.v4.cur"] = r.current;
  await cleanupRetained(st, r.current, write, read);
  return r.raw;
}
function installStorageShim(initial, ss, setLives, livesState, onFailure) {
  const w = window;
  if (w.__returnStorageShim) return;
  w.__returnStorageShim = true;
  const map = /* @__PURE__ */ new Map();
  for (const [k, v] of Object.entries(initial)) if (v != null) map.set(k, v);
  const chains = {};
  const writeErrors = [];
  const failedPreservedKeys = /* @__PURE__ */ new Set();
  let saveHalted = false;
  const enqueue = (key, job) => {
    chains[key] = (chains[key] || Promise.resolve()).then(async () => {
      await job();
      failedPreservedKeys.delete(key);
    }).catch((e) => {
      if (key.startsWith(SAVE_KEY + "-preserved-")) failedPreservedKeys.add(key);
      writeErrors.push(key + ": " + String(e));
    });
  };
  window.__returnStorageFlush = async () => {
    await Promise.allSettled(Object.values(chains));
    const noNewErrors = writeErrors.splice(0).length === 0;
    return failedPreservedKeys.size === 0 && noNewErrors;
  };
  const writeBridge = async (key, value) => {
    const bridge = browserPersistence;
    if (!bridge) throw new Error("browser-storage-unavailable");
    const encoded = value === null ? "null" : value;
    await bridge.request("local.write", { key, value: encoded });
    const check = await bridge.request("local.read", { key });
    if (!check || !["saved", "memory"].includes(check.status || "") || check.value !== encoded) throw new Error("storage-write-unconfirmed");
  };
  window.__returnRetainArchive = retainLatest;
  window.__returnArchiveVerified = async (raw) => {
    const fresh = await archiveSnapshot();
    const loaded = await readRetention(archiveInputs(fresh));
    return loaded.raw === raw;
  };
  const persist = (key, value) => {
    if (saveHalted) throw Error("storage-halted-until-reload");
    if (key === SAVE_KEY) {
      if (value == null) {
        enqueue(SAVE_KEY, async () => {
          await writeBridge(STORE_KEYS.cur, null);
          for (const g of ["a", "b"]) {
            await writeBridge(STORE_KEYS.genIdx(g), null);
            for (let i = 0; i < MAX_PARTS; i++) await writeBridge(STORE_KEYS.genPart(g, i), null);
          }
        });
        return;
      }
      enqueue(SAVE_KEY, async () => {
        if (saveHalted) return;
        try {
          const r = await ss.writeSave(value, {
            chunkSize: CHUNK_BYTES,
            maxParts: MAX_PARTS,
            totalBudget: TOTAL_BUDGET,
            otherGenChars: () => ss.measureGen(ss.getCur()),
            livesChars: () => livesState.chars
          });
          if (!r.ok) throw new Error(r.reason || "save-budget");
        } catch (e) {
          saveHalted = true;
          window.__returnStorageHalted = true;
          onFailure("save", String(e), map.get(SAVE_KEY) || value);
          throw e;
        }
      });
      return;
    }
    if (key.startsWith(SAVE_KEY + "-preserved-")) {
      enqueue(key, async () => {
        const bridge = browserPersistence;
        if (!bridge) throw new Error("browser-storage-unavailable");
        const encoded = value == null ? "null" : JSON.stringify(value);
        await bridge.request("local.write", { key, value: encoded });
        const check = await bridge.request("local.read", { key });
        if (!check || check.status !== "saved" || check.value !== encoded) throw new Error("preserved-backup-not-persistent");
      });
      return;
    }
    if (key === LIVES_KEY) {
      if (value == null) throw new Error("archive-delete-not-supported");
      enqueue(LIVES_KEY, async () => {
        await Promise.allSettled(Object.entries(chains).filter(([k]) => k !== LIVES_KEY).map(([, p]) => p));
        if (saveHalted) return;
        try {
          await persistRetained(livesState, ss, value);
        } catch (e) {
          saveHalted = true;
          window.__returnStorageHalted = true;
          onFailure("lives", String(e), value);
          throw e;
        }
      });
    }
  };
  const shim = {
    getItem: (k) => map.has(k) ? map.get(k) : null,
    setItem: (k, v) => {
      const value = String(v);
      if (k.startsWith(SAVE_KEY + "-preserved-") && utf8Bytes(JSON.stringify(value)) > 16384) throw new Error("preserved-backup-key-limit");
      map.set(k, value);
      persist(k, value);
    },
    removeItem: (k) => {
      map.delete(k);
      persist(k, null);
    },
    clear: () => {
      for (const k of [...map.keys()]) {
        map.delete(k);
        persist(k, null);
      }
    },
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    }
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: shim });
}
const VN_BGS = {
  "classroom": "bg-classroom-common.png",
  "university": "bg-university-common.png",
  "office": "bg-office-common.png",
  "home": "bg-home-common.png",
  "barracks": "bg-barracks-common.png",
  "studio": "bg-studio-common.png",
  "alba": "bg-alba-common.png"
};
function vnBgCss(urls) {
  let css = `.vn-bg { position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: flex-start; padding: 8px 12px;
  background-color: #8f7f74; color: rgba(255,255,255,.75); font-size: 11.5px; background-size: cover; background-position: center; }
`;
  const rules = [
    [".vn-bg", urls["classroom"]],
    ['.vn-stage[data-bg="university"] .vn-bg', urls["university"]],
    ['.vn-stage[data-bg="office"] .vn-bg', urls["office"]],
    ['.vn-stage[data-bg="home"] .vn-bg', urls["home"]],
    ['.vn-stage[data-bg="barracks"] .vn-bg', urls["barracks"]],
    ['.vn-stage[data-bg="studio"] .vn-bg', urls["studio"]],
    ['.vn-stage[data-bg="alba"] .vn-bg', urls["alba"]]
  ];
  for (const [sel, url] of rules) if (url) css += `${sel} { background-image: url('${url}'); }
`;
  return css;
}
export function App() {
  const started = useRef(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [recordCopy, setRecordCopy] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const storeRef = useRef(null);
  const [vnUrls, setVnUrls] = useState({});
  const [storageFailure, setStorageFailure] = useState(null);
  const [activeWriteState, setActiveWriteState] = useState(null);
  const [bootFailure, setBootFailure] = useState(null);
  const [recoveryNotice, setRecoveryNotice] = useState(null);
  const [confirmAsk, setConfirmAsk] = useState(null);
  const armedAccept = useRef(false);
  const lastButton = useRef(null);
  const [curRaw, setCurRaw, curSaved] = useLocalState("return-save.v2.cur", null);
  const [aIdxRaw, setAIdxRaw, aIdxSaved] = useLocalState("return-save.v2.a.idx", null);
  const [aP0, setAP0, aP0s] = useLocalState("return-save.v2.a.p0", null);
  const [aP1, setAP1, aP1s] = useLocalState("return-save.v2.a.p1", null);
  const [aP2, setAP2, aP2s] = useLocalState("return-save.v2.a.p2", null);
  const [aP3, setAP3, aP3s] = useLocalState("return-save.v2.a.p3", null);
  const [aP4, setAP4, aP4s] = useLocalState("return-save.v2.a.p4", null);
  const [aP5, setAP5, aP5s] = useLocalState("return-save.v2.a.p5", null);
  const [bIdxRaw, setBIdxRaw, bIdxSaved] = useLocalState("return-save.v2.b.idx", null);
  const [bP0, setBP0, bP0s] = useLocalState("return-save.v2.b.p0", null);
  const [bP1, setBP1, bP1s] = useLocalState("return-save.v2.b.p1", null);
  const [bP2, setBP2, bP2s] = useLocalState("return-save.v2.b.p2", null);
  const [bP3, setBP3, bP3s] = useLocalState("return-save.v2.b.p3", null);
  const [bP4, setBP4, bP4s] = useLocalState("return-save.v2.b.p4", null);
  const [bP5, setBP5, bP5s] = useLocalState("return-save.v2.b.p5", null);
  const [livesRaw, setLivesRaw, livesSaved] = useLocalState("return-lives.v2", null);
  const [livesV3Cur, , livesV3CurSaved] = useLocalState("return-lives.v3.cur", null);
  const [livesV3A, , livesV3ASaved] = useLocalState("return-lives.v3.a", null);
  const [livesV3B, , livesV3BSaved] = useLocalState("return-lives.v3.b", null);
  const [livesV4Cur, , livesV4CurSaved] = useLocalState("return-lives.v4.cur", null);
  const [livesV4A, , livesV4ASaved] = useLocalState("return-lives.v4.a", null);
  const [livesV4B, , livesV4BSaved] = useLocalState("return-lives.v4.b", null);
  const [archiveBlocked, setArchiveBlocked] = useState(false);
  const [oldIdx, setOldIdx, oldIdxSaved] = useLocalState("return-save.v1.idx", null);
  const [oldP0, setOldP0, oldP0s] = useLocalState("return-save.v1.p0", null);
  const [oldP1, setOldP1, oldP1s] = useLocalState("return-save.v1.p1", null);
  const [oldP2, setOldP2, oldP2s] = useLocalState("return-save.v1.p2", null);
  const [oldP3, setOldP3, oldP3s] = useLocalState("return-save.v1.p3", null);
  const allReady = curSaved.ready && aIdxSaved.ready && aP0s.ready && aP1s.ready && aP2s.ready && aP3s.ready && aP4s.ready && aP5s.ready && bIdxSaved.ready && bP0s.ready && bP1s.ready && bP2s.ready && bP3s.ready && bP4s.ready && bP5s.ready && livesV4CurSaved.ready && livesV4ASaved.ready && livesV4BSaved.ready && livesSaved.ready && livesV3CurSaved.ready && livesV3ASaved.ready && livesV3BSaved.ready && oldIdxSaved.ready && oldP0s.ready && oldP1s.ready && oldP2s.ready && oldP3s.ready;
  const storageView = storageScopeView([
    ...activeWriteState ? [activeWriteState] : [],
    curSaved,
    aIdxSaved,
    aP0s,
    aP1s,
    aP2s,
    aP3s,
    aP4s,
    aP5s,
    bIdxSaved,
    bP0s,
    bP1s,
    bP2s,
    bP3s,
    bP4s,
    bP5s,
    livesSaved,
    livesV3CurSaved,
    livesV3ASaved,
    livesV3BSaved,
    livesV4CurSaved,
    livesV4ASaved,
    livesV4BSaved,
    oldIdxSaved,
    oldP0s,
    oldP1s,
    oldP2s,
    oldP3s
  ], { failed: !!storageFailure, blocked: !!bootFailure || archiveBlocked });
  useEffect(() => {
    let cancelled = false;
    for (const [key, path] of Object.entries(VN_BGS)) {
      fetch(path).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      }).then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setVnUrls((prev) => prev[key] ? prev : { ...prev, [key]: url });
      }).catch(() => {
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const track = (e) => {
      const t = e.target;
      const btn = t && typeof t.closest === "function" ? t.closest("button") : null;
      if (btn && !btn.closest(".confirm-overlay")) lastButton.current = btn;
    };
    document.addEventListener("click", track, true);
    return () => document.removeEventListener("click", track, true);
  }, []);
  useEffect(() => {
    const stop = (e) => {
      if (!window.__returnStorageHalted) return;
      const t = e.target;
      if (t?.closest("#turn-card, #choices, #portfolio, #unlock-area, #vn-stage, .confirm-overlay")) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", stop, true);
    document.addEventListener("keydown", stop, true);
    return () => {
      document.removeEventListener("click", stop, true);
      document.removeEventListener("keydown", stop, true);
    };
  }, []);
  useEffect(() => {
    if (!window.__returnStorageHalted) return;
    for (const id of ["turn-card", "choices", "portfolio", "unlock-area", "vn-stage"]) document.getElementById(id)?.setAttribute("inert", "");
    setConfirmAsk(null);
    document.querySelector(".storage-failure")?.scrollIntoView({ block: "center" });
  }, [storageFailure]);
  useEffect(() => {
    const strip = () => {
      document.querySelectorAll('a[href*="start="], a[href*="economy="]').forEach((a) => {
        a.replaceWith(document.createTextNode(a.textContent || ""));
      });
    };
    const clarify = () => {
      if (!SERIESLESS.length) return;
      document.querySelectorAll("main button").forEach((b) => {
        const txt = b.textContent || "";
        if (txt.includes("시세 지점 없음") && !txt.includes("시계열 자료 미확보") && SERIESLESS.some((n) => txt.includes(n))) {
          b.textContent = txt.replace("— 시세 지점 없음", "— 시계열 자료 미확보(시연 표시만 \xB7 주문 불가)");
        }
      });
    };
    let panelEvents = [];
    let panelPrices = [];
    const buildPanel = (effDate, postClose, ev, sigKey) => {
      const box = document.createElement("details");
      box.className = "decision-panel";
      box.open = true;
      box.setAttribute("data-sig", sigKey);
      const sum = document.createElement("summary");
      sum.textContent = "판단 참고 — 이 판단일까지 관측 가능한 자료";
      box.appendChild(sum);
      box.appendChild(marketEl(effDate, postClose));
      const cases = priorCases(panelEvents, panelPrices, ev, effDate, postClose);
      const head = document.createElement("p");
      head.className = "dp-head";
      head.textContent = cases.length ? "같은 영향 태그의 직전 사건과 그 뒤 확보 지점(시기 참고, 인과 아님):" : "같은 영향 태그의 직전 사건 중 이 시점에 계산 가능한 결과가 없습니다(지점 부족 또는 첫 사례).";
      box.appendChild(head);
      if (cases.length) {
        const ul = document.createElement("ul");
        for (const c of cases) {
          const li = document.createElement("li");
          li.textContent = c.month + " \xB7 " + c.title + " — " + c.changes.map((ch) => {
            const fwd = (f, n) => f === null ? "" : " " + n + "개월 창 확보 지점 " + (f.pct >= 0 ? "▲" : "▼") + Math.abs(f.pct) + "%(" + f.date + ")";
            const parts = [fwd(ch.fwd1, 1), fwd(ch.fwd3, 3)].filter(Boolean);
            return ch.label + " " + parts.join(" \xB7 ") + " (기준 " + ch.baseDate + " 지점)";
          }).join(" / ");
          ul.appendChild(li);
        }
        box.appendChild(ul);
      }
      const foot = document.createElement("p");
      foot.className = "dp-foot";
      foot.textContent = "이 판단일(" + effDate + (postClose ? ", 장 마감 후" : "") + ")에 관측 가능한 지점만 사용했습니다(엔진과 같은 관측 규칙). 등락은 확보 지점과 지점 사이의 비교이며, 사건의 수익이나 정확히 1\xB73개월 뒤 수익이 아닙니다. 그 시점에 알 수 없는 결과는 비워 둡니다.";
      box.appendChild(foot);
      return box;
    };
    const marketEl = (effDate, postClose) => {
      const snap = marketSnapshot(panelPrices, effDate, postClose);
      const market = document.createElement("section");
      market.className = "dp-market";
      market.setAttribute("aria-label", "시장 참고 \xB7 확보 지점과 비교 기준");
      const heading = document.createElement("p");
      heading.className = "dp-head";
      heading.textContent = "시장 참고 \xB7 판단일 " + effDate;
      market.appendChild(heading);
      for (const row of snap) {
        const item = document.createElement("div");
        item.className = "dp-market-row";
        const title = document.createElement("strong");
        title.textContent = row.label + (row.point ? " " + row.point.value.toLocaleString() : " \xB7 지점 미확보");
        item.appendChild(title);
        if (row.point) {
          const date = document.createElement("p");
          date.textContent = "가격 기준일 " + row.point.date + (row.ageDays === 0 ? " \xB7 판단일 당일" : " \xB7 판단일보다 " + row.ageDays + "일 전");
          item.appendChild(date);
          const compare = document.createElement("p");
          compare.textContent = row.pct === null ? "한 달 전 관측일까지의 비교 기준이 없거나 같은 지점입니다." : "한 달 전 관측일(" + row.comparisonCutoff + ")까지 확보된 " + row.prevDate + " 지점 대비 " + (row.pct >= 0 ? "▲" : "▼") + Math.abs(row.pct) + "% \xB7 두 가격 기준일 간격 " + row.spanDays + "일";
          item.appendChild(compare);
        }
        market.appendChild(item);
      }
      const stale = snap.filter((row) => row.point && row.ageDays > 62);
      if (stale.length) {
        const warning = document.createElement("p");
        warning.className = "dp-head dp-market-gap";
        warning.textContent = stale.map((row) => row.label).join(" \xB7 ") + ": 가격 기준일이 판단일보다 62일 넘게 앞섭니다. 실제 시장 자료가 없다는 뜻이 아니라 이 게임의 확보 자료 공백입니다. 평가는 기존 지점에 머물 수 있고, 가격형 새 주문은 다음 적격 지점 전까지 미체결로 대기합니다. 다음 체결일을 예고하지 않습니다.";
        market.appendChild(warning);
      }
      const note = document.createElement("p");
      note.className = "dp-foot";
      note.textContent = "위 숫자는 판단 참고용 확보 지점입니다. 현재 시세\xB7주문 체결가를 보장하지 않으며, 두 지점 사이의 실제 시장 경로는 채우지 않습니다. 비교 관측일은 달력상 한 달 전(말일 보정)이며 비교 가격의 기준일과 다를 수 있습니다.";
      market.appendChild(note);
      return market;
    };
    const buildQuietPanel = (effDate, postClose, isSettlement = false) => {
      const box = document.createElement("details");
      box.className = "decision-panel";
      box.open = true;
      box.setAttribute("data-sig", effDate + "|" + (postClose ? "pc" : "quiet"));
      const sum = document.createElement("summary");
      sum.textContent = "판단 참고 — 이 관측일까지 확보된 자료";
      box.appendChild(sum);
      box.appendChild(marketEl(effDate, postClose));
      const note = document.createElement("p");
      note.className = "dp-head";
      note.textContent = isSettlement ? "이 화면은 분기 정산 전용 턴입니다. 사건 사례는 뉴스 턴의 판단 참고에서만 표시하며, 이 달에 뉴스가 있었는지와는 무관하게 여기서는 표시하지 않습니다." : "이 달에는 이 게임에 연결된 뉴스가 없어 사건 사례는 표시하지 않습니다. 실제 시장이 조용했다는 뜻은 아닙니다.";
      box.appendChild(note);
      const foot = document.createElement("p");
      foot.className = "dp-foot";
      foot.textContent = "이 관측일(" + effDate + (postClose ? ", 장 마감 후" : "") + ")에 확보된 지점만 사용했습니다(엔진과 같은 관측 규칙). 등락은 확보 지점과 지점 사이의 비교이며 수익 예고가 아닙니다.";
      box.appendChild(foot);
      return box;
    };
    let lastNewsPanel = null;
    const syncPanel = () => {
      const card = document.getElementById("turn-card");
      if (!card) return;
      const selected = window.__returnDecisionData;
      if (!selected || !Array.isArray(selected.events) || !Array.isArray(selected.prices)) {
        card.querySelector(".decision-panel")?.remove();
        lastNewsPanel = null;
        return;
      }
      panelEvents = selected.events;
      panelPrices = selected.prices;
      const existing = card.querySelector(".decision-panel");
      const dateEl = card.querySelector(".date");
      const h2 = card.querySelector("h2");
      const dtxt0 = (dateEl?.textContent || "").trim();
      if (lastNewsPanel && /^\d{4}-\d{2} · 포지션 조정/.test(dtxt0) && dtxt0.slice(0, 7) === lastNewsPanel.effDate.slice(0, 7)) {
        if (existing && existing.getAttribute("data-sig") === lastNewsPanel.sig) return;
        if (existing) existing.remove();
        card.appendChild(buildPanel(lastNewsPanel.effDate, lastNewsPanel.postClose, lastNewsPanel.ev, lastNewsPanel.sig));
        return;
      }
      if (dateEl && / · 평온/.test(dtxt0)) {
        const qm = dtxt0.match(/^(\d{4}-\d{2})/);
        if (!qm) {
          if (existing) existing.remove();
          return;
        }
        const effDate = qm[1] + "-01";
        lastNewsPanel = null;
        if (existing && existing.getAttribute("data-sig") === effDate + "|quiet") return;
        if (existing) existing.remove();
        card.appendChild(buildQuietPanel(effDate, false));
        return;
      }
      if (dateEl && dtxt0.includes(" \xB7 분기 정산 전용 턴")) {
        const qm = dtxt0.match(/^(\d{4}-\d{2})/);
        if (!qm) {
          if (existing) existing.remove();
          return;
        }
        const { effDate, postClose } = settlementEffDate(panelEvents, qm[1]);
        lastNewsPanel = null;
        const sig = effDate + "|" + (postClose ? "pc" : "quiet");
        if (existing && existing.getAttribute("data-sig") === sig) return;
        if (existing) existing.remove();
        card.appendChild(buildQuietPanel(effDate, postClose, true));
        return;
      }
      let cur = null;
      if (dateEl && h2 && dtxt0.includes("\xB7 뉴스")) {
        const dtxt = (dateEl.textContent || "").trim();
        const dm = dtxt.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
        const ev = panelEvents.find((e) => e.card_title === (h2.textContent || "").trim());
        if (dm && ev) {
          const effDate = dm[3] ? dm[0] : dm[0] + "-01";
          const evDay = ev.date.length === 10 ? ev.date : ev.date + "-01";
          if (effDate === evDay) {
            const postClose = dtxt.includes("장 마감 후");
            cur = { effDate, postClose, ev, sig: effDate + "|" + ev.id };
          }
        }
      }
      if (!cur) {
        if (existing) existing.remove();
        if (lastNewsPanel && /^\d{4}-\d{2}/.test(dtxt0) && dtxt0.slice(0, 7) !== lastNewsPanel.effDate.slice(0, 7)) lastNewsPanel = null;
        return;
      }
      lastNewsPanel = cur;
      if (existing && existing.getAttribute("data-sig") === cur.sig) return;
      if (existing) existing.remove();
      card.appendChild(buildPanel(cur.effDate, cur.postClose, cur.ev, cur.sig));
    };
    const sync = () => {
      strip();
      clarify();
      syncPanel();
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  const startEngine = (saveJson, archiveJson = livesRaw) => {
    delete window.__returnDecisionData;
    const ctx = storeRef.current;
    if (!ctx) return;
    installStorageShim(
      { [SAVE_KEY]: saveJson, [LIVES_KEY]: archiveJson, [LEGACY_KEY]: null },
      ctx.ss,
      setLivesRaw,
      ctx.livesState,
      (kind, reason, json) => setStorageFailure({ kind, reason, json })
    );
    window.confirm = (msg) => {
      if (armedAccept.current) {
        armedAccept.current = false;
        return true;
      }
      const text = String(msg ?? "");
      const kind = text.includes("새 회귀를 시작할까요") ? "restart" : text.includes("다시 불러올까요") ? "reload" : "generic";
      setConfirmAsk({ msg: text, kind });
      return false;
    };
    window.alert = (msg) => {
      setConfirmAsk({ msg: String(msg ?? ""), kind: "generic" });
    };
    import("./game-bundle.js").then(() => {
    }).catch((err) => {
      const card = document.getElementById("turn-card");
      if (card) card.innerHTML = '<div class="date">실행 준비 실패</div><h2>게임을 시작하지 못했어요</h2><p>페이지를 다시 불러 확인해 주세요.</p><p class="muted" id="boot-error"></p>';
      const slot = document.getElementById("boot-error");
      if (slot) slot.textContent = String(err && (err.message || err));
    });
  };
  useEffect(() => {
    if (started.current || !allReady) return;
    started.current = true;
    if (storageView.kind === "unknown") {
      setBootFailure("브라우저 저장을 읽지 못해 진행하지 않았습니다. 기존 기록을 덮어쓰지 않습니다. 저장 권한과 시크릿 모드 여부를 확인해 주세요.");
      return;
    }
    installGameDataFetch();
    const map = /* @__PURE__ */ new Map();
    const seed = (k, v) => {
      if (v != null) map.set(k, v);
    };
    seed(STORE_KEYS.cur, curRaw);
    seed(STORE_KEYS.genIdx("a"), aIdxRaw);
    [aP0, aP1, aP2, aP3, aP4, aP5].forEach((p, i) => seed(STORE_KEYS.genPart("a", i), p));
    seed(STORE_KEYS.genIdx("b"), bIdxRaw);
    [bP0, bP1, bP2, bP3, bP4, bP5].forEach((p, i) => seed(STORE_KEYS.genPart("b", i), p));
    seed(STORE_KEYS.v1Idx, oldIdx);
    [oldP0, oldP1, oldP2, oldP3].forEach((p, i) => seed(STORE_KEYS.v1Part(i), p));
    const keySetters = {
      [STORE_KEYS.cur]: setCurRaw,
      [STORE_KEYS.genIdx("a")]: setAIdxRaw,
      [STORE_KEYS.genIdx("b")]: setBIdxRaw,
      [STORE_KEYS.v1Idx]: setOldIdx
    };
    [setAP0, setAP1, setAP2, setAP3, setAP4, setAP5].forEach((s, i) => {
      keySetters[STORE_KEYS.genPart("a", i)] = s;
    });
    [setBP0, setBP1, setBP2, setBP3, setBP4, setBP5].forEach((s, i) => {
      keySetters[STORE_KEYS.genPart("b", i)] = s;
    });
    [setOldP0, setOldP1, setOldP2, setOldP3].forEach((s, i) => {
      keySetters[STORE_KEYS.v1Part(i)] = s;
    });
    const store = {
      commit: async (k, v) => {
        const bridge = browserPersistence;
        setActiveWriteState({ ready: true, status: "saving" });
        if (!bridge?.request) throw Error("browser-storage-unavailable");
        const encoded = JSON.stringify(v);
        const written = await bridge.request("local.write", { key: k, value: encoded });
        if (!written || !["saved", "memory"].includes(written.status)) throw Error("storage-write-unconfirmed");
        const check = await bridge.request("local.read", { key: k });
        if (!check || check.status !== written.status || check.value !== encoded) throw Error("storage-readback-unconfirmed");
        if (v == null) map.delete(k);
        else map.set(k, v);
        setActiveWriteState({ ready: true, status: check.status });
      },
      get: (k) => map.has(k) ? map.get(k) : null,
      set: (k, v) => {
        if (v == null) map.delete(k);
        else map.set(k, v);
        const s = keySetters[k];
        if (s) s(v);
      }
    };
    const ss = createSaveStore(store, { maxParts: MAX_PARTS });
    const extraBytes = [oldIdx, oldP0, oldP1, oldP2, oldP3].reduce((n, v) => n + physicalArchive(v), 0);
    const values = { "return-lives.v2": livesRaw, "return-lives.v3.cur": livesV3Cur, "return-lives.v3.a": livesV3A, "return-lives.v3.b": livesV3B, "return-lives.v4.cur": livesV4Cur, "return-lives.v4.a": livesV4A, "return-lives.v4.b": livesV4B };
    storeRef.current = { ss, livesState: { values, extraBytes, chars: ARCHIVE_KEYS.reduce((n, k) => n + physicalArchive(values[k]), 0) + extraBytes } };
    void (async () => {
      const boot = await ss.loadBoot();
      if (boot.kind === "corrupt") {
        setBootFailure("두 세대의 저장 조각을 모두 읽지 못했습니다. 읽지 못한 원문을 지우거나 새 게임으로 덮어쓰지 않았습니다. 이 페이지의 사이트 데이터를 지우지 마세요. 아래 버튼으로 손상된 저장을 정리하고 새로 시작할 수 있습니다.");
        return;
      }
      if (boot.kind === "v2" && boot.recovered) {
        setRecoveryNotice("가장 최근 저장 일부가 손상되어 이전 저장으로 복구했어요. 손상된 조각은 덮어쓰지 않았습니다.");
      }
      if (boot.kind === "legacy") {
        setRecoveryNotice("이전 실행본의 저장을 이 실행 방식으로 이어 받았어요. 첫 저장이 완료된 뒤에 이전 형식 키를 정리합니다.");
      }
      try {
        const loaded = await readRetention(archiveInputs(values));
        let archiveJson = loaded.raw;
        if (archiveJson !== null && retainLatest(archiveJson) !== archiveJson) {
          archiveJson = await persistRetained(storeRef.current.livesState, ss, archiveJson);
          setRecoveryNotice("보관 기준에 따라 최근 완료 회귀 1건은 상세 유지하고, 이전 회귀의 월별 자산은 요약했습니다. 주요 선택\xB7최종 자산\xB7비교 근거는 유지합니다. 없앤 월별 그래프는 복원할 수 없습니다.");
        }
        if (loaded.packed !== null && retainLatest(loaded.raw) === loaded.raw) {
          const bridge = browserPersistence;
          await cleanupRetained(storeRef.current.livesState, loaded.current, async (k, value) => {
            await bridge.request("local.write", { key: k, value });
          }, async (k) => {
            const r = await bridge.request("local.read", { key: k });
            if (!r || !["saved", "memory"].includes(r.status || "")) throw Error("retention-cleanup-status");
            return r.value;
          });
        }
        startEngine(boot.kind === "empty" ? null : boot.saveJson, archiveJson);
      } catch (_) {
        setArchiveBlocked(true);
        setBootFailure("회귀 기록의 읽기\xB7요약 전환 또는 안전한 저장 공간을 확인할 수 없어 멈췄습니다. 활성 저장은 지우지 않고 중단했습니다. 새 보관본이 이미 확정된 경우 이전 상세 중복본 일부는 정리됐을 수 있으며, 재로딩 때 검증된 보관본을 다시 확인합니다. 이 페이지의 사이트 데이터를 지우지 마세요.");
      }
    })();
  }, [allReady]);
  useEffect(() => {
    if (confirmAsk) document.querySelector(".confirm-card")?.scrollIntoView({ block: "center" });
  }, [confirmAsk]);
  const onBootReset = () => {
    storeRef.current?.ss.removeSave();
    setBootFailure(null);
    startEngine(null);
  };
  const confirmLabel = confirmAsk?.kind === "restart" ? "보존본을 남기고 새 회귀 시작" : confirmAsk?.kind === "reload" ? "다시 불러오기" : "확인";
  const onConfirmAccept = () => {
    const ask = confirmAsk;
    setConfirmAsk(null);
    if (!ask) return;
    if (ask.kind === "reload") {
      location.reload();
      return;
    }
    armedAccept.current = true;
    lastButton.current?.click();
  };
  const prepareRecordCopy = async () => {
    setCopyBusy(true);
    setRecordCopy(null);
    setCopyMessage("현재 기록을 읽기 대조하고 있어요.");
    try {
      if (!started.current || bootFailure || storageFailure || archiveBlocked) throw Error("정상 기록 읽기를 확인할 수 없어 사본을 만들지 않았어요.");
      const w = window;
      const result = await captureRecordCopy({
        read: (key) => browserPersistence.request("local.read", { key }),
        flush: () => w.__returnStorageFlush?.(),
        current: () => ({ active: localStorage.getItem(SAVE_KEY), archive: localStorage.getItem(LIVES_KEY) })
      });
      setRecordCopy(result);
      setCopyMessage("사본 준비 완료 \xB7 " + (result.scope === "preview-memory-only" ? "프리뷰 메모리 기록만 포함합니다. 영속 저장 확인이 아닙니다." : "이 브라우저의 저장 읽기를 대조했습니다. 다른 기기 보존 확인이 아닙니다."));
    } catch (e) {
      setCopyMessage(String(e.message || e));
    } finally {
      setCopyBusy(false);
    }
  };
  const downloadRecordCopy = () => {
    if (!recordCopy) return;
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([recordCopy.json], { type: "application/json;charset=utf-8" }));
    a.href = url;
    a.download = "return-record-copy.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
    setCopyMessage("파일 저장을 요청했습니다. 기기에 파일이 생겼는지 직접 확인해 주세요. 차단되면 아래 사본 원문을 선택해 따로 보관할 수 있어요.");
  };
  return /* @__PURE__ */ React.createElement("main", null, React.createElement("p", {className:"muted"}, React.createElement("a", {href:"import.html"}, "저장 사본 가져오기 · 원래 공간 선택")), /* @__PURE__ */ React.createElement("style", null, vnBgCss(vnUrls)), /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("h1", { id: "game-title" }, "리턴: 회귀 투자자"), /* @__PURE__ */ React.createElement("p", null, "시제품 \xB7 실행 구간 1996-03~2026-10 \xB7 뉴스 데이터는 1996~2026 부분 확보(연도별 공백 보충 중) \xB7 시세는 검증된 지점만 \xB7 시연용 설정(시드 100만원, 최종 설정 아님)"), React.createElement("details", {className:"intro-details",id:"intro-details"}, React.createElement("summary", {style:{minHeight:44,padding:"10px 0",boxSizing:"border-box"}}, "자료·실행 범위 자세히"), /* @__PURE__ */ React.createElement("p", { id: "deployment-scope-note" }, "공개 개발판 \xB7 보조 간격은 체결 적격 지점만 계산해요. 확인 안 된 연구행51개는 이 사본에서 제외하며, 원자료\xB7기존 전달 ZIP은 따로 보존해요. 금리366개는 한국은행 ECOS와 수치 대조를 마쳤고, 과거 최초 공표일과 실제 계약금리는 미확인입니다."), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "GitHub Pages 실행본입니다. 저장은 이 브라우저\xB7주소에만 남습니다. 이전 테스트 주소의 저장은 자동으로 옮겨지지 않습니다. 저장 범위는 아래 현재 응답 표시를 확인해 주세요. 브라우저 저장을 지원하는 열람에서도 이 기기\xB7계정\xB7페이지 범위이며, 다른 사본이나 이전 실행 주소의 저장은 자동으로 이어지지 않아요. 이 실행본은 본편(회귀 학교\xB7달력) 모드만 실행하며, 클래식\xB7실험 모드는 이 사본에서 지원하지 않아요."))), /* @__PURE__ */ React.createElement("section", { id: "storage-scope-status", className: "storage-scope-status storage-scope-" + storageView.kind, role: "status", "aria-live": "polite", "aria-atomic": "true" }, /* @__PURE__ */ React.createElement("strong", null, storageView.title), /* @__PURE__ */ React.createElement("p", null, storageView.detail)), bootFailure && /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "date" }, "저장 읽기 중단"), /* @__PURE__ */ React.createElement("h2", null, "저장을 확인하지 못해 시작하지 않았어요"), /* @__PURE__ */ React.createElement("p", null, bootFailure), !archiveBlocked && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onBootReset }, "손상된 저장을 지우고 새로 시작(되살릴 수 없음)")), recoveryNotice && /* @__PURE__ */ React.createElement("section", { className: "card", role: "status" }, /* @__PURE__ */ React.createElement("div", { className: "date" }, "저장 복구 안내"), /* @__PURE__ */ React.createElement("p", null, recoveryNotice), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setRecoveryNotice(null) }, "확인")), storageFailure && /* @__PURE__ */ React.createElement("section", { className: "card storage-failure", role: "alert" }, /* @__PURE__ */ React.createElement("div", { className: "date" }, "저장 실패"), /* @__PURE__ */ React.createElement("h2", null, storageFailure.kind === "save" ? "이번 진행을 저장하지 못했어요" : "회귀 기록을 저장하지 못했어요"), /* @__PURE__ */ React.createElement("p", null, storageFailure.reason, " 마지막 완전 저장의 보존 여부는 재열기 전까지 확정하지 않습니다. 실패 뒤 추가 진행은 중단하며, 이 화면을 닫으면 저장되지 않은 진행은 사라집니다. 아래 원문을 복사해 따로 보관할 수 있어요."), /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "저장되지 않은 원문 보기"), /* @__PURE__ */ React.createElement("textarea", { readOnly: true, rows: 6, value: storageFailure.json, onFocus: (e) => e.target.select() })), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: (e) => {
    const ta = e.target.closest(".storage-failure")?.querySelector("textarea");
    if (ta) {
      ta.focus();
      ta.select();
    }
    if (navigator.clipboard && storageFailure.json) void navigator.clipboard.writeText(storageFailure.json).catch(() => {
    });
  } }, "원문 복사"), /* @__PURE__ */ React.createElement("p", null, "원문을 따로 보관한 뒤 페이지를 다시 열어 마지막 완전 저장을 확인해 주세요. 사본은 가져오기 화면에서 호환 검사를 따로 거쳐야 합니다. 자동 복구나 동기화가 아닙니다.")), /* @__PURE__ */ React.createElement("div", { className: "vn-stage", id: "vn-stage", "data-scene": "news" }, /* @__PURE__ */ React.createElement("div", { className: "vn-bg" }), /* @__PURE__ */ React.createElement("img", { className: "vn-prop", id: "vn-prop", alt: "", hidden: true }), /* @__PURE__ */ React.createElement("div", { className: "vn-char" }, /* @__PURE__ */ React.createElement("img", { src: "char-student-common.png", alt: "허구의 학생 주인공" })), /* @__PURE__ */ React.createElement("div", { className: "vn-scene-label", id: "vn-scene-label" })), React.createElement("details", {className:"muted art-details",id:"art-details"}, React.createElement("summary", {style:{minHeight:44,padding:"10px 0",boxSizing:"border-box"}}, "허구 미술 · 시대 고증 아님 · 설명 보기"), /* @__PURE__ */ React.createElement("p", { className: "muted", id: "vn-art-note" })), /* @__PURE__ */ React.createElement("div", { id: "unlock-area" }), /* @__PURE__ */ React.createElement("section", { id: "turn-card", className: "card" }), /* @__PURE__ */ React.createElement("section", { className: "choices", id: "choices" }), /* @__PURE__ */ React.createElement("section", { id: "portfolio", className: "card" }), /* @__PURE__ */ React.createElement("p", { className: "muted", id: "footnote" }), /* @__PURE__ */ React.createElement("details", { className: "card record-copy", id: "record-copy" }, /* @__PURE__ */ React.createElement("summary", null, "현재 진행\xB7완료 회귀 사본 보관"), /* @__PURE__ */ React.createElement("p", null, "현재 이 페이지의 진행과 보관된 완료 회귀를 JSON 원문으로 준비합니다. 게임 진행\xB7자산\xB7주문\xB7보관기록을 바꾸지 않고, 다른 곳에 보내지 않아요."), /* @__PURE__ */ React.createElement("p", null, "자동 동기화나 복구 기능은 아닙니다. 가져오기 화면에서 별도로 검사·확인해야 하며 일부 사본은 지원하지 않습니다. 이전 회귀에서 이미 요약한 월별 상세는 사본으로도 되살릴 수 없습니다. 파일에는 게임 선택\xB7자산 기록이 들어가므로 공유에 주의해 주세요."), /* @__PURE__ */ React.createElement("button", { type: "button", id: "record-copy-prepare", disabled: !allReady || copyBusy || !!bootFailure || !!storageFailure, onClick: () => void prepareRecordCopy() }, copyBusy ? "기록 확인 중" : "읽기 대조 후 사본 준비"), /* @__PURE__ */ React.createElement("p", { role: "status", id: "record-copy-status" }, copyMessage), recordCopy && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", null, recordCopy.scope === "preview-memory-only" ? "프리뷰 메모리 사본 \xB7 영속 저장 확인이 아닙니다." : "이 브라우저 저장 읽기 대조 사본 \xB7 다른 기기 보존 확인이 아닙니다."), /* @__PURE__ */ React.createElement("p", null, "준비 시점: ", new Date(JSON.parse(recordCopy.json).createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }), " (KST) \xB7 진행월 ", recordCopy.summary.currentMonth || "없음", " \xB7 완료 회귀 ", recordCopy.summary.completedLives, "건"), /* @__PURE__ */ React.createElement("p", null, "아래 사본은 준비한 시점에 고정됩니다. 이후 진행을 담으려면 다시 준비해 주세요."), /* @__PURE__ */ React.createElement("button", { type: "button", id: "record-copy-download", onClick: downloadRecordCopy }, "준비한 JSON 파일 받기"), /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "준비한 사본 원문 보기"), /* @__PURE__ */ React.createElement("textarea", { id: "record-copy-raw", "aria-label": "준비한 게임 기록 사본 원문", readOnly: true, rows: 8, value: recordCopy.json, onFocus: (e) => e.target.select() })))), /* @__PURE__ */ React.createElement("details", { className: "muted asset-license" }, /* @__PURE__ */ React.createElement("summary", null, "생성 배경\xB7인물 이미지 라이선스"), /* @__PURE__ */ React.createElement("pre", null, assetLicenseRaw)), confirmAsk && /* @__PURE__ */ React.createElement("div", { className: "confirm-overlay", role: "dialog", "aria-modal": "true" }, /* @__PURE__ */ React.createElement("div", { className: "confirm-card" }, /* @__PURE__ */ React.createElement("p", null, confirmAsk.msg), /* @__PURE__ */ React.createElement("button", { type: "button", className: "confirm-accept", onClick: onConfirmAccept }, confirmLabel), /* @__PURE__ */ React.createElement("button", { type: "button", className: "confirm-cancel", onClick: () => setConfirmAsk(null) }, "취소"))));
}
