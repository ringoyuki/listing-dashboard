(function(root){'use strict';const N=typeof module!=='undefined'?require('./normal_sales.js'):root.NormalSales;const copy=x=>JSON.parse(JSON.stringify(x));
function assigned(records,c){return Object.values(records).filter(r=>r.file.items.some(j=>j.productId===c.productId||j.code===c.code)).map(r=>r.file.assignee).filter((x,i,a)=>a.indexOf(x)===i);}
function issue(records,role,c,source,now=Date.now()){
for(const who of ['A','B','OWNER'])if(!Object.values(records).some(r=>r.file.assignee===who))throw Error(who+'の担当JSONが未登録です。重複照合のため先に取り込んでください');
if(assigned(records,c).length)throw Error('登録済みの商品です。重複追加できません');
if(!(c.stock>0)||!Number.isFinite(Date.parse(c.listedAt)))throw Error('在庫またはShops登録日時を確認できません');
if(!/^[A-E]\d+(?:_\d+)*$/.test(c.code))throw Error('管理番号を確認してください');
const active=Object.values(records).filter(r=>!r.closedBy&&r.file.assignee===role);if(active.length!==1)throw Error('追加先の最新受付を1件に確定してください');const old=active[0];N.replay(old.file,old.events);
if(role!=='OWNER'&&!old.receivedAt)throw Error('担当者の最新結果JSONを先に取り込んでください');
if(Date.parse(source.modifiedTime)<Date.parse(old.file.source.modifiedTime))throw Error('追加先より古いCSVです');
let seq=now,receipt;do{receipt=N.date(now).replaceAll('-','')+'_'+seq++;}while(records[receipt]);
const items=copy(old.file.items);for(const platform of ['mercari','rakuma','yahoo_flea'])items.push({id:receipt+':'+c.productId+':'+platform,code:c.code,productId:c.productId,title:c.title,platform,url:'',listedAt:c.listedAt,round:0,previousKind:null,dueAt:new Date(Math.max(now,Date.parse(c.listedAt)+864000000)).toISOString(),normalPrice:null,historyRef:'owner-manual-shops',dateBasis:'shops'});
const file={...copy(old.file),receiptId:receipt,issuedAt:new Date(now).toISOString(),source:copy(source),items,carry:{file:copy(old.file),events:copy(old.events),countedIds:copy(old.noticeCountedIds||N.replay(old.file,old.events).firstProcessed)}};N.instruction(file);N.replay(file,[]);return {file,oldId:old.file.receiptId};
}
const api={assigned,issue};if(typeof module!=='undefined')module.exports=api;else root.ManualAssignment=api;
})(globalThis);
