const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const oldLine = "  // ラクマはタイトル最大40文字のため、タイトル検索は先頭40文字に切り詰める\n  var qtRakuma = encodeURIComponent((title || '').slice(0, 40));";

const newLine = "  // ラクマはタイトル最大40文字のため、スペース区切りでキリよく切り詰める\n  var _rt = (title || '').length > 40 ? (title||'').slice(0,40) : (title||'');\n  var _sp = _rt.lastIndexOf(' ');\n  var qtRakuma = encodeURIComponent(_sp > 0 ? _rt.slice(0, _sp) : _rt);";

if (app.includes(oldLine)) {
  app = app.replace(oldLine, newLine);
  console.log('OK');
} else {
  console.log('Not found');
}

fs.writeFileSync('app.js', app, 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('v=20', 'v=21');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Done v21');
