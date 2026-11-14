// Pure instantaneous allocation planning. No clocks, storage, fills or mutation.
export const ALLOCATION_VERSION='allocation-instant-v1';
export function planAllocation(s,targets){
 const fail=(code,message)=>({ok:false,code,message});
 if(!s||!Array.isArray(s.rows)||!Number.isSafeInteger(s.cash)||s.cash<0||!s.rows.every(r=>r&&typeof r.id==='string'&&Number.isSafeInteger(r.value)&&r.value>=0))return fail('shape','자산 구성을 확인하지 못했습니다.');
 const ids=s.rows.map(r=>r.id);if(new Set(ids).size!==ids.length||!targets||Object.keys(targets).some(id=>!ids.includes(id)))return fail('shape','상품 구성을 다시 확인하세요.');
 const base=s.cash+s.rows.reduce((a,r)=>a+r.value,0);if(!Number.isSafeInteger(base))return fail('shape','배분 기준 금액을 확인하지 못했습니다.');
 const lines=[];let buys=0,sales=0,targetSum=0;
 for(const r of s.rows){
  const t=Object.hasOwn(targets,r.id)?targets[r.id]:r.value;
  if(!Number.isSafeInteger(t)||t<0)return fail('target','목표 금액은0원 이상의 원 단위여야 합니다.');
  targetSum+=t;
  const delta=t-r.value;if(delta===0)continue;
  if(!r.available)return fail('unavailable',r.name+' · '+(r.reason||'지금 거래할 수 없습니다.'));
  const kind=delta>0?'buy':'sell',amount=Math.abs(delta);
  if(kind==='sell'&&amount>r.value)return fail('holding','잠기지 않은 보유보다 많이 팔 수 없습니다.');
  if(kind==='buy')buys+=amount;else sales+=amount;
  lines.push({id:r.id,name:r.name,rule:r.rule,kind,amount,from:r.value,target:t});
 }
 if(targetSum>base)return fail('over','목표 합계가 배분 자산보다 '+(targetSum-base).toLocaleString('ko-KR')+'원 많습니다. 비중을 줄이세요.');
 if(!lines.length)return fail('unchanged','바뀐 배분이 없습니다.');
 if(!s.allowed)return fail('access',s.reason||'지금 투자 판단을 할 수 없습니다.');
 if(buys>0&&s.unpaid>0)return fail('unpaid','미납 '+s.unpaid.toLocaleString('ko-KR')+'원 상환 전에는 매수할 수 없습니다. 매도·해지만 남기거나 먼저 상환하세요.');
 const resources=s.cash+sales;
 if(buys>resources)return fail('cash','지금 매수 재원이 '+(buys-resources).toLocaleString('ko-KR')+'원 부족합니다.');
 const buyCap=Math.min(s.buyCap??Infinity,s.military?Math.floor(resources*0.3):Infinity);
 if(buys>buyCap)return fail('cap','이번 묶음 매수 상한 '+buyCap.toLocaleString('ko-KR')+'원을 넘었습니다. 복무 중에는 매도 후 사용 가능한 현금의30%까지만 새로 배분합니다.');
 return {ok:true,version:ALLOCATION_VERSION,base,lines,buys,sales,cashAfter:resources-buys,targetCash:base-targetSum};
}
