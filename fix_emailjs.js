const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');

// 1. index.html に EmailJS SDK を追加
html = html.replace(
  '</head>',
  '  <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>\n  <script>emailjs.init("v4_FoQtSLS1iANLLK");</script>\n</head>'
);

// 2. バージョンアップ
html = html.replace('v=24', 'v=25');
fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html updated');

// 3. recordLogin関数をEmailJS + 位置情報対応に更新
const oldRecordLogin = `// ===== ログイン履歴記録 =====
function recordLogin(success) {
  var now = new Date();
  var ts = now.getFullYear() + '/' +
    ('0'+(now.getMonth()+1)).slice(-2) + '/' +
    ('0'+now.getDate()).slice(-2) + ' ' +
    ('0'+now.getHours()).slice(-2) + ':' +
    ('0'+now.getMinutes()).slice(-2);
  var ua = navigator.userAgent;
  var device = /iPhone|iPad/.test(ua) ? '📱 iPhone/iPad'
    : /Android/.test(ua) ? '📱 Android'
    : /Windows/.test(ua) ? '💻 Windows'
    : /Mac/.test(ua) ? '💻 Mac'
    : '🖥 その他';
  var browser = /Chrome/.test(ua) && !/Edg/.test(ua) ? 'Chrome'
    : /Edg/.test(ua) ? 'Edge'
    : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari'
    : 'その他';
  var log = JSON.parse(localStorage.getItem('login_log') || '[]');
  log.unshift({ ts: ts, device: device, browser: browser, ok: success });
  if (log.length > 30) log = log.slice(0, 30); // 最新30件のみ保持
  localStorage.setItem('login_log', JSON.stringify(log));
}`;

const newRecordLogin = `// ===== ログイン履歴記録 =====
function recordLogin(success) {
  var now = new Date();
  var ts = now.getFullYear() + '/' +
    ('0'+(now.getMonth()+1)).slice(-2) + '/' +
    ('0'+now.getDate()).slice(-2) + ' ' +
    ('0'+now.getHours()).slice(-2) + ':' +
    ('0'+now.getMinutes()).slice(-2);
  var ua = navigator.userAgent;
  var device = /iPhone|iPad/.test(ua) ? '📱 iPhone/iPad'
    : /Android/.test(ua) ? '📱 Android'
    : /Windows/.test(ua) ? '💻 Windows'
    : /Mac/.test(ua) ? '💻 Mac'
    : '🖥 その他';
  var browser = /Chrome/.test(ua) && !/Edg/.test(ua) ? 'Chrome'
    : /Edg/.test(ua) ? 'Edge'
    : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari'
    : 'その他';
  var log = JSON.parse(localStorage.getItem('login_log') || '[]');
  log.unshift({ ts: ts, device: device, browser: browser, ok: success });
  if (log.length > 30) log = log.slice(0, 30);
  localStorage.setItem('login_log', JSON.stringify(log));

  // Gmail通知（EmailJS + IP位置情報）
  var resultText = success ? '✅ ログイン成功' : '❌ パスワード失敗';
  fetch('https://ipapi.co/json/')
    .then(function(r){ return r.json(); })
    .then(function(geo){
      var location = (geo.city || '') + ' ' + (geo.region || '') + ' ' + (geo.country_name || '');
      emailjs.send('service_2dj253q', '2kjgd7s', {
        login_time: ts,
        device: device,
        browser: browser,
        location: location.trim() || '不明',
        result: resultText
      }).catch(function(e){ console.warn('EmailJS error:', e); });
    })
    .catch(function(){
      // 位置情報取得失敗時も通知は送る
      emailjs.send('service_2dj253q', '2kjgd7s', {
        login_time: ts,
        device: device,
        browser: browser,
        location: '取得失敗',
        result: resultText
      }).catch(function(e){ console.warn('EmailJS error:', e); });
    });
}`;

if (app.includes(oldRecordLogin)) {
  app = app.replace(oldRecordLogin, newRecordLogin);
  console.log('recordLogin updated OK');
} else {
  console.log('recordLogin not found');
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Done v25');
