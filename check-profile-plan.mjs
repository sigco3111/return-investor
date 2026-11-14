import assert from 'node:assert/strict';
import {plan,defaults,nominalHigh,birthParts,add,mi,MIN_START,MAX_START} from './profile-plan.mjs';
const make=(o={})=>({...defaults(),...o});
assert.equal(plan(make()).startMonth,'1996-03');
assert.equal(plan(make({birth:'1979-03-01',education:'hs2',service:'none'})).startMonth,'1996-03');
assert.equal(plan(make({birth:'1979-02-01',education:'hs2',service:'none'})).code,'no-overlap');
assert.equal(plan(make({birth:'1979-02-01',education:'hs2',schoolDelay:1,service:'none'})).startMonth,'1996-03');
assert.equal(plan(make({birth:'1985-03-01',education:'hs1',service:'none'})).startMonth,'2001-03');
assert.equal(plan(make({birth:'1972-03-01',education:'graduate',admission:'1991-03',service:'done',serviceStart:'1991-03',work:'job',jobStart:'1997-05'})).startMonth,'1997-06');
assert.equal(plan(make({birth:'1972-03-01',education:'graduate',admission:'1991-03',service:'none',work:'job',jobStart:'1995-03'})).startMonth,'1996-03');
assert.equal(plan(make({birth:'1972-03-01',education:'graduate',admission:'1991-03',service:'done',serviceStart:'1991-03',work:'job',jobStart:'1995-03'})).code,'job-date');
assert.equal(plan(make({education:'hs2',service:'done'})).code,'hs-service');
assert.equal(plan(make({education:'hs1',work:'job'})).code,'student-work');
assert.equal(plan(make({birth:'2010-03-01',education:'hs2',service:'none'})).code,'no-overlap');
assert.equal(plan(make({birth:'2010-03-01',education:'hs1',service:'none'})).startMonth,'2026-03');
assert.equal(plan(make({birth:'1981-02-30'})).code,'birth');
assert.ok(birthParts('2000-02-29'));assert.equal(birthParts('1900-02-29'),null);
assert.equal(nominalHigh('1979-02-01'),1994);assert.equal(nominalHigh('1979-03-01'),1995);
const serving=plan(make({birth:'1975-03-01',education:'college1',admission:'1995-03',service:'serving',serviceStart:'1995-08',work:'study'}));
assert.ok(serving.ok);assert.equal(serving.startMonth,'1996-03');assert.equal(serving.academicMonths,5);assert.equal(serving.income,0);assert.equal(serving.living,100000);assert.equal(serving.tuition,0);
const college=plan(make({birth:'1975-03-01',education:'college2',admission:'1994-03',service:'done',serviceStart:'1994-08',work:'alba'}));assert.ok(college.ok);assert.equal(college.startMonth,'1997-05');
let cases=0;
for(let y=1970;y<=2010;y+=2)for(const month of ['02','03','12'])for(const education of ['hs1','hs2','hs3','college1','college4','graduate','highGraduate'])for(const service of ['none','pending','done','serving']){
 const birth=`${y}-${month}-01`,i=defaults(birth,education,service),h=nominalHigh(birth);if(service==='done'){i.serviceStart=(h+3)+'-03';i.admission=add(i.serviceStart,26);}i.jobStart=education==='graduate'?add(i.admission,48):(h+3)+'-03';
 const p=plan(i);cases++;
 if(p.ok){assert.ok(p.startMonth>=MIN_START&&p.startMonth<=MAX_START);assert.equal(p.startCash,1000000);assert.equal(p.firstCashMonth,add(p.startMonth,1));if(education.startsWith('hs')){assert.ok(mi(p.startMonth)>=mi(p.highStart)+(Number(education.slice(2))-1)*12);assert.ok(mi(p.startMonth)<mi(p.highStart)+Number(education.slice(2))*12);}if(service==='done')assert.ok(p.startMonth>=p.serviceEnd);if(service==='pending')assert.ok(p.startMonth<p.serviceStart);if(service==='serving')assert.ok(p.startMonth>=p.serviceStart&&p.startMonth<p.serviceEnd);}
}
console.log(JSON.stringify({pass:true,dateAndConflictCases:cases+18,backgroundDoesNotInventMoney:true}));
