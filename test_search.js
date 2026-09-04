const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

// モック
global.document = {
  getElementById: (id) => {
    if(id === 'inp-code') return { value: 'D77048_881', addEventListener: ()=>{} };
    if(id === 'inp-title') return { value: '', addEventListener: ()=>{} };
    return { value: '', addEventListener: ()=>{}, innerHTML: '' };
  },
  addEventListener: () => {}
};
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.PLATS = [];
global.MARKERS = ['管理番号','商品番号','品番','旧管理番号','管理番号','管理番号'];

// 必要な変数をモック
let _html = '';
global.renderCard = (item, sc, st) => { _html = item.title; return _html; };
global.renderNotFound = (c, t) => { _html = 'NOT_FOUND'; return _html; };

// evalでapp.jsを読み込む
try {
  eval(appJs);
} catch(e) {
  console.log("Eval Error:", e);
}

// テスト用データ (CSVには "D77048" で入っていると仮定)
const csvData = `"商品ID","商品名","商品説明","在庫数","管理番号","価格"\n` +
`"A1","セイコー バカラ","説明","0","D77048","1000"`;

console.log('--- 1. parseCsv 実行 ---');
parseCsv(csvData);
// pendingRowsをitemsに入れる (runImportの簡易版)
items = pendingRows.map(r => ({ id: '1', code: r.code, title: r.title, price: r.price, stock: r.stock, memo: '', urls: {} }));

console.log('--- 2. doSearch 実行 (code: D77048_881) ---');
doSearch();
console.log('検索結果 (タイトルが出るか):', _html);

