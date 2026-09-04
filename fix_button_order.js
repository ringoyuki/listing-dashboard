const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const oldActions1 = `          actions = '<a href="'+esc(adminUrl)+'" target="_blank" class="pbtn pbtn-shops">管理画面</a>'
                  + '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">検索</a>'
                  + '<a href="'+esc(pubUrl)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">客観的</a>';`;

const newActions1 = `          actions = '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops">検索</a>'
                  + '<a href="'+esc(adminUrl)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">管理画面</a>'
                  + '<a href="'+esc(pubUrl)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">商品ページ</a>';`;

const oldActions2 = `          actions = '<a href="'+esc(url)+'" target="_blank" class="pbtn pbtn-shops">管理画面</a>'
                  + '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">検索</a>';`;

const newActions2 = `          actions = '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops">検索</a>'
                  + '<a href="'+esc(url)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">管理画面</a>';`;

appJs = appJs.replace(oldActions1, newActions1);
appJs = appJs.replace(oldActions2, newActions2);

fs.writeFileSync('app.js', appJs, 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=16', 'v=17');
fs.writeFileSync('index.html', html, 'utf8');

console.log("Button order updated");
