import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const preserved=JSON.parse(await readFile(new URL('./classic-preserved-sha256.json',import.meta.url),'utf8'));
for(const [file,expected]of Object.entries(preserved)){
 const got=createHash('sha256').update(await readFile(new URL(file,import.meta.url))).digest('hex');
 assert.equal(got,expected,'Classic baseline must stay byte-for-byte: '+file);
}
const index=await readFile(new URL('./index.html',import.meta.url),'utf8');
assert.ok(index.includes('href="advanced.html"')&&index.includes('href="casual.html"'));
assert.ok(!/localStorage|sessionStorage/.test(index),'Mode selection never reads or writes saves');
const html=await readFile(new URL('./casual.html',import.meta.url),'utf8');
assert.ok(html.includes('casual-edition.js'));
const router=await readFile(new URL('./casual-edition.js',import.meta.url),'utf8');
assert.ok(router.includes('2-casual.js')&&router.includes('3-casual.js'));
assert.ok(router.includes('return-casual.v1.')&&router.includes('return-casual.v2.'));
assert.ok(!router.includes('setItem('),'Edition router must not mutate storage');
const build=await readFile(new URL('./build-casual.mjs',import.meta.url),'utf8');
assert.ok(build.includes("return-casual.v1."));
console.log(JSON.stringify({pass:true,classicFilesPreserved:Object.keys(preserved).length,modeChooserHasNoStorage:true,separateCasualBundle:true}));

const enginePin=(await readFile(new URL('./casual-engine-sha256.txt',import.meta.url),'utf8')).trim();
assert.equal(createHash('sha256').update(await readFile(new URL('./2-casual.js',import.meta.url))).digest('hex'),enginePin,'Casual save identities pinned. Any engine change requires a separately reviewed compatible save route.');

const profilePin=(await readFile(new URL('./profile-engine-sha256.txt',import.meta.url),'utf8')).trim();
assert.equal(createHash('sha256').update(await readFile(new URL('./3-casual.js',import.meta.url))).digest('hex'),profilePin,'Profile edition is pinned separately. Preserve existing edition before future engine changes.');
