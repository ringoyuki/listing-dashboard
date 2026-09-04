const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

global.document = {
  getElementById: (id) => {
    if(id === 'inp-code') return { value: 'D77048_881', addEventListener: ()=>{} };
    if(id === 'inp-title') return { value: '', addEventListener: ()=>{} };
    if(id === 'result-area') return { set innerHTML(val) { console.log("RESULT HTML:", val); }, get innerHTML() { return ''; } };
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

try { eval(appJs); } catch(e) {}

const csvData1 = `"商品ID","商品名","商品説明","在庫数","管理番号","価格"\n"A1","セイコー バカラ","説明","0","D77048","1000"`;
parseCsv(csvData1);
items = pendingRows.map(r => ({ id: '1', code: r.code, title: r.title, price: r.price, stock: r.stock, memo: '', urls: {} }));

console.log("ITEMS:", items);
doSearch();
