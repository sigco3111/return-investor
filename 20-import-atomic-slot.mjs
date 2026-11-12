// Unconnected candidate. No browser globals. Callers supply an isolated storage object.
// This is the transaction layer only, not record validation or engine compatibility.
export const POINTER_KEY = 'return-storage-slot.v1';
const PREFIX = 'return-storage-slot.v1.';
const idPattern = /^[a-z0-9-]{8,64}$/;
export function readSlot(storage) {
  const raw = storage.getItem(POINTER_KEY);
  if (raw === null) return null;
  const entry = JSON.parse(raw);
  if (!entry || entry.version !== 1 || !idPattern.test(entry.id)) throw Error('slot-pointer-invalid');
  return entry.id;
}
export function slotKey(id, key) {
  if (!idPattern.test(id) || typeof key !== 'string' || !key.startsWith('return-') || key.length > 100) throw Error('slot-key-invalid');
  return PREFIX + id + '.' + key;
}
export function stageSlot(storage, { id, values, expectedPointerRaw }) {
  if (!idPattern.test(id) || !values || typeof values !== 'object' || Array.isArray(values)) throw Error('slot-input-invalid');
  const keys = Object.keys(values);
  if (!keys.length || keys.length > 32 || keys.some(k => typeof values[k] !== 'string')) throw Error('slot-values-invalid');
  const stagedKeys = keys.map(k => slotKey(id, k));
  const manifestKey = PREFIX + id + '.manifest';
  const pointerRaw = JSON.stringify({ version: 1, id });
  const unchanged = () => {
    if (storage.getItem(POINTER_KEY) !== expectedPointerRaw) throw Error('slot-concurrent-change');
  };
  unchanged();
  if (storage.getItem(manifestKey) !== null || stagedKeys.some(k => storage.getItem(k) !== null)) throw Error('slot-id-exists');
  // Never remove staged bytes on a failure. A failed readback may follow a successful
  // activation. Unreferenced candidates can be cleared separately after inspection.
  for (let i = 0; i < keys.length; i++) {
    unchanged();
    storage.setItem(stagedKeys[i], values[keys[i]]);
    if (storage.getItem(stagedKeys[i]) !== values[keys[i]]) throw Error('slot-stage-readback');
  }
  unchanged();
  const manifest = JSON.stringify({ version: 1, keys });
  storage.setItem(manifestKey, manifest);
  if (storage.getItem(manifestKey) !== manifest) throw Error('slot-manifest-readback');
  for (let i = 0; i < keys.length; i++) {
    if (storage.getItem(stagedKeys[i]) !== values[keys[i]]) throw Error('slot-final-readback');
  }
  unchanged();
  // The only shared write, last. All active+archive keys are complete beforehand.
  storage.setItem(POINTER_KEY, pointerRaw);
  if (storage.getItem(POINTER_KEY) !== pointerRaw) throw Error('slot-activation-unconfirmed');
  return { id, keys, pointerRaw };
}

// All future slot selection actions must use this same lock. No unlocked fallback.
export async function stageSlotLocked(storage, input, locks) {
  if (!locks || typeof locks.request !== 'function') throw Error('slot-lock-unavailable');
  return locks.request('return-game-session-v1', {mode:'exclusive', ifAvailable:true}, gameLock => {
    if (!gameLock) throw Error('slot-game-open-in-another-tab');
    return locks.request('return-storage-slot-selection-v1', {mode:'exclusive'}, () => stageSlot(storage, input));
  });
}
export async function returnToOriginal(storage, expectedPointerRaw, locks) {
 if(!locks?.request)throw Error('slot-lock-unavailable');
 return locks.request('return-game-session-v1',{mode:'exclusive',ifAvailable:true}, gameLock=>{
  if(!gameLock)throw Error('slot-game-open-in-another-tab');
  return locks.request('return-storage-slot-selection-v1',{mode:'exclusive'},()=>{
   if(storage.getItem(POINTER_KEY)!==expectedPointerRaw)throw Error('slot-concurrent-change');
   storage.removeItem(POINTER_KEY);
   if(storage.getItem(POINTER_KEY)!==null)throw Error('slot-original-unconfirmed');
  });
 });
}
