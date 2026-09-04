const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// 1. renderCard内の mercari_shops 分岐を書き換え
// RegExpを使うと複数マッチで壊れるため、文字列の split/replace を使う
const oldRenderCardBlock = `    if (p.key === 'mercari_shops') {
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

const newRenderCardBlock = `    if (p.key === 'mercari_shops') {
      var su = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products?keyword=' + encodeURIComponent(code);
      if (url) {
        var idMatch = url.match(/\\/product(s)?\\/([a-zA-Z0-9]+)$/);
        var itemId = idMatch ? idMatch[2] : '';
        if (itemId) {
          var adminUrl = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/' + itemId;
          var pubUrl = 'https://jp.mercari.com/shops/product/' + itemId;
          actions = '<a href="'+esc(adminUrl)+'" target="_blank" class="pbtn pbtn-shops">管理画面</a>'
                  + '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">検索</a>'
                  + '<a href="'+esc(pubUrl)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">客観的</a>';
        } else {
          actions = '<a href="'+esc(url)+'" target="_blank" class="pbtn pbtn-shops">管理画面</a>'
                  + '<a href="'+esc(su)+'" target="_blank" class="pbtn pbtn-shops" style="background:#f1f5f9;color:#475569;margin-left:4px">検索</a>';
        }
      } else {
        actions = '<span class="plat-note">CSV取込後に表示</span>';
      }
    } else {`;

appJs = appJs.replace(oldRenderCardBlock, newRenderCardBlock);

// 2. openAllByData内の mercari_shops 分岐を書き換え
const oldOpenAllBlock = `    if (p.key === 'mercari_shops') {
      if (shopsUrl) { window.open(shopsUrl, '_blank'); opened++; }
      return;
    }`;

const newOpenAllBlock = `    if (p.key === 'mercari_shops') {
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

appJs = appJs.replace(oldOpenAllBlock, newOpenAllBlock);

fs.writeFileSync('app.js', appJs, 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=15', 'v=16');
fs.writeFileSync('index.html', html, 'utf8');

console.log("Replace OK");
