import * as esbuild from 'esbuild';
import {readFile,copyFile} from 'node:fs/promises';
await esbuild.build({entryPoints:['main.jsx'],bundle:true,outdir:'.',entryNames:'game',format:'iife',target:['es2022'],minify:true,legalComments:'linked',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'raw-text',setup(build){build.onResolve({filter:/\?raw$/},args=>({path:new URL(args.path.replace(/\?raw$/,''), 'file://'+args.resolveDir+'/').pathname,namespace:'raw-text'}));build.onLoad({filter:/.*/,namespace:'raw-text'},async args=>({contents:'export default '+JSON.stringify(await readFile(args.path,'utf8')),loader:'js'}));}}]});
await copyFile('pages.html','index.html');
