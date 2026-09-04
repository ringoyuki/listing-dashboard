const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// 1. プレビューテーブルで管理番号不明(CHECK)行をより目立たせ、全タイトルとShopsリンクを表示
const oldPrevRow = `    +pendingRows.slice(0,25).map(function(r){
      return '<tr'+(r.noCode?' class="warn-row"':'')+'>'\
        +'<td><code>'+esc(r.code)+'</code></td>'\
        +'<td>'+esc(r.title.slice(0,35))+(r.title.length>35?'…':'')+' </td>'\
        +'<td>&yen;'+Number(r.price||0).toLocaleString()+'</td>'\
        +'<td>'+(r.shopsUrl?'<a href="'+r.shopsUrl+'" target="_blank">確認</a>':'-')+'</td>'\
        +'</tr>';\
    }).join('')`;

const newPrevRow = `    +pendingRows.slice(0,50).map(function(r){
      var isCheck = r.code === 'CHECK';
      return '<tr'+(r.noCode?' class="warn-row"':'')+' style="'+(isCheck?'background:rgba(239,68,68,0.12);':'')+'">'
        +'<td><code style="'+(isCheck?'color:#f87171;font-weight:700':'')+'">'+(isCheck?'⚠️ 管理番号不明':esc(r.code))+'</code></td>'
        +'<td style="'+(isCheck?'font-weight:600':'')+'">'+esc(r.title)+'</td>'
        +'<td>&yen;'+Number(r.price||0).toLocaleString()+'</td>'
        +'<td>'+(r.shopsUrl?'<a href="'+r.shopsUrl+'" target="_blank" style="color:#a78bfa;">Shops確認</a>':'-')+'</td>'
        +'</tr>';
    }).join('')`;

if (app.includes(oldPrevRow)) {
  app = app.replace(oldPrevRow, newPrevRow);
  console.log('Preview table updated OK');
} else {
  console.log('String not found exactly - trying flexible match');
  // フレキシブルに
  app = app.replace(
    /\+pendingRows\.slice\(0,25\)\.map\(function\(r\)\{[\s\S]*?\}\)\.join\(''\)/,
    newPrevRow
  );
  console.log('Flexible replace done');
}

// 2. v=17→v=18 にバージョンアップ
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=17', 'v=18');
fs.writeFileSync('index.html', html, 'utf8');

fs.writeFileSync('app.js', app, 'utf8');
console.log('All done');
