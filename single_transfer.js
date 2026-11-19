(function(root){'use strict';
const C=typeof module!=='undefined'?require('./single_work_core.js'):root.SingleWork;
const copy=x=>JSON.parse(JSON.stringify(x)),equal=(a,b)=>canonical(a)===canonical(b);
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
function check(ok,message){if(!ok)throw Error(message);}
function fields(x,allowed){check(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>allowed.includes(k)),'許可されない項目があります');}
function empty(){return {format:'ry-receipt-ledger-v1',records:[]};}
function filename(e){return 'RY_'+(e.type==='instruction'?'指示':'結果')+'_'+e.receiptId+'_'+e.code+'.json';}
function envelope(e,type){fields(e,['format','type','receiptId','code','assignee','issuedAt','exportedAt','payload']);check(e.format==='ry-transfer-v1'&&e.type===type,'指示と結果の種類が違います');check(/^\d{8}_\d{4,}$/.test(e.receiptId)&&/^[A-E]\d+(?:_\d+)*$/.test(e.code)&&['A','B'].includes(e.assignee),'受付番号・管理番号・担当者が不正です');check(Number.isFinite(Date.parse(e.issuedAt))&&Number.isFinite(Date.parse(e.exportedAt)),'日時が不正です');C.validate(e.payload);return e;}
function issue(ledger,state,jobId,assignee,now){
check(ledger.format==='ry-receipt-ledger-v1'&&Array.isArray(ledger.records),'受付台帳が不正です');check(['A','B'].includes(assignee),'担当者を選んでください');
const s=C.validate(state),job=s.jobs.find(j=>j.id===jobId);check(job&&job.status==='pending','未実施の確定指示が必要です');const reason=C.why(s,job.spec,now);check(!reason,reason);
check(!ledger.records.some(r=>r.instruction.payload.jobs[0].id===jobId),'同じ指示は既に受付済みです');
check(!ledger.records.some(r=>r.phase!=='過去'&&r.productId===job.spec.productId),'同じ商品の受付が残っています。二人へ重複配布しません');
const day=C.date(now).replace(/-/g,''),seq=Math.max(0,...ledger.records.filter(r=>r.instruction.receiptId.startsWith(day+'_')).map(r=>Number(r.instruction.receiptId.split('_')[1])))+1;
const payload=C.empty();payload.source=s.source;payload.catalog=s.catalog.filter(c=>c.shopItemId===job.spec.productId&&c.code===job.spec.code);payload.jobs=[copy(job)];if(s.rounds[jobId])payload.rounds[jobId]=s.rounds[jobId];
const e={format:'ry-transfer-v1',type:'instruction',receiptId:day+'_'+String(seq).padStart(4,'0'),code:job.spec.code,assignee,issuedAt:new Date(now).toISOString(),exportedAt:new Date(now).toISOString(),payload:C.validate(payload)};envelope(e,'instruction');
const next=copy(ledger);next.records.push({instruction:e,productId:job.spec.productId,phase:'指示済み',lastReceivedAt:null,reportedStatus:null,result:null});return {ledger:next,file:e,name:filename(e)};
}
function openInstruction(e,name,assignee){envelope(e,'instruction');check(name===filename(e),'ファイル名と受付番号が一致しません');check(e.assignee===assignee,'担当者が違います');check(e.payload.jobs.length===1&&e.payload.jobs[0].spec.code===e.code,'1件の指示ではありません');return copy(e.payload);}
function validateResult(instruction,e){
envelope(e,'result');for(const k of ['receiptId','code','assignee','issuedAt'])check(e[k]===instruction[k],'受付番号・担当・指示が一致しません');
const base=instruction.payload,job=base.jobs[0],got=e.payload.jobs.find(j=>j.id===job.id);check(got,'結果に対象作業がありません');check(equal(got.spec,job.spec),'指示内容が変更されています');
let expected=copy(base);
if(got.status!=='pending'){check(got.history.length===job.history.length+1,'1件の実施記録を確認できません');const h=got.history[got.history.length-1],at=Date.parse(h.at);check(at>=Date.parse(instruction.issuedAt)&&at<=Date.parse(e.exportedAt),'実施日時が不正です');expected=C.complete(base,job.id,got.status,at);}
check(equal(expected,e.payload),'指示外の仕事・履歴・商品情報が混入しています');
}
function result(instruction,state,now){envelope(instruction,'instruction');const e={...copy(instruction),type:'result',exportedAt:new Date(now).toISOString(),payload:C.validate(state)};validateResult(instruction,e);return {file:e,name:filename(e)};}
function receive(ledger,e,name,now){
envelope(e,'result');check(name===filename(e),'ファイル名と受付番号が一致しません');const index=ledger.records.findIndex(r=>r.instruction.receiptId===e.receiptId);check(index>=0,'未発行または異なる受付番号の結果です');const record=ledger.records[index];validateResult(record.instruction,e);
if(record.result&&equal(record.result.payload,e.payload))return {ledger:copy(ledger),duplicate:true};
check(record.phase!=='過去','過去の受付へ新しい結果は取り込みません');
if(record.result)check(record.result.payload.jobs[0].status==='pending','受領済み結果と競合します。上書きしません');
const next=copy(ledger),r=next.records[index];r.phase='結果受領済み';r.result=copy(e);r.lastReceivedAt=new Date(now).toISOString();r.reportedStatus=e.payload.jobs.find(j=>j.id===r.instruction.payload.jobs[0].id).status;return {ledger:next,duplicate:false};
}
function archive(ledger,id){const next=copy(ledger),r=next.records.find(r=>r.instruction.receiptId===id);check(r&&r.phase==='結果受領済み'&&['done','unchanged','sold'].includes(r.reportedStatus),'未完了・保留の受付を過去へ移せません');r.phase='過去';return next;}
function summary(ledger){return ledger.records.map(r=>({receiptId:r.instruction.receiptId,code:r.instruction.code,assignee:r.instruction.assignee,phase:r.phase,reportedStatus:r.reportedStatus||'未受領',lastReceivedAt:r.lastReceivedAt,liveProgress:'端末内の未返却進捗は未確認'}));}
function persist(storage,key,ledger){const raw=JSON.stringify(ledger);storage.setItem(key,raw);check(storage.getItem(key)===raw,'受付台帳の保存読戻し不一致');return copy(ledger);}
const api={empty,filename,issue,openInstruction,result,receive,archive,summary,persist};if(typeof module!=='undefined')module.exports=api;else root.RYTransfer=api;
})(typeof globalThis!=='undefined'?globalThis:this);
