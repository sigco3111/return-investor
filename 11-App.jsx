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
        if (txt.includes("\uC2DC\uC138 \uC9C0\uC810 \uC5C6\uC74C") && !txt.includes("\uC2DC\uACC4\uC5F4 \uC790\uB8CC \uBBF8\uD655\uBCF4") && SERIESLESS.some((n) => txt.includes(n))) {
          b.textContent = txt.replace("\u2014 \uC2DC\uC138 \uC9C0\uC810 \uC5C6\uC74C", "\u2014 \uC2DC\uACC4\uC5F4 \uC790\uB8CC \uBBF8\uD655\uBCF4(\uC2DC\uC5F0 \uD45C\uC2DC\uB9CC \xB7 \uC8FC\uBB38 \uBD88\uAC00)");
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
      sum.textContent = "\uD310\uB2E8 \uCC38\uACE0 \u2014 \uC774 \uD310\uB2E8\uC77C\uAE4C\uC9C0 \uAD00\uCE21 \uAC00\uB2A5\uD55C \uC790\uB8CC";
      box.appendChild(sum);
      box.appendChild(marketEl(effDate, postClose));
      const cases = priorCases(panelEvents, panelPrices, ev, effDate, postClose);
      const head = document.createElement("p");
      head.className = "dp-head";
      head.textContent = cases.length ? "\uAC19\uC740 \uC601\uD5A5 \uD0DC\uADF8\uC758 \uC9C1\uC804 \uC0AC\uAC74\uACFC \uADF8 \uB4A4 \uD655\uBCF4 \uC9C0\uC810(\uC2DC\uAE30 \uCC38\uACE0, \uC778\uACFC \uC544\uB2D8):" : "\uAC19\uC740 \uC601\uD5A5 \uD0DC\uADF8\uC758 \uC9C1\uC804 \uC0AC\uAC74 \uC911 \uC774 \uC2DC\uC810\uC5D0 \uACC4\uC0B0 \uAC00\uB2A5\uD55C \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4(\uC9C0\uC810 \uBD80\uC871 \uB610\uB294 \uCCAB \uC0AC\uB840).";
      box.appendChild(head);
      if (cases.length) {
        const ul = document.createElement("ul");
        for (const c of cases) {
          const li = document.createElement("li");
          li.textContent = c.month + " \xB7 " + c.title + " \u2014 " + c.changes.map((ch) => {
            const fwd = (f, n) => f === null ? "" : " " + n + "\uAC1C\uC6D4 \uCC3D \uD655\uBCF4 \uC9C0\uC810 " + (f.pct >= 0 ? "\u25B2" : "\u25BC") + Math.abs(f.pct) + "%(" + f.date + ")";
            const parts = [fwd(ch.fwd1, 1), fwd(ch.fwd3, 3)].filter(Boolean);
            return ch.label + " " + parts.join(" \xB7 ") + " (\uAE30\uC900 " + ch.baseDate + " \uC9C0\uC810)";
          }).join(" / ");
          ul.appendChild(li);
        }
        box.appendChild(ul);
      }
      const foot = document.createElement("p");
      foot.className = "dp-foot";
      foot.textContent = "\uC774 \uD310\uB2E8\uC77C(" + effDate + (postClose ? ", \uC7A5 \uB9C8\uAC10 \uD6C4" : "") + ")\uC5D0 \uAD00\uCE21 \uAC00\uB2A5\uD55C \uC9C0\uC810\uB9CC \uC0AC\uC6A9\uD588\uC2B5\uB2C8\uB2E4(\uC5D4\uC9C4\uACFC \uAC19\uC740 \uAD00\uCE21 \uADDC\uCE59). \uB4F1\uB77D\uC740 \uD655\uBCF4 \uC9C0\uC810\uACFC \uC9C0\uC810 \uC0AC\uC774\uC758 \uBE44\uAD50\uC774\uBA70, \uC0AC\uAC74\uC758 \uC218\uC775\uC774\uB098 \uC815\uD655\uD788 1\xB73\uAC1C\uC6D4 \uB4A4 \uC218\uC775\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uADF8 \uC2DC\uC810\uC5D0 \uC54C \uC218 \uC5C6\uB294 \uACB0\uACFC\uB294 \uBE44\uC6CC \uB461\uB2C8\uB2E4.";
      box.appendChild(foot);
      return box;
    };
    const marketEl = (effDate, postClose) => {
      const snap = marketSnapshot(panelPrices, effDate, postClose);
      const market = document.createElement("section");
      market.className = "dp-market";
      market.setAttribute("aria-label", "\uC2DC\uC7A5 \uCC38\uACE0 \xB7 \uD655\uBCF4 \uC9C0\uC810\uACFC \uBE44\uAD50 \uAE30\uC900");
      const heading = document.createElement("p");
      heading.className = "dp-head";
      heading.textContent = "\uC2DC\uC7A5 \uCC38\uACE0 \xB7 \uD310\uB2E8\uC77C " + effDate;
      market.appendChild(heading);
      for (const row of snap) {
        const item = document.createElement("div");
        item.className = "dp-market-row";
        const title = document.createElement("strong");
        title.textContent = row.label + (row.point ? " " + row.point.value.toLocaleString() : " \xB7 \uC9C0\uC810 \uBBF8\uD655\uBCF4");
        item.appendChild(title);
        if (row.point) {
          const date = document.createElement("p");
          date.textContent = "\uAC00\uACA9 \uAE30\uC900\uC77C " + row.point.date + (row.ageDays === 0 ? " \xB7 \uD310\uB2E8\uC77C \uB2F9\uC77C" : " \xB7 \uD310\uB2E8\uC77C\uBCF4\uB2E4 " + row.ageDays + "\uC77C \uC804");
          item.appendChild(date);
          const compare = document.createElement("p");
          compare.textContent = row.pct === null ? "\uD55C \uB2EC \uC804 \uAD00\uCE21\uC77C\uAE4C\uC9C0\uC758 \uBE44\uAD50 \uAE30\uC900\uC774 \uC5C6\uAC70\uB098 \uAC19\uC740 \uC9C0\uC810\uC785\uB2C8\uB2E4." : "\uD55C \uB2EC \uC804 \uAD00\uCE21\uC77C(" + row.comparisonCutoff + ")\uAE4C\uC9C0 \uD655\uBCF4\uB41C " + row.prevDate + " \uC9C0\uC810 \uB300\uBE44 " + (row.pct >= 0 ? "\u25B2" : "\u25BC") + Math.abs(row.pct) + "% \xB7 \uB450 \uAC00\uACA9 \uAE30\uC900\uC77C \uAC04\uACA9 " + row.spanDays + "\uC77C";
          item.appendChild(compare);
        }
        market.appendChild(item);
      }
      const stale = snap.filter((row) => row.point && row.ageDays > 62);
      if (stale.length) {
        const warning = document.createElement("p");
        warning.className = "dp-head dp-market-gap";
        warning.textContent = stale.map((row) => row.label).join(" \xB7 ") + ": \uAC00\uACA9 \uAE30\uC900\uC77C\uC774 \uD310\uB2E8\uC77C\uBCF4\uB2E4 62\uC77C \uB118\uAC8C \uC55E\uC12D\uB2C8\uB2E4. \uC2E4\uC81C \uC2DC\uC7A5 \uC790\uB8CC\uAC00 \uC5C6\uB2E4\uB294 \uB73B\uC774 \uC544\uB2C8\uB77C \uC774 \uAC8C\uC784\uC758 \uD655\uBCF4 \uC790\uB8CC \uACF5\uBC31\uC785\uB2C8\uB2E4. \uD3C9\uAC00\uB294 \uAE30\uC874 \uC9C0\uC810\uC5D0 \uBA38\uBB3C \uC218 \uC788\uACE0, \uAC00\uACA9\uD615 \uC0C8 \uC8FC\uBB38\uC740 \uB2E4\uC74C \uC801\uACA9 \uC9C0\uC810 \uC804\uAE4C\uC9C0 \uBBF8\uCCB4\uACB0\uB85C \uB300\uAE30\uD569\uB2C8\uB2E4. \uB2E4\uC74C \uCCB4\uACB0\uC77C\uC744 \uC608\uACE0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
        market.appendChild(warning);
      }
      const note = document.createElement("p");
      note.className = "dp-foot";
      note.textContent = "\uC704 \uC22B\uC790\uB294 \uD310\uB2E8 \uCC38\uACE0\uC6A9 \uD655\uBCF4 \uC9C0\uC810\uC785\uB2C8\uB2E4. \uD604\uC7AC \uC2DC\uC138\xB7\uC8FC\uBB38 \uCCB4\uACB0\uAC00\uB97C \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC73C\uBA70, \uB450 \uC9C0\uC810 \uC0AC\uC774\uC758 \uC2E4\uC81C \uC2DC\uC7A5 \uACBD\uB85C\uB294 \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBE44\uAD50 \uAD00\uCE21\uC77C\uC740 \uB2EC\uB825\uC0C1 \uD55C \uB2EC \uC804(\uB9D0\uC77C \uBCF4\uC815)\uC774\uBA70 \uBE44\uAD50 \uAC00\uACA9\uC758 \uAE30\uC900\uC77C\uACFC \uB2E4\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
      market.appendChild(note);
      return market;
    };
    const buildQuietPanel = (effDate, postClose, isSettlement = false) => {
      const box = document.createElement("details");
      box.className = "decision-panel";
      box.open = true;
      box.setAttribute("data-sig", effDate + "|" + (postClose ? "pc" : "quiet"));
      const sum = document.createElement("summary");
      sum.textContent = "\uD310\uB2E8 \uCC38\uACE0 \u2014 \uC774 \uAD00\uCE21\uC77C\uAE4C\uC9C0 \uD655\uBCF4\uB41C \uC790\uB8CC";
      box.appendChild(sum);
      box.appendChild(marketEl(effDate, postClose));
      const note = document.createElement("p");
      note.className = "dp-head";
      note.textContent = isSettlement ? "\uC774 \uD654\uBA74\uC740 \uBD84\uAE30 \uC815\uC0B0 \uC804\uC6A9 \uD134\uC785\uB2C8\uB2E4. \uC0AC\uAC74 \uC0AC\uB840\uB294 \uB274\uC2A4 \uD134\uC758 \uD310\uB2E8 \uCC38\uACE0\uC5D0\uC11C\uB9CC \uD45C\uC2DC\uD558\uBA70, \uC774 \uB2EC\uC5D0 \uB274\uC2A4\uAC00 \uC788\uC5C8\uB294\uC9C0\uC640\uB294 \uBB34\uAD00\uD558\uAC8C \uC5EC\uAE30\uC11C\uB294 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uC774 \uB2EC\uC5D0\uB294 \uC774 \uAC8C\uC784\uC5D0 \uC5F0\uACB0\uB41C \uB274\uC2A4\uAC00 \uC5C6\uC5B4 \uC0AC\uAC74 \uC0AC\uB840\uB294 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uC2DC\uC7A5\uC774 \uC870\uC6A9\uD588\uB2E4\uB294 \uB73B\uC740 \uC544\uB2D9\uB2C8\uB2E4.";
      box.appendChild(note);
      const foot = document.createElement("p");
      foot.className = "dp-foot";
      foot.textContent = "\uC774 \uAD00\uCE21\uC77C(" + effDate + (postClose ? ", \uC7A5 \uB9C8\uAC10 \uD6C4" : "") + ")\uC5D0 \uD655\uBCF4\uB41C \uC9C0\uC810\uB9CC \uC0AC\uC6A9\uD588\uC2B5\uB2C8\uB2E4(\uC5D4\uC9C4\uACFC \uAC19\uC740 \uAD00\uCE21 \uADDC\uCE59). \uB4F1\uB77D\uC740 \uD655\uBCF4 \uC9C0\uC810\uACFC \uC9C0\uC810 \uC0AC\uC774\uC758 \uBE44\uAD50\uC774\uBA70 \uC218\uC775 \uC608\uACE0\uAC00 \uC544\uB2D9\uB2C8\uB2E4.";
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
      if (dateEl && dtxt0.includes(" \xB7 \uBD84\uAE30 \uC815\uC0B0 \uC804\uC6A9 \uD134")) {
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
      if (dateEl && h2 && dtxt0.includes("\xB7 \uB274\uC2A4")) {
        const dtxt = (dateEl.textContent || "").trim();
        const dm = dtxt.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
        const ev = panelEvents.find((e) => e.card_title === (h2.textContent || "").trim());
        if (dm && ev) {
          const effDate = dm[3] ? dm[0] : dm[0] + "-01";
          const evDay = ev.date.length === 10 ? ev.date : ev.date + "-01";
          if (effDate === evDay) {
            const postClose = dtxt.includes("\uC7A5 \uB9C8\uAC10 \uD6C4");
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
      const kind = text.includes("\uC0C8 \uD68C\uADC0\uB97C \uC2DC\uC791\uD560\uAE4C\uC694") ? "restart" : text.includes("\uB2E4\uC2DC \uBD88\uB7EC\uC62C\uAE4C\uC694") ? "reload" : "generic";
      setConfirmAsk({ msg: text, kind });
      return false;
    };
    window.alert = (msg) => {
      setConfirmAsk({ msg: String(msg ?? ""), kind: "generic" });
    };
    import("./game-bundle.js").then(() => {
    }).catch((err) => {
      const card = document.getElementById("turn-card");
      if (card) card.innerHTML = '<div class="date">\uC2E4\uD589 \uC900\uBE44 \uC2E4\uD328</div><h2>\uAC8C\uC784\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694</h2><p>\uD398\uC774\uC9C0\uB97C \uB2E4\uC2DC \uBD88\uB7EC \uD655\uC778\uD574 \uC8FC\uC138\uC694.</p><p class="muted" id="boot-error"></p>';
      const slot = document.getElementById("boot-error");
      if (slot) slot.textContent = String(err && (err.message || err));
    });
  };
  useEffect(() => {
    if (started.current || !allReady) return;
    started.current = true;
    if (storageView.kind === "unknown") {
      setBootFailure("\uBE0C\uB77C\uC6B0\uC800 \uC800\uC7A5\uC744 \uC77D\uC9C0 \uBABB\uD574 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uAE30\uB85D\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC800\uC7A5 \uAD8C\uD55C\uACFC \uC2DC\uD06C\uB9BF \uBAA8\uB4DC \uC5EC\uBD80\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
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
        setBootFailure("\uB450 \uC138\uB300\uC758 \uC800\uC7A5 \uC870\uAC01\uC744 \uBAA8\uB450 \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC77D\uC9C0 \uBABB\uD55C \uC6D0\uBB38\uC744 \uC9C0\uC6B0\uAC70\uB098 \uC0C8 \uAC8C\uC784\uC73C\uB85C \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC774 \uD398\uC774\uC9C0\uC758 \uC0AC\uC774\uD2B8 \uB370\uC774\uD130\uB97C \uC9C0\uC6B0\uC9C0 \uB9C8\uC138\uC694. \uC544\uB798 \uBC84\uD2BC\uC73C\uB85C \uC190\uC0C1\uB41C \uC800\uC7A5\uC744 \uC815\uB9AC\uD558\uACE0 \uC0C8\uB85C \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        return;
      }
      if (boot.kind === "v2" && boot.recovered) {
        setRecoveryNotice("\uAC00\uC7A5 \uCD5C\uADFC \uC800\uC7A5 \uC77C\uBD80\uAC00 \uC190\uC0C1\uB418\uC5B4 \uC774\uC804 \uC800\uC7A5\uC73C\uB85C \uBCF5\uAD6C\uD588\uC5B4\uC694. \uC190\uC0C1\uB41C \uC870\uAC01\uC740 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      }
      if (boot.kind === "legacy") {
        setRecoveryNotice("\uC774\uC804 \uC2E4\uD589\uBCF8\uC758 \uC800\uC7A5\uC744 \uC774 \uC2E4\uD589 \uBC29\uC2DD\uC73C\uB85C \uC774\uC5B4 \uBC1B\uC558\uC5B4\uC694. \uCCAB \uC800\uC7A5\uC774 \uC644\uB8CC\uB41C \uB4A4\uC5D0 \uC774\uC804 \uD615\uC2DD \uD0A4\uB97C \uC815\uB9AC\uD569\uB2C8\uB2E4.");
      }
      try {
        const loaded = await readRetention(archiveInputs(values));
        let archiveJson = loaded.raw;
        if (archiveJson !== null && retainLatest(archiveJson) !== archiveJson) {
          archiveJson = await persistRetained(storeRef.current.livesState, ss, archiveJson);
          setRecoveryNotice("\uBCF4\uAD00 \uAE30\uC900\uC5D0 \uB530\uB77C \uCD5C\uADFC \uC644\uB8CC \uD68C\uADC0 1\uAC74\uC740 \uC0C1\uC138 \uC720\uC9C0\uD558\uACE0, \uC774\uC804 \uD68C\uADC0\uC758 \uC6D4\uBCC4 \uC790\uC0B0\uC740 \uC694\uC57D\uD588\uC2B5\uB2C8\uB2E4. \uC8FC\uC694 \uC120\uD0DD\xB7\uCD5C\uC885 \uC790\uC0B0\xB7\uBE44\uAD50 \uADFC\uAC70\uB294 \uC720\uC9C0\uD569\uB2C8\uB2E4. \uC5C6\uC564 \uC6D4\uBCC4 \uADF8\uB798\uD504\uB294 \uBCF5\uC6D0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
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
        setBootFailure("\uD68C\uADC0 \uAE30\uB85D\uC758 \uC77D\uAE30\xB7\uC694\uC57D \uC804\uD658 \uB610\uB294 \uC548\uC804\uD55C \uC800\uC7A5 \uACF5\uAC04\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uD65C\uC131 \uC800\uC7A5\uC740 \uC9C0\uC6B0\uC9C0 \uC54A\uACE0 \uC911\uB2E8\uD588\uC2B5\uB2C8\uB2E4. \uC0C8 \uBCF4\uAD00\uBCF8\uC774 \uC774\uBBF8 \uD655\uC815\uB41C \uACBD\uC6B0 \uC774\uC804 \uC0C1\uC138 \uC911\uBCF5\uBCF8 \uC77C\uBD80\uB294 \uC815\uB9AC\uB410\uC744 \uC218 \uC788\uC73C\uBA70, \uC7AC\uB85C\uB529 \uB54C \uAC80\uC99D\uB41C \uBCF4\uAD00\uBCF8\uC744 \uB2E4\uC2DC \uD655\uC778\uD569\uB2C8\uB2E4. \uC774 \uD398\uC774\uC9C0\uC758 \uC0AC\uC774\uD2B8 \uB370\uC774\uD130\uB97C \uC9C0\uC6B0\uC9C0 \uB9C8\uC138\uC694.");
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
  const confirmLabel = confirmAsk?.kind === "restart" ? "\uBCF4\uC874\uBCF8\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0 \uC2DC\uC791" : confirmAsk?.kind === "reload" ? "\uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30" : "\uD655\uC778";
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
    setCopyMessage("\uD604\uC7AC \uAE30\uB85D\uC744 \uC77D\uAE30 \uB300\uC870\uD558\uACE0 \uC788\uC5B4\uC694.");
    try {
      if (!started.current || bootFailure || storageFailure || archiveBlocked) throw Error("\uC815\uC0C1 \uAE30\uB85D \uC77D\uAE30\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uC0AC\uBCF8\uC744 \uB9CC\uB4E4\uC9C0 \uC54A\uC558\uC5B4\uC694.");
      const w = window;
      const result = await captureRecordCopy({
        read: (key) => browserPersistence.request("local.read", { key }),
        flush: () => w.__returnStorageFlush?.(),
        current: () => ({ active: localStorage.getItem(SAVE_KEY), archive: localStorage.getItem(LIVES_KEY) })
      });
      setRecordCopy(result);
      setCopyMessage("\uC0AC\uBCF8 \uC900\uBE44 \uC644\uB8CC \xB7 " + (result.scope === "preview-memory-only" ? "\uD504\uB9AC\uBDF0 \uBA54\uBAA8\uB9AC \uAE30\uB85D\uB9CC \uD3EC\uD568\uD569\uB2C8\uB2E4. \uC601\uC18D \uC800\uC7A5 \uD655\uC778\uC774 \uC544\uB2D9\uB2C8\uB2E4." : "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC758 \uC800\uC7A5 \uC77D\uAE30\uB97C \uB300\uC870\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uAE30\uAE30 \uBCF4\uC874 \uD655\uC778\uC774 \uC544\uB2D9\uB2C8\uB2E4."));
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
    setCopyMessage("\uD30C\uC77C \uC800\uC7A5\uC744 \uC694\uCCAD\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uAE30\uC5D0 \uD30C\uC77C\uC774 \uC0DD\uACBC\uB294\uC9C0 \uC9C1\uC811 \uD655\uC778\uD574 \uC8FC\uC138\uC694. \uCC28\uB2E8\uB418\uBA74 \uC544\uB798 \uC0AC\uBCF8 \uC6D0\uBB38\uC744 \uC120\uD0DD\uD574 \uB530\uB85C \uBCF4\uAD00\uD560 \uC218 \uC788\uC5B4\uC694.");
  };
  return /* @__PURE__ */ React.createElement("main", null, /* @__PURE__ */ React.createElement("style", null, vnBgCss(vnUrls)), /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("h1", { id: "game-title" }, "\uB9AC\uD134: \uD68C\uADC0 \uD22C\uC790\uC790"), /* @__PURE__ */ React.createElement("p", null, "\uC2DC\uC81C\uD488 \xB7 \uC2E4\uD589 \uAD6C\uAC04 1996-03~2026-10 \xB7 \uB274\uC2A4 \uB370\uC774\uD130\uB294 1996~2026 \uBD80\uBD84 \uD655\uBCF4(\uC5F0\uB3C4\uBCC4 \uACF5\uBC31 \uBCF4\uCDA9 \uC911) \xB7 \uC2DC\uC138\uB294 \uAC80\uC99D\uB41C \uC9C0\uC810\uB9CC \xB7 \uC2DC\uC5F0\uC6A9 \uC124\uC815(\uC2DC\uB4DC 100\uB9CC\uC6D0, \uCD5C\uC885 \uC124\uC815 \uC544\uB2D8)"), React.createElement("details", {className:"intro-details",id:"intro-details"}, React.createElement("summary", {style:{minHeight:44,padding:"10px 0",boxSizing:"border-box"}}, "자료·실행 범위 자세히"), /* @__PURE__ */ React.createElement("p", { id: "deployment-scope-note" }, "\uACF5\uAC1C \uAC1C\uBC1C\uD310 \xB7 \uBCF4\uC870 \uAC04\uACA9\uC740 \uCCB4\uACB0 \uC801\uACA9 \uC9C0\uC810\uB9CC \uACC4\uC0B0\uD574\uC694. \uD655\uC778 \uC548 \uB41C \uC5F0\uAD6C\uD58951\uAC1C\uB294 \uC774 \uC0AC\uBCF8\uC5D0\uC11C \uC81C\uC678\uD558\uBA70, \uC6D0\uC790\uB8CC\xB7\uAE30\uC874 \uC804\uB2EC ZIP\uC740 \uB530\uB85C \uBCF4\uC874\uD574\uC694. \uAE08\uB9AC366\uAC1C\uB294 \uD55C\uAD6D\uC740\uD589 ECOS\uC640 \uC218\uCE58 \uB300\uC870\uB97C \uB9C8\uCCE4\uACE0, \uACFC\uAC70 \uCD5C\uCD08 \uACF5\uD45C\uC77C\uACFC \uC2E4\uC81C \uACC4\uC57D\uAE08\uB9AC\uB294 \uBBF8\uD655\uC778\uC785\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("p", { className: "muted" }, "GitHub Pages \uC2E4\uD589\uBCF8\uC785\uB2C8\uB2E4. \uC800\uC7A5\uC740 \uC774 \uBE0C\uB77C\uC6B0\uC800\xB7\uC8FC\uC18C\uC5D0\uB9CC \uB0A8\uC2B5\uB2C8\uB2E4. \uC774\uC804 \uD14C\uC2A4\uD2B8 \uC8FC\uC18C\uC758 \uC800\uC7A5\uC740 \uC790\uB3D9\uC73C\uB85C \uC62E\uACA8\uC9C0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC800\uC7A5 \uBC94\uC704\uB294 \uC544\uB798 \uD604\uC7AC \uC751\uB2F5 \uD45C\uC2DC\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694. \uBE0C\uB77C\uC6B0\uC800 \uC800\uC7A5\uC744 \uC9C0\uC6D0\uD558\uB294 \uC5F4\uB78C\uC5D0\uC11C\uB3C4 \uC774 \uAE30\uAE30\xB7\uACC4\uC815\xB7\uD398\uC774\uC9C0 \uBC94\uC704\uC774\uBA70, \uB2E4\uB978 \uC0AC\uBCF8\uC774\uB098 \uC774\uC804 \uC2E4\uD589 \uC8FC\uC18C\uC758 \uC800\uC7A5\uC740 \uC790\uB3D9\uC73C\uB85C \uC774\uC5B4\uC9C0\uC9C0 \uC54A\uC544\uC694. \uC774 \uC2E4\uD589\uBCF8\uC740 \uBCF8\uD3B8(\uD68C\uADC0 \uD559\uAD50\xB7\uB2EC\uB825) \uBAA8\uB4DC\uB9CC \uC2E4\uD589\uD558\uBA70, \uD074\uB798\uC2DD\xB7\uC2E4\uD5D8 \uBAA8\uB4DC\uB294 \uC774 \uC0AC\uBCF8\uC5D0\uC11C \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC544\uC694."))), /* @__PURE__ */ React.createElement("section", { id: "storage-scope-status", className: "storage-scope-status storage-scope-" + storageView.kind, role: "status", "aria-live": "polite", "aria-atomic": "true" }, /* @__PURE__ */ React.createElement("strong", null, storageView.title), /* @__PURE__ */ React.createElement("p", null, storageView.detail)), bootFailure && /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "date" }, "\uC800\uC7A5 \uC77D\uAE30 \uC911\uB2E8"), /* @__PURE__ */ React.createElement("h2", null, "\uC800\uC7A5\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uC2DC\uC791\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694"), /* @__PURE__ */ React.createElement("p", null, bootFailure), !archiveBlocked && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onBootReset }, "\uC190\uC0C1\uB41C \uC800\uC7A5\uC744 \uC9C0\uC6B0\uACE0 \uC0C8\uB85C \uC2DC\uC791(\uB418\uC0B4\uB9B4 \uC218 \uC5C6\uC74C)")), recoveryNotice && /* @__PURE__ */ React.createElement("section", { className: "card", role: "status" }, /* @__PURE__ */ React.createElement("div", { className: "date" }, "\uC800\uC7A5 \uBCF5\uAD6C \uC548\uB0B4"), /* @__PURE__ */ React.createElement("p", null, recoveryNotice), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setRecoveryNotice(null) }, "\uD655\uC778")), storageFailure && /* @__PURE__ */ React.createElement("section", { className: "card storage-failure", role: "alert" }, /* @__PURE__ */ React.createElement("div", { className: "date" }, "\uC800\uC7A5 \uC2E4\uD328"), /* @__PURE__ */ React.createElement("h2", null, storageFailure.kind === "save" ? "\uC774\uBC88 \uC9C4\uD589\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694" : "\uD68C\uADC0 \uAE30\uB85D\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694"), /* @__PURE__ */ React.createElement("p", null, storageFailure.reason, " \uB9C8\uC9C0\uB9C9 \uC644\uC804 \uC800\uC7A5\uC758 \uBCF4\uC874 \uC5EC\uBD80\uB294 \uC7AC\uC5F4\uAE30 \uC804\uAE4C\uC9C0 \uD655\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC2E4\uD328 \uB4A4 \uCD94\uAC00 \uC9C4\uD589\uC740 \uC911\uB2E8\uD558\uBA70, \uC774 \uD654\uBA74\uC744 \uB2EB\uC73C\uBA74 \uC800\uC7A5\uB418\uC9C0 \uC54A\uC740 \uC9C4\uD589\uC740 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4. \uC544\uB798 \uC6D0\uBB38\uC744 \uBCF5\uC0AC\uD574 \uB530\uB85C \uBCF4\uAD00\uD560 \uC218 \uC788\uC5B4\uC694."), /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "\uC800\uC7A5\uB418\uC9C0 \uC54A\uC740 \uC6D0\uBB38 \uBCF4\uAE30"), /* @__PURE__ */ React.createElement("textarea", { readOnly: true, rows: 6, value: storageFailure.json, onFocus: (e) => e.target.select() })), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: (e) => {
    const ta = e.target.closest(".storage-failure")?.querySelector("textarea");
    if (ta) {
      ta.focus();
      ta.select();
    }
    if (navigator.clipboard && storageFailure.json) void navigator.clipboard.writeText(storageFailure.json).catch(() => {
    });
  } }, "\uC6D0\uBB38 \uBCF5\uC0AC"), /* @__PURE__ */ React.createElement("p", null, "\uC6D0\uBB38\uC744 \uB530\uB85C \uBCF4\uAD00\uD55C \uB4A4 \uD398\uC774\uC9C0\uB97C \uB2E4\uC2DC \uC5F4\uC5B4 \uB9C8\uC9C0\uB9C9 \uC644\uC804 \uC800\uC7A5\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694. \uC774 \uC2E4\uD589\uBCF8\uC5D0\uB294 \uC0AC\uBCF8 \uAC00\uC838\uC624\uAE30 \uAE30\uB2A5\uC774 \uC5C6\uC5B4\uC694.")), /* @__PURE__ */ React.createElement("div", { className: "vn-stage", id: "vn-stage", "data-scene": "news" }, /* @__PURE__ */ React.createElement("div", { className: "vn-bg" }), /* @__PURE__ */ React.createElement("img", { className: "vn-prop", id: "vn-prop", alt: "", hidden: true }), /* @__PURE__ */ React.createElement("div", { className: "vn-char" }, /* @__PURE__ */ React.createElement("img", { src: "char-student-common.png", alt: "\uD5C8\uAD6C\uC758 \uD559\uC0DD \uC8FC\uC778\uACF5" })), /* @__PURE__ */ React.createElement("div", { className: "vn-scene-label", id: "vn-scene-label" })), React.createElement("details", {className:"muted art-details",id:"art-details"}, React.createElement("summary", {style:{minHeight:44,padding:"10px 0",boxSizing:"border-box"}}, "허구 미술 · 시대 고증 아님 · 설명 보기"), /* @__PURE__ */ React.createElement("p", { className: "muted", id: "vn-art-note" })), /* @__PURE__ */ React.createElement("div", { id: "unlock-area" }), /* @__PURE__ */ React.createElement("section", { id: "turn-card", className: "card" }), /* @__PURE__ */ React.createElement("section", { className: "choices", id: "choices" }), /* @__PURE__ */ React.createElement("section", { id: "portfolio", className: "card" }), /* @__PURE__ */ React.createElement("p", { className: "muted", id: "footnote" }), /* @__PURE__ */ React.createElement("details", { className: "card record-copy", id: "record-copy" }, /* @__PURE__ */ React.createElement("summary", null, "\uD604\uC7AC \uC9C4\uD589\xB7\uC644\uB8CC \uD68C\uADC0 \uC0AC\uBCF8 \uBCF4\uAD00"), /* @__PURE__ */ React.createElement("p", null, "\uD604\uC7AC \uC774 \uD398\uC774\uC9C0\uC758 \uC9C4\uD589\uACFC \uBCF4\uAD00\uB41C \uC644\uB8CC \uD68C\uADC0\uB97C JSON \uC6D0\uBB38\uC73C\uB85C \uC900\uBE44\uD569\uB2C8\uB2E4. \uAC8C\uC784 \uC9C4\uD589\xB7\uC790\uC0B0\xB7\uC8FC\uBB38\xB7\uBCF4\uAD00\uAE30\uB85D\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uACE0, \uB2E4\uB978 \uACF3\uC5D0 \uBCF4\uB0B4\uC9C0 \uC54A\uC544\uC694."), /* @__PURE__ */ React.createElement("p", null, "\uC790\uB3D9 \uB3D9\uAE30\uD654\uB098 \uBCF5\uAD6C \uAE30\uB2A5\uC740 \uC544\uB2D9\uB2C8\uB2E4. \uC774 \uC2E4\uD589\uBCF8\uC5D0\uB294 \uAC00\uC838\uC624\uAE30\uAC00 \uC5C6\uC5B4\uC694. \uC774\uC804 \uD68C\uADC0\uC5D0\uC11C \uC774\uBBF8 \uC694\uC57D\uD55C \uC6D4\uBCC4 \uC0C1\uC138\uB294 \uC0AC\uBCF8\uC73C\uB85C\uB3C4 \uB418\uC0B4\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD30C\uC77C\uC5D0\uB294 \uAC8C\uC784 \uC120\uD0DD\xB7\uC790\uC0B0 \uAE30\uB85D\uC774 \uB4E4\uC5B4\uAC00\uBBC0\uB85C \uACF5\uC720\uC5D0 \uC8FC\uC758\uD574 \uC8FC\uC138\uC694."), /* @__PURE__ */ React.createElement("button", { type: "button", id: "record-copy-prepare", disabled: !allReady || copyBusy || !!bootFailure || !!storageFailure, onClick: () => void prepareRecordCopy() }, copyBusy ? "\uAE30\uB85D \uD655\uC778 \uC911" : "\uC77D\uAE30 \uB300\uC870 \uD6C4 \uC0AC\uBCF8 \uC900\uBE44"), /* @__PURE__ */ React.createElement("p", { role: "status", id: "record-copy-status" }, copyMessage), recordCopy && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", null, recordCopy.scope === "preview-memory-only" ? "\uD504\uB9AC\uBDF0 \uBA54\uBAA8\uB9AC \uC0AC\uBCF8 \xB7 \uC601\uC18D \uC800\uC7A5 \uD655\uC778\uC774 \uC544\uB2D9\uB2C8\uB2E4." : "\uC774 \uBE0C\uB77C\uC6B0\uC800 \uC800\uC7A5 \uC77D\uAE30 \uB300\uC870 \uC0AC\uBCF8 \xB7 \uB2E4\uB978 \uAE30\uAE30 \uBCF4\uC874 \uD655\uC778\uC774 \uC544\uB2D9\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("p", null, "\uC900\uBE44 \uC2DC\uC810: ", new Date(JSON.parse(recordCopy.json).createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }), " (KST) \xB7 \uC9C4\uD589\uC6D4 ", recordCopy.summary.currentMonth || "\uC5C6\uC74C", " \xB7 \uC644\uB8CC \uD68C\uADC0 ", recordCopy.summary.completedLives, "\uAC74"), /* @__PURE__ */ React.createElement("p", null, "\uC544\uB798 \uC0AC\uBCF8\uC740 \uC900\uBE44\uD55C \uC2DC\uC810\uC5D0 \uACE0\uC815\uB429\uB2C8\uB2E4. \uC774\uD6C4 \uC9C4\uD589\uC744 \uB2F4\uC73C\uB824\uBA74 \uB2E4\uC2DC \uC900\uBE44\uD574 \uC8FC\uC138\uC694."), /* @__PURE__ */ React.createElement("button", { type: "button", id: "record-copy-download", onClick: downloadRecordCopy }, "\uC900\uBE44\uD55C JSON \uD30C\uC77C \uBC1B\uAE30"), /* @__PURE__ */ React.createElement("details", null, /* @__PURE__ */ React.createElement("summary", null, "\uC900\uBE44\uD55C \uC0AC\uBCF8 \uC6D0\uBB38 \uBCF4\uAE30"), /* @__PURE__ */ React.createElement("textarea", { id: "record-copy-raw", "aria-label": "\uC900\uBE44\uD55C \uAC8C\uC784 \uAE30\uB85D \uC0AC\uBCF8 \uC6D0\uBB38", readOnly: true, rows: 8, value: recordCopy.json, onFocus: (e) => e.target.select() })))), /* @__PURE__ */ React.createElement("details", { className: "muted asset-license" }, /* @__PURE__ */ React.createElement("summary", null, "\uC0DD\uC131 \uBC30\uACBD\xB7\uC778\uBB3C \uC774\uBBF8\uC9C0 \uB77C\uC774\uC120\uC2A4"), /* @__PURE__ */ React.createElement("pre", null, assetLicenseRaw)), confirmAsk && /* @__PURE__ */ React.createElement("div", { className: "confirm-overlay", role: "dialog", "aria-modal": "true" }, /* @__PURE__ */ React.createElement("div", { className: "confirm-card" }, /* @__PURE__ */ React.createElement("p", null, confirmAsk.msg), /* @__PURE__ */ React.createElement("button", { type: "button", className: "confirm-accept", onClick: onConfirmAccept }, confirmLabel), /* @__PURE__ */ React.createElement("button", { type: "button", className: "confirm-cancel", onClick: () => setConfirmAsk(null) }, "\uCDE8\uC18C"))));
}
