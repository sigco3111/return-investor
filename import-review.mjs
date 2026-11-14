import {stageSlotLocked,returnToOriginal,POINTER_KEY} from './import-atomic-slot.mjs';
import {prepareValues} from './import-prepare-values.mjs';
import {preflightCopy} from './import-preflight.mjs';
import {validateEngineInIsolation} from './import-isolated-validation.mjs';
const file=document.querySelector('#copy'),check=document.querySelector('#check'),status=document.querySelector('#status'),result=document.querySelector('#result');let revision=0,approved=null;const confirm=document.querySelector('#confirm'),apply=document.querySelector('#apply'),applyStatus=document.querySelector('#apply-status'),play=document.querySelector('#play'),original=document.querySelector('#original');const supportsLocks=typeof navigator.locks?.request==='function';original.disabled=!supportsLocks||localStorage.getItem(POINTER_KEY)===null;if(!supportsLocks)document.querySelector('#original-status').textContent=localStorage.getItem(POINTER_KEY)===null?'이 브라우저에서는 가져오기·공간 전환을 지원하지 않습니다. 원래 저장 공간의 게임은 계속 사용할 수 있습니다.':'이 브라우저에서는 가져온 공간의 게임·공간 전환을 지원하지 않습니다. 저장을 바꾸지 않았습니다. 안전 잠금을 지원하는 브라우저에서 열어 주세요.';
file.addEventListener('change',()=>{revision++;approved=null;confirm.disabled=true;confirm.checked=false;apply.disabled=true;play.hidden=true;result.replaceChildren();check.disabled=!file.files.length;status.textContent=file.files.length?'선택했습니다. 검사 전에는 파일을 읽지 않습니다.':'파일을 선택해 주세요.'});
const friendly={ 'copy-archive-would-summarize':'이 사본은 이전 완료 회귀의 상세를 자동 요약할 수 있어 적용하지 않습니다. 원본 파일을 보존합니다.', 'copy-archive-rewrite-required':'완료 기록 원문을 다시 작성해야 하는 사본이라 적용하지 않습니다. 원문을 바꾸지 않습니다.', 'active-required-for-first-import':'현재 후보는 진행 중인 회귀가 포함된 사본을 검사합니다. 완료 기록만 있는 사본은 아직 적용할 수 없습니다.',  'copy-data-pin-unknown':'이 사본의 뉴스·시세 묶음을 확인할 수 없어 멈췄습니다. 다른 자료로 자동 대체하지 않습니다.', 'copy-context-missing':'진행 당시 자료 식별 기록이 없어 멈췄습니다. 원문을 추정 변환하지 않습니다.', 'copy-size-or-type':'지원하는 크기와 형식의 JSON 사본인지 확인해 주세요.', 'copy-fixed-data-mismatch':'이 실행본과 다른 필수 자료 기록이 있어 멈췄습니다.' };
check.addEventListener('click',async()=>{
approved=null;confirm.disabled=true;confirm.checked=false;apply.disabled=true;const current=++revision;const selected=file.files[0];if(!selected)return;check.disabled=true;play.hidden=true;applyStatus.textContent='';result.replaceChildren();status.textContent='사본 형식을 확인하고 있습니다. 저장은 바꾸지 않습니다.';
try{
if(selected.size>2_000_000)throw Error('copy-size-or-type');const expectedPointerRaw=localStorage.getItem(POINTER_KEY);const text=await selected.text();const manifest=await(await fetch('import-manifest.json')).json();const parsed=preflightCopy(text,manifest);
if(parsed.activeSaveRaw===null)throw Error('active-required-for-first-import');
status.textContent='원래 저장과 분리된 곳에서 게임 시작 검사를 하고 있습니다.';
const zip=await(await fetch('news-data-gen143.json.gz')).arrayBuffer();const code=await(await fetch('import-validator.js')).text();
const validation=await validateEngineInIsolation({...parsed,payloadGzip:zip,engineCode:code});if(current!==revision)return;
if(!validation.ok||validation.writesAttempted!==0||!validation.activeExact||!validation.archiveExact)throw Error(validation.reason||'engine-validation-failed');
approved={parsed,expectedPointerRaw,revision:current};confirm.disabled=!supportsLocks;const h=document.createElement('h2');h.textContent='사본의 게임 시작 검사 통과';const dl=document.createElement('dl');for(const[name,value]of[['진행월',parsed.currentMonth],['완료 회귀',parsed.completedLives+'건'],['검사 범위','형식·자료 묶음·게임 시작'],['저장 변경','없음']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;dl.append(dt,dd)}const caution=document.createElement('p');caution.className='warning';caution.textContent='아직 적용한 것이 아닙니다. 아래에서 별도로 확인하면 원래 저장을 그대로 두고 새 공간에 적용합니다. 이후 플레이 전체를 보장하지 않으므로 원본 파일을 보관해 주세요.';result.append(h,dl,caution);status.textContent=supportsLocks?'검사만 마쳤습니다. 원래 저장은 바꾸지 않았습니다.':'검사는 마쳤지만 이 브라우저는 안전 잠금이 없어 적용하지 않습니다. 원래 공간 게임은 계속 사용할 수 있습니다.';
}catch(e){if(current!==revision)return;status.textContent='검사를 중단했습니다. '+(friendly[e.message]||e.message)+' 원래 저장과 사본은 바꾸지 않았습니다.';}finally{if(current===revision)check.disabled=!file.files.length;}
});

confirm.addEventListener('change',()=>apply.disabled=!confirm.checked||!approved);
const effectError=e=>e.message==='slot-game-open-in-another-tab'?'다른 탭에서 게임이 열려 있습니다. 해당 탭을 닫은 뒤 다시 확인해 주세요.':e.message==='slot-concurrent-change'?'다른 탭에서 선택이 바뀌었습니다. 사본을 다시 검사해 주세요.':'저장 적용을 확인하지 못했습니다. 원래 저장과 원본 파일은 보관됩니다. 새로 열어 선택한 공간을 확인해 주세요.';
apply.addEventListener('click',async()=>{
 const a=approved;if(!a||a.revision!==revision||!confirm.checked)return;apply.disabled=true;check.disabled=true;file.disabled=true;confirm.disabled=true;
 try{applyStatus.textContent='별도 공간을 준비하고 대조하고 있습니다.';const values=await prepareValues(a.parsed);await stageSlotLocked(localStorage,{id:'import-'+crypto.randomUUID(),values,expectedPointerRaw:a.expectedPointerRaw},navigator.locks);status.textContent='아래에서 별도 공간 적용을 확인했습니다. 원래 저장은 그대로입니다.';applyStatus.textContent='별도 공간 적용을 확인했습니다. 원래 저장은 그대로입니다. 아래에서 게임을 열 수 있습니다.';play.hidden=false;original.disabled=false;approved=null;}
 catch(e){applyStatus.textContent=effectError(e);}
 finally{check.disabled=false;file.disabled=false;}
});
original.addEventListener('click',async()=>{
 original.disabled=true;const expected=localStorage.getItem(POINTER_KEY);try{await returnToOriginal(localStorage,expected,navigator.locks);status.textContent='원래 저장 공간을 선택했습니다.';applyStatus.textContent='';document.querySelector('#original-status').textContent='원래 저장 공간을 선택했습니다. 가져온 기록은 지우지 않았습니다.';play.hidden=false;approved=null;apply.disabled=true;confirm.disabled=true;confirm.checked=false;}catch(e){document.querySelector('#original-status').textContent=effectError(e);original.disabled=false;}
});
