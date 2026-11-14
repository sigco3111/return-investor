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
  if(process.env.NO_LOCKS==='1')await send('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"locks",{value:undefined,configurable:true});'});
  await send('Runtime.enable');
  const width = Number(process.env.SMOKE_WIDTH || 390);
  assert.ok(Number.isInteger(width) && width >= 320 && width <= 1920, 'SMOKE_WIDTH must be an integer from 320 to 1920');
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__testNativeStorage=window.localStorage;'});

  await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__testNativeStorage=window.localStorage;'});
  const fs=await import('node:fs/promises');const gameMode=process.env.GAME_MODE||'casual';const isCasual=gameMode==='casual';const route=gameMode+'.html'+(isCasual?'?edition=legacy':'');
  const errors=[];socket.addEventListener('message',event=>{const e=JSON.parse(event.data);if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails.text);});
  const shot=async name=>{await frame();await frame();await fs.writeFile(evidenceDir+'/'+name+'-'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));};
  await navigate(base);await frame();await shot('mode-choice');
  await evaluate('localStorage.setItem("return-storage-slot.v1","malformed pointer preserved");localStorage.setItem("regression-invest-school-calendar-save-v1","classic sentinel preserved")');
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
  const before=await state();
  await selectOriginal('이 뉴스에 대응해');await wait('#casual-direction');await key('Escape');assert.equal(await state(),before,'Escape direction is read only');assert.equal(await visible('#casual-direction'),false);
  await selectOriginal('이 뉴스에 대응해');await wait('#casual-direction');await click('[data-direction="sell"]');await frame();await frame();assert.ok((await evaluate('document.querySelector("#choices").innerText')).includes('보유 상품이 없습니다'),'empty selling explained');
  await selectOriginal('취소');await frame();
  await click('[data-c-menu="capital"]');assert.equal(await evaluate('document.querySelector("#turn-card").hidden'),true);await shot('capital-home');
  await click('[data-property-region="seoul"]');await wait('#property-contract-confirm');assert.equal(await evaluate('document.querySelector("#property-contract-confirm").disabled'),true,'insufficient cash blocks home contract');await shot('property-review');await selectOriginal('계약하지 않고');
  assert.equal(await state(),before,'home review read only');
  await click('[data-c-menu="records"]');assert.equal(await evaluate('document.querySelector("#turn-card").hidden'),true);await shot('record-menu');await click('#casual-close-menu');
  assert.deepEqual(await nativeSnapshot(),baseline,'malformed classic pointer and original save untouched');
  // Explicit synthetic affordability fixture. Not a naturally earned-life claim.
  const synthetic=JSON.parse(await state());synthetic.cash=500000000;
  await navigate(base);
  await evaluate(`(async()=>{const raw=${JSON.stringify(JSON.stringify(synthetic))};const {encodeSave,chunkString}=await import('./26-save-codec.mjs');const e=await encodeSave(raw),parts=chunkString(e.data,12000),pre='return-casual.v1.';for(const k of Object.keys(localStorage))if(k.startsWith(pre+'return-save.'))localStorage.removeItem(k);parts.forEach((v,i)=>localStorage.setItem(pre+'return-save.v2.a.p'+i,JSON.stringify(v)));localStorage.setItem(pre+'return-save.v2.a.idx',JSON.stringify(JSON.stringify({v:2,parts:parts.length,enc:e.enc,src:raw.length})));localStorage.setItem(pre+'return-save.v2.cur',JSON.stringify('a'));})()`);
  await navigate(base+route);await wait('#choices>button');await frame();assert.equal(JSON.parse(await state()).cash,synthetic.cash,'fixture loaded');
  await click('[data-c-menu="capital"]');await click('[data-property-region="seoul"]');await click('#property-contract-confirm');await frame();await frame();const contracted=JSON.parse(await state());assert.ok(contracted.property.contracts.some(c=>c.status==='pending'),'synthetic fixture contracted');assert.ok(contracted.cash<synthetic.cash);
  await click('[data-c-menu="capital"]');await click('[data-property-cancel]');await selectOriginal('계약 취소 확정');await frame();await frame();assert.equal(JSON.parse(await state()).cash,synthetic.cash,'synthetic fixture exact full refund');
  await evaluate('window.__failTestWrites=true;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.__failTestWrites&&k.startsWith("return-casual.v1."))throw new DOMException("Test quota","QuotaExceededError");return original.call(this,k,v)}');
  const labels=await evaluate('Array.from(document.querySelectorAll("#choices>button")).filter(e=>!e.disabled).map(e=>e.dataset.cOriginal||e.textContent)');await selectOriginal(labels.find(l=>/^유지/.test(l)));await frame();await frame();await until(()=>evaluate('!!window.__returnStorageHalted'),'quota stops writes');await shot('storage-failure');assert.ok(!(await evaluate('document.querySelector("#casual-dashboard").innerText')).includes('500,000,000'),'blocked balances not stale');
  console.log('PASS synthetic-home-contract-cancel/save-failure-stops-and-hides-balance');
  console.log('PASS mode/keyboard/empty-sell/home-review/record/isolation-with-malformed-classic-pointer');

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
