const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// ipapi.co の fetch を廃止して、直接 emailjs.send を呼ぶシンプルな実装に変更
const oldEmailPart = `  // Gmail通知（EmailJS + IP位置情報）
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
    });`;

const newEmailPart = `  // Gmail通知（EmailJS）
  var resultText = success ? '✅ ログイン成功' : '❌ パスワード失敗';
  if (typeof emailjs !== 'undefined') {
    emailjs.send('service_2dj253q', '2kjgd7s', {
      login_time: ts,
      device: device,
      browser: browser,
      location: '—',
      result: resultText
    }).then(function() {
      console.log('Login notification sent');
    }).catch(function(e) {
      console.warn('EmailJS error:', JSON.stringify(e));
    });
  } else {
    console.warn('EmailJS not loaded');
  }`;

if (app.includes(oldEmailPart)) {
  app = app.replace(oldEmailPart, newEmailPart);
  console.log('EmailJS simplified OK');
} else {
  console.log('Old email part not found - searching for alternative...');
  // 部分検索
  var idx = app.indexOf('ipapi.co');
  if (idx >= 0) {
    console.log('ipapi.co found at index:', idx);
    console.log('Context:', app.substring(idx-50, idx+100));
  }
}

fs.writeFileSync('app.js', app, 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=28', 'v=29');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Done v29');
