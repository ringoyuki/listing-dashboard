(function(){'use strict';
const SHARED_URL='https://script.google.com/macros/s/AKfycbxPw9zY7aUbIqYzsBKYu33DStEC6Hw9Jwd_k8bAFcv9Pq7Yv3DXzPcvCDCeYhRabFVFHw/exec';
const oldOpen=window.openDailyWork;
function el(tag,text,parent){const n=document.createElement(tag);if(text)n.textContent=text;if(parent)parent.appendChild(n);return n;}
window.openDailyWork=function(){
 document.getElementById('shared-work-entry')?.remove();
 const p=el('section',null,document.body);p.id='shared-work-entry';p.style.cssText='position:fixed;inset:0;z-index:10020;background:#101722;color:#eef2f7;padding:32px;overflow:auto;font:17px/1.8 system-ui';
 el('h2','商品管理｜毎日の共有作業',p);const close=el('button','閉じる',p);close.onclick=()=>p.remove();
 el('p','同じGoogleアカウントで開き、表示された作業を実施して「完了」。結果は自動で共有保存されます。毎日のファイル受け渡しは不要です。',p);
 let oldPending=0,failed=false;
 try{const all=typeof smGetAll==='function'?smGetAll():{};for(const sd of Object.values(all)){oldPending+=(sd.tasks||[]).filter(t=>t.type==='revert_check'&&t.status==='pending').length;if(sd.trial20261004&&!sd.trial20261004.legacyReleased)oldPending++;}}
 catch(e){failed=true;}
 if(oldPending||failed){el('p',failed?'旧記録を読み取れません。上書きせずオーナーに報告してください。':'このブラウザーに旧セールの終了待ちが'+oldPending+'件あります。先に終了処理を確認してください。',p);}
 else{const a=el('a','毎日の共有作業を開く ↗',p);a.href=SHARED_URL;a.target='_blank';a.rel='noopener noreferrer';a.style.cssText='display:inline-block;padding:16px 24px;background:#16788d;color:white;border-radius:10px;font-weight:bold';}
 el('p','初回は登録したGoogleアカウントでログインしてください。開始・照合待ちの商品は変更しません。メルカリShopsはオーナーが担当します。',p);
 const d=el('details',null,p);el('summary','従来の記録・旧セールの終了作業',d);el('p','過去の記録はこのブラウザーに保持しています。新しい共有画面へ自動移行したという意味ではありません。旧記録を消さないでください。',d);
 const b=el('button','従来の記録を開く',d);b.onclick=()=>{p.remove();if(oldOpen)oldOpen();};
};
window.openSaleModal=window.openDailyWork;
})();
