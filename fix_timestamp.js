const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');

// 1. index.html の seed-info の後に csv-updated-at を追加
html = html.replace(
  '<span class="spill seed" id="seed-info"></span>',
  '<span class="spill seed" id="seed-info"></span><span class="spill" id="csv-updated-at" style="font-size:0.72rem;color:var(--tx2,#94a3b8);margin-left:4px;"></span>'
);

// 2. v=21 → v=22
html = html.replace('v=21', 'v=22');
fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html updated');

// 3. app.js の runImport に更新日時を保存・表示する処理を追加
const oldClose = `  localStorage.setItem('last_seed','manual');
  save(); updateStats(); closeCsvModal();
  showToast(`;

const newClose = `  // 更新日時を保存して表示
  var now = new Date();
  var ymd = now.getFullYear() + '/' + ('0'+(now.getMonth()+1)).slice(-2) + '/' + ('0'+now.getDate()).slice(-2);
  var hm  = ('0'+now.getHours()).slice(-2) + ':' + ('0'+now.getMinutes()).slice(-2);
  var updatedStr = ymd + ' ' + hm + ' 更新';
  localStorage.setItem('csv_updated_at', updatedStr);
  var ua = document.getElementById('csv-updated-at');
  if (ua) ua.textContent = updatedStr;
  localStorage.setItem('last_seed','manual');
  save(); updateStats(); closeCsvModal();
  showToast(`;

if (app.includes(oldClose)) {
  app = app.replace(oldClose, newClose);
  console.log('runImport timestamp OK');
} else {
  console.log('runImport string not found');
}

// 4. initApp / ページ読み込み時に保存済みの更新日時を復元して表示
const oldInitApp = `function initApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-main').style.display = 'block';
  // データロードなど
  load();`;

const newInitApp = `function initApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-main').style.display = 'block';
  // 更新日時を復元
  var ua = document.getElementById('csv-updated-at');
  if (ua) {
    var saved = localStorage.getItem('csv_updated_at');
    if (saved) ua.textContent = saved;
  }
  // データロードなど
  load();`;

if (app.includes(oldInitApp)) {
  app = app.replace(oldInitApp, newInitApp);
  console.log('initApp restore OK');
} else {
  console.log('initApp string not found');
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Done v22');
