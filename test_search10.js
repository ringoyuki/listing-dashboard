const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

global.document = {
  getElementById: (id) => {
    if(id === 'inp-code') return { value: 'D77048_881', addEventListener: ()=>{} };
    if(id === 'inp-title') return { value: '', addEventListener: ()=>{} };
    if(id === 'results') return { 
      set innerHTML(val) { console.log("【検索結果画面】\n", val.substring(0, 500) + (val.length > 500 ? '...' : '')); }, 
      get innerHTML() { return ''; },
      style: {}
    };
    return { value: '', addEventListener: ()=>{}, innerHTML: '', style: {}, classList: {remove:()=>{}} };
  },
  addEventListener: () => {}
};
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.PLATS = [];
global.MARKERS = ['管理番号','商品番号','品番','旧管理番号','管理番号','管理番号'];

global.showToast = (msg) => { console.log("TOAST:", msg); };

try { eval(appJs); } catch(e) {}

const csvData1 = fs.readFileSync('C:\\Users\\hirok\\Desktop\\product_data_2026-06-16.csv', 'utf8');

console.log("1. CSVインポート -> pendingRows length:", parseCsv(csvData1), pendingRows.length);
items = pendingRows.map(r => ({ id: '1', code: r.code, title: r.title, price: r.price, stock: r.stock, memo: '', urls: {} }));

console.log("2. doSearch(D77048_881)");
doSearch();
