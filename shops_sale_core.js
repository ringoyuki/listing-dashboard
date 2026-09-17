/* Prepares CREATE CSV locally; does not upload or modify listing state. */
(function(root){'use strict';
  const Review=typeof module!=='undefined'?require('./shops_csv_core.js'):root.ShopsCsvReview;
  const edited=['値引き後の表示価格','値引き開始日時','値引き終了日時'];
  function integer(v){return /^\d+$/.test(String(v))&&Number.isSafeInteger(Number(v))?Number(v):null;}
  function time(v){
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))throw Error('日時を入力してください（日本時間）');
    const n=Date.parse(v+':00+09:00');
    if(!Number.isFinite(n)||new Date(n+9*3600000).toISOString().slice(0,16)!==v)throw Error('存在しない日時です');
    if(Number(v.slice(-2))%15)throw Error('日時は15分単位で入力してください');
    return n;
  }
  function validateDates(start,end,now=Date.now()){
    const s=time(start),e=time(end),day=86400000;
    if(s<=now)throw Error('開始日時は現在より後にしてください');
    // Calendar-day upper bound in Japan, matching the official 30-day rule.
    const latest=Math.floor((now+9*3600000)/day)*day-9*3600000+31*day;
    if(s>=latest)throw Error('開始日時は今日から30日先までです');
    if(e<=s||e-s>30*day)throw Error('終了日時は開始後、30日以内にしてください');
  }
  function plan(product,registration,update,options,now=Date.now()){
    validateDates(options.start,options.end,now);
    const amount=integer(options.amount);
    if(!['yen','percent'].includes(options.mode)||amount===null||amount<=0||(options.mode==='percent'&&amount>90))throw Error('値下げ額は正の整数、割合は1〜90で入力してください');
    const analysis=Review.analyze(product,registration,update),sales=new Map(registration.rows.map(r=>[r['商品ID'],r]));
    const rows=analysis.rows.filter(r=>r.status==='候補').map(r=>{
      const source=sales.get(r.id),reference=integer(source['値引き前の価格']);
      const price=options.mode==='yen'?r.price-amount:Math.floor(r.price*(100-amount)/100);
      const reasons=[];
      if(!Number.isSafeInteger(price)||price<300||price>r.price-100)reasons.push('300円以上・現在価格から100円以上の値下げが必要');
      if(price<r.min||price>r.max)reasons.push('CSVの設定可能価格の範囲外');
      if(reference===null||reference<=0||price*100<reference*10||price*100>reference*99)reasons.push('値引き前価格から1〜90％の範囲外');
      if(edited.some(k=>source[k]!==''))reasons.push('未設定CSVに入力済みの価格・日時があります。再取得してください');
      return {...r,salePrice:price,referencePrice:reference,referenceRule:source['値引き前の価格ルール'],eligible:reasons.length===0,saleReasons:reasons};
    });
    return {options:{...options},rows};
  }
  function exportCsv(product,registration,update,options,ids,now=Date.now()){
    if(!ids.length||ids.length>50000||new Set(ids).size!==ids.length)throw Error('出力商品を1〜50,000件、重複なしで選んでください');
    if(registration.headers.includes('処理結果')||registration.headers.includes('エラー理由'))throw Error('処理結果ファイルではなく未設定CSVを再取得してください');
    const preview=plan(product,registration,update,options,now),allowed=new Map(preview.rows.filter(r=>r.eligible).map(r=>[r.id,r]));
    const input=new Map(registration.rows.map(r=>[r['商品ID'],r]));
    const format=t=>t.replaceAll('-','/').replace('T',' ');
    const output=ids.map(id=>{
      if(!allowed.has(id))throw Error('出力できない商品が選択されています：'+id);
      return {...input.get(id),'値引き後の表示価格':String(allowed.get(id).salePrice),'値引き開始日時':format(options.start),'値引き終了日時':format(options.end)};
    });
    const q=v=>'"'+String(v).replaceAll('"','""')+'"';
    return [registration.headers,...output.map(r=>registration.headers.map(h=>r[h]))].map(row=>row.map(q).join(',')).join('\r\n')+'\r\n';
  }
  // Windows CSV encoding using the browser's standard Shift_JIS decoder in reverse.
  // Reject unmappable characters; never silently replace with question marks.
  let sjisMap;
  function encodeSjis(text){
    const decoder=new TextDecoder('shift_jis',{fatal:true});
    if(!sjisMap){
      sjisMap=new Map();
      const add=bytes=>{try{const s=decoder.decode(new Uint8Array(bytes));if([...s].length===1&&!sjisMap.has(s))sjisMap.set(s,bytes);}catch{}};
      for(let a=0;a<=255;a++)add([a]);
      for(let a=0x81;a<=0xfc;a++){if(a>0x9f&&a<0xe0)continue;for(let b=0x40;b<=0xfc;b++){if(b!==0x7f)add([a,b]);}}
    }
    const bytes=[];for(const c of text){const b=sjisMap.get(c);if(!b)throw Error('Shift_JISで保存できない文字があります：'+c);bytes.push(...b);}
    const out=new Uint8Array(bytes);if(decoder.decode(out)!==text)throw Error('CSVの文字コード検証に失敗しました');return out;
  }
  const api={plan,exportCsv,validateDates,encodeSjis};if(typeof module!=='undefined')module.exports=api;root.ShopsSaleCsv=api;
})(typeof globalThis!=='undefined'?globalThis:this);
