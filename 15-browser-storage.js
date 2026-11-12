import { useState, useCallback } from "react";
let nativeStorage;
try {
  nativeStorage = window.localStorage;
} catch {
}
export const browserPersistence = {
  async request(method, params) {
    if (method === "local.read") return { status: "saved", value: nativeStorage.getItem(params.key) };
    if (method === "local.write") {
      if (params.value === null) nativeStorage.removeItem(params.key);
      else nativeStorage.setItem(params.key, String(params.value));
      const check = nativeStorage.getItem(params.key);
      if (check !== params.value) throw Error("browser-readback-mismatch");
      return { status: "saved" };
    }
    throw Error("unsupported-storage-operation");
  }
};
export function useLocalState(key, fallback) {
  const [loaded] = useState(() => {
    try {
      const raw = nativeStorage.getItem(key);
      return { value: raw === null ? fallback : JSON.parse(raw), status: "saved" };
    } catch {
      return { value: fallback, status: "unknown" };
    }
  });
  const [value, setValue] = useState(loaded.value);
  const setter = useCallback((v) => {
    nativeStorage.setItem(key, JSON.stringify(v));
    setValue(v);
  }, [key]);
  return [value, setter, { ready: true, status: loaded.status }];
}
