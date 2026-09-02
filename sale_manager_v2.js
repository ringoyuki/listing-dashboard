﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿// ==========================================
// sale_manager.js - セール管理システム v1.0
// ==========================================

// === Google Drive 同期設定 ===
var SALE_GAS_URL = localStorage.getItem('saleGasUrl') || '';

// === 定数 ===
var SALE_SYMBOLS   = ['●','■','▲','〇','□'];
var SALE_INTERVAL  = 15;   // 日
var SALE_HALF_DAYS = 7;    // 中間値下げ日
var SALE_DISC_AMT  = 500;  // 値下げ額
var SALE_MIN_LIKES = 3;    // セール条件

// 底値テキスト
var TEICHI_DESC    = '【底値】\n順次価格を元値に更新、再出品を行っております。\n現在の価格が最安値となります。\nご縁がありましたら宜しくお願いいたします。';
var TEICHI_COMMENT = 'コメント\n順次価格を元値に更新、再出品を行っております。\n現在の価格が最安値となります。\nご縁がありましたら宜しくお願いいたします。';

// セールタイトル
var SALE_TITLES = ['【突発ゲリラセール】','【超限定タイムセール】','【幻のゲリラお値下げ】',
  '【今だけの特別セール】','【大感謝セール】','【感謝還元ゲリラセール】',
  '【素敵なご縁に感謝セール】','【一期一会のタイムセール】',
  '【こっそりお値下げセール】','【2時間だけの特別セール】'];

// セール文パターン
var SALE_BODIES = [
  { top:'[T] 限定！！\nたくさんのいいねありがとうございます🙇', bot:'期間終了後は価格を元に戻しますので\n検討中の方はこの機会にお見逃しなく😊' },
  { top:'[T] 限定のご案内です✨\nたくさんのいいね、心より感謝いたします🙇', bot:'一点物につき早い者勝ちとなります🙏\n終了後は価格を戻しますのでお急ぎください！' },
  { top:'[T] までの限定価格です！\nいつも見ていただき、たくさんのいいね本当にありがとうございます🙏', bot:'お時間を過ぎましたら元の価格に戻してしまいます\n気になっていた方はお早めにご検討くださいませ！' },
  { top:'[T] 限定のゲリラ開催です！\nたくさんのいいねをいただき感謝しております🙏', bot:'素敵なご縁がありますようにお早めにご検討ください😊\n終了後は元の価格に戻させていただきます🙇' },
  { top:'[T] だけの特別価格です✨\nたくさんのいいねありがとうございます🙇', bot:'時間終了で価格はキッチリ元に戻します\n一番お得なこの機会にぜひご検討ください😊' }
];

// セール時間（曜日別）
var SALE_TIMES_BY_DOW = ['20:00〜22:00','20:00〜22:00','20:00〜22:00','19:00〜21:00','21:00〜23:00','20:00〜22:00','20:00〜22:00'];

// ==========================================
// ユーティリティ
// ==========================================
function smPad2(n){ return n < 10 ? '0'+n : String(n); }

function smTodayStr(){
  var d = new Date();
  return d.getFullYear()+'-'+smPad2(d.getMonth()+1)+'-'+smPad2(d.getDate());
}

function smAddDays(dateStr, n){
  var d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.getFullYear()+'-'+smPad2(d.getMonth()+1)+'-'+smPad2(d.getDate());
}

function smDaysDiff(dateStr){
  if(!dateStr) return 0;
  var ds = (dateStr+'').replace(/\//g,'-').split(' ')[0];
  var d = new Date(ds);
  if(isNaN(d)) return 0;
  var now = new Date(); now.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.floor((now - d)/(1000*60*60*24));
}

function smFmtDate(dateStr){
  if(!dateStr) return '-';
  return (dateStr+'').split(' ')[0].replace(/-/g,'/');
}

function smGenId(){
  return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
}

// ==========================================
// 価格計算
// ==========================================
function smBasePrice(symbol, price){
  var p = parseInt(price) || 0;
  if(symbol==='●') return p;
  if(symbol==='■') return Math.round(p/0.95);
  if(symbol==='▲') return Math.round(p/0.90);
  if(symbol==='〇') return Math.round(p/0.80);
  if(symbol==='□') return Math.round(p/0.81);
  return p;
}

function smSymPrice(base, sym){
  if(sym==='●') return Math.floor(base/100)*100;
  if(sym==='■') return Math.floor(base*0.95/100)*100;
  if(sym==='▲') return Math.floor(base*0.90/100)*100;
  if(sym==='〇') return Math.floor(base*0.80/100)*100;
  return Math.floor(base/100)*100;
}

function smBoxPrice(maruPrice){
  // □ = 〇の価格 × 90%（切捨100円）
  return Math.floor(maruPrice*0.90/100)*100;
}

function smNextSym(sym){
  var idx = SALE_SYMBOLS.indexOf(sym);
  return (idx>=0 && idx<SALE_SYMBOLS.length-1) ? SALE_SYMBOLS[idx+1] : null;
}

// ==========================================
// データ管理（localStorage）
// ==========================================
var SM_KEY = 'sale_data_v1';

function smGetAll(){
  try{ return JSON.parse(localStorage.getItem(SM_KEY)||'{}'); }catch(e){ return {}; }
}

function smSetAll(data){
  localStorage.setItem(SM_KEY, JSON.stringify(data));
}

function smGetItem(code){
  var d = smGetAll();
  if(!d[code]) d[code] = { symbol:'●', symbolChangedAt:smTodayStr(), tasks:[] };
  return d[code];
}

function smSetItem(code, itemData){
  var d = smGetAll();
  d[code] = itemData;
  smSetAll(d);
  // Google Drive に非同期同期
  if(SALE_GAS_URL) smSyncItem(code, itemData);
}

// ==========================================
// Google Drive 同期（GAS経由）
// ==========================================
function smSyncItem(code, data){
  if(!SALE_GAS_URL) return;
  fetch(SALE_GAS_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({action:'save', key:code, value:data})
  }).catch(function(e){ console.warn('GAS sync:', e); });
}

function smSyncFromDrive(){
  if(!SALE_GAS_URL){
    showToast('⚠️ GAS URLが設定されていません', 3000);
    return;
  }
  var btn = document.getElementById('sm-sync-btn');
  if(btn){ btn.textContent='🔄 同期中...'; btn.disabled=true; }
  fetch(SALE_GAS_URL+'?action=load', {redirect:'follow'})
    .then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.text();
    })
    .then(function(txt){
      try{ return JSON.parse(txt); }catch(e){ throw new Error('JSON parse error'); }
    })
    .then(function(remote){
      var local = smGetAll();
      Object.keys(remote).forEach(function(k){ local[k]=remote[k]; });
      smSetAll(local);
      if(btn){ btn.textContent='☁ Drive同期'; btn.disabled=false; }
      smRenderAll();
      showToast('✅ Googleドライブから同期しました', 2000);
    })
    .catch(function(){
      if(btn){ btn.textContent='☁ Drive同期'; btn.disabled=false; }
      showToast('⚠️ 同期に失敗しました', 3000);
    });
}

// ==========================================
// 対象商品リスト取得
// ==========================================
function smGetTargets(){
  if(!window.items || !items.length) return [];
  return items.filter(function(item){
    if(!item.code || item.code==='CHECK') return false;
    if((item.stock||0) <= 0) return false;
    return smDaysDiff(item.shopsUpdatedAt) >= SALE_INTERVAL;
  }).sort(function(a,b){
    return smDaysDiff(b.shopsUpdatedAt) - smDaysDiff(a.shopsUpdatedAt);
  });
}

// ==========================================
// タスク管理
// ==========================================
function smGetAllTasks(){
  var all = smGetAll();
  var tasks = [];
  var today = smTodayStr();
  Object.keys(all).forEach(function(code){
    var sd = all[code];
    if(!sd.tasks) return;
    var item = items.find(function(i){ return i.code===code; });
    if(!item) return;
    sd.tasks.forEach(function(t){
      if(t.status==='done') return;
      var over = smDaysDiff(t.dueDate);
      tasks.push({
        taskId:t.id, code:code,
        title:item.title, type:t.type, desc:t.desc,
        dueDate:t.dueDate, overdueDays:over,
        priority: over>0 ? 0 : (t.dueDate===today ? 1 : 2)
      });
    });
  });
  tasks.sort(function(a,b){
    if(a.priority!==b.priority) return a.priority-b.priority;
    return b.overdueDays-a.overdueDays;
  });
  return tasks;
}

function smCompleteTask(code, taskId){
  var sd = smGetItem(code);
  var t = (sd.tasks||[]).find(function(x){ return x.id===taskId; });
  if(t){ t.status='done'; t.completedAt=smTodayStr(); }
  smSetItem(code, sd);
  smRenderAll();
  showToast('✅ タスクを完了しました', 1500);
}

function smAddTask(code, task){
  var sd = smGetItem(code);
  if(!sd.tasks) sd.tasks=[];
  task.id = task.id||smGenId();
  task.status = 'pending';
  sd.tasks.push(task);
  smSetItem(code, sd);
}

// ==========================================
// セール文生成
// ==========================================
function smGenSaleText(curPrice, salePrice, saleTime){
  var title = SALE_TITLES[Math.floor(Math.random()*SALE_TITLES.length)];
  var body  = SALE_BODIES[Math.floor(Math.random()*SALE_BODIES.length)];
  var top = body.top.replace('[T]', saleTime);
  var mid = curPrice.toLocaleString()+'円 ⇒ '+salePrice.toLocaleString()+'円に変更しています。';
  return title+'\n'+top+'\n'+mid+'\n'+body.bot;
}

// ==========================================
// Modal UI
// ==========================================
function openSaleModal(){
  document.getElementById('sale-modal').classList.add('open');
  smRenderAll();
  if(SALE_GAS_URL) smSyncFromDrive();
}

function closeSaleModal(){
  document.getElementById('sale-modal').classList.remove('open');
}

var _smSelected = null;

function smRenderAll(){
  smRenderTasks();
  smRenderList();
  if(_smSelected){
    var item = items.find(function(i){ return i.code===_smSelected; });
    if(item) smRenderPanel(item);
  }
}

// ---------- タスク一覧 ----------
function smRenderTasks(){
  var el = document.getElementById('sm-task-list');
  if(!el) return;
  var tasks = smGetAllTasks();

  if(!tasks.length){
    el.innerHTML = '<div style="padding:10px 16px;color:#cbd5e1;font-size:0.82rem;">✅ 期限のタスクはありません</div>';
    return;
  }

  el.innerHTML = tasks.map(function(t){
    var over = t.overdueDays>0;
    var today = t.dueDate===smTodayStr();
    var bg   = over ? 'rgba(239,68,68,0.10)' : today ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)';
    var badge = over
      ? '<span style="font-size:0.68rem;font-weight:700;color:#f87171;background:rgba(239,68,68,0.15);padding:2px 7px;border-radius:4px;">🔴 '+t.overdueDays+'日超過</span>'
      : today
        ? '<span style="font-size:0.68rem;font-weight:700;color:#fbbf24;background:rgba(251,191,36,0.12);padding:2px 7px;border-radius:4px;">🟡 今日</span>'
        : '<span style="font-size:0.68rem;color:#cbd5e1;background:rgba(255,255,255,0.05);padding:2px 7px;border-radius:4px;">'+smFmtDate(t.dueDate)+'</span>';
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:'+bg+';border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;" onclick="smSelectItem(\''+esc(t.code)+'\')">'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:0.72rem;color:#cbd5e1;">'+esc(t.code)+'</div>'
      +'<div style="font-size:0.8rem;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(t.desc)+'</div>'
      +'</div>'
      +badge
      +'<button onclick="event.stopPropagation();smCompleteTask(\''+esc(t.code)+'\',\''+t.taskId+'\')" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#86efac;border-radius:5px;padding:3px 9px;font-size:0.72rem;cursor:pointer;white-space:nowrap;">✅ 完了</button>'
      +'</div>';
  }).join('');
}

// ---------- 商品リスト ----------
function smRenderList(){
  var el = document.getElementById('sm-item-list');
  if(!el) return;
  var targets = smGetTargets();

  if(!targets.length){
    el.innerHTML='<div style="padding:32px;text-align:center;color:#cbd5e1;"><div style="font-size:2rem;margin-bottom:8px;">✅</div><div>15日以上経過した商品はありません</div></div>';
    return;
  }

  el.innerHTML = targets.map(function(item){
    var days = smDaysDiff(item.shopsUpdatedAt);
    var sd   = smGetItem(item.code);
    var sym  = sd.symbol||'●';
    var sc   = {'●':'#c7d2fe','■':'#94a3b8','▲':'#fbbf24','〇':'#fb923c','□':'#f87171'}[sym]||'#c7d2fe';
    var dc   = days>=60?'#f87171':days>=30?'#fb923c':'#fbbf24';
    var sel  = item.code===_smSelected;
    var pendingTasks = ((sd.tasks||[]).filter(function(t){ return t.status!=='done'; })).length;

    return '<div onclick="smSelectItem(\''+esc(item.code)+'\')" style="display:flex;align-items:center;gap:10px;padding:9px 12px;'
      +(sel?'background:rgba(99,102,241,0.15);border-left:3px solid #818cf8;':'background:rgba(255,255,255,0.02);border-left:3px solid transparent;')
      +'border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:all 0.15s;">'
      +'<span style="font-size:1.1rem;min-width:22px;text-align:center;color:'+sc+';">'+sym+'</span>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:0.7rem;color:#cbd5e1;">'+esc(item.code)+(pendingTasks?' <span style="color:#fb923c;font-weight:700;">⏰'+pendingTasks+'</span>':'')+'</div>'
      +'<div style="font-size:0.8rem;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(item.title.slice(0,36))+'</div>'
      +'<div style="font-size:0.7rem;color:#cbd5e1;margin-top:1px;">¥'+Number(item.price||0).toLocaleString()+' ／ 更新:'+smFmtDate(item.shopsUpdatedAt)+'</div>'
      +'</div>'
      +'<div style="font-weight:700;color:'+dc+';font-size:0.95rem;white-space:nowrap;">'+days+'<span style="font-size:0.65rem;margin-left:1px;">日</span></div>'
      +'</div>';
  }).join('');
}

// ---------- アクションパネル ----------
function smSelectItem(code){
  _smSelected = code;
  smRenderList();
  var item = items.find(function(i){ return i.code===code; });
  if(item) smRenderPanel(item);
  // スクロール
  var panel = document.getElementById('sm-action-panel');
  if(panel) panel.scrollTop=0;
}

function smRenderPanel(item){
  var el = document.getElementById('sm-action-panel');
  if(!el) return;
  var sd   = smGetItem(item.code);
  var sym  = sd.symbol||'●';
  var price= parseInt(item.price)||0;
  var days = smDaysDiff(item.shopsUpdatedAt);
  var sc   = {'●':'#c7d2fe','■':'#94a3b8','▲':'#fbbf24','〇':'#fb923c','□':'#f87171'}[sym]||'#c7d2fe';

  var shopsUrl  = (item.urls&&item.urls['mercari_shops'])||'';
  var shopsPub  = item.shopItemId ? 'https://jp.mercari.com/shops/product/'+item.shopItemId : '';
  var shopAdmin = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products?keyword=' + encodeURIComponent(item.code);
  var yaUrl  = makeUrl('yahoo_auction','title',item.code,item.title)||'';
  var rkUrl  = makeUrl('rakuma','title',item.code,item.title)||'';
  var yfUrl  = makeUrl('yahoo_flea','title',item.code,item.title)||'';
  var mcUrl  = makeUrl('mercari','title',item.code,item.title)||'';

  function platBtn(href, emoji, label, bg, border, color){
    if(!href) return '';
    return '<a href="'+esc(href)+'" target="_blank" style="display:inline-block;padding:5px 10px;border-radius:6px;font-size:0.75rem;text-decoration:none;background:'+bg+';border:1px solid '+border+';color:'+color+';margin:2px;">'+emoji+' '+label+'</a>';
  }

  var html = '<div style="padding:16px;">'
    // タイトル
    +'<div style="font-size:0.72rem;color:#cbd5e1;margin-bottom:2px;">'+esc(item.code)+'</div>'
    +'<div style="font-size:0.88rem;font-weight:600;color:#e2e8f0;margin-bottom:14px;line-height:1.4;">'+esc(item.title.slice(0,70))+'</div>'

    // 現在ステータス
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">'
    +'<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px 14px;text-align:center;">'
    +'<div style="font-size:1.5rem;color:'+sc+';">'+sym+'</div>'
    +'<div style="font-size:0.65rem;color:#cbd5e1;">現在の記号</div>'
    +'</div>'
    +'<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px 14px;text-align:center;">'
    +'<div style="font-size:1rem;font-weight:700;color:#f1f5f9;">¥'+price.toLocaleString()+'</div>'
    +'<div style="font-size:0.65rem;color:#cbd5e1;">現在価格</div>'
    +'</div>'
    +'<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px 14px;text-align:center;">'
    +'<div style="font-size:1rem;font-weight:700;color:'+(days>=30?'#fb923c':'#fbbf24')+';">'+days+'日</div>'
    +'<div style="font-size:0.65rem;color:#cbd5e1;">更新から</div>'
    +'</div>'
    +'</div>'

    // プラットフォームリンク
    +'<div style="margin-bottom:16px;">'
    +'<div style="font-size:0.75rem;color:#cbd5e1;margin-bottom:6px;">📱 商品確認</div>'
    +'<div>'
    +platBtn(shopsPub,'🛍','Shops商品','rgba(239,68,68,0.12)','rgba(239,68,68,0.3)','#fca5a5')
    +platBtn(shopAdmin,'⚙','Shops管理','rgba(239,68,68,0.08)','rgba(239,68,68,0.2)','#fca5a5')
    +platBtn(mcUrl,'🔴','メルカリ','rgba(239,68,68,0.12)','rgba(239,68,68,0.3)','#fca5a5')
    +platBtn(yaUrl,'🟠','ヤフオク','rgba(249,115,22,0.12)','rgba(249,115,22,0.3)','#fdba74')
    +platBtn(rkUrl,'🟣','ラクマ','rgba(139,92,246,0.12)','rgba(139,92,246,0.3)','#c4b5fd')
    +platBtn(yfUrl,'🟡','ヤフーフリマ','rgba(234,179,8,0.12)','rgba(234,179,8,0.3)','#fde047')
    +'</div>'
    +'</div>'

    // いいね入力
    +'<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:14px;margin-bottom:16px;">'
    +'<div style="font-size:0.78rem;color:#94a3b8;margin-bottom:8px;">① 商品ページでいいね数を確認して入力</div>'
    +'<div style="display:flex;align-items:center;gap:8px;">'
    +'<input type="number" id="sm-likes-'+esc(item.code)+'" min="0" value="0" style="width:70px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#f1f5f9;border-radius:6px;padding:6px 8px;font-size:0.95rem;text-align:center;">'
    +'<span style="color:#d1d5db;font-size:0.82rem;">いいね</span>'
    +'<button onclick="smOnLikes(\''+esc(item.code)+'\')" style="background:rgba(99,102,241,0.25);border:1px solid rgba(99,102,241,0.5);color:#c7d2fe;border-radius:7px;padding:7px 16px;font-size:0.83rem;cursor:pointer;font-weight:600;">アクション確認 →</button>'
    +'</div>'
    +'</div>'

    // アクション結果エリア
    +'<div id="sm-action-result-'+esc(item.code)+'"></div>'

    // 手動記号変更
    +'<details style="margin-top:16px;">'
    +'<summary style="font-size:0.75rem;color:#cbd5e1;cursor:pointer;padding:4px;">⚙ 記号を直接変更する</summary>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">'
    +SALE_SYMBOLS.map(function(s){
      var active = s===sym;
      return '<button onclick="smManualChange(\''+esc(item.code)+'\',\''+s+'\')" style="padding:6px 14px;border-radius:6px;font-size:0.9rem;cursor:pointer;'
        +(active?'background:rgba(99,102,241,0.3);border:1px solid rgba(99,102,241,0.6);color:#c7d2fe;':'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#d1d5db;')+'">'+s+'</button>';
    }).join('')
    +'</div>'
    +'</details>'

    +'</div>';

  el.innerHTML = html;
  el.style.display='block';
}

// いいね数でアクション確定
function smOnLikes(code){
  var inp = document.getElementById('sm-likes-'+code);
  var likes = parseInt(inp ? inp.value : 0) || 0;
  var item  = items.find(function(i){ return i.code===code; });
  if(!item) return;

  var sd      = smGetItem(code);
  var sym     = sd.symbol||'●';
  var price   = parseInt(item.price)||0;
  var nextSym = smNextSym(sym);

  var result = document.getElementById('sm-action-result-'+code);
  if(!result) return;

  if(!nextSym){
    result.innerHTML='<div style="background:rgba(100,116,139,0.12);border-radius:8px;padding:12px;color:#d1d5db;font-size:0.83rem;">すべてのステップが完了しています</div>';
    return;
  }

  var base      = smBasePrice(sym, price);
  var nextPrice = (nextSym==='□') ? smBoxPrice(price) : smSymPrice(base, nextSym);
  var hasSale   = likes >= SALE_MIN_LIKES;
  var isOwner   = nextSym==='〇';
  var saleTime  = SALE_TIMES_BY_DOW[new Date().getDay()];
  var nextColor = {'■':'#94a3b8','▲':'#fbbf24','〇':'#fb923c','□':'#f87171'}[nextSym]||'#86efac';

  var html = '';
  function cbtn(v){ return '<button title="コピー" onclick="navigator.clipboard.writeText(\''+v+'\');showToast(\'✅ '+v+' をコピーしました\', 1500);event.stopPropagation();" style="margin-left:5px;padding:2px 6px;font-size:0.7rem;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:#e2e8f0;border-radius:4px;cursor:pointer;vertical-align:middle;">📋</button>'; }

  // --- セールあり ---
  if(hasSale){
    var saleText = smGenSaleText(price, nextPrice, saleTime);
    html += '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px;margin-bottom:12px;">'
      +'<div style="font-size:0.82rem;font-weight:700;color:#f87171;margin-bottom:10px;">🔥 セール実施（いいね'+likes+'件 ≥ '+SALE_MIN_LIKES+'）</div>'

      // Shops手順
      +'<div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:10px;margin-bottom:10px;">'
      +'<div style="font-size:0.72rem;color:#d1d5db;margin-bottom:4px;">① Shopsでタイムセール予約</div>'
      +'<div style="display:grid; grid-template-columns:230px 1fr; row-gap:8px; align-items:center; font-size:0.95rem; color:#e2e8f0;">'+'<div style="color:#cbd5e1;font-size:0.85rem;">メルカリShops、ヤフオク、ラクマ</div>'+'<div><b style="color:#86efac;font-size:1.15em;">¥'+nextPrice.toLocaleString()+'</b>'+cbtn(nextPrice)+'&nbsp;&nbsp;<span style="font-size:0.85rem;">時間: <b>'+saleTime+'</b></span></div>'+'<div style="color:#cbd5e1;font-size:0.85rem;">メルカリ</div>'+'<div><b style="color:#fca5a5;font-size:1.15em;">¥'+(nextPrice+1000).toLocaleString()+'</b>'+cbtn(nextPrice+1000)+'</div>'+'<div style="color:#cbd5e1;font-size:0.85rem;">ヤフーフリマ</div>'+'<div><b style="color:#fde047;font-size:1.15em;">¥'+(Math.floor(nextPrice/1000)*1000).toLocaleString()+'</b>'+cbtn(Math.floor(nextPrice/1000)*1000)+'</div>'+'</div>'
      +'<div style="font-size:0.72rem;color:#cbd5e1;margin-top:4px;">📌 翌日にShopsが自動で価格を戻します</div>'
      +'</div>'

      // セール文
      +'<div style="font-size:0.72rem;color:#d1d5db;margin-bottom:4px;">② コメント欄にセール文をコピペ</div>'
      +'<textarea id="sm-stext-'+esc(code)+'" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;border-radius:6px;padding:8px;font-size:0.78rem;resize:vertical;min-height:110px;">'+saleText+'</textarea>'
      +'<button onclick="smCopyText(\'sm-stext-'+esc(code)+'\')" style="width:100%;margin-top:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;border-radius:6px;padding:7px;font-size:0.8rem;cursor:pointer;">📋 セール文をコピー</button>'

      // セール実施完了ボタン
      +'<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">'
      +'<div style="font-size:0.72rem;color:#d1d5db;margin-bottom:6px;">③ セール設定が完了したら押す</div>'
      +'<button onclick="smAfterSale(\''+esc(code)+'\',\''+nextSym+'\','+nextPrice+')" style="width:100%;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;border-radius:7px;padding:9px;font-size:0.83rem;cursor:pointer;font-weight:600;">✅ セール設定完了（翌日タスクを自動追加）</button>'
      +'</div>'
      +'</div>';
  }

  // --- セールなし ---
  if(!hasSale){
    html += '<div style="background:rgba(100,116,139,0.08);border:1px solid rgba(100,116,139,0.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;">'
      +'<div style="font-size:0.8rem;color:#d1d5db;">💡 いいね'+likes+'件 → セールなし（記号変更のみ）</div>'
      +'</div>';
  }

  // --- 記号変更 ---
  // --- 記号変更 ---
  var yaAdd = nextPrice < 10000 ? 1000 : (nextPrice < 20000 ? 1500 : 2000);
  var yaSokketu = nextPrice + yaAdd;
  var gridHtml = '<div style="display:grid; grid-template-columns:230px 1fr; row-gap:10px; align-items:center; font-size:0.95rem; color:#e2e8f0; margin-bottom:12px;">'
    +'<div style="color:#cbd5e1;font-size:0.85rem;">メルカリShops、ラクマ</div>'
    +'<div>'+sym+' → <b style="color:'+nextColor+';font-size:1.15em;">'+nextSym+'</b>&nbsp;&nbsp;<span style="color:#94a3b8;text-decoration:line-through;">¥'+price.toLocaleString()+'</span> → <b style="color:#86efac;font-size:1.15em;">¥'+nextPrice.toLocaleString()+'</b>'+cbtn(nextPrice)+'</div>'
    +'<div style="color:#cbd5e1;font-size:0.85rem;">メルカリ</div>'
    +'<div><b style="color:#fca5a5;font-size:1.15em;">¥'+(nextPrice+1000).toLocaleString()+'</b>'+cbtn(nextPrice+1000)+'</div>'
    +'<div style="color:#cbd5e1;font-size:0.85rem;">ヤフーフリマ</div>'
    +'<div><b style="color:#fde047;font-size:1.15em;">¥'+(Math.floor(nextPrice/1000)*1000).toLocaleString()+'</b>'+cbtn(Math.floor(nextPrice/1000)*1000)+'</div>'
    +'<div style="color:#cbd5e1;font-size:0.85rem;">ヤフオク</div>'
    +'<div><span style="font-size:0.85em;color:#94a3b8;">開始:</span> <b style="color:#fdba74;font-size:1.15em;">¥'+nextPrice.toLocaleString()+'</b>'+cbtn(nextPrice)+'&nbsp;&nbsp;<span style="font-size:0.85em;color:#94a3b8;">即決:</span> <b style="color:#fdba74;font-size:1.15em;">¥'+yaSokketu.toLocaleString()+'</b>'+cbtn(yaSokketu)+'</div>'
    +'</div>';

  if(isOwner){
    html += '<div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px;margin-bottom:12px;">'
      +'<div style="font-size:0.82rem;font-weight:700;color:#f87171;margin-bottom:6px;">⚠️ オーナー確認が必要な変更</div>'
      +gridHtml
      +'<button onclick="smDoChange(\''+esc(code)+'\',\''+nextSym+'\','+nextPrice+')" style="width:100%;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;border-radius:7px;padding:9px;font-size:0.83rem;cursor:pointer;font-weight:600;">⚠️ オーナー承認済み：'+nextSym+'に変更</button>'
      +'</div>';
  } else {
    var isBox = nextSym==='□';
    html += '<div style="background:'+(isBox?'rgba(239,68,68,0.07)':'rgba(34,197,94,0.07)')+';border:1px solid '+(isBox?'rgba(239,68,68,0.25)':'rgba(34,197,94,0.25)')+';border-radius:10px;padding:14px;margin-bottom:12px;">'
      +'<div style="font-size:0.82rem;font-weight:700;color:'+(isBox?'#f87171':'#86efac')+';margin-bottom:6px;">'+(isBox?'🏁 最終フェーズ（底値）':'📋 記号変更')+'</div>'
      +gridHtml
      +'<button onclick="smDoChange(\''+esc(code)+'\',\''+nextSym+'\','+nextPrice+')" style="width:100%;background:'+(isBox?'rgba(239,68,68,0.18)':'rgba(34,197,94,0.18)')+';border:1px solid '+(isBox?'rgba(239,68,68,0.4)':'rgba(34,197,94,0.4)')+';color:'+(isBox?'#fca5a5':'#86efac')+';border-radius:7px;padding:9px;font-size:0.83rem;cursor:pointer;font-weight:600;">✅ Shopsで価格変更後に押す（'+nextSym+' / ¥'+nextPrice.toLocaleString()+'）</button>'
      +'</div>';

    // □の底値テキスト
    if(isBox){
      html += '<div style="background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.22);border-radius:10px;padding:14px;">'
        +'<div style="font-size:0.82rem;font-weight:700;color:#a5b4fc;margin-bottom:10px;">📋 □ステップでコピーするテキスト</div>'

        +'<div style="font-size:0.72rem;color:#d1d5db;margin-bottom:4px;">① 全プラットフォームの説明文の一番上に追加</div>'
        +'<textarea id="sm-tdesc-'+esc(code)+'" readonly style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);color:#e2e8f0;border-radius:6px;padding:8px;font-size:0.78rem;resize:vertical;min-height:80px;">'+esc(TEICHI_DESC)+'</textarea>'
        +'<button onclick="smCopyText(\'sm-tdesc-'+esc(code)+'\')" style="width:100%;margin-top:5px;margin-bottom:10px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.35);color:#c7d2fe;border-radius:6px;padding:7px;font-size:0.78rem;cursor:pointer;">📋 説明文テキストをコピー</button>'

        +'<div style="font-size:0.72rem;color:#d1d5db;margin-bottom:4px;">② メルカリのコメント欄に投稿</div>'
        +'<textarea id="sm-tcomm-'+esc(code)+'" readonly style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);color:#e2e8f0;border-radius:6px;padding:8px;font-size:0.78rem;resize:vertical;min-height:80px;">'+esc(TEICHI_COMMENT)+'</textarea>'
        +'<button onclick="smCopyText(\'sm-tcomm-'+esc(code)+'\')" style="width:100%;margin-top:5px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.35);color:#c7d2fe;border-radius:6px;padding:7px;font-size:0.78rem;cursor:pointer;">📋 コメントテキストをコピー</button>'
        +'</div>';
    }
  }

  result.innerHTML = html;
}

// セール完了 → 翌日・変更タスク追加
function smAfterSale(code, nextSym, nextPrice){
  var sdUndo = smGetItem(code);
  localStorage.setItem('sm_undo', JSON.stringify({code:code, data:JSON.parse(JSON.stringify(sdUndo)), action:'afterSale'}));
  var today = smTodayStr();

  // 翌日：価格戻し確認
  smAddTask(code,{
    type:'revert_check', dueDate:smAddDays(today,1),
    desc:'Shopsタイムセール終了確認（自動で元値に戻っているか確認）'
  });

  // 4日後：記号変更
  smAddTask(code,{
    type:'symbol_change', dueDate:smAddDays(today,4),
    desc:'記号を'+nextSym+'に変更（Shopsで¥'+nextPrice.toLocaleString()+'に設定）'
  });

  // 11日後：500円値下げ（記号変更から7日後）
  smAddTask(code,{
    type:'price_discount', dueDate:smAddDays(today,11),
    desc:'500円値下げ → ¥'+(nextPrice-SALE_DISC_AMT).toLocaleString()+'に変更'
  });

  showToast('✅ タスクを3件追加しました', 2000);
  smRenderAll();
}

// 記号変更実行
function smDoChange(code, newSym, newPrice){
  var sd = smGetItem(code);
  localStorage.setItem('sm_undo', JSON.stringify({code:code, data:JSON.parse(JSON.stringify(sd)), action:'doChange'}));
  sd.symbol = newSym;
  sd.symbolChangedAt = smTodayStr();

  // 7日後：500円値下げ
  if(!sd.tasks) sd.tasks=[];
  sd.tasks.push({
    id:smGenId(), type:'price_discount', status:'pending',
    dueDate:smAddDays(smTodayStr(), SALE_HALF_DAYS),
    desc:'500円値下げ → ¥'+(newPrice-SALE_DISC_AMT).toLocaleString()+'に変更'
  });

  smSetItem(code, sd);
  showToast('✅ 記号を'+newSym+'に変更しました', 2000);
  _smSelected = code;
  smRenderAll();
}

// 手動記号変更
function smManualChange(code, sym){
  var sd = smGetItem(code);
  localStorage.setItem('sm_undo', JSON.stringify({code:code, data:JSON.parse(JSON.stringify(sd)), action:'manualChange'}));
  sd.symbol = sym;
  sd.symbolChangedAt = smTodayStr();
  smSetItem(code, sd);
  _smSelected = code;
  smRenderAll();
  showToast('✅ 記号を'+sym+'に変更しました', 1500);
}

// テキストコピー
function smCopyText(id){
  var el = document.getElementById(id);
  if(!el) return;
  navigator.clipboard.writeText(el.value||el.textContent).then(function(){
    showToast('✅ コピーしました', 1500);
  }).catch(function(){
    el.select&&el.select(); document.execCommand('copy');
    showToast('✅ コピーしました', 1500);
  });
}

// GAS URL設定
// 直前の操作を元に戻す
function smUndo(){
  var raw = localStorage.getItem('sm_undo');
  if(!raw){ showToast('⚠️ 元に戻せる操作がありません', 2000); return; }
  var undo = JSON.parse(raw);
  smSetItem(undo.code, undo.data);
  localStorage.removeItem('sm_undo');
  _smSelected = undo.code;
  smRenderAll();
  showToast('↩ 直前の操作を元に戻しました', 2000);
}

function smSaveGasUrl(){
  var inp = document.getElementById('sm-gas-url');
  var url = inp ? inp.value.trim() : '';
  if(!url){ showToast('URLを入力してください', 2000); return; }
  SALE_GAS_URL = url;
  localStorage.setItem('saleGasUrl', url);
  showToast('✅ GAS URLを保存しました。同期を開始します...', 2000);
  setTimeout(smSyncFromDrive, 800);
}

// ==========================================
// Google Drive CSV自動取り込み
// ==========================================
function smLoadCsvFromDrive(){
  if(!SALE_GAS_URL){
    showToast('⚠️ GAS URLが設定されていません。設定画面でURLを入力してください', 3000);
    return;
  }
  var btn = document.getElementById('sm-drive-csv-btn');
  if(btn){ btn.textContent='☁ 取り込み中...'; btn.disabled=true; btn.style.opacity='0.5'; }

  fetch(SALE_GAS_URL+'?action=csv')
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(res.error){
        showToast('⚠️ '+res.error, 3000);
        if(btn){ btn.textContent='☁ Driveから最新CSV取り込み'; btn.disabled=false; btn.style.opacity='1'; }
        return;
      }
      // CSVテキストをapp.jsのparseCsvに渡す
      if(typeof parseCsv === 'function'){
        parseCsv(res.csv);
        // pendingRowsが準備できたら自動インポート
        if(window.pendingRows && window.pendingRows.length > 0){
          runImport();
          showToast('✅ '+res.fileName+' から '+window.pendingRows.length+'件 取り込みました', 3000);
          // ファイル名と更新日時を保存
          localStorage.setItem('csv_filename', res.fileName);
          var now = new Date();
          var ts = now.getFullYear()+'/'+('0'+(now.getMonth()+1)).slice(-2)+'/'+('0'+now.getDate()).slice(-2)+' '+('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);
          var updText = '📄 '+res.fileName+' ／ '+ts+' 取り込み';
          localStorage.setItem('csv_updated_at', updText);
          var si = document.getElementById('seed-info');
          if(si) si.textContent = '📄 '+res.fileName;
          var ua = document.getElementById('csv-updated-at');
          if(ua) ua.textContent = updText;
        } else {
          showToast('⚠️ CSVのパースに失敗しました', 3000);
        }
      } else {
        showToast('⚠️ parseCsv関数が見つかりません', 3000);
      }
      if(btn){ btn.textContent='☁ Driveから最新CSV取り込み'; btn.disabled=false; btn.style.opacity='1'; }
      smRenderAll();
    })
    .catch(function(e){
      showToast('⚠️ CSV取得に失敗: '+e.message, 3000);
      if(btn){ btn.textContent='☁ Driveから最新CSV取り込み'; btn.disabled=false; btn.style.opacity='1'; }
    });
}