const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// 1. COLにSTATUS列(163)を追加
app = app.replace(
  "var COL={ID:0,NAME:62,DESC:63,STOCK:67,CODE:70,PRICE:155};",
  "var COL={ID:0,NAME:62,DESC:63,STOCK:67,CODE:70,PRICE:155,STATUS:163};"
);

// 2. parseCsvでstatusを読み取り
app = app.replace(
  `    var stock = cols[COL.STOCK].trim()==='1'?1:0;
    var itemId=cols[COL.ID].trim();
    var title=cols[COL.NAME].trim();
    var code=cols[COL.CODE].trim()||extractCode(cols[COL.DESC].trim());
    var price=cols[COL.PRICE].trim();
    if(!code){code='CHECK';noCode++;}
    var shopsUrl=itemId?'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/'+itemId:'';
    pendingRows.push({code:code,title:title,price:price,shopsUrl:shopsUrl,stock:stock,noCode:!cols[COL.CODE].trim()&&!extractCode(cols[COL.DESC].trim())});`,
  `    var stock = parseInt(cols[COL.STOCK].trim()) || 0;
    var status = cols.length > COL.STATUS ? cols[COL.STATUS].trim() : '';
    var itemId=cols[COL.ID].trim();
    var title=cols[COL.NAME].trim();
    var code=cols[COL.CODE].trim()||extractCode(cols[COL.DESC].trim());
    var price=cols[COL.PRICE].trim();
    if(!code){code='CHECK';noCode++;}
    var shopsUrl=itemId?'https://mercari-shops.com/seller/shops/qWn7JdhbsaotJpySx9NmFF/products/'+itemId:'';
    pendingRows.push({code:code,title:title,price:price,shopsUrl:shopsUrl,stock:stock,status:status,noCode:!cols[COL.CODE].trim()&&!extractCode(cols[COL.DESC].trim())});`
);

// 3. runImportでstatusも保存
app = app.replace(
  "items.unshift({id:genId(),code:row.code,title:row.title,price:row.price,stock:row.stock,memo:'',urls:urls,createdAt:Date.now()});",
  "items.unshift({id:genId(),code:row.code,title:row.title,price:row.price,stock:row.stock,status:row.status||'',memo:'',urls:urls,createdAt:Date.now()});"
);
app = app.replace(
  "ex.title=row.title; ex.price=row.price; ex.stock=row.stock;",
  "ex.title=row.title; ex.price=row.price; ex.stock=row.stock; ex.status=row.status||'';"
);

// 4. renderCardでステータスバッジを表示
// item.priceの右にステータスバッジを追加
app = app.replace(
  `    + (item.price?'<span class="rprice">¥'+Number(item.price).toLocaleString()+'</span>':'')`,
  `    + (item.price?'<span class="rprice">¥'+Number(item.price).toLocaleString()+'</span>':'')
    + (item.stock >= 1 ? '' : (item.status === '1' ? '<span class="rbadge rbadge-private">🔒 非公開保存</span>' : '<span class="rbadge rbadge-sold">📦 売り切れ</span>'))`
);

fs.writeFileSync('app.js', app, 'utf8');
console.log('app.js updated');

// 5. style.cssにバッジのスタイル追加
let css = fs.readFileSync('style.css', 'utf8');
if (!css.includes('rbadge')) {
  css += `
/* ステータスバッジ */
.rbadge {
  display:inline-block;
  padding:2px 8px;
  border-radius:4px;
  font-size:0.72rem;
  font-weight:700;
  margin-left:8px;
  vertical-align:middle;
}
.rbadge-private {
  background:rgba(139,92,246,0.2);
  color:#a78bfa;
  border:1px solid rgba(139,92,246,0.4);
}
.rbadge-sold {
  background:rgba(239,68,68,0.15);
  color:#f87171;
  border:1px solid rgba(239,68,68,0.3);
}
`;
  fs.writeFileSync('style.css', css, 'utf8');
  console.log('style.css updated');
}

// 6. バージョンアップ
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=18', 'v=19');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Done v19');
