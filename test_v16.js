const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

global.document = { getElementById: (id) => ({ value: '', addEventListener: ()=>{}, innerHTML: '', style: {}, classList: {remove:()=>{}} }), addEventListener: () => {} };
global.window = { open: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.PLATS = [];
global.MARKERS = ['管理番号','商品番号','品番','旧管理番号','管理番号','管理番号'];
global.showToast = () => {};
global.encodeURIComponent = encodeURIComponent;

try { eval(appJs); } catch(e) {}

const code = 'C4660689';
const title = 'タイトル';
const shopsUrl = 'https://jp.mercari.com/shops/product/2JGpLKaNA4aS62Ju4epBY9'; // 過去の客観的URL

const dummyItem = { code: code, title: title, urls: { mercari_shops: shopsUrl } };
const cardHtml = renderCard(dummyItem, code, title);
const shopsRowMatch = cardHtml.match(/<div class="plat-name">🛍 メルカリShops<\/div><div class="plat-actions">([\s\S]*?)<\/div><\/div>/);
if (shopsRowMatch) {
  console.log("v16 の Shopsアクション部分のHTML:\n", shopsRowMatch[1]);
} else {
  console.log("Shops行が見つかりません");
}
