/* Work counts only: no compensation rates or amounts. */
(function(root){'use strict';
const symbols=['●','■','▲','〇','□','なし'];
const channels=['shops','mercari','rakuma','yahoo_flea','yahoo_auction'];
function event(batch,role,job,platform,c,at){
 if(!batch||!['A','B'].includes(role)||!channels.includes(platform)||!Number.isFinite(Date.parse(at)))throw Error('作業記録の識別情報を確認してください');
 if(!c||!(c.status==='owner_csv'&&platform==='shops'&&c.price===job.price&&c.symbol===job.symbol&&c.productId===job.baseItem.shopItemId||c.status==='auction'&&['mercari','yahoo_auction'].includes(platform)||c.status==='missing'&&platform!=='shops'||c.status==='sold'&&c.reported===true)&&(!c.confirmed||!['done','unlisted'].includes(c.status)||platform==='shops'&&c.status==='unlisted'))throw Error('この販路の商品と作業結果を確認してください');
 const e={id:JSON.stringify([batch,role,job.code,platform]),batch,role,code:job.code,platform,completedAt:at,status:c.status,priceChanged:false,symbolChanged:false};
 if(c.status==='done'&&c.declaredAction){
  if(!['price','symbol','both','none'].includes(c.declaredAction)||!c.symbolConfirmed||!Number.isSafeInteger(c.price)||c.price<300||c.price!==job.platforms[platform])throw Error('実際に行った作業と指定価格を確認してください');
  return {...e,source:'staff_action',action:c.declaredAction,afterPrice:c.price,afterSymbol:job.symbol,priceChanged:['price','both'].includes(c.declaredAction),symbolChanged:['symbol','both'].includes(c.declaredAction)};
 }
 if(c.status==='done'){
  if(!Number.isSafeInteger(c.before)||c.before<300||c.price!==job.platforms[platform]||!c.symbolConfirmed)throw Error('変更前後の価格・記号の確認が必要です');
  if(platform!=='yahoo_auction'&&!symbols.includes(c.beforeSymbol))throw Error('変更前の記号を選択してください');
  e.beforePrice=c.before;e.afterPrice=c.price;e.beforeSymbol=platform==='yahoo_auction'?null:c.beforeSymbol;e.afterSymbol=platform==='yahoo_auction'?null:job.symbol;
  e.priceChanged=c.before!==c.price;e.symbolChanged=platform!=='yahoo_auction'&&c.beforeSymbol!==job.symbol;
 }
 return e;
}
function entries(file){
 if(file.format!=='listing-ab-result-v1'||!['A','B'].includes(file.role))throw Error('A/B作業結果JSONを選択してください');
 const result=[];
 for(const e of file.activity||[]){
  if(e.batch!==file.id||e.role!==file.role||!channels.includes(e.platform)||e.id!==JSON.stringify([e.batch,e.role,e.code,e.platform])||!Number.isFinite(Date.parse(e.completedAt)))throw Error('作業記録が不正です');
  if(e.status==='done'&&e.source==='staff_action'){
   if(!['price','symbol','both','none'].includes(e.action)||!Number.isSafeInteger(e.afterPrice)||e.afterPrice<300||e.priceChanged!==['price','both'].includes(e.action)||e.symbolChanged!==['symbol','both'].includes(e.action)||(!symbols.includes(e.afterSymbol)&&!(e.platform==='yahoo_auction'&&e.afterSymbol===null&&!e.symbolChanged)))throw Error('選択方式の作業記録が不正です');
   result.push(e);continue;
  }
  if(e.status==='done'){
   if(!Number.isSafeInteger(e.beforePrice)||!Number.isSafeInteger(e.afterPrice)||e.afterPrice<300||e.beforePrice<300||e.priceChanged!==(e.beforePrice!==e.afterPrice))throw Error('価格変更記録が不正です');
   if(e.platform!=='yahoo_auction'&&(!symbols.includes(e.beforeSymbol)||!symbols.includes(e.afterSymbol)||e.symbolChanged!==(e.beforeSymbol!==e.afterSymbol)))throw Error('記号変更記録が不正です');
   if(e.platform==='yahoo_auction'&&e.symbolChanged!==false)throw Error('ヤフオク記号記録が不正です');
  }else if(!['unlisted','missing','sold','auction','owner_csv'].includes(e.status)||(e.status==='auction'&&!['mercari','yahoo_auction'].includes(e.platform))||(e.status==='owner_csv'&&e.platform!=='shops')||(e.platform==='shops'&&!['sold','owner_csv'].includes(e.status))||e.priceChanged!==false||e.symbolChanged!==false)throw Error('対象外記録が不正です');
  result.push(e);
 }
 const seen=new Set(result.map(e=>e.id));
 for(const r of file.records||[])for(const [platform,c] of Object.entries(r.checks||{})){
  if(!channels.includes(platform))continue;
  if(c.status==='owner_csv'&&platform!=='shops'||c.status==='auction'&&!['mercari','yahoo_auction'].includes(platform))throw Error('オークション対象販路が不正です');
  const id=JSON.stringify([file.id,file.role,r.code,platform]);if(seen.has(id))continue;
  if(r.role!==file.role||!Number.isFinite(Date.parse(r.completedAt)))throw Error('旧記録が不正です');
  result.push({id,batch:file.id,role:file.role,code:r.code,platform,completedAt:r.completedAt,status:c.status,priceChanged:c.status==='done'&&Number.isSafeInteger(c.before)&&Number.isSafeInteger(c.price)?c.before!==c.price:false,symbolChanged:c.status==='done'&&platform!=='yahoo_auction'?null:false,legacy:true});
 }
 return result;
}
function summarize(files){
 const map=new Map(),conflicts=new Set();let duplicates=0;
 for(const f of files)for(const e of entries(f)){
  if(map.has(e.id)){const old=map.get(e.id);if(JSON.stringify(old)!==JSON.stringify(e)){
   const matches=(a,b)=>(a.correctionHistory||[]).some(x=>JSON.stringify(x)===JSON.stringify(b));
   if(matches(e,old))map.set(e.id,e);else if(!matches(old,e))conflicts.add(e.id);
  }else duplicates++;}else map.set(e.id,e);
 }
 const rows=[...map.values()].filter(e=>!conflicts.has(e.id));const groups={};
 for(const e of rows){const day=new Date(Date.parse(e.completedAt)+9*3600000).toISOString().slice(0,10),key=day+' '+e.role;
  const g=groups[key]||(groups[key]={day,role:e.role,price:0,symbol:0,both:0,changes:0,checkOnly:0,unlisted:0,missing:0,sold:0,auction:0,ownerCsv:0,unknown:0});
  if(e.status==='owner_csv'){g.ownerCsv++;continue;}
  if(e.status==='auction'){g.auction++;continue;}
  if(e.status==='missing'){g.missing++;continue;}if(e.status==='sold'){g.sold++;continue;}
  if(e.status==='unlisted'){g.unlisted++;continue;}
  if(e.priceChanged)g.price++;if(e.symbolChanged===true)g.symbol++;
  if(e.symbolChanged===null){g.unknown++;continue;}
  if(e.priceChanged&&e.symbolChanged)g.both++;
  if(e.priceChanged||e.symbolChanged)g.changes++;else g.checkOnly++;
 }
 return {rows,groups:Object.values(groups).sort((a,b)=>(a.day+a.role).localeCompare(b.day+b.role)),duplicates,conflicts:[...conflicts]};
}
const api={event,entries,summarize};if(typeof module!=='undefined')module.exports=api;else root.WorkCounts=api;
})(typeof window!=='undefined'?window:globalThis);
