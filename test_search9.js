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

let header = [];
let row = [];
for(let i=0; i<160; i++) { header.push(`"col${i}"`); row.push('""'); }
header[0] = '"商品ID"'; row[0] = '"A1"';
header[62] = '"商品名"'; row[62] = '"セイコー バカラ ウェッジウッド"';
header[63] = '"商品説明"'; row[63] = '"説明"';
header[67] = '"在庫数"'; row[67] = '"0"';
header[70] = '"管理番号"'; row[70] = '"D77048"';
header[155] = '"価格"'; row[155] = '"1000"';

const csvData1 = header.join(',') + '\n' + row.join(',');

console.log("1. CSVインポート (D77048) -> pendingRows length:", parseCsv(csvData1), pendingRows.length);
items = pendingRows.map(r => ({ id: '1', code: r.code, title: r.title, price: r.price, stock: r.stock, memo: '', urls: {} }));

console.log("2. doSearch(D77048_881)");
doSearch();
