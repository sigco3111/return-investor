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
async function until(check, label, ms = 45000) {
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
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out: ' + method)); }, 45000);
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
  await send('Emulation.setDeviceMetricsOverride', { width, height: Number(process.env.SMOKE_HEIGHT||844), deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__testNativeStorage=window.localStorage;'});
  await navigate(base+'casual.html');await wait('#profile-form');await frame();await frame();
  const fs=await import('node:fs/promises');const evidenceDir=await mkdtemp(join(tmpdir(),'return-allocation-evidence-'));console.log('Evidence:',evidenceDir);
  
  const errors=[];socket.addEventListener('message',event=>{const e=JSON.parse(event.data);if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails.text);});
  const shot=async name=>{await frame();await frame();await fs.writeFile(evidenceDir+'/'+(process.env.OUT_ID||'')+name+'-'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:!name.includes('viewport')})).data,'base64'));};
  const change=async(k,v)=>{await evaluate(`(()=>{const c=document.querySelector('#profile-'+${JSON.stringify(k)});c.value=${JSON.stringify(v)};c.dispatchEvent(new Event('change',{bubbles:true}));})()`);await frame();};
  const data=JSON.parse(process.env.PROFILE_CASE||'{}');
  for(const k of ['birth','education','schoolDelay','service','admission','serviceStart','work','jobStart'])if(k in data)await change(k,data[k]);
  console.log('LAYOUT',await evaluate('({width:innerWidth,doc:document.documentElement.scrollWidth,main:document.querySelector("main").getBoundingClientRect().width,top:getComputedStyle(document.querySelector(".c-topbar")).display,label:getComputedStyle(document.querySelector("#profile-form label")).margin})'));assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);await shot('profile-form');console.log('FORM',await evaluate('document.querySelector("#profile-result").innerText'));
  if(process.env.CONFLICT==='1'){assert.equal(await evaluate('document.querySelector("#profile-review").disabled'),true);console.log('PASS conflict no storage',await evaluate('Object.keys(window.__testNativeStorage)'));}
  else{
   await click('#profile-review');await shot('profile-summary');await click('#profile-consent');await click('#profile-review');await wait('#choices>button');await frame();await frame();
   let view=await evaluate('window.__returnCasualRead?.()');console.log('INITIAL',JSON.stringify(view));assert.equal(view.cash,1000000);assert.equal(view.unpaid,0);assert.ok(view.month>='1996-03');assert.ok(await evaluate('!document.querySelector("#vn-stage").hidden'));
   assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
   await evaluate('document.querySelector("#vn-stage").scrollIntoView({block:"start"})');await shot('profile-play-viewport');
   for(let i=0;i<25;i++){
    const v=await evaluate('window.__returnCasualRead()');if(v.unpaid>0)break;
    const ls=await evaluate('Array.from(document.querySelectorAll("#choices>button")).filter(e=>!e.disabled).map(e=>e.dataset.cOriginal||e.textContent)');console.log('OPTIONS',ls);const ch=ls.find(t=>/^(유지|다음 달로|계속 둘러보기)/.test(t))||ls.find(t=>/^분기 정산을 마치고/.test(t));assert.ok(ch,ls.join('|'));await evaluate(`(()=>{const b=[...document.querySelectorAll('#choices>button')].find(e=>(e.dataset.cOriginal||e.textContent)===${JSON.stringify(ch)});b.click();})()`);await until(()=>evaluate('!document.querySelector("main").inert'),'save done');await frame();await chapter();
   }
   const unpaidState=JSON.parse(await state());unpaidState.cash=Number(process.env.CASE_CASH||1000000);if(process.env.CASE_SALE==='1')unpaidState.holdings.deposit={qty:1000000,avgPrice:1,invested:1000000,entryMonth:unpaidState.month};
   await navigate(base);await evaluate(`(async()=>{const raw=${JSON.stringify(JSON.stringify(unpaidState))};const {encodeSave,chunkString}=await import('./26-save-codec.mjs');const e=await encodeSave(raw),parts=chunkString(e.data,12000),pre='return-casual.v3.';for(const k of Object.keys(localStorage))if(k.startsWith(pre+'return-save.'))localStorage.removeItem(k);parts.forEach((v,i)=>localStorage.setItem(pre+'return-save.v2.a.p'+i,JSON.stringify(v)));localStorage.setItem(pre+'return-save.v2.a.idx',JSON.stringify(JSON.stringify({v:2,parts:parts.length,enc:e.enc,src:raw.length})));localStorage.setItem(pre+'return-save.v2.cur',JSON.stringify('a'));})()`);await navigate(base+'casual.html');await wait('#choices>button');
   console.log('UNPAID',JSON.stringify(await evaluate('window.__returnCasualRead()')));
   const pre=await evaluate('window.__returnCasualRead()');await evaluate('[...document.querySelectorAll("#choices>button")].find(e=>(e.dataset.cOriginal||e.textContent).match(/^(리밸런싱|이 뉴스에 대응해)/)).click()');await wait('#allocation-panel');await shot('automatic-clearing-editor');if(process.env.CASE_SALE==='1'){await evaluate('(()=>{const e=document.querySelector("#allocation-deposit");e.value=0;e.dispatchEvent(new Event("input",{bubbles:true}));const b=document.querySelector("#allocation-bond");b.value=25;b.dispatchEvent(new Event("input",{bubbles:true}));})()');}await click('#allocation-review');await wait('#allocation-consent');await shot('automatic-clearing-review');await click('#allocation-consent');const preCommitRaw=await state();if(process.env.CASE_QUOTA==='1')await evaluate('window.__nativeSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.includes("return-save.v2."))throw new DOMException("Quota exceeded","QuotaExceededError");return window.__nativeSet.call(this,k,v)}');await click('#allocation-confirm');await until(()=>evaluate('!document.querySelector("#allocation-panel")'),'clearing done');if(process.env.CASE_QUOTA==='1'){await until(()=>evaluate('!!window.__returnStorageHalted'),'storage halt');assert.equal(await visible('#casual-receipt'),false);await evaluate('Storage.prototype.setItem=window.__nativeSet');await navigate(base+'casual.html');await wait('#choices>button');assert.equal(await state(),preCommitRaw);assert.equal((await evaluate('window.__returnCasualRead()')).unpaid,pre.unpaid);assert.equal((await evaluate('window.__returnCasualRead()')).cash,pre.cash);console.log('PASS quota refusal restores prior complete state after reload');}else{const receipt=await evaluate('window.__returnAllocationReceipt()');assert.equal(receipt.repay,Math.min(pre.unpaid,pre.cash+receipt.lines.filter(l=>l.kind==='sell').reduce((a,l)=>a+l.amount,0)));assert.equal(receipt.unpaidAfter,pre.unpaid-receipt.repay);assert.equal(receipt.cashAfter,pre.cash-receipt.repay+receipt.lines.reduce((a,l)=>a+(l.kind==='sell'?l.amount:-l.amount),0));if(receipt.unpaidAfter)assert.equal(receipt.lines.some(l=>l.kind==='buy'),false);console.log('PASS automatic clearing',receipt);await shot('automatic-clearing-success');}
   const before=await state(),beforeView=await evaluate('JSON.stringify(window.__returnCasualRead?.())');
   await navigate(base+'casual.html');await wait('#choices>button');await frame();await frame();assert.equal(await state(),before);assert.equal(await evaluate('JSON.stringify(window.__returnCasualRead?.())'),beforeView);
   console.log('RELOADED',await title());
   if(process.env.ADVANCE==='1'){
    for(let i=0;i<3;i++){const labels=await evaluate('Array.from(document.querySelectorAll("#choices>button")).filter(e=>!e.disabled).map(e=>e.textContent)');const ch=labels.find(t=>t.startsWith('다음 달로'))||labels.find(t=>t.startsWith('유지'))||labels.find(t=>t.startsWith('학업 중심'))||labels.find(t=>t.startsWith('현재 방침'))||labels.find(t=>t.startsWith('다음 판단'))||labels.find(t=>t.startsWith('재학'))||(labels.length===1?labels[0]:null);if(!ch){console.log('STOP choices',labels);break;}await evaluate(`(()=>{const b=[...document.querySelectorAll('#choices>button')].find(e=>(e.dataset.cOriginal||e.textContent)===${JSON.stringify(ch)});b.click();})()`);await until(()=>evaluate('!document.querySelector("main").inert'),'save done');await frame();await chapter();}
    console.log('AFTER',JSON.stringify(await evaluate('window.__returnCasualRead()')));
   }
   assert.deepEqual(errors,[]);console.log('PASS profile start, illustrations, exact reload',errors);
  }
 } catch(error) {
  try { const out=await import('node:fs/promises');const dump={error:String(error),body:await evaluate('document.body.innerText'),raw:await state()};await out.writeFile('/downloads/return-casual-verification/failure.json',JSON.stringify(dump,null,2));console.log('FAIL',String(error),dump.body.slice(-1800)); }catch(e){console.log('debug failed',String(e));}throw error;
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
