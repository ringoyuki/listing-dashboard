const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

let resultHtml = '';

global.document = {
  getElementById: (id) => {
    if(id === 'inp-code') return { value: 'D77048_881', addEventListener: ()=>{} };
    if(id === 'inp-title') return { value: '', addEventListener: ()=>{} };
    if(id === 'result-area') {
      return { 
        set innerHTML(val) { resultHtml = val; },
        get innerHTML() { return resultHtml; }
      };
    }
    return { value: '', addEventListener: ()=>{}, innerHTML: '' };
  },
  addEventListener: () => {}
};
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.PLATS = [];
global.MARKERS = ['管理番号','商品番号','品番','旧管理番号','管理番号','管理番号'];

global.renderCard = (item, sc, st) => { return `CARD:${item.title}`; };
global.renderNotFound = (c, t) => { return `NOT_FOUND:${c}`; };

try {
  eval(appJs);
} catch(e) {
  console.log("Eval Error:", e);
}

// ケース1: CSVの中に "D77048" がある場合
const csvData1 = `"商品ID","商品名","商品説明","在庫数","管理番号","価格"\n` +
`"A1","セイコー バカラ","説明","0","D77048","1000"`;

parseCsv(csvData1);
items = pendingRows.map(r => ({ id: '1', code: r.code, title: r.title, price: r.price, stock: r.stock, memo: '', urls: {} }));

doSearch();
console.log('ケース1 (CSVがD77048の場合):', resultHtml);

// ケース2: CSVの中に "D77048_881" がある場合
const csvData2 = `"商品ID","商品名","商品説明","在庫数","管理番号","価格"\n` +
`"A1","セイコー バカラ","説明","0","D77048_881","1000"`;

parseCsv(csvData2);
items = pendingRows.map(r => ({ id: '1', code: r.code, title: r.title, price: r.price, stock: r.stock, memo: '', urls: {} }));

doSearch();
console.log('ケース2 (CSVがD77048_881の場合):', resultHtml);

// ケース3: CSVには管理番号がなく、タイトルに "D77048" がある場合
const csvData3 = `"商品ID","商品名","商品説明","在庫数","管理番号","価格"\n` +
`"A1","セイコー バカラ D77048","説明","0","","1000"`;

parseCsv(csvData3);
items = pendingRows.map(r => ({ id: '1', code: r.code, title: r.title, price: r.price, stock: r.stock, memo: '', urls: {} }));

doSearch();
console.log('ケース3 (タイトルにD77048がある場合):', resultHtml);

