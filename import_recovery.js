(function(root){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function prepare(N,current,incoming,name,error,draft){
 N.instruction(incoming);
 if(!current||incoming.assignee!==current.file.assignee)throw Error('担当の違うJSONからは復元できません');
 if(name!==N.filename(incoming))throw Error('ファイル名が一致しません');
 if(incoming.receiptId===current.file.receiptId||incoming.carry?.file.receiptId!==current.file.receiptId)throw Error('現在の受付を引き継ぐ追加JSONだけ復元できます');
 N.replay(current.file,current.events);N.replay(incoming,[]);
 if(JSON.stringify(current.file)!==JSON.stringify(incoming.carry.file))throw Error('元の指示が異なります。オーナーへバックアップの確認を依頼してください');
 const base=incoming.carry.events,events=current.events;const prefix=(a,b)=>a.length<=b.length&&a.every((e,i)=>JSON.stringify(e)===JSON.stringify(b[i]));
 if(!prefix(base,events)&&!prefix(events,base))throw Error('履歴が分岐しています。オーナーへ最新結果を提出してください');
 return {incoming:clone(incoming),name,error:String(error),current:clone(current),snapshot:JSON.stringify(current),draft:clone(draft||{}),downloaded:false,uploaded:false,backupName:null};
}
function backup(N,r,current,now=Date.now()){
 if(JSON.stringify(current)!==r.snapshot)throw Error('記録が変わりました。追加JSONをもう一度読み込んでください');
 const x={type:'recovery_backup',schemaVersion:1,exportedAt:new Date(now).toISOString(),assignee:r.current.file.assignee,error:r.error,current:r.current,currentResult:N.result(r.current.file,r.current.events,now),pendingDraft:r.draft,incomingFileName:r.name,incoming:r.incoming};
 return {name:'復元前バックアップ_'+x.assignee+'_'+new Date(now).toISOString().replace(/[:.]/g,'-')+'.json',value:x};
}
function restoredEvents(N,r){
 const base=r.incoming.carry.events,all=r.current.events,delta=all.slice(base.length);let events=[];let last=Date.parse(r.incoming.issuedAt);const ids=new Map();
 const apply=e=>{const copy=clone(e);if(ids.has(copy.targetEventId))copy.targetEventId=ids.get(copy.targetEventId);last=Math.max(last,Date.parse(e.at));events=N.append(r.incoming,events,copy,last);ids.set(e.id,events[events.length-1].id);};
 if(delta.length&&delta[0].op!=='csv'){const csv=[...base].reverse().find(e=>e.op==='csv');if(csv)apply(csv);}
 for(const e of delta)apply(e);return events;
}
function restore(N,r,current){
 if(!r.downloaded||!r.uploaded)throw Error('バックアップを保存し、Driveへの提出を確認してください');
 if(JSON.stringify(current)!==r.snapshot)throw Error('バックアップ後に記録が変わりました。復元を止めました');
 N.instruction(r.incoming);N.replay(r.incoming,[]);
 return {file:clone(r.incoming),events:restoredEvents(N,r),saved:null,attempted:null,submitted:false,past:clone([...(current.past||[]),{file:current.file,events:current.events}])};
}
const api={prepare,backup,restore};if(typeof module!=='undefined')module.exports=api;else root.RYImportRecovery=api;
})(typeof globalThis!=='undefined'?globalThis:this);