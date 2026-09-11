// CSV取込の任意列判定パッチ
// 2026-09-11: いいね数・閲覧数がないCSVも安全に取り込む。
// app_v3.js の parseCsv を上書きする。
function parseCsv(text){
  var rows = [];
  var r = [], c = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '"') {
      if (inQ && text[i+1] === '"') { c += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === ',' && !inQ) {
      r.push(c); c = '';
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && text[i+1] === '\n') i++;
      r.push(c); rows.push(r); r = []; c = '';
    } else {
      c += ch;
    }
  }
  if (c !== '' || r.length > 0) { r.push(c); rows.push(r); }

  // ヘッダー行から列名で動的に列番号を取得（メルカリCSV列追加に対応）
  var hdr = rows[0] || [];
  // 完全一致ではなく部分一致で列を探す（BOMや微妙な名称変更に対応）
  function ci(keyword){ 
    for(var j=0; j<hdr.length; j++){
      if(hdr[j] && hdr[j].indexOf(keyword) !== -1) return j;
    }
    return -1; 
  }
  var COL = {
    ID:          ci('商品ID'),
    NAME:        ci('商品名'),
    DESC:        ci('商品説明'),
    STOCK:       ci('在庫数'),         // 'SKU1_在庫数'等の揺れに対応
    CODE:        ci('商品管理コード'), // 'SKU1_商品管理コード'等の揺れに対応
    PRICE:       ci('販売価格'),
    STATUS:      ci('商品ステータス'),
    REG_DATE:    ci('商品登録日時'),
    UPD_DATE:    ci('最終更新日時'),
    BRAND:       ci('ブランドID'),
    SHIP_METHOD: ci('配送方法'),
    SHIP_ORIGIN: ci('発送元の地域'),
    SHIP_DAYS:   ci('発送までの日数'),
    LIKES:       ci('いいね数'),
    VIEWS:       ci('閲覧数')
  };
  // CSV仕様変更を検知した場合は、不正な在庫数や価格で上書きしないよう取込を止める。
  var colLabels = {
    ID:'商品ID', NAME:'商品名', DESC:'商品説明', STOCK:'在庫数', CODE:'商品管理コード',
    PRICE:'販売価格', STATUS:'商品ステータス', REG_DATE:'商品登録日時', UPD_DATE:'最終更新日時',
    BRAND:'ブランドID', SHIP_METHOD:'配送方法', SHIP_ORIGIN:'発送元の地域',
    SHIP_DAYS:'発送までの日数', LIKES:'いいね数', VIEWS:'閲覧数'
  };
  // いいね数・閲覧数はCSVの種類や提供時期によって含まれないため任意。
  // 在庫・価格など業務に必要な列が欠けた場合だけ、安全のため取込を止める。
  var requiredColKeys = ['ID','NAME','DESC','STOCK','CODE','PRICE','STATUS','REG_DATE','UPD_DATE','BRAND','SHIP_METHOD','SHIP_ORIGIN','SHIP_DAYS'];
  var optionalColKeys = ['LIKES','VIEWS'];
  var missingCols = requiredColKeys.filter(function(key){ return COL[key] < 0; });
  var missingOptionalCols = optionalColKeys.filter(function(key){ return COL[key] < 0; });
  if (missingCols.length > 0) {
    pendingRows = [];
    var missingNames = missingCols.map(function(key){ return colLabels[key]; });
    var msg = 'CSVの列構成が変更された可能性があるため、取り込みを中止しました。\n\n'
      + '見つからない列：\n・' + missingNames.join('\n・') + '\n\n'
      + 'メルカリShopsのCSV仕様を確認し、ツールを修正してから再度取り込んでください。';
    console.error('[parseCsv] 必須ヘッダー不足:', missingNames, '受信ヘッダー:', hdr);
    alert(msg);
    return;
  }
  if (missingOptionalCols.length > 0) {
    console.info('[parseCsv] 任意ヘッダーなし（取込は継続）:', missingOptionalCols.map(function(key){ return colLabels[key]; }));
  }

  pendingRows = []; var skip = 0, noCode = 0;
  for(var i = 1; i < rows.length; i++){
    var cols = rows[i];
    if(cols.length < 10){ skip++; continue; }
    var stock = COL.STOCK >= 0 ? (parseInt(cols[COL.STOCK]) || 0) : 0;
    var status = COL.STATUS >= 0 && cols[COL.STATUS] ? cols[COL.STATUS].trim() : '';
    var itemId = COL.ID >= 0 && cols[COL.ID] ? cols[COL.ID].trim() : '';
    var title  = COL.NAME >= 0 && cols[COL.NAME] ? cols[COL.NAME].trim() : '';
    var code   = (COL.CODE >= 0 && cols[COL.CODE] ? cols[COL.CODE].trim() : '') || extractCode(COL.DESC >= 0 && cols[COL.DESC] ? cols[COL.DESC].trim() : '');
    var price  = COL.PRICE >= 0 && cols[COL.PRICE] ? cols[COL.PRICE].trim() : '';
    if(!code){code='CHECK';noCode++;}
    var shopsUrl=itemId?'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/'+itemId:'';
    // 商品説明からハッシュタグ（カテゴリ）を抽出
    var desc = COL.DESC >= 0 && cols[COL.DESC] ? cols[COL.DESC].trim() : '';
    var catM = desc.match(/#[^\s\u3000\r\n,、。！？#]+/);
    var category = catM ? catM[0] : '';
    var symMatch = desc.match(/([●■▲〇□])管理番号/);
    var actualSymbol = symMatch ? symMatch[1] : '';
    var shopsRegAt = COL.REG_DATE >= 0 && cols[COL.REG_DATE] ? cols[COL.REG_DATE].trim() : '';
    var shopsUpdAt = COL.UPD_DATE >= 0 && cols[COL.UPD_DATE] ? cols[COL.UPD_DATE].trim() : '';

    var brandId        = COL.BRAND >= 0 && cols[COL.BRAND] ? cols[COL.BRAND].trim() : '';
    var shippingMethod = COL.SHIP_METHOD >= 0 && cols[COL.SHIP_METHOD] ? cols[COL.SHIP_METHOD].trim() : '';
    var shippingOrigin = COL.SHIP_ORIGIN >= 0 && cols[COL.SHIP_ORIGIN] ? cols[COL.SHIP_ORIGIN].trim() : '';
    var shippingDays   = COL.SHIP_DAYS >= 0 && cols[COL.SHIP_DAYS] ? cols[COL.SHIP_DAYS].trim() : '';
    var likes          = COL.LIKES >= 0 && cols[COL.LIKES] ? (parseInt(cols[COL.LIKES].trim()) || 0) : -1;
    var views          = COL.VIEWS >= 0 && cols[COL.VIEWS] ? (parseInt(cols[COL.VIEWS].trim()) || 0) : -1;
    var _rawCode = COL.CODE >= 0 && cols[COL.CODE] ? cols[COL.CODE].trim() : '';
    var _rawDesc = COL.DESC >= 0 && cols[COL.DESC] ? cols[COL.DESC].trim() : '';
    pendingRows.push({code:code,title:title,price:price,shopsUrl:shopsUrl,shopItemId:itemId,stock:stock,status:status,category:category,shopsRegDate:shopsRegAt,shopsUpdatedAt:shopsUpdAt,actualSymbol:actualSymbol,noCode:!_rawCode&&!extractCode(_rawDesc),brandId:brandId,shippingMethod:shippingMethod,shippingOrigin:shippingOrigin,shippingDays:shippingDays,likes:likes,views:views});
    
  }
  var pa=document.getElementById('prev-area');
  if(!pendingRows.length){pa.innerHTML='<p style="color:var(--red);padding:12px">データが見つかりません</p>';return;}
  var html='<div class="prev-bar">'
    +'<span class="prev-ok">対象: <b>'+pendingRows.length+'件</b></span>'
    +(skip?'<span class="prev-skip">スキップ: '+skip+'件</span>':'')
    +(noCode?'<span class="prev-warn">⚠ 管理番号不明: '+noCode+'件</span>':'')
    +(missingOptionalCols.length?'<span class="prev-skip">補助列なし: '+missingOptionalCols.map(function(key){return colLabels[key];}).join('・')+'（取込可）</span>':'')
    +'</div>'
    +(noCode?'<div style="font-size:0.78rem;color:#fbbf24;padding:8px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.15);border-radius:8px;margin-bottom:10px;"><div style="font-weight:600;margin-bottom:6px;">⚠ 管理番号不明の商品:</div>'+pendingRows.filter(function(r){return r.code==="CHECK";}).map(function(r){return '<div style="font-size:0.75rem;color:#e2e8f0;padding:2px 0;">・'+esc(r.title.slice(0,50))+(r.title.length>50?'…':'')+'</div>';}).join('')+'</div>':'')
    +'<div class="prev-wrap"><table class="prev-tbl">'
    +'<thead><tr><th>管理番号</th><th>商品名</th><th>価格</th><th>Shops</th></tr></thead><tbody>'
        +pendingRows.slice(0,100).map(function(r){
      var isCheck = r.code === 'CHECK';
      return '<tr'+(isCheck?' style="background:rgba(239,68,68,0.12);"':'')+'>'
        +'<td>'+(isCheck
          ? '<span style="color:#f87171;font-size:0.75rem;font-weight:700;">⚠️ 管理番号なし</span><br><span style="color:#e2e8f0;font-weight:600;">'+esc(r.title)+'</span>'
          : '<code>'+esc(r.code)+'</code>')
        +'</td>'
        +(isCheck ? '' : '<td>'+esc(r.title.slice(0,30))+(r.title.length>30?'…':'')+'</td>')
        +(isCheck ? '<td></td>' : '')
        +'<td>&yen;'+Number(r.price||0).toLocaleString()+'</td>'
        +'<td>'+(r.shopsUrl?'<a href="'+r.shopsUrl+'" target="_blank" style="color:#a78bfa;">Shops確認</a>':'-')+'</td>'
        +'</tr>';
    }).join('')
    +(pendingRows.length>25?'<tr><td colspan="4" style="text-align:center;color:var(--tx2);padding:8px">他 '+(pendingRows.length-25)+'件</td></tr>':'')
    +'</tbody></table></div>';
  pa.innerHTML=html;
  document.getElementById('btn-import').style.display='inline-block';
}

