(function(root){'use strict';
const C=typeof module!=='undefined'?require('./single_work_core.js'):root.SingleWork;
const R=typeof module!=='undefined'?require('./single_transfer.js'):root.RYTransfer;
const clone=x=>JSON.parse(JSON.stringify(x));
function fingerprint(s){const x=C.validate(s);delete x.exportedAt;return JSON.stringify(x);}
function empty(state){return {format:'ry-session-v1',ownerState:C.validate(state),ledger:R.empty(),active:null,attempted:null,confirmed:null};}
function validate(x){if(!x||x.format!=='ry-session-v1'||!x.ledger||x.ledger.format!=='ry-receipt-ledger-v1'||!Array.isArray(x.ledger.records))throw Error('受付保存データが不正です');C.validate(x.ownerState);if(x.active){R.openInstruction(x.active.instruction,R.filename(x.active.instruction),x.active.instruction.assignee);R.result(x.active.instruction,x.active.state,Date.now());}return clone(x);}
function persist(storage,key,x){const checked=validate(x),raw=JSON.stringify(checked);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('受付保存の読み戻し不一致');return checked;}
function open(x,file,name){const state=R.openInstruction(file,name,file.assignee),next=clone(x);if(next.active){if(JSON.stringify(next.active.instruction)===JSON.stringify(file))return next;throw Error('現在の受付が残っています。別の指示は取り込めません');}next.active={instruction:clone(file),state};next.attempted=null;next.confirmed=null;return validate(next);}
function update(x,state){if(!x.active)throw Error('受付番号付き指示を取り込んでください');R.result(x.active.instruction,state,Date.now());const next=clone(x);next.active.state=C.validate(state);return validate(next);}
function prepare(x,now){if(!x.active)throw Error('受付番号付き指示がありません');return R.result(x.active.instruction,x.active.state,now);}
function attempted(x){const next=clone(x);next.attempted=fingerprint(next.active.state);next.confirmed=null;return next;}
function confirm(x){if(!x.active||x.attempted!==fingerprint(x.active.state))throw Error('最後の変更後の結果JSONを保存してください');const next=clone(x);next.confirmed=next.attempted;return next;}
function dirty(x){return !!x.active&&x.confirmed!==fingerprint(x.active.state);}
function finish(x,now){const s=x.active?x.active.state:x.ownerState,day=C.date(now);let completed=0,held=0,sold=0;for(const j of s.jobs){const h=j.history?.at(-1);if(!h||C.date(Date.parse(h.at))!==day)continue;if(['done','unchanged'].includes(j.status))completed++;else if(j.status==='sold')sold++;else if(j.status!=='pending')held++;}
return {completed,held,sold,notStarted:s.jobs.filter(j=>j.status==='pending').length,needsSave:dirty(x),downloadAttempted:!!x.attempted,confirmed:!dirty(x)&&!!x.active,source:s.source||null,csvStatus:s.source?.verifiedAt?'開始用JSONの照合済み情報あり／現在の更新は未確認':'更新未確認'};}
const api={empty,validate,persist,open,update,prepare,attempted,confirm,dirty,finish,fingerprint};if(typeof module!=='undefined')module.exports=api;else root.RYSession=api;
})(typeof globalThis!=='undefined'?globalThis:this);
