/* Identifies the existing trial-net-savings model only. No real-income model. */
(function (root) {
  'use strict';
  const ID = 'trial-net-savings-v1';
  function descriptor() { return { id: ID, schemaVersion: 1 }; }
  function inspect(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return {ok:false,reason:'invalid-state'};
    if (!Object.prototype.hasOwnProperty.call(state, 'economyModel')) return {ok:true,legacy:true,id:ID};
    const m=state.economyModel;
    if (!m || typeof m!=='object' || Array.isArray(m) || Object.keys(m).sort().join(',')!=='id,schemaVersion' || m.id!==ID || m.schemaVersion!==1)
      return {ok:false,reason:'unsupported-economic-model'};
    return {ok:true,legacy:false,id:ID};
  }
  // This checks only the engine fields required to read a save, not full game validity.
  function inspectCore(state) {
    const obj=x=>x && typeof x==='object' && !Array.isArray(x);
    if (!obj(state) || typeof state.month!=='string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(state.month) ||
      !Number.isFinite(state.cash) || !Number.isFinite(state.chaos) || !obj(state.flags) || !obj(state.holdings) ||
      !Array.isArray(state.history) || !Array.isArray(state.unlocksSeen) ||
      !Number.isInteger(state.eventIndex) || state.eventIndex<0 || !Number.isInteger(state.turnCount) || state.turnCount<0)
      return {ok:false,reason:'invalid-save-core'};
    return {ok:true};
  }
  function inspectRaw(raw) {
    if (raw===null) return {ok:true,exists:false,state:null};
    try {
      const state=JSON.parse(raw), result=inspectCore(state);
      return result.ok ? {ok:true,exists:true,state} : {ok:false,exists:true,reason:result.reason};
    } catch (_) { return {ok:false,exists:true,reason:'unreadable-save-json'}; }
  }
  function inspectNested(state, products) {
    const obj=x=>x && typeof x==='object' && !Array.isArray(x);
    const num=x=>Number.isFinite(x) && x>=0;
    const mon=x=>typeof x==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
    const present=k=>Object.prototype.hasOwnProperty.call(state,k);
    const fail=reason=>({ok:false,reason});
    const known=p=>typeof p==='string' && products.includes(p);
    for (const [product,h] of Object.entries(state.holdings)) {
      if (!known(product) || !obj(h) || !num(h.qty) || !num(h.avgPrice) ||
        (h.invested!=null && !num(h.invested)) || (h.entryMonth!=null && !mon(h.entryMonth))) return fail('invalid-holding');
    }
    if (present('pendingOrders')) {
      if (!Array.isArray(state.pendingOrders)) return fail('invalid-orders');
      const ids=new Set();
      for (const o of state.pendingOrders) {
        if (!obj(o) || typeof o.id!=='string' || !o.id || ids.has(o.id) || !known(o.product) ||
          !['buy','sell'].includes(o.kind) || !mon(o.placedMonth)) return fail('invalid-order');
        ids.add(o.id);
        if (o.kind==='buy' ? (!num(o.amount)||o.amount<=0) :
          (!num(o.qty)||o.qty<=0||!num(o.avgPrice)||!num(o.costBasis)||(o.investedShare!=null&&!num(o.investedShare)))) return fail('invalid-order-money');
        // Missing observation fields are an explicitly supported old format: no guessed fill.
        if ((o.obsCutoff!=null && (typeof o.obsCutoff!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(o.obsCutoff))) ||
          (o.obsPostClose!=null && typeof o.obsPostClose!=='boolean')) return fail('invalid-order-observation');
      }
    }
    if (present('savingsLedger') && (!Array.isArray(state.savingsLedger) || state.savingsLedger.some(r=>
      !obj(r)||!mon(r.month)||!num(r.amount)||typeof r.reason!=='string'))) return fail('invalid-savings-ledger');
    if (present('interestLedger') && (!Array.isArray(state.interestLedger) || state.interestLedger.some(r=>
      !obj(r)||!mon(r.month)||!Array.isArray(r.entries)||r.entries.some(e=>!obj(e)||!known(e.product)||
        !num(e.balanceBefore)||!num(e.balanceAfter)||!num(e.interest)||!num(e.annualRate)||
        typeof e.rateLabel!=='string'||!['KRW','USD'].includes(e.unit))))) return fail('invalid-interest-ledger');
    if (state.flags.birth!=null) {
      const b=state.flags.birth;
      if (!obj(b)||!Number.isInteger(b.year)||!Number.isInteger(b.month)||b.month<1||b.month>12||!Number.isInteger(b.hsYear)) return fail('invalid-birth');
    }
    if (state.flags.lifeDone!=null && !obj(state.flags.lifeDone)) return fail('invalid-life-flags');
    return {ok:true};
  }
  const api=Object.freeze({descriptor,inspect,inspectCore,inspectRaw,inspectNested});
  if (typeof module==='object' && module.exports) module.exports=api;
  else root.ReturnEconomyPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
