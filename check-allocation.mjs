import assert from 'node:assert/strict';
import {planAllocation} from './allocation-plan.mjs';
const rows=[{id:'a',name:'예금',rule:'accrual',value:300000,available:true},{id:'b',name:'지수',rule:'price',value:200000,available:true},{id:'c',name:'해외',rule:'fxprice',value:0,available:true}];
const base={cash:500000,rows,allowed:true,unpaid:0,military:false};
const original=JSON.stringify(base);
let count=0;
for(let a=0;a<=100;a+=5)for(let b=0;b<=100;b+=5)for(let c=0;c<=100;c+=5){
 const targets={a:a*10000,b:b*10000,c:c*10000},p=planAllocation(base,targets);count++;
 if(p.ok){assert.equal(p.cashAfter,1000000-Object.values(targets).reduce((v,n)=>v+n,0));assert.ok(p.cashAfter>=0);assert.equal(p.cashAfter,base.cash+p.sales-p.buys);assert.ok(p.lines.every(l=>l.amount>0));}else assert.ok(a+b+c>100||a===30&&b===20&&c===0);
}
assert.equal(JSON.stringify(base),original);
assert.equal(planAllocation({...base,unpaid:1},{a:200000,b:400000}).code,'unpaid');
assert.equal(planAllocation({...base,unpaid:1},{a:0,b:0}).ok,true);
assert.equal(planAllocation({...base,military:true},{a:300000,b:400000}).code,'cap');
assert.equal(planAllocation({...base,military:true},{a:100000,b:400000}).ok,true);
assert.equal(planAllocation({...base,allowed:false},{a:0}).code,'access');
assert.equal(planAllocation({...base,rows:rows.map(r=>({...r,available:r.id!=='b'}))},{b:0}).code,'unavailable');
for(const bad of [-1,NaN,Infinity,0.1,'10',null])assert.equal(planAllocation(base,{a:bad}).ok,false);
assert.equal(planAllocation(base,{unknown:0}).ok,false);
assert.equal(planAllocation({...base,cash:Infinity},{}).ok,false);
assert.equal(planAllocation(base,{}).code,'unchanged');
assert.equal(planAllocation({...base,cash:0,rows:[{id:'b',name:'지수',value:1000000,available:true,rule:'price'},{id:'c',name:'해외',value:0,available:true,rule:'fxprice'}]},{b:0,c:1000000}).cashAfter,0);
console.log(JSON.stringify({pass:true,allocationGrid:count,sellProceedsReusable:true,inputUnchanged:true}));
