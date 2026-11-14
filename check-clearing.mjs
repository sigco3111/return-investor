import assert from 'node:assert/strict';
import {planAllocation} from './clearing-plan.mjs';
let n=0;for(const unpaid of [0,1,200000,700000,1500000])for(let a=0;a<=100;a+=5)for(let b=0;b<=100;b+=5){
 const s={cash:500000,unpaid,allowed:true,rows:[{id:'a',name:'예금',value:300000,available:true},{id:'b',name:'지수',value:200000,available:true}]},raw=JSON.stringify(s),p=planAllocation(s,{a:a*10000,b:b*10000});n++;assert.equal(JSON.stringify(s),raw);if(p.ok){assert.equal(p.cashAfter,s.cash+p.sales-p.repay-p.buys);assert.equal(p.unpaidAfter,unpaid-p.repay);assert.equal(p.repay,Math.min(unpaid,s.cash+p.sales));assert.ok(p.cashAfter>=0);if(p.unpaidAfter>0)assert.equal(p.buys,0);}
}
const s={cash:100,unpaid:200,allowed:true,rows:[{id:'a',name:'예금',value:100,available:true},{id:'b',name:'지수',value:0,available:true}]};
assert.deepEqual(Object.fromEntries(Object.entries(planAllocation(s,{a:100})).filter(([k])=>['repay','unpaidAfter','cashAfter'].includes(k))),{cashAfter:0,repay:100,unpaidAfter:100});
assert.equal(planAllocation(s,{a:0}).unpaidAfter,0);assert.equal(planAllocation(s,{a:0,b:1}).ok,false);
assert.equal(planAllocation({...s,unpaid:50},{a:0,b:150}).cashAfter,0);
console.log({pass:true,clearingGrid:n,partialRepayment:true,noBuyBeforeArrearsCleared:true});

for(const unpaid of [-1,NaN,Infinity,0.1,'1',null,undefined])assert.equal(planAllocation({...s,unpaid},{a:0}).ok,false);
