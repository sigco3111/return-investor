// Developer smoke check. Uses a fresh, temporary Chrome profile and local files only.
// Requires Node.js 22+ and Chrome/Chromium. No account or browser extension is used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.env.GAME_ROOT || dirname(fileURLToPath(import.meta.url)));
const evidenceDir=await mkdtemp(join(tmpdir(),'return-casual-evidence-'));
console.log('Evidence:',evidenceDir);
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
  const base = process.env.SMOKE_URL || `http://127.0.0.1:${server.address().port}/`;
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
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__testNativeStorage=window.localStorage;'});

  await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__testNativeStorage=window.localStorage;'});
  const fs=await import('node:fs/promises');const gameMode=process.env.GAME_MODE||'casual';const isCasual=gameMode==='casual';const route=gameMode+'.html';
  const errors=[];socket.addEventListener('message',event=>{const e=JSON.parse(event.data);if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails.text);});
  await navigate(base+route);await wait('#by');await frame();await frame();
  const nativeSnapshot=()=>evaluate('Object.fromEntries(Object.keys(window.__testNativeStorage).filter(k=>!k.startsWith("return-casual.v1.")).sort().map(k=>[k,window.__testNativeStorage.getItem(k)]))');
  const baseline=await nativeSnapshot();
  async function selectOriginal(prefix){
    for(let attempt=0;attempt<10;attempt++){
      const found=await evaluate(`(()=>{const bs=[...document.querySelectorAll('#choices>button')];const i=bs.findIndex(b=>!b.disabled&&(b.dataset.cOriginal||b.textContent).startsWith(${JSON.stringify(prefix)}));if(i<0)return null;const b=bs[i];return {i,visible:!b.hidden&&b.getClientRects().length>0}})()`);
      assert.ok(found,'missing choice '+prefix+' '+await title());
      if(found.visible){await click('#choices>button:nth-of-type('+(found.i+1)+')');return;}
      if(attempt===0&&await visible('#casual-choice-categories button[aria-pressed="false"]')){await click('#casual-choice-categories button[aria-pressed="false"]');continue;}
      const next=await evaluate(`[...document.querySelectorAll('#casual-choice-categories button')].findIndex(b=>b.textContent==='다음 선택'&&!b.disabled)`);
      if(next>=0){await click('#casual-choice-categories button:nth-of-type('+(next+1)+')');continue;}
      throw Error('could not reveal '+prefix);
    }
  }
  await click('#school-consent');await click('#cash-main-start');await wait('#choices>button');await frame();await frame();
  const result={mode:gameMode,width,scope:'Isolated fresh-profile normal-UI automated life, not human duration/fun validation',screens:[],checkpoints:[],errors};

  await selectOriginal('알바 병행');await chapter();
  for(let i=0;i<160;i++){
   const st=JSON.parse(await state());if(st.month>='1999-03')break;
   const labels=await evaluate('Array.from(document.querySelectorAll("#choices>button")).filter(e=>!e.disabled).map(e=>({id:e.id,text:e.dataset.cOriginal||e.textContent}))');
   const pick=labels.find(l=>l.id==='school-progress')||labels.find(l=>/^유지/.test(l.text))||(labels.length===1?labels[0]:null);assert.ok(pick,JSON.stringify(labels));await selectOriginal(pick.text);await chapter();
  }
  console.log('EDGE-START',JSON.stringify(await evaluate('window.__returnCasualRead()')));
  async function openBuy(split=2){
   const labels=await evaluate('Array.from(document.querySelectorAll("#choices>button")).filter(e=>!e.disabled).map(e=>({text:e.dataset.cOriginal||e.textContent}))');
   const enter=labels.find(l=>/이 뉴스에 대응해|리밸런싱/.test(l.text));assert.ok(enter,JSON.stringify(labels));await selectOriginal(enter.text);await wait('#casual-direction');await click('[data-direction="buy"]');await frame();await frame();
   await selectOriginal('국내 지수');await wait('#w');await frame();await frame();
   await click('#cond-on');await evaluate('document.querySelector("#cond-val").value="1";document.querySelector("#cond-val").dispatchEvent(new Event("input",{bubbles:true}));');
   await evaluate('document.querySelector("#split-n").value="'+split+'";document.querySelector("#split-n").dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("#order-expiry").value="3";document.querySelector("#order-expiry").dispatchEvent(new Event("change",{bubbles:true}));');await frame();
   const raw=await state();await click('#order-execute');await wait('#casual-order-review');assert.equal(await state(),raw,'review read-only');assert.ok((await evaluate('document.querySelector("#casual-order-review").textContent')).includes('조건 1'));
   await click('#casual-order-confirm');await frame();await frame();
  }
  await openBuy(2);let st=JSON.parse(await state());assert.equal(st.pendingOrders.length,1);assert.ok(!st.holdings.kospi,'conditional order not filled');assert.equal(st.pendingOrders[0].split.n,2);
  const pendingRaw=await state();await navigate(base+route);await wait('#choices>button');await frame();await frame();assert.equal(await state(),pendingRaw,'pending exact reload');
  await click('[data-c-menu="capital"]');await click('[data-group="orders"]');await frame();
  await fs.writeFile(evidenceDir+'/pending-orders-'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await click('.single-order-cancel-open');await frame();await frame();let before=JSON.parse(await state());const locked=before.pendingOrders[0].amount;
  await click('#single-order-cancel-confirm');await frame();await frame();st=JSON.parse(await state());assert.equal(st.pendingOrders.length,0);assert.equal(st.cash,before.cash+locked);assert.equal(st.month,before.month);assert.equal(st.turnCount,before.turnCount);
  await openBuy(1);st=JSON.parse(await state());assert.equal(st.pendingOrders.length,1);
  await click('[data-c-menu="capital"]');await click('[data-group="orders"]');await click('.order-reduce-open');await frame();await frame();
  await selectOriginal('50% 풀기');await wait('#order-reduce-confirm');before=JSON.parse(await state());await click('#order-reduce-confirm');await frame();await frame();st=JSON.parse(await state());assert.ok(st.cash>before.cash);assert.equal(st.month,before.month);assert.equal(st.pendingOrders[0].amount,Math.ceil(before.pendingOrders[0].amount/2));
  await click('[data-c-menu="records"]');await click('#record-copy>summary');await click('#record-copy-prepare');await wait('#record-copy-raw');const copy=JSON.parse(await evaluate('document.querySelector("#record-copy-raw").value'));assert.equal(copy.activeSaveRaw,await state(),'export is exact casual save');await fs.writeFile(evidenceDir+'/casual-edge-copy.json',JSON.stringify(copy));
  await click('#casual-close-menu');
  const expires=st.pendingOrders[0].expiresAt;for(let i=0;i<25;i++){st=JSON.parse(await state());if(!st.pendingOrders.length)break;const labels=await evaluate('Array.from(document.querySelectorAll("#choices>button")).filter(e=>!e.disabled).map(e=>e.dataset.cOriginal||e.textContent)');const hold=labels.find(t=>/^유지/.test(t))||labels.find(t=>/^확인/.test(t));assert.ok(hold,JSON.stringify(labels));await selectOriginal(hold);await chapter();}
  st=JSON.parse(await state());assert.equal(st.pendingOrders.length,0,'expiry returned remainder');assert.ok(st.history.some(h=>h.choice?.startsWith('order-expired:')));assert.ok(!st.holdings.kospi,'condition1 no fill in tested interval');
  assert.deepEqual(await nativeSnapshot(),baseline,'no classic writes in edge case');assert.deepEqual(errors,[]);
  await fs.writeFile(evidenceDir+'/edge-'+width+'.json',JSON.stringify({pass:true,reviewReadOnly:true,conditionalSplitQueued:true,pendingExactReload:true,cancelExactRefund:true,reductionConservesMoney:true,exportExact:true,expiryReturned:true,classicUnchanged:true,final:st},null,2));console.log('PASS edge conditional/split/pending/cancel/reduce/export/expiry');

 } catch(error) {
  try { const out=await import('node:fs/promises');const dump={error:String(error),body:await evaluate('document.body.innerText'),raw:await state()};await out.writeFile(evidenceDir+'/life-failure-'+(process.env.GAME_MODE||'casual')+'.json',JSON.stringify(dump,null,2));console.log('FAIL',String(error),dump.body.slice(-1800)); }catch(e){console.log('debug failed',String(e));}throw error;
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
