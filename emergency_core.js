/* Pure emergency batch rules. No network, no credentials, no storage writes. */
(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const same=(a,b)=>stable(a)===stable(b);
 function stable(x){if(Array.isArray(x))return '['+x.map(stable).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';return JSON.stringify(x);}
 function assert(ok,msg){if(!ok)throw Error(msg);}
 function decode(x){return typeof x==='string'?JSON.parse(x):clone(x);}
 function snapshot(raw){
  assert(raw&&typeof raw==='object','JSONを確認してください');
  const items=decode(raw.listing_mgr_v5||'[]'),data=decode(raw.sale_data_v1||'{}');
  assert(Array.isArray(items)&&data&&!Array.isArray(data)&&typeof data==='object','通常バックアップJSONではありません');
  const seen=new Set();for(const i of items){if(!i.code)continue;assert(!seen.has(i.code),'管理番号が重複しています：'+i.code);seen.add(i.code);}
  return {raw:clone(raw),items,data};
 }
 const symbols=['●','■','▲','〇','□'];
 function settings(s){
  assert(s&&typeof s.salesEnabled==='boolean'&&typeof s.splitEnabled==='boolean','ON/OFF設定を確認してください');
  assert(['fixed','percent'].includes(s.discountMode),'値下げ方式を確認してください');
  assert(Number.isSafeInteger(s.discountValue)&&s.discountValue>0&&s.discountValue<=(s.discountMode==='percent'?50:100000),'値下げ額・率が範囲外です');
  assert(Array.isArray(s.rates)&&s.rates.length===5&&s.rates[0]===100,'記号の割合を確認してください');
  s.rates.forEach((v,n)=>assert(Number.isFinite(v)&&v>0&&v<=100&&(!n||v<s.rates[n-1]),'記号の割合は100から順に小さくしてください'));
  assert(Number.isSafeInteger(s.interval)&&s.interval>=1&&s.interval<=365,'日数を確認してください');
  assert(Number.isSafeInteger(s.highPrice)&&s.highPrice>=300,'高額基準を確認してください');
  return clone(s);
 }
 const defaults={salesEnabled:false,splitEnabled:true,discountMode:'fixed',discountValue:500,rates:[100,95,90,80,72],interval:10,highPrice:30000};
 function prices(base){assert(Number.isSafeInteger(base)&&base>=300,'指定価格は300円以上の整数です');return {shops:base,mercari:base+1000,rakuma:base,yahoo_flea:Math.floor(base/1000)*1000||null,yahoo_auction:base};}
 function active(sd){return (sd.tasks||[]).some(t=>t.type==='revert_check'&&t.status==='pending')||!!(sd.trial20261004&&!sd.trial20261004.legacyReleased);}
 function propose(item,sd,s){
  settings(s);sd=sd||{};const sym=sd.symbol||item.actualSymbol||'●',idx=symbols.indexOf(sym),price=Number(item.price);
  assert(!['stop','relist'].includes(sd.ownerInstruction),'停止・再出品指示の商品は個別確認です');
  assert(!/対応済|作業不要/.test(sd.ownerInstructionNote||''),'対応済み・作業不要の指示があります');
  assert(!item.emergencyReview,'CSV変更等の確認が必要です：'+(item.emergencyReview||''));
  assert(!sd.symbol||!item.actualSymbol||sd.symbol===item.actualSymbol,'ツールと実商品の記号が不一致です');
  assert(idx>=0,'記号を確認してください');assert(price>=300&&Number.isSafeInteger(price),'現在価格を確認してください');
  assert(Number(item.stock)>0&&String(item.status)!=='1','在庫・公開状態を確認してください');
  assert(!active(sd),'セールの終了・取消確認を先に行ってください');
  const pending=(sd.tasks||[]).filter(t=>t.status==='pending').sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
  const discount=pending[0]&&pending[0].type==='price_discount';
  assert(pending.every(t=>['price_discount','symbol_change'].includes(t.type)),'単純作業以外の未完了タスクがあります');
  assert(discount||idx<4,'最終記号の商品はオーナーの個別判断が必要です');
  const target=discount ? price-(s.discountMode==='fixed'?s.discountValue:Math.floor(price*s.discountValue/100)) : Math.floor(price/s.rates[idx]*s.rates[idx+1]/100)*100;
  assert(target>=300&&target<price,'提案価格が範囲外です。個別指定を確認してください');
  return {kind:discount?'price_discount':'symbol_change',symbol:discount?sym:symbols[idx+1],price:target,approvalRequired:discount?(price/(s.rates[idx]/100)>=s.highPrice&&price-target!==500):(price/(s.rates[idx]/100)>=s.highPrice||idx>=2),note:'提案値です。オーナーの個別指定があればそちらを入力してください。'};
 }
 function create(raw,assignments,s,id,at){
  const snap=snapshot(raw);s=settings(s);assert(typeof id==='string'&&id.length>5,'バッチIDが必要です');
  assert(assignments.length>0,'担当商品を選択してください');const seen=new Set();
  const jobs=assignments.map(a=>{
   assert(!seen.has(a.code),'担当商品が重複しています');seen.add(a.code);
   assert(['A','B'].includes(a.role),'担当を確認してください');assert(s.splitEnabled||a.role==='A','分担OFFではAのみです');
   const item=snap.items.find(i=>i.code===a.code),sd=snap.data[a.code]||{};assert(item,'商品が見つかりません');
   const first=(sd.tasks||[]).filter(t=>t.status==='pending').sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)))[0];
   assert(!first||!first.dueDate||first.dueDate<=at.slice(0,10),'将来のタスクです：'+a.code);
   const p=propose(item,sd,s);assert(symbols.includes(a.symbol),'指定記号を確認してください');
   assert(a.symbol===p.symbol,'予定と異なる記号は確認が必要です');
   assert(Number.isSafeInteger(a.price)&&a.price>=300&&a.price<=Number(item.price),'指定価格は現在価格以下・300円以上です');
   assert(!p.approvalRequired||a.approved===true,'オーナー承認を確認してください');
   assert(p.kind!=='price_discount'||Number(item.price)/(s.rates[symbols.indexOf(sd.symbol||item.actualSymbol||'●')]/100)<s.highPrice||Number(item.price)-a.price===500||a.approved===true,'高額商品の500円以外の値下げは承認が必要です');
   return {code:a.code,role:a.role,kind:p.kind,symbol:a.symbol,price:a.price,approved:a.approved===true,baseItem:clone(item),baseData:clone(sd),platforms:prices(a.price)};
  });return {format:'listing-ab-master-v1',id,createdAt:at,settings:s,raw:snap.raw,jobs,applied:{}};
 }
 function pack(master,role){assert(['A','B'].includes(role),'担当を確認してください');return {format:'listing-ab-work-v1',id:master.id,createdAt:master.createdAt,role,settings:clone(master.settings),jobs:master.jobs.filter(j=>j.role===role&&!master.applied[j.code]).map(j=>({code:j.code,role:j.role,kind:j.kind,symbol:j.symbol,price:j.price,platforms:clone(j.platforms),baseItem:{code:j.code,title:j.baseItem.title,price:j.baseItem.price,shopItemId:j.baseItem.shopItemId,shopsUrl:j.baseItem.urls&&j.baseItem.urls.mercari_shops}}))};}
 function record(job,checks,at){
  assert(Number.isFinite(Date.parse(at)),'完了日時が不正です');
  assert(checks&&checks.shops&&checks.shops.status==='done','Shopsの作業確認が必要です');
  assert(checks&&Object.keys(job.platforms).every(p=>{
   const c=checks[p];if(!c)return false;
   if(c.status==='unlisted')return c.confirmed===true;
   return c.status==='done'&&c.confirmed===true&&job.platforms[p]!==null&&(c.declaredAction?(['price','symbol','both','none'].includes(c.declaredAction)):(Number.isSafeInteger(c.before)&&c.before>=300))&&c.price===job.platforms[p]&&c.symbolConfirmed===true;
  }),'各販路で商品・指定価格・記号を確認してください。見つからないだけで未出品にしないでください');
  return {code:job.code,role:job.role,status:'done',checks:clone(checks),completedAt:at};
 }
 function simpleCandidates(raw,s,today,excluded){
  const snap=snapshot(raw),skip=new Set(excluded||[]),out=[];
  for(const item of snap.items){try{
   if(skip.has(item.code)||!/[a-zA-Z]/.test(item.code)||item.code==='CHECK')continue;
   const sd=snap.data[item.code]||{},p=propose(item,sd,s);
   if(p.approvalRequired||sd.ownerInstructionNote||sd.ownerReportAwaitingReplyKey)continue;
   if(prices(p.price).yahoo_flea===null)continue;
   const dates=[item.saleBasisAt||item.shopsUpdatedAt||item.shopsRegDate,sd.symbolChangedAt,sd.lastActionAt,...(sd.tasks||[]).map(t=>t.completedAt)].filter(Boolean).map(v=>String(v).replace(/\//g,'-').slice(0,10)).filter(v=>Number.isFinite(Date.parse(v+'T00:00:00Z'))).sort();
   const basis=dates[dates.length-1]||'';
   const age=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(basis+'T00:00:00Z'))/86400000);
   if(!Number.isFinite(age)||age<s.interval)continue;
   const first=(sd.tasks||[]).filter(t=>t.status==='pending').sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)))[0];
   if(first&&first.dueDate>today)continue;
   out.push({code:item.code,age,symbol:p.symbol,price:p.price,approved:false});
  }catch(e){/* Individual exceptions stay with the owner; never fabricate an action. */}}
  return out.sort((a,b)=>b.age-a.age||a.code.localeCompare(b.code));
 }
 function appendSimple(master,role,count,at){
  assert(Number.isSafeInteger(count)&&count>0&&count<=100,'追加件数を確認してください');
  const candidates=simpleCandidates(master.raw,master.settings,at.slice(0,10),master.jobs.map(j=>j.code)).slice(0,count);
  assert(candidates.length,'追加できる単純作業の商品がありません');
  const added=create(master.raw,candidates.map(c=>({...c,role})),master.settings,master.id,at);
  const out=clone(master);out.jobs.push(...added.jobs);return out;
 }
 function merge(master,result,currentRaw){
  assert(master.format==='listing-ab-master-v1'&&result.format==='listing-ab-result-v1'&&master.id===result.id,'配布回が違います');
  assert(['A','B'].includes(result.role)&&Array.isArray(result.records),'結果ファイルを確認してください');
  const out=clone(master),snap=snapshot(currentRaw||master.raw),seen=new Set(),conflicts=[],applied=[],duplicates=[];
  for(const r of result.records){
   assert(!seen.has(r.code),'結果内の重複商品があります');seen.add(r.code);
   const job=master.jobs.find(j=>j.code===r.code&&j.role===result.role);assert(job&&r.role===result.role,'担当外の商品が含まれます');
   record(job,r.checks,r.completedAt);assert(r.status==='done'&&Number.isFinite(Date.parse(r.completedAt)),'完了記録が不正です');
   const previous=out.applied[r.code];
   if(previous){assert(same(previous,r),'同じ商品の異なる結果です。確認が必要です');duplicates.push(r.code);continue;}
   const i=snap.items.find(i=>i.code===r.code),sd=snap.data[r.code]||{};
   if(!same(i,job.baseItem)||!same(sd,job.baseData)){conflicts.push(r.code);continue;}
   const day=r.completedAt.slice(0,10),next=clone(sd);next.symbol=job.symbol;next.symbolChangedAt=job.kind==='symbol_change'?day:next.symbolChangedAt;next.lastActionAt=day;
   next.tasks=next.tasks||[];next.tasks.forEach(t=>{if(t.status==='pending'&&t.type===job.kind&&(!t.dueDate||t.dueDate<=day)){t.status='done';t.completedAt=day;t.emergencyBatch=master.id;}});
   next.tasks.push({id:master.id+'_'+r.code,type:'emergency_change',status:'done',dueDate:day,completedAt:day,desc:job.symbol+'／指定価格 '+job.price+'円',emergencyBatch:master.id,staffRole:job.role});
   if(!next.tasks.some(t=>t.status==='pending')&&job.symbol!=='□'){
    const due=new Date(day+'T00:00:00Z');due.setUTCDate(due.getUTCDate()+master.settings.interval);
    next.tasks.push({id:master.id+'_'+r.code+'_next',type:'symbol_change',status:'pending',dueDate:due.toISOString().slice(0,10),desc:symbols[symbols.indexOf(job.symbol)+1]+' に記号変更'});
   }
   next.emergencyLastResult=clone(r);snap.data[r.code]=next;
   // Shops was actually changed; do not assert stock or other platforms' live state.
   if(r.checks.shops.status==='done'){i.price=job.price;i.actualSymbol=job.symbol;i.saleBasisAt=day;}
   out.applied[r.code]=clone(r);applied.push(r.code);
  }
  snap.raw.listing_mgr_v5=JSON.stringify(snap.items);snap.raw.sale_data_v1=JSON.stringify(snap.data);out.raw=snap.raw;
  return {master:out,raw:snap.raw,applied,duplicates,conflicts};
 }
 function validateWork(w){
  assert(w&&w.format==='listing-ab-work-v1'&&typeof w.id==='string'&&['A','B'].includes(w.role)&&Array.isArray(w.jobs),'担当別の配布ファイルではありません');settings(w.settings);
  const seen=new Set();for(const j of w.jobs){assert(typeof j.code==='string'&&!seen.has(j.code)&&j.role===w.role,'担当・管理番号を確認してください');seen.add(j.code);assert(j.baseItem&&j.baseItem.code===j.code&&symbols.includes(j.symbol)&&['symbol_change','price_discount'].includes(j.kind),'商品データを確認してください');assert(same(j.platforms,prices(j.price)),'販路の指定価格が不一致です');}return w;
 }
 const api={defaults,settings,snapshot,propose,create,pack,record,merge,prices,stable,simpleCandidates,appendSimple,validateWork};if(typeof module!=='undefined')module.exports=api;else root.EmergencyCore=api;
})(typeof window!=='undefined'?window:globalThis);
