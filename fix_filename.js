const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// ファイル名をグローバル変数で保持し、runImportで表示を更新
const oldFileHandler = `  var fi=document.getElementById('csvfile');
  if(fi) fi.addEventListener('change',function(e){
    var f=e.target.files[0]; if(!f)return;
    var reader=new FileReader();
    reader.onload=function(ev){ parseCsv(ev.target.result); };
    reader.readAsText(f,'Shift_JIS');
  });`;

const newFileHandler = `  var fi=document.getElementById('csvfile');
  if(fi) fi.addEventListener('change',function(e){
    var f=e.target.files[0]; if(!f)return;
    window._csvFileName = f.name; // ファイル名を保存
    var reader=new FileReader();
    reader.onload=function(ev){ parseCsv(ev.target.result); };
    reader.readAsText(f,'Shift_JIS');
  });`;

if (app.includes(oldFileHandler)) {
  app = app.replace(oldFileHandler, newFileHandler);
  console.log('file handler updated OK');
} else {
  console.log('file handler not found');
}

// runImport でファイル名をヘッダーに表示 + localStorage 保存
const oldRunImportEnd = `  localStorage.setItem('last_seed','manual');
  save(); updateStats(); closeCsvModal();`;

const newRunImportEnd = `  // ファイル名をヘッダーに表示・保存
  if (window._csvFileName) {
    var si = document.getElementById('seed-info');
    if (si) si.textContent = '📄 ' + window._csvFileName;
    localStorage.setItem('csv_filename', window._csvFileName);
  }
  localStorage.setItem('last_seed','manual');
  save(); updateStats(); closeCsvModal();`;

if (app.includes(oldRunImportEnd)) {
  app = app.replace(oldRunImportEnd, newRunImportEnd);
  console.log('runImport filename save OK');
} else {
  console.log('runImport end not found');
}

// initApp でファイル名を復元
const oldInitRestore = `  // 更新日時を復元
  var ua = document.getElementById('csv-updated-at');
  if (ua) {
    var saved = localStorage.getItem('csv_updated_at');
    if (saved) ua.textContent = saved;
  }`;

const newInitRestore = `  // ファイル名を復元
  var si = document.getElementById('seed-info');
  var savedFn = localStorage.getItem('csv_filename');
  if (si && savedFn) si.textContent = '📄 ' + savedFn;
  // 更新日時を復元
  var ua = document.getElementById('csv-updated-at');
  if (ua) {
    var saved = localStorage.getItem('csv_updated_at');
    if (saved) ua.textContent = saved;
  }`;

if (app.includes(oldInitRestore)) {
  app = app.replace(oldInitRestore, newInitRestore);
  console.log('initApp restore filename OK');
} else {
  console.log('initApp restore not found');
}

fs.writeFileSync('app.js', app, 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=25', 'v=26');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Done v26');
