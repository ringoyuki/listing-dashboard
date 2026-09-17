/* Existing assigned instructions -> minimal Shops update CSV. No task mutations. */
(function(root){'use strict';
 const symbols=['●','■','▲','〇','□'];
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 function instructions(raw){
  let jobs,done=new Set();
  if(raw?.format==='listing-ab-master-v1'){jobs=raw.jobs;done=new Set(Object.keys(raw.applied||{}));}
  else if(raw?.format==='listing-ab-work-v1')jobs=raw.jobs;
  else if(raw?.format==='listing-ab-result-v1'&&raw.resume?.work){jobs=raw.resume.work.jobs;done=new Set((raw.records||[]).map(r=>r.code));
   for(const [code,checks]of Object.entries(raw.resume.drafts||{}))if(['done','sold','missing','unlisted'].includes(checks?.shops?.status))done.add(code);
  }else throw Error('A・B配布JSON、作業結果JSON、またはオーナー管理元JSONを選んでください');
  check(Array.isArray(jobs)&&jobs.length>0,'指定商品がありません');const seen=new Set();
  for(const j of jobs){check(j&&typeof j.code==='string'&&j.code.length>0&&j.code.trim()===j.code&&!seen.has(j.code),'管理番号が重複または不正です');seen.add(j.code);
   check(['A','B'].includes(j.role)&&symbols.includes(j.symbol)&&['symbol_change','price_discount'].includes(j.kind),'担当・記号・作業種別が不正です');
   check(Number.isSafeInteger(j.price)&&j.price>=300&&j.price<=9999999&&j.platforms?.shops===j.price,'指定価格が不正です');
   check(j.baseItem?.code===j.code,'指示と元商品の管理番号が違います');
  }return {jobs,done};
 }
 function changeSymbol(description,code,target){
  check(typeof description==='string'&&description.length>0,'商品説明がありません');
  // Replace precisely the symbol preceding the management heading; retain every other byte of text.
  const matches=[...description.matchAll(/(^|\r\n|\n|\r)([ \t　]*)([●■▲〇□○△])[ \t　]*管理番号[^\r\n]*(?:\r\n|\n|\r)([^\r\n]*)/g)];
  check(matches.length===1,'管理番号欄の記号を一意に確認できません');
  const m=matches[0];check(m[4].trim()===code,'商品説明の管理番号が一致しません');
  const at=m.index+m[1].length+m[2].length,before=m[3];
  return {before,after:description.slice(0,at)+target+description.slice(at+1)};
 }
 function plan(product,update,raw){
  check(product.headers.includes('商品説明'),'商品CSVに商品説明がありません');
  const {jobs,done}=instructions(raw),byId=new Map(),scheduled=new Set(update.rows.map(r=>r['商品ID'])),jobIds=new Map();
  for(const j of jobs){const id=j.baseItem.shopItemId;jobIds.set(id,(jobIds.get(id)||0)+1);}
  for(const r of product.rows){const id=r['商品ID'];if(!byId.has(id))byId.set(id,[]);byId.get(id).push(r);}
  return jobs.map(j=>{
   const out={code:j.code,role:j.role,id:j.baseItem.shopItemId||'',title:j.baseItem.title||'',targetPrice:j.price,targetSymbol:j.symbol,eligible:false,reasons:[]};
   try{
    check(!done.has(j.code),'作業結果または管理元で対応済み');
    check(typeof out.id==='string'&&out.id.length>0,'指示JSONに商品IDがありません');
    check(jobIds.get(out.id)===1,'指示JSONの商品IDが重複しています');
    const rows=byId.get(out.id);check(rows?.length===1,rows?'商品CSVの商品ID重複':'商品CSVに同じ商品IDなし');const item=rows[0];
    out.title=item['商品名'];out.beforePrice=Number(item['販売価格']);
    check(!scheduled.has(out.id),'タイムセール設定済み');
    check(item['商品ステータス']==='2','公開中ではない');
    const stocks=product.headers.filter(k=>/^SKU\d+_現在の在庫数$/.test(k)).map(k=>item[k]===''?0:/^\d+$/.test(item[k])?Number(item[k]):NaN);
    check(stocks.length&&stocks.every(Number.isSafeInteger)&&stocks.reduce((a,b)=>a+b,0)>0,'在庫ゼロまたは在庫数不正');
    check(!item['SKU1_商品管理コード']||item['SKU1_商品管理コード']===j.code,'商品管理コードが不一致');
    check(item['商品名']===j.baseItem.title,'配布後に商品名が変更されています');
    check(Number.isSafeInteger(out.beforePrice)&&out.beforePrice>=300,'現在価格が不正です');
    check(out.beforePrice===Number(j.baseItem.price)||out.beforePrice===j.price,'配布後に価格が変更されています');
    const changed=changeSymbol(item['商品説明'],j.code,j.symbol);out.beforeSymbol=changed.before;
    const normalized=changed.before==='○'?'〇':changed.before;
    check(symbols.includes(normalized),'旧記号「△」のため個別確認');
    check(normalized===j.symbol||(j.kind==='symbol_change'&&symbols.indexOf(normalized)===symbols.indexOf(j.symbol)-1),'記号の進行状況が指示と一致しません');
    out.priceChanged=out.beforePrice!==j.price;out.symbolChanged=changed.before!==j.symbol;
    check(out.priceChanged||out.symbolChanged,'すでに指定価格・記号です（変更不要）');
    out.description=changed.after;out.eligible=true;
   }catch(e){out.reasons.push(e.message);}return out;
  });
 }
 function exportFiles(product,update,raw,ids){
  check(ids.length>0&&ids.length<=10000&&new Set(ids).size===ids.length,'出力対象を重複なしで選んでください');
  const allowed=new Map(plan(product,update,raw).filter(r=>r.eligible).map(r=>[r.id,r]));
  const groups=new Map(),q=v=>'"'+String(v).replaceAll('"','""')+'"';
  for(const id of ids){check(allowed.has(id),'出力対象外の商品が選ばれています');const r=allowed.get(id);
   const type=r.priceChanged?(r.symbolChanged?'price_symbol':'price'):'symbol';
   if(!groups.has(type))groups.set(type,[]);groups.get(type).push(r);
  }
  return [...groups].map(([type,rows])=>{
   const headers=['商品ID',...(type!=='symbol'?['販売価格']:[]),...(type!=='price'?['商品説明']:[])];
   return {type,count:rows.length,csv:[headers,...rows.map(r=>[r.id,...(type!=='symbol'?[r.targetPrice]:[]),...(type!=='price'?[r.description]:[])])].map(row=>row.map(q).join(',')).join('\r\n')+'\r\n'};
  });
 }
 const api={instructions,changeSymbol,plan,exportFiles};if(typeof module!=='undefined')module.exports=api;root.ShopsPriceCsv=api;
})(typeof globalThis!=='undefined'?globalThis:this);
