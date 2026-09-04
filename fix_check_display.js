const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// 管理番号不明の行のコード列に「タイトル」を表示するよう変更
// isCheck の場合、コード列にタイトルを太字で表示し、タイトル列は非表示

const oldRow = `+pendingRows.slice(0,50).map(function(r){\n      var isCheck = r.code === 'CHECK';\n      return '<tr'+(r.noCode?' class=\"warn-row\"':'')+' style=\"'+(isCheck?'background:rgba(239,68,68,0.12);':'')+'\">'\n        +'<td><code style=\"'+(isCheck?'color:#f87171;font-weight:700':'')+'\">'+( isCheck?'⚠️ 管理番号不明':esc(r.code))+'</code></td>'\n        +'<td style=\"'+(isCheck?'font-weight:600':'')+'\">'+esc(r.title)+'</td>'\n        +'<td>&yen;'+Number(r.price||0).toLocaleString()+'</td>'\n        +'<td>'+(r.shopsUrl?'<a href=\"'+r.shopsUrl+'\" target=\"_blank\" style=\"color:#a78bfa;\">Shops確認</a>':'-')+'</td>'\n        +'</tr>';\n    }).join('')`;

const newRow = `+pendingRows.slice(0,100).map(function(r){\n      var isCheck = r.code === 'CHECK';\n      return '<tr'+(isCheck?' style=\"background:rgba(239,68,68,0.12);\"':'')+'>'\n        +'<td>'+(isCheck\n          ? '<span style=\"color:#f87171;font-size:0.75rem;font-weight:700;\">⚠️ 管理番号なし</span><br><span style=\"color:#e2e8f0;font-weight:600;\">'+esc(r.title)+'</span>'\n          : '<code>'+esc(r.code)+'</code>')\n        +'</td>'\n        +(isCheck ? '' : '<td>'+esc(r.title.slice(0,30))+(r.title.length>30?'…':'')+'</td>')\n        +(isCheck ? '<td></td>' : '')\n        +'<td>&yen;'+Number(r.price||0).toLocaleString()+'</td>'\n        +'<td>'+(r.shopsUrl?'<a href=\"'+r.shopsUrl+'\" target=\"_blank\" style=\"color:#a78bfa;\">Shops確認</a>':'-')+'</td>'\n        +'</tr>';\n    }).join('')`;

if (app.includes(oldRow)) {
  app = app.replace(oldRow, newRow);
  console.log('OK exact match');
} else {
  // 柔軟に置換
  app = app.replace(
    /\+pendingRows\.slice\(0,50\)\.map\(function\(r\)\{[\s\S]*?\}\)\.join\(''\)/,
    newRow
  );
  console.log('OK flexible match');
}

fs.writeFileSync('app.js', app, 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=17', 'v=18').replace('v=18', 'v=18'); // 確保
fs.writeFileSync('index.html', html, 'utf8');

console.log('Done');
