const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const oldMakeUrl = `function makeUrl(platKey, type, code, title) {
  var qc = encodeURIComponent(code  || '');
  var qt = encodeURIComponent(title || '');
  if (type === 'code') {
    if (platKey === 'mercari')    return 'https://jp.mercari.com/search?keyword=' + qc;
    if (platKey === 'rakuma')     return 'https://fril.jp/s?query=' + qc;
    if (platKey === 'yahoo_flea') return 'https://paypayfleamarket.yahoo.co.jp/search/' + qc + '?page=1';
  }
  if (type === 'title') {
    if (platKey === 'mercari')       return 'https://jp.mercari.com/search?keyword=' + qt;
    if (platKey === 'yahoo_auction') return 'https://auctions.yahoo.co.jp/search/search?auccat=&tab_ex=commerce&ei=utf-8&aq=-1&oq=&sc_i=&fr=auc_top&p=' + qt;
    if (platKey === 'rakuma')        return 'https://fril.jp/s?query=' + qt;
    if (platKey === 'yahoo_flea')    return 'https://paypayfleamarket.yahoo.co.jp/search/' + qt + '?page=1';
  }
  return null;
}`;

const newMakeUrl = `function makeUrl(platKey, type, code, title) {
  var qc = encodeURIComponent(code  || '');
  var qt = encodeURIComponent(title || '');
  // ラクマはタイトル最大40文字のため、タイトル検索は先頭40文字に切り詰める
  var qtRakuma = encodeURIComponent((title || '').slice(0, 40));
  if (type === 'code') {
    if (platKey === 'mercari')    return 'https://jp.mercari.com/search?keyword=' + qc;
    if (platKey === 'rakuma')     return 'https://fril.jp/s?query=' + qc;
    if (platKey === 'yahoo_flea') return 'https://paypayfleamarket.yahoo.co.jp/search/' + qc + '?page=1';
  }
  if (type === 'title') {
    if (platKey === 'mercari')       return 'https://jp.mercari.com/search?keyword=' + qt;
    if (platKey === 'yahoo_auction') return 'https://auctions.yahoo.co.jp/search/search?auccat=&tab_ex=commerce&ei=utf-8&aq=-1&oq=&sc_i=&fr=auc_top&p=' + qt;
    if (platKey === 'rakuma')        return 'https://fril.jp/s?query=' + qtRakuma;
    if (platKey === 'yahoo_flea')    return 'https://paypayfleamarket.yahoo.co.jp/search/' + qt + '?page=1';
  }
  return null;
}`;

if (app.includes(oldMakeUrl)) {
  app = app.replace(oldMakeUrl, newMakeUrl);
  console.log('makeUrl updated OK');
} else {
  console.log('String not found exactly');
}

fs.writeFileSync('app.js', app, 'utf8');

// バージョンアップ
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=19', 'v=20');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Done v20');
