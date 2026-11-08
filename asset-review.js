/* Read-only explanation of a new game's recorded trial asset changes. */
(function(root){
  'use strict';
  const monthIndex=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m)?Number(m.slice(0,4))*12+Number(m.slice(5))-1:null;
  function review(state,totalAssets){
    const b=state.assetReviewBaseline;
    if(!b)return {available:false,reason:'missing-baseline'};
    if(b.version!==1||b.source!=='new-game'||b.month!=='1996-03'||b.totalAssets!==1000000||Object.keys(b).sort().join(',')!=='month,source,totalAssets,version')return {available:false,reason:'unsupported-baseline'};
    const at=monthIndex(state.month),end=monthIndex('2026-10'),start=monthIndex(b.month),log=state.savingsLedger||[];
    if(at===null||at<start||!Array.isArray(log)||!Number.isFinite(totalAssets))return {available:false,reason:'invalid-range'};
    const months=Math.min(at,end)-start;
    if(log.length!==months)return {available:false,reason:'incomplete-savings'};
    let savings=0;const groups=Object.create(null);
    for(let i=0;i<log.length;i++){
      const r=log[i];
      if(!r||monthIndex(r.month)!==start+i+1||!Number.isFinite(r.amount)||r.amount<0||r.basis!=='test-net-savings-v1')return {available:false,reason:'incomplete-savings'};
      savings+=r.amount;if(!Number.isFinite(savings))return {available:false,reason:'invalid-savings-total'};const reason=typeof r.reason==='string'?r.reason:'구분 미기록';groups[reason]=(groups[reason]||0)+r.amount;
    }
    return {available:true,basis:'trial-asset-review-v1',startMonth:b.month,endMonth:state.month,months,openingAssets:b.totalAssets,recordedSavings:savings,assetChangeRemainder:totalAssets-b.totalAssets-savings,totalAssets,savingsByReason:groups};
  }
  function inspectSnapshot(r,expectedTotal){
    if(!r||r.available!==true)return {available:false,reason:'missing-recorded-review'};
    const start=monthIndex(r.startMonth),end=monthIndex(r.endMonth);
    if(r.basis!=='trial-asset-review-v1'||r.startMonth!=='1996-03'||r.openingAssets!==1000000||end===null||end<start||r.months!==Math.min(end,monthIndex('2026-10'))-start)return {available:false,reason:'unsupported-recorded-review'};
    const amounts=[r.openingAssets,r.recordedSavings,r.assetChangeRemainder,r.totalAssets,expectedTotal];
    if(!amounts.every(Number.isFinite)||r.recordedSavings<0||r.totalAssets!==expectedTotal||Math.abs(r.openingAssets+r.recordedSavings+r.assetChangeRemainder-r.totalAssets)>0.000001)return {available:false,reason:'invalid-recorded-review'};
    const g=r.savingsByReason;
    if(!g||typeof g!=='object'||Array.isArray(g)||!Object.values(g).every(v=>Number.isFinite(v)&&v>=0)||Math.abs(Object.values(g).reduce((a,b)=>a+b,0)-r.recordedSavings)>0.000001)return {available:false,reason:'invalid-recorded-groups'};
    return r;
  }
  function compareSnapshots(a,aTotal,b,bTotal){
    const left=inspectSnapshot(a,aTotal),right=inspectSnapshot(b,bTotal);
    if(!left.available||!right.available)return {available:false,reason:'missing-comparable-review',left,right};
    const differences={months:right.months-left.months,openingAssets:right.openingAssets-left.openingAssets,recordedSavings:right.recordedSavings-left.recordedSavings,assetChangeRemainder:right.assetChangeRemainder-left.assetChangeRemainder,totalAssets:right.totalAssets-left.totalAssets};
    if(!Object.values(differences).every(Number.isFinite))return {available:false,reason:'nonfinite-comparison',left,right};
    return {available:true,basis:'trial-asset-review-v1',left,right,differences};
  }
  const api={review,inspectSnapshot,compareSnapshots};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ReturnAssetReview=api;
})(typeof window!=='undefined'?window:globalThis);
