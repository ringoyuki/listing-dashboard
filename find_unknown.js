const fs = require('fs');
const iconv = require('iconv-lite');

// Shift_JISで読み込み
const buf = fs.readFileSync('C:\\Users\\hirok\\Desktop\\product_data_2026-06-17.csv');
const text = iconv.decode(buf, 'Shift_JIS');

// CSVパーサー（app.jsと同じロジック）
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

const MARKERS = ['管理番号','管理番号','管理番号','旧管理番号','管理番号','管理番号'];
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
const unknown = [];

for (let i = 1; i < rows.length; i++) {
  const cols = rows[i];
  if (cols.length < 71) continue;
  const stock = cols[COL.STOCK].trim();
  if (stock !== '1') continue; // 在庫1のみ
  const code = cols[COL.CODE].trim() || extractCode(cols[COL.DESC].trim());
  if (!code) {
    const itemId = cols[COL.ID].trim();
    const title = cols[COL.NAME].trim();
    const price = cols[COL.PRICE].trim();
    const shopsUrl = itemId ? 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/' + itemId : '';
    unknown.push({ itemId, title, price, shopsUrl });
  }
}

console.log(`\n=== 管理番号不明の商品 (在庫=1): ${unknown.length}件 ===\n`);
unknown.forEach((item, idx) => {
  console.log(`[${idx+1}] タイトル: ${item.title}`);
  console.log(`     価格: ¥${Number(item.price).toLocaleString()}`);
  console.log(`     Shops管理URL: ${item.shopsUrl}`);
  console.log('');
});
