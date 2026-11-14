import * as esbuild from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
// Build a second presentation from the exact classic sources. The classic entry,
// bundle, styles, engine functions and data files are never overwritten.
const oldBuild=await readFile('45-build-pages.mjs','utf8');
const files=JSON.parse(oldBuild.match(/const files=(\{[^;]+\});/)[1]);
const assets=Object.fromEntries(Object.entries(files).filter(([k])=>k.endsWith('.png')));
const hook=await readFile('casual-view-hook.js','utf8');
await esbuild.build({entryPoints:['casual-engine-entry.jsx'],bundle:true,outfile:'2-casual.js',format:'iife',target:['es2022'],minify:true,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'casual-from-classic',setup(build){
 build.onResolve({filter:/.*/},args=>{if(!args.path.startsWith('.')&&!files[args.path]&&args.kind!=='entry-point')return;let raw=args.path.endsWith('?raw'),k=path.basename(args.path.replace(/\?raw$/,''));if(!files[k])for(const ext of ['.jsx','.js','.mjs'])if(files[k+ext]){k+=ext;break;}if(files[k])return {path:path.resolve(files[k]),namespace:raw?'raw-text':'file'};});
 build.onLoad({filter:/.*/,namespace:'raw-text'},async args=>({contents:'export default '+JSON.stringify(await readFile(args.path,'utf8')),loader:'js'}));
 build.onLoad({filter:/\.(jsx?|mjs)$/},async args=>{if(args.path.includes('node_modules'))return;let text=await readFile(args.path,'utf8');for(const[k,v]of Object.entries(assets))text=text.split(k).join(v);
 text=text.replace('fetch("game-data.json.gz")','fetch("'+files['game-data.json.gz']+'")');
 if(args.path.endsWith('22-main.jsx')){
   text='window.__returnAssetPaths='+JSON.stringify(assets)+';\n'+text;
   text=text.replaceAll("'return-game-session-v1'","'return-game-session-casual-v1'");
   // Casual never opens the classic import-slot pointer, even without Locks API.
   text=text.replace("window.localStorage.getItem('return-storage-slot.v1')",'null');
 }
 if(args.path.endsWith('15-browser-storage.js')){
   text=text.replace("const pointer = real.getItem('return-storage-slot.v1');",'const pointer = null;');
   text=text.replace("let prefix = '';","let prefix = 'return-casual.v1.';");
   text=text.replace("real.getItem('return-storage-slot.v1') !== pointer",'false');
   text=text.replaceAll('return-storage-slot-selection-v1','return-storage-casual-v1');
 }
 text=text.replace('charImg.src = "" + visualCommonFile','charImg.src = window.__returnAssetPaths[visualCommonFile]');
 text=text.replace('visualCommonPropEl.src = "prop-" + visualCommonProp + "-common.png"','visualCommonPropEl.src = window.__returnAssetPaths["prop-" + visualCommonProp + "-common.png"]');
 if(args.path.endsWith('20-game-bundle.js')){
  const tail='    boot();\n  })();\n})();';
  if(!text.endsWith(tail+'\n')&&!text.endsWith(tail))throw Error('engine hook boundary changed');
  text=text.replace(tail,hook+'\n'+tail);
 }
 return {contents:text,loader:args.path.endsWith('.jsx')?'jsx':'js'};
 });
}}]});
await esbuild.build({entryPoints:['casual-ui-entry.js'],bundle:true,outfile:'2-casual-ui.js',format:'iife',target:['es2022'],minify:true});
await writeFile('casual.html','<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>리턴 · 캐주얼</title><link rel="stylesheet" href="2-casual.css"><link rel="stylesheet" href="2-casual-ui.css"></head><body class="casual"><div id="root"></div><script defer src="2-casual.js"></script><script defer src="2-casual-ui.js"></script></body></html>');
