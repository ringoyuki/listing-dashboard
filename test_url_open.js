const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

let openedUrls = [];
global.window = {
  open: (url, target) => {
    openedUrls.push(url);
  }
};
global.document = {
  getElementById: (id) => { return { value: '', addEventListener: ()=>{}, innerHTML: '', style: {}, classList: {remove:()=>{}} }; },
  addEventListener: () => {}
};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.PLATS = [];
global.MARKERS = ['管理番号','商品番号','品番','旧管理番号','管理番号','管理番号'];
global.showToast = (msg) => { console.log("Toast:", msg); };
global.encodeURIComponent = encodeURIComponent;

try { eval(appJs); } catch(e) {}

const code = 'D39451_871';
const title = 'uEv9 Be[W 14KT GE S[h VOlbgO mO  䃊O Y fB[X';
const shopsUrl = 'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/2JNzTaYABcowEFuwsjJsyn';

console.log("=== 1. メルカリShopsのボタン確認 ===");
// renderCard を一部モックで実行して、HTML出力を確認
const dummyItem = { code: code, title: title, urls: { mercari_shops: shopsUrl } };
const cardHtml = renderCard(dummyItem, code, title);
const shopsRowMatch = cardHtml.match(/<div class="plat-name">🛍 メルカリShops<\/div><div class="plat-actions">([\s\S]*?)<\/div><\/div>/);
if (shopsRowMatch) {
  console.log("Shopsアクション部分のHTML:\n", shopsRowMatch[1]);
} else {
  console.log("Shops行が見つかりません");
}

console.log("\n=== 2. 全プラット一気に開く (openAllByData) の動作確認 ===");
openAllByData(code, title, shopsUrl);
console.log(`window.open は ${openedUrls.length} 回呼ばれました:`);
openedUrls.forEach((url, i) => {
  console.log(`[${i+1}] ${url}`);
});
