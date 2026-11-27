
/* Extension package notice: explicit download and explicit user acknowledgement. */
(()=>{
'use strict';
let banner,version;
const key='ry132_extension_update_done';
async function check(){
 if(document.hidden)return;
 try{
  const response=await fetch('extension-release.json',{cache:'no-store'});
  if(!response.ok)return;
  const release=await response.json();
  if(!/^\d+\.\d+\.\d+$/.test(release.version)||!release.base64||!release.sha256)return;
  if(localStorage.getItem(key)===release.version){banner?.remove();banner=null;return;}
  if(banner&&version===release.version)return;
  banner?.remove();version=release.version;
  banner=document.createElement('div');banner.id='extension-update-notice';banner.setAttribute('role','status');
  banner.style.cssText='position:sticky;top:0;z-index:1001;background:#fff1b8;color:#422006;padding:12px 16px;font:600 15px/1.7 system-ui;border-bottom:2px solid #eab308';
  const title=document.createElement('strong');title.textContent='拡張機能を更新しました（'+version+'）';
  const note=document.createElement('div');note.textContent='タイムセール中はセール前価格をコピーします。ZIPを展開 → 今使っている拡張フォルダーへ上書き → Chromeの拡張機能を再読み込み → 商品ページを再読み込み。';
  const download=document.createElement('button');download.textContent='最新版ZIPをダウンロード';download.style.cssText='margin:8px 12px 0 0;padding:8px 14px;background:#176e83;color:white;border:0;border-radius:6px;cursor:pointer';
  const done=document.createElement('button');done.textContent='更新済み';done.style.cssText='padding:8px 14px;cursor:pointer';
  download.onclick=async()=>{
   download.disabled=true;
   try{
    const bytes=Uint8Array.from(atob(release.base64),c=>c.charCodeAt(0));
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==release.sha256)throw Error('ファイルの確認に失敗しました。再読み込みしてください。');
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=release.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    download.textContent='再ダウンロード';
   }catch(e){note.textContent=e.message;}finally{download.disabled=false;}
  };
  done.onclick=()=>{localStorage.setItem(key,release.version);banner.remove();banner=null;};
  banner.append(title,note,download,done);document.body.prepend(banner);
 }catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
setInterval(check,60000);
})();
