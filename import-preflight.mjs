// Unconnected read-only candidate. A pass is NOT permission or full compatibility.
const MAX_BYTES = 2_000_000;
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const month = x => typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
function parse(raw) {
 if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_BYTES) throw Error('copy-size-or-type');
 return JSON.parse(raw, (key, value) => {
  if (['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('copy-unsafe-key');
  if (typeof value === 'number' && !Number.isFinite(value)) throw Error('copy-number');
  return value;
 });
}
export function preflightCopy(text, { pairs, fixedHashes }) {
 const copy = parse(text);
 if (!plain(copy) || copy.format !== 'return-record-copy' || copy.version !== 1) throw Error('copy-format');
 if (!['device-local-confirmed', 'preview-memory-only'].includes(copy.scope)) throw Error('copy-scope');
 if (!(copy.activeSaveRaw === null || typeof copy.activeSaveRaw === 'string') || !(copy.completedLivesRaw === null || typeof copy.completedLivesRaw === 'string')) throw Error('copy-raw-fields');
 const active = copy.activeSaveRaw === null ? null : parse(copy.activeSaveRaw);
 const archive = copy.completedLivesRaw === null ? [] : parse(copy.completedLivesRaw);
 if (!Array.isArray(archive) || archive.some(x => !plain(x))) throw Error('copy-archive-shape');
 if (copy.completedLivesRaw !== null && JSON.stringify(archive) !== copy.completedLivesRaw) throw Error('copy-archive-rewrite-required');
 if (archive.length > 1000) throw Error('copy-archive-limit');
 for (let i=0;i<archive.length;i++) {
  const r=archive[i];
  if (!month(r.ended) || !Number.isFinite(r.totalAssets) || !Number.isFinite(r.chaos) || !Number.isInteger(r.turnCount) || r.turnCount < 0 || !['chaos','demo-end','natural-end','voluntary-end','living-fail'].includes(r.cause)) throw Error('copy-archive-record');
  if (r.assetTrail !== undefined && r.assetTrail !== null && (!Array.isArray(r.assetTrail) || r.assetTrail.some((p,j)=>!plain(p)||!month(p.m)||!Number.isFinite(p.a)||(j&&p.m<=r.assetTrail[j-1].m)))) throw Error('copy-archive-trail');
  if (i<archive.length-1 && Object.hasOwn(r,'assetTrail')) throw Error('copy-archive-would-summarize');
  if (r.assetTrailSummary !== undefined && r.assetTrailSummary !== null && !plain(r.assetTrailSummary)) throw Error('copy-archive-summary');
  if (r.decisionReview !== undefined && (!plain(r.decisionReview)||r.decisionReview.version!==1||!Array.isArray(r.decisionReview.entries)||r.decisionReview.entries.some(e=>!plain(e)||!month(e.month)||typeof e.choice!=='string'))) throw Error('copy-archive-decisions');
 }
 if (active === null && !archive.length) throw Error('copy-empty');
 if (active !== null) {
  if (!plain(active) || !month(active.month) || !Number.isFinite(active.cash) || active.cash < 0 || !plain(active.flags) || !plain(active.holdings) || !Array.isArray(active.history)) throw Error('copy-active-shape');
  const ctx = active.recordContext;
  if (!plain(ctx) || ctx.version !== 1 || !Array.isArray(ctx.contexts) || !ctx.contexts.length || ctx.contexts.length > 16 || typeof ctx.priorUnknown !== 'boolean' || typeof ctx.overflow !== 'boolean') throw Error('copy-context-missing');
  for (const c of ctx.contexts) {
   if (!plain(c) || c.version !== 1 || c.rulesScope !== 'selected-engine-functions-v1' || !hash(c.rulesHash) || c.mode !== 'school-main' || typeof c.ruleset !== 'string' || typeof c.economy !== 'string' || !plain(c.files) || !Object.values(c.files).every(hash)) throw Error('copy-context-shape');
  }
  const last = ctx.contexts.at(-1), f = last.files;
  if (!pairs.some(([e,p]) => f['data/events.json'] === e && f['data/prices.json'] === p)) throw Error('copy-data-pin-unknown');
  if (Object.keys(f).sort().join('|') !== [...Object.keys(fixedHashes),'data/events.json','data/prices.json'].sort().join('|') || Object.entries(fixedHashes).some(([k,h]) => f[k] !== h)) throw Error('copy-fixed-data-mismatch');
 }
 // Ignore supplied display summary. Derive the preview from the original raw texts.
 return Object.freeze({ activeSaveRaw: copy.activeSaveRaw, completedLivesRaw: copy.completedLivesRaw, currentMonth: active?.month ?? null, completedLives: archive.length, sourceScope: copy.scope, engineValidationPending: true, writesPerformed: false });
}
