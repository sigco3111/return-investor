const a=require('assert'),p=require('./economy-policy');
const good={month:'1996-03',cash:1000000,chaos:0,holdings:{},flags:{},history:[],unlocksSeen:[],eventIndex:0,turnCount:0};
a.deepEqual(p.inspectRaw(null),{ok:true,exists:false,state:null});a(p.inspectRaw(JSON.stringify(good)).ok);
const fixtures=['','{','null','false','0','[]','{}',JSON.stringify({...good,month:'1996-13'}),JSON.stringify({...good,cash:'1000000'}),JSON.stringify({...good,flags:[]}),JSON.stringify({...good,history:null}),JSON.stringify({...good,eventIndex:-1}),
// 정상 경로 불변조건(현금·카오스 >= 0)을 깬 손상 저장은 거부. 납부는 cash>=cost 확인, 매수는 현금 비중 잠금, 카오스는 비음수 항 누적+Math.max(0,·) 클램프라 정상 경로에서는 음수 불가.
JSON.stringify({...good,cash:-1}),JSON.stringify({...good,cash:-5e9}),JSON.stringify({...good,chaos:-1}),JSON.stringify({...good,chaos:-0.5})];
for(const raw of fixtures){const before=raw;a.equal(p.inspectRaw(raw).ok,false);a.equal(raw,before)}
// 정상 데이터 보존: 0·부동소수 합산·유한 대값은 거부하지 않음(임의 상한·정수 규칙 추가 금지 원칙)
for(const c of [0,0.1+0.2,1e300,7777777777])a(p.inspectRaw(JSON.stringify({...good,cash:c})).ok,'normal cash accepted: '+c);
a(p.inspectRaw(JSON.stringify({...good,chaos:0})).ok);
console.log(JSON.stringify({syntheticCoreChecks:23,completeGameSchemaValidation:false,inputUnchanged:true,negativeCashChaosRejected:true,normalValuesPreserved:true}));
