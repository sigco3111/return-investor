/* Nominal school-year calculator. Not a person's verified school record.
   No finance, save writes, local timezone arithmetic, or automatic migration. */
(function(root){
  'use strict';
  const VERSION=1;
  const SOURCES=Object.freeze([
    'https://www.law.go.kr/lsInfoP.do?lsiSeq=5542&ancYd=19810213&ancNo=03370&efYd=19810301&nwJoYnInfo=N&efGubun=Y&chrClsCd=010202&ancYnChk=0#0000',
    'https://www.korea.kr/briefing/policyBriefingView.do?newsId=148652811'
  ]);
  const monthIndex=m=>Number(m.slice(0,4))*12+Number(m.slice(5))-1;
  const monthValid=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  const fromIndex=n=>String(Math.floor(n/12)).padStart(4,'0')+'-'+String(n%12+1).padStart(2,'0');
  function nominal(birthYear,birthMonth){
    if(!Number.isInteger(birthYear)||birthYear<1975||birthYear>2010||!Number.isInteger(birthMonth)||birthMonth<1||birthMonth>12)return {ok:false,reason:'unsupported-birth-month'};
    const earlyCohort=birthYear<=2002&&birthMonth<=2;
    const primaryYear=birthYear+(earlyCohort?6:7);
    return {ok:true,version:VERSION,birthYear,birthMonth,earlyCohort,primaryYear,middleYear:primaryYear+6,highYear:primaryYear+9,
      highStart:(primaryYear+9)+'-03',highEnd:(primaryYear+12)+'-02',
      basis:earlyCohort?'pre-2009-march-cohort':'calendar-year-cohort-or-march-december',
      nominalProgressionOnly:true,individualSchoolHistoryVerified:false,exactBirthdayUsed:false};
  }
  function monthsBetween(start,end){if(!monthValid(start)||!monthValid(end))throw Error('Invalid month');return monthIndex(end)-monthIndex(start)}
  function startPlan(birthYear,birthMonth,end='2026-10',currentStart='1996-03'){
    const c=nominal(birthYear,birthMonth);if(!c.ok)return c;
    if(!monthValid(end)||!monthValid(currentStart))return {ok:false,reason:'invalid-boundary'};
    if(c.highStart>end)return {ok:false,reason:'school-start-after-game-end',calendar:c};
    const elapsed=monthsBetween(c.highStart,end),delta=monthsBetween(c.highStart,currentStart);
    return {ok:true,version:VERSION,calendar:c,startMonth:c.highStart,endMonth:end,
      calendarMonthsInclusive:elapsed+1,monthlyTransitionsThroughEnd:elapsed,
      oldPrototypeStart:currentStart,oldPrototypeStartMinusCohortStartMonths:delta,
      relationToOldStart:delta>0?'cohort-earlier':delta<0?'cohort-later':'same',
      earliestMonthlyEconomicRow:elapsed?fromIndex(monthIndex(c.highStart)+1):null,
      finalObservationMonth:fromIndex(monthIndex(end)+1),
      economicRowsIncludeStartingMonth:false,finalObservationAddsEconomicRow:false,
      migrationAllowed:false,planDoesNotMutateGame:true};
  }
  function recordedCoverage(plan,{eventDates=[],priceDates=[]}={}){
    if(!plan?.ok||!monthValid(plan.startMonth)||!monthValid(plan.endMonth))return {ok:false,reason:'invalid-plan'};
    const news=new Set(eventDates.filter(x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(x)).map(x=>x.slice(0,7)));
    const prices=new Set(priceDates.filter(x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(x)).map(x=>x.slice(0,7)));
    const months=[];
    for(let i=monthIndex(plan.startMonth);i<=monthIndex(plan.endMonth);i++){const month=fromIndex(i);months.push({month,recordedNews:news.has(month),recordedPricePoint:prices.has(month)})}
    return {ok:true,months,noRecordedNewsMonths:months.filter(x=>!x.recordedNews).length,noRecordedPricePointMonths:months.filter(x=>!x.recordedPricePoint).length,
      priceCountIsAggregateNotPerProduct:true,absenceDoesNotProveQuietMonth:true,recordedPointsAreNotAccessOrVerificationEvidence:true};
  }
  const api=Object.freeze({VERSION,SOURCES,nominal,startPlan,monthsBetween,recordedCoverage});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ReturnSchoolCalendar=api;
})(typeof globalThis!=='undefined'?globalThis:this);
