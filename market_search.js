// ===== 売れていない商品の相場検索 =====
// 既存データから出品してX日更新なしの商品を抽出・表示

(function () {
  'use strict';

  var _results  = [];   // 全検索結果
  var _page     = 0;    // 現在ページ（0始まり）
  var _pageSize = 20;   // 1ページあたり件数
  var _sortKey  = 'days';  // ソートキー: 'days' | 'price' | 'code'
  var _sortAsc  = false;   // false=降順（多い順）

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

      // stock が明示的に 0 以下のものは除外（未設定は含める）
      var sv = item.stock;
      if (sv !== undefined && sv !== null && sv !== '') {
        if ((parseInt(sv) || 0) <= 0) continue;
      }

      // 日付（shopsUpdatedAt → createdAt）
      var baseDate = parseDate(item.shopsUpdatedAt) || null;
      var usedFallback = false;
      if (!baseDate && item.createdAt) {
        var ts = parseInt(item.createdAt);
        if (!isNaN(ts)) { baseDate = new Date(ts); usedFallback = true; }
      }
      if (!baseDate) { noDate++; continue; }

      var days = daysSince(baseDate);
      if (days === null || days < thresholdDays) continue;

      results.push({
        code:     (item.code  || '').trim(),
        title:    (item.title || '').trim(),
        price:    parseInt(item.price) || 0,
        updDate:  item.shopsUpdatedAt
                    ? item.shopsUpdatedAt.substring(0, 10).replace(/-/g, '/')
                    : (baseDate ? baseDate.toISOString().substring(0, 10).replace(/-/g, '/') : ''),
        days:     days,
        fallback: usedFallback
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

    var total     = _results.length;
    var totalPages = Math.ceil(total / _pageSize);
    if (_page >= totalPages) _page = Math.max(0, totalPages - 1);

    var start = _page * _pageSize;
    var end   = Math.min(start + _pageSize, total);
    var page  = _results.slice(start, end);

    // ---- ソートアイコン ----
    function sortIcon(key) {
      if (_sortKey !== key) return '<span style="color:#334155;margin-left:3px;">⇅</span>';
      return _sortAsc
        ? '<span style="color:#fbbf24;margin-left:3px;">↑</span>'
        : '<span style="color:#fbbf24;margin-left:3px;">↓</span>';
    }
    function thSort(label, key, align) {
      return '<th onclick="marketSort(\'' + key + '\')" style="padding:9px 12px;text-align:'+(align||'left')+';border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;color:#94a3b8;cursor:pointer;user-select:none;" title="クリックで並び替え">'
        + label + sortIcon(key) + '</th>';
    }

    var html = '<table style="width:100%;border-collapse:collapse;font-size:0.83rem;">'
      + '<thead><tr style="background:rgba(255,255,255,0.07);position:sticky;top:0;z-index:1;">'
      + thSort('管理番号', 'code')
      + '<th style="padding:9px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);color:#94a3b8;">商品名</th>'
      + thSort('現在価格', 'price', 'right')
      + '<th style="padding:9px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;color:#94a3b8;">最終更新日</th>'
      + thSort('更新なし日数', 'days', 'center')
      + '</tr></thead><tbody>';

    for (var i = 0; i < page.length; i++) {
      var r   = page[i];
      var dc  = r.days >= 300 ? '#f87171' : r.days >= 200 ? '#fb923c' : '#fbbf24';
      var bg  = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      var fnt = r.fallback ? ' <span title="次回CSV更新後に正確になります" style="color:#475569;font-size:0.72rem;">※推定</span>' : '';

      html += '<tr style="background:' + bg + ';border-bottom:1px solid rgba(255,255,255,0.04);">'
        + '<td style="padding:8px 12px;"><span style="color:#a78bfa;font-family:monospace;white-space:nowrap;">' + esc(r.code) + '</span></td>'
        + '<td style="padding:8px 12px;max-width:380px;"><span title="' + esc(r.title) + '" style="color:#e2e8f0;">'
        +   esc(r.title.length > 55 ? r.title.substring(0,55)+'…' : r.title) + '</span></td>'
        + '<td style="padding:8px 12px;text-align:right;white-space:nowrap;"><span style="font-weight:600;color:#f1f5f9;">¥' + r.price.toLocaleString() + '</span></td>'
        + '<td style="padding:8px 12px;text-align:center;white-space:nowrap;"><span style="color:#94a3b8;">' + (r.updDate||'-') + '</span>' + fnt + '</td>'
        + '<td style="padding:8px 12px;text-align:center;white-space:nowrap;">'
        +   '<span style="font-weight:700;font-size:1.05rem;color:' + dc + ';">' + r.days + '</span>'
        +   '<span style="color:#64748b;font-size:0.78rem;"> 日</span></td>'
        + '</tr>';
    }
    html += '</tbody></table>';

    // ---- ページネーション ----
    var pgHtml = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 4px;flex-shrink:0;margin-top:8px;">'
      + '<button onclick="marketPage(' + (_page - 1) + ')" '
      + (_page <= 0 ? 'disabled ' : '')
      + 'style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:' + (_page<=0?'#334155':'#f1f5f9') + ';border-radius:8px;padding:6px 16px;cursor:' + (_page<=0?'default':'pointer') + ';font-size:0.85rem;">← 前へ</button>'

      + '<div style="display:flex;align-items:center;gap:6px;">';

    // ページ番号ボタン（最大7個表示）
    var showFrom = Math.max(0, _page - 3);
    var showTo   = Math.min(totalPages - 1, _page + 3);
    if (showFrom > 0) pgHtml += '<span style="color:#475569;padding:0 4px;">…</span>';
    for (var p = showFrom; p <= showTo; p++) {
      var active = p === _page;
      pgHtml += '<button onclick="marketPage(' + p + ')" style="'
        + 'background:' + (active ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.06)') + ';'
        + 'border:1px solid ' + (active ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.12)') + ';'
        + 'color:' + (active ? '#c4b5fd' : '#94a3b8') + ';'
        + 'border-radius:6px;width:34px;padding:5px 0;cursor:pointer;font-size:0.82rem;font-weight:' + (active?'700':'400') + ';">'
        + (p + 1) + '</button>';
    }
    if (showTo < totalPages - 1) pgHtml += '<span style="color:#475569;padding:0 4px;">…</span>';

    pgHtml += '</div>'
      + '<button onclick="marketPage(' + (_page + 1) + ')" '
      + (_page >= totalPages - 1 ? 'disabled ' : '')
      + 'style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:' + (_page>=totalPages-1?'#334155':'#f1f5f9') + ';border-radius:8px;padding:6px 16px;cursor:' + (_page>=totalPages-1?'default':'pointer') + ';font-size:0.85rem;">次へ →</button>'
      + '</div>';

    wrap.innerHTML = html + pgHtml;
  }

  // ---- TSVコピー ----
  window.copyMarketTsv = function () {
    if (!_results.length) return;
    var lines = [['管理番号','商品名','現在価格','最終更新日','更新なし日数'].join('\t')];
    _results.forEach(function (r) {
      lines.push([r.code, r.title, r.price, r.updDate, r.days].join('\t'));
    });
    var tsv = lines.join('\n');
    var btn = document.getElementById('market-copy-btn');

    function done(ok) {
      if (!btn) return;
      btn.textContent = ok ? '✅ コピーしました！' : '⚠️ 失敗';
      setTimeout(function () { btn.textContent = '📋 スプレッドシートにコピー'; }, 2500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv).then(function () { done(true); }).catch(function () { fbCopy(tsv); done(true); });
    } else { fbCopy(tsv); done(true); }
  };

  function fbCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;top:0;opacity:0;';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  }

  // ---- ページ移動 ----
  window.marketPage = function (p) {
    var totalPages = Math.ceil(_results.length / _pageSize);
    if (p < 0 || p >= totalPages) return;
    _page = p;
    renderPage();
    // テーブルトップへスクロール
    var wrap = document.getElementById('market-table-wrap');
    if (wrap) wrap.scrollTop = 0;
  };

  // ---- ソート切り替え ----
  window.marketSort = function (key) {
    if (_sortKey === key) {
      _sortAsc = !_sortAsc;
    } else {
      _sortKey = key;
      _sortAsc = (key === 'code'); // 管理番号はデフォルト昇順、他は降順
    }
    _page = 0;
    sortResults();
    renderPage();
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

    var threshold = parseInt(daysEl ? daysEl.value : 100) || 100;
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
      _page    = 0;
      _sortKey = 'days';
      _sortAsc = false; // 更新なし多い順（デフォルト）
      sortResults();

      if (!_results.length) {
        summary.innerHTML =
          '<span style="color:#64748b;">' + res.scanned + '件スキャン → ' + threshold + '日以上更新なし：0件</span>'
          + (res.noDate > 0 ? '<span style="color:#475569;font-size:0.78rem;margin-left:6px;">（日付不明 ' + res.noDate + '件 除外）</span>' : '');
        if (copyBtn) copyBtn.style.display = 'none';
        wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;">条件に一致する商品がありませんでした<br><small style="color:#475569;">日数を小さくして再検索してみてください</small></div>';
        return;
      }

      var totalPages = Math.ceil(_results.length / _pageSize);
      summary.innerHTML =
        '<span style="color:#fbbf24;font-weight:600;">' + _results.length + '件</span>'
        + '<span style="color:#64748b;"> / ' + res.scanned + '件中　' + threshold + '日以上更新なし</span>'
        + '<span style="color:#475569;font-size:0.78rem;margin-left:6px;">（' + totalPages + 'ページ / ' + _pageSize + '件ずつ）</span>'
        + (res.noDate > 0 ? '<span style="color:#475569;font-size:0.78rem;margin-left:6px;">（日付不明 ' + res.noDate + '件 除外）</span>' : '');

      if (copyBtn) copyBtn.style.display = '';
      renderPage();

    } catch (err) {
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
    if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });
  });

})();
