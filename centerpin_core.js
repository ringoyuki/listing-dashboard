(function(root){'use strict';
const ACTIONS=['sale','price','relist','yahoo_auction','mercari_auction','hold'];
const ACTIVE=['pending','started','notice','draft','blocked'];
const clone=x=>JSON.parse(JSON.stringify(x));
function validISO(v){return typeof v==='string'&&/([Zz]|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));}
function positive(v){return Number.isSafeInteger(v)&&v>=1&&v<100000000;}
function validateBatch(batch){
 if(!batch||batch.format!=='centerpin-batch-v1'||typeof batch.batchId!=='string'||!batch.batchId||!Array.isArray(batch.jobs)||batch.jobs.length>500)throw Error('センターピン指示ファイルの形式が違います');
 const ids=new Set(),physical=new Set();
 for(const j of batch.jobs){
  if(!j||typeof j.id!=='string'||!j.id||ids.has(j.id)||typeof j.ledgerKey!=='string'||!j.ledgerKey||physical.has(j.ledgerKey)||typeof j.code!=='string'||!j.code||typeof j.title!=='string'||!j.title||!ACTIONS.includes(j.action)||!Number.isInteger(j.sourceRow)||j.sourceRow<6)throw Error('商品・作業が不正、または同一現物が重複しています');
  ids.add(j.id);physical.add(j.ledgerKey);
  if(j.action==='sale'&&(!positive(j.price)||!positive(j.normalPrice)||j.price>=j.normalPrice))throw Error('セールの通常価格と指定価格を確認してください');
  if(['price','relist','mercari_auction'].includes(j.action)&&!positive(j.price))throw Error('確定した価格が不足しています');
  if(j.action==='yahoo_auction'&&(j.price!==1||!validISO(j.startAt)||!validISO(j.endAt)||Date.parse(j.startAt)>=Date.parse(j.endAt)))throw Error('ヤフオクの1円開始・開始終了日時を確認してください');
  if(j.action==='hold'&&j.price!=null&&!positive(j.price))throw Error('保留商品の価格が不正です');
  for(const k of ['shopUrl','ledgerUrl'])if(j[k]!==undefined){if(typeof j[k]!=='string'||!/^https:\/\//.test(j[k]))throw Error('商品リンクが不正です');}
 }
 return clone(batch);
}
function empty(){return {format:'centerpin-worker-results-v1',jobs:[],imported:[],exportedAt:null};}
function merge(state,batch){validateBatch(batch);const result=clone(state);for(const j of batch.jobs){const old=result.jobs.find(x=>x.id===j.id);if(old){if(JSON.stringify(old.job)!==JSON.stringify(j))throw Error('同じ指示IDに異なる内容が存在します');continue;}
 if(result.jobs.some(x=>x.job.ledgerKey===j.ledgerKey&&ACTIVE.includes(x.status)))throw Error('同じ台帳商品に未完了の指示があります。'+j.code);
 result.jobs.push({id:j.id,batchId:batch.batchId,job:j,status:'pending',history:[]});}
 if(!result.imported.includes(batch.batchId))result.imported.push(batch.batchId);return result;}
function saleDates(startedAt){if(!validISO(startedAt))throw Error('セール開始日時が不正です');const jst=new Date(Date.parse(startedAt)+9*3600000).toISOString().slice(0,10);
 const next=days=>{const d=new Date(jst+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
 return {noticeDate:next(1),endAt:next(2)+'T22:00:00+09:00'};}
function change(state,id,action,at){if(!validISO(at))throw Error('作業日時が不正です');const out=clone(state),x=out.jobs.find(z=>z.id===id);if(!x)throw Error('指示がありません');const allowed={pending:['started','draft','done','sold','blocked'],started:['notice','done','unsold','sold','blocked'],draft:['done','blocked','sold'],notice:['done','sold','blocked'],blocked:['pending','started','done','sold'],done:[],unsold:[],sold:[]};
 if(!allowed[x.status]?.includes(action))throw Error('この状態からは変更できません');
 if(action==='draft'&&x.job.action!=='relist')throw Error('下書き保存は転生出品だけです');
 if(action==='notice'&&x.job.action!=='sale')throw Error('告知はセールだけです');
 if(action==='unsold'&&!['yahoo_auction','mercari_auction'].includes(x.job.action))throw Error('オークションのみ未落札にできます');
 if(action==='unsold'&&x.job.endAt&&Date.parse(at)<Date.parse(x.job.endAt))throw Error('オークション終了前です');
 if(action==='done'&&x.job.action==='sale'&&x.startedAt&&Date.parse(at)<Date.parse(x.saleEndAt))throw Error('セール終了前には復帰完了にできません');
 if(action==='started'&&x.job.startAt&&Date.parse(at)<Date.parse(x.job.startAt))throw Error('指定された開始時刻より前です');
 const before=x.status;x.status=action;x.history.push({from:before,to:action,at});
 if(action==='started'){x.startedAt=at;if(x.job.action==='sale'){const d=saleDates(at);x.noticeDate=d.noticeDate;x.saleEndAt=d.endAt;}}
 return out;}
function resultFile(state,at){if(!validISO(at))throw Error('保存日時が不正です');const out=clone(state);out.exportedAt=at;return out;}
const API={ACTIONS,ACTIVE,validateBatch,empty,merge,change,saleDates,resultFile};if(typeof module!=='undefined')module.exports=API;else root.CenterpinCore=API;
})(typeof window!=='undefined'?window:globalThis);