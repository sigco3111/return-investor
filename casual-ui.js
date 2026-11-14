// Casual changes presentation only. Original controls and their event handlers
// remain the sole path into the engine. No save or market write lives here.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won = n => Number.isFinite(n) ? Math.round(n).toLocaleString('ko-KR')+'원' : '확인 필요';
const small = n => !Number.isFinite(n)?'확인 필요':Math.abs(n)>=1e12?(n/1e12).toLocaleString('ko-KR',{maximumFractionDigits:2})+'조':Math.abs(n)>=1e8?(n/1e8).toLocaleString('ko-KR',{maximumFractionDigits:2})+'억':Math.abs(n)>=1e4?(n/1e4).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만':Math.round(n).toLocaleString('ko-KR');
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
let desiredDirection=null;
let observer, scheduled=false, screen='', category='main', page=0, lastTotals=null, confirmArmed=false, focusNext=false, mode='play';
let receiptState=null,receiptText='';
const riskPattern=/미납|차단|부족|불가|미확인|미검증|불확실|공백|위험|카오스|잠금|주의|한계|확정|지연|자료.*없|수입 0|급여 0|늦어|보류/;
function graph(v){
 const pts=(v.trail||[]).filter(p=>/^\d{4}-\d{2}$/.test(p.m)&&Number.isFinite(p.a));
 const current={m:v.month,a:v.total};
 // Current point is explicit, not silently written back into historical trail.
 const historical=pts.filter(p=>p.m<v.month);const nowSaved=pts.findLast(p=>p.m===v.month);
 const plot=[...historical,nowSaved||current];
 if(plot.length<2)return `<div class="c-empty-chart"><span>●</span><p>${esc(v.month)} · 첫 기록. 다음 월부터 이어집니다.</p></div>`;
 const min=Math.min(...plot.map(p=>p.a)), max=Math.max(...plot.map(p=>p.a));const lo=Math.min(0,min), hi=Math.max(max,lo+1), W=540,H=108,P=8;
 const monthnum=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7));const x0=monthnum(plot[0].m),x1=monthnum(plot.at(-1).m);
 const xy=plot.map(p=>[(P+(monthnum(p.m)-x0)/(x1-x0||1)*(W-P*2)).toFixed(1),(H-P-(p.a-lo)/(hi-lo)*(H-P*2)).toFixed(1)]);
 // Only adjacent recorded months are joined. Missing months get separate paths.
 let paths=[],part=[];plot.forEach((p,i)=>{if(i&&monthnum(p.m)-monthnum(plot[i-1].m)>1){paths.push(part);part=[];}part.push(xy[i].join(','));});paths.push(part);
 const endpointNotice=nowSaved&&Math.abs(nowSaved.a-v.total)>1?`<p class="c-chart-note">월별 마지막 저장 ${won(nowSaved.a)}과 현재 관측 ${won(v.total)}은 다릅니다. 그래프는 월별 저장값이며 현재 결산값으로 대체하지 않았습니다.</p>`:'';
 return endpointNotice+`<div class="c-chart-label"><span>총자산</span><span>${small(hi)}원</span></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="월별 총자산, ${esc(plot[0].m)} ${won(plot[0].a)}에서 ${esc(plot.at(-1).m)} ${won(plot.at(-1).a)}. 세로축 0원 기준. 미기록 월은 연결하지 않음"><line x1="8" x2="532" y1="100" y2="100" stroke="#e4e1db"/>${paths.map(p=>p.length>1?`<polyline points="${p.join(' ')}" fill="none" stroke="#427568" stroke-width="3"/>`:'').join('')}${xy.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="#427568"/>`).join('')}</svg><div class="c-chart-dates"><span>${esc(plot[0].m)}</span><span>0원 기준 · 총자산</span><span>${esc(plot.at(-1).m)}</span></div>`;
}
function stageName(v){const f=v.flags;if(!v.started)return '새 회귀 준비';if(v.ended)return '이번 삶의 결산';if(f.militaryUntil)return '복무 중';if(f.career==='job')return '일과 투자';if(f.recoveryJob==='alba')return '알바와 투자';if(f.career==='fulltime'||f.studyPath==='parttime')return '나의 투자 생활';if(f.academicStatus==='college')return '대학 생활';if(f.studyPath==='study')return '진학 준비';return '진로의 갈림길';}
function refreshDashboard(v,title){
 let dash=$('#casual-dashboard');if(!dash){dash=el('section','c-dashboard');dash.id='casual-dashboard';dash.setAttribute('aria-label','이야기와 자본 현황');$('#turn-card')?.before(dash);}
 dash.hidden=!v.started;
 const L=v.liquidity;const invested=L?L.holdings+L.sellLocked+(L.propertyOwned||0):null;const locked=L?L.buyReserved+(L.propertyLocked||0):null;
 const start=v.flags.birth?.hsYear?`${v.flags.birth.hsYear}년 고1`:'';
 const currentTitle=title||'지금 선택을 확인하세요';
 const signature=JSON.stringify([v,title]);if(dash.dataset.signature===signature)return;dash.dataset.signature=signature;
 const milestoneNames=['시작','진로','생활·투자','결산'];const phase=!v.started?0:v.ended?3:v.flags.career||v.flags.academicStatus==='college'||v.flags.militaryUntil?2:1;
 dash.innerHTML=`<div class="c-storyline"><span>${esc(v.month)} · ${esc(stageName(v))}</span><span>캐주얼</span></div><ol class="c-milestones" aria-label="이야기 흐름">${milestoneNames.map((n,i)=>`<li class="${i===phase?'is-current':i<phase?'is-past':''}" ${i===phase?'aria-current="step"':''}>${n}</li>`).join('')}</ol><div class="c-capital"><div><span>쓸 수 있는 현금</span><strong>${small(v.cash)}<small>원</small></strong></div><div><span>투자자산 평가</span><strong>${small(invested)}<small>${invested===null?'':'원'}</small></strong></div><div class="${v.unpaid>0?'is-debt':''}"><span>미납</span><strong>${small(v.unpaid)}<small>원</small></strong></div></div><div class="c-capital-foot"><span>예약·계약금 ${won(locked)} · 대기주문 ${v.orders.length}건</span><span>카오스 ${v.chaos.toFixed(1)}/100</span></div>${v.unpaid>0||v.ended?`<p class="c-net">미납 차감 후 순자산 <strong>${won(v.total-v.unpaid)}</strong></p>`:''}<details class="c-graph" ${v.started?'open':''}><summary>자산 변화 <strong>${won(v.total)}</strong></summary>${graph(v)}<details class="c-chart-basis"><summary>기준: 미납 별도 · 수익률 아님</summary><p class="c-chart-note">총자산 = 현금 + 보유평가 + 묶인 자금. 미납 차감 후 순자산 ${won(v.total-v.unpaid)}. 월별 게임 기록으로 수입·지출도 반영합니다. 미기록 월은 연결하지 않습니다.</p></details></details><a class="c-next-link" href="#turn-card">다음 판단 · ${esc(currentTitle)}</a><div class="c-dash-actions"><button type="button" data-c-menu="capital">자금·대기주문</button><button type="button" data-c-menu="records">기록·메뉴</button></div>`;
 const profile=window.__returnProfileSummary?.();if(profile?.ok){const d=disclosure(dash,'시작 배경 · '+profile.startMonth,'c-chart-basis');const p=el('p','c-chart-note');p.textContent=profile.input.birth+' 출생 · '+({hs1:'고1',hs2:'고2',hs3:'고3',college1:'대학1학년',college2:'대학2학년',college3:'대학3학년',college4:'대학4학년',graduate:'대학 졸업',highGraduate:'고교 졸업·대학 미진학'}[profile.input.education])+' · 시작현금100만원. 선택한 배경이며 과거 플레이·월급·이자기록이 아닙니다.';d.append(p);}
 if(v.unpaid>0||v.chaos>=70){const warn=el('p','c-warning');warn.textContent=(v.unpaid>0?`미납 ${won(v.unpaid)}. 새 매수와 대기 매수 체결은 상환 전 보류됩니다. `:'')+(v.chaos>=70?`카오스 주의 ${v.chaos.toFixed(1)}/100. 한계100에서는 역사가 바뀝니다.`:'');dash.append(warn);}
 if(lastTotals&&lastTotals.month!==v.month){const delta=v.total-lastTotals.total;dash.dataset.delta=String(delta);}lastTotals={month:v.month,total:v.total};
}
function disclosure(parent,label,cls='c-detail'){const d=el('details',cls),s=el('summary','',label);d.append(s);parent.append(d);return d;}
function compactCard(v){
 const card=$('#turn-card');const heading=card?.querySelector('h2');if(!card||!heading||card.__cProcessedHeading===heading)return;card.__cProcessedHeading=heading;card.dataset.cDone='yes';
 // When the engine redraws innerHTML, the old marker survives. Content identity
 // is checked separately by the observer before calling this function.
 if(card.querySelector('#profile-form,#allocation-panel'))return;
 const title=card.querySelector('h2')?.textContent||'';
 const birth=!!$('#by');const pending=v?.pending;
 if(birth){
  const updatePreview=()=>{const p=$('#hs-preview');const m=p?.textContent.match(/시작 (\d{4}-\d{2})/);const short=card.querySelector('.c-birth-preview');if(short)short.textContent=m?`고1 시작 ${m[1]} · ${m[1]<'1996-03'?'초기 자료공백 구간은 매매 제한':'2026년 10월까지 진행'}`:'생년월을 고르면 시작 시점을 보여드립니다.';};
  if(card.querySelector('.c-birth-note')){updatePreview();return;}
  const rules=disclosure(card,'게임 가정·시작 기준 자세히');
  const fields=card.querySelector('.birth-controls');const consent=card.querySelector('.birth-consent');const start=$('#cash-main-start');
  for(const n of [...card.children]){
   if(n===rules||n===fields||n===consent||n===start||n.tagName==='H2'||n.classList.contains('date'))continue;
   rules.append(n);
  }
  const note=el('p','c-birth-note','태어난 해와 달을 고르면 고1 시점으로 돌아갑니다.');fields.before(note);
  const preview=el('p','c-birth-preview');fields.after(preview);updatePreview();
  const risk=el('p','c-core-note','시작 현금 100만원. 수입·생활비·학비·복무는 게임 가정이며, 부족분은 미납으로 남습니다. 자료공백 구간은 거래가 제한됩니다.');consent.before(risk);
  const checkbox=consent.querySelector('input');consent.replaceChildren(checkbox,document.createTextNode('게임 가정과 캐주얼 별도 저장을 확인했습니다.'));
  start.textContent='이 생년월로 시작하기';
  // Full original rule text stays readable, but other old experiment entry
  // points belong to classic, not a silent change to this casual save.
  const choices=$('#choices');const d=disclosure(choices,'경제 규칙 전체 보기');for(const n of [...choices.children])if(n!==d){if(n.classList.contains('birth-entry-alternates'))n.hidden=true;else d.append(n);}
  rules.before(consent);consent.after(start);start.after(rules);
  return;
 }

 if(birth){const p=[...card.children].find(n=>n.tagName==='P');if(p){const full=p.cloneNode(true);p.textContent='태어난 해와 달을 고르면 고1 시점으로 돌아갑니다.';const d=disclosure(card,'시작 기준과 게임 가정');d.append(full);}}
 let more=null;const ensureMore=()=>more||(more=disclosure(card,birth?'규칙·자료의 한계':'배경·계산 자세히'));
 const sourceLead=[...card.children].find(n=>n.tagName==='P');
 const summaries={
  '고1, 시간을 어디에 쓸까':'공부에 집중할까요, 알바로 종잣돈을 모을까요? 이후 진로와 투자에 쓸 시간이 달라집니다.',
  '재학 중 시간 배분 방침을 정한다':'공부와 알바 사이에서 시간을 나눕니다. 이 게임에서는 공부 집중은 진학 기준 도달, 알바 병행은 미달로 정해져 있습니다.',
  '이 달에 연결된 뉴스가 없습니다':'이 달은 게임에 연결된 뉴스가 없습니다. 보유를 점검하거나 다음 판단까지 진행하세요. 실제 시장이 조용했다는 뜻은 아닙니다.'
 };
 if(sourceLead&&summaries[title]){const original=sourceLead.cloneNode(true);sourceLead.textContent=summaries[title];ensureMore().append(original);}

 let firstP=false;
 for(const n of [...card.children]){
  if(n===more||n.tagName==='H2'||n.classList.contains('date')||n.matches('.c-detail, .c-core-note'))continue;
  if(n.matches('label, input, select, textarea, button, .birth-controls, #hs-preview, #condition-error, #order-liquidity-preview, #impact-preview, #common-chaos-decision, #school-progress-result'))continue;
  if(n.querySelector('input,select,textarea,button,[role="alert"]'))continue;
  // Decision consequences, warnings, receipts and pending confirmations remain
  // on the face of the card. Only background explanation is folded away.
  if(n.matches('.cash-end, .career-end')||/상환|확인|결산|종료|기한|취소|부족|위험/.test(title))continue;
  if(n.tagName==='P'&&!firstP&&!birth){firstP=true;
   if(n.textContent.length>230&&!pending){const full=n.cloneNode(true);const sentences=n.textContent.split(/(?<=[.。다요])\s+/);let lead='';for(const s of sentences){if(lead.length+s.length>200)break;lead+=(lead?' ':'')+s;}if(lead.length>25){n.textContent=lead;ensureMore().append(full);if(riskPattern.test(full.textContent)){const caveat=el('p','c-core-note','게임 가정과 선택의 비용·제약을 확인하세요. 구체적인 차이는 아래 선택지에 표시됩니다.');n.after(caveat);}}}
   continue;
  }
  if(n.tagName==='DETAILS'){if(n.classList.contains('decision-panel')&&!n.dataset.cFolded){n.open=false;n.dataset.cFolded='yes';}if(n.classList.contains('source-details')){ensureMore().append(n);}continue;}
  if(n.id==='birth-precision-note'||n.id==='common-chaos-T')continue;
  if(n.tagName==='P'&&/월 현금사건 \[명시 게임설계값\]/.test(n.textContent)){
   const short=el('p','c-core-note','금액은 게임값입니다. 전업은 급여0원, 성인 생활비 월70만원이며 부족분은 미납으로 남습니다.');n.before(short);ensureMore().append(n);continue;
  }
  if(n.tagName==='P'&&/^생년 고1 달력 시작|^새 경제 시제|^개발판 신규회귀/.test(n.textContent)){ensureMore().append(n);continue;}
  if(n.tagName==='P'&&riskPattern.test(n.textContent)){
   // Keep short warnings in place. Repetitive model notices use one visible
   // plain-language warning while retaining their complete original below.
   if(n.textContent.length<180)continue;
   const short=el('p','c-core-note');
   if(/역사 재구성|당시 기사 원문 미확보/.test(n.textContent))short.textContent='역사 재구성: 당시 기사 원문을 확보하지 못한 카드입니다.';
   else if(/자료공백|매매 차단|1996-03/.test(n.textContent))short.textContent='1996년 3월 전 구간은 자료공백으로 매매가 막힙니다.';
   else if(/월 현금사건|게임설계값|실제 급여/.test(n.textContent))short.textContent='수입·생활비·학비는 게임설계값입니다. 부족분은 미납으로 남습니다.';
   else if(/카오스/.test(n.textContent))continue;
   else continue;
   n.before(short);ensureMore().append(n);continue;
  }
  if(n.matches('p,.tags,.life-outlook,.life-choice-preview,section,div')&&!n.querySelector('[id]'))ensureMore().append(n);
 }
 if(pending?.step==='product'){
  const hint=el('p','c-core-note','상품을 고르면 사용 금액과 체결 조건을 확인합니다. 실제 가입 자격이나 즉시 체결을 보장하지 않습니다.');card.append(hint);
 }
 if(pending?.step==='weight'){
  const h=card.querySelector('h2');if(h)h.textContent='얼마를 움직일까요?';
  const note=el('p','c-core-note',pending.direction==='sell'?'매도 접수만으로 현금은 늘지 않습니다. 실제 체결을 기다립니다.':'생활비로 남길 현금과 잠기는 예약금을 확인하세요. 주문 접수는 매수 완료가 아닙니다.');card.querySelector('.date')?.after(note);
 }
 if(title==='회귀 대시보드')card.querySelector('h2').textContent='지나간 회귀 기록';
}
function groupChoices(v){
 const box=$('#choices');if(!box)return;const buttons=[...box.children].filter(n=>n.tagName==='BUTTON');
 let bar=$('#casual-choice-categories');if(!bar){bar=el('nav','c-choice-nav');bar.id='casual-choice-categories';bar.setAttribute('aria-label','할 일 종류');box.before(bar);}
 const key=buttons.map((b,i)=>b.id+'|'+(b.dataset.cOriginal||b.textContent)).join('\n');if(box.dataset.cKey===key&&box.__cFirstButton===buttons[0])return;box.dataset.cKey=key;box.__cFirstButton=buttons[0];
 const title=$('#turn-card h2')?.textContent||'';const birth=!!$('#by');const pending=v?.pending;
 const currentKey=[v?.month,v?.turnCount,title,pending?.step,key].join('|');if(currentKey!==screen){screen=currentKey;category='main';page=0;}
 const primary=[],utilities=[];
 for(const b of buttons){
  b.hidden=false;b.classList.remove('c-secondary');
  if(!b.dataset.cOriginal)b.dataset.cOriginal=b.textContent;
  const text=b.dataset.cOriginal;
  if(!birth&&!pending&&/^(이 뉴스에 대응해|유지 \(지금 보유|건너뛰기 \(다음 진입)/.test(text)){
   b.textContent=/^이 뉴스/.test(text)?'투자 검토':/^유지/.test(text)?'지금은 기다리기':'이 뉴스 넘기기';
   if(/^이 뉴스/.test(text)&&b.disabled)b.textContent='투자 검토 · 지금은 제한됨';
   if(b.disabled)b.textContent+=' · '+text.replace(/^이 뉴스에 대응해 /,'');
   b.title=text;
  }
  if(!pending&&!birth&&(/career-|job-plan|cash-reserve|cash-repay|school-progress|academic-position|decision-pace/.test(b.id)||/진로.*비교|상환|현재.*배분|분기.*진행|다음 판단/.test(text)||text==='유지'||/^건너뛰기 \(다음 진입/.test(text)))utilities.push(b);else primary.push(b);
 }
 if(pending?.step==='product'){
  const info=disclosure(box,'상품별 자료·접근 조건 보기','c-product-info');
  for(const b of primary){
   const original=b.dataset.cOriginal;if(/취소|돌아가기/.test(original))continue;
   const name=original.split(/ — | - /)[0];const full=el('p','',original);info.append(full);
   b.textContent=name+(b.disabled?' · 자료/조건 미충족':'');
   if(desiredDirection==='sell'&&!v.holdings.some(h=>h.name===name))b.dataset.cFilter='yes';else delete b.dataset.cFilter;
  }
  if(desiredDirection==='sell'){
    const hidden=primary.filter(b=>b.dataset.cFilter==='yes');for(const b of hidden){b.hidden=true;primary.splice(primary.indexOf(b),1);}
    if(primary.length===1){const p=el('p','c-core-note','지금 새 매도에 쓸 수 있는 보유 상품이 없습니다. 묶인 매도 수량은 대기주문에서 확인하세요.');box.prepend(p);}
  }
 }
 const groups=(utilities.length?[{id:'main',name:'지금 선택',list:primary},{id:'other',name:'진로·진행 관리',list:utilities}]:[{id:'main',name:'지금 선택',list:primary}]).filter(g=>g.list.length);
 if(!groups.length){bar.replaceChildren();return;}
 // Three actions per page. Category navigation is separate from game choices.
 function draw(){
  const selected=groups.find(g=>g.id===category)||groups[0];category=selected.id;const pages=Math.max(1,Math.ceil(selected.list.length/3));page=Math.min(page,pages-1);
  buttons.forEach(b=>b.hidden=true);selected.list.slice(page*3,page*3+3).forEach(b=>b.hidden=false);
  bar.replaceChildren();
  if(groups.length>1)for(const g of groups){const b=el('button','',g.name+` (${g.list.length})`);b.type='button';b.setAttribute('aria-pressed',String(g.id===category));b.onclick=()=>{category=g.id;page=0;draw();};bar.append(b);}
  if(pages>1){const pager=el('div','c-choice-pager');const prev=el('button','','이전 선택');prev.type='button';prev.disabled=page===0;prev.onclick=()=>{page--;draw();};const count=el('span','',`${page+1} / ${pages}`);const next=el('button','','다음 선택');next.type='button';next.disabled=page===pages-1;next.onclick=()=>{page++;draw();};pager.append(prev,count,next);bar.append(pager);}
  let notes=box.querySelector(':scope > .c-choice-details');
  for(const n of [...box.children].filter(n=>!['BUTTON','DETAILS'].includes(n.tagName))){
   if((n.tagName==='P'&&n.textContent.length>100||n.tagName==='ASIDE')&&!n.querySelector('input,select,button')){if(!notes)notes=disclosure(box,'진행·학업의 조건 자세히','c-choice-details');notes.append(n);}
  }
 }
 draw();
}
function decorateButtons(){
 for(const b of $$('#choices > button')){
  if(b.dataset.cLabelDone||b.querySelector('span'))continue;b.dataset.cLabelDone='yes';
  const text=b.textContent;const sep=text.indexOf(' — ');if(sep>0&&text.length>55){b.replaceChildren(el('strong','c-choice-title',text.slice(0,sep)),el('span','c-choice-sub',text.slice(sep+3)));}
 }
}
function shell(){
 const main=$('main');if(!main||$('#casual-topbar'))return;
 const top=el('div','c-topbar');top.id='casual-topbar';top.innerHTML='<a href="./">‹ 모드 선택</a><span>리턴: 회귀 투자자</span><a href="advanced.html">어드밴스</a>';main.prepend(top);
 const h=$('header');if(h)h.classList.add('c-original-header');
 const pf=$('#portfolio');if(pf){const toggle=el('button','c-portfolio-close','자금 관리 닫기');toggle.id='casual-portfolio-close';toggle.type='button';toggle.onclick=()=>{mode='play';render();$('#casual-dashboard')?.scrollIntoView({block:'start'});};pf.before(toggle);pf.hidden=true;toggle.hidden=true;}
 const record=$('#record-copy');if(record){
   const nav=el('section','card c-record-menu');nav.id='casual-record-menu';nav.hidden=true;
   nav.innerHTML='<h2>기록·메뉴</h2><button type="button" id="casual-open-history">지나간 회귀 기록 보기</button><button type="button" id="casual-end-life">이번 회귀 마치기 검토</button><button type="button" id="casual-close-menu">현재 판단으로 돌아가기</button>';
   record.before(nav);
   $('#casual-open-history').onclick=()=>{mode='play';$('#dash-link')?.click();focusNext=true;schedule();};
   $('#casual-end-life').onclick=()=>{mode='play';$('#voluntary-end-open')?.click();focusNext=true;schedule();};
   $('#casual-close-menu').onclick=()=>{mode='play';render();$('#turn-card')?.scrollIntoView({block:'start'});};
const notice=el('p','c-core-note','캐주얼 전용 사본입니다. 클래식 가져오기는 별도 공간을 사용하므로 이 사본을 자동 연결하지 않습니다.');record.querySelector('summary')?.after(notice);}
}
let capitalGroup='assets';
function compactCapital(){
 const pf=$('#portfolio');if(!pf||pf.querySelector(':scope > .c-capital-nav'))return;
 const content=[...pf.children];const nav=el('nav','c-capital-nav');nav.setAttribute('aria-label','자금 관리 종류');
 const panes={assets:el('section','c-capital-pane'),orders:el('section','c-capital-pane'),cash:el('section','c-capital-pane')};
 const names={assets:'보유·주택',orders:'대기·체결',cash:'수입·미납'};
 const rules=disclosure(pf,'모형·자료·기록 자세히','c-capital-rules');
 for(const n of content){
  const text=n.textContent||'';
  if(n.matches('.pending-order,.pending-job-group,.pending-liquidity,.pending-hint,.job-reservation-cancellation,.fill-ledger,.fill-ledger-empty,.fill-ledger-unavailable,.career-mechanics,#fill-library-open')||n.matches('.product-list')&&/최근 체결/.test(text)){panes.orders.append(n);continue;}
  if(n.matches('.cash-events-review,.cash-savings-plan,.job-savings-plan,.cash-reserve,.interest-ledger,.cash-flow-review')||n.matches('.row')&&/월 저축|생활비|월 급여|미수 급여/.test(text)){panes.cash.append(n);continue;}
  if(n.matches('.property-panel,.asset-liquidity,.alba-time')||n.matches('.row')&&!/카오스|보유 유지|코스피|회귀|시나리오|지나간|시장 비중|펀드순자산/.test(text)){panes.assets.append(n);continue;}
  rules.append(n);
 }
 for(const [key,pane]of Object.entries(panes)){const h=el('h2','',names[key]);pane.prepend(h);pf.append(pane);}
 function draw(){for(const[key,pane]of Object.entries(panes))pane.hidden=key!==capitalGroup;for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.group===capitalGroup));}
 for(const key of Object.keys(panes)){const b=el('button','',names[key]);b.type='button';b.dataset.group=key;b.onclick=()=>{capitalGroup=key;draw();};nav.append(b);}
 pf.prepend(nav);draw();
 for(const review of pf.querySelectorAll('.cash-events-review')){const d=disclosure(review,'현금사건 규칙 전체 보기');for(const n of [...review.children])if(n.tagName==='P'&&n!==d)d.append(n);}
 for(const property of pf.querySelectorAll('.property-panel')){const d=disclosure(property,'가격·계약 규칙 자세히');for(const n of [...property.children])if(n.tagName==='P')d.append(n);}
}
function openRepayment(){
 const cancel=$('#allocation-cancel');if(cancel)cancel.click();
 mode='capital';capitalGroup='cash';render();$('.c-capital-nav [data-group="cash"]')?.click();
 requestAnimationFrame(()=>{const target=$('.career-repayment-preview')||$('.cash-events-review');target?.scrollIntoView({block:'start'});const b=$('#career-cash-repay');if(b){b.tabIndex=0;b.focus({preventScroll:true});}});
}
function repaymentAccess(v){
 if(!v||v.blocked||v.unpaid<=0)return;
 const add=(parent,id,label)=>{if(!parent||$('#'+id))return;const b=el('button','c-repayment-access',label);b.id=id;b.type='button';b.onclick=openRepayment;parent.append(b);};
 add($('#casual-dashboard'),'casual-repay-shortcut','미납 '+won(v.unpaid)+' 확인·상환');
 const panel=$('#allocation-panel');if(panel){
  let n=$('#allocation-unpaid-help');if(!n){n=el('p','c-warning','미납이 있어 새 매수는 막혀 있습니다. 보유 비중을 줄이는 매도·해지만 가능합니다. 확정은 투자 판단1회를 쓰며, 이어지는 월의 생활비가 매도대금에서 먼저 빠질 수 있습니다. 상환은 현재 현금으로 별도 확인합니다.');n.id='allocation-unpaid-help';panel.prepend(n);}
  add(n,'allocation-repay-shortcut','배분을 취소하고 미납 확인·상환');
 }
 const preview=$('.career-repayment-preview');if(preview){
  const text=preview.textContent,none='지금은 납부 가능한 청구가 없습니다';
  if(text.includes(none)){
   const message=v.cash<=0?'미납 '+won(v.unpaid)+'이 있지만 지금 쓸 수 있는 현금이 없습니다.':'미납 '+won(v.unpaid)+'이 남아 있습니다. 현금 '+won(v.cash)+'으로는 가장 오래된 달의 남은 청구 전액을 낼 수 없습니다.';
   const walk=document.createTreeWalker(preview,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode())if(n.nodeValue.includes(none))n.nodeValue=n.nodeValue.replace(none,message);
  }
  const b=$('#career-cash-repay');if(b&&text.includes(none)){b.disabled=true;b.textContent='현금 부족 · 지금 상환할 수 없음';}
 }
}
function render(){
 if(!$('main'))return;observer?.disconnect();
 try{
  shell();const card=$('#turn-card');if(!card)return;
  const signature=card.innerHTML;if(card.__cContent!==signature){delete card.dataset.cDone;}
  let v=null;try{v=window.__returnCasualRead?.();}catch{const d=$('#casual-dashboard');if(d){d.innerHTML='<p class="c-warning">자산 현황을 확인하지 못했습니다. 앞서 표시한 금액은 사용하지 않습니다. 저장을 바꾸지 말고 다시 열어 확인하세요.</p>';delete d.dataset.signature;}}
  if(v?.blocked){receiptText='';receiptState=null;$('#casual-receipt')?.remove();$('#unlock-area')?.replaceChildren();mode='play';const d=$('#casual-dashboard');if(d){d.innerHTML='<p class="c-warning">저장·현황 확인이 중단되어 금액을 표시하지 않습니다. 아래 오류 안내를 확인하세요.</p>';delete d.dataset.signature;}v=null;}
  if(v){const title=card.querySelector('h2')?.textContent||'생년월을 고르세요';refreshDashboard(v,title);compactCard(v);groupChoices(v);decorateButtons();}
  // Optional story lines and detailed chaos assumptions stay available without
  // placing a second long card ahead of the player's next decision.
  const chapter=$('#vn-first-chapter');let story=$('#casual-story');
  if(chapter){if(!story){story=disclosure(card.parentElement,'이야기 펼치기','c-story-details');story.id='casual-story';$('#choices').after(story);}story.append(chapter);}
  if(story&&!story.querySelector('#vn-first-chapter'))story.remove();
  const chaos=$('#common-chaos-decision');let risk=$('#casual-risk');
  if(chaos){if(!risk){risk=disclosure(card.parentElement,'보유 규모·분산 가정 보기','c-risk-details');risk.id='casual-risk';($('#casual-story')||$('#choices')).after(risk);}risk.append(chaos);risk.open=(v?.chaos||0)>=70;}
  if(risk&&!risk.querySelector('#common-chaos-decision'))risk.remove();

  for(const panel of $$('#turn-card .decision-panel'))if(!panel.dataset.cFolded){panel.open=false;panel.dataset.cFolded='yes';}
  if(v?.pending?.step==='direction'&&desiredDirection){const target=$$('#choices>button').find(b=>(desiredDirection==='sell'?/일부 매도|해지/.test(b.textContent):/^매수/.test(b.textContent))&&!b.disabled);if(target)queueMicrotask(()=>target.click());}
  if(v){
    const signature=JSON.stringify([v.month,v.turnCount,v.cash,v.total,v.unpaid,v.orders,v.history.at(-1)]);
    if(receiptState&&receiptState.signature!==signature){
      const delta=v.cash-receiptState.cash;const debt=v.unpaid-receiptState.unpaid;
      receiptText=`선택 반영 · ${v.month} · 현금 ${delta===0?'변화 없음':(delta>0?'+':'')+won(delta)}${debt?` · 미납 ${debt>0?'+':''}${won(debt)}`:''}`;
    }
    receiptState={signature,cash:v.cash,unpaid:v.unpaid};
    const batch=window.__returnAllocationReceipt?.();if(batch&&batch.decisionTurn===v.turnCount)receiptText=batch.month+' · '+batch.lines.length+'건 즉시 반영 · 매매 직후 현금 '+won(batch.cashAfter)+'. 이후 월 정산은 아래 현재 자산에 반영됩니다.';
    let r=$('#casual-receipt');if(receiptText){if(!r){r=el('p','c-receipt');r.id='casual-receipt';card.before(r);}r.textContent=receiptText;r.setAttribute('role','status');}
  }
  const chaosPreview=$('#chaos-preview');
  if(chaosPreview&&chaosPreview.dataset.commonMonthlyAfter){
   if(!chaosPreview.closest('details')){const d=disclosure(card,'카오스 계산 가정 자세히');d.append(chaosPreview);}
   let short=$('#casual-chaos-summary');if(!short){short=el('p','c-core-note');short.id='casual-chaos-summary';$('#order-liquidity-preview')?.before(short);}
   const trajectory=chaosPreview.textContent.match(/3\/6\/12개월 ([0-9]+(?:\.[0-9]+)? \/ [0-9]+(?:\.[0-9]+)? \/ [0-9]+(?:\.[0-9]+)?)/)?.[1];
   short.textContent=`카오스 ${v?.chaos.toFixed(1)}/100 · 월가산 ${Number(chaosPreview.dataset.commonMonthlyBefore).toFixed(3)} → ${Number(chaosPreview.dataset.commonMonthlyAfter).toFixed(3)}${trajectory?' · 3/6/12개월 '+trajectory:''}. 전액 체결·가격 고정 가정이며 미래 예측이 아닙니다. 주의70·종료100.`;
  }
  const execute=$('#order-execute');if(execute&&!execute.disabled)execute.textContent='최종 확인하기';
  card.__cContent=card.innerHTML;
  // The original portfolio remains intact; opening this mode reveals all of its
  // management controls, including arrears, contract cancellation and orders.
  compactCapital();
  for(const e of $$('#turn-card,#choices,#casual-choice-categories,#casual-story,#casual-risk,#casual-receipt'))e.hidden=mode!=='play'||!!$('#allocation-panel')&&['casual-receipt','casual-risk'].includes(e.id);
  const pf=$('#portfolio');if(pf)pf.hidden=mode!=='capital';const close=$('#casual-portfolio-close');if(close)close.hidden=mode!=='capital';
  const rm=$('#casual-record-menu');if(rm){if(!rm.querySelector('.c-profile-link')){const nav=el('div','c-profile-link');for(const[edition,label]of [['allocation','즉시 배분판 · 새 회귀/이어하기'],['profile','이전 생년월일판 저장'],['legacy','이전 고1 시작판 저장']]){if(edition===window.__returnCasualEdition)continue;const a=el('a','',label);a.href='casual.html?edition='+edition;a.style.display='block';a.style.minHeight='44px';nav.append(a);}rm.append(nav);}rm.hidden=mode!=='records';const end=$('#casual-end-life');end.disabled=!$('#voluntary-end-open');}
  for(const e of $$('#record-copy,.asset-license,#footnote'))e.hidden=mode!=='records';
  const allocating=!!$('#allocation-panel');if(allocating){const area=$('#unlock-area');if(area)area.hidden=true;}else{const area=$('#unlock-area');if(area)area.hidden=mode!=='play';}const dash=$('#casual-dashboard');if(dash&&allocating)dash.hidden=true;
  const stage=$('#vn-stage');if(stage){stage.hidden=mode!=='play'||!v?.started||allocating;stage.classList.add('c-illustrated-scene');card.before(stage);}
  $$('.art-details').forEach(e=>e.hidden=mode!=='records');
  const importLink=$('main > p a[href="import.html"]');if(importLink)importLink.parentElement.hidden=true;
  repaymentAccess(v);
  const status=$('#storage-scope-status');if(status){status.classList.add('c-save-status');const p=status.querySelector('p');if(p)p.hidden=mode!=='records';}
  // Clearly isolate optional historical experiment links from casual play.
  $$('#turn-card a[href*="economy="],#turn-card a[href*="start=classic"]').forEach(a=>a.parentElement.hidden=true);
  if(focusNext){focusNext=false;requestAnimationFrame(()=>{const h=$('#turn-card h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});($('#vn-stage')||$('#turn-card')).scrollIntoView({block:'start',behavior:'instant'});}});}
 }finally{observer?.observe(document.body,{childList:true,subtree:true,characterData:true});}
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
function orderReview(button){
 if(confirmArmed){confirmArmed=false;return false;}
 const card=$('#turn-card');const v=window.__returnCasualRead?.();if(!v?.pending)return false;
 const review=el('section','c-review');review.id='casual-order-review';review.setAttribute('role','dialog');review.setAttribute('aria-modal','true');review.setAttribute('aria-label','주문 최종 확인');
 const product=v.pending.product;const name=v.pending.name||v.holdings.find(h=>h.id===product)?.name||$('#choices')?.dataset.cProductName||product;
 const l=$('#order-liquidity-preview');const liquidity=l?.textContent||'';
 const cashAfter=l?.dataset.cashAfter;const amount=l?.dataset.amount;
 const moneySummary=(amount?`이번 ${v.pending.direction==='sell'?'해지·매도':'매수·예치'} ${won(Number(amount))} · `:'')+(cashAfter?`접수 직후 현금 ${won(Number(cashAfter))}`:'');const risk=$('#chaos-preview')?.textContent||'';const shortRisk=$('#casual-chaos-summary')?.textContent||risk;
 const cond=$('#cond-on')?.checked?`조건 ${$('#cond-val')?.value} / ${$('#condition-direction')?.selectedOptions[0]?.textContent||''}`:'조건 없는 주문';
 review.innerHTML=`<div class="c-review-card"><p class="c-eyebrow">마지막 확인 · 아직 접수 전</p><h2>${esc(name)}<br>${v.pending.direction==='sell'?'매도·해지':'매수·예치'} 최종 확인</h2><p class="c-review-money">${esc(moneySummary||liquidity)}</p><p class="c-core-note">${esc(cond)} · 분할 ${esc($('#split-n')?.selectedOptions[0]?.textContent||'없음')} · 기한 ${esc($('#order-expiry')?.selectedOptions[0]?.textContent||'원래 규칙')}</p><p class="c-core-note">${esc(shortRisk)}</p><details><summary>금액·계산 가정 전체 보기</summary><p>${esc(liquidity)}</p><p>${esc(risk)}</p></details><p>가격형 주문은 이후 적격 관측에서 체결됩니다. 예약 중인 돈·수량은 자금 관리에서 확인할 수 있습니다. 예금은 기존 규칙대로 바로 예치·해지합니다.</p><div class="c-review-actions"><button type="button" id="casual-order-confirm">조건 확인 · 접수하기</button><button type="button" id="casual-order-edit">돌아가서 수정</button></div></div>`;
 document.body.append(review);const root=$('#root');root.inert=true;
 $('#casual-order-confirm').onclick=()=>{root.inert=false;review.remove();confirmArmed=true;button.click();schedule();};$('#casual-order-edit').onclick=()=>{root.inert=false;review.remove();button.focus();};
 review.addEventListener('keydown',e=>{if(e.key==='Escape')$('#casual-order-edit').click();if(e.key==='Tab'){const a=[...review.querySelectorAll('button')],i=a.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();a.at(-1).focus();}else if(!e.shiftKey&&i===a.length-1){e.preventDefault();a[0].focus();}}});$('#casual-order-confirm').focus();return true;
}
function chooseDirection(original){
 const layer=el('section','c-review');layer.id='casual-direction';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','매수 또는 매도 선택');
 layer.innerHTML='<div class="c-review-card"><p class="c-eyebrow">투자 검토 · 1단계</p><h2>어느 쪽을 검토할까요?</h2><p>아직 주문하거나 돈을 옮기지 않습니다.</p><div class="c-review-actions"><button type="button" data-direction="buy">새로 사기 · 예치</button><button type="button" data-direction="sell">보유분 팔기 · 해지</button><button type="button" data-direction="back">지금은 돌아가기</button></div></div>';
 document.body.append(layer);const root=$('#root');root.inert=true;
 for(const b of layer.querySelectorAll('button'))b.onclick=()=>{root.inert=false;layer.remove();if(b.dataset.direction==='back'){original.focus();return;}desiredDirection=b.dataset.direction;original.__directionArmed=true;original.click();};
 layer.addEventListener('keydown',e=>{const bs=[...layer.querySelectorAll('button')];if(e.key==='Escape')bs.at(-1).click();if(e.key==='Tab'){const i=bs.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();bs.at(-1).focus();}else if(!e.shiftKey&&i===bs.length-1){e.preventDefault();bs[0].focus();}}});layer.querySelector('button').focus();
}
export function installCasual(){
 document.documentElement.classList.add('casual');
 observer=new MutationObserver(schedule);const start=()=>{observer.observe(document.body,{childList:true,subtree:true,characterData:true});schedule();};if(document.body)start();else addEventListener('DOMContentLoaded',start,{once:true});
 document.addEventListener('click',e=>{
  const leave=e.target.closest('a[href="./"],a[href="advanced.html"]');
  if(leave&&window.__returnStorageFlush){
   e.preventDefault();e.stopImmediatePropagation();
   void (async()=>{try{if(await window.__returnStorageFlush()!==true)throw Error('save-unconfirmed');location.href=leave.href;}catch{let warning=$('#casual-navigation-warning');if(!warning){warning=el('p','c-warning','저장 완료를 확인하지 못해 이동하지 않았습니다. 기록·메뉴에서 현재 사본을 보관한 뒤 아래 저장 안내를 확인하세요.');warning.id='casual-navigation-warning';$('#casual-topbar')?.after(warning);warning.setAttribute('role','alert');}}})();return;
  }
  const menu=e.target.closest('[data-c-menu]');if(menu){mode=mode===menu.dataset.cMenu?'play':menu.dataset.cMenu;render();if(mode==='capital')$('#portfolio')?.scrollIntoView({block:'start'});if(mode==='records')$('#casual-record-menu')?.scrollIntoView({block:'start'});return;}
  const b=e.target.closest('button');if(!b)return;
  const v=window.__returnCasualRead?.();
  if(window.__returnCasualEdition!=='allocation'&&b.parentElement?.id==='choices'&&!v?.pending&&!b.disabled&&/이 뉴스에 대응해|리밸런싱 \(비중 조정\)/.test(b.dataset.cOriginal||b.textContent)&&!b.__directionArmed){
   e.preventDefault();e.stopImmediatePropagation();chooseDirection(b);return;
  }
  if(b.__directionArmed)delete b.__directionArmed;
  if(b.id==='order-execute'&&!b.disabled&&orderReview(b)){e.preventDefault();e.stopImmediatePropagation();return;}
  if((b.closest('#choices')||b.id==='cash-main-start')&&!b.disabled)focusNext=true;
  if(b.closest('#portfolio')&&!b.closest('.c-capital-nav')&&!b.disabled){mode='play';focusNext=true;}
  if(b.dataset.cOriginal&&/상품 선택/.test($('#turn-card h2')?.textContent||''))$('#choices').dataset.cProductName=b.dataset.cOriginal.split(' — ')[0];
  setTimeout(schedule,0);
 },true);
 document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);
}
