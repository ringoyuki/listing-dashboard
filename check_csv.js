const fs = require('fs');
const iconv = require('iconv-lite');

const buf = fs.readFileSync('C:\\Users\\hirok\\Desktop\\product_data_2026-06-22.csv');
const text = iconv.decode(buf, 'Shift_JIS');

// CSVパーサー
const rows = [];
let r = [], c = '', inQ = false;
for (let i = 0; i < text.length; i++) {
  const ch = text[i];
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

// ヘッダー行を確認（列名）
const header = rows[0];
console.log('総行数:', rows.length - 1, '件');
console.log('\n--- 在庫数(STOCK列=67)の内訳 ---');
const stockCount = {};
for (let i = 1; i < rows.length; i++) {
  const cols = rows[i];
  if (cols.length < 68) continue;
  const stock = cols[67].trim();
  stockCount[stock] = (stockCount[stock] || 0) + 1;
}
Object.entries(stockCount).forEach(([k, v]) => {
  console.log(`  在庫数 "${k}": ${v}件`);
});

// 列67付近のヘッダー名を確認
console.log('\n--- ヘッダー列67周辺 ---');
for (let i = 65; i <= 70; i++) {
  console.log(`  列${i}: ${header[i]}`);
}

// D805で検索してみる
const MARKERS = ['管理番号'];
function extractCode(desc) {
  const lines = (desc || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (MARKERS.some(m => l === m || l.indexOf(m) === 0)) {
      for (let j = i+1; j < Math.min(i+5, lines.length); j++) {
        const cv = lines[j].trim();
        if (/^[A-E]\d{4,}/.test(cv)) return cv;
      }
    }
  }
  return '';
}

const COL = {ID:0, NAME:62, DESC:63, STOCK:67, CODE:70, PRICE:155};
let found = null;
for (let i = 1; i < rows.length; i++) {
  const cols = rows[i];
  if (cols.length < 71) continue;
  const code = cols[COL.CODE].trim() || extractCode(cols[COL.DESC].trim());
  if (code && (code.indexOf('D805') === 0 || code === 'D805')) {
    found = { code, title: cols[COL.NAME].trim(), stock: cols[COL.STOCK].trim(), price: cols[COL.PRICE].trim() };
    break;
  }
}
console.log('\n--- D805の検索結果 ---');
if (found) {
  console.log('  見つかりました！');
  console.log('  管理番号:', found.code);
  console.log('  タイトル:', found.title);
  console.log('  在庫数:', found.stock);
  console.log('  価格:', found.price);
} else {
  console.log('  D805はこのCSVに含まれていません（非公開のため？）');
}
