// Fixed game-background planner. Dates describe a fictional character, not legal eligibility.
export const PROFILE_VERSION = 'background-start-v1';
export const MIN_START='1996-03',MAX_START='2026-10';
export const monthOK=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
export const mi=x=>Number(x.slice(0,4))*12+Number(x.slice(5,7))-1;
export const ym=n=>`${Math.floor(n/12)}`.padStart(4,'0')+'-'+String(n%12+1).padStart(2,'0');
export const add=(m,n)=>ym(mi(m)+n);
export function birthParts(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const [year,month,day]=s.split('-').map(Number),d=new Date(Date.UTC(year,month-1,day));
 return year>=1900&&year<=2010&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?{year,month,day}:null;
}
export function nominalHigh(birth,delay=0){const b=birthParts(birth);return b?b.year+(b.year<=2002&&b.month<=2?15:16)+delay:null;}
export function defaults(birth='1980-03-01',education='hs1',service='pending'){
 const h=nominalHigh(birth),hsEnd=(h+3)+'-03';
 const serviceStart=(education.startsWith('hs')?h+3:h+5)+'-08';
 return {version:PROFILE_VERSION,birth,education,schoolDelay:0,service,serviceStart,admission:hsEnd,work:education.startsWith('hs')||education.startsWith('college')?'study':'job',jobStart:add(hsEnd,education==='graduate'?48:0)};
}
export function plan(input){
 const fail=(code,message,alternatives=[])=>({ok:false,code,message,alternatives});
 if(!input||input.version!==PROFILE_VERSION)return fail('version','시작 배경의 규칙을 확인하지 못했습니다.');
 const b=birthParts(input.birth);if(!b)return fail('birth','1900~2010년의 실제로 존재하는 생년월일을 입력하세요.');
 if(!['hs1','hs2','hs3','college1','college2','college3','college4','graduate','highGraduate'].includes(input.education))return fail('education','학업 배경을 선택하세요.');
 if(![0,1].includes(input.schoolDelay))return fail('delay','취학 지연은 기본 또는1년 늦춤을 선택하세요.');
 if(!['none','pending','done','serving'].includes(input.service))return fail('service','복무 배경을 선택하세요.');
 if(!['study','alba','job','fulltime'].includes(input.work))return fail('work','시간 배분·직업을 선택하세요.');
 const highYear=nominalHigh(input.birth,input.schoolDelay),highStart=highYear+'-03',highEnd=(highYear+3)+'-03';
 const hs=input.education.startsWith('hs'),college=input.education.startsWith('college'),degree=input.education==='graduate';
 if(hs&&['done','serving'].includes(input.service))return fail('hs-service','고교 재학과 군필·현재 복무를 함께 시작하는 배경은 지원하지 않습니다.',['복무를 미필 또는 해당 없음으로 변경','학업 배경 다시 선택']);
 if((hs||college)&&!['study','alba'].includes(input.work))return fail('student-work','재학 배경은 공부 중심 또는 학업+알바로 시작합니다. 취업·전업은 졸업 배경에서 고르세요.');
 if(!hs&&!college&&input.work==='study')return fail('adult-work','졸업 배경의 직업은 취업·알바·전업 중에서 고르세요.');
 if(input.service==='serving'&&input.work==='job')return fail('serving-job','현재 복무와 취업 근무를 동시에 시작하지 않습니다. 졸업·전업 배경으로 복무 후 진로를 선택할 수 있습니다.');
 const hasService=input.service!=='none';
 if(hasService&&(!monthOK(input.serviceStart)||input.serviceStart<highEnd||input.serviceStart>'2026-10'))return fail('service-date','입영월은 고교 졸업 이후부터2026-10까지의 게임 배경 일정으로 정하세요.');
 const serviceStart=hasService?input.serviceStart:null,serviceEnd=hasService?add(serviceStart,26):null;
 if((college||degree)&&(!monthOK(input.admission)||input.admission<highEnd||input.admission>MAX_START))return fail('admission','대학 입학월은 고교 졸업 이후부터2026-10까지로 정하세요.');
 const admission=college||degree?input.admission:null;
 const progress=m=>{
  if(!admission||m<admission)return 0;
  const span=mi(m)-mi(admission),paused=hasService?Math.max(0,Math.min(mi(m),mi(serviceEnd))-Math.max(mi(admission),mi(serviceStart))):0;
  return Math.max(0,span-paused);
 };
 let graduation=highEnd;
 if(degree||college){graduation=null;for(let x=mi(admission);x<=mi(MAX_START)+100;x++){if(progress(ym(x))>=48){graduation=ym(x);break;}}}
 if(input.work==='job'&&(!monthOK(input.jobStart)||input.jobStart<(degree?graduation:highEnd)||input.jobStart>MAX_START))return fail('job-date','취업월은 선택한 학업을 마친 뒤부터2026-10까지로 정하세요.');
 if(input.work==='job'&&hasService&&input.jobStart>=serviceStart&&input.jobStart<serviceEnd)return fail('job-service','취업월이 복무 기간 안에 있습니다. 취업월 또는 복무 일정을 수정하세요.');
 let targetFrom,targetTo;
 if(hs){targetFrom=add(highStart,(Number(input.education.slice(2))-1)*12);targetTo=add(targetFrom,11);}
 let candidate=null;
 for(let n=mi(MIN_START);n<=mi(MAX_START);n++){
  const m=ym(n);if(m+'-01'<input.birth)continue;
  if(hs&&(m<targetFrom||m>targetTo))continue;
  if(college){const e=progress(m),lower=(Number(input.education.slice(7))-1)*12;if(m<admission||e<lower||e>=lower+12)continue;}
  if(degree&&m<graduation)continue;
  if(input.education==='highGraduate'&&m<highEnd)continue;
  if(hasService){if(input.service==='pending'&&m>=serviceStart)continue;if(input.service==='done'&&m<serviceEnd)continue;if(input.service==='serving'&&(m<serviceStart||m>=serviceEnd))continue;}
  if(input.work==='job'&&(m<input.jobStart||![3,6,9,12].includes(Number(m.slice(5)))))continue;
  candidate=m;break;
 }
 if(!candidate){const msg=hs?`선택한 고${input.education.slice(2)} 기간은 ${targetFrom}~${targetTo}입니다. 자료가 있는 ${MIN_START}~${MAX_START} 및 복무 배경과 겹치지 않습니다.`:'선택한 학업·복무·직업 상태가 함께 성립하는 달이1996-03~2026-10 안에 없습니다.';return fail('no-overlap',msg,hs?['학년을 다시 선택','취학1년 늦춤을 명시적으로 선택','다른 생년월일 선택']:['입학·입영·취업 일정을 확인','학업·복무 배경 다시 선택']);}
 const serving=input.service==='serving',student=hs||college;
 const income=serving?0:input.work==='job'?1500000:input.work==='alba'?200000:0;
 const living=serving?100000:student?0:700000,tuition=college&&!serving?900000:0;
 const age=Number(candidate.slice(0,4))-b.year-((candidate.slice(5)+'-01')<input.birth.slice(5)?1:0);
 return {ok:true,version:PROFILE_VERSION,input:{...input},startMonth:candidate,highYear,highStart,highEnd,graduation,serviceStart,serviceEnd,academicMonths:college?progress(candidate):degree?48:0,hsElapsed:hs?mi(candidate)-mi(highStart):0,ageAtMonthStart:age,income,living,tuition,startCash:1000000,firstCashMonth:add(candidate,1),student,serving,minor:age<20};
}
