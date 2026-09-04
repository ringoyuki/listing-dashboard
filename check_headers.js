const fs = require('fs');
const iconv = require('iconv-lite');
const buf = fs.readFileSync('C:\\Users\\hirok\\Desktop\\product_data_2026-06-22.csv');
const text = iconv.decode(buf, 'Shift_JIS');

// ヘッダー行だけ取得
const firstNewline = text.indexOf('\n');
const headerLine = text.substring(0, firstNewline);
const headers = [];
let c = '', inQ = false;
for (let i = 0; i < headerLine.length; i++) {
  const ch = headerLine[i];
  if (ch === '"') { inQ = !inQ; }
  else if (ch === ',' && !inQ) { headers.push(c); c = ''; }
  else { c += ch; }
}
headers.push(c);

// 全ヘッダーを表示（公開状態に関係しそうなものを探す）
console.log('=== 全ヘッダー一覧 ===');
headers.forEach((h, i) => {
  if (h.includes('公開') || h.includes('状態') || h.includes('ステータス') || h.includes('status') || h.includes('非公開') || h.includes('公開状態')) {
    console.log(`★ 列${i}: ${h}`);
  }
});

console.log('\n=== 全ヘッダー（0-30列） ===');
headers.slice(0, 30).forEach((h, i) => console.log(`  列${i}: ${h}`));
