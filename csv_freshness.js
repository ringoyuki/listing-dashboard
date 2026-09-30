(function(root){'use strict';
const key='csv_freshness_v1';
function today(now=Date.now()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
function sourceDay(name){const m=String(name||'').match(/product_data_(\d{4}-\d{2}-\d{2})(?=[^0-9]|$)/);return m?m[1]:'';}
function baseName(name){return String(name||'').trim().replace(/\s*\(\d+\)(?=\.csv$)/i,'').toLowerCase();}
function reason(name,previousName){if(!String(name||'').trim())return 'CSVファイル名が不明です。元の名前のCSVを選択してください';if(baseName(name)===baseName(previousName))return '前回と同じCSVです（'+name+'）。(1)・(2)は再ダウンロードの連番です。新しい名前のCSVを選択してください';return '';}
const api={today,sourceDay,baseName,reason};if(typeof module!=='undefined')module.exports=api;
if(!root.document)return;
let pending=null,sequence=0;
function stored(){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch(e){return {};}}
root.CsvFreshness=api;
const parse=root.parseCsv,run=root.runImport;
root.parseCsv=async function(text){const mine=++sequence,name=root._csvFileName||'';pending=null;root.pendingRows=[];const button=document.getElementById('btn-import');if(button)button.style.display='none';try{
 const normalized=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));const hash=Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(mine!==sequence)return false;const why=reason(name,localStorage.getItem('csv_filename'));if(why)throw Error(why);
 parse(text);if(!root.pendingRows?.length)throw Error('商品CSVとして読み取れません');pending={hash,sourceDay:sourceDay(name),fileName:name,rows:JSON.stringify(root.pendingRows)};return true;
 }catch(e){root.pendingRows=[];const area=document.getElementById('prev-area');if(area)area.textContent='取込停止：'+e.message;showToast('CSV取込停止：'+e.message,7000);return false;}};
root.runImport=function(){if(!pending||pending.rows!==JSON.stringify(root.pendingRows)){showToast('CSVを選び直してください。未確認のデータは取り込めません。',6000);return false;}const why=reason(pending.fileName,localStorage.getItem('csv_filename'));if(why){showToast(why,6000);return false;}const receipt={hash:pending.hash,sourceDay:pending.sourceDay,fileName:pending.fileName,importedAt:new Date().toISOString()};const s=stored();run();const history=(s.history||[]).filter(x=>x.hash!==receipt.hash);history.push({hash:receipt.hash,sourceDay:receipt.sourceDay});localStorage.setItem(key,JSON.stringify({receipt,history:history.slice(-60)}));pending=null;return true;};
})(typeof window!=='undefined'?window:this);
