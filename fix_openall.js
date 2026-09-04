const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// 1. openAll のシグネチャと実装を変更
const regexOpenAll = /function openAll\(id\)\s*\{[\s\S]*?\}\s*(?=\/\/ =====)/;
const newOpenAll = `function openAllByData(code, title, shopsUrl) {
  var opened = 0;
  PLATS.forEach(function(p){
    var u = null;
    if (p.key === 'mercari_shops') {
      if (shopsUrl) { window.open(shopsUrl, '_blank'); opened++; }
      return;
    }
    if (p.preferTitle) {
      if (title) u = makeUrl(p.key, 'title', code, title);
    } else {
      if (code) u = makeUrl(p.key, 'code', code, title);
      if (!u && title) u = makeUrl(p.key, 'title', code, title);
    }
    if (u) { window.open(u, '_blank'); opened++; }
  });
  if (opened === 0) showToast('開けるページがありません');
}
`;
appJs = appJs.replace(regexOpenAll, newOpenAll);

// 2. renderCard での openAll 呼び出しを変更
appJs = appJs.replace(
  /var openAllBtn\s*=\s*'<button class="btn-openall" onclick="openAll\(\\\''\+item\.id\+'\\\'\)">🔗 全プラット一気に開く<\/button>';/,
  `var sUrl = (item.urls && item.urls['mercari_shops']) ? item.urls['mercari_shops'] : '';
   var openAllBtn = '<button class="btn-openall" onclick="openAllByData(\\'' + esc(code) + '\\', \\'' + esc(title) + '\\', \\'' + esc(sUrl) + '\\')">🔗 全プラット一気に開く</button>';`
);

fs.writeFileSync('app.js', appJs, 'utf8');
console.log("Replaced openAll");
