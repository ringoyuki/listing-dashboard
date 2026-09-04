const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

global.document = {
  getElementById: (id) => {
    if(id === 'inp-code') return { value: 'D77048_881', addEventListener: ()=>{} };
    if(id === 'inp-title') return { value: '', addEventListener: ()=>{} };
    if(id === 'results') return { set innerHTML(val) {}, get innerHTML() { return ''; }, style: {} };
    if(id === 'prev-area') return { set innerHTML(val) {}, get innerHTML() { return ''; }, style: {} };
    return { value: '', addEventListener: ()=>{}, innerHTML: '', style: {}, classList: {remove:()=>{}} };
  },
  addEventListener: () => {}
};
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.PLATS = [];
global.MARKERS = ['管理番号','商品番号','品番','旧管理番号','管理番号','管理番号'];
global.showToast = () => {};

// app.jsの関数のみ抽出
try { eval(appJs); } catch(e) {}

const csvData1 = fs.readFileSync('C:\\Users\\hirok\\Desktop\\product_data_2026-06-16.csv', 'utf8');

function debugParseCsv(text){
  var rows = [];
  var r = [], c = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '"') {
      if (inQ && text[i+1] === '"') { c += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === ',' && !inQ) {
      r.push(c); c = '';
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && text[i+1] === '\n') i++;
      r.push(c); rows.push(r); r = []; c = '';
    } else {
      c += ch;
    }
  }
  if (c !== '' || r.length > 0) { r.push(c); rows.push(r); }
  
  console.log("Total parsed rows:", rows.length);
  
  let skip = 0;
  for(let i=1; i<rows.length; i++){
    if(rows[i].length < 71){
      skip++;
      if (skip === 1) {
         console.log("First skipped row length:", rows[i].length);
         console.log("Row preview:", rows[i].slice(0, 5).join(', '));
      }
    }
  }
  console.log("Total skipped:", skip);
}

debugParseCsv(csvData1);

