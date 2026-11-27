(function(root){'use strict';
const N=typeof module!=='undefined'?require('./normal_sales.js'):root.NormalSales;
const DAY=86400000,cp=x=>JSON.parse(JSON.stringify(x)),ok=(v,m)=>{if(!v)throw Error(m);};
function processed(file,events){return N.replay(file,events).firstProcessed||[];}
function summary(record,now=Date.now()){
 const s=N.replay(record.file,record.events),all=processed(record.file,record.events),baseline=new Set(record.file.carry?.countedIds||[]);
 const fresh=all.filter(id=>!baseline.has(id)),rows=N.due(s,now);
 return {first:all.length,total:s.items.length,newFirst:fresh.length,notify:!!record.receivedAt&&['A','B'].includes(record.file.assignee)&&fresh.length>=150,
 completed:N.progress(s).completed,ready:rows.filter(j=>['inspect','price','sale','list','announce','restore'].includes(j.task)).length,
 waiting:rows.filter(j=>j.task==='wait').length,held:s.items.filter(j=>j.stage==='hold').length,sold:s.items.filter(j=>j.stage==='sold').length};
}
function identities(x){
 ok(x?.format==='ry-identity-v1'&&Array.isArray(x.items)&&Number.isFinite(Date.parse(x.checkedAt)),'現物照合台帳を読み込んでください');
 const pairs=new Map(),curr=new Map();
 for(const r of x.items){ok(typeof r.physicalId==='string'&&r.physicalId&&typeof r.ledgerRef==='string'&&r.ledgerRef&&r.code&&r.productId,'現物ID・元台帳の根拠が必要です');const k=r.productId+'|'+r.code;ok(!pairs.has(k),'現物照合台帳の重複・競合です');pairs.set(k,r);if(r.current){ok(!curr.has(r.physicalId),'同一現物の現出品が複数あります');curr.set(r.physicalId,r);}}
 return {pairs,curr,resolve:j=>pairs.get(j.productId+'|'+j.code)};
}
function checkAssignments(records,map){
 const occupied=new Map();
 for(const r of Object.values(records)){N.replay(r.file,r.events);for(const j of r.file.items){const identity=map.resolve(j);ok(identity,'配布済み商品の現物照合が未完了：'+j.code);const previous=occupied.get(identity.physicalId);ok(!previous||previous===r.file.assignee,'同一現物の担当競合：'+j.code);occupied.set(identity.physicalId,r.file.assignee);}}
 return occupied;
}
function choose(records,catalog,identity,center,now=Date.now()){
 const map=identities(identity),occupied=checkAssignments(records,map),blocked=new Set(center.map(r=>r.physicalId));
 const seen=new Set(),out=[];
 for(const c of catalog){const k=c.productId+'|'+c.code;if(seen.has(k))throw Error('CSVの商品重複');seen.add(k);
 const r=map.resolve(c);if(!r||!r.current||map.curr.get(r.physicalId)!==r||r.blocked||r.regulationEnded||occupied.has(r.physicalId)||blocked.has(r.physicalId)||center.some(e=>e.code===c.code||e.productId===c.productId||e.ledgerRef===r.ledgerRef))continue;
 const days=Math.floor((now-Date.parse(c.listedAt))/DAY);if(!(c.stock>0&&c.public===true&&days>=10))continue;
 out.push({...c,physicalId:r.physicalId,days,cost:Number.isFinite(r.cost)?r.cost:0});
 }
 return out.sort((a,b)=>{const rank=d=>d>=120?0:d>=90?1:d>=30?2:3;return rank(a.days)-rank(b.days)||b.cost-a.cost||b.days-a.days||a.productId.localeCompare(b.productId);});
}
function issue(records,receiptId,source,catalog,identity,center,now=Date.now(),targetId){
 const old=records[targetId];ok(old&&old.receivedAt&&!old.closedBy,'最終結果を受領した現受付を指定してください');ok(summary(old,now).notify,'新たな初回処理150販路に未到達です');
 ok(!records[receiptId]&&/^\d{8}_\d{4,}$/.test(receiptId),'受付番号が重複または不正です');ok(Number.isFinite(Date.parse(source.modifiedTime))&&Date.parse(source.modifiedTime)>=Date.parse(old.file.source.modifiedTime),'CSVが旧版です');
 for(const role of ['A','B','OWNER'])ok(Object.values(records).some(r=>r.file.assignee===role),'全担当の配布指示を照合してください');
 const selected=choose(records,catalog,identity,center,now).slice(0,50);ok(selected.length,'安全に追加できる新規商品がありません');
 const items=cp(old.file.items);for(const c of selected)for(const platform of ['mercari','rakuma','yahoo_flea'])items.push({id:receiptId+':'+c.productId+':'+platform,code:c.code,productId:c.productId,title:c.title,platform,url:'',listedAt:c.listedAt,round:0,previousKind:null,dueAt:new Date(Date.parse(c.listedAt)+10*DAY).toISOString(),normalPrice:null,historyRef:'verified-current-listing',dateBasis:'shops'});
 const file={...cp(old.file),receiptId,issuedAt:new Date(now).toISOString(),source:cp(source),items,carry:{file:cp(old.file),events:cp(old.events),countedIds:cp(old.noticeCountedIds||processed(old.file,old.events))}};
 N.instruction(file);N.replay(file,[]);return {file,addedProducts:selected.length,addedLanes:selected.length*3};
}
function linkReceipt(records,file,next){const all={...records,[file.receiptId]:next};for(const r of Object.values(all)){let child=r.file;for(let c=child.carry;c;c=child.carry){const old=all[c.file.receiptId];if(old){ok(!old.closedBy||old.closedBy===child.receiptId,'旧受付から複数の新受付が発行されています');ok(JSON.stringify(old.file)===JSON.stringify(c.file)&&old.events.length<=c.events.length&&old.events.every((e,i)=>JSON.stringify(e)===JSON.stringify(c.events[i])),'引継ぎ後に旧受付の履歴が増えています。競合保留');all[c.file.receiptId]={...old,closedBy:child.receiptId};}child=c.file;}}return all;}function receive(record,result,name){
 if(record.closedBy){const same=JSON.stringify(result.events)===JSON.stringify(record.events);N.receive(record.file,record.events,result,name);if(!same)throw Error('旧受付終了後の追加結果です。新受付へ混ぜず競合保留にしてください');return {events:record.events,duplicate:true};}
 return N.receive(record.file,record.events,result,name);
}
function centerCandidates(records,identity){
 const map=identities(identity);checkAssignments(records,map);const groups=new Map();
 for(const r of Object.values(records).filter(r=>!r.closedBy&&r.receivedAt)){for(const j of N.replay(r.file,r.events).items){const ident=map.resolve(j);if(!groups.has(ident.physicalId))groups.set(ident.physicalId,{physicalId:ident.physicalId,ledgerRef:ident.ledgerRef,code:j.code,productId:j.productId,title:j.title,codes:identity.items.filter(r=>r.physicalId===ident.physicalId).map(r=>r.code),productIds:identity.items.filter(r=>r.physicalId===ident.physicalId).map(r=>r.productId),lanes:[]});groups.get(ident.physicalId).lanes.push(j);}}
 const fixed=[],consult=[],exceptions=[];
 for(const g of groups.values()){
 const js=g.lanes,duplicates=new Set(js.map(j=>j.platform)).size!==js.length;
 if(duplicates||js.some(j=>j.stage==='sold'||/不明|見つからない|売却報告|確認不足|確定できない/.test(j.reason||'')||(j.stage==='hold'&&!/再出品|掲載終了/.test(j.reason||'')))){exceptions.push({...g,reason:'売却・商品不明・競合の例外確認'});continue;}
 const pending=js.some(j=>j.stage==='active');const ended=j=>j.countsKnown&&j.stage!=='hold'&&j.stage!=='active'&&(j.platform==='yahoo_flea'?j.stage==='owner'&&j.priceCount>=2:(j.stage==='owner'&&(j.priceCount>=2||j.saleCount>=2)||j.stage==='wait'&&j.previousKind==='sale'&&j.saleCount>=2));
 if(js.length===3&&['mercari','rakuma','yahoo_flea'].every(p=>js.some(j=>j.platform===p))&&js.every(ended))fixed.push({...g,reason:'3販路終了・売れ残り'});
 else if(js.some(j=>/再出品|掲載終了/.test(j.reason||'')))consult.push({...g,reason:'再出品か処分を判断'+(pending?'（終了処理継続中）':'')});
 }
 return {fixed,consult,exceptions};
}
function centerPlan(candidates,existing){
 const operations=[],held=[],seen=new Set();
 for(const g of [...candidates.fixed,...candidates.consult]){
 if(seen.has(g.physicalId))continue;seen.add(g.physicalId);
 const matches=existing.filter(r=>r.physicalId===g.physicalId||r.productId===g.productId||r.code===g.code||r.ledgerRef===g.ledgerRef);
 if(matches.some(r=>r.physicalId!==g.physicalId)||matches.length>1){held.push({...g,reason:'既存行の現物照合が競合'});continue;}
 if(matches.length===1){const r=matches[0];operations.push({kind:'update-reason',physicalId:g.physicalId,codes:g.codes,productIds:g.productIds,ledgerRef:g.ledgerRef,row:r.row,expected:{code:r.code,productId:r.productId,ledgerRef:r.ledgerRef,reason:r.reason||''},column:'J',value:g.reason});}
 else operations.push({kind:'append-review',physicalId:g.physicalId,codes:g.codes,productIds:g.productIds,code:g.code,title:g.title,productId:g.productId,ledgerRef:g.ledgerRef,reason:g.reason});
 }
 return {format:'ry-center-plan-v1',operations,held,exceptions:candidates.exceptions};
}
const api={linkReceipt,summary,processed,identities,checkAssignments,choose,issue,receive,centerCandidates,centerPlan};if(typeof module!=='undefined')module.exports=api;else root.RYReplenish=api;
})(typeof globalThis!=='undefined'?globalThis:this);
