import {encodeSave,decodeSave,chunkString,utf8Bytes} from './26-save-codec.mjs';
export async function prepareValues({activeSaveRaw,completedLivesRaw}) {
 const enc=await encodeSave(activeSaveRaw);
 if(await decodeSave(enc.enc,enc.data)!==activeSaveRaw)throw Error('import-active-roundtrip');
 const parts=chunkString(enc.data,12000);if(!parts.length||parts.length>6)throw Error('import-active-size');
 const values={'return-save.v2.cur':JSON.stringify('a')};
 for(const g of ['a','b']){values['return-save.v2.'+g+'.idx']=JSON.stringify(g==='a'?JSON.stringify({v:2,parts:parts.length,enc:enc.enc,src:activeSaveRaw.length}):null);for(let i=0;i<6;i++)values['return-save.v2.'+g+'.p'+i]=JSON.stringify(g==='a'&&i<parts.length?parts[i]:null)}
 for(const k of ['return-save.v1.idx',...Array.from({length:4},(_,i)=>'return-save.v1.p'+i),'return-lives.v2','return-lives.v3.cur','return-lives.v3.a','return-lives.v3.b','return-lives.v4.cur','return-lives.v4.a','return-lives.v4.b'])values[k]='null';
 if(completedLivesRaw!==null){const e=await encodeSave(completedLivesRaw);if(await decodeSave(e.enc,e.data)!==completedLivesRaw)throw Error('import-archive-roundtrip');const packed=JSON.stringify({v:4,enc:e.enc,src:utf8Bytes(completedLivesRaw),data:e.data});if(utf8Bytes(JSON.stringify(packed))>15360)throw Error('import-archive-size');values['return-lives.v4.cur']=JSON.stringify('a');values['return-lives.v4.a']=JSON.stringify(packed)}
 if(Object.values(values).reduce((n,s)=>n+utf8Bytes(s),1024)>64500)throw Error('import-total-size');
 return values;
}
