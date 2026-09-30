(function(root){'use strict';
// This module selects approved instructions only; it never calculates discounts.
const LIMIT=null, SCREEN=null, CLOSED=new Set(['done','unchanged','sold']);
const copy=x=>JSON.parse(JSON.stringify(x));
const stamp=t=>new Date(t).toISOString();
function weekKey(now){const d=new Date(now+9*3600000);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
function activeSales(state){return state.jobs.filter(r=>r.spec.kind==='sale'&&state.jobs.some(x=>x.id===r.id+':restore'&&!CLOSED.has(x.status)));}
function overdue(state,now,legacy=[]){return state.jobs.filter(r=>r.spec.kind==='restore'&&!CLOSED.has(r.status)&&Date.parse(r.spec.notBefore)<=now).length+legacy.filter(r=>r.overdue!==false).length;}
function direct(j){const links=typeof module!=='undefined'?require('./staff_product_links'):root.StaffProductLinks;return !!links?.safeUrl(j.platform,j.url);}
function eligible(r,state,now){
 const j=r.spec;if(j.kind!=='sale'||r.status!=='pending')return false;
 if(j.holdReason||!direct(j)||Date.parse(j.endAt)<=now)return false;
 if(j.notBefore&&Date.parse(j.notBefore)>now)return false;
 // Future approved starts may be prepared; no stale calendar date is inferred from CSV.
 const horizon=new Date(weekKey(now)+'T00:00:00+09:00').getTime()+7*86400000;
 if(Date.parse(j.startAt)>=horizon)return false;
 return !activeSales(state).some(x=>x.spec.productId===j.productId||x.spec.code===j.code);
}
function prepare(state,now=Date.now()){
 const next=copy(state);next.saleRounds=next.saleRounds||{};const key=weekKey(now);
 
 const batch=next.saleRounds[key]||{createdAt:stamp(now),ids:[],checks:{},started:[]};
 const seen=new Set();const ids=batch.ids;for(const id of ids){const old=next.jobs.find(r=>r.id===id);if(old){seen.add(old.spec.productId);seen.add("code:"+old.spec.code);}}
 const rows=next.jobs.filter(r=>eligible(r,next,now)).sort((a,b)=>Date.parse(a.spec.startAt)-Date.parse(b.spec.startAt)||a.id.localeCompare(b.id));
 for(const r of rows){if(seen.has(r.spec.productId)||seen.has('code:'+r.spec.code))continue;seen.add(r.spec.productId);seen.add('code:'+r.spec.code);ids.push(r.id);}
 // Preserve prior checks and starts, append eligible instructions without a quantity cap.
 if(ids.length)next.saleRounds[key]=batch;
 return next;
}
function round(state,now){return state.saleRounds?.[weekKey(now)];}
function startedIds(state,now){return [...new Set([...(round(state,now)?.started||[]),...state.jobs.filter(r=>r.spec.kind==='sale'&&(r.history||[]).some(h=>h.to==='done'&&weekKey(Date.parse(h.at))===weekKey(now))).map(r=>r.id)])];}
function screen(state,id,observation,now=Date.now()){
 const next=copy(state),batch=round(next,now),r=next.jobs.find(x=>x.id===id);
 if(!batch?.ids.includes(id)||!r||r.status!=='pending')throw Error('今週の指定候補ではありません');
 if(!Number.isSafeInteger(observation.currentPrice)||observation.currentPrice<300||observation.currentPrice>9999999)throw Error('この販路の実価格を入力してください');
 if(observation.likes!==null&&(!Number.isSafeInteger(observation.likes)||observation.likes<0))throw Error('いいね数は0以上の整数です。不明は空欄にしてください');
 let reason='';
 if(observation.currentPrice<=r.spec.price)reason='実価格がセール価格以下のため見送り';
 else if(observation.currentPrice!==r.spec.normalPrice)reason='実価格と指示の終了後価格が異なります。値上げ復帰を避けるためオーナーへ報告';
 else if((r.spec.platform==='yahoo_flea'||r.spec.source==='emergency')&&(observation.likes===null||observation.likes<3))reason='この販路のいいね3件以上を確認できないため見送り';
 batch.checks[id]={at:stamp(now),currentPrice:observation.currentPrice,likes:observation.likes,reason};
 return next;
}
function gate(state,id,items,now=Date.now(),legacy=[]){
 const r=state.jobs.find(x=>x.id===id);if(!r||r.spec.kind!=='sale')return '';
 if(r.status!=='pending')return 'このセールには処理記録があります';
 if(state.jobs.some(x=>x.id===id+':restore'))return '終了処理が残っています。再開始せずオーナーへ連絡してください';
 if(overdue(state,now,legacy))return '終了処理の未完了があるため、新規セールを止めています';
 const b=round(state,now);if(!b?.ids.includes(id))return '今週の指定候補外です。代わりの商品探しは不要です';
 const active=activeSales(state);
 if(active.some(x=>x.spec.productId===r.spec.productId||x.spec.code===r.spec.code))return '同じ商品が他のセールで進行中です';
 if(legacy.some(x=>x.code===r.spec.code||x.productId===r.spec.productId))return '同じ商品の旧セール終了処理が残っています';
 if(state.jobs.some(x=>x.id!==id&&x.status==='pending'&&x.spec.kind==='price'&&(x.spec.productId===r.spec.productId||x.spec.code===r.spec.code)&&x.spec.platform===r.spec.platform))return 'この商品の通常価格変更が未処理です';
 const check=b.checks[id];if(!check)return '商品ページで実価格を入力してください（対象探しは不要）';
 if(check.reason)return check.reason;
 if(now-Date.parse(check.at)>30*60000||now<Date.parse(check.at))return '確認から30分経過しました。実価格を再確認してください';
 const pause=state.salePauses?.[r.spec.platform];
 if(!pause||Date.parse(pause.until)<Date.parse(r.spec.endAt)||Date.parse(pause.at)>now)return '終了処理まで自動値下げを休止するオーナー確認が未登録です';
 return '';
}
function recordStart(state,id,now=Date.now()){
 const next=copy(state),b=round(next,now);if(!b)throw Error('今週の候補記録がありません');
 if(!b.started.includes(id))b.started.push(id);return next;
}
function pause(state,platform,until,now=Date.now()){
 if(!['mercari','rakuma','yahoo_flea'].includes(platform)||!Number.isFinite(Date.parse(until))||Date.parse(until)<=now)throw Error('有効な休止期限を指定してください');
 const next=copy(state);next.salePauses=next.salePauses||{};next.salePauses[platform]={at:stamp(now),until};return next;
}
function nominateEmergency(state,id,now=Date.now()){
 const next=copy(state),r=next.jobs.find(x=>x.id===id);
 if(!r||r.spec.source!=='emergency'||!eligible(r,next,now))throw Error('この緊急候補は現在の週に実施できません');
 next.saleRounds=next.saleRounds||{};const key=weekKey(now);
 const b=next.saleRounds[key]||(next.saleRounds[key]={createdAt:stamp(now),ids:[],checks:{},started:[]});
 if(b.ids.includes(id))return next;
 if(b.ids.some(other=>next.jobs.some(x=>x.id===other&&(x.spec.productId===r.spec.productId||x.spec.code===r.spec.code))))throw Error('同じ商品が今週の候補にあります');
 b.ids.push(id);return next;
}
function validateMeta(state){
 const rounds=state.saleRounds||{},pauses=state.salePauses||{};
 if(!rounds||typeof rounds!=='object'||Array.isArray(rounds)||!pauses||typeof pauses!=='object'||Array.isArray(pauses))throw Error('候補・休止の保存形式が不正です');
 const ids=new Set(state.jobs.map(r=>r.id));
 for(const [key,b] of Object.entries(rounds)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!b||Object.keys(b).some(k=>!['createdAt','ids','checks','started'].includes(k))||!Number.isFinite(Date.parse(b.createdAt))||!Array.isArray(b.ids)||new Set(b.ids).size!==b.ids.length||b.ids.some(id=>!ids.has(id))||!Array.isArray(b.started)||new Set(b.started).size!==b.started.length||b.started.some(id=>!b.ids.includes(id))||!b.checks||typeof b.checks!=='object'||Array.isArray(b.checks))throw Error('候補履歴が不正です');
  for(const [id,c] of Object.entries(b.checks))if(!b.ids.includes(id)||!c||Object.keys(c).some(k=>!['at','currentPrice','likes','reason'].includes(k))||!Number.isFinite(Date.parse(c.at))||!Number.isSafeInteger(c.currentPrice)||c.currentPrice<300||(c.likes!==null&&(!Number.isSafeInteger(c.likes)||c.likes<0))||typeof c.reason!=='string')throw Error('実価格の確認履歴が不正です');
 }
 for(const [platform,p] of Object.entries(pauses))if(!['mercari','rakuma','yahoo_flea'].includes(platform)||!p||Object.keys(p).some(k=>!['at','until'].includes(k))||!Number.isFinite(Date.parse(p.at))||!Number.isFinite(Date.parse(p.until)))throw Error('休止記録が不正です');
 return true;
}
const api={LIMIT,SCREEN,weekKey,direct,activeSales,overdue,prepare,round,startedIds,screen,gate,recordStart,pause,nominateEmergency,validateMeta};
if(typeof module!=='undefined')module.exports=api;else root.DailySalePlan=api;
})(typeof window!=='undefined'?window:this);
