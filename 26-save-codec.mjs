const te = new TextEncoder();
const td = new TextDecoder();
export function utf8Bytes(s) {
  return te.encode(s).length;
}
function bytesToB64(u8) {
  let bin = "";
  const STEP = 8192;
  for (let i = 0; i < u8.length; i += STEP) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + STEP));
  }
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
async function deflate(u8) {
  const cs = new CompressionStream("deflate-raw");
  const w = cs.writable.getWriter();
  w.write(u8).catch(() => {
  });
  w.close().catch(() => {
  });
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
async function inflate(u8) {
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(u8).catch(() => {
  });
  w.close().catch(() => {
  });
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
export function compressionAvailable() {
  return typeof CompressionStream === "function" && typeof DecompressionStream === "function";
}
export async function encodeSave(raw) {
  if (compressionAvailable()) {
    try {
      const comp = await deflate(te.encode(raw));
      return { enc: "d", data: bytesToB64(comp) };
    } catch (e) {
    }
  }
  return { enc: "r", data: raw };
}
export async function decodeSave(enc, data) {
  if (enc === "r") return data;
  if (enc === "d") {
    if (!compressionAvailable()) throw new Error("decompress-unavailable");
    const raw = await inflate(b64ToBytes(data));
    return td.decode(raw);
  }
  throw new Error("unknown-enc:" + enc);
}
export function chunkString(s, maxBytes) {
  const parts = [];
  let cur = "", curBytes = 0;
  for (const ch of s) {
    const b = utf8Bytes(ch);
    if (curBytes + b > maxBytes && cur) {
      parts.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  if (cur) parts.push(cur);
  return parts;
}
export function planWrite(encodedData, otherGenChars, livesChars, opts) {
  const CHUNK = opts.chunkSize;
  const MAXPARTS = opts.maxParts;
  const BUDGET = opts.totalBudget;
  const parts = chunkString(encodedData, CHUNK);
  if (parts.length > MAXPARTS) {
    return { ok: false, reason: "\uD65C\uC131 \uC800\uC7A5\uC774 \uBD84\uD560 \uC0C1\uD55C(" + MAXPARTS + "\uC870\uAC01)\uC744 \uB118\uC5C8\uC2B5\uB2C8\uB2E4(\uC555\uCD95 \uD6C4 " + utf8Bytes(encodedData) + "\uBC14\uC774\uD2B8)." };
  }
  const total = utf8Bytes(encodedData) + otherGenChars + livesChars + 1024;
  if (total > BUDGET) {
    return { ok: false, reason: "\uC800\uC7A5 \uCD1D\uB7C9 \uC0C1\uD55C(" + BUDGET + "\uC790) \uCD08\uACFC\uAC00 \uC608\uC0C1\uB418\uC5B4 \uC800\uC7A5\uC744 \uAC70\uC808\uD588\uC2B5\uB2C8\uB2E4(\uC774\uC804 \uC800\uC7A5\uC740 \uBCF4\uC874\uB428)." };
  }
  return { ok: true, parts };
}
