import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
async function boot() {
  if (!("DecompressionStream" in window)) throw Error("\uC555\uCD95 \uC790\uB8CC\uB97C \uC5EC\uB294 \uAE30\uB2A5\uC774 \uC5C6\uB294 \uBE0C\uB77C\uC6B0\uC800\uC785\uB2C8\uB2E4. \uCD5C\uC2E0 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
  const r = await fetch("game-data.json.gz");
  if (!r.ok) throw Error("\uD544\uC218 \uAC8C\uC784 \uC790\uB8CC\uB97C \uBC1B\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  const raw = await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).text();
  const data = JSON.parse(raw);
  for (const k of ["events", "prices", "turns", "unlocks", "rates", "early-school-news"]) if (typeof data["data/" + k + ".json"] !== "string") throw Error("\uAC8C\uC784 \uC790\uB8CC \uBB36\uC74C\uC758 \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  window.__returnDataPayload = data;
  const { App } = await import("./App");
  createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
}
boot().catch((e) => {
  const el = document.getElementById("root");
  el.textContent = "\uC2E4\uD589 \uC900\uBE44 \uC2E4\uD328: " + String(e.message || e) + " \uAE30\uC874 \uC800\uC7A5\uC740 \uBCC0\uACBD\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";
});
