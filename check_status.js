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
  } else { c += ch; }
}
if (c !== '' || r.length > 0) { r.push(c); rows.push(r); }

// 列163(商品ステータス)の値の種類を集計
const statusCount = {};
for (let i = 1; i < rows.length; i++) {
  const cols = rows[i];
  if (cols.length < 164) continue;
  const status = cols[163].trim();
  const stock = cols[67].trim();
  const key = `ステータス="${status}" / 在庫=${stock}`;
  statusCount[key] = (statusCount[key] || 0) + 1;
}
console.log('=== 商品ステータス×在庫数の組み合わせ ===');
Object.entries(statusCount).forEach(([k,v]) => console.log(`  ${k}: ${v}件`));

// D80547_861のステータスを確認
for (let i = 1; i < rows.length; i++) {
  const cols = rows[i];
  if (cols.length < 164) continue;
  const code = cols[70].trim();
  if (code === 'D80547_861') {
    console.log(`\nD80547_861: ステータス="${cols[163].trim()}", 在庫=${cols[67].trim()}`);
    break;
  }
}
