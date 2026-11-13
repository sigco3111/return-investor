// Developer smoke check. Uses a fresh, temporary Chrome profile and local files only.
// Requires Node.js 22+ and Chrome/Chromium. No account or browser extension is used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(check, label, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const result = await check();
    if (result) return result;
    await delay(30);
  }
  throw new Error('Timed out: ' + label);
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.gz': 'application/gzip', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const info = await stat(path);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
let chrome, socket, profile;
const pending = new Map();
let sequence = 0;
async function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error('Browser evaluation failed');
  return result.result?.value;
}
const frame = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
const visible = selector => evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
async function wait(selector) { await until(() => visible(selector), selector); }
async function click(selector) {
  const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Missing or disabled control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await frame();
}
async function key(name, shift = false) {
  const names = { Enter: ['Enter', 13], Space: [' ', 32], Tab: ['Tab', 9], Escape: ['Escape', 27] };
  const [key, code] = names[name];
  const params = { key, code: name === 'Space' ? 'Space' : name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: shift ? 8 : 0 };
  await send('Input.dispatchKeyEvent', { type: ['Tab', 'Escape'].includes(name) ? 'rawKeyDown' : 'keyDown', ...params, ...(['Enter', 'Space'].includes(name) ? { text: name === 'Enter' ? '\r' : ' ', unmodifiedText: name === 'Enter' ? '\r' : ' ' } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
  await frame();
}
const focus = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
async function choice(prefix) {
  const index = await evaluate(`Array.from(document.querySelectorAll('#choices>button')).findIndex(e=>!e.disabled&&e.textContent.startsWith(${JSON.stringify(prefix)}))`);
  assert.ok(index >= 0, 'Expected choice: ' + prefix);
  await click(`#choices>button:nth-of-type(${index + 1})`);
  await until(() => evaluate('!document.querySelector("main").inert'), 'save completed');
  await frame();
}
async function state() {
  await evaluate('window.__returnStorageFlush()');
  return evaluate('localStorage.getItem("regression-invest-school-calendar-save-v1")');
}
const title = () => evaluate('document.querySelector("#turn-card h2")?.textContent');
async function chapter() { if (await visible('#vn-chapter-skip')) await click('#vn-chapter-skip'); }
async function navigate(url) {
  await send('Page.navigate', { url });
  await until(() => evaluate('document.readyState === "complete"'), 'page loaded');
}

try {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Node.js 22+ is required');
  const paths = process.env.CHROME_BIN ? [process.env.CHROME_BIN] : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : process.platform === 'win32'
      ? [join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe')]
      : ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  let executable;
  for (const path of paths) { try { await access(path); executable = path; break; } catch {} }
  assert.ok(executable, 'Chrome/Chromium not found. Set CHROME_BIN to its executable path.');
  profile = await mkdtemp(join(tmpdir(), 'return-smoke-'));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const args = ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-gpu', `--user-data-dir=${profile}`, 'about:blank'];
  if (process.env.CHROME_NO_SANDBOX === '1') args.unshift('--no-sandbox');
  chrome = spawn(executable, args, { stdio: 'ignore' });
  let launchError;
  chrome.on('error', e => { launchError = e; });
  const port = await until(async () => {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw new Error('Chrome exited before it was ready');
    try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; }
  }, 'Chrome startup');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data), request = pending.get(data.id);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(data.id);
    if (data.error) request.reject(new Error(data.error.message)); else request.resolve(data.result);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  const width = Number(process.env.SMOKE_WIDTH || 390);
  assert.ok(Number.isInteger(width) && width >= 320 && width <= 1920, 'SMOKE_WIDTH must be an integer from 320 to 1920');
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate(base); await wait('#by');
  await click('#school-consent'); await click('#cash-main-start');
  await chapter(); await choice('공부 집중'); await chapter(); await choice('공부 집중'); await chapter();
  await choice('유지');
  const before = await state();
  assert.ok(before && JSON.parse(before).month.startsWith('1996-'), 'Normal new-game state');
  assert.equal(await evaluate('Array.from(document.querySelectorAll("#dash-link,#voluntary-end-open,#living-scenario-open")).filter(e=>e.tagName==="BUTTON"&&e.type==="button"&&e.tabIndex===0).length'), 3);
  await focus('#dash-link'); await key('Enter'); assert.equal(await title(), '회귀 대시보드');
  assert.ok(Math.abs(await evaluate('document.querySelector("#turn-card").getBoundingClientRect().top')) < 2);
  await choice('돌아가기'); assert.ok((await state()) === before, 'Read-only action kept exact active save');
  await focus('#dash-link'); await key('Tab'); assert.equal(await evaluate('document.activeElement.id'), 'voluntary-end-open');
  await key('Space'); assert.equal(await title(), '이 회귀를 여기서 마칠까요?');
  await choice('돌아가기'); assert.ok((await state()) === before, 'Read-only action kept exact active save');
  await focus('#living-scenario-open'); await key('Enter'); assert.ok((await title()).includes('시나리오 장부'));
  await choice('돌아가기'); assert.ok((await state()) === before, 'Read-only action kept exact active save');
  await focus('#news-library-open'); await key('Enter'); await wait('#news-library[open]');
  await key('Escape'); await until(async () => !await visible('#news-library'), 'news closed');
  assert.equal(await evaluate('document.activeElement.id'), 'news-library-open'); assert.ok((await state()) === before, 'Read-only action kept exact active save');
  await click('#record-copy>summary'); await click('#record-copy-prepare'); await wait('#record-copy-raw');
  const copy = JSON.parse(await evaluate('document.querySelector("#record-copy-raw").value'));
  assert.equal(copy.scope, 'device-local-confirmed'); assert.ok(copy.activeSaveRaw === before, 'Prepared copy kept exact active save'); assert.ok((await state()) === before, 'Read-only action kept exact active save');
  await navigate(base); await wait('#choices>button'); assert.ok((await state()) === before, 'Read-only action kept exact active save');
  // A normal-play sale provides cash for a real partial-repayment confirmation.
  // Wait for two unpaid tuition bills. With only the first bill outstanding,
  // selling the holding can cover all arrears and is not a partial-repayment case.
  // State is inspected, never injected or rewritten by the check.
  await chapter(); await choice('리밸런싱'); await choice('국내 지수'); await click('#order-execute');
  let reachedArrears = false;
  for (let step = 0; step < 150; step++) {
    await chapter();
    const current = JSON.parse(await state());
    const unpaidBills = current.cashEvents.rows.filter(row => row.living + row.tuition - row.paid > 0);
    if (current.month >= '1999-07' && unpaidBills.length >= 2 && await visible('.arrears-choice-note')) { reachedArrears = true; break; }
    const labels = await evaluate('Array.from(document.querySelectorAll("#choices>button")).filter(e=>!e.disabled).map(e=>({id:e.id,text:e.textContent}))');
    if (labels.some(e=>e.id === 'school-progress')) { await click('#school-progress'); await until(()=>evaluate('!document.querySelector("main").inert'), 'school progress'); await frame(); continue; }
    const next = labels.find(e=>/^(현재 방침 유지|유지|학업 중심|대학 진학|확인|바로 입대|복학)/.test(e.text)) || (labels.length === 1 ? labels[0] : null);
    assert.ok(next, 'Expected a normal school/news choice');
    await choice(next.text);
  }
  assert.ok(reachedArrears, 'Reached normal-play tuition arrears');
  const openingTitle = await title();
  await choice(openingTitle === '이 달에 연결된 뉴스가 없습니다' ? '리밸런싱' : '이 뉴스에 대응');
  await choice('국내 지수'); await choice('일부 매도');
  await focus('#w');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35, nativeVirtualKeyCode: 35 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35, nativeVirtualKeyCode: 35 });
  assert.equal(await evaluate('document.querySelector("#w").value'), '100');
  await click('#order-execute');
  for (let step = 0; step < 12 && JSON.parse(await state()).cash === 0; step++) await choice('유지');
  const repayBefore = await state(), repayState = JSON.parse(repayBefore);
  let repayAmount = 0;
  for (const row of repayState.cashEvents.rows) {
    const due = row.living + row.tuition - row.paid;
    if (due <= 0) continue;
    if (repayAmount + due > repayState.cash) break;
    repayAmount += due;
  }
  const unpaidBefore = repayState.cashEvents.rows.reduce((n,r)=>n+r.living+r.tuition-r.paid,0);
  assert.ok(repayAmount > 0 && repayAmount < unpaidBefore, 'Normal path can repay only part of its arrears');
  await focus('#career-cash-repay'); await key('Enter'); await wait('.confirm-overlay');
  assert.equal(await evaluate('document.activeElement.className'), 'confirm-cancel');
  await key('Tab'); assert.equal(await evaluate('document.activeElement.className'), 'confirm-accept');
  await key('Tab'); assert.equal(await evaluate('document.activeElement.className'), 'confirm-cancel');
  await key('Tab', true); assert.equal(await evaluate('document.activeElement.className'), 'confirm-accept');
  await key('Escape'); await until(async()=>!await visible('.confirm-overlay'), 'confirmation cancelled');
  assert.equal(await evaluate('document.activeElement.id'), 'career-cash-repay'); assert.ok((await state()) === repayBefore, 'Cancelled dialog kept exact active save');
  await key('Enter'); await wait('.confirm-overlay'); await key('Enter');
  await until(async()=>!await visible('.confirm-overlay'), 'default cancel'); assert.ok((await state()) === repayBefore, 'Cancelled dialog kept exact active save');
  await key('Enter'); await wait('.confirm-overlay'); await key('Tab', true); await key('Enter');
  await until(async()=>!await visible('.confirm-overlay'), 'explicit repayment');
  const repaid = JSON.parse(await state());
  assert.equal(repaid.cash, repayState.cash - repayAmount);
  assert.equal(repaid.cashEvents.rows.reduce((n,r)=>n+r.living+r.tuition-r.paid,0), unpaidBefore - repayAmount);
  assert.equal(repaid.month, repayState.month); assert.equal(repaid.turnCount, repayState.turnCount);
  await focus('#voluntary-end-open'); await key('Enter'); await choice('기록을 남기고'); await wait('#by');
  await evaluate('window.__returnStorageFlush()');
  assert.equal(await state(), null);
  const lives = await evaluate('JSON.parse(localStorage.getItem("regression-invest-school-calendar-lives-v1"))');
  assert.equal(lives.length, 1); assert.equal(lives[0].cause, 'voluntary-end');
  await click('#previous-life-review'); assert.equal(await title(), '회귀 대시보드');
  assert.ok(await visible('.dashboard-no-active')); await choice('돌아가기'); await wait('#by');
  assert.equal(await state(), null);
  console.log('PASS: normal start, native keyboard controls, read-only dashboard/news/scenario, exact copy and reload, partial-repayment dialog focus/cancel/confirm, explicit end and archived review.');
  console.log('Scope: fresh local test profile only. No real-user saves, historical validation, full balance, or screen-reader test.');
} finally {
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Browser closed')); }
  pending.clear(); socket?.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill();
    await Promise.race([new Promise(r => chrome.once('exit', r)), delay(2000)]);
    if (chrome.exitCode === null) chrome.kill('SIGKILL');
  }
  await new Promise(r => server.close(r));
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
