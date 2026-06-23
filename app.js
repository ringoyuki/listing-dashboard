// ===== パスワード認証 =====
var PASS = '132';
function toHalfWidth(str) {
  return str.replace(/[０-９]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}
function checkAuth() {
  var raw = document.getElementById('inp-pass').value;
  var val = toHalfWidth(raw).trim();
  if(val === PASS) {
    localStorage.setItem('auth_ok', 'true');
    recordLogin(true); // ← ログイン記録
    initApp();
  } else {
    document.getElementById('login-err').textContent = 'パスワードが違います';
    recordLogin(false); // ← 失敗も記録
  }
}

// ===== ログイン履歴記録 =====
function recordLogin(success) {
  var now = new Date();
  var ts = now.getFullYear() + '/' +
    ('0'+(now.getMonth()+1)).slice(-2) + '/' +
    ('0'+now.getDate()).slice(-2) + ' ' +
    ('0'+now.getHours()).slice(-2) + ':' +
    ('0'+now.getMinutes()).slice(-2);
  var ua = navigator.userAgent;
  var device = /iPhone|iPad/.test(ua) ? '📱 iPhone/iPad'
    : /Android/.test(ua) ? '📱 Android'
    : /Windows/.test(ua) ? '💻 Windows'
    : /Mac/.test(ua) ? '💻 Mac'
    : '🖥 その他';
  var browser = /Chrome/.test(ua) && !/Edg/.test(ua) ? 'Chrome'
    : /Edg/.test(ua) ? 'Edge'
    : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari'
    : 'その他';
  var log = JSON.parse(localStorage.getItem('login_log') || '[]');
  log.unshift({ ts: ts, device: device, browser: browser, ok: success });
  if (log.length > 30) log = log.slice(0, 30); // 最新30件のみ保持
  localStorage.setItem('login_log', JSON.stringify(log));
}

function showLoginLog() {
  var log = JSON.parse(localStorage.getItem('login_log') || '[]');
  var modal = document.getElementById('login-log-modal');
  var body = document.getElementById('login-log-body');
  if (!log.length) {
    body.innerHTML = '<p style="color:var(--tx2);padding:16px;">まだ履歴がありません</p>';
  } else {
    body.innerHTML = log.map(function(l) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">'
        + '<span style="font-size:0.8rem;color:var(--tx2);white-space:nowrap;">' + l.ts + '</span>'
        + '<span>' + l.device + '</span>'
        + '<span style="font-size:0.8rem;color:var(--tx2);">' + l.browser + '</span>'
        + (l.ok
          ? '<span style="margin-left:auto;font-size:0.75rem;color:#4ade80;font-weight:700;">✅ 成功</span>'
          : '<span style="margin-left:auto;font-size:0.75rem;color:#f87171;font-weight:700;">❌ 失敗</span>')
        + '</div>';
    }).join('');
  }
  modal.classList.add('open');
}
function closeLoginLog() {
  document.getElementById('login-log-modal').classList.remove('open');
}

function initApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-main').style.display = 'block';
  // 更新日時を復元
  var ua = document.getElementById('csv-updated-at');
  if (ua) {
    var saved = localStorage.getItem('csv_updated_at');
    if (saved) ua.textContent = saved;
  }
  // データロードなど
  load();
  if(window._SEED_DATA && items.length===0){
    items=window._SEED_DATA; save();
    showToast('✅ '+items.length+'件 読み込みました',3000);
  }
  updateStats();
}
// 起動時の判定
document.addEventListener('DOMContentLoaded', function(){
  if(localStorage.getItem('auth_ok') === 'true') {
    initApp();
  }
});

// ===== プラットフォーム定義 =====
// preferTitle: 全部開く時にタイトル検索を優先する
var PLATS = [
  { key:'mercari_shops', name:'メルカリShops', emoji:'🛍',
    codeSearch:false, titleSearch:false, preferTitle:false },
  { key:'mercari',       name:'メルカリ',      emoji:'🔴',
    codeSearch:true,  titleSearch:true,  preferTitle:false },
  { key:'yahoo_auction', name:'ヤフオク',       emoji:'🟠',
    codeSearch:false, titleSearch:true,  preferTitle:true },
  { key:'rakuma',        name:'ラクマ',         emoji:'🟣',
    codeSearch:true,  titleSearch:true,  preferTitle:true },  // ラクマはタイトル優先
  { key:'yahoo_flea',    name:'Yahoo!フリマ',   emoji:'🟡',
    codeSearch:true,  titleSearch:true,  preferTitle:false }
];

// 検索URL生成
function makeUrl(platKey, type, code, title) {
  var qc = encodeURIComponent(code  || '');
  var qt = encodeURIComponent(title || '');
  // ラクマはタイトル最大40文字のため、スペース区切りでキリよく切り詰める
  var _rt = (title || '').length > 40 ? (title||'').slice(0,40) : (title||'');
  var _sp = _rt.lastIndexOf(' ');
  var qtRakuma = encodeURIComponent(_sp > 0 ? _rt.slice(0, _sp) : _rt);
  if (type === 'code') {
    if (platKey === 'mercari')    return 'https://jp.mercari.com/search?keyword=' + qc;
    if (platKey === 'rakuma')     return 'https://fril.jp/s?query=' + qc;
    if (platKey === 'yahoo_flea') return 'https://paypayfleamarket.yahoo.co.jp/search/' + qc + '?page=1';
  }
  if (type === 'title') {
    if (platKey === 'mercari')       return 'https://jp.mercari.com/search?keyword=' + qt;
    if (platKey === 'yahoo_auction') return 'https://auctions.yahoo.co.jp/search/search?auccat=&tab_ex=commerce&ei=utf-8&aq=-1&oq=&sc_i=&fr=auc_top&p=' + qt;
    if (platKey === 'rakuma')        return 'https://fril.jp/s?query=' + qtRakuma;
    if (platKey === 'yahoo_flea')    return 'https://paypayfleamarket.yahoo.co.jp/search/' + qt + '?page=1';
  }
  return null;
}

// ===== STATE =====
var items = [];
var pendingRows = [];
var SK = 'listing_mgr_v5';

function load(){ try{ var r=localStorage.getItem(SK); items=r?JSON.parse(r):[]; }catch(e){items=[];} }
function save(){ localStorage.setItem(SK,JSON.stringify(items)); }
function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }

function showToast(msg, dur){
  dur=dur||2500;
  var el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  setTimeout(function(){el.classList.remove('show');},dur);
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function updateStats(){ document.getElementById('stat-total').textContent = items.length; }

// ===== 検索 =====
function doSearch(){
  var code  = document.getElementById('inp-code').value.trim();
  var title = document.getElementById('inp-title').value.trim();
  if (!code && !title){ showToast('管理番号か商品名を入力してください'); return; }

  var lc = code.toLowerCase();
  var lt = title.toLowerCase();

  var matched = items.filter(function(item){
    var matchCode = false;
      if (code) {
        var ic = (item.code || '').toLowerCase();
        var it = (item.title || '').toLowerCase();
        if (ic && (ic.indexOf(lc) >= 0 || lc.indexOf(ic) >= 0)) matchCode = true;
        if (it && (it.indexOf(lc) >= 0 || lc.indexOf(it) >= 0)) matchCode = true;
      }
      var matchTitle = false;
      if (title) {
        var it2 = (item.title || '').toLowerCase();
        if (it2.indexOf(lt) >= 0) {
          matchTitle = true;
        }
      }
      if (code && title) return matchCode || matchTitle;
      if (code) return matchCode;
      if (title) return matchTitle;
      return false;
  });

  // 完全一致を上位に
  matched.sort(function(a,b){
    var aE = (code && a.code && a.code.toLowerCase()===lc) ? 0 : 1;
    var bE = (code && b.code && b.code.toLowerCase()===lc) ? 0 : 1;
    return aE - bE;
  });

  var el = document.getElementById('results');

    if (!matched.length) {
    var dict = JSON.parse(localStorage.getItem('item_dict') || '{}');
    var hist = null;
    if (code) {
      var keys = Object.keys(dict);
      for(var k=0; k<keys.length; k++){
        var dk = keys[k].toLowerCase();
        if(dk && (dk.indexOf(lc) >= 0 || lc.indexOf(dk) >= 0)){
          hist = dict[keys[k]];
          break;
        }
      }
    }
    if (code && hist) {
      var urls = {};
      if(hist.shopsUrl) urls['mercari_shops'] = hist.shopsUrl;
      matched.push({ code: code, title: hist.title, stock: 0, urls: urls });
    } else {
      el.innerHTML = renderNotFound(code, title);
      return;
    }
  }

  el.innerHTML = matched.slice(0,20).map(function(item){
    return renderCard(item, code, title);
  }).join('');
}

// ===== 商品が見つからない場合 =====
function renderNotFound(code, title) {
  var warn = '';
  if (code) {
    warn = '<div class="warn-box">'
      + '<div class="warn-title">⚠ 「' + esc(code) + '」はShopsの在庫データにありません</div>'
      + '<div class="warn-body">※ 番号の間違い、Shopsで売却済みの商品、または他プラットフォームの消し忘れの可能性があります。</div>'
      + '</div>';
  }

  // それでも各プラットで検索できるボタンを表示
  var rows = PLATS.map(function(p){
    if (p.key === 'mercari_shops') {
        var su = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products?keyword=' + encodeURIComponent(code);
        return '<div class="plat-row">'
          + '<div class="plat-name">' + p.emoji + ' ' + p.name + '</div>'
          + '<div class="plat-actions"><span style="color:#f87171;font-size:0.85rem;margin-right:10px;font-weight:bold;">📦 Shops在庫なし</span><a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops">↗ 検索で開く</a></div>'
          + '</div>';
      }
    var actions = '';
    if (p.codeSearch && code)  actions += '<a href="'+esc(makeUrl(p.key,'code',code,title))+'" target="_blank" class="pbtn pbtn-code">コードで検索</a>';
    if (p.titleSearch) actions += '<a href="'+esc(makeUrl(p.key,'title',code,title))+'" target="_blank" class="pbtn pbtn-title">タイトルで検索</a>';
    if (p.key === 'yahoo_auction') actions = '<a href="'+esc(makeUrl('yahoo_auction','title',code,title))+'" target="_blank" class="pbtn pbtn-title">タイトルで検索</a>';
    return '<div class="plat-row">'
      + '<div class="plat-name">' + p.emoji + ' ' + p.name + '</div>'
      + '<div class="plat-actions">' + (actions||'<span class="plat-note">入力が必要</span>') + '</div>'
      + '</div>';
  }).join('');

  return warn
    + '<div class="rcard">'
    + '<div class="rcard-info" style="border-color:rgba(239,68,68,.3)">'
    + (code  ? '<span class="rcode" style="color:var(--red);border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.08)">'+esc(code)+'</span>' : '')
    + (title ? '<span class="rtitle">'+esc(title)+'</span>' : '')
    + '<span style="font-size:.72rem;color:var(--red);font-weight:700">Shops在庫なし</span>'
    + '</div>'
    + '<div class="plat-rows">' + rows + '</div>'
    + '</div>';
}

// ===== 商品カード描画 =====
function renderCard(item, searchCode, searchTitle) {
  // 検索に使ったコードが管理番号と違う場合はitem.codeを優先
  var code  = item.code  || searchCode  || '';
  var title = item.title || searchTitle || '';

  var rows = PLATS.map(function(p){
    var url = item.urls && item.urls[p.key];
    var actions = '';

    if (p.key === 'mercari_shops') {
      var su = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products?keyword=' + encodeURIComponent(code);
      if (url) {
        var idMatch = url.match(/\/product(s)?\/([a-zA-Z0-9]+)$/);
        var itemId = idMatch ? idMatch[2] : '';
        if (itemId) {
          var adminUrl = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/' + itemId;
          var pubUrl = 'https://jp.mercari.com/shops/product/' + itemId;
          actions = '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops">検索</a>'
                  + '<a href="'+esc(adminUrl)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">管理画面</a>'
                  + '<a href="'+esc(pubUrl)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">商品ページ</a>';
        } else {
          actions = '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops">検索</a>'
                  + '<a href="'+esc(url)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">管理画面</a>';
        }
      } else {
        actions = '<span class="plat-note">CSV取込後に表示</span>';
      }
    } else {
      if (url) actions += '<a href="'+esc(url)+'" target="_blank" class="pbtn pbtn-shops" style="margin-right:2px">↗ 開く</a>';

      if (p.key === 'yahoo_auction') {
        // ヤフオクはタイトルのみ
        var tu = makeUrl('yahoo_auction','title',code,title); if(true) actions += '<a href="'+esc(tu)+'" target="_blank" class="pbtn pbtn-title">タイトルで検索</a>';
      } else if (p.key === 'rakuma') {
        // ラクマはタイトル優先で表示
        var tu2 = makeUrl('rakuma','title',code,title); var cu2 = makeUrl('rakuma','code',code,title); if(true) actions += '<a href="'+esc(tu2)+'" target="_blank" class="pbtn pbtn-title">タイトルで検索</a>';
        if (cu2 && code) actions += '<a href="'+esc(cu2)+'" target="_blank" class="pbtn pbtn-code">コードで検索</a>';
      } else {
        // メルカリ・Yフリマ：コード優先
        var cu3 = p.codeSearch && code ? makeUrl(p.key,'code',code,title) : null;
        var tu3 = p.titleSearch ? makeUrl(p.key,'title',code,title) : null;
        if (cu3) actions += '<a href="'+esc(cu3)+'" target="_blank" class="pbtn pbtn-code">コードで検索</a>';
        if (tu3) actions += '<a href="'+esc(tu3)+'" target="_blank" class="pbtn pbtn-title">タイトルで検索</a>';
      }
    }

    return '<div class="plat-row">'
      + '<div class="plat-name">'+p.emoji+' '+p.name+'</div>'
      + '<div class="plat-actions">'+actions+'</div>'
      + '</div>';
  }).join('');

  // ★ 全部開くボタン：item.id のみ渡す（タイトルの特殊文字でJSが壊れる問題を修正）
  var sUrl = (item.urls && item.urls['mercari_shops']) ? item.urls['mercari_shops'] : '';
   var openAllBtn = '<button class="btn-openall" onclick="openAllByData(\'' + esc(code) + '\', \'' + esc(title) + '\', \'' + esc(sUrl) + '\')">🔗 全プラット一気に開く</button>';

  return '<div class="rcard">'
    + '<div class="rcard-info">'
    + '<span class="rcode">'+esc(item.code)+'</span>'
    + '<span class="rtitle">'+esc(item.title)+'</span>'
    + (item.price?'<span class="rprice">¥'+Number(item.price).toLocaleString()+'</span>':'')
    + (item.stock >= 1 ? '' : (item.status === '1' ? '<span class="rbadge rbadge-private">🔒 非公開保存</span>' : '<span class="rbadge rbadge-sold">📦 売り切れ</span>'))
    + '</div>'
    + '<div class="plat-rows">'+rows+'</div>'
    + '<div class="plat-footer">'+openAllBtn+'</div>'
    + '</div>';
}

// ===== 全プラット一気に開く =====
// ★ 修正: item.id だけ受け取り、item から code/title を直接取得
function openAllByData(code, title, shopsUrl) {
  var opened = 0;
  PLATS.forEach(function(p){
    var u = null;
    if (p.key === 'mercari_shops') {
      if (shopsUrl) {
        var idMatch = shopsUrl.match(/\/product(s)?\/([a-zA-Z0-9]+)$/);
        var itemId = idMatch ? idMatch[2] : '';
        if (itemId) {
          window.open('https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/' + itemId, '_blank');
        } else {
          window.open(shopsUrl, '_blank');
        }
        opened++;
      }
      return;
    }
    if (p.preferTitle) {
      if (title) u = makeUrl(p.key, 'title', code, title);
    } else {
      if (code) u = makeUrl(p.key, 'code', code, title);
      if (!u && title) u = makeUrl(p.key, 'title', code, title);
    }
    if (u) { window.open(u, '_blank'); opened++; }
  });
  if (opened === 0) showToast('開けるページがありません');
}
// ===== CSV インポート =====
function openCsvModal(){ document.getElementById('csv-modal').classList.add('open'); }
function closeCsvModal(){
  document.getElementById('csv-modal').classList.remove('open');
  document.getElementById('csvfile').value='';
  document.getElementById('prev-area').innerHTML='';
  document.getElementById('btn-import').style.display='none';
  pendingRows=[];
}

var MARKERS=['●管理番号','■管理番号','▲管理番号','〇管理番号','□管理番号','△管理番号'];
function extractCode(desc){
  var lines=(desc||'').split('\n');
  for(var i=0;i<lines.length;i++){
    var l=lines[i].trim();
    if(MARKERS.some(function(m){return l===m||l.indexOf(m)===0;})){
      for(var j=i+1;j<Math.min(i+5,lines.length);j++){
        var c=lines[j].trim();
        if(/^[A-E]\d{4,}/.test(c)) return c;
      }
    }
  }
  return '';
}
var COL={ID:0,NAME:62,DESC:63,STOCK:67,CODE:70,PRICE:155,STATUS:163};

document.addEventListener('DOMContentLoaded',function(){
  var fi=document.getElementById('csvfile');
  if(fi) fi.addEventListener('change',function(e){
    var f=e.target.files[0]; if(!f)return;
    var reader=new FileReader();
    reader.onload=function(ev){ parseCsv(ev.target.result); };
    reader.readAsText(f,'Shift_JIS');
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape') closeCsvModal();
  });
});

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

  pendingRows = []; var skip = 0, noCode = 0;
  for(var i = 1; i < rows.length; i++){
    var cols = rows[i];
    if(cols.length < 71){ skip++; continue; }
    var stock = parseInt(cols[COL.STOCK].trim()) || 0;
    var status = cols.length > COL.STATUS ? cols[COL.STATUS].trim() : '';
    var itemId=cols[COL.ID].trim();
    var title=cols[COL.NAME].trim();
    var code=cols[COL.CODE].trim()||extractCode(cols[COL.DESC].trim());
    var price=cols[COL.PRICE].trim();
    if(!code){code='CHECK';noCode++;}
    var shopsUrl=itemId?'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/'+itemId:'';
    pendingRows.push({code:code,title:title,price:price,shopsUrl:shopsUrl,stock:stock,status:status,noCode:!cols[COL.CODE].trim()&&!extractCode(cols[COL.DESC].trim())});
  }
  var pa=document.getElementById('prev-area');
  if(!pendingRows.length){pa.innerHTML='<p style="color:var(--red);padding:12px">データが見つかりません</p>';return;}
  var html='<div class="prev-bar">'
    +'<span class="prev-ok">対象: <b>'+pendingRows.length+'件</b></span>'
    +(skip?'<span class="prev-skip">スキップ: '+skip+'件</span>':'')
    +(noCode?'<span class="prev-warn">⚠ 管理番号不明: '+noCode+'件</span>':'')
    +'</div>'
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

function runImport(){
  if(!pendingRows.length) return;
  var added=0,updated=0;
  pendingRows.forEach(function(row){
    var ex=row.code!=='CHECK'?items.find(function(i){return i.code===row.code;}):null;
    if(ex){
      ex.title=row.title; ex.price=row.price; ex.stock=row.stock; ex.status=row.status||'';
      if(!ex.urls) ex.urls={};
      if(row.shopsUrl) ex.urls['mercari_shops']=row.shopsUrl;
      ex.updatedAt=Date.now(); updated++;
    } else {
      var urls={};
      if(row.shopsUrl) urls['mercari_shops']=row.shopsUrl;
      items.unshift({id:genId(),code:row.code,title:row.title,price:row.price,stock:row.stock,status:row.status||'',memo:'',urls:urls,createdAt:Date.now()});
      added++;
    }
  });
  // item_dict に保存（管理番号→タイトル+ShopsURL の辞書）
  var dict = JSON.parse(localStorage.getItem('item_dict') || '{}');
  pendingRows.forEach(function(row){
    if (row.code && row.code !== 'CHECK') {
      dict[row.code] = { title: row.title, shopsUrl: row.shopsUrl };
    }
  });
  localStorage.setItem('item_dict', JSON.stringify(dict));
  // 更新日時を保存して表示
  var now = new Date();
  var ymd = now.getFullYear() + '/' + ('0'+(now.getMonth()+1)).slice(-2) + '/' + ('0'+now.getDate()).slice(-2);
  var hm  = ('0'+now.getHours()).slice(-2) + ':' + ('0'+now.getMinutes()).slice(-2);
  var updatedStr = ymd + ' ' + hm + ' 更新';
  localStorage.setItem('csv_updated_at', updatedStr);
  var ua = document.getElementById('csv-updated-at');
  if (ua) ua.textContent = updatedStr;
  localStorage.setItem('last_seed','manual');
  save(); updateStats(); closeCsvModal();
  showToast('✅ 新規:'+added+'件 / 更新:'+updated+'件', 4000);
}



// ===== seed_data.js 自動インポート =====
var SEED_KEY='last_seed_file';

function applyNewSeed(){
  if(!window._SEED_DATA) return;
  var newItems=window._SEED_DATA.map(function(s){
    var ex=s.code!=='CHECK'?items.find(function(i){return i.code===s.code;}):null;
    if(ex){
      var merged=Object.assign({},ex.urls,s.urls);
      return Object.assign({},ex,{title:s.title,price:s.price,urls:merged,updatedAt:Date.now()});
    }
    return s;
  });
  items=newItems;
  localStorage.setItem(SEED_KEY,window._SEED_FILE||'');
  save(); updateStats(); dismissBanner();
  showToast('✅ '+newItems.length+'件に更新しました',4000);
}

function dismissBanner(){
  localStorage.setItem(SEED_KEY,window._SEED_FILE||'');
  var b=document.getElementById('upd-banner');
  if(b) b.style.display='none';
}

// ===== 初期化 =====
load();

if(window._SEED_DATA && items.length===0){
  items=window._SEED_DATA; save();
  showToast('✅ '+items.length+'件 読み込みました',3000);
}
var lastSeed=localStorage.getItem(SEED_KEY);
if(window._SEED_DATA && window._SEED_FILE && window._SEED_FILE!==lastSeed && items.length>0){
  var b=document.getElementById('upd-banner');
  var m=document.getElementById('upd-msg');
  if(b&&m){ m.textContent='📥 新しいShopsデータあり（'+window._SEED_FILE+'）'; b.style.display='flex'; }
}
if(window._SEED_FILE){
  var si=document.getElementById('seed-info');
  if(si) si.textContent='📄 '+window._SEED_FILE;
}

updateStats();













