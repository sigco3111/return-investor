// Select the saved edition before either engine touches a save. Never copy or migrate.
(()=>{
 const params=new URLSearchParams(location.search),requested=params.get('edition');
 try{
  const prefixHasState=prefix=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(prefix)){const v=localStorage.getItem(k);if(v!==null&&v!=='null')return true;}}return false;};
  const hasNew=prefixHasState('return-casual.v2.'),hasOld=prefixHasState('return-casual.v1.');
  const edition=requested==='legacy'?'legacy':requested==='profile'?'profile':hasNew?'profile':hasOld?'legacy':'profile';
  window.__returnCasualEdition=edition;
  const engine=document.createElement('script');engine.src=edition==='profile'?'3-casual.js':'2-casual.js';
  engine.onload=()=>{const ui=document.createElement('script');ui.src='2-casual-ui.js';document.body.append(ui);};
  engine.onerror=()=>{document.getElementById('root').textContent='게임 실행 파일을 받지 못했습니다. 저장은 바꾸지 않았습니다. 연결 상태를 확인하고 다시 열어 주세요.'};
  document.body.append(engine);
 }catch(e){const root=document.getElementById('root');root.textContent='저장영역을 확인하지 못해 시작하지 않았습니다. 저장은 바꾸지 않았습니다. 브라우저의 저장 허용을 확인한 뒤 다시 열어 주세요.';}
})();
