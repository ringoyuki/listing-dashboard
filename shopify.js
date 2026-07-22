// ===== Shopify CSV生成 =====
// Shops CSV -> Shopify インポートCSV 変換ロジック
// 案A: 画像なし（Shopify管理画面で手動追加）
// 案B: upload_images.py で生成した shopify_image_map.json を読み込むと画像URL自動挿入

(function () {
  'use strict';

  // Shops CSV 列インデックス (0始まり)
  var SCOL = { ID: 0, NAME: 62, DESC: 63, STOCK: 67, CODE: 70, PRICE: 155, STATUS: 163 };

  // 案B用: 商品ID → 画像URL配列 のマップ（upload_images.py で生成したJSONをロード）
  // localStorage キー: 'shopify_image_map'
  var IMAGE_MAP_KEY = 'shopify_image_map';
  function getImageMap() {
    try { return JSON.parse(localStorage.getItem(IMAGE_MAP_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function getImagesForProduct(productId) {
    var map = getImageMap();
    return map[productId] || [];
  }

  // #yukiタグ → タイプ マッピング
  var TAG_MAP = [
    { tag: '#yukiアクセサリー',       type: 'アクセサリー' },
    { tag: '#yuki時計',               type: '時計' },
    { tag: '#yukiアンティーク食器',   type: '食器' },
    { tag: '#yukiフィギュリン',       type: 'フィギュリン' },
    { tag: '#yukiヴィンテージ眼鏡',   type: '眼鏡' },
    { tag: '#yukiアンティーク雑貨',   type: '雑貨' }
  ];

  // タイトルキーワード → タイプ マッピング
  var KW_MAP = [
    { words: ['カップ','ソーサー','プレート','カトラリー','ディナー','ティーカップ','スプーン','フォーク','ナイフ'], type: '食器' },
    { words: ['フィギュリン','置物','人形'], type: 'フィギュリン' },
    { words: ['リング','ネックレス','ブレスレット','ピアス','イヤリング'], type: 'アクセサリー' }
  ];

  // タイプ別重量 (g)
  var WEIGHT_MAP = {
    'アクセサリー': 10,
    '時計':         100,
    '食器':         500,
    'フィギュリン': 500,
    '眼鏡':         30,
    '雑貨':         100
  };

  // 全商品共通フッター
  var FOOTER =
    '※海外発送の場合、関税・輸入手数料等はお客様のご負担となります。あらかじめご了承ください。\n' +
    '※食器・フィギュア等の重量物は、配送料が別途加算される場合がございます。';

  // Shopify CSV ヘッダー (57列)
  var HEADERS = [
    'Title','URL handle','Description','Vendor','Product category','Type','Tags',
    'Published on online store','Status','SKU','Barcode',
    'Option1 name','Option1 value','Option1 Linked To',
    'Option2 name','Option2 value','Option2 Linked To',
    'Option3 name','Option3 value','Option3 Linked To',
    'Price','Compare-at price','Cost per item','Charge tax','Tax code',
    'Unit price total measure','Unit price total measure unit',
    'Unit price base measure','Unit price base measure unit',
    'Inventory tracker','Inventory quantity','Continue selling when out of stock',
    'Weight value (grams)','Weight unit for display','Requires shipping','Fulfillment service',
    'Product image URL','Image position','Image alt text','Variant image URL',
    'Gift card','SEO title','SEO description',
    'Color (product.metafields.shopify.color-pattern)',
    'Google Shopping / Google product category','Google Shopping / Gender',
    'Google Shopping / Age group','Google Shopping / Manufacturer part number (MPN)',
    'Google Shopping / Ad group name','Google Shopping / Ads labels',
    'Google Shopping / Condition','Google Shopping / Custom product',
    'Google Shopping / Custom label 0','Google Shopping / Custom label 1',
    'Google Shopping / Custom label 2','Google Shopping / Custom label 3',
    'Google Shopping / Custom label 4'
  ];

  // ---- ロジック関数 ----

  function detectType(desc, title) {
    for (var i = 0; i < TAG_MAP.length; i++)
      if ((desc || '').indexOf(TAG_MAP[i].tag) !== -1) return TAG_MAP[i].type;
    for (var j = 0; j < KW_MAP.length; j++)
      for (var k = 0; k < KW_MAP[j].words.length; k++)
        if ((title || '').indexOf(KW_MAP[j].words[k]) !== -1) return KW_MAP[j].type;
    return '雑貨';
  }

  function cleanDesc(desc, type) {
    if (!desc) return FOOTER;
    // ブロック削除: 【見出し】から次の【...】まで
    desc = desc.replace(/【安心保証[^】]*】[\s\S]*?(?=【|$)/g, '');
    desc = desc.replace(/【価格・割引について[^】]*】[\s\S]*?(?=【|$)/g, '');
    if (type === '眼鏡')
      desc = desc.replace(/【追加オプション[^】]*】[\s\S]*?(?=【|$)/g, '');
    // 行単位削除
    var lines = desc.split('\n').filter(function (l) {
      return l.indexOf('全額返金') === -1 && l.indexOf('すり替え防止') === -1;
    });
    desc = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return desc ? (desc + '\n\n' + FOOTER) : FOOTER;
  }

  function makeHandle(code, itemId, used) {
    var base = ((code || itemId || '').toLowerCase()).replace(/[^a-z0-9_-]/g, '-') || 'product';
    var h = base, n = 2;
    while (used[h]) { h = base + '-' + n; n++; }
    used[h] = true;
    return h;
  }

  function csvEsc(v) {
    v = (v || '').toString();
    return (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1)
      ? '"' + v.replace(/"/g, '""') + '"'
      : v;
  }

  function parseShopsCsv(text) {
    var rows = [], r = [], c = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '"') {
        if (inQ && text[i + 1] === '"') { c += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        r.push(c); c = '';
      } else if ((ch === '\n' || ch === '\r') && !inQ) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        r.push(c); rows.push(r); r = []; c = '';
      } else {
        c += ch;
      }
    }
    if (c !== '' || r.length > 0) { r.push(c); rows.push(r); }
    return rows;
  }

  function convert(csvText) {
    var rows = parseShopsCsv(csvText);
    if (rows.length < 2) return null;
    var out = [HEADERS], used = {}, count = 0;

    for (var i = 1; i < rows.length; i++) {
      var cols = rows[i];
      if (cols.length < 71) continue;

      var stock = parseInt((cols[SCOL.STOCK] || '').trim()) || 0;
      if (stock <= 0) continue;

      var title = (cols[SCOL.NAME] || '').trim();
      var price = (cols[SCOL.PRICE] || '').trim();
      if (!title || !price) continue;

      var itemId = (cols[SCOL.ID] || '').trim();
      var code   = (cols[SCOL.CODE] || '').trim();
      var desc   = cols.length > SCOL.DESC ? (cols[SCOL.DESC] || '').trim() : '';

      var type   = detectType(desc, title);
      var cd     = cleanDesc(desc, type);
      var handle = makeHandle(code, itemId, used);
      var weight = WEIGHT_MAP[type] || 50;
      var tags   = 'RINGO YUKI, ヴィンテージ, ' + type;

      // 画像URL取得
      // 案A: 画像Mapが空なら 画像なし
      // 案B: upload_images.py で生成したJSONを読み込んだ場合、画像URL自動挿入
      var imgs = getImagesForProduct(itemId);

      // メイン行
      var row = new Array(HEADERS.length).fill('');
      row[0]  = title;           // Title
      row[1]  = handle;          // URL handle
      row[2]  = cd;              // Description
      row[3]  = 'RINGO YUKI';   // Vendor
      row[5]  = type;            // Type
      row[6]  = tags;            // Tags
      row[7]  = 'FALSE';         // Published on online store
      row[8]  = 'draft';         // Status
      row[9]  = code || itemId;  // SKU
      row[20] = price;           // Price
      row[23] = 'TRUE';          // Charge tax
      row[29] = 'shopify';       // Inventory tracker
      row[30] = '1';             // Inventory quantity
      row[31] = 'DENY';          // Continue selling when out of stock
      row[32] = String(weight);  // Weight value (grams)
      row[33] = 'g';             // Weight unit for display
      row[34] = 'TRUE';          // Requires shipping
      row[35] = 'manual';        // Fulfillment service
      if (imgs.length > 0) {
        row[36] = imgs[0];       // Product image URL (1枚目)
        row[37] = '1';           // Image position
      }
      out.push(row);
      count++;

      // 2枚目以降の画像行
      for (var n = 1; n < imgs.length; n++) {
        var ir = new Array(HEADERS.length).fill('');
        ir[1]  = handle;         // URL handle (同じ商品)
        ir[36] = imgs[n];        // Product image URL
        ir[37] = String(n + 1);  // Image position
        out.push(ir);
      }
    }
    return { rows: out, count: count };
  }

  function buildCsvStr(rows) {
    return '\uFEFF' + rows.map(function (r) { return r.map(csvEsc).join(','); }).join('\n');
  }

  function dl(str, fname) {
    var blob = new Blob([str], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ---- UI ----

  window.openShopifyModal = function () {
    document.getElementById('shopify-modal').classList.add('open');
    document.getElementById('shopify-status').innerHTML = '';
    document.getElementById('shopify-file').value = '';
    // 画像Mapの読み込み状態を表示
    var map = getImageMap();
    var mapCount = Object.keys(map).length;
    var imgInfo = document.getElementById('shopify-img-info');
    if (imgInfo) {
      imgInfo.textContent = mapCount > 0
        ? '🖼️ 画像Map読み込み済み: ' + mapCount + '商品分'
        : '🗒️ 画像なし（案Aモード）';
    }
  };

  window.closeShopifyModal = function () {
    document.getElementById('shopify-modal').classList.remove('open');
  };

  // 案B用: 画像JSON読み込み
  window.loadImageMap = function () {
    document.getElementById('shopify-map-file').click();
  };

  document.addEventListener('DOMContentLoaded', function () {
    // 画像JSON読み込み (shopify_image_map.json)
    var mapFile = document.getElementById('shopify-map-file');
    if (mapFile) {
      mapFile.addEventListener('change', function (e) {
        var f = e.target.files[0]; if (!f) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          try {
            var data = JSON.parse(ev.target.result);
            localStorage.setItem(IMAGE_MAP_KEY, JSON.stringify(data));
            var count = Object.keys(data).length;
            var imgInfo = document.getElementById('shopify-img-info');
            if (imgInfo) imgInfo.textContent = '🖼️ 画像Map読み込み済み: ' + count + '商品分';
            var st = document.getElementById('shopify-status');
            if (st) st.innerHTML = '<span style="color:#4ade80">✅ 画像Mapを読み込みました（' + count + '商品分）</span>';
          } catch (err) {
            var st = document.getElementById('shopify-status');
            if (st) st.innerHTML = '<span style="color:#f87171">❌ JSONの読み込み失敗: ' + err.message + '</span>';
          }
        };
        reader.readAsText(f, 'UTF-8');
      });
    }

    // Shops CSV -> Shopify CSV 変換
    var fi = document.getElementById('shopify-file');
    if (!fi) return;
    fi.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var st = document.getElementById('shopify-status');
      var map = getImageMap();
      var hasImages = Object.keys(map).length > 0;
      st.innerHTML = '<span style="color:#a78bfa">📂 読み込み・変換中（' + (hasImages ? '画像URL含む' : '画像URLなし') + '）...</span>';
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var result = convert(ev.target.result);
          if (!result || result.count === 0) {
            st.innerHTML = '<span style="color:#f87171">❌ 対象商品が見つかりませんでした（在庫ありの商品がありません）</span>';
            return;
          }
          var csvStr = buildCsvStr(result.rows);
          var now = new Date();
          var ds = now.getFullYear() + '-' +
            ('0' + (now.getMonth() + 1)).slice(-2) + '-' +
            ('0' + now.getDate()).slice(-2);
          dl(csvStr, 'shopify_import_' + ds + '.csv');
          st.innerHTML = '<span style="color:#4ade80">✅ ' + result.count + '商品のShopify CSVをダウンロードしました！</span>';
        } catch (err) {
          st.innerHTML = '<span style="color:#f87171">❌ エラー: ' + err.message + '</span>';
        }
      };
      reader.readAsText(f, 'Shift_JIS');
    });
  });

})();
