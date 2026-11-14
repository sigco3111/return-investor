// No persistent storage access. The opaque frame can only read its own supplied map.
export async function validateEngineInIsolation({activeSaveRaw,completedLivesRaw,payloadGzip,engineCode,timeoutMs=12000}) {
 if (typeof activeSaveRaw !== 'string') throw Error('active-required-for-first-import');
 const frame=document.createElement('iframe');frame.style.cssText="position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0";frame.setAttribute("aria-hidden","true");frame.setAttribute('sandbox','allow-scripts');
 const nonce=crypto.randomUUID();
 const bootstrap=String.raw`
 const seedNonce = NONCE;
 const tell = result => parent.postMessage({kind:'return-validator-result',nonce:seedNonce,result},'*');
 addEventListener('error',e=>tell({ok:false,scope:'engine-error',reason:String(e.message)}));
 addEventListener('unhandledrejection',e=>tell({ok:false,scope:'engine-rejection',reason:String(e.reason?.message||e.reason)}));
 const receive = async e=>{
 if(e.source!==parent||e.data?.kind!=='return-validator-input'||e.data.nonce!==seedNonce)return;
 removeEventListener('message',receive);const input=e.data;input.payload=JSON.parse(await new Response(new Blob([input.payloadGzip]).stream().pipeThrough(new DecompressionStream('gzip'))).text());input.payload["data/prices.2026-11-14-gen140.json"]=input.payload["data/prices.json"];const map=new Map();
 map.set('regression-invest-school-calendar-save-v1',input.activeSaveRaw);
 if(input.completedLivesRaw!==null)map.set('regression-invest-school-calendar-lives-v1',input.completedLivesRaw);
 let writes=0;
 Object.defineProperty(window,'localStorage',{value:{getItem:k=>map.get(k)??null,setItem(){writes++;throw Error('validation-read-only')},removeItem(){writes++;throw Error('validation-read-only')},clear(){writes++;throw Error('validation-read-only')}}});
 window.fetch=async path=>{
 if(typeof path!=='string'||typeof input.payload[path]!=='string')throw Error('validation-network-denied');
 return new Response(input.payload[path],{status:200});
 };
 window.__validationDone=result=>tell({...result,writesAttempted:writes,activeExact:map.get('regression-invest-school-calendar-save-v1')===input.activeSaveRaw,archiveExact:(map.get('regression-invest-school-calendar-lives-v1')??null)===input.completedLivesRaw});
 const s=document.createElement('script');s.nonce=seedNonce;s.textContent=input.engineCode;document.body.append(s);
 };addEventListener('message',receive);
 parent.postMessage({kind:'return-validator-ready',nonce:seedNonce},'*');
 `.replace('NONCE',JSON.stringify(nonce));
 frame.srcdoc='<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'nonce-'+nonce+'\'"><header><p></p></header><section id="unlock-area"></section><section id="turn-card"></section><section id="choices"></section><section id="portfolio"></section><p id="footnote"></p><script nonce="'+nonce+'">'+bootstrap+'</script>';
 return new Promise(resolve=>{
 let timer;const finish=result=>{clearTimeout(timer);removeEventListener('message',listener);frame.remove();resolve(result)};
 const listener=e=>{ 
 if(e.source!==frame.contentWindow||e.data?.nonce!==nonce)return;
 if(e.data.kind==='return-validator-ready')frame.contentWindow.postMessage({kind:'return-validator-input',nonce,activeSaveRaw,completedLivesRaw,payloadGzip,engineCode},'*',[payloadGzip]);
 if(e.data.kind==='return-validator-result')finish(e.data.result);
 };
 addEventListener('message',listener);timer=setTimeout(()=>finish({ok:false,scope:'timeout',reason:'validation-timeout'}),timeoutMs);document.body.append(frame);
 });
}
