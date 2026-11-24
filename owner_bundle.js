(function(root){'use strict';const N=typeof module!=='undefined'?require('./normal_sales.js'):root.NormalSales,R=typeof module!=='undefined'?require('./replenishment.js'):root.RYReplenish;function clean(r){N.replay(r.file,r.events);const out={file:r.file,events:r.events};for(const k of ['receivedAt','exportedAt','closedBy','closedAt','issuedFrom','manual','noticeCountedIds'])if(r[k]!==undefined)out[k]=r[k];return out;}function reconcile(a,b){if(JSON.stringify(a.file)!==JSON.stringify(b.file))throw Error('担当指示が一致しません');N.replay(a.file,a.events);N.replay(b.file,b.events);const work=r=>r.events.filter(e=>!['csv','policy'].includes(e.op)).map(e=>{const x={...e};delete x.id;return x;});const x=work(a),y=work(b),short=x.length<y.length?x:y,long=x.length<y.length?y:x;if(!short.every((e,i)=>JSON.stringify(e)===JSON.stringify(long[i])))throw Error('実施記録が分岐しています。履歴は上書きしていません');return y.length>=x.length?b:a;}
function merge(current,incoming){const next=JSON.parse(JSON.stringify(current));for(const [id,value]of Object.entries(incoming)){const r=clean(value);if(id!==r.file.receiptId)throw Error('受付番号が不一致です');const old=next[id];if(old){if(JSON.stringify(old.file)!==JSON.stringify(r.file))throw Error('指示が競合しています');const a=old.events,b=r.events,short=a.length<b.length?a:b,long=a.length<b.length?b:a;if(!short.every((e,i)=>JSON.stringify(e)===JSON.stringify(long[i])))throw Error('作業履歴が競合しています');next[id]=a.length>b.length?old:{...old,...r};}else next[id]=r;}let all=next;for(const r of Object.values(next))all=R.linkReceipt(all,r.file,r);return all;}function pack(records){const out={};for(const [id,r]of Object.entries(records))out[id]=clean(r);return{format:'ry-owner-bundle-v1',savedAt:new Date().toISOString(),records:out};}
function syncWork(records,local,now=Date.now()){
 const rows=Object.values(records).filter(r=>r.file.assignee==='OWNER'&&!r.closedBy);
 const related=local?rows.filter(r=>r.file.receiptId===local.file.receiptId||r.file.carry?.file.receiptId===local.file.receiptId):rows;
 if(!related.length)return local;
 if(related.length!==1)throw Error('オーナーの現行受付が複数あります。作業データは変更していません');
 const r=related[0];N.replay(r.file,r.events);
 if(!local)return {file:r.file,events:r.events,saved:null,submitted:false};
 if(local.file.receiptId!==r.file.receiptId){const c=r.file.carry;if(JSON.stringify(c.file)!==JSON.stringify(local.file)||JSON.stringify(c.events)!==JSON.stringify(local.events))throw Error('追加JSONと現在の作業履歴が一致しません。最新結果を保存してください');return {file:r.file,events:r.events,saved:null,submitted:false,past:[...(local.past||[]),{file:local.file,events:local.events}]};}
 const chosen=reconcile(local,r);if(chosen===local)return local;
 let events=chosen.events;const oldState=N.replay(local.file,local.events),newState=N.replay(r.file,events);
 const count=x=>x.events.filter(e=>!['csv','policy'].includes(e.op)).length;if(count(local)===count(r)&&Date.parse(oldState.csv?.at||0)>=Date.parse(newState.csv?.at||0))return local;
 // CSV refreshes are not selling work; retain a newer local CSV without dropping corrections.
 if(oldState.csv&&(!newState.csv||Date.parse(oldState.csv.at)>Date.parse(newState.csv.at))){const {id,at,...csv}=oldState.csv;events=N.append(r.file,events,csv,Math.max(now,Date.parse(events.at(-1)?.at||r.file.issuedAt)));}
 if(JSON.stringify(events)===JSON.stringify(local.events))return local;
 return {...local,file:r.file,events,saved:null,submitted:false,draft:null,pendingSoldReport:null};
}
const api={merge,pack,reconcile,syncWork};if(typeof module!=='undefined')module.exports=api;else root.OwnerBundle=api;})(globalThis);
