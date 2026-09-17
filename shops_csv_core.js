/* Read-only CSV reconciliation. Never join listings by title or management code. */
(function(root){
  'use strict';
  const required={
    product:['商品ID','商品名','販売価格','商品ステータス','SKU1_現在の在庫数'],
    registration:['処理フラグ','商品ID','商品名','現在価格','値引き前の価格','値引き前の価格ルール','値引き後の表示価格','設定可能な値引き後の最低価格','設定可能な値引き後の最高価格','値引き開始日時','値引き終了日時','いいね数','閲覧数'],
    update:['処理フラグ','商品ID','商品名','現在価格','値引き開始日時','値引き終了日時','いいね数','閲覧数']
  };
  function parse(text,kind){
    if(!required[kind])throw Error('CSVの種類が不明です');
    text=text.replace(/^\uFEFF/,'');
    let table=[],row=[],cell='',quoted=false,closed=false;
    function field(){row.push(cell);cell='';closed=false;}
    function line(){field();if(row.some(v=>v!==''))table.push(row);row=[];}
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
      if(c===','){field();continue;}
      if(c==='\r'||c==='\n'){line();if(c==='\r'&&text[i+1]==='\n')i++;continue;}
      if(closed)throw Error('CSVの引用符の後に不正な文字があります');
      if(c==='"'){if(cell!=='')throw Error('CSVの引用符が不正です');quoted=true;}else cell+=c;
    }
    if(quoted)throw Error('CSVの引用符が閉じていません');
    if(cell!==''||row.length||closed)line();
    const headers=table.shift()||[];
    if(new Set(headers).size!==headers.length)throw Error('CSVに重複した列名があります');
    const absent=required[kind].filter(k=>!headers.includes(k));
    if(absent.length)throw Error('CSVの種類または列を確認してください。不足：'+absent.join('、'));
    let samples=0;
    const rows=table.map((r,i)=>{if(r.length!==headers.length)throw Error((i+2)+'行目の列数が違います');return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));}).filter(r=>{
      if(kind==='product')return true;
      const flag=r['処理フラグ'];
      if(flag==='# CREATE'||flag==='# UPDATE'){samples++;return false;}
      if(flag!==(kind==='registration'?'CREATE':'UPDATE'))throw Error('処理フラグを確認してください：'+flag);
      return true;
    });
    rows.forEach(r=>{if(!r['商品ID']||r['商品ID']!==r['商品ID'].trim())throw Error('空欄または前後に空白のある商品IDがあります');});
    if(kind==='product'&&!rows.length)throw Error('商品CSVに商品がありません');
    return {headers,rows,samples};
  }
  function number(v){return typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null;}
  function index(rows){const m=new Map();for(const r of rows){const id=r['商品ID'];if(!m.has(id))m.set(id,[]);m.get(id).push(r);}return m;}
  function analyze(product,registration,update){
    const p=index(product.rows),r=index(registration.rows),u=index(update.rows);
    const rows=[];
    for(const [id,products] of p){
      const item=products[0],rs=r.get(id)||[],us=u.get(id)||[];
      const reasons=[];
      if(products.length!==1||rs.length>1||us.length>1)reasons.push('商品ID重複');
      if(rs.length&&us.length)reasons.push('未設定・設定済みの両方に存在');
      const price=number(item['販売価格']);
      const keys=product.headers.filter(k=>/^SKU\d+_現在の在庫数$/.test(k));
      const stocks=keys.map(k=>item[k]===''?0:number(item[k]));
      const stock=stocks.some(n=>n===null)?null:stocks.reduce((a,b)=>a+b,0);
      if(item['商品ステータス']!=='2')reasons.push('公開中ではない');
      if(stock===null)reasons.push('在庫数不正');else if(stock<=0)reasons.push('在庫ゼロ');
      if(price===null||price<300)reasons.push('商品価格不正');
      if(us.length)reasons.push('タイムセール設定済み');
      if(!rs.length&&!us.length)reasons.push('タイムセールCSVに現行IDなし');
      const sale=rs[0]||us[0];
      if(sale&&number(sale['現在価格'])!==price)reasons.push('CSV間の現在価格が不一致');
      if(sale&&sale['商品名']!==item['商品名'])reasons.push('同一IDの商品名が不一致');
      const low=rs.length?number(rs[0]['設定可能な値引き後の最低価格']):null;
      const high=rs.length?number(rs[0]['設定可能な値引き後の最高価格']):null;
      if(rs.length&&(low===null||high===null||low>high))reasons.push('設定可能価格が不正');
      const reaction=products.length===1&&rs.length+us.length===1?sale:null;
      rows.push({id,code:item['SKU1_商品管理コード']||'',title:item['商品名'],price,stock,
        status:reasons.length?'対象外':'候補',reasons,likes:reaction?number(reaction['いいね数']):null,
        views:reaction?number(reaction['閲覧数']):null,reactionSource:reaction?(rs.length?'未設定CSV':'設定済みCSV'):null,
        min:low,max:high,registered:item['商品登録日時']||'',saleStart:us[0]?.['値引き開始日時']||'',saleEnd:us[0]?.['値引き終了日時']||''});
    }
    for(const [source,idx] of [['未設定CSV',r],['設定済みCSV',u]])for(const [id,entries]of idx){
      if(p.has(id))continue;
      rows.push({id,code:entries[0]['SKU1_商品管理コード']||'',title:entries[0]['商品名'],status:'照合不能',reasons:['商品CSVに同じ商品IDなし',...(entries.length>1?['商品ID重複']:[])],likes:null,views:null,reactionSource:null,source});
    }
    return {format:'shops-csv-review-v1',createdAt:new Date().toISOString(),counts:{products:product.rows.length,registration:registration.rows.length,update:update.rows.length,candidates:rows.filter(x=>x.status==='候補').length,excluded:rows.filter(x=>x.status==='対象外').length,unmatched:rows.filter(x=>x.status==='照合不能').length},rows};
  }
  const api={parse,analyze};
  if(typeof module!=='undefined')module.exports=api;
  root.ShopsCsvReview=api;
})(typeof globalThis!=='undefined'?globalThis:this);
