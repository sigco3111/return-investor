import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
async function boot() {
  if (!("DecompressionStream" in window)) throw Error("\uC555\uCD95 \uC790\uB8CC\uB97C \uC5EC\uB294 \uAE30\uB2A5\uC774 \uC5C6\uB294 \uBE0C\uB77C\uC6B0\uC800\uC785\uB2C8\uB2E4. \uCD5C\uC2E0 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
  const r = await fetch("1-news-data-gen142.json.gz");
  if (!r.ok) throw Error("\uD544\uC218 \uAC8C\uC784 \uC790\uB8CC\uB97C \uBC1B\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  const raw = await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).text();
  const data = JSON.parse(raw);
  data["data/prices.2026-11-14-gen140.json"] = data["data/prices.json"];data["data/prices.2026-11-14-gen141.json"] = data["data/prices.json"];
  for (const k of ["events", "prices", "turns", "unlocks", "rates", "early-school-news"]) if (typeof data["data/" + k + ".json"] !== "string") throw Error("\uAC8C\uC784 \uC790\uB8CC \uBB36\uC74C\uC758 \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  window.__returnDataPayload = data;
  const { App } = await import("./App");
  createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
}
async function beginWithGameLease() {
 // Legacy engine bytes and all data generations stay immutable in ./legacy/.
 // Route before reading a game state into a new source engine. Never add a tag to an old save.
 // Imported slots are validated and read by browser-storage and createSaveStore before decoded routing. No slot pointer is written here.
 if(new URLSearchParams(location.search).has('start')||new URLSearchParams(location.search).has('economy')){location.replace('./legacy.html'+location.search);return;}

  if (!navigator.locks?.request) {
    if (window.localStorage.getItem('return-storage-slot.v1') !== null) throw Error('이 브라우저에서는 가져온 저장 공간을 안전하게 열 수 없습니다. 저장은 바꾸지 않았습니다. 안전 잠금을 지원하는 브라우저에서 열어 주세요.');
    window.__returnGameLeaseActive = true;
    await boot();
    return;
  }
  await navigator.locks.request('return-game-session-v1', {mode:'exclusive',ifAvailable:true}, async lock => {
    if (!lock) throw Error('다른 탭에서 게임이 열려 있어 시작하지 않았습니다. 진행 중인 탭을 닫은 뒤 다시 열어 주세요. 저장을 바꾸지 않았습니다.');
    window.__returnGameLeaseActive = true;
    const closed = new Promise(resolve => addEventListener('pagehide', () => { window.__returnGameLeaseActive = false; resolve(); }, {once:true}));
    addEventListener('pageshow', e => {if(e.persisted) location.reload();});
    await boot();
    await closed;
  });
}
beginWithGameLease().catch((e) => {
  const el = document.getElementById("root");
  el.textContent = "\uC2E4\uD589 \uC900\uBE44 \uC2E4\uD328: " + String(e.message || e) + " \uAE30\uC874 \uC800\uC7A5\uC740 \uBCC0\uACBD\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";
});
