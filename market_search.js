// ===== 売れていない商品の相場検索 =====
// Shops CSV → 放置商品抽出 → メルカリ・ヤフオク相場検索

(function () {
  'use strict';

  // Shops CSV 列インデックス
  var SCOL = {
    ID: 0,
    NAME: 62,
    DESC: 63,
    STOCK: 67,
    CODE: 70,
    PRICE: 155,
    STATUS: 163,
    REG_DATE: 175,    // 商品登録日時
    UPD_DATE: 176     // 最終更新日時
  };

  var _results = []; // 現在の検索結果（CSV出力用に保持）

  // ---- CSV パーサー ----
  function parseCsv(text) {
    var rows = [], r = [], c = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '"') {
        if (inQ && text[i + 1] === '"') { c += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        r.push(c); c = '';
      } else if ((ch === '\n' || ch === '\r') && !inQ) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        r.push(c); rows.push(r); r = []; c = '';
      } else {
        c += ch;
      }
    }
    if (c !== '' || r.length > 0) { r.push(c); rows.push(r); }
    return rows;
  }

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
    var diff = Date.now() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // ---- 検索URL生成 ----
  function mercariUrl(title) {
    // メルカリ：売り切れ済み商品検索
    return 'https://jp.mercari.com/search?keyword=' +
      encodeURIComponent(title) + '&status=sold_out&sort=price&order=asc';
  }
  function yahooUrl(title) {
    // ヤフオク：落札済み検索
    return 'https://auctions.yahoo.co.jp/search/search?p=' +
      encodeURIComponent(title) + '&f=0x4&s1=end&o1=d&mode=2';
  }

  // ---- メイン処理 ----
  function processMarketCsv(csvText, thresholdDays) {
    var rows = parseCsv(csvText);
    if (rows.length < 2) return [];

    var results = [];
    var today = new Date();

    for (var i = 1; i < rows.length; i++) {
      var cols = rows[i];
      if (cols.length < 71) continue;

      // 在庫ありかつ販売中のみ対象
      var stock = parseInt((cols[SCOL.STOCK] || '').trim()) || 0;
      if (stock <= 0) continue;

      var title = (cols[SCOL.NAME] || '').trim();
      var price = (cols[SCOL.PRICE] || '').trim();
      if (!title || !price) continue;

      // 最終更新日時
      var updDate  = parseDate(cols.length > SCOL.UPD_DATE ? cols[SCOL.UPD_DATE] : '');
      var regDate  = parseDate(cols.length > SCOL.REG_DATE ? cols[SCOL.REG_DATE] : '');
      var baseDate = updDate || regDate;

      var days = daysSince(baseDate);
      if (days === null || days < thresholdDays) continue;

      results.push({
        code:    (cols[SCOL.CODE] || '').trim(),
        title:   title,
        price:   parseInt(price) || 0,
        regDate: regDate ? regDate.toISOString().substring(0, 10) : '',
        updDate: baseDate ? baseDate.toISOString().substring(0, 10) : '',
        days:    days
      });
    }

    // 放置日数の多い順（最終更新が古い順）
    results.sort(function (a, b) { return b.days - a.days; });
    return results;
  }

  // ---- テーブル描画 ----
  function renderTable(results) {
    var wrap = document.getElementById('market-table-wrap');
    if (!wrap) return;

    if (results.length === 0) {
      wrap.innerHTML = '<div style="padding:32px;text-align:center;color:#64748b;">該当する商品がありませんでした</div>';
      return;
    }

    var html = '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">'
      + '<thead><tr style="background:rgba(255,255,255,0.06);position:sticky;top:0;z-index:1;">'
      + '<th style="padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;">管理番号</th>'
      + '<th style="padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);">商品名</th>'
      + '<th style="padding:8px 10px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;">現在価格</th>'
      + '<th style="padding:8px 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;">最終更新日</th>'
      + '<th style="padding:8px 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;">放置日数</th>'
      + '<th style="padding:8px 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);">相場を調べる</th>'
      + '<th style="padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;">相場価格メモ</th>'
      + '</tr></thead><tbody>';

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      // 放置日数に応じた色
      var dayColor = r.days >= 300 ? '#f87171' : r.days >= 200 ? '#fb923c' : r.days >= 100 ? '#fbbf24' : '#94a3b8';
      var rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      // 検索キーワード（商品名の最初の30文字を使う）
      var kw = r.title.substring(0, 40);

      html += '<tr style="background:' + rowBg + ';border-bottom:1px solid rgba(255,255,255,0.04);">'
        + '<td style="padding:7px 10px;color:#a78bfa;font-family:monospace;white-space:nowrap;">' + esc(r.code) + '</td>'
        + '<td style="padding:7px 10px;color:#e2e8f0;max-width:320px;">'
        +   '<span title="' + esc(r.title) + '">' + esc(r.title.length > 50 ? r.title.substring(0, 50) + '…' : r.title) + '</span>'
        + '</td>'
        + '<td style="padding:7px 10px;text-align:right;color:#f1f5f9;white-space:nowrap;">¥' + r.price.toLocaleString() + '</td>'
        + '<td style="padding:7px 10px;text-align:center;color:#94a3b8;white-space:nowrap;">' + (r.updDate || '-') + '</td>'
        + '<td style="padding:7px 10px;text-align:center;font-weight:700;color:' + dayColor + ';white-space:nowrap;">' + r.days + '日</td>'
        + '<td style="padding:7px 10px;text-align:center;white-space:nowrap;">'
        +   '<a href="' + mercariUrl(kw) + '" target="_blank" style="display:inline-block;background:rgba(255,77,77,0.15);border:1px solid rgba(255,77,77,0.35);color:#fca5a5;border-radius:4px;padding:3px 8px;text-decoration:none;font-size:0.75rem;margin-right:4px;">メルカリ</a>'
        +   '<a href="' + yahooUrl(kw) + '" target="_blank" style="display:inline-block;background:rgba(99,179,237,0.15);border:1px solid rgba(99,179,237,0.35);color:#93c5fd;border-radius:4px;padding:3px 8px;text-decoration:none;font-size:0.75rem;">ヤフオク</a>'
        + '</td>'
        + '<td style="padding:7px 10px;">'
        +   '<input type="text" placeholder="例: ¥8,000〜12,000" data-idx="' + i + '" class="market-memo"'
        +   ' style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:#f1f5f9;border-radius:4px;padding:3px 8px;font-size:0.78rem;width:140px;">'
        + '</td>'
        + '</tr>';
    }

    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  // ---- CSV出力（スタッフ向け） ----
  window.exportMarketCsv = function () {
    if (!_results.length) return;
    var rows = [['管理番号', '商品名', '現在価格', '登録日', '最終更新日', '放置日数', '相場価格メモ', 'メルカリ検索', 'ヤフオク検索']];

    // メモ入力値を収集
    var memos = {};
    var memoEls = document.querySelectorAll('.market-memo');
    memoEls.forEach(function (el) {
      memos[el.getAttribute('data-idx')] = el.value;
    });

    for (var i = 0; i < _results.length; i++) {
      var r = _results[i];
      var kw = r.title.substring(0, 40);
      rows.push([
        r.code, r.title, r.price, r.regDate, r.updDate, r.days,
        memos[i] || '',
        mercariUrl(kw),
        yahooUrl(kw)
      ]);
    }

    var csv = '\uFEFF' + rows.map(function (row) {
      return row.map(function (v) {
        v = String(v);
        return (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1)
          ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\n');

    var now = new Date();
    var ds = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = '相場リサーチ_' + ds + '.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ---- エスケープ ----
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- UI ----
  window.openMarketModal = function () {
    document.getElementById('market-modal').classList.add('open');
  };

  window.closeMarketModal = function () {
    document.getElementById('market-modal').classList.remove('open');
  };

  document.addEventListener('DOMContentLoaded', function () {
    var fi = document.getElementById('market-csv');
    if (!fi) return;

    fi.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;

      var summary = document.getElementById('market-summary');
      var exportBtn = document.getElementById('market-export-btn');
      var wrap = document.getElementById('market-table-wrap');

      summary.textContent = '📂 読み込み中...';
      wrap.innerHTML = '';

      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var days = parseInt(document.getElementById('market-days').value) || 100;
          _results = processMarketCsv(ev.target.result, days);

          if (_results.length === 0) {
            summary.textContent = '⚠️ ' + days + '日以上放置の商品が見つかりませんでした';
            exportBtn.style.display = 'none';
            wrap.innerHTML = '<div style="padding:32px;text-align:center;color:#64748b;">該当なし</div>';
            return;
          }

          summary.innerHTML = '<span style="color:#fbbf24;font-weight:600;">' + _results.length + '件</span>'
            + '<span style="color:#64748b;"> / ' + days + '日以上放置</span>';
          exportBtn.style.display = '';
          renderTable(_results);
        } catch (err) {
          summary.textContent = '❌ エラー: ' + err.message;
        }
      };
      reader.readAsText(f, 'Shift_JIS');
    });

    // 日数変更時に再描画ボタン的動作（ファイル未選択の場合は無視）
    document.getElementById('market-days').addEventListener('change', function () {
      var fi2 = document.getElementById('market-csv');
      if (fi2.files.length > 0) fi2.dispatchEvent(new Event('change'));
    });
  });

})();
