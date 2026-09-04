const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');

// 1. checkAuth にログイン記録を追加
const oldCheckAuth = `function checkAuth() {
  var raw = document.getElementById('inp-pass').value;
  var val = toHalfWidth(raw).trim();
  if(val === PASS) {
    localStorage.setItem('auth_ok', 'true');
    initApp();
  } else {
    document.getElementById('login-err').textContent = 'パスワードが違います';
  }
}`;

const newCheckAuth = `function checkAuth() {
  var raw = document.getElementById('inp-pass').value;
  var val = toHalfWidth(raw).trim();
  if(val === PASS) {
    localStorage.setItem('auth_ok', 'true');
    recordLogin(true); // ← ログイン記録
    initApp();
  } else {
    document.getElementById('login-err').textContent = 'パスワードが違います';
    recordLogin(false); // ← 失敗も記録
  }
}

// ===== ログイン履歴記録 =====
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
}

function showLoginLog() {
  var log = JSON.parse(localStorage.getItem('login_log') || '[]');
  var modal = document.getElementById('login-log-modal');
  var body = document.getElementById('login-log-body');
  if (!log.length) {
    body.innerHTML = '<p style="color:var(--tx2);padding:16px;">まだ履歴がありません</p>';
  } else {
    body.innerHTML = log.map(function(l) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">'
        + '<span style="font-size:0.8rem;color:var(--tx2);white-space:nowrap;">' + l.ts + '</span>'
        + '<span>' + l.device + '</span>'
        + '<span style="font-size:0.8rem;color:var(--tx2);">' + l.browser + '</span>'
        + (l.ok
          ? '<span style="margin-left:auto;font-size:0.75rem;color:#4ade80;font-weight:700;">✅ 成功</span>'
          : '<span style="margin-left:auto;font-size:0.75rem;color:#f87171;font-weight:700;">❌ 失敗</span>')
        + '</div>';
    }).join('');
  }
  modal.classList.add('open');
}
function closeLoginLog() {
  document.getElementById('login-log-modal').classList.remove('open');
}`;

if (app.includes(oldCheckAuth)) {
  app = app.replace(oldCheckAuth, newCheckAuth);
  console.log('checkAuth updated OK');
} else {
  console.log('checkAuth not found');
}

fs.writeFileSync('app.js', app, 'utf8');

// 2. index.html にログイン履歴ボタンとモーダルを追加
// ヘッダーにボタン追加
html = html.replace(
  '<button class="btn-csv" onclick="openCsvModal()">',
  '<button class="btn-log" onclick="showLoginLog()" title="ログイン履歴" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:var(--tx1,#f1f5f9);border-radius:8px;padding:6px 12px;font-size:0.8rem;cursor:pointer;margin-right:8px;">🔒 ログイン履歴</button><button class="btn-csv" onclick="openCsvModal()">'
);

// モーダルをbody末尾付近に追加（toast の前に挿入）
html = html.replace(
  '<div class="toast" id="toast"></div>',
  `<div class="toast" id="toast"></div>
  <!-- ログイン履歴モーダル -->
  <div class="backdrop" id="login-log-modal" onclick="if(event.target.id==='login-log-modal')closeLoginLog()">
    <div class="modal" style="max-width:520px;">
      <div class="mhead">
        <div><h2>🔒 ログイン履歴</h2><p class="msub">最新30件のログインを記録しています</p></div>
        <button class="mclose" onclick="closeLoginLog()">×</button>
      </div>
      <div class="mbody" style="padding:0;">
        <div id="login-log-body" style="max-height:400px;overflow-y:auto;"></div>
      </div>
    </div>
  </div>`
);

// バージョンアップ
html = html.replace('v=22', 'v=23');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Done v23');
