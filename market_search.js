// ===== 売れていない商品の相場検索 =====
// 既存データから出品してX日更新なしの商品を抽出・表示

(function () {
  'use strict';

  var SHOP_ID  = 'qWn7JdhbsaotJpySx9NmFF';  // ShopsのショップID
  var _results  = [];
  var _page     = 0;
  var _pageSize = 20;
  var _sortKey  = 'days';
  var _sortAsc  = false;

  // ---- Shops URL生成（app.jsと同じロジック） ----
  function shopsSearchUrl(code) {
    return 'https://mercari-shops.com/seller/shops/' + SHOP_ID + '/products?keyword=' + encodeURIComponent(code);
  }
  function shopsAdminUrl(itemId) {
    return 'https://mercari-shops.com/seller/shops/' + SHOP_ID + '/products/' + itemId;
  }
  function shopsPubUrl(itemId) {
    return 'https://jp.mercari.com/shops/product/' + itemId;
  }
  function extractItemId(url) {
    if (!url) return '';
    var m = url.match(/\/product(?:s)?\/([a-zA-Z0-9]+)$/);
    return m ? m[1] : '';
  }

  // ---- 日付パース ----
  function parseDate(str) {
    if (!str) return null;
    var s = str.trim().replace(/\//g, '-').substring(0, 10);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function daysSince(date) {
    if (!date) return null;
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  // ---- 検索メイン ----
  function searchStaleItems(thresholdDays) {
    var allItems = window.items || [];
    var results = [], scanned = 0, noDate = 0;

    for (var i = 0; i < allItems.length; i++) {
      var item = allItems[i];
      scanned++;

      // CSV更新済み（shopsUpdatedAtあり）の商品で在庫0 → 売り切れとして除外
      if (item.shopsUpdatedAt) {
        var sv = parseInt(item.stock) || 0;
        if (sv <= 0) continue;
      }

      // 出品日 (shopsRegDate = 商品登録日時)
      var regDate  = parseDate(item.shopsRegDate) || null;

      // 最終更新日（優先: shopsUpdatedAt → shopsRegDate → createdAt）
      var updDate  = parseDate(item.shopsUpdatedAt) || null;
      var baseDate = updDate || regDate || null;
      var usedFallback = !updDate; // shopsUpdatedAtがなければ推定
      if (!baseDate && item.createdAt) {
        var ts = parseInt(item.createdAt);
        if (!isNaN(ts)) { baseDate = new Date(ts); }
      }
      if (!baseDate) { noDate++; continue; }

      var days = daysSince(baseDate);
      if (days === null || days < thresholdDays) continue;

      // ShopsURL
      var shopsUrl = (item.urls && item.urls['mercari_shops']) || '';
      var itemId   = extractItemId(shopsUrl);

      results.push({
        code:     (item.code  || '').trim(),
        title:    (item.title || '').trim(),
        price:    parseInt(item.price) || 0,
        regDate:  regDate  ? regDate.toISOString().substring(0,10).replace(/-/g,'/') : '',
        updDate:  baseDate ? baseDate.toISOString().substring(0,10).replace(/-/g,'/') : '',
        days:     days,
        fallback: usedFallback,
        itemId:   itemId,
        code4search: (item.code || '').trim()
      });
    }

    return { results: results, scanned: scanned, noDate: noDate };
  }

  // ---- ソート ----
  function sortResults() {
    _results.sort(function (a, b) {
      var va = a[_sortKey], vb = b[_sortKey];
      if (typeof va === 'string') {
        va = va.toLowerCase(); vb = vb.toLowerCase();
        return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return _sortAsc ? va - vb : vb - va;
    });
  }

  // ---- ページ描画 ----
  function renderPage() {
    var wrap = document.getElementById('market-table-wrap');
    if (!wrap) return;

    var total      = _results.length;
    var totalPages = Math.ceil(total / _pageSize);
    if (_page >= totalPages && totalPages > 0) _page = totalPages - 1;

    var start = _page * _pageSize;
    var end   = Math.min(start + _pageSize, total);
    var page  = _results.slice(start, end);

    function sortIcon(key) {
      if (_sortKey !== key) return '<span style="color:#334155;margin-left:3px;font-size:0.75rem;">⇅</span>';
      return _sortAsc
        ? '<span style="color:#fbbf24;margin-left:3px;">↑</span>'
        : '<span style="color:#fbbf24;margin-left:3px;">↓</span>';
    }
    function thSort(label, key, align) {
      return '<th onclick="marketSort(\''+key+'\')" style="padding:9px 10px;text-align:'+(align||'left')+';border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;color:#94a3b8;cursor:pointer;user-select:none;">'
        + label + sortIcon(key) + '</th>';
    }
    function thStatic(label, align) {
      return '<th style="padding:9px 10px;text-align:'+(align||'left')+';border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;color:#94a3b8;">'+label+'</th>';
    }

    var html = '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">'
      + '<thead><tr style="background:rgba(255,255,255,0.07);position:sticky;top:0;z-index:1;">'
      + thSort('管理番号', 'code')
      + thStatic('商品名')
      + thSort('現在価格', 'price', 'right')
      + thStatic('出品日', 'center')
      + thStatic('最終更新日', 'center')
      + thSort('更新なし', 'days', 'center')
      + thStatic('Shops', 'center')
      + '</tr></thead><tbody>';

    for (var i = 0; i < page.length; i++) {
      var r    = page[i];
      var dc   = r.days >= 300 ? '#f87171' : r.days >= 200 ? '#fb923c' : r.days >= 100 ? '#fbbf24' : '#94a3b8';
      var bg   = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      var fnt  = r.fallback ? '<span title="次回CSV更新後に正確になります" style="color:#334155;font-size:0.7rem;">※</span>' : '';

      // Shops URL
      var hasId    = !!r.itemId;
      var adminUrl = hasId ? shopsAdminUrl(r.itemId) : '';
      var pubUrl   = hasId ? shopsPubUrl(r.itemId)   : '';
      // 検索URL: 管理番号が「CHECK」の場合はタイトルで検索
      var searchKw = (r.code && r.code !== 'CHECK') ? r.code : r.title.substring(0, 25);
      var srchUrl  = shopsSearchUrl(searchKw);

      // ボタン HTML
      var btns = '<a href="' + esc(srchUrl) + '" target="_blank" title="Shops内で検索" '
        + 'style="display:inline-block;background:rgba(239,68,68,0.25);border:1px solid rgba(239,68,68,0.5);color:#fca5a5;border-radius:4px;padding:2px 7px;font-size:0.73rem;text-decoration:none;white-space:nowrap;margin-right:2px;">検索</a>';
      if (hasId) {
        btns += '<a href="' + esc(adminUrl) + '" target="_blank" title="Shops管理画面" '
          + 'style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#cbd5e1;border-radius:4px;padding:2px 7px;font-size:0.73rem;text-decoration:none;white-space:nowrap;margin-right:2px;">管理</a>';
        btns += '<a href="' + esc(pubUrl) + '" target="_blank" title="公開商品ページ" '
          + 'style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#cbd5e1;border-radius:4px;padding:2px 7px;font-size:0.73rem;text-decoration:none;white-space:nowrap;">商品</a>';
      }

      // 管理番号（クリック → 管理画面 or 検索）
      var codeHtml = hasId
        ? '<a href="' + esc(adminUrl) + '" target="_blank" style="color:#a78bfa;font-family:monospace;white-space:nowrap;text-decoration:none;" title="管理画面を開く">' + esc(r.code) + '</a>'
        : '<span style="color:#6b7280;font-family:monospace;white-space:nowrap;">' + esc(r.code) + '</span>';

      // 商品名（クリック → 商品ページ）
      var shortTitle = r.title.length > 42 ? r.title.substring(0, 42) + '…' : r.title;
      var titleHtml = hasId
        ? '<a href="' + esc(pubUrl) + '" target="_blank" style="color:#e2e8f0;text-decoration:none;" title="' + esc(r.title) + '">' + esc(shortTitle) + '</a>'
        : '<span title="' + esc(r.title) + '" style="color:#e2e8f0;">' + esc(shortTitle) + '</span>';

      html += '<tr style="background:'+bg+';border-bottom:1px solid rgba(255,255,255,0.04);">'
        + '<td style="padding:7px 10px;">'+codeHtml+'</td>'
        + '<td style="padding:7px 10px;max-width:300px;">'+titleHtml+'</td>'
        + '<td style="padding:7px 10px;text-align:right;white-space:nowrap;"><span style="font-weight:600;color:#f1f5f9;">¥'+r.price.toLocaleString()+'</span></td>'
        + '<td style="padding:7px 10px;text-align:center;white-space:nowrap;"><span style="color:#64748b;font-size:0.8rem;">'+(r.regDate||'-')+'</span></td>'
        + '<td style="padding:7px 10px;text-align:center;white-space:nowrap;"><span style="color:#94a3b8;font-size:0.8rem;">'+(r.updDate||'-')+'</span>'+fnt+'</td>'
        + '<td style="padding:7px 10px;text-align:center;white-space:nowrap;">'
        +   '<span style="font-weight:700;font-size:1.0rem;color:'+dc+';">'+r.days+'</span>'
        +   '<span style="color:#475569;font-size:0.75rem;"> 日</span></td>'
        + '<td style="padding:7px 10px;text-align:center;white-space:nowrap;">'+btns+'</td>'
        + '</tr>';
    }
    html += '</tbody></table>';

    // ---- ページネーション ----
    var pg = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 2px;flex-shrink:0;margin-top:6px;">';
    pg += '<button onclick="marketPage(' + (_page-1) + ')" ' + (_page<=0?'disabled ':'')
      + 'style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:' + (_page<=0?'#334155':'#f1f5f9') + ';border-radius:8px;padding:5px 14px;cursor:' + (_page<=0?'default':'pointer') + ';font-size:0.82rem;">← 前へ</button>';

    pg += '<div style="display:flex;align-items:center;gap:4px;">';
    var sf = Math.max(0, _page-3), st = Math.min(totalPages-1, _page+3);
    if (sf>0) pg += '<span style="color:#334155;">…</span>';
    for (var p=sf; p<=st; p++) {
      var act = p === _page;
      pg += '<button onclick="marketPage('+p+')" style="background:' + (act?'rgba(167,139,250,0.25)':'rgba(255,255,255,0.06)') + ';'
        + 'border:1px solid ' + (act?'rgba(167,139,250,0.6)':'rgba(255,255,255,0.1)') + ';'
        + 'color:' + (act?'#c4b5fd':'#94a3b8') + ';'
        + 'border-radius:6px;width:32px;padding:4px 0;cursor:pointer;font-size:0.8rem;font-weight:' + (act?'700':'400') + ';">'
        + (p+1) + '</button>';
    }
    if (st<totalPages-1) pg += '<span style="color:#334155;">…</span>';
    pg += '</div>';

    pg += '<button onclick="marketPage(' + (_page+1) + ')" ' + (_page>=totalPages-1?'disabled ':'')
      + 'style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:' + (_page>=totalPages-1?'#334155':'#f1f5f9') + ';border-radius:8px;padding:5px 14px;cursor:' + (_page>=totalPages-1?'default':'pointer') + ';font-size:0.82rem;">次へ →</button>';
    pg += '</div>';

    wrap.innerHTML = html + pg;
  }

  // ---- TSVコピー ----
  window.copyMarketTsv = function () {
    if (!_results.length) return;
    var lines = [['管理番号','商品名','現在価格','最終更新日','更新なし日数','管理画面URL','商品ページURL'].join('\t')];
    _results.forEach(function (r) {
      lines.push([
        r.code, r.title, r.price, r.updDate, r.days,
        r.itemId ? shopsAdminUrl(r.itemId) : '',
        r.itemId ? shopsPubUrl(r.itemId)   : ''
      ].join('\t'));
    });
    var btn = document.getElementById('market-copy-btn');
    function done() {
      if (!btn) return;
      btn.textContent = '✅ コピーしました！';
      setTimeout(function () { btn.textContent = '📋 スプレッドシートにコピー'; }, 2500);
    }
    var tsv = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv).then(done).catch(function () { fbCopy(tsv); done(); });
    } else { fbCopy(tsv); done(); }
  };
  function fbCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t; ta.style.cssText='position:fixed;top:0;opacity:0;';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e){}
    document.body.removeChild(ta);
  }

  window.marketPage = function (p) {
    var tp = Math.ceil(_results.length / _pageSize);
    if (p < 0 || p >= tp) return;
    _page = p;
    renderPage();
    var wrap = document.getElementById('market-table-wrap');
    if (wrap) wrap.scrollTop = 0;
  };

  window.marketSort = function (key) {
    if (_sortKey === key) { _sortAsc = !_sortAsc; }
    else { _sortKey = key; _sortAsc = (key==='code'); }
    _page = 0; sortResults(); renderPage();
  };

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ---- 検索実行 ----
  function runSearch() {
    var daysEl  = document.getElementById('market-days');
    var summary = document.getElementById('market-summary');
    var copyBtn = document.getElementById('market-copy-btn');
    var wrap    = document.getElementById('market-table-wrap');
    if (!summary || !wrap) return;

    var threshold = parseInt(daysEl ? daysEl.value : 0) || 0;
    summary.innerHTML = '<span style="color:#a78bfa">🔍 検索中...</span>';

    var allItems = window.items || [];
    if (!allItems.length) {
      summary.innerHTML = '<span style="color:#f87171">⚠️ データなし — 先に「📥 CSV更新」で商品データを取り込んでください</span>';
      wrap.innerHTML = '';
      if (copyBtn) copyBtn.style.display = 'none';
      return;
    }

    try {
      var res = searchStaleItems(threshold);
      _results = res.results;
      _page    = 0; _sortKey = 'days'; _sortAsc = false;
      sortResults();

      if (!_results.length) {
        summary.innerHTML = '<span style="color:#64748b;">' + res.scanned + '件スキャン → 該当なし</span>'
          + (res.noDate>0 ? '<span style="color:#475569;font-size:0.78rem;margin-left:6px;">（日付不明 '+res.noDate+'件 除外）</span>' : '');
        if (copyBtn) copyBtn.style.display = 'none';
        wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;">条件に一致する商品がありませんでした</div>';
        return;
      }

      var tp = Math.ceil(_results.length / _pageSize);
      summary.innerHTML =
        '<span style="color:#fbbf24;font-weight:600;">' + _results.length + '件</span>'
        + '<span style="color:#64748b;"> / ' + res.scanned + '件中</span>'
        + '<span style="color:#475569;font-size:0.78rem;margin-left:6px;">（' + tp + 'ページ・20件ずつ）</span>'
        + (res.noDate>0 ? '<span style="color:#475569;font-size:0.78rem;margin-left:6px;">（日付不明 '+res.noDate+'件 除外）</span>' : '');

      if (copyBtn) copyBtn.style.display = '';
      renderPage();
    } catch(err) {
      summary.innerHTML = '<span style="color:#f87171">❌ エラー: ' + esc(err.message) + '</span>';
    }
  }

  // ---- グローバル公開 ----
  window.runMarketSearch = runSearch;

  window.openMarketModal = function () {
    var modal = document.getElementById('market-modal');
    if (modal) modal.classList.add('open');
    runSearch();
  };
  window.closeMarketModal = function () {
    var modal = document.getElementById('market-modal');
    if (modal) modal.classList.remove('open');
  };

  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('market-days');
    if (el) el.addEventListener('keydown', function (e) { if (e.key==='Enter') runSearch(); });
  });

})();
