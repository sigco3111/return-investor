// Automatic arrears clearing edition. Preserved engines and saves are untouched.
const ALLOCATION_RULES_ID='__ALLOCATION_RULES_ID__';
const CLEARING_PRIOR_ID='fd272da3ee654fe8e7a96f6ead762755fdf0d81c08c10aff04d993cf47d43614';
window.__returnClearing=true;
let allocationDraft=null;
const allocationValid=()=>!!state.allocationRules&&state.allocationRules.version===1&&[ALLOCATION_RULES_ID,CLEARING_PRIOR_ID].includes(state.allocationRules.id)&&Object.keys(state.allocationRules).sort().join(',')==='id,version'&&Array.isArray(state.pendingOrders)&&state.pendingOrders.length===0;
const allocationBaseSave=save;
save=function(){if(profileDraft&&!state.allocationRules){state.allocationRules={version:1,id:ALLOCATION_RULES_ID};state.pendingOrders=[];}if(state.flags.birth&&!allocationValid())return showSaveConflict('즉시 투자 배분 규칙·주문 상태를 확인하지 못해 저장하지 않았습니다.','allocation-rules');return allocationBaseSave();};
const allocationBaseValid=validSchoolStart;
validSchoolStart=function(){return allocationBaseValid()&&allocationValid();};
const allocationBaseRender=render;
render=function(){if(state.flags.birth&&!allocationValid())return showSaveConflict('즉시 투자 배분 규칙이 맞지 않아 멈췄습니다. 기존 저장은 바꾸지 않았습니다.','allocation-rules');return allocationBaseRender();};
const allocationBaseAccess=tradeAccess;
tradeAccess=function(turn){const t=allocationBaseAccess(turn);return {...t,reserveOnly:false,label:t.allowed?'확보된 자료가격으로 즉시 배분 가능':t.label};};
function allocationQuote(id){
 const u=productRule(id);if(!productAvailable(u)||u.tradable===false||u.rule==='unpriced')return null;
 if(u.rule==='accrual')return {unit:1,ptDate:null,fxPtDate:null};
 const pt=holdingPricePoint(id,state.month);if(!pt||!wasObservableAt(pt,effDate,effPostClose))return null;
 const fx=u.rule==='fxprice'?priceAt('fx',state.month):null;
 if(u.rule==='fxprice'&&(!fx||!wasObservableAt(fx,effDate,effPostClose)))return null;
 const unit=pt.value*(fx?fx.value:1);return Number.isFinite(unit)&&unit>0?{unit,ptDate:pt.date,fxPtDate:fx?.date||null}:null;
}
function allocationFillBuy(id,amount,origin){
 const u=productRule(id),q=allocationQuote(id);if(!q||!Number.isSafeInteger(amount)||amount<=0)throw Error('quote');
 const h=state.holdings[id]||{qty:0,avgPrice:0},qty=amount/q.unit,nq=h.qty+qty;
 h.avgPrice=(h.avgPrice*h.qty+amount)/nq;h.qty=nq;h.entryMonth=state.month;
 if(u.rule==='accrual'){h.avgPrice=1;h.invested=(h.invested||0)+amount;}else if(u.rule==='fxaccrual')h.invested=(h.invested||0)+amount;
 state.holdings[id]=h;
 const fill={kind:'buy-fill',product:id,amount,price:q.unit,ptDate:q.ptDate||state.month+'-01',month:state.month,obsCutoff:effDate,usableFrom:null,fxPtDate:q.fxPtDate,...origin?{planOrigin:origin}:{}};
 state.fillsLog=(state.fillsLog||[]).concat(fill);state.lastFills=(state.lastFills||[]).concat(fill);
}
function allocationSnapshot(){
 const ta=tradeAccess(nextTurn()),rows=unlockedProducts().filter(u=>u.rule!=='unpriced').map(u=>{
  const h=state.holdings[u.product],value=h?holdingValue(u.product,h,state.month):0,q=allocationQuote(u.product);
  return {id:u.product,name:u.name||u.product,rule:u.rule||'price',value,available:!!q,reason:productStatusNote(u),unit:q?.unit||null,priceDate:q?.ptDate||null,fxPriceDate:q?.fxPtDate||null,priceNote:u.rule==='accrual'?'게임 이자 누적 모형 · 원화1원 단위':q?'가격 '+q.unit.toLocaleString('ko-KR',{maximumFractionDigits:4})+'원/모형단위 · 자료 '+q.ptDate+(q.fxPtDate?' · 환율 '+q.fxPtDate:''):'확보 시세·환율 없음',note:u.rule_note||u.rate_note||u.note||''};
 });
 for(const [id,h]of Object.entries(state.holdings))if(!rows.some(r=>r.id===id))rows.push({id,name:productRule(id).name||id,rule:productRule(id).rule,value:holdingValue(id,h,state.month),available:false,reason:'현재 접근 조건을 확인하지 못했습니다.'});
 const l=assetLiquidityReview();if(!l)throw Error('liquidity');
 return {cash:state.cash,rows,unpaid:careerCashUnpaid(),allowed:ta.allowed,reason:ta.label,military:!!militaryActive(),buyCap:gameLivingInvestCap(),locked:l.values.buyReserved+l.values.sellLocked+(l.values.propertyLocked||0),property:l.values.propertyOwned||0,orderCount:state.pendingOrders.length,month:state.month,turn:state.turnCount,date:effDate,postClose:effPostClose,alba:albaTimeLimited()};
}
function allocationSignature(){return JSON.stringify([state,effDate,effPostClose,pending?.event?.id||null]);}
function allocationCommit(snapshot,targets,options,signature){
 if(storageReadBlocked||storageWriteBlocked||multiTabConflict||window.__returnStorageHalted||!allocationValid())return false;
 if(signature!==allocationSignature()||!ReturnEconomyPolicy.inspect(state,currentEconomyId()).ok||!ReturnEconomyPolicy.inspectNested(state,DATA.unlocks.map(u=>u.product)).ok||!profileValid()||!propertyShapeOk(state)||!cashAllocationShapeOk(state)||!albaTimeShapeOk(state))return false;
 const current=allocationSnapshot(),review=Allocation.planAllocation(current,targets);
 if(!review.ok||JSON.stringify(current)!==JSON.stringify(snapshot))return false;
 if(state.allocationRules.id!==ALLOCATION_RULES_ID)return false;
 const original=state,originalPending=pending;
 state=structuredClone(original);
 try{
  let clearingDone=false;const clear=()=>{if(!clearingDone){clearingApply(review.repay);clearingDone=true;}};
  // All quotes are validated before mutation. Sell all reductions first, then buy.
  for(const line of [...review.lines.filter(r=>r.kind==='sell'),...review.lines.filter(r=>r.kind==='buy')]){
   const u=productRule(line.id),q=allocationQuote(line.id),h=state.holdings[line.id];if(!q)throw Error('quote');
   if(line.kind==='sell'){
    if(!h||line.from<=0)throw Error('holding');
    const frac=line.amount/line.from,qty=h.qty*frac,cost=h.invested!=null?Math.round(h.invested*frac):Math.round(h.avgPrice*qty);
    h.qty-=qty;if(h.invested!=null)h.invested-=cost;if(h.qty<=1e-12)delete state.holdings[line.id];
    state.cash+=line.amount;
    state.chaos=localCommonApplySale(line.id,line.amount);
    const fill={kind:'sell-fill',product:line.id,proceeds:line.amount,costBasis:cost,pnl:line.amount-cost,price:q.unit,ptDate:q.ptDate||state.month+'-01',month:state.month,obsCutoff:effDate,usableFrom:null,fxPtDate:q.fxPtDate};
    state.fillsLog=(state.fillsLog||[]).concat(fill);state.lastFills=(state.lastFills||[]).concat(fill);
   }else{clear();if(line.amount>state.cash)throw Error('cash');state.cash-=line.amount;allocationFillBuy(line.id,line.amount);}
   state.history.push({month:state.month,decisionMonth:state.month,choice:'allocation-instant:'+line.kind+':'+line.id,amount:line.amount,target:line.target,price:q.unit,priceDate:q.ptDate,fxPriceDate:q.fxPtDate});
  }
  clear();
  if(state.cash!==review.cashAfter||!ReturnEconomyPolicy.inspectNested(state,DATA.unlocks.map(u=>u.product)).ok)throw Error('verification');
  if(state.chaos>=CHAOS.overAt)state.flags.gameOver='chaos';
  albaTimeConsume(review.buys>0?'buy':'sell');
  state.allocationReceipt={version:1,decisionTurn:state.turnCount+1,month:state.month,lines:review.lines.map(r=>({id:r.id,name:r.name,kind:r.kind,amount:r.amount})),cashAfter:review.cashAfter,repay:review.repay,unpaidAfter:review.unpaidAfter};
  pending=null;allocationDraft=null;
  finishTurn(originalPending.event,'allocation-batch:'+review.lines.length);
  return !storageReadBlocked&&!storageWriteBlocked&&!multiTabConflict&&!window.__returnStorageHalted;
 }catch(e){state=original;pending=originalPending;return false;}
}
// Automatic monthly plans keep the same cash-flow limits and target selection,
// but convert newly funded buys at this month's known price immediately.
const allocationBaseAuto=applyCashSavingsPlan;
applyCashSavingsPlan=function(){
 const before=structuredClone(state);try{
  allocationBaseAuto();
  const orders=state.pendingOrders;
  if(orders.some(o=>o.kind!=='buy'||o.planOrigin!=='career-cash'))throw Error('unexpected pending order');
  for(const o of orders)allocationFillBuy(o.product,o.amount,o.planOrigin);
  state.pendingOrders=[];
 }catch(e){state=before;throw e;}
};
const allocationBaseStatus=productStatusNote;
productStatusNote=function(u){if(!productAvailable(u)||u.tradable===false||u.rule==='unpriced')return allocationBaseStatus(u);return allocationQuote(u.product)?'확보된 자료가격으로 즉시 매수·매도 [게임 모형]':'시세·환율 자료 미확보 · 거래 불가';};
careerFulltimeCoverageText=function(){const c=careerFulltimeCoverage();return c?'현금 '+c.cash.toLocaleString()+'원 · 미납 '+c.unpaid.toLocaleString()+'원. 금융상품은 확보자료가격으로 즉시 팔 수 있는 게임 모형이지만, 실제 거래 가능성·미래 가격·생계기간을 보장하지 않습니다. 미납은 배분 확정 때 현금·매도대금으로 먼저 상환합니다. 미납이 남으면 새 매수 없이 매도·상환만 가능합니다.':'';};
const allocationBasePlanHtml=cashSavingsPlanHtml;
cashSavingsPlanHtml=function(){const p=state.jobSavingsPlan,unpaid=careerCashUnpaid();if(state.flags.career!=='job')return '';return '<details class="job-savings-plan cash-savings-plan"><summary>취업 월 여유금 자동배분 · '+(p?.percent?p.percent+'% 설정':'꺼짐')+'</summary><p class="note">생활·학비 납부 후 그달 새 여유금과 현금 중 작은 금액의 선택 비율만 즉시 매수합니다. 매월 당시 확보자료가격을 쓰며, 미납·복무·접근/시세 미확보 때는 건너뜁니다. 과거 누락분은 소급하지 않습니다. 설정 변경은 분기 정산에서 다음 달부터 적용하고 끄기는 언제든 가능합니다. 예비현금 방침도 유지합니다.</p><p class="note">현재 미납 '+unpaid.toLocaleString()+'원. 마지막 적용 '+(p?.appliedMonths?.at(-1)||'없음')+'.</p><button id="job-plan-open">앞으로의 대상·비율 바꾸기</button></details>';};
window.__returnAllocationReceipt=()=>allocationValid()&&state.allocationReceipt?structuredClone(state.allocationReceipt):null;
function clearingApply(amount){
 if(amount===0)return;
 if(!Number.isSafeInteger(amount)||amount<0||amount>state.cash)throw Error('clearing-cash');let rest=amount;
 for(const row of state.cashEvents.rows){const rem=row.living+row.tuition-row.paid;if(rem<=0)continue;const paid=Math.min(rest,rem);row.paid+=paid;row.status=row.paid===row.living+row.tuition?'paid':'partial';rest-=paid;if(!rest)break;}
 if(rest!==0)throw Error('clearing-ledger');state.cash-=amount;if(amount)state.history.push({month:state.month,decisionMonth:state.month,choice:'career-cash:repay:'+amount,origin:'allocation-clearing'});
}
// Presentation-only code below. Rule identity is pinned to the planner and core above.
const allocationMoney=n=>Math.round(n).toLocaleString('ko-KR')+'원';
function allocationNode(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function allocationButton(text,id,fn){const b=allocationNode('button','',text);b.type='button';if(id)b.id=id;b.onclick=fn;return b;}
const allocationBaseTrade=renderTrade;
renderTrade=function(){
 if(!pending||!['product','allocation','allocation-review'].includes(pending.step))return allocationBaseTrade();
 if(storageWriteBlocked)return showStorageWriteUnavailable();if(storageReadBlocked)return showStorageReadUnavailable();
 if(pending.step==='product'){pending.step='allocation';allocationDraft=null;}
 if(!allocationDraft){try{const snap=allocationSnapshot();allocationDraft={snapshot:snap,targets:Object.fromEntries(snap.rows.map(r=>[r.id,r.value])),options:{},signature:allocationSignature()};}catch{return showSaveConflict('자산 구성·가격을 확인하지 못해 배분을 열지 않았습니다.','allocation-assets');}}
 if(pending.step==='allocation-review')return allocationReview();
 allocationEditor();
};
function allocationFrame(title){const card=document.getElementById('turn-card'),box=document.getElementById('choices');card.replaceChildren();box.replaceChildren();card.append(allocationNode('div','date',state.month+' · 한 묶음 투자 판단'),allocationNode('h2','',title));const root=allocationNode('section','allocation-panel');root.id='allocation-panel';card.append(root);return {card,box,root};}
function allocationEditor(){
 const d=allocationDraft,s=d.snapshot,base=s.cash+s.rows.reduce((v,r)=>v+r.value,0),{box,root}=allocationFrame('투자 배분');
 root.append(allocationNode('p','c-core-note','미납 '+allocationMoney(s.unpaid)+'은 매도 후 현금에서 먼저 자동 상환합니다. 부족하면 가능한 만큼 갚고, 새 매수 없이 매도·상환만 처리합니다.'));
 root.append(allocationNode('p','c-core-note','상품 비중을 조정하면 남길 현금이 함께 바뀝니다. 다른 상품 비중은 자동으로 바꾸지 않습니다.'));
 const meta=allocationNode('div','allocation-meta');meta.innerHTML='<span>배분 기준 자산</span><strong>'+allocationMoney(base)+'</strong><p>현금 + 주문에 안 묶인 금융자산</p><p>기존 예약·매도·계약 잠금 '+allocationMoney(s.locked)+' · 주택 '+allocationMoney(s.property)+' 별도</p>';root.append(meta);
 const cash=allocationNode('div','allocation-cash');root.append(cash);
 const updateFns=[];
 const status=allocationNode('p','allocation-status');status.id='allocation-status';status.setAttribute('aria-live','polite');
 const go=allocationButton('변경 검토하기','allocation-review',()=>{const p=Allocation.planAllocation(s,d.targets,d.options);if(!p.ok)return;pending.step='allocation-review';allocationReview();document.getElementById('turn-card').scrollIntoView({block:'start'});});
 const update=()=>{
  const target=s.rows.reduce((a,r)=>a+d.targets[r.id],0),draft=Allocation.planAllocation(s,d.targets),remaining=draft.ok?draft.cashAfter:base-target;
  cash.replaceChildren();cash.append(allocationNode('strong','', '현금으로 남기기 '+(base?Math.max(0,remaining)/base*100:0).toLocaleString('ko-KR',{maximumFractionDigits:1})+'%'),allocationNode('span','',allocationMoney(remaining)));
  const p=Allocation.planAllocation(s,d.targets,d.options);go.disabled=!p.ok;go.textContent=p.ok?(p.lines.length?'변경 '+p.lines.length+'건 검토하기':'미납 자동상환 검토하기'):'변경 검토하기';
  status.textContent=p.ok?'미납 자동 상환 '+allocationMoney(p.repay)+' · 남는 미납 '+allocationMoney(p.unpaidAfter)+' · 매매·상환 직후 현금 '+allocationMoney(p.cashAfter):p.message;
  status.classList.toggle('allocation-error',!p.ok&&p.code!=='unchanged');for(const fn of updateFns)fn();
 };
 for(const r of s.rows){
  const row=allocationNode('div','allocation-row');row.dataset.product=r.id;
  const head=allocationNode('div','allocation-row-head'),label=allocationNode('label','',r.name),val=allocationNode('strong','allocation-percent');label.htmlFor='allocation-'+r.id;head.append(label,val);row.append(head);
  const slider=allocationNode('input');slider.type='range';slider.id='allocation-'+r.id;slider.min='0';slider.max='100';slider.step='1';slider.value=base?Math.round(d.targets[r.id]/base*100):0;slider.disabled=!r.available||!s.allowed||base===0;row.append(slider);
  const values=allocationNode('div','allocation-row-values'),now=allocationNode('span','', '현재 '+(base?r.value/base*100:0).toLocaleString('ko-KR',{maximumFractionDigits:1})+'% · '+allocationMoney(r.value)),change=allocationNode('span');values.append(now,change);row.append(values);
  updateFns.push(()=>{val.textContent=(base?d.targets[r.id]/base*100:0).toLocaleString('ko-KR',{maximumFractionDigits:1})+'%';const diff=d.targets[r.id]-r.value;change.textContent=diff===0?'변경 없음':(diff>0?r.rule==='accrual'?'예치 ':'매수 ':r.rule==='accrual'?'해지 ':'매도 ')+allocationMoney(Math.abs(diff));});
  slider.oninput=()=>{d.targets[r.id]=Math.round(base*Number(slider.value)/100);const opt=d.options[r.id];if(opt&&d.targets[r.id]<r.value)opt.expiry=0;update();};
  if(!r.available)row.append(allocationNode('p','c-core-note',r.reason));
  root.append(row);
 }
 const details=allocationNode('details','allocation-details'),ds=allocationNode('summary','','상품별 가격·환율·게임 모형 보기');details.append(ds);for(const r of s.rows){details.append(allocationNode('p','',r.name+' · '+r.priceNote),allocationNode('p','',r.note));}root.append(details);
 root.append(status,allocationNode('p','c-core-note','슬라이더 조정은 거래·저장이 아닙니다. 확정하면 매도 → 미납 자동상환 → 매수 순서로 즉시 반영합니다. 미납부터 가능한 만큼 자동 상환하고, 남은 돈만 새 매수에 씁니다. 미납이 남으면 새 매수 없이 매도·상환만 가능합니다.'));
 if(s.alba)root.append(allocationNode('p','c-core-note','확정한 묶음 전체가 이번 달 수동 투자 판단1회를 씁니다. 상품 사이에는 시간이 흐르지 않습니다.'));
 box.append(go,allocationButton('취소 · 현재 판단으로','allocation-cancel',()=>{pending=null;allocationDraft=null;render();}));update();renderPortfolio();
}
function allocationReview(){
 const d=allocationDraft,s=d.snapshot,p=Allocation.planAllocation(s,d.targets,d.options),{root,box}=allocationFrame('이 배분으로 주문할까요?');
 if(!p.ok){root.append(allocationNode('p','allocation-error',p.message));box.append(allocationButton('배분 다시 조정','allocation-edit',()=>{pending.step='allocation';allocationEditor();}));return;}
 root.append(allocationNode('div','allocation-meta','미납 자동 상환 '+allocationMoney(p.repay)+' · 남는 미납 '+allocationMoney(p.unpaidAfter)));
 root.append(allocationNode('p','c-core-note',(p.lines.length?'아래 '+p.lines.length+'건을 같은 판단 시점의 확보 가격으로 즉시 반영합니다.':'매매 없이 현재 현금으로 미납을 상환합니다.')+' 매도대금으로 미납을 먼저 상환한 뒤 남는 돈을 매수에 쓰며, 묶음 뒤 판단·월 진행은 한 번만 이어집니다.'));
 for(const r of p.lines){const row=allocationNode('div','allocation-row');row.append(allocationNode('strong','',r.name),allocationNode('p','',(r.kind==='buy'?'즉시 매수/예치 ':'즉시 매도/해지 ')+allocationMoney(r.amount)),allocationNode('p','c-core-note',s.rows.find(x=>x.id===r.id)?.priceNote||'게임 평가 기준'));root.append(row);}
 root.append(allocationNode('div','allocation-meta','매매 직후 현금 '+allocationMoney(p.cashAfter)+' · 매수 '+allocationMoney(p.buys)+' · 매도 '+allocationMoney(p.sales)),allocationNode('p','c-core-note','실제 시장의 체결가가 아니라 당시 확보된 자료가격을 쓰는 게임 모형입니다. 가격·환율 기준일이 서로 다르거나 오래되었을 수 있습니다. 확정 뒤 월별 수입·생활비·이자·가격변화는 별도로 이어집니다.'));
 const saleExposure=p.lines.filter(r=>r.kind==='sell'&&!localCommonSafe.has(r.id)).reduce((a,r)=>a+r.amount,0),chaosAfter=state.chaos+(Math.round((state.commonChaos.saleKRW+saleExposure)/state.commonChaos.T*10)-state.commonChaos.saleTicks)/10;
 root.append(allocationNode('p',chaosAfter>=70?'allocation-error':'c-core-note','매매 직후 카오스 '+chaosAfter.toFixed(1)+'/100'+(chaosAfter>=100?' · 한계 도달로 회귀가 종료됩니다.':'. 보유 변화의 월 누적 부담은 다음 월 정산에 반영됩니다.')));
 const confirm=allocationButton('이 묶음 확정 · 투자 판단1회','allocation-confirm',()=>{confirm.disabled=true;if(!allocationCommit(s,d.targets,d.options,d.signature)&&!storageWriteBlocked&&!storageReadBlocked&&!multiTabConflict&&!window.__returnStorageHalted){root.append(allocationNode('p','allocation-error','자산·주문·저장 상태가 달라져 확정하지 않았습니다. 취소 후 다시 검토하세요.'));}});
 // Deliberate checkbox keeps scroll, keyboard focus and a double click from submitting a plan.
 const consent=allocationNode('label','allocation-consent'),cb=allocationNode('input');cb.type='checkbox';cb.id='allocation-consent';confirm.disabled=true;cb.onchange=()=>confirm.disabled=!cb.checked;consent.append(cb,document.createTextNode('주문 금액·매매 직후 현금·확보자료가격과 판단1회 사용을 확인했습니다.'));root.append(consent);
 box.append(confirm,allocationButton('배분 다시 조정','allocation-edit',()=>{pending.step='allocation';allocationEditor();}),allocationButton('취소 · 현재 판단으로','allocation-cancel',()=>{pending=null;allocationDraft=null;render();}));renderPortfolio();
}
const allocationBaseBirth=renderBirthSelect;
renderBirthSelect=function(){allocationBaseBirth();const review=document.getElementById('profile-review'),oldReview=review?.onclick;if(review)review.onclick=()=>{oldReview();const dl=document.querySelector('#profile-summary dl');if(dl){for(const dt of dl.querySelectorAll('dt'))if(dt.textContent==='첫 투자')dt.nextElementSibling.textContent='여러 금융상품을 한 묶음으로 확보자료가격에 즉시 매수·매도. 묶음당 판단1회, 알바는 월1회, 취업은 분기 검토, 복무 매수합계30% 상한. 주택은 별도 계약.';}};const root=document.getElementById('profile-form');if(root){const n=allocationNode('p','c-core-note','즉시 투자 배분: 여러 금융상품을 한 묶음으로 확정하면 투자 판단1회입니다. 확보된 자료가격으로 매도 후 매수하며 중간에 시간이 흐르지 않습니다. 주택은 별도 계약입니다. 이전 진행은 원본을 보존한 후 안내를 확인하고 이어갑니다.');root.prepend(n);}const link=allocationNode('p','c-core-note');link.innerHTML='<a href="casual.html?edition=profile">이전 생년월일판 저장 열기</a>';document.getElementById('turn-card').append(link);};

function allocationPresentation(){
 const blocked=storageReadBlocked||storageWriteBlocked||multiTabConflict||window.__returnStorageHalted;
 const unlock=document.getElementById('unlock-area');if(blocked){unlock?.replaceChildren();document.getElementById('casual-receipt')?.remove();}
 else for(const e of unlock?.querySelectorAll('.unlock-banner')||[]){
  if(!e.textContent.includes('체결'))continue;
  let text=e.textContent.replace(/\s*\[[^\]]*지연체결[^\]]*\]/g,' [확보자료가격 즉시 체결 게임 모형]').replace(/가격 기준일\([^)]*\)이 접수 후 관측게이트\([^)]*\)보다 과거예요 \[시연 가정\]\./g,'').replace('적립 예약 체결:','월 자동매수 즉시 반영:');
  const cut=text.indexOf(' · 관측게이트와 실제 주문일');if(cut>=0)text=text.slice(0,cut)+' [확보자료가격 즉시 체결 게임 모형]';
  e.textContent=text;
 }

 for(const area of document.querySelectorAll('#turn-card,#portfolio,#choices')){
  const walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);let n;
  while(n=walker.nextNode()){
   let t=n.nodeValue;
   t=t.replace('가격형 주문은 접수 뒤 새 적격 관측을 기다립니다.','금융상품 매수·매도는 당시 확보된 자료가격으로 즉시 반영합니다.');
   if(t.includes('월별 접수 후 정산 뒤 새 적격 관측에서 체결하며'))t='선택한 비율은 다음 달부터 새 여유금에만 적용합니다. 그달 확보된 자료가격으로 즉시 매수하며, 자료·접근 조건이 없으면 해당 몫은 현금으로 남깁니다. 전체 금융자산의 목표 비중이나 과거 여유금 소급배분이 아닙니다.';
   if(t.includes('총 예약 예산을 먼저 정하고'))t='분산은 손실·카오스를 막는 보장이 아닙니다. 그달 새 여유금 예산을 나누며, 가격·접근을 확인할 수 없는 대상 몫은 현금으로 남깁니다. 다른 대상에 몰거나 소급하지 않습니다. 달러예금 이자는 게임값입니다.';
   if(t.includes('예약')&&n.parentElement.closest('.cash-savings-plan,#turn-card')&&(/여유금|배분|중단|절반|전액/.test(t)))t=t.replaceAll('새 예약','자동 매수').replaceAll('예약 검토','자동 매수 검토').replaceAll('절반 예약','절반 매수').replaceAll('전액 예약','전액 매수');
   if(t!==n.nodeValue)n.nodeValue=t;
  }
 }
}
const allocationPresentPortfolio=renderPortfolio;
renderPortfolio=function(){const out=allocationPresentPortfolio();allocationPresentation();return out;};
const allocationPresentRender=render;
render=function(){const out=allocationPresentRender();allocationPresentation();return out;};
const clearingRender=render;
render=function(){
 if(state.flags.birth&&state.allocationRules?.id===CLEARING_PRIOR_ID){
  const card=document.getElementById('turn-card'),box=document.getElementById('choices');card.replaceChildren();box.replaceChildren();
  card.append(allocationNode('h2','','지금 회귀에서 미납 자동상환으로 이어갑니다'),allocationNode('p','','배분 확정 때 현금과 매도대금으로 미납부터 가능한 만큼 갚고, 남은 돈으로 매수합니다. 미납이 남으면 매도·상환만 가능합니다. 기존 원본을 따로 보존하고 현재 날짜·현금·보유·과거 기록은 그대로 이어갑니다. 아직 돈은 움직이지 않았습니다.'));
  const go=allocationButton('내용 확인 · 현재 회귀 이어하기','clearing-continue',async()=>{
   const previous=structuredClone(state);
   go.disabled=true;try{const key='regression-invest-school-calendar-save-v1',raw=localStorage.getItem(key);if(!raw)throw Error('원본 없음');const bytes=new TextEncoder().encode(raw),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),pre='return-clearing-original.v1.'+digest+'.',encoded=await ClearingCodec.encodeSave(raw),parts=ClearingCodec.chunkString(encoded.data,12000);let recovered='';for(let i=0;i<parts.length;i++){const name=pre+'p'+i;const old=await ClearingStorage.request('local.read',{key:name});if(old.value!==null&&old.value!==parts[i])throw Error('원본 보존 충돌');if(old.value===null)await ClearingStorage.request('local.write',{key:name,value:parts[i]});const got=await ClearingStorage.request('local.read',{key:name});if(got.status!=='saved'||got.value!==parts[i])throw Error('원본 조각 보존 미확인');recovered+=got.value;}if(await ClearingCodec.decodeSave(encoded.enc,recovered)!==raw)throw Error('원본 복원 미확인');const idx=JSON.stringify({version:1,sha256:digest,enc:encoded.enc,src:raw.length,parts:parts.length});await ClearingStorage.request('local.write',{key:pre+'index',value:idx});const check=await ClearingStorage.request('local.read',{key:pre+'index'});if(check.status!=='saved'||check.value!==idx)throw Error('원본 색인 미확인');state.allocationRules={version:1,id:ALLOCATION_RULES_ID};if(!save()||await window.__returnStorageFlush()!==true)throw Error('저장 미확인');render();}catch(e){state=previous;card.append(allocationNode('p','allocation-error','원본 보존·저장을 확인하지 못해 전환을 멈췄습니다. '+String(e)));}
  });box.append(go);return;
 }
 return clearingRender();
};
