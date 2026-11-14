// Included only in the isolated profile-start engine, never the preserved casual engine.
let profileDraft = null;
const PROFILE_RULES_ID = '__PROFILE_RULES_ID__';
window.__returnProfileSummary=()=>state.startProfile?structuredClone(Profile.plan(state.startProfile.input)):null;
function profileValid(){
 const tag=state.startProfile;
 if(!tag||tag.version!==1||tag.rulesId!==PROFILE_RULES_ID||Object.keys(tag).sort().join(',')!=='input,rulesId,version')return false;
 const p=Profile.plan(tag.input),b=state.flags.birth;
 return p.ok&&b&&b.year===Number(tag.input.birth.slice(0,4))&&b.month===Number(tag.input.birth.slice(5,7))&&b.day===Number(tag.input.birth.slice(8,10))&&b.hsYear===p.highYear&&state.schoolStart?.version===1&&state.schoolStart.startMonth===p.startMonth&&state.month>=p.startMonth&&state.month<='2026-11'&&state.assetReviewBaseline?.month===p.startMonth;
}
function profileInitialize(p){
 const i=p.input,f=state.flags,hs=i.education.startsWith('hs'),college=i.education.startsWith('college');
 state.startProfile={version:1,rulesId:PROFILE_RULES_ID,input:structuredClone(i)};
 f.birth={year:Number(i.birth.slice(0,4)),month:Number(i.birth.slice(5,7)),day:Number(i.birth.slice(8,10)),hsYear:p.highYear};
 f.lifeDone={hs1:true,acadPolicy:true,acadBoundaryHs3:!hs||p.startMonth>=p.highYear+2+'-03',admitResult:!hs,acadColPolicy:college,acadColY3:college&&p.academicMonths>=24,college:!hs&&!college};
 f.studyPath=hs?(i.work==='alba'?'parttime':'study'):i.education==='highGraduate'?'parttime':'study';
 state.academic={version:1,policy:i.work==='alba'?'balanced':'focus',effort:hs?p.hsElapsed*(i.work==='alba'?1:2):72};
 if(college){f.academicStatus='college';f.enrolledMonths=p.academicMonths;state.colPolicy=i.work==='alba'?'balanced':'focus';}
 else if(!hs){f.academicStatus='graduated';f.enrolledMonths=i.education==='graduate'?48:0;f.career=i.work==='job'?'job':'fulltime';if(i.work==='alba')f.recoveryJob='alba';}
 if(i.service==='none'){f.lifeDone.enlist=true;f.dischargeShown=true;}
 if(i.service==='pending'){f.enlistAt=p.serviceStart;}
 if(i.service==='done'){f.lifeDone.enlist=true;f.dischargeShown=true;f.militaryStart=p.serviceStart;}
 if(i.service==='serving'){f.lifeDone.enlist=true;f.militaryStart=p.serviceStart;f.militaryUntil=p.serviceEnd;}
 state.history.push({month:p.startMonth,decisionMonth:p.startMonth,choice:'profile-background-confirmed',backgroundOnly:true});
}
const profileBaseSave=save;
save=function(){if(profileDraft&&!state.startProfile)profileInitialize(profileDraft);return profileBaseSave();};
validSchoolStart=function(){return profileValid();};
const profileBaseHsYear=hsYear;
hsYear=function(y,m){if(profileDraft)return profileDraft.highYear;if(state.startProfile){const p=Profile.plan(state.startProfile.input);if(p.ok)return p.highYear;}return profileBaseHsYear(y,m);};
const profileBaseRender=render;
render=function(){if(state.flags.birth&&!profileValid())return showSaveConflict('새 시작 배경과 날짜·규칙 식별을 확인하지 못했습니다. 기존 저장을 바꾸지 않았습니다.','profile-start');return profileBaseRender();};
const profileBaseBirth=renderBirthSelect;
renderBirthSelect=function(){
 profileDraft=null;
 profileBaseBirth();
 const originalStart=document.getElementById('cash-main-start'),originalGo=originalStart.onclick,card=document.getElementById('turn-card'),choices=document.getElementById('choices');
 // Keep the original initializer privately in this closure; it remains the one
 // path that installs all existing economy, data and reservation identities.
 card.innerHTML='';choices.innerHTML='';document.getElementById('portfolio').innerHTML='';
 const title=document.createElement('h2');title.textContent='어떤 인물로 돌아갈까요';card.append(title);
 const desc=document.createElement('p');desc.textContent='생년월일과 시작할 때의 배경을 고르면, 그 상태와 투자 자료가 함께 맞는 첫 연월을 계산합니다.';card.append(desc);
 const form=document.createElement('form');form.id='profile-form';form.className='profile-form';form.noValidate=true;form.onsubmit=e=>e.preventDefault();card.append(form);
 const fields={};
 const field=(key,label,type,options)=>{const l=document.createElement('label');l.htmlFor='profile-'+key;l.textContent=label;const c=document.createElement(type==='select'?'select':'input');c.id='profile-'+key;c.name=key;if(type!=='select')c.type=type;else for(const[value,text]of options){const o=document.createElement('option');o.value=value;o.textContent=text;c.append(o);}l.append(c);form.append(l);fields[key]=c;return c;};
 field('birth','가상 주인공 생년월일','date').value='1980-03-01';fields.birth.min='1900-01-01';fields.birth.max='2010-12-31';
 field('education','시작할 때 학업','select',[['hs1','고1'],['hs2','고2'],['hs3','고3'],['college1','대학1학년'],['college2','대학2학년'],['college3','대학3학년'],['college4','대학4학년'],['graduate','대학 졸업'],['highGraduate','고교 졸업·대학 미진학']]);
 field('schoolDelay','취학 배경','select',[['0','당시 통상 진급 (빠른생일 반영)'],['1','취학1년 늦춤 [선택 배경]']]);
 field('service','복무 배경','select',[['pending','미필 · 입영 예정'],['done','군필'],['serving','복무 중'],['none','복무 해당 없음 [게임 배경]']]);
 field('work','시작할 때 시간·일','select',[['study','공부 중심'],['alba','학업+알바'],['job','취업'],['fulltime','전업 투자']]);
 const dates=document.createElement('details');dates.id='profile-dates';const ds=document.createElement('summary');ds.textContent='추천 이력 확인·수정';dates.append(ds);form.append(dates);
 for(const[key,label]of [['admission','대학 입학월'],['serviceStart','입영월 (26개월 게임 복무)'],['jobStart','취업 시작월']]){const c=field(key,label,'month');dates.append(c.parentElement);}
 const note=document.createElement('p');note.className='c-core-note';note.textContent='실제 이력·법적 나이·입시·병역 자격을 판정하지 않는 게임 배경입니다. 생년월일은 이 기기 저장에만 씁니다. 당시 미성년 계좌·보호자 동의 조건은 재현하지 않은 투자 모형입니다.';form.append(note);
 const result=document.createElement('section');result.id='profile-result';result.setAttribute('aria-live','polite');card.append(result);
 const review=document.createElement('button');review.type='button';review.id='profile-review';review.textContent='시작 날짜와 자금 확인';choices.append(review);
 const link=document.createElement('p');link.className='note';link.innerHTML='<a href="casual.html?edition=legacy">이전 캐주얼 저장·고1 시작</a> · <a href="advanced.html">어드밴스</a>';card.append(link);
 let input=Profile.defaults(),approved=null;
 function read(){return {version:Profile.PROFILE_VERSION,...Object.fromEntries(Object.entries(fields).map(([k,c])=>[k,k==='schoolDelay'?Number(c.value):c.value]))};}
 function refresh(recommend=false){
  if(recommend){const d=Profile.defaults(fields.birth.value,fields.education.value,fields.service.value),h=Profile.nominalHigh(fields.birth.value,Number(fields.schoolDelay.value));d.admission=(h+3)+'-03';d.serviceStart=(h+(fields.education.value.startsWith('hs')?3:5))+'-08';if(fields.service.value==='done'){d.serviceStart=(h+3)+'-03';d.admission=Profile.add(d.serviceStart,26);}if(fields.education.value==='graduate'&&fields.service.value==='pending')d.serviceStart=Profile.add(d.admission,53);d.jobStart=fields.education.value==='graduate'?Profile.add(d.admission,48):(h+3)+'-03';if(fields.service.value==='done'&&d.jobStart<Profile.add(d.serviceStart,26))d.jobStart=Profile.add(d.serviceStart,26);for(const k of ['admission','serviceStart','jobStart'])fields[k].value=d[k];}
  const student=/^(hs|college)/.test(fields.education.value);
  for(const o of fields.work.options){o.disabled=student?!['study','alba'].includes(o.value):o.value==='study';if(o.value==='alba')o.textContent=student?'학업+알바':'알바';}
  if([...fields.work.options].find(o=>o.value===fields.work.value)?.disabled)fields.work.value=student?'study':'job';
  fields.admission.parentElement.hidden=!/^(college|graduate)/.test(fields.education.value);
  fields.serviceStart.parentElement.hidden=fields.service.value==='none';
  fields.jobStart.parentElement.hidden=fields.work.value!=='job';
  dates.open=!fields.education.value.startsWith('hs');
  input=read();const p=Profile.plan(input);approved=null;review.textContent='시작 날짜와 자금 확인';review.disabled=!p.ok;
  result.replaceChildren();const h=document.createElement('h3');h.textContent=p.ok?'추천 시작 '+p.startMonth:'이 조합은 확인이 필요합니다';result.append(h);
  const text=document.createElement('p');text.textContent=p.ok?`월초 기준 만${p.ageAtMonthStart}세 · ${fields.education.selectedOptions[0].textContent} · ${fields.service.selectedOptions[0].textContent} · ${fields.work.selectedOptions[0].textContent}`:p.message;result.append(text);
  if(!p.ok){const ul=document.createElement('ul');for(const a of p.alternatives||[]){const li=document.createElement('li');li.textContent=a;ul.append(li);}result.append(ul);result.setAttribute('role','alert');}else result.removeAttribute('role');
 }
 for(const[k,c]of Object.entries(fields))c.addEventListener('change',()=>refresh(['birth','education','schoolDelay','service'].includes(k)));
 for(const k of ['admission','serviceStart','jobStart'])fields[k].value=input[k];refresh(true);
 review.onclick=()=>{
  const p=Profile.plan(read());if(!p.ok){refresh();return;}
  if(!approved){
   approved=p;form.hidden=true;desc.hidden=true;title.textContent='시작 배경을 확인하세요';const box=document.createElement('div');box.id='profile-summary';const edit=document.createElement('button');edit.type='button';edit.id='profile-edit';edit.textContent='배경 다시 고르기';edit.onclick=()=>{form.hidden=false;desc.hidden=false;title.textContent='어떤 인물로 돌아갈까요';refresh();};box.append(edit);
   const list=[['시작',p.startMonth+' · '+p.input.birth+' 출생'],['학업',fields.education.selectedOptions[0].textContent+(p.input.education.startsWith('college')?' · 배경 재학진척 '+p.academicMonths+'개월':'')],['복무',fields.service.selectedOptions[0].textContent+(p.input.service!=='none'?' · '+p.serviceStart+'~'+p.serviceEnd:'')],['일·시간',fields.work.selectedOptions[0].textContent],['시작 현금','1,000,000원'],['다음 월부터 수입',p.income.toLocaleString()+'원/월'],['다음 월부터 생활비',p.living.toLocaleString()+'원/월'],['학비',p.tuition?'재학 중3·9월 900,000원 (다음 해당월부터)':'현재 배경 0원'],['첫 현금사건',p.firstCashMonth+' · 시작월 급여·학비 청구 없음'],['첫 투자','시작월의 판단 화면부터 예금·국내지수 모형 선택 가능. 취업은 분기 검토, 알바는 월1회, 복무는 매수비중30% 상한. 실제 체결가는 이후 적격 관측에 따름']];
   const dl=document.createElement('dl');for(const[k,v]of list){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;dl.append(dt,dd);}box.append(dl);
   const n=document.createElement('p');n.className='c-core-note';n.textContent='금액·학제·복무는 게임 가정입니다. 과거 월급·저축·이자·학비를 소급하지 않으며, 재학진척·학업노력은 선택한 배경의 시작값이지 과거 플레이기록이 아닙니다. 기존 저장과 어드밴스은 바꾸지 않고 새 저장영역에 시작합니다.';box.append(n);
   const label=document.createElement('label'),consent=document.createElement('input');consent.type='checkbox';consent.id='profile-consent';review.disabled=true;consent.onchange=()=>{review.disabled=!consent.checked;};label.append(consent,document.createTextNode('이 시작 날짜·배경·금액과 게임 가정을 확인했습니다.'));box.append(label);if(p.input.service==='serving'){const after=document.createElement('p');after.className='c-core-note';after.textContent='전역 예정 '+p.serviceEnd+'부터 학생은 생활비0원, 성인은70만원/월로 돌아갑니다. 선택한 알바 수입도 전역 후 재개됩니다.';box.append(after);}result.append(box);review.textContent='확인한 배경으로 새 회귀 시작';box.scrollIntoView({block:'start'});return;
  }
  if(!document.getElementById('profile-consent')?.checked)return;
  if(JSON.stringify(p)!==JSON.stringify(approved)){refresh();return;}
  profileDraft=p;
  // The original initializer reads only these detached, explicitly selected fields.
  const hidden=document.createElement('div');hidden.hidden=true;hidden.innerHTML='<input id="by"><input id="bm"><input type="checkbox" id="school-consent">';card.append(hidden);hidden.querySelector('#by').value=Number(p.input.birth.slice(0,4));hidden.querySelector('#bm').value=Number(p.input.birth.slice(5,7));hidden.querySelector('#school-consent').checked=true;
  originalGo();
 };
};
