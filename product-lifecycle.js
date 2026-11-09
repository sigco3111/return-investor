(function(root){
'use strict';
function validDate(x){const d=typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)?new Date(x+'T00:00:00Z'):null;return !!d&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x;}
function inspect(product,observations,asOf){
 if(!product||!validDate(asOf)||!validDate(product.listedFrom))return {status:'invalid',reason:'입력 형식 확인 필요',quote:null};
 if(asOf<product.listedFrom)return {status:'not-listed',reason:'상장 전',quote:null};
 const visible=observations.filter(q=>q.instrument===product.id&&validDate(q.formedOn)&&validDate(q.usableFrom)&&q.formedOn<=q.usableFrom&&q.usableFrom<=asOf&&Number.isFinite(q.close)&&q.close>0&&q.currency===product.currency&&q.priceType==='market-close').sort((a,b)=>a.formedOn.localeCompare(b.formedOn)||a.usableFrom.localeCompare(b.usableFrom));
 if(!visible.length)return {status:'no-observation',reason:'현재일까지 공개를 확인한 상품 종가 없음',quote:null};
 const quote=visible[visible.length-1];
 if(quote.review!=='crosschecked')return {status:'candidate',reason:'단일 발행처 후보. 주문가격으로 채택하지 않음',quote};
 if(!validDate(product.coverageThrough)||asOf>product.coverageThrough)return {status:'coverage-gap',reason:'확인된 자료범위 밖. 과거 종가를 현재 거래가로 연장하지 않음',quote};
 if(quote.formedOn!==asOf)return {status:'stale-observation',reason:'현재 판단일의 종가가 아님. 과거 가격을 거래가로 연장하지 않음',quote};
 return {status:'observed',asOf,reason:'공개 게이트를 지난 과거 종가. 실제 당일 체결가 아님',quote};
}
function preview(product,market,budget,costs){
 const errors=[];if(!Number.isSafeInteger(budget)||budget<0)errors.push('예산은0이상 정수 원이어야 함');
 if(!market?.quote)errors.push('관측가격 없음');
 if(market?.status!=='observed')errors.push('주문용 자료 검증/범위 미충족');
 if(!Number.isSafeInteger(product?.lotSize)||product.lotSize<=0)errors.push('거래단위 미확인');
 const q=market?.quote;const lot=product?.lotSize;const indicativeQty=q&&Number.isSafeInteger(budget)&&budget>=0&&lot>0?Math.floor(budget/(q.close*lot))*lot:0;
 if(!indicativeQty)errors.push('한 거래단위에 못 미치는 예산');
 // Market prices already reflect ongoing fund expenses. Never deduct an annual fund expense a second time here.
 if(costs?.review!=='crosschecked'||!validDate(costs?.asOf)||costs.asOf!==market?.asOf||!validDate(costs?.validFrom)||!validDate(costs?.validThrough)||costs.validFrom>costs.asOf||costs.validThrough<costs.asOf||!Number.isFinite(costs?.brokerRate)||costs.brokerRate<0||costs.brokerRate>=1||!Number.isFinite(costs?.transactionTaxRate)||costs.transactionTaxRate<0||costs.transactionTaxRate>=1||!Number.isSafeInteger(costs?.fixedFee)||costs.fixedFee<0)errors.push('당시 증권사 매매비용·세금 미확인');
 let qty=indicativeQty,total=null,brokerFee=null,tax=null;
 if(!errors.length){const estimate=n=>{const gross=n*q.close,b=Math.ceil(gross*costs.brokerRate)+costs.fixedFee,t=Math.ceil(gross*costs.transactionTaxRate);return {gross,b,t,total:gross+b+t}};let lo=0,hi=qty/lot;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(estimate(mid*lot).total<=budget)lo=mid;else hi=mid-1;}qty=lo*lot;if(!qty)errors.push('비용 포함 한 거래단위 예산 부족');else{const v=estimate(qty);total=v.total;brokerFee=v.b;tax=v.t;}}
 return {canPreview:errors.length===0,indicativeQty,qty:errors.length?null:qty,indicativeGross:q?indicativeQty*q.close:null,total,brokerFee,tax,remainder:total===null?null:budget-total,errors};
}
const api={inspect,preview};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ReturnProductLifecycle=api;
})(typeof window==='undefined'?globalThis:window);
