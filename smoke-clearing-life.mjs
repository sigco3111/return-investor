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
  profile = process.env.PERSIST_PROFILE || await mkdtemp(join(tmpdir(), 'return-smoke-'));
  await new Promise(r => server.listen(Number(process.env.PORT||0), '127.0.0.1', r));
  const base = process.env.SMOKE_URL || `http://127.0.0.1:${server.address().port}/`;
  const args = ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-gpu', `--user-data-dir=${profile}`, 'about:blank'];
  if (process.env.CHROME_NO_SANDBOX === '1') args.unshift('--no-sandbox');
  if(process.env.PERSIST_PROFILE)await rm(join(profile,'DevToolsActivePort'),{force:true});
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
  const fs=await import('node:fs/promises');const gameMode=process.env.GAME_MODE||'casual';const isCasual=gameMode==='casual';const route=gameMode+'.html'+(isCasual?'?edition=allocation':'');
  const errors=[];socket.addEventListener('message',event=>{const e=JSON.parse(event.data);if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails.text);});
  await navigate(base+route);await until(()=>evaluate('!!document.querySelector("#profile-form,#choices>button")'),'profile form or saved play',45000);await frame();await frame();
  const nativeSnapshot=()=>evaluate('Object.fromEntries(Object.keys(window.__testNativeStorage).filter(k=>!k.startsWith("return-casual.v3.")).sort().map(k=>[k,window.__testNativeStorage.getItem(k)]))');
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
  if(await visible('#profile-form')){await click('#profile-review');await click('#profile-consent');await click('#profile-review');}await wait('#choices>button');await frame();await frame();
  const result={mode:gameMode,width,scope:'Isolated fresh-profile normal-UI automated life, not human duration/fun validation',screens:[],checkpoints:[],errors};
  let ended=false;
  for(let i=0;i<Number(process.env.MAX_TURNS||1000);i++){
    await chapter();await frame();
    const raw=await state();const st=JSON.parse(raw);const heading=await title();
    const labels=await evaluate('Array.from(document.querySelectorAll("#choices>button")).filter(e=>!e.disabled).map(e=>({id:e.id,text:e.dataset.cOriginal||e.textContent,visible:!e.hidden}))');
    const visibleCount=labels.filter(l=>l.visible).length;if(isCasual)assert.ok(visibleCount<=3,'at most3 visible actions '+visibleCount);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'true'==='true','no horizontal overflow');
    result.screens.push({i,month:st.month,title:heading,labels:labels.map(l=>l.text),visibleCount});
    if(i<3||['life-grad','life-enlist','life-admit-result'].some(k=>st.history.at(-1)?.choice?.includes(k))||heading.includes('결산')||heading.includes('미납'))result.checkpoints.push({i,raw:st});
    if((st.month>'2026-10'||st.flags.gameOver)&&labels.some(l=>l.text.startsWith('기록을 남기고 새 회귀 시작'))){
      if(!st.flags.gameOver)assert.equal(st.cashEvents.rows.at(-1).month,'2026-10','last economic month unchanged');assert.ok(!st.history.some(h=>(h.decisionMonth||h.month)>'2026-10'),'no November play');assert.ok(!st.interestLedger?.some(h=>h.month>'2026-10'),'no November interest');result.finalBytes=raw.length;result.storage=await evaluate('Object.fromEntries(Object.keys(window.__testNativeStorage).filter(k=>k.startsWith("return-casual.v3.")).map(k=>[k,window.__testNativeStorage.getItem(k)]))');result.final=st;result.finalTitle=heading;ended=true;
      await evaluate('window.scrollTo(0,0)');await fs.writeFile(evidenceDir+'/'+gameMode+'-ending-'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
      break;
    }
    result.peakRaw=Math.max(result.peakRaw||0,new TextEncoder().encode(raw).length);if(i%40===0)console.log('PROGRESS',gameMode,i,st.month,heading);
    const investment=labels.find(l=>/^(리밸런싱|이 뉴스에 대응해)/.test(l.text));
    if(investment&&!st.flags.gameOver&&st.month<='2026-10'){
     await selectOriginal(investment.text);await wait('#allocation-panel');
     const target=Object.fromEntries(await evaluate('[...document.querySelectorAll("#allocation-panel input[type=range]")].filter(e=>!e.disabled).map(e=>[e.id.slice(11),7])'));
     await evaluate(`(()=>{for(const[id,v]of Object.entries(${JSON.stringify(target)})){const e=document.querySelector('#allocation-'+id);if(e&&!e.disabled){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}}})()`);
     const reviewOk=await evaluate('!document.querySelector("#allocation-review").disabled');
     if(reviewOk){await click('#allocation-review');await wait('#allocation-consent');await click('#allocation-consent');await click('#allocation-confirm');await until(()=>evaluate('!document.querySelector("#allocation-panel")'),'batch finish');continue;}
     await click('#allocation-cancel');
    }
    let pick;
    if(labels.some(l=>l.id==='school-progress'))pick=labels.find(l=>l.id==='school-progress');
    else pick=labels.find(l=>/^(공부 집중|학업 중심|현재 방침 유지|대학 진학|바로 입대|복학|기존 방침|취업 —|확인|유지)/.test(l.text));
    if(!pick&&labels.length===1)pick=labels[0];
    assert.ok(pick,'unhandled '+heading+' '+JSON.stringify(labels));
    await selectOriginal(pick.text);
    await until(()=>evaluate('!document.querySelector("main").inert'),'save unlocked',20000);
  }
  console.log('CHECKPOINT', (JSON.parse(await state())).month,'steps',result.screens.length,'ended',ended);
  await fs.writeFile(profile+'/expected-view.json',JSON.stringify(await evaluate('window.__returnCasualRead()')));
  if(ended){
  const before=await state();await navigate(base+route);await wait('#choices>button');await frame();await frame();assert.equal(await state(),before,'ending reopen exact');result.reloadExact=true;
  if(isCasual)assert.deepEqual(await nativeSnapshot(),baseline,'casual has no classic writes');result.classicKeysUnchanged=isCasual;
  assert.deepEqual(errors,[],'no browser exceptions');
  await fs.writeFile(evidenceDir+'/life-'+gameMode+'-'+width+'.json',JSON.stringify(result,null,2));console.log('PASS',gameMode,result.screens.length,result.final.month,result.final.cash);await selectOriginal('기록을 남기고 새 회귀 시작');await wait('#profile-form');await frame();assert.ok((await evaluate('document.body.innerText')).includes('어떤 인물로'));console.log('PASS archive/reset to profile form');
  }

 } catch(error) {
  try { const out=await import('node:fs/promises');const dump={error:String(error),body:await evaluate('document.body.innerText'),url:await evaluate('location.href')};console.log('DEBUG',dump);await out.writeFile(evidenceDir+'/failure.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64')); await out.writeFile(evidenceDir+'/life-failure-'+(process.env.GAME_MODE||'casual')+'.json',JSON.stringify(dump,null,2));console.log('FAIL',String(error),dump.body.slice(-1800)); }catch(e){console.log('debug failed',String(e));}throw error;
} finally {
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Browser closed')); }
  pending.clear();if(process.env.PERSIST_PROFILE&&socket?.readyState===1){socket.send(JSON.stringify({id:++sequence,method:'Browser.close'}));await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(4000)]);}socket?.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill();
    await Promise.race([new Promise(r => chrome.once('exit', r)), delay(2000)]);
    if (chrome.exitCode === null) chrome.kill('SIGKILL');
  }
  await new Promise(r => server.close(r));
  if (profile && !process.env.PERSIST_PROFILE) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
