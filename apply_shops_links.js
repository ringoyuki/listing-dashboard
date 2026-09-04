const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const targetOld = `    if (p.key === 'mercari_shops') {
      actions = url
        ? '<a href="'+esc(url)+'" target="_blank" class="pbtn pbtn-shops">↗ 開く</a>'
        : '<span class="plat-note">CSV取込後に表示</span>';
    } else {`;

// 過去の文字化けで "↗ 開く" ではない可能性も考慮して、正規表現で置換
const regex = /if\s*\(\s*p\.key\s*===\s*'mercari_shops'\s*\)\s*\{\s*actions\s*=\s*url[\s\S]*?\}\s*else\s*\{/;

const replaceNew = `if (p.key === 'mercari_shops') {
      var su = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products?keyword=' + encodeURIComponent(code);
      if (url) {
        var idMatch = url.match(/\\/products\\/([a-zA-Z0-9]+)$/);
        var itemId = idMatch ? idMatch[1] : '';
        var pubUrl = itemId ? 'https://jp.mercari.com/shops/product/' + itemId : '';
        actions = '<a href="'+esc(url)+'" target="_blank" class="pbtn pbtn-shops">管理画面</a>'
                + '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">検索</a>';
        if(pubUrl) actions += '<a href="'+esc(pubUrl)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">客観的</a>';
      } else {
        actions = '<span class="plat-note">CSV取込後に表示</span>';
      }
    } else {`;

appJs = appJs.replace(regex, replaceNew);

fs.writeFileSync('app.js', appJs, 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=14', 'v=15');
fs.writeFileSync('index.html', html, 'utf8');

console.log("Replace Done");
