import * as esbuild from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const allocationBuild=process.env.RETURN_ALLOCATION_BUILD==='1';
const profileBuild=process.env.RETURN_PROFILE_BUILD==='1'||allocationBuild;
const allocationPlan=await readFile('allocation-plan.mjs','utf8');
const allocationHook=await readFile('allocation-engine-hook.js','utf8');
const allocationId=createHash('sha256').update(allocationPlan+'\n'+allocationHook.split('// Presentation-only code below.')[0]).digest('hex');
const profilePlan=await readFile('profile-plan.mjs','utf8');
const profileHook=await readFile('profile-engine-hook.js','utf8');
const profileId=createHash('sha256').update(profilePlan+'\n'+profileHook.split('const profileBaseBirth=')[0]).digest('hex');
// Build a second presentation from the exact classic sources. The classic entry,
// bundle, styles, engine functions and data files are never overwritten.
const oldBuild=await readFile('45-build-pages.mjs','utf8');
const files=JSON.parse(oldBuild.match(/const files=(\{[^;]+\});/)[1]);
const assets=Object.fromEntries(Object.entries(files).filter(([k])=>k.endsWith('.png')));
const hook=await readFile('casual-view-hook.js','utf8');
await esbuild.build({entryPoints:['casual-engine-entry.jsx'],bundle:true,outfile:allocationBuild?'4-casual.js':profileBuild?'3-casual.js':'2-casual.js',format:'iife',target:['es2022'],minify:true,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'casual-from-classic',setup(build){
 build.onResolve({filter:/.*/},args=>{if(!args.path.startsWith('.')&&!files[args.path]&&args.kind!=='entry-point')return;let raw=args.path.endsWith('?raw'),k=path.basename(args.path.replace(/\?raw$/,''));if(!files[k])for(const ext of ['.jsx','.js','.mjs'])if(files[k+ext]){k+=ext;break;}if(files[k])return {path:path.resolve(files[k]),namespace:raw?'raw-text':'file'};});
 build.onLoad({filter:/.*/,namespace:'raw-text'},async args=>({contents:'export default '+JSON.stringify(await readFile(args.path,'utf8')),loader:'js'}));
 build.onLoad({filter:/\.(jsx?|mjs)$/},async args=>{if(args.path.includes('node_modules'))return;let text=await readFile(args.path,'utf8');for(const[k,v]of Object.entries(assets))text=text.split(k).join(v);
 text=text.replace('fetch("game-data.json.gz")','fetch("'+files['game-data.json.gz']+'")');
 if(args.path.endsWith('22-main.jsx')){
   text='window.__returnAssetPaths='+JSON.stringify(assets)+';\n'+text;
   text=text.replaceAll("'return-game-session-v1'",allocationBuild?"'return-game-session-casual-v3'":profileBuild?"'return-game-session-casual-v2'":"'return-game-session-casual-v1'");
   // Casual never opens the classic import-slot pointer, even without Locks API.
   text=text.replace("window.localStorage.getItem('return-storage-slot.v1')",'null');
 }
 if(args.path.endsWith('15-browser-storage.js')){
   text=text.replace("const pointer = real.getItem('return-storage-slot.v1');",'const pointer = null;');
   text=text.replace("let prefix = '';",allocationBuild?"let prefix = 'return-casual.v3.';":profileBuild?"let prefix = 'return-casual.v2.';":"let prefix = 'return-casual.v1.';");
   text=text.replace("real.getItem('return-storage-slot.v1') !== pointer",'false');
   text=text.replaceAll('return-storage-slot-selection-v1',allocationBuild?'return-storage-casual-v3':profileBuild?'return-storage-casual-v2':'return-storage-casual-v1');
 }
 text=text.replace('charImg.src = "" + visualCommonFile','charImg.src = window.__returnAssetPaths[visualCommonFile]');
 text=text.replace('visualCommonPropEl.src = "prop-" + visualCommonProp + "-common.png"','visualCommonPropEl.src = window.__returnAssetPaths["prop-" + visualCommonProp + "-common.png"]');
 if(args.path.endsWith('20-game-bundle.js')){
  const tail='    boot();\n  })();\n})();';
  if(!text.endsWith(tail+'\n')&&!text.endsWith(tail))throw Error('engine hook boundary changed');
  if(profileBuild){
   if(allocationBuild)text='import * as Allocation from \"./allocation-plan.mjs\";\n'+text;
   text='import * as Profile from \"./profile-plan.mjs\";\n'+text;
   text=text.replaceAll('birthYear < 1975','birthYear < 1900');
   text=text.replace('...SCHOOL_MODE ? { schoolStart: { ...state.schoolStart }, birth: { ...state.flags.birth } } : {},','...SCHOOL_MODE ? { schoolStart: { ...state.schoolStart }, birth: { ...state.flags.birth }, startProfile: structuredClone(state.startProfile) } : {},');
   text=text.replaceAll('const p = ReturnSchoolCalendar.startPlan(y, m);','const p = profileDraft || ReturnSchoolCalendar.startPlan(y, m);');
  }
  if(allocationBuild)text=text.replace('startProfile: structuredClone(state.startProfile) }','startProfile: structuredClone(state.startProfile), allocationRules: structuredClone(state.allocationRules) }');
  text=text.replace(tail,hook+'\n'+(profileBuild?profileHook.replaceAll('__PROFILE_RULES_ID__',profileId)+'\n':'')+(allocationBuild?allocationHook.replaceAll('__ALLOCATION_RULES_ID__',allocationId)+'\n':'')+tail);
 }
 return {contents:text,loader:args.path.endsWith('.jsx')?'jsx':'js'};
 });
}}]});
await esbuild.build({entryPoints:['casual-ui-entry.js'],bundle:true,outfile:'2-casual-ui.js',format:'iife',target:['es2022'],minify:true});
if(!profileBuild)await writeFile('casual.html',"<!doctype html>\n<html lang=\"ko\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>리턴 · 캐주얼</title>\n<link rel=\"preload\" href=\"1-news-data-gen143.json.gz\" as=\"fetch\" crossorigin=\"anonymous\">\n<link rel=\"stylesheet\" href=\"2-casual.css\"><link rel=\"stylesheet\" href=\"2-casual-ui.css\">\n<style>#return-loading{max-width:560px;margin:10vh auto;padding:28px 24px;background:#fff;border:1px solid #e4dfd8;border-radius:16px;color:#302b29;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;line-height:1.75}#return-loading h1{font-size:24px;line-height:1.4;margin:8px 0 16px}#return-loading p{font-size:14px;margin:8px 0}#return-loading .loading-label{color:#426f62;font-size:12px}#return-loading a{color:#426f62;display:inline-block;min-height:44px;line-height:44px;margin-right:16px}#return-loading [hidden]{display:none!important}@media(max-width:600px){#return-loading{margin:32px 16px;padding:24px 20px}}</style>\n</head><body class=\"casual\"><div id=\"root\"><section id=\"return-loading\" aria-label=\"게임 시작 준비\"><p class=\"loading-label\">리턴: 회귀 투자자 · 캐주얼</p><h1>게임 자료를 불러오는 중입니다</h1><p role=\"status\">처음 열 때 약 6.3MB의 자료를 받아 준비합니다. 연결 상태에 따라 시간이 걸릴 수 있습니다.</p><p>기존 저장을 지우거나 새로 시작할 필요는 없습니다.</p><div id=\"return-loading-long\" hidden><p role=\"status\">아직 준비 중입니다. 화면이 바뀔 때까지 조금 더 기다려 주세요. 계속 열리지 않으면 이 페이지를 다시 열 수 있습니다. 저장은 삭제하지 않습니다.</p><a href=\"casual.html?loading=retry\">캐주얼 다시 열기</a><a href=\"./\">모드 선택으로</a></div><noscript><p>이 게임을 열려면 브라우저의 JavaScript가 켜져 있어야 합니다.</p></noscript></section></div>\n<script>setTimeout(function(){var note=document.getElementById('return-loading-long');if(note)note.hidden=false;},12000);</script>\n<script defer src=\"casual-edition.js\"></script></body></html>\n");
