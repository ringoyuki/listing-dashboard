(function(root){'use strict';
const platforms=['mercari','rakuma','yahoo_flea'];
const states=['pending','done','unchanged','missing','sold','on_sale','mismatch','lower','hold'];
const clone=x=>JSON.parse(JSON.stringify(x));
function price(v){return Number.isSafeInteger(v)&&v>=300&&v<=9999999;}
function keys(x,allowed){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!allowed.includes(k)))throw Error('配布形式が違います。オーナー用データは取り込めません');}
function validate(x){
 keys(x,['format','batch','createdAt','jobs']);if(x.format!=='daily-staff-v1'||typeof x.batch!=='string'||!Array.isArray(x.jobs)||x.jobs.length>1000)throw Error('作業指示ファイルではありません');
 const ids=new Set();for(const j of x.jobs){keys(j,['id','code','productId','title','platform','kind','price','normalPrice','startAt','endAt','notBefore','holdReason','url']);
 if(typeof j.id!=='string'||!j.id||ids.has(j.id)||typeof j.code!=='string'||!j.code.trim()||typeof j.productId!=='string'||!j.productId||typeof j.title!=='string'||!platforms.includes(j.platform)||!['price','sale','restore'].includes(j.kind)||!price(j.price))throw Error('商品・販路・価格が不正です');ids.add(j.id);
 for(const k of ['startAt','endAt','notBefore'])if(j[k]&&(!/([Zz]|[+-]\d\d:\d\d)$/.test(j[k])||!Number.isFinite(Date.parse(j[k]))))throw Error('日時にはタイムゾーンが必要です');
 if(j.kind==='sale'&&(!price(j.normalPrice)||j.price>=j.normalPrice||!j.startAt||!j.endAt||Date.parse(j.endAt)<=Date.parse(j.startAt)))throw Error('セール価格・期間が不正です');
 }return clone(x);
}
function merge(state,file){const pack=validate(file),next=clone(state);for(const j of pack.jobs){const old=next.jobs.find(k=>k.id===j.id);if(old){if(JSON.stringify(old.spec)!==JSON.stringify(j))throw Error('同じ指示IDの内容が違います。オーナーへ連絡してください');continue;}next.jobs.push({id:j.id,spec:j,status:'pending',history:[]});}return next;}
function blocked(j,items,now=Date.now()){
 if(j.holdReason)return j.holdReason;
 if(j.notBefore&&now<Date.parse(j.notBefore))return '予約終了待ち：'+j.notBefore;
 if(j.startAt&&now<Date.parse(j.startAt))return '開始待ち：'+j.startAt;
 if(j.kind==='sale'&&now>=Date.parse(j.endAt))return 'セール期限終了：未実施のまま保留';
 const found=(items||[]).filter(i=>i.code===j.code&&i.shopItemId===j.productId);
 if(found.length!==1)return '商品ID・管理番号を照合できません。CSV更新後も同じなら報告';
 if(!Number.isFinite(Number(found[0].stock))||Number(found[0].stock)<=0)return 'Shops在庫なし・不明。売却を推測せずオーナーへ報告';
 return '';
}
function transition(state,id,status,items,now=Date.now()){
 if(!states.includes(status))throw Error('状態不正');const next=clone(state),r=next.jobs.find(j=>j.id===id);if(!r)throw Error('作業がありません');
 if(status==='done'||status==='unchanged'){const why=blocked(r.spec,items,now);if(why)throw Error(why);if(status==='unchanged'&&r.spec.kind!=='price')throw Error('セールは価格だけで完了にできません');}
 if(status==='pending'&&r.spec.kind==='sale'&&next.jobs.some(x=>x.id===id+':restore'&&x.status!=='pending'))throw Error('終了処理に記録があります。オーナーへ訂正を依頼してください');
 r.history.push({from:r.status,to:status,at:new Date(now).toISOString()});r.status=status;r.updatedAt=new Date(now).toISOString();
 if(r.spec.kind==='sale'&&status==='done'&&!next.jobs.some(x=>x.id===id+':restore')){const j=r.spec;next.jobs.push({id:id+':restore',spec:{id:id+':restore',code:j.code,productId:j.productId,title:j.title,platform:j.platform,kind:'restore',price:j.normalPrice,notBefore:j.endAt,...(j.url?{url:j.url}:{})},status:'pending',history:[]});}
 if(r.spec.kind==='sale'&&status==='pending')next.jobs=next.jobs.filter(x=>x.id!==id+':restore');
 if(r.spec.kind==='sale'&&status==='sold'){const restore=next.jobs.find(x=>x.id===id+':restore');if(restore&&restore.status==='pending'){restore.status='sold';restore.history.push({from:'pending',to:'sold',at:new Date(now).toISOString()});}}
 return next;
}
function restore(state,file){
 keys(file,['format','exportedAt','jobs']);if(file.format!=='daily-staff-results-v1'||!Array.isArray(file.jobs))throw Error('保存結果ファイルではありません');
 validate({format:'daily-staff-v1',batch:'restore',jobs:file.jobs.map(r=>r.spec)});
 const next=clone(state);for(const r of file.jobs){keys(r,['id','spec','status','history','updatedAt']);if(r.id!==r.spec.id||!states.includes(r.status)||!Array.isArray(r.history))throw Error('作業記録が不正です');
 for(const h of r.history){keys(h,['from','to','at']);if(!states.includes(h.from)||!states.includes(h.to)||!Number.isFinite(Date.parse(h.at)))throw Error('履歴が不正です');}
 const old=next.jobs.find(x=>x.id===r.id);if(old&&JSON.stringify(old)!==JSON.stringify(r))throw Error('現在の記録と違うため復元できません。現在の結果を保存してオーナーへ連絡してください');if(!old)next.jobs.push(clone(r));}return next;
}
const api={platforms,states,price,validate,merge,restore,blocked,transition};if(typeof module!=='undefined')module.exports=api;else root.DailyWorkCore=api;
})(typeof window!=='undefined'?window:this);
