const fs = require('fs');

// 1. index.html の「在庫数=1のみ」という誤説明を修正
let html = fs.readFileSync('index.html', 'utf8');
html = html
  .replace('v=17', 'v=18')
  .replace('v=18', 'v=18');

// msub の説明文を変更
html = html.replace(
  /(<p class="msub">)[^<]*(在庫|在庫数.*?取込)[^<]*(<\/p>)/,
  '$1公開・非公開どちらのCSVも取り込めます$3'
);

// dz-hint を詳しく
html = html.replace(
  /(<p class="dz-hint">)[^<]*Shops[^<]*(<\/p>)/,
  '$1Shops管理 → 商品管理 → CSV一括機能 → CSVダウンロード（公開・非公開それぞれ）$2'
);

fs.writeFileSync('index.html', html, 'utf8');

// 2. app.js の parseCsv を確認・修正
// 非公開商品も確実にインポートされるよう、stock フィルタが無いことを確認
// さらに「非公開」状態（stock=0）でインポートされた商品も検索できるよう item_dict に保存
let app = fs.readFileSync('app.js', 'utf8');

// runImport 内で item_dict（検索履歴辞書）に保存するロジックを追加
const oldRunImport = `  localStorage.setItem('last_seed','manual');
  save(); updateStats(); closeCsvModal();`;

const newRunImport = `  // item_dict に保存（管理番号→タイトル+ShopsURL の辞書）
  var dict = JSON.parse(localStorage.getItem('item_dict') || '{}');
  pendingRows.forEach(function(row){
    if (row.code && row.code !== 'CHECK') {
      dict[row.code] = { title: row.title, shopsUrl: row.shopsUrl };
    }
  });
  localStorage.setItem('item_dict', JSON.stringify(dict));
  localStorage.setItem('last_seed','manual');
  save(); updateStats(); closeCsvModal();`;

if (app.includes(oldRunImport)) {
  app = app.replace(oldRunImport, newRunImport);
  console.log('runImport updated OK');
} else {
  console.log('runImport string not found - skipping');
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Done');
