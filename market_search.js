// ===== 売れていない商品の相場検索 =====
// 既存の取り込み済みデータを使い、出品からX日更新なしの商品を抽出

(function () {
  'use strict';

  var _results = []; // 現在の検索結果

  // ---- 日付パース（「2026/07/21 11:57:20」→ Date） ----
  function parseDate(str) {
    if (!str) return null;
    var s = str.trim().replace(/\//g, '-').substring(0, 10);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }

  // ---- 経過日数 ----
  function daysSince(date) {
    if (!date) return null;
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  // ---- 取り込み済みデータから検索 ----
  function searchStaleItems(thresholdDays) {
    // window.items が app.js で定義されているグローバル変数
    var allItems = window.items || [];
    if (!allItems.length) return { results: [], total: 0, noDate: 0 };

    var results = [], noDate = 0;

    for (var i = 0; i < allItems.length; i++) {
      var item = allItems[i];

      // 在庫ありのもののみ
      if ((parseInt(item.stock) || 0) <= 0) continue;

      // 最終更新日 (shopsUpdatedAt → なければ取り込み日 createdAt で代用)
      var baseDate = parseDate(item.shopsUpdatedAt);
      var usedFallback = false;
      if (!baseDate && item.createdAt) {
        baseDate = new Date(item.createdAt);
        usedFallback = true;
      }

      if (!baseDate) { noDate++; continue; }

      var days = daysSince(baseDate);
      if (days < thresholdDays) continue;

      results.push({
        code:     item.code || '',
        title:    item.title || '',
        price:    parseInt(item.price) || 0,
        updDate:  item.shopsUpdatedAt ? item.shopsUpdatedAt.substring(0, 10).replace(/-/g, '/') : '',
        days:     days,
        fallback: usedFallback
      });
    }

    // 放置日数の多い順（古い順）
    results.sort(function (a, b) { return b.days - a.days; });
    return { results: results, total: allItems.length, noDate: noDate };
  }

  // ---- テーブル描画 ----
  function renderTable(results) {
    var wrap = document.getElementById('market-table-wrap');
    if (!wrap) return;

    if (!results.length) {
      wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;font-size:0.9rem;">該当する商品がありませんでした</div>';
      return;
    }

    var html = '<table id="market-result-table" style="width:100%;border-collapse:collapse;font-size:0.83rem;">'
      + '<thead><tr style="background:rgba(255,255,255,0.07);position:sticky;top:0;z-index:1;">'
      + '<th style="padding:9px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;color:#94a3b8;">管理番号</th>'
      + '<th style="padding:9px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);color:#94a3b8;">商品名</th>'
      + '<th style="padding:9px 12px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;color:#94a3b8;">現在価格</th>'
      + '<th style="padding:9px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;color:#94a3b8;">最終更新日</th>'
      + '<th style="padding:9px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;color:#94a3b8;">出品から更新なし</th>'
      + '</tr></thead><tbody>';

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var dayColor = r.days >= 300 ? '#f87171' : r.days >= 200 ? '#fb923c' : '#fbbf24';
      var rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      var fallbackNote = r.fallback ? '<span title="Shops最終更新日未取得（次回CSV更新後に正確になります）" style="color:#64748b;font-size:0.7rem;">※推定</span>' : '';

      html += '<tr style="background:' + rowBg + ';border-bottom:1px solid rgba(255,255,255,0.04);">'
        + '<td style="padding:8px 12px;color:#a78bfa;font-family:monospace;white-space:nowrap;">' + esc(r.code) + '</td>'
        + '<td style="padding:8px 12px;color:#e2e8f0;max-width:380px;">'
        +   '<span title="' + esc(r.title) + '">' + esc(r.title.length > 55 ? r.title.substring(0, 55) + '…' : r.title) + '</span>'
        + '</td>'
        + '<td style="padding:8px 12px;text-align:right;color:#f1f5f9;white-space:nowrap;font-weight:600;">¥' + r.price.toLocaleString() + '</td>'
        + '<td style="padding:8px 12px;text-align:center;color:#94a3b8;white-space:nowrap;">' + (r.updDate || '-') + ' ' + fallbackNote + '</td>'
        + '<td style="padding:8px 12px;text-align:center;white-space:nowrap;">'
        +   '<span style="font-weight:700;font-size:1.05rem;color:' + dayColor + ';">' + r.days + '</span>'
        +   '<span style="color:#64748b;font-size:0.78rem;">日</span>'
        + '</td>'
        + '</tr>';
    }

    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  // ---- TSVコピー（Googleスプレッドシート用） ----
  window.copyMarketTsv = function () {
    if (!_results.length) return;
    var lines = [['管理番号', '商品名', '現在価格', '最終更新日', '更新なし日数'].join('\t')];
    for (var i = 0; i < _results.length; i++) {
      var r = _results[i];
      lines.push([r.code, r.title, r.price, r.updDate, r.days].join('\t'));
    }
    var tsv = lines.join('\n');
    navigator.clipboard.writeText(tsv).then(function () {
      var btn = document.getElementById('market-copy-btn');
      if (btn) {
        btn.textContent = '✅ コピーしました！';
        setTimeout(function () { btn.textContent = '📋 スプレッドシートにコピー'; }, 2500);
      }
    }).catch(function () {
      // フォールバック
      var ta = document.createElement('textarea');
      ta.value = tsv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  };

  // ---- エスケープ ----
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- 検索実行 ----
  function runSearch() {
    var daysEl = document.getElementById('market-days');
    var threshold = parseInt(daysEl ? daysEl.value : 100) || 100;
    var summary = document.getElementById('market-summary');
    var exportBtn = document.getElementById('market-export-btn');
    var copyBtn = document.getElementById('market-copy-btn');
    var wrap = document.getElementById('market-table-wrap');

    var allItems = window.items || [];
    if (!allItems.length) {
      summary.innerHTML = '<span style="color:#f87171">⚠️ データがありません。先にCSV更新で商品データを取り込んでください。</span>';
      wrap.innerHTML = '';
      return;
    }

    var res = searchStaleItems(threshold);
    _results = res.results;

    if (!_results.length) {
      summary.innerHTML = '<span style="color:#64748b;">' + threshold + '日以上更新なしの商品は見つかりませんでした</span>';
      if (exportBtn) exportBtn.style.display = 'none';
      if (copyBtn) copyBtn.style.display = 'none';
      wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;">該当なし</div>';
      return;
    }

    summary.innerHTML =
      '<span style="color:#fbbf24;font-weight:600;">' + _results.length + '件</span>'
      + '<span style="color:#64748b;"> が ' + threshold + '日以上更新なし</span>'
      + (res.noDate > 0 ? '<span style="color:#475569;font-size:0.78rem;margin-left:8px;">（日付不明 ' + res.noDate + '件 除外）</span>' : '');

    if (exportBtn) exportBtn.style.display = '';
    if (copyBtn) copyBtn.style.display = '';
    renderTable(_results);
  }

  // ---- UI ----
  window.openMarketModal = function () {
    document.getElementById('market-modal').classList.add('open');
    // 開いたときに自動検索
    runSearch();
  };

  window.closeMarketModal = function () {
    document.getElementById('market-modal').classList.remove('open');
  };

  window.runMarketSearch = runSearch;

  document.addEventListener('DOMContentLoaded', function () {
    // Enterキー検索
    var daysEl = document.getElementById('market-days');
    if (daysEl) {
      daysEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') runSearch();
      });
    }
  });

})();
