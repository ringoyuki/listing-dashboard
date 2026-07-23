// ===== 売れていない商品の相場検索 =====
// 既存の取り込み済みデータから、出品してX日更新なしの商品を抽出

(function () {
  'use strict';

  var _results = [];

  // ---- 日付パース ----
  function parseDate(str) {
    if (!str) return null;
    // 「2026/07/21 11:57:20」→ Date
    var s = str.trim().replace(/\//g, '-').substring(0, 10);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }

  // ---- 経過日数（今日からさかのぼり） ----
  function daysSince(date) {
    if (!date) return null;
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  // ---- 検索メイン ----
  function searchStaleItems(thresholdDays) {
    // window.items は app.js のグローバル変数
    var allItems = window.items || [];
    var results = [], scanned = 0, noDate = 0;

    for (var i = 0; i < allItems.length; i++) {
      var item = allItems[i];
      scanned++;

      // 在庫ゼロは除外（ただし stock が未設定なら含める）
      var stockVal = item.stock;
      if (stockVal !== undefined && stockVal !== null && stockVal !== '') {
        if ((parseInt(stockVal) || 0) <= 0) continue;
      }

      // 日付の取得（優先: shopsUpdatedAt → createdAt）
      var baseDate = parseDate(item.shopsUpdatedAt) || null;
      var usedFallback = false;
      if (!baseDate && item.createdAt) {
        baseDate = new Date(parseInt(item.createdAt));
        if (isNaN(baseDate)) baseDate = null;
        usedFallback = true;
      }

      if (!baseDate) { noDate++; continue; }

      var days = daysSince(baseDate);
      if (days === null || days < thresholdDays) continue;

      results.push({
        code:     (item.code || '').trim(),
        title:    (item.title || '').trim(),
        price:    parseInt(item.price) || 0,
        updDate:  item.shopsUpdatedAt
                    ? item.shopsUpdatedAt.substring(0, 10).replace(/-/g, '/')
                    : (baseDate ? baseDate.toISOString().substring(0, 10).replace(/-/g, '/') : ''),
        days:     days,
        fallback: usedFallback
      });
    }

    // 放置日数の多い順
    results.sort(function (a, b) { return b.days - a.days; });
    return { results: results, scanned: scanned, noDate: noDate };
  }

  // ---- テーブル描画 ----
  function renderTable(results) {
    var wrap = document.getElementById('market-table-wrap');
    if (!wrap) return;

    if (!results.length) {
      wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;font-size:0.9rem;">該当する商品がありませんでした</div>';
      return;
    }

    var html = '<table style="width:100%;border-collapse:collapse;font-size:0.83rem;">'
      + '<thead><tr style="background:rgba(255,255,255,0.07);position:sticky;top:0;z-index:1;">'
      + th('管理番号') + th('商品名') + th('現在価格', 'right') + th('最終更新日', 'center') + th('更新なし日数', 'center')
      + '</tr></thead><tbody>';

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var dc = r.days >= 300 ? '#f87171' : r.days >= 200 ? '#fb923c' : '#fbbf24';
      var bg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      var fallNote = r.fallback
        ? ' <span title="Shops最終更新日未取得（次回CSV更新後に正確になります）" style="color:#475569;font-size:0.72rem;">※推定</span>'
        : '';

      html += '<tr style="background:' + bg + ';border-bottom:1px solid rgba(255,255,255,0.04);">'
        + td('<span style="color:#a78bfa;font-family:monospace;">' + esc(r.code) + '</span>')
        + td('<span title="' + esc(r.title) + '" style="color:#e2e8f0;">' + esc(r.title.length > 55 ? r.title.substring(0,55)+'…' : r.title) + '</span>', '', 'max-width:380px;')
        + td('<span style="font-weight:600;">¥' + r.price.toLocaleString() + '</span>', 'right')
        + td('<span style="color:#94a3b8;">' + (r.updDate || '-') + '</span>' + fallNote, 'center')
        + td('<span style="font-weight:700;font-size:1.05rem;color:' + dc + ';">' + r.days + '</span><span style="color:#64748b;font-size:0.78rem;"> 日</span>', 'center')
        + '</tr>';
    }

    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function th(label, align) {
    return '<th style="padding:9px 12px;text-align:' + (align||'left') + ';border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;color:#94a3b8;">' + label + '</th>';
  }
  function td(content, align, extra) {
    return '<td style="padding:8px 12px;text-align:' + (align||'left') + ';white-space:' + (align === 'center' ? 'nowrap' : 'normal') + ';' + (extra||'') + '">' + content + '</td>';
  }

  // ---- TSVコピー（Googleスプレッドシート用） ----
  window.copyMarketTsv = function () {
    if (!_results.length) return;
    var lines = [['管理番号', '商品名', '現在価格', '最終更新日', '更新なし日数'].join('\t')];
    _results.forEach(function (r) {
      lines.push([r.code, r.title, r.price, r.updDate, r.days].join('\t'));
    });
    var tsv = lines.join('\n');

    var btn = document.getElementById('market-copy-btn');
    function done(ok) {
      if (!btn) return;
      btn.textContent = ok ? '✅ コピーしました！' : '⚠️ コピーに失敗しました';
      setTimeout(function () { btn.textContent = '📋 スプレッドシートにコピー'; }, 2500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv).then(function () { done(true); }).catch(function () {
        fallbackCopy(tsv); done(true);
      });
    } else {
      fallbackCopy(tsv); done(true);
    }
  };

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ---- 検索実行 ----
  function runSearch() {
    var daysEl   = document.getElementById('market-days');
    var summary  = document.getElementById('market-summary');
    var copyBtn  = document.getElementById('market-copy-btn');
    var wrap     = document.getElementById('market-table-wrap');

    if (!summary || !wrap) return; // 要素がまだ無い場合は無視

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

      if (!_results.length) {
        summary.innerHTML =
          '<span style="color:#64748b;">' + res.scanned + '件スキャン → ' + threshold + '日以上更新なし：0件</span>'
          + (res.noDate > 0 ? '<span style="color:#475569;font-size:0.78rem;margin-left:6px;">（日付不明 ' + res.noDate + '件 除外）</span>' : '');
        if (copyBtn) copyBtn.style.display = 'none';
        wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;">条件に一致する商品がありませんでした<br><small>日数を少なくして試してみてください</small></div>';
        return;
      }

      summary.innerHTML =
        '<span style="color:#fbbf24;font-weight:600;">' + _results.length + '件</span>'
        + '<span style="color:#64748b;"> / ' + res.scanned + '件中　' + threshold + '日以上更新なし</span>'
        + (res.noDate > 0 ? '<span style="color:#475569;font-size:0.78rem;margin-left:6px;">（日付不明 ' + res.noDate + '件 除外）</span>' : '');

      if (copyBtn) copyBtn.style.display = '';
      renderTable(_results);

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

  // Enterキーで検索
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('market-days');
    if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });
  });

})();
