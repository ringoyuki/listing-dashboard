/* Update notice only: never reload automatically or modify work data. */
(()=>{'use strict';
const loaded=document.currentScript.dataset.release;
const params=new URL(location.href).searchParams;
const scope=location.pathname+'|'+(params.get('worker')||'')+'|'+(params.get('owner')||'');
const key='ry_update_notice:'+scope,pending=key+':pending';
function read(k){try{return localStorage.getItem(k);}catch{return null;}}
function write(k,v){try{localStorage.setItem(k,v);}catch{}}
let banner;
function show(version){
 if(!version||read(key)===version)return;
 write(pending,version);
 if(banner)return;
 banner=document.createElement('div');banner.id='tool-update-notice';banner.setAttribute('role','status');
 banner.style.cssText='position:relative;z-index:1000;background:#fff1b8;color:#422006;padding:10px 16px;font:600 15px/1.6 system-ui;border-bottom:2px solid #eab308;box-sizing:border-box;width:100%';
 const work=location.pathname.endsWith('/single-work.html');
 banner.textContent=work?'ツールが更新されました。先に「作業終了」から結果JSONを保存し、ファイルを確認してから再読み込みしてください。':'ツールが更新されました。作業中のデータを保存してから、再読み込みしてください。';
 document.body.prepend(banner);
}
async function start(){
 await(window.OwnerEntryReady||Promise.resolve());
 if(performance.getEntriesByType('navigation')[0]?.type==='reload'&&read(pending)===loaded){write(key,loaded);try{localStorage.removeItem(pending);}catch{}}
 show(loaded);
 let checking=false,last=0;
 async function check(){if(document.hidden||checking||Date.now()-last<60000)return;checking=true;last=Date.now();try{const r=await fetch('tool-release.json',{cache:'no-store'});if(r.ok){const v=(await r.json()).version;if(typeof v==='string'&&v!==loaded)show(v);}}catch{}finally{checking=false;}}
 setInterval(check,60000);document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);check();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
