const a=require('assert'),fs=require('fs'),path=require('path'),{inspect,preview}=require('./product-lifecycle');let n=0;function test(name,fn){fn();n++;console.log('ok',name)}
// All data below is synthetic. It establishes calculator behavior, not adoption of real historical observations/costs.
const product={id:'fixture',currency:'KRW',listedFrom:'2002-10-14',lotSize:10,coverageThrough:'2002-10-15'},q={instrument:'fixture',formedOn:'2002-10-15',usableFrom:'2002-10-15',priceType:'market-close',currency:'KRW',close:100,review:'crosschecked'},costs={asOf:'2002-10-15',validFrom:'2002-10-14',validThrough:'2002-10-15',review:'crosschecked',brokerRate:0.001,transactionTaxRate:0,fixedFee:0},m=inspect(product,[q],'2002-10-15');
test('資料範圍外 no stale carryforward',()=>a.equal(inspect(product,[q],'2002-10-16').status,'coverage-gap'));
test('당일아닌종가차단',()=>a.equal(inspect({...product,coverageThrough:'2002-10-16'},[q],'2002-10-16').status,'stale-observation'));
test('예산과비용경계',()=>{a.equal(preview(product,m,1000,costs).qty,null);const v=preview(product,m,1001,costs);a.equal(v.qty,10);a.equal(v.total,1001);a.equal(v.remainder,0);a.equal(v.tax,0)});
test('수량단위내림과비용전후',()=>{a.equal(preview(product,m,2000,costs).qty,10);a.equal(preview(product,m,2002,costs).qty,20)});
test('비용기간과판단일불일치',()=>{a(!preview(product,m,2002,{...costs,asOf:'2002-10-14'}).canPreview);a(!preview(product,m,2002,{...costs,validThrough:'2002-10-14'}).canPreview);a(!preview(product,m,2002,{...costs,validFrom:'2002-10-16'}).canPreview)});
test('unknown costs not zero',()=>a(!preview(product,m,2002,{...costs,brokerRate:null}).canPreview));
test('annual fund fee not deducted twice',()=>{a.deepEqual(preview(product,m,2002,costs),preview(product,m,2002,{...costs,annualFundExpenseRate:0.0068}))});
test('미래/상품/통화/종류/비정상값격리',()=>{for(const mod of [{usableFrom:'2002-10-16'},{instrument:'other'},{currency:'USD'},{priceType:'NAV'},{close:NaN},{formedOn:'2002-10-16'}])a.equal(inspect(product,[{...q,...mod}],'2002-10-15').quote,null)});
test('잘못된날짜에예외없는차단',()=>{for(const dt of ['2002-13-15','2002-02-30','blah'])a.equal(inspect(product,[q],dt).status,'invalid')});
test('잘못된예산및단위',()=>{for(const b of [-1,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1])a(!preview(product,m,b,costs).canPreview);a(!preview({...product,lotSize:0},m,2002,costs).canPreview)});
test('입력불변및저장접근없음',()=>{const d={product,observations:[q]},before=JSON.stringify(d);inspect(d.product,d.observations,'2002-10-15');a.equal(JSON.stringify(d),before);const text=fs.readFileSync(path.join(__dirname,'product-lifecycle.js'),'utf8');a(!text.includes('localStorage'));a(!text.includes('sessionStorage'))});
test('큰예산도유한시간단위계산',()=>a(preview(product,m,Number.MAX_SAFE_INTEGER-1,costs).qty>0));
console.log('상품 계산 합성검사',n);
