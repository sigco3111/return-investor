import { useState, useCallback } from "react";
let nativeStorage;
let originalSpace = false;
try {
  const real = window.localStorage;
  const pointer = real.getItem('return-storage-slot.v1');
  originalSpace = pointer === null;
  let prefix = '';
  if (pointer !== null) {
    const p = JSON.parse(pointer);
    if (!p || p.version !== 1 || !/^[a-z0-9-]{8,64}$/.test(p.id)) throw Error('slot-pointer-invalid');
    prefix = 'return-storage-slot.v1.' + p.id + '.';
    const manifest = JSON.parse(real.getItem(prefix + 'manifest'));
    if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.keys)) throw Error('slot-manifest-invalid');
  }
  const guard = () => { if (!window.__returnGameLeaseActive) throw Error('game-session-lock-lost'); if (real.getItem('return-storage-slot.v1') !== pointer) throw Error('slot-changed-reload-required'); };
  nativeStorage = {
    getItem(k) { guard(); return real.getItem(prefix + k); },
    setItem(k,v) { guard(); real.setItem(prefix + k,v); },
    removeItem(k) { guard(); real.removeItem(prefix + k); }
  };
} catch {
}
export const browserPersistence = {
  async request(method, params) {
    const operation = () => {
    if (method === "local.read") return { status: "saved", value: nativeStorage.getItem(params.key) };
    if (method === "local.write") {
      if (params.value === null) nativeStorage.removeItem(params.key);
      else nativeStorage.setItem(params.key, String(params.value));
      const check = nativeStorage.getItem(params.key);
      if (check !== params.value) throw Error("browser-readback-mismatch");
      return { status: "saved" };
    }
    throw Error("unsupported-storage-operation");
    };
    if (!navigator.locks?.request) {
      if (!originalSpace) throw Error("slot-lock-unavailable");
      return operation();
    }
    return navigator.locks.request("return-storage-slot-selection-v1", {mode:"exclusive"}, operation);
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
