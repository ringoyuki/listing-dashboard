﻿﻿﻿﻿﻿﻿// ==========================================
// sale_manager.js - セール管理システム v1.0
// ==========================================

// === Google Drive 同期設定 ===
var SALE_GAS_URL = localStorage.getItem('saleGasUrl') || '';

// === 定数 ===
var SALE_SYMBOLS   = typeof CONFIG !== 'undefined' && CONFIG.SALE_SYMBOLS ? CONFIG.SALE_SYMBOLS : ['●','■','▲','〇','□'];
var SALE_INTERVAL  = typeof CONFIG !== 'undefined' ? CONFIG.SALE_INTERVAL : 10;   // 日
var SALE_HALF_DAYS = typeof CONFIG !== 'undefined' ? CONFIG.SALE_HALF_DAYS : 7;    // 中間値下げ日
var SALE_DISC_AMT = typeof CONFIG !== "undefined" && CONFIG.SALE_DISC_AMT ? CONFIG.SALE_DISC_AMT : 500;  // 値下げ額
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
var SALE_TIMES_BY_DOW = typeof CONFIG !== "undefined" && CONFIG.SALE_TIMES_BY_DOW ? CONFIG.SALE_TIMES_BY_DOW : ["20:00〜22:00","20:00〜22:00","20:00〜22:00","19:00〜21:00","21:00〜23:00","20:00〜22:00","20:00〜22:00"];

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

// 報告や商品詳細で使う、お客様向けのShops商品URL。
// 管理画面URLの文字列置換には頼らず、CSVの商品IDから組み立てる。
function smPublicShopsUrl(item){
  if(!item) return '';
  var itemId = item.shopItemId || '';
  var savedUrl = item.urls && item.urls.mercari_shops ? item.urls.mercari_shops : '';
  if(!itemId && savedUrl){
    var match = savedUrl.match(/\/products\/([^\/?#]+)/);
    if(match) itemId = match[1];
  }
  if(itemId) return 'https://jp.mercari.com/shops/product/' + encodeURIComponent(itemId);
  return item.code ? 'https://jp.mercari.com/search?keyword=' + encodeURIComponent(item.code) : '';
}

// 報告対象は、管理番号が有効で、在庫があり、公開中の商品だけ。
function smIsReportEligible(item){
  if(!item || !item.code || item.code === 'CHECK') return false;
  if(!/[a-zA-Z]/.test(item.code)) return false;
  if((item.stock || 0) <= 0) return false;
  if(item.status === '1' || item.status === 1) return false;
  return true;
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
  var rates = typeof CONFIG !== "undefined" && CONFIG.SYMBOL_RATES ? CONFIG.SYMBOL_RATES : {'●':1.0, '■':0.95, '▲':0.90, '〇':0.80, '□':0.75};
  var rate = rates[sym] || 1.0;
  return Math.floor((base * rate) / 100) * 100;
}

function smBoxPrice(maruPrice){
  // Calculate base from maruPrice (which is 80%), then multiply by 72%
  var base = maruPrice / 0.80;
  var rates = typeof CONFIG !== "undefined" && CONFIG.SYMBOL_RATES ? CONFIG.SYMBOL_RATES : {'□':0.75};
  return Math.floor((base * rates['□']) / 100) * 100;
}

function smPrevSym(sym){
  var idx = SALE_SYMBOLS.indexOf(sym);
  return (idx>0) ? SALE_SYMBOLS[idx-1] : sym;
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

// Drive上の古いデータに新しいフィールドがなくても、端末側のオーナー指示を消さない。
// 両方に指示がある場合は、更新時刻が新しい方を採用する。
function smMergeRemoteItem(localItem, remoteItem){
  localItem = localItem || {};
  remoteItem = remoteItem || {};
  var merged = Object.assign({}, localItem, remoteItem);
  var localStamp = localItem.ownerInstructionUpdatedAt || '';
  var remoteStamp = remoteItem.ownerInstructionUpdatedAt || '';
  var ownerSource = null;
  if(localStamp || remoteStamp){
    ownerSource = remoteStamp >= localStamp ? remoteItem : localItem;
  } else if(Object.prototype.hasOwnProperty.call(localItem, 'ownerInstruction') &&
            !Object.prototype.hasOwnProperty.call(remoteItem, 'ownerInstruction')){
    ownerSource = localItem;
  }
  if(ownerSource){
    merged.ownerInstruction = ownerSource.ownerInstruction || '';
    merged.ownerInstructionNote = ownerSource.ownerInstructionNote || '';
    merged.ownerInstructionAt = ownerSource.ownerInstructionAt || '';
    merged.ownerInstructionUpdatedAt = ownerSource.ownerInstructionUpdatedAt || '';
  }
  return merged;
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
      Object.keys(remote).forEach(function(k){ local[k]=smMergeRemoteItem(local[k], remote[k]); });
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
    // 無視する条件2：私物（アルファベットが含まれていない管理番号）
    if(!/[a-zA-Z]/.test(item.code)) return false;
    if((item.stock||0) <= 0 || item.status === '1' || item.status === 1) return; // 数量0、またはステータス1（非公開）を除外
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

  var d = new Date();
  d.setHours(0,0,0,0);
  var year = d.getFullYear();
  var month = d.getMonth();
  Object.keys(all).forEach(function(code){
    var sd = all[code];
    if(!sd.tasks) return;
    var item = items.find(function(i){ return i.code===code; });
    if(!item) return;
    if(!item.code || item.code==='CHECK' || !/[a-zA-Z]/.test(item.code)) return;
    if((item.stock||0) <= 0 || item.status === '1' || item.status === 1) return; 

    var REPORT_OVER_DAYS = typeof CONFIG !== 'undefined' ? CONFIG.REPORT_OVER_DAYS : 10;
    var finalSym = SALE_SYMBOLS[SALE_SYMBOLS.length - 1];
    if(sd.symbol === finalSym) {
       var baseDate = sd.reportedAt || item.shopsUpdatedAt;
       var passedDays = smDaysDiff(baseDate);
       if(passedDays >= REPORT_OVER_DAYS) {
           tasks.push({
             taskId: 'REPORT_' + code,
             code: code,
             title: code,
             type: 'report',
             desc: '🚨 オーナーへ至急報告',
             dueDate: today,
             overdueDays: passedDays
           });
       }
    }

    sd.tasks.forEach(function(t){
      if(t.status==='done') return;
      var over = smDaysDiff(t.dueDate);
      // いいね数が取得済みでSALE_MIN_LIKES以上なら表示名をセールに変更
      var taskLikes = (typeof item.likes !== 'undefined' && item.likes >= 0) ? item.likes : -1;
      var displayDesc = (t.type === 'symbol_change' && taskLikes >= SALE_MIN_LIKES)
        ? ('🔥 ゲリラセール実施（いいね' + taskLikes + '件）')
        : t.desc;
      tasks.push({
        taskId:t.id, code:code,
        title:item.title, type:t.type, desc:displayDesc,
        dueDate:t.dueDate, overdueDays:over
      });
    });

    // ZOMBIE RECOVERY
    var hasPending = sd.tasks.some(function(t){ return t.status==='pending'; });
    if(sd.symbol !== finalSym && !hasPending) {
        var nextSym = smNextSym(sd.symbol);
        if(nextSym) {
            var SALE_INTERVAL = typeof CONFIG !== 'undefined' ? CONFIG.SALE_INTERVAL : 10;
            var baseStr = item.shopsUpdatedAt || today;
            var targetDateStr = typeof shiftDateToSaleDay === 'function' ? shiftDateToSaleDay(smAddDays(baseStr, SALE_INTERVAL)) : smAddDays(baseStr, SALE_INTERVAL);
            var over = smDaysDiff(targetDateStr);
            var zombieLikes = (typeof item.likes !== 'undefined' && item.likes >= 0) ? item.likes : -1;
            var zombieDesc = (zombieLikes >= SALE_MIN_LIKES)
                ? ('🔥 ゲリラセール実施（いいね' + zombieLikes + '件）')
                : (nextSym + ' に記号変更');
            tasks.push({
                taskId: 'ZOMBIE_' + code,
                code: code,
                title: item.title,
                type: 'symbol_change',
                desc: zombieDesc,
                dueDate: targetDateStr,
                overdueDays: over
            });
        }
    }
  });
  tasks.sort(function(a,b){
    return b.overdueDays - a.overdueDays;
  });
  return tasks;
}

function smCompleteTask(code, taskId, revertConfirmed){
  var sd = smGetItem(code);
  if (taskId.startsWith('REPORT_')) {
      sd.reportedAt = smTodayStr();
      smSetItem(code, sd);
      smRenderAll();
      showToast('✅ 報告を完了し、タイマーをリセットしました', 1500);
      return;
  }
  var t = (sd.tasks||[]).find(function(x){ return x.id===taskId; });
  if(t && t.type === 'revert_check' && !revertConfirmed){
    smOpenRevertChecklist(code, taskId);
    return;
  }
  if(t){ t.status='done'; t.completedAt=smTodayStr(); }
  smSetItem(code, sd);
  smRenderAll();
  showToast('✅ タスクを完了しました', 1500);
}

// セール翌日の作業は、価格復元とコメント削除の両方を確認するまで完了不可。
function smOpenRevertChecklist(code, taskId){
  smCloseRevertChecklist();
  var item = items.find(function(i){ return i.code === code; });
  var modal = document.createElement('div');
  modal.id = 'sm-revert-check-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px;';
  modal.innerHTML = '<div style="width:min(520px,100%);background:#111827;border:1px solid rgba(248,113,113,.45);border-radius:14px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.45);">'
    +'<div style="font-size:1.05rem;font-weight:700;color:#fca5a5;margin-bottom:6px;">🚨 セール翌日の完了確認</div>'
    +'<div style="font-size:.78rem;color:#cbd5e1;margin-bottom:14px;">'+esc(code)+(item?'　'+esc(item.title.slice(0,60)):'')+'</div>'
    +'<label style="display:flex;gap:10px;align-items:flex-start;background:rgba(255,255,255,.05);padding:12px;border-radius:8px;margin-bottom:9px;color:#e2e8f0;cursor:pointer;"><input type="checkbox" id="sm-revert-price" style="margin-top:3px;transform:scale(1.25);"><span><b>価格を元に戻しました</b><br><small style="color:#94a3b8;">各販売先の価格がセール前の状態か確認してください</small></span></label>'
    +'<label style="display:flex;gap:10px;align-items:flex-start;background:rgba(255,255,255,.05);padding:12px;border-radius:8px;margin-bottom:16px;color:#e2e8f0;cursor:pointer;"><input type="checkbox" id="sm-revert-comment" style="margin-top:3px;transform:scale(1.25);"><span><b>メルカリのセールコメントを削除しました</b><br><small style="color:#94a3b8;">商品ページを開き、コメントが残っていないか確認してください</small></span></label>'
    +'<div style="display:flex;gap:8px;"><button id="sm-revert-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#cbd5e1;cursor:pointer;">戻る</button><button id="sm-revert-finish" disabled style="flex:2;padding:10px;border-radius:8px;border:1px solid rgba(34,197,94,.45);background:rgba(34,197,94,.18);color:#86efac;font-weight:700;cursor:pointer;opacity:.4;">両方確認してタスク完了</button></div>'
    +'</div>';
  document.body.appendChild(modal);
  var priceCheck = document.getElementById('sm-revert-price');
  var commentCheck = document.getElementById('sm-revert-comment');
  var finish = document.getElementById('sm-revert-finish');
  function updateButton(){
    var ok = priceCheck.checked && commentCheck.checked;
    finish.disabled = !ok;
    finish.style.opacity = ok ? '1' : '.4';
  }
  priceCheck.addEventListener('change', updateButton);
  commentCheck.addEventListener('change', updateButton);
  document.getElementById('sm-revert-cancel').addEventListener('click', smCloseRevertChecklist);
  finish.addEventListener('click', function(){
    if(!priceCheck.checked || !commentCheck.checked) return;
    smCloseRevertChecklist();
    smCompleteTask(code, taskId, true);
  });
}

function smCloseRevertChecklist(){
  var modal = document.getElementById('sm-revert-check-modal');
  if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
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

function shiftDateToSaleDay(dStr) {
    if (!dStr) return dStr;
    var d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    var day = d.getDate();
    // 28〜4日は1日へ
    if (day >= 28 || day <= 4) {
        if (day >= 28) d.setMonth(d.getMonth() + 1);
        d.setDate(1);
        return smFmtDateOnly(d);
    }
    // 5〜12日は8日へ
    if (day >= 5 && day <= 12) {
        d.setDate(8);
        return smFmtDateOnly(d);
    }
    return dStr; // そのまま
}
function smFmtDateOnly(d) {
    var y = d.getFullYear();
    var m = ('0'+(d.getMonth()+1)).slice(-2);
    var day = ('0'+d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
}


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
  smUpdateSaleBanner();
  var el = document.getElementById('sm-task-list');
  if(!el) return;
  var tasks = smGetAllTasks();

  if(!tasks.length){
    el.innerHTML = '<div style="padding:10px 16px;color:#cbd5e1;font-size:0.82rem;">✅ 期限のタスクはありません</div>';
    return;
  }

  var copyBtnHTML = '<div style="padding: 10px;"><button id="btn-batch-copy-tasks" style="width:100%; padding: 12px; background:#e74c3c; color:white; font-weight:bold; border:none; border-radius:5px; cursor:pointer; font-size:14px;">📝 オーナーへの本日の報告をコピー</button></div>';
  el.innerHTML = copyBtnHTML + tasks.map(function(t){
    var over = t.overdueDays>0;
    var today = t.dueDate===smTodayStr();
    var bg   = over ? 'rgba(239,68,68,0.10)' : today ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)';
    var badge = over
      ? '<span style="font-size:0.68rem;font-weight:700;color:#f87171;background:rgba(239,68,68,0.15);padding:2px 7px;border-radius:4px;">🔴 '+t.overdueDays+'日超過</span>'
      : today
        ? '<span style="font-size:0.68rem;font-weight:700;color:#fbbf24;background:rgba(251,191,36,0.12);padding:2px 7px;border-radius:4px;">🟡 今日</span>'
        : '<span style="font-size:0.68rem;color:#cbd5e1;background:rgba(255,255,255,0.05);padding:2px 7px;border-radius:4px;">'+smFmtDate(t.dueDate)+'</span>';
    var completeLabel = t.type === 'revert_check' ? '☑ 確認へ' : '✅ 完了';
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:'+bg+';border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;" onclick="smSelectItem(\''+esc(t.code)+'\')">'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:0.72rem;color:#cbd5e1;">'+esc(t.code)+'</div>'
      +'<div style="font-size:0.8rem;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(t.desc)+'</div>'
      +'</div>'
      +badge
      +'<button onclick="event.stopPropagation();smCompleteTask(\''+esc(t.code)+'\',\''+t.taskId+'\')" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#86efac;border-radius:5px;padding:3px 9px;font-size:0.72rem;cursor:pointer;white-space:nowrap;">'+completeLabel+'</button>'
      +'</div>';
  }).join('');
}

// ---------- 商品リスト ----------
function smRenderList(){
  var el = document.getElementById('sm-item-list');
  if(!el) return;
  var targets = smGetTargets();

  if(!targets.length){
    el.innerHTML='<div style="padding:32px;text-align:center;color:#cbd5e1;"><div style="font-size:2rem;margin-bottom:8px;">✅</div><div>'+SALE_INTERVAL+'日以上経過した商品はありません</div></div>';
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
  var ownerInstruction = sd.ownerInstruction || '';
  var ownerInstructionNote = sd.ownerInstructionNote || '';

  var relistWarningHtml = ownerInstruction === 'relist'
    ? '<div style="background:rgba(239,68,68,.18);border:2px solid #ef4444;border-radius:12px;padding:15px;margin-bottom:16px;box-shadow:0 0 18px rgba(239,68,68,.22);">'
      +'<div style="font-size:1.05rem;font-weight:800;color:#fecaca;margin-bottom:9px;">⚠️ オーナーから「再出品」の指示があります</div>'
      +'<div style="color:#fff;font-size:.86rem;line-height:1.65;font-weight:650;">'
      +'<div style="margin-bottom:8px;">【全販売先共通】<br>☑ オーナーの指示を最優先する<br>☑ 記号を <b style="font-size:1.15em;">●</b> に戻す<br>☑ タイトル・説明文の「最終価格」「底値」を必ず消す</div>'
      +'<div style="background:rgba(255,255,255,.09);border-radius:7px;padding:8px;">【メルカリのみ】<br>⚠️ 新規再出品しない。既存ページの価格と記号だけ修正する<br><span style="font-size:.76rem;color:#fecaca;">※ヤフオク・ラクマ・ヤフーフリマに対する禁止ではありません。</span></div>'
      +'</div>'
      +(ownerInstructionNote?'<div style="margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.16);color:#fde68a;font-size:.8rem;">📝 '+esc(ownerInstructionNote)+'</div>':'')
      +'</div>' : '';

  var instructionReminderHtml = !ownerInstruction
    ? '<div style="background:rgba(251,191,36,.14);border:2px solid #f59e0b;border-radius:11px;padding:13px;margin-bottom:15px;color:#fef3c7;">'
      +'<div style="font-size:.95rem;font-weight:800;margin-bottom:4px;">⚠️ オーナー指示の登録漏れはありませんか？</div>'
      +'<div style="font-size:.78rem;line-height:1.55;">チャットの返信を確認し、下の「オーナー指示を登録・変更」で必ず選択してください。指示がなければ「指示なし（確認済み）」を選びます。</div>'
      +'</div>' : '';

  var instructionHtml = '<details style="margin-bottom:16px;background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.2);border-radius:10px;padding:10px 12px;"'+(ownerInstruction?' open':'')+'>'
    +'<summary style="font-size:.8rem;color:#fde68a;cursor:pointer;font-weight:650;">📣 オーナー指示を登録・変更'+(ownerInstruction?'（登録済み）':'')+'</summary>'
    +'<div style="margin-top:10px;display:grid;gap:8px;">'
    +'<select id="sm-owner-inst-'+esc(item.code)+'" style="width:100%;background:#111827;border:1px solid rgba(255,255,255,.18);color:#e2e8f0;border-radius:7px;padding:8px;">'
    +'<option value=""'+(!ownerInstruction?' selected':'')+'>未確認（まだ登録していない）</option>'
    +'<option value="none"'+(ownerInstruction==='none'?' selected':'')+'>指示なし（確認済み）</option>'
    +'<option value="relist"'+(ownerInstruction==='relist'?' selected':'')+'>再出品</option>'
    +'<option value="continue"'+(ownerInstruction==='continue'?' selected':'')+'>販売継続</option>'
    +'<option value="stop"'+(ownerInstruction==='stop'?' selected':'')+'>出品停止・処分</option>'
    +'</select>'
    +'<input id="sm-owner-note-'+esc(item.code)+'" value="'+esc(ownerInstructionNote)+'" placeholder="オーナーからの補足指示（任意）" style="width:100%;box-sizing:border-box;background:#111827;border:1px solid rgba(255,255,255,.18);color:#e2e8f0;border-radius:7px;padding:8px;">'
    +'<button onclick="smSaveOwnerInstruction(\''+esc(item.code)+'\')" style="padding:8px;border-radius:7px;border:1px solid rgba(251,191,36,.4);background:rgba(251,191,36,.14);color:#fde68a;font-weight:700;cursor:pointer;">指示を保存</button>'
    +'</div></details>';

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

  
var alertHtml = '';
if (item.actualSymbol && sym && item.actualSymbol !== sym) {
  var csvDateStr = localStorage.getItem('csv_updated_at') || '';
  var changedAtStr = sd.symbolChangedAt || '';
  
  if (csvDateStr && changedAtStr) {
    var csvDate = new Date(csvDateStr.replace(' 更新', '').replace(/\//g, '-'));
    var changeDate = new Date(changedAtStr);
    
    // If the dashboard was changed BEFORE the CSV was downloaded, and symbols don't match -> ALARM!
    if (changeDate < csvDate) {
      alertHtml = '<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.5);border-radius:10px;padding:12px;margin-bottom:16px;box-shadow: 0 0 10px rgba(239,68,68,0.3);">'
        + '<div style="font-size:0.9rem;font-weight:700;color:#fca5a5;margin-bottom:4px;">🚨 警告：メルカリ側の説明文（記号）が更新されていません！</div>'
        + '<div style="font-size:0.75rem;color:#fecaca;">ダッシュボード上の記号は <b style="color:#fff;background:rgba(255,255,255,0.2);padding:2px 4px;border-radius:3px;">' + sym + '</b> に進んでいますが、メルカリ側の説明文は <b style="color:#fff;background:rgba(255,255,255,0.2);padding:2px 4px;border-radius:3px;">' + item.actualSymbol + '</b> のままです。<br>スタッフが更新作業を忘れたか、システムのみ完了させています。直ちに修正してください。</div>'
        + '</div>';
    }
  }
}

var html = '<div style="padding:16px;">'
+ alertHtml
+ relistWarningHtml
+ instructionReminderHtml
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

    +instructionHtml

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

function smSaveOwnerInstruction(code){
  var select = document.getElementById('sm-owner-inst-'+code);
  var note = document.getElementById('sm-owner-note-'+code);
  if(!select) return;
  var sd = smGetItem(code);
  sd.ownerInstruction = select.value || '';
  sd.ownerInstructionNote = note ? note.value.trim() : '';
  sd.ownerInstructionAt = sd.ownerInstruction ? smTodayStr() : '';
  sd.ownerInstructionUpdatedAt = new Date().toISOString();
  smSetItem(code, sd);
  _smSelected = code;
  smRenderAll();
  showToast(sd.ownerInstruction ? '✅ オーナー指示を保存しました' : '✅ オーナー指示を解除しました', 2000);
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

  
  var pendingTasks = (sd.tasks||[]).filter(function(t){ return t.status==='pending'; });
  pendingTasks.sort(function(a,b){ return a.dueDate < b.dueDate ? -1 : (a.dueDate > b.dueDate ? 1 : 0); });
  var nextTask = pendingTasks.length > 0 ? pendingTasks[0] : null;
  var html = '';
  function cbtn(v){ return '<button title="コピー" onclick="navigator.clipboard.writeText(\''+v+'\');showToast(\'✅ '+v+' をコピーしました\', 1500);event.stopPropagation();" style="margin-left:5px;padding:2px 6px;font-size:0.7rem;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:#e2e8f0;border-radius:4px;cursor:pointer;vertical-align:middle;">📋</button>'; }





  if(nextTask && nextTask.type === 'price_discount'){
    var targetPrice = price - SALE_DISC_AMT;
    if(targetPrice < 0) targetPrice = 0;
    var yaAdd = targetPrice < 10000 ? 1000 : (targetPrice < 20000 ? 1500 : 2000);
    var yaSokketu = targetPrice + yaAdd;

    html += '<div style="background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.25);border-radius:10px;padding:14px;margin-bottom:12px;">'
      +'<div style="font-size:0.82rem;font-weight:700;color:#38bdf8;margin-bottom:6px;">💡 500円値下げアクション（タスク対応）</div>'
      +'<div style="display:grid; grid-template-columns:230px 1fr; row-gap:10px; align-items:center; font-size:0.95rem; color:#e2e8f0; margin-bottom:12px;">'
      +'<div style="color:#cbd5e1;font-size:0.85rem;">メルカリShops、ラクマ</div>'
      +'<div><span style="color:#94a3b8;text-decoration:line-through;">¥'+price.toLocaleString()+'</span> → <b style="color:#86efac;font-size:1.15em;">¥'+targetPrice.toLocaleString()+'</b>'+cbtn(targetPrice)+'</div>'
      +'<div style="color:#cbd5e1;font-size:0.85rem;">メルカリ</div>'
      +'<div><b style="color:#fca5a5;font-size:1.15em;">¥'+(targetPrice+1000).toLocaleString()+'</b>'+cbtn(targetPrice+1000)+'</div>'
      +'<div style="color:#cbd5e1;font-size:0.85rem;">ヤフーフリマ</div>'
      +'<div><b style="color:#fde047;font-size:1.15em;">¥'+(Math.floor(targetPrice/1000)*1000).toLocaleString()+'</b>'+cbtn(Math.floor(targetPrice/1000)*1000)+'</div>'
      +'<div style="color:#cbd5e1;font-size:0.85rem;">ヤフオク</div>'
      +'<div><span style="font-size:0.85em;color:#94a3b8;">開始:</span> <b style="color:#fdba74;font-size:1.15em;">¥'+targetPrice.toLocaleString()+'</b>'+cbtn(targetPrice)+'&nbsp;&nbsp;<span style="font-size:0.85em;color:#94a3b8;">即決:</span> <b style="color:#fdba74;font-size:1.15em;">¥'+yaSokketu.toLocaleString()+'</b>'+cbtn(yaSokketu)+'</div>'
      +'</div>'
      +'<button onclick="smCompleteTask(\''+esc(code)+'\',\''+nextTask.id+'\')" style="width:100%;background:rgba(56,189,248,0.18);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;border-radius:7px;padding:9px;font-size:0.83rem;cursor:pointer;font-weight:600;">✅ Shops等で価格変更後に押す（タスク完了）</button>'
      +'</div>';
      
    result.innerHTML = html;
    return;
  }

  if(!nextSym){
    var baseDate = sd.reportedAt || item.shopsUpdatedAt;
    var d = smDaysDiff(baseDate);
    var reportDays = typeof CONFIG !== 'undefined' ? CONFIG.REPORT_OVER_DAYS : 10;
    var html = '';
    if(d < reportDays) {
      html = '<div style="background:rgba(100,116,139,0.12);border-radius:8px;padding:12px;color:#d1d5db;font-size:0.83rem;">'
        + '✅ すべてのステップが完了しています。<br><br>'
        + '💡 オーナーへの最終報告まであと <b style="color:#fbbf24;font-size:1rem;">' + (reportDays - d) + '</b> 日です。'
        + '</div>';
    } else if(d === reportDays) {
      html = '<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;color:#fca5a5;font-size:0.83rem;">'
        + '🚨 <b>本日がオーナーへの最終報告日です！</b>（更新から'+reportDays+'日経過）'
        + '</div>';
    } else {
      html = '<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;color:#fca5a5;font-size:0.83rem;">'
        + '🚨 <b>オーナーに最終報告をしてください！</b><br>'
        + '（報告期日から <b style="color:#f87171;font-size:1rem;">' + (d - reportDays) + '</b> 日過ぎています）'
        + '</div>';
    }
    if (d >= reportDays) {
        html += '<div style="margin-top:12px;"><button onclick="smCompleteTask(\''+esc(code)+'\', \'REPORT_\'+esc(code))" style="width:100%;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;border-radius:7px;padding:9px;font-size:0.83rem;cursor:pointer;font-weight:600;">✅ 報告完了（タイマーをリセット）</button></div>';
    }
    result.innerHTML = html;
    return;
  }

  var base      = smBasePrice(sym, price);
  var nextPrice = (nextSym==='□') ? smBoxPrice(price) : smSymPrice(base, nextSym);
  var hasSale   = likes >= SALE_MIN_LIKES;
  var isOwner   = nextSym==='〇';
  var saleTime  = SALE_TIMES_BY_DOW[new Date().getDay()];
  var nextColor = {'■':'#94a3b8','▲':'#fbbf24','〇':'#fb923c','□':'#f87171'}[nextSym]||'#86efac';

  
  var html = '';
  var HIGH_PRICE_ALERT = typeof CONFIG !== 'undefined' ? CONFIG.HIGH_PRICE_ALERT : 30000;
  if(base >= HIGH_PRICE_ALERT) {
    html += '<div style="background:rgba(239,68,68,0.15);border:2px solid #ef4444;border-radius:10px;padding:12px;margin-bottom:12px;color:#fca5a5;font-weight:bold;font-size:0.9rem;text-align:center;">'
      + '🚨 原価が3万円以上の高額商品です。<br>記号を変更する前にオーナーに報告して許可をもらってください！'
      + '</div>';
  }


  // --- セールあり ---
  if(hasSale){
    var saleText = smGenSaleText(price + 1000, nextPrice, saleTime);
    var _yaAdd = nextPrice < 10000 ? 1000 : (nextPrice < 20000 ? 1500 : 2000);
    var _yaSokketu = nextPrice + _yaAdd;
    var _yfFlea = Math.floor(nextPrice/1000)*1000;
    html += '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px;margin-bottom:12px;">'
      +'<div style="font-size:0.82rem;font-weight:700;color:#f87171;margin-bottom:10px;">🔥 セール実施（いいね'+likes+'件 ≥ '+SALE_MIN_LIKES+'）</div>'

      // 価格一覧
      +'<div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:10px;margin-bottom:10px;">'
      +'<div style="font-size:0.72rem;color:#d1d5db;margin-bottom:6px;">① 各プラットで価格変更（Shops: タイムセール予約 or 手動→翌日戻す）</div>'
      +'<div style="display:grid;grid-template-columns:200px 1fr;row-gap:8px;align-items:center;font-size:0.92rem;color:#e2e8f0;">'
      +'<div style="color:#86efac;font-size:0.85rem;">メルカリShops</div>'
      +'<div><b style="color:#86efac;font-size:1.15em;">¥'+nextPrice.toLocaleString()+'</b>'+cbtn(nextPrice)+'&nbsp;<span style="font-size:0.8rem;color:#94a3b8;">'+saleTime+'</span></div>'
      +'<div style="color:#86efac;font-size:0.85rem;">メルカリ（フリマ）</div>'
      +'<div><b style="color:#86efac;font-size:1.15em;">¥'+nextPrice.toLocaleString()+'</b>'+cbtn(nextPrice)+'</div>'
      +'<div style="color:#86efac;font-size:0.85rem;">ラクマ</div>'
      +'<div><b style="color:#86efac;font-size:1.15em;">¥'+nextPrice.toLocaleString()+'</b>'+cbtn(nextPrice)+'</div>'
      +'<div style="grid-column:1/-1;border-top:1px solid rgba(255,255,255,0.07);margin:4px 0;"></div>'
      +'<div style="color:#475569;font-size:0.78rem;">── 参考（操作不要）──</div><div></div>'
      +'<div style="color:#64748b;font-size:0.85rem;">ヤフーフリマ</div>'
      +'<div><b style="color:#94a3b8;font-size:1.05em;">¥'+_yfFlea.toLocaleString()+'</b>'+cbtn(_yfFlea)+'</div>'
      +'<div style="color:#64748b;font-size:0.85rem;">ヤフオク</div>'
      +'<div><span style="font-size:0.78rem;color:#64748b;">最低入札</span>&nbsp;<b style="color:#94a3b8;font-size:1.05em;">¥'+nextPrice.toLocaleString()+'</b>'+cbtn(nextPrice)+'&nbsp;&nbsp;<span style="font-size:0.78rem;color:#64748b;">即決</span>&nbsp;<b style="color:#94a3b8;font-size:1.05em;">¥'+_yaSokketu.toLocaleString()+'</b>'+cbtn(_yaSokketu)+'</div>'
      +'</div>'
      +'<div style="font-size:0.72rem;color:#94a3b8;margin-top:6px;">📌 翌日にShops価格を元に戻すこと（タイムセール非対応の場合は手動で戻す）</div>'
      +'</div>'

      // セール文
      +'<div style="font-size:0.72rem;color:#d1d5db;margin-bottom:4px;">② コメント欄にセール文をコピペ</div>'
      +'<textarea id="sm-stext-'+esc(code)+'" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;border-radius:6px;padding:8px;font-size:0.78rem;resize:vertical;min-height:110px;">'+saleText+'</textarea>'
      +'<button onclick="smCopyText(\'sm-stext-'+esc(code)+'\')" style="width:100%;margin-top:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;border-radius:6px;padding:7px;font-size:0.8rem;cursor:pointer;">📋 セール文をコピー</button>'

      // セール実施完了ボタン
      +'<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">'
      +'<div style="font-size:0.72rem;color:#d1d5db;margin-bottom:4px;">③ セールを実際に行う日を確認（通常の火・水・木セールも、事前予約なら予定日を入力）</div>'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
      +'<span style="font-size:0.78rem;color:#94a3b8;white-space:nowrap;">セール実施日:</span>'
      +'<input type="date" id="sm-saledate-'+esc(code)+'" value="'+smTodayStr()+'" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;border-radius:5px;padding:4px 8px;font-size:0.82rem;">'
      +'</div>'
      +'<div style="font-size:0.7rem;color:#94a3b8;margin:-2px 0 8px;">当日実施：今日のまま ／ 事前予約：1日・8日に限らず実施予定日を選択</div>'
      +'<button onclick="smAfterSale(\''+esc(code)+'\',\''+nextSym+'\','+nextPrice+', document.getElementById(\'sm-saledate-'+esc(code)+'\').value)" style="width:100%;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;border-radius:7px;padding:9px;font-size:0.83rem;cursor:pointer;font-weight:600;">✅ セール設定完了（翌日タスクを自動追加）</button>'
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
      + '<button onclick="smDoChange(\''+esc(code)+'\',\''+nextSym+'\','+nextPrice+')" style="width:100%;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;border-radius:7px;padding:9px;font-size:0.83rem;cursor:pointer;font-weight:600;">⚠️ オーナー承認済み：'+nextSym+'に変更</button>'
      +'</div>';
  } else {
    var isBox = nextSym==='□';
    html += '<div style="background:'+(isBox?'rgba(239,68,68,0.07)':'rgba(34,197,94,0.07)')+';border:1px solid '+(isBox?'rgba(239,68,68,0.25)':'rgba(34,197,94,0.25)')+';border-radius:10px;padding:14px;margin-bottom:12px;">'
      +'<div style="font-size:0.82rem;font-weight:700;color:'+(isBox?'#f87171':'#86efac')+';margin-bottom:6px;">'+(isBox?'🏁 最終フェーズ（底値）':'📋 記号変更')+'</div>'
      +gridHtml
      + '<button onclick="smDoChange(\''+esc(code)+'\',\''+nextSym+'\','+nextPrice+')" style="width:100%;background:'+(isBox?'rgba(239,68,68,0.18)':'rgba(34,197,94,0.18)')+';border:1px solid '+(isBox?'rgba(239,68,68,0.4)':'rgba(34,197,94,0.4)')+';color:'+(isBox?'#fca5a5':'#86efac')+';border-radius:7px;padding:9px;font-size:0.83rem;cursor:pointer;font-weight:600;">✅ Shopsで価格変更後に押す（'+nextSym+' / ¥'+nextPrice.toLocaleString()+'）</button>'
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
function smAfterSale(code, nextSym, nextPrice, saleDate){
  var sdUndo = smGetItem(code);
  localStorage.setItem('sm_undo', JSON.stringify({code:code, data:JSON.parse(JSON.stringify(sdUndo)), action:'afterSale'}));
  var today = smTodayStr();
  // セール実施日（指定がなければ今日）
  var actualSaleDate = (saleDate && /^\d{4}-\d{2}-\d{2}$/.test(saleDate)) ? saleDate : today;

  // Reset the base update date to セール実施日（スケジュールリセット基準）
  var itemIndex = items.findIndex(function(i){ return i.code === code; });
  if(itemIndex !== -1) {
    items[itemIndex].shopsUpdatedAt = actualSaleDate + 'T00:00:00.000Z';
  }

  // 翌日戻すタスクのみ追加（実施日の翌日）
  smAddTask(code,{
    type:'revert_check', dueDate:smAddDays(actualSaleDate, 1),
    desc:'価格を元に戻す＋メルカリのセールコメントを削除'
  });

  var sd = smGetItem(code);
  smSetItem(code, sd);

  var msg = (actualSaleDate === today)
    ? '✔ ゲリラセール実施（スケジュールリセット）'
    : ('✔ セール設定完了（実施日: ' + actualSaleDate + ' 起算でリセット）');
  showToast(msg, 3000);
  smRenderAll();
}

// 記号変更実行
function smDoChange(code, newSym, newPrice){
  var sd = smGetItem(code);
  localStorage.setItem('sm_undo', JSON.stringify({code:code, data:JSON.parse(JSON.stringify(sd)), action:'doChange'}));
  sd.symbol = newSym;
  sd.symbolChangedAt = smTodayStr();

  // 設定日数後：500円値下げ
  if(!sd.tasks) sd.tasks=[];
  sd.tasks.push({
    id:smGenId(), type:'sym', status:'done',
    dueDate:smTodayStr(),
    desc: newSym + ' に記号変更'
  });
  sd.tasks.push({
    id:smGenId(), type:'price_discount'
, status:'pending',
    dueDate:shiftDateToSaleDay(smAddDays(smTodayStr(), SALE_HALF_DAYS)),
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
  
  if(url.indexOf('drive.google.com') !== -1) {
    alert('【エラー】\n入力されたのはGoogleドライブのフォルダURLです。\n\nここは「Google Apps Script (GAS) のWebアプリURL」を入力する欄です。\nsale_gas.txt の手順に従ってGASをデプロイし、\nhttps://script.google.com/macros/s/... から始まるURLを入力してください。');
    return;
  }
  
  if(url.indexOf('script.google.com') === -1) {
    alert('【警告】\n入力されたURLはGoogle Apps Scriptのもの（script.google.com）ではないようです。正しく動作しない可能性があります。');
  }

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
// ===== スタッフ同期用（エクスポート・インポート） =====
window.smExportData = function() {
  var keys = ['listing_mgr_v5', 'item_dict', 'csv_filename', 'csv_updated_at', 'sale_data_v1', 'saleGasUrl', 'last_seed'];
  var data = {};
  keys.forEach(function(k) {
    var val = localStorage.getItem(k);
    if (val !== null) data[k] = val;
  });
  var jsonStr = JSON.stringify(data, null, 2);
  var blob = new Blob([jsonStr], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var d = new Date();
  var dStr = d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2) + '_' + ('0'+d.getHours()).slice(-2) + ('0'+d.getMinutes()).slice(-2);
  a.download = 'shuppin_data_' + dStr + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('✅ データを保存（エクスポート）しました', 3000);
};

window.smImportData = function(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if(confirm('現在のデータを上書きして、選択したバックアップデータを取り込みますか？\n（取り込み後、画面は自動的にリロードされます）')) {
        Object.keys(data).forEach(function(k) {
          if (data[k] !== null) {
            localStorage.setItem(k, data[k]);
          }
        });
        alert('データの取り込みが完了しました。画面を更新します。');
        location.reload();
      }
    } catch(err) {
      alert('エラー: 有効なデータファイル(.json)ではありません。');
    }
    event.target.value = ''; // リセット
  };
  reader.readAsText(file);
};




function smUpdateSaleBanner() {
  var el = document.getElementById('global-sale-banner');
  if(!el) return;

  var d = new Date();
  d.setHours(0,0,0,0);
  var year = d.getFullYear();
  var month = d.getMonth();
  
  var targets = [
    new Date(year, month, 1),
    new Date(year, month, 8),
    new Date(year, month+1, 1)
  ];

  var html = '';
  
  for (var i=0; i<targets.length; i++) {
    var targetDate = targets[i];
    var diff = Math.floor((targetDate - d)/(1000*60*60*24));
    
    if (diff >= -1 && diff <= 5) {
      if (diff > 0) {
        html = '<div style="font-size:1.1rem; font-weight:bold; color:#f87171;">🚨 あと' + diff + '日でセール日です。下準備をお願いします</div>' +
               '<div style="font-size:0.85rem; color:#cbd5e1; margin-top:2px;">（次回のセール：' + (targetDate.getMonth()+1) + '月' + targetDate.getDate() + '日）</div>';
      } else if (diff === 0) {
        html = '<div style="font-size:1.1rem; font-weight:bold; color:#f87171;">🚨 本日はセール当日です！</div>' +
               '<div style="font-size:0.85rem; color:#cbd5e1; margin-top:2px;">タイムセール・コメントセールの漏れがないようお願いします</div>';
      } else if (diff === -1) {
        html = '<div style="font-size:1.1rem; font-weight:bold; color:#f87171;">🚨 本日はセール翌日です。</div>' +
               '<div style="font-size:0.85rem; color:#cbd5e1; margin-top:2px;">コメントセールの削除（コメ消し）をお願いします</div>';
      }
      break;
    }
  }
  
  el.innerHTML = html;
}


// ==========================================
// Simulator UI Logic
// ==========================================
function openSimulatorModal() {
  document.getElementById('sim-modal').style.display = 'flex';
  
  // Set default date to 1st of current month
  var d = new Date();
  var startStr = d.getFullYear() + '-' + smPad2(d.getMonth()+1) + '-01';
  document.getElementById('sim-start-date').value = startStr;
  
  // Show current config
  var html = '';
  html += '<div><b>サイクル:</b> ' + (CONFIG.SALE_INTERVAL||10) + '日 / ' + (CONFIG.SALE_HALF_DAYS||5) + '日 (中間値下げ)</div>';
  html += '<div><b>値引額:</b> ' + (CONFIG.SALE_DISC_AMT||500) + '円</div>';
  html += '<div><b>記号:</b> ' + (CONFIG.SALE_SYMBOLS||[]).join('→') + '</div>';
  var rates = CONFIG.SYMBOL_RATES || {};
  var rateStrs = [];
  Object.keys(rates).forEach(function(k){ rateStrs.push(k+':'+(rates[k]*100)+'%'); });
  html += '<div><b>割引率:</b> ' + rateStrs.join(', ') + '</div>';
  document.getElementById('sim-config-display').innerHTML = html;
}

function closeSimulatorModal() {
  document.getElementById('sim-modal').style.display = 'none';
}

function runSimulation() {
  var startStr = document.getElementById('sim-start-date').value;
  var price1 = parseInt(document.getElementById('sim-price-1').value) || 16800;
  var price2 = parseInt(document.getElementById('sim-price-2').value) || 50000;
  
  if(!startStr) return;
  var dParts = startStr.split('-');
  var startD = new Date(parseInt(dParts[0]), parseInt(dParts[1])-1, parseInt(dParts[2]));
  
  document.getElementById('sim-title-1').innerText = price1.toLocaleString() + ' 円';
  document.getElementById('sim-title-2').innerText = price2.toLocaleString() + ' 円';
  
  function fmtD(dateObj) { return (dateObj.getMonth()+1)+'/'+dateObj.getDate(); }
  function addD(dObj, days) { var nd = new Date(dObj.getTime()); nd.setDate(nd.getDate()+days); return nd; }
  
    function calcRoute(basePrice, isRouteB) {
    var syms = typeof CONFIG !== "undefined" && CONFIG.SALE_SYMBOLS ? CONFIG.SALE_SYMBOLS : ['〇','●','■','▲','□'];
    var html = '<div style="margin-bottom:8px;"><b>' + fmtD(startD) + '</b>: ' + basePrice.toLocaleString() + ' (' + syms[0] + ')で出品</div>';
    
    var curPrice = basePrice;
    var curDate = startD;
    var interval = typeof CONFIG !== "undefined" && CONFIG.SALE_INTERVAL ? CONFIG.SALE_INTERVAL : 10;
    var half = typeof CONFIG !== "undefined" && CONFIG.SALE_HALF_DAYS ? CONFIG.SALE_HALF_DAYS : 5;
    var disc = typeof CONFIG !== "undefined" && CONFIG.SALE_DISC_AMT ? CONFIG.SALE_DISC_AMT : 500;
    var HIGH_PRICE_ALERT = typeof CONFIG !== 'undefined' ? CONFIG.HIGH_PRICE_ALERT : 30000;
    
    var nextSymIndex = 0;
    
    while(nextSymIndex < syms.length) {
        var sym = syms[nextSymIndex];
        
        // 記号変更 (Except for the first symbol which is the listing)
        if (nextSymIndex > 0) {
            var hDate = addD(curDate, interval);
            curPrice = smSymPrice(basePrice, sym);
            html += '<div style="margin-top:4px;"><b>' + fmtD(hDate) + '</b>: 記号変更 ('+sym+') ⇒ ' + curPrice.toLocaleString();
            if(sym === '〇' || sym === '□' || basePrice >= HIGH_PRICE_ALERT) {
                html += ' <span style="color:#f87171; font-weight:bold;">(🚨オーナー報告)</span>';
            }
            html += '</div>';
            curDate = hDate; // Update curDate to the start of this cycle
        }
        
        // 5日目値下げ
        var dDate = addD(curDate, half);
        curPrice -= disc;
        html += '<div><b>' + fmtD(dDate) + '</b>: '+disc+'円値下げ ⇒ ' + curPrice.toLocaleString() + '</div>';
        
        // 8日目ゲリラセール (For ●, ■, ▲ if isRouteB is true)
        // syms[0] is usually ●, syms[1] is ■, syms[2] is ▲. 
        if (isRouteB && nextSymIndex < 3) {
            var day8 = addD(curDate, 8);
            var nextSym = syms[nextSymIndex + 1] || syms[syms.length - 1];
            var salePrice = smSymPrice(basePrice, nextSym);
            html += '<div style="color:#fca5a5; margin-top:4px; padding-left:8px; border-left:2px solid #f87171;">';
            html += '<b>' + fmtD(day8) + '</b>: ゲリラセール! ('+salePrice.toLocaleString()+')<br>';
            html += '<b>' + fmtD(addD(day8, 1)) + '</b>: 元値に戻す ('+curPrice.toLocaleString()+')<br>';
            if (nextSymIndex === 0) {
                html += '<span style="color:#fbbf24">※ここから5日・10日サイクルへ</span>';
            }
            html += '</div>';
        }
        
        nextSymIndex++;
    }
    
    var finalReport = addD(curDate, (typeof CONFIG !== "undefined" && CONFIG.REPORT_OVER_DAYS ? CONFIG.REPORT_OVER_DAYS : 10));
    html += '<div style="margin-top:8px; color:#fbbf24;"><b>' + fmtD(finalReport) + '</b>: 🚨最終報告タスク</div>';
    return html;
  }

  
  document.getElementById('sim-res-1a').innerHTML = calcRoute(price1, false);
  document.getElementById('sim-res-1b').innerHTML = calcRoute(price1, true);
  document.getElementById('sim-res-2a').innerHTML = calcRoute(price2, false);
  document.getElementById('sim-res-2b').innerHTML = calcRoute(price2, true);
}




document.addEventListener('click', function(e) {
  if (e.target && e.target.id === 'btn-batch-copy-tasks') {
    smBatchCopyTasks();
  }
});








function smBatchCopyTasks() {
  var all = smGetAll();
  // 画面のタスク一覧と同じ生成元を使う。CSV更新後に保存タスクが
  // 空でも、期限から復元される ZOMBIE タスクがここに含まれる。
  var actionableTasks = smGetAllTasks();
  var today = smTodayStr();
  var REPORT_OVER_DAYS = typeof CONFIG !== 'undefined' ? CONFIG.REPORT_OVER_DAYS : 10;
  var HIGH_PRICE_ALERT = typeof CONFIG !== 'undefined' ? CONFIG.HIGH_PRICE_ALERT : 30000;
  
  var sym80 = SALE_SYMBOLS.length > 3 ? SALE_SYMBOLS[3] : '〇';
  var finalSym = SALE_SYMBOLS[SALE_SYMBOLS.length - 1];

  var blockOverdue = [];
  var blockHighPrice = [];
  var blockMaru = [];
  var blockShikaku = [];
  var blockHighSale = [];

  Object.keys(all).forEach(function(code){
    var sd = all[code];
    var pd = items.find(function(i){ return i.code===code; });
    if(!pd) return;
    if(!smIsReportEligible(pd)) return;
    
    // Extract direct URL if available
    var directUrl = smPublicShopsUrl(pd);
    
    // 1. 規定日数超過 (最終記号で放置)
    if(sd.symbol === finalSym) {
       var baseDate = sd.reportedAt || pd.shopsUpdatedAt;
       var passedDays = smDaysDiff(baseDate);
       if(passedDays >= REPORT_OVER_DAYS) {
          blockOverdue.push({code: code, title: pd.title, price: pd.price, passedDays: passedDays, url: directUrl});
          return;
       }
    }
    
    // 2. 許可願い：期限に達した記号変更。
    // 保存済みタスクだけでなく、smGetAllTasks() が復元したタスクも対象にする。
    // 同じ商品の重複登録を避けるため、期限に達した最初の記号変更だけを使う。
    var reportTask = actionableTasks.find(function(t) {
      return t.code === code && t.type === 'symbol_change' && t.overdueDays >= 0;
    });
    if(reportTask) {
      var over = reportTask.overdueDays;
      var base = smBasePrice(sd.symbol, pd.price || 0);
      var nextSym = reportTask.nextSym || smNextSym(sd.symbol);
      var newPrice = nextSym ? smSymPrice(base, nextSym) : pd.price;
      var isHigh = (base >= HIGH_PRICE_ALERT);
      var itemData = {code: code, title: pd.title, sym: sd.symbol, nextSym: nextSym, oldPrice: pd.price, newPrice: newPrice, overdueDays: over, url: directUrl};

      if (isHigh) {
        // 高額商品は、記号変更とセールを実行前に報告する。
        // 途中の500円値下げは報告対象外。
        if ((pd.likes || 0) >= SALE_MIN_LIKES) {
          blockHighSale.push(itemData);
        } else {
          blockHighPrice.push(itemData);
        }
      } else if (nextSym === sym80) {
        // ▲⇒〇 への変更許可願い（全商品）
        blockMaru.push(itemData);
      } else if (nextSym === finalSym) {
        // 〇⇒□ への変更許可願い（全商品）
        blockShikaku.push(itemData);
      }
    }
  });

  var totalCount = blockOverdue.length + blockHighPrice.length + blockMaru.length + blockShikaku.length + blockHighSale.length;

  if (totalCount === 0) {
    var csvInfo = localStorage.getItem('csv_updated_at') || '更新日時の記録なし';
    alert('報告の抽出対象は0件です。\n\n本当に対象がない場合は問題ありません。\n最新のCSVを取り込んでいるか、CSVの在庫数が正しく読み込まれているか確認してください。\n\nCSV: ' + csvInfo);
    return;
  }

  var copyText = '【本日の作業報告：計' + totalCount + '件】\n\n';
  var counter = 1;

  function getNum() {
      var num = '(' + counter + ')';
      counter++;
      return { num: num, index: counter - 1 };
  }

  var replyTemplateOverdue = [];
  var replyTemplateSym = [];

  if (blockOverdue.length > 0) {
      copyText += '■■ 最終価格から規定日数超過の商品 ■■\n';
      copyText += '（※販売戦略の再検討・再出品等のご判断をお願いします）\n';
      blockOverdue.forEach(function(d) {
          var n = getNum();
          copyText += n.num + ' 管理番号: ' + d.code + '\n' + d.title + '\n' + '現在の記号: □（最終価格）' + '\n' + '放置日数: ' + d.passedDays + '日\n' + '現在の価格: ' + (d.price||0).toLocaleString() + '円\n' + d.url + '\n\n';
          replyTemplateOverdue.push(n.num + ' ⇒ ');
      });
  }

  if (blockHighPrice.length > 0) {
      copyText += '■■ 【許可願い】高額商品の記号変更 ■■\n';
      copyText += '（※高額商品のため、オーナーの許可をいただいてから変更します）\n';
      blockHighPrice.forEach(function(d) {
          var n = getNum();
          copyText += n.num + ' 管理番号: ' + d.code + '\n記号を ' + d.nextSym + ' に変更（' + (d.oldPrice||0).toLocaleString() + '円 ⇒ ' + (d.newPrice||0).toLocaleString() + '円）\n' + d.title + '\n' + d.url + '\n\n';
          replyTemplateSym.push(n.num + ' ⇒ ');
      });
  }

  if (blockMaru.length > 0) {
      copyText += '■■ 【許可願い】▲ ⇒ 〇 への記号変更 ■■\n';
      copyText += '（※オーナーの許可をいただいてから変更します）\n';
      blockMaru.forEach(function(d) {
          var n = getNum();
          copyText += n.num + ' 管理番号: ' + d.code + '\n記号を ' + d.nextSym + ' に変更（' + (d.oldPrice||0).toLocaleString() + '円 ⇒ ' + (d.newPrice||0).toLocaleString() + '円）\n' + d.title + '\n' + d.url + '\n\n';
          replyTemplateSym.push(n.num + ' ⇒ ');
      });
  }

  if (blockHighSale.length > 0) {
      copyText += '■■ 【許可願い】高額商品のセール・記号変更 ■■\n';
      copyText += '（※実行前にオーナーの許可が必要です）\n';
      blockHighSale.forEach(function(d) {
          var n = getNum();
          copyText += n.num + ' 管理番号: ' + d.code + '\nセール実施＋記号を ' + d.nextSym + ' に変更予定（' + (d.oldPrice||0).toLocaleString() + '円 ⇒ ' + (d.newPrice||0).toLocaleString() + '円）\n' + d.title + '\n' + d.url + '\n\n';
          replyTemplateSym.push(n.num + ' ⇒ ');
      });
  }

  if (blockShikaku.length > 0) {
      copyText += '■■ 【許可願い】〇 ⇒ □ への記号変更 ■■\n';
      copyText += '（※オーナーの許可をいただいてから変更します）\n';
      blockShikaku.forEach(function(d) {
          var n = getNum();
          copyText += n.num + ' 管理番号: ' + d.code + '\n記号を ' + d.nextSym + ' に変更（' + (d.oldPrice||0).toLocaleString() + '円 ⇒ ' + (d.newPrice||0).toLocaleString() + '円）\n' + d.title + '\n' + d.url + '\n\n';
          replyTemplateSym.push(n.num + ' ⇒ ');
      });
  }

  // -------------------------
  // オーナー返信用テンプレートの生成
  // -------------------------
  copyText += '---------------------------------\n';
  copyText += '【オーナー返信用テンプレート】\n\n';
  
  if (replyTemplateOverdue.length > 0) {
      copyText += '■ 至急報告（デッドストック）への指示\n';
      replyTemplateOverdue.forEach(function(line) { copyText += line + '\n'; });
      copyText += '\n';
  }
  
  if (replyTemplateSym.length > 0) {
      copyText += '■ 記号変更への追加指示（※あれば）\n';
      replyTemplateSym.forEach(function(line) { copyText += line + '\n'; });
      copyText += '\n';
  }

  navigator.clipboard.writeText(copyText).then(function() {
    alert('報告用テキストをコピーしました！');
  }).catch(function() {
    alert('コピーに失敗しました。');
  });
}

function smExecMercariComment(code, price) {
  var nextPrice = price - (typeof CONFIG !== 'undefined' ? CONFIG.SALE_DISC_AMT : 500);
  if (nextPrice < 0) nextPrice = 0;
  var comment = "本日限定！" + nextPrice.toLocaleString() + "円にお値下げいたします！\n購入希望の方は「購入希望」とコメントをお願いします！";
  navigator.clipboard.writeText(comment).then(function() {
    alert('【コピー完了】\n' + comment + '\n\n商品ページを開きます！');
    window.open('https://jp.mercari.com/search?keyword=' + encodeURIComponent(code), '_blank');
  });
}
