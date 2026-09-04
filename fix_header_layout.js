const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let css  = fs.readFileSync('style.css', 'utf8');

// 1. header-inner の高さをautoに、2行対応へ
css = css.replace(
  '.header-inner{max-width:860px;margin:0 auto;padding:0 16px;height:54px;display:flex;align-items:center;gap:12px}',
  '.header-inner{max-width:860px;margin:0 auto;padding:6px 16px;min-height:54px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
);

// 2. hstatsのflex-wrapを制限して溢れないようにする
css = css.replace(
  '.hstats{display:flex;gap:6px;flex:1;flex-wrap:wrap;align-items:center}',
  '.hstats{display:flex;gap:6px;flex:1;flex-wrap:nowrap;align-items:center;overflow:hidden;min-width:0}'
);

// 3. csv-updated-at を hstats の外（headerの2行目）に移動するためにhtmlを変更
// 現在: hstats の中に csv-updated-at がある → これを取り出す
html = html.replace(
  '<span class="spill seed" id="seed-info"></span><span class="spill" id="csv-updated-at" style="font-size:0.72rem;color:var(--tx2,#94a3b8);margin-left:4px;"></span>',
  '<span class="spill seed" id="seed-info"></span>'
);

// ヘッダー全体の後に更新日時バーを追加
html = html.replace(
  '</header>',
  `  <div id="csv-updated-bar" style="background:rgba(15,15,19,.7);border-bottom:1px solid rgba(255,255,255,0.06);text-align:left;padding:2px 16px;">
      <span id="csv-updated-at" style="font-size:0.7rem;color:#64748b;"></span>
    </div>
  </header>`
);

// 4. バージョンアップ
html = html.replace('v=27', 'v=28');

fs.writeFileSync('index.html', html, 'utf8');
fs.writeFileSync('style.css', css, 'utf8');
console.log('Done v28');
