const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');

// 1. app.js にlogout関数を追加
const oldCheckAuth = `// ===== ログイン履歴記録 =====`;
const newCheckAuth = `// ===== ログアウト =====
function logout() {
  localStorage.removeItem('auth_ok');
  localStorage.removeItem('auth_time');
  location.reload();
}

// ===== ログイン履歴記録 =====`;

app = app.replace(oldCheckAuth, newCheckAuth);

fs.writeFileSync('app.js', app, 'utf8');

// 2. index.html にログアウトボタンを追加（🔒ログイン履歴ボタンの隣）
html = html.replace(
  '<button class="btn-log" onclick="showLoginLog()"',
  '<button class="btn-logout" onclick="logout()" title="ログアウト" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;border-radius:8px;padding:6px 12px;font-size:0.8rem;cursor:pointer;margin-right:8px;">🚪 ログアウト</button><button class="btn-log" onclick="showLoginLog()"'
);

// 3. バージョンアップ
html = html.replace('v=26', 'v=27');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Done v27');
