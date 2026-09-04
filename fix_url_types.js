const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const regexRender = /if\s*\(\s*p\.key\s*===\s*'mercari_shops'\s*\)\s*\{\s*var\s*su\s*=\s*'https:\/\/mercari-shops\.com[\s\S]*?\}\s*else\s*\{/;

const replaceRender = `if (p.key === 'mercari_shops') {
      var su = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products?keyword=' + encodeURIComponent(code);
      if (url) {
        // 過去の客観的URLか、管理画面URLか、どちらが入っていてもIDを抽出する
        var idMatch = url.match(/\\/product(s)?\\/([a-zA-Z0-9]+)$/);
        var itemId = idMatch ? idMatch[2] : '';
        if (itemId) {
          var adminUrl = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/' + itemId;
          var pubUrl = 'https://jp.mercari.com/shops/product/' + itemId;
          actions = '<a href="'+esc(adminUrl)+'" target="_blank" class="pbtn pbtn-shops">管理画面</a>'
                  + '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">検索</a>'
                  + '<a href="'+esc(pubUrl)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">客観的</a>';
        } else {
          // 何らかの理由でIDが取れなかった場合はそのまま出す
          actions = '<a href="'+esc(url)+'" target="_blank" class="pbtn pbtn-shops">管理画面</a>'
                  + '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">検索</a>';
        }
      } else {
        actions = '<span class="plat-note">CSV取込後に表示</span>';
      }
    } else {`;

appJs = appJs.replace(regexRender, replaceRender);

const regexOpenAll = /if\s*\(\s*p\.key\s*===\s*'mercari_shops'\s*\)\s*\{\s*if\s*\(shopsUrl\)\s*\{\s*window\.open\(shopsUrl,\s*'_blank'\);\s*opened\+\+;\s*\}\s*return;\s*\}/;

const replaceOpenAll = `if (p.key === 'mercari_shops') {
      if (shopsUrl) {
        var idMatch = shopsUrl.match(/\\/product(s)?\\/([a-zA-Z0-9]+)$/);
        var itemId = idMatch ? idMatch[2] : '';
        if (itemId) {
          window.open('https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/' + itemId, '_blank');
        } else {
          window.open(shopsUrl, '_blank');
        }
        opened++;
      }
      return;
    }`;

appJs = appJs.replace(regexOpenAll, replaceOpenAll);

fs.writeFileSync('app.js', appJs, 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=15', 'v=16');
fs.writeFileSync('index.html', html, 'utf8');

console.log("Replace Done");
