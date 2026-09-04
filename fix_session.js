const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');

// 1. 2日間(48時間)でセッション期限切れ
const oldDOMReady = `document.addEventListener('DOMContentLoaded', function(){
  if(localStorage.getItem('auth_ok') === 'true') {
    initApp();
  }
});`;

const newDOMReady = `document.addEventListener('DOMContentLoaded', function(){
  if(localStorage.getItem('auth_ok') === 'true') {
    // 2日(48時間)でセッション期限切れ
    var loginTime = parseInt(localStorage.getItem('auth_time') || '0');
    var elapsed = Date.now() - loginTime;
    var twoDays = 48 * 60 * 60 * 1000;
    if (elapsed > twoDays) {
      localStorage.removeItem('auth_ok');
      localStorage.removeItem('auth_time');
    } else {
      initApp();
    }
  }
});`;

if (app.includes(oldDOMReady)) {
  app = app.replace(oldDOMReady, newDOMReady);
  console.log('Session expiry OK');
} else {
  console.log('DOMReady not found');
}

// 2. ログイン成功時にauth_time保存
const oldAuthOk = `    localStorage.setItem('auth_ok', 'true');
    recordLogin(true); // ← ログイン記録`;

const newAuthOk = `    localStorage.setItem('auth_ok', 'true');
    localStorage.setItem('auth_time', Date.now().toString()); // 期限管理
    recordLogin(true); // ← ログイン記録`;

if (app.includes(oldAuthOk)) {
  app = app.replace(oldAuthOk, newAuthOk);
  console.log('auth_time save OK');
} else {
  console.log('auth_ok save not found');
}

fs.writeFileSync('app.js', app, 'utf8');

// 3. バージョンアップ
html = html.replace('v=23', 'v=24');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Done v24 (session expiry added)');
