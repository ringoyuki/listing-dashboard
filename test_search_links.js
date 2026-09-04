const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

global.document = {
  getElementById: (id) => {
    if(id === 'inp-code') return { value: 'D39451_871', addEventListener: ()=>{} };
    if(id === 'inp-title') return { value: '', addEventListener: ()=>{} };
    if(id === 'results') return { 
      set innerHTML(val) { console.log("【結果HTML】\n" + val); }, 
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
global.showToast = () => {};

try { eval(appJs); } catch(e) {}

const csvData1 = fs.readFileSync('C:\\Users\\hirok\\Desktop\\product_data_2026-06-16.csv', 'utf8');

parseCsv(csvData1);
console.log("パース結果 件数:", pendingRows.length);
items = pendingRows.map(r => ({ id: '1', code: r.code, title: r.title, price: r.price, stock: r.stock, memo: '', urls: { mercari_shops: r.shopsUrl } }));

console.log("検索実行: D39451_871");
doSearch();
