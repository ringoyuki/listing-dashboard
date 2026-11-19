(function(){'use strict';
function el(tag,text,parent){const n=document.createElement(tag);n.textContent=text||'';if(parent)parent.appendChild(n);return n;}
window.openDailyWork=function(){document.getElementById('shared-work-entry')?.remove();const p=el('section','',document.body);p.id='shared-work-entry';p.style.cssText='position:fixed;inset:0;z-index:10020;background:#101722;color:#eef2f7;padding:32px;overflow:auto;font:17px/1.8 system-ui';el('h2','商品管理｜担当の作業画面を開く',p);el('button','閉じる',p).onclick=()=>p.remove();el('p','ご自身の担当を選び、同じ担当名のJSONを読み込んでください。',p);for(const role of ['A','B']){const a=el('a',role+'さんの作業 ↗',p);a.href='single-work.html?normal=1&worker='+role;a.target='_blank';a.rel='noopener noreferrer';a.style.cssText='display:inline-block;margin:12px;padding:16px 24px;background:#16788d;color:white;border-radius:10px;font-weight:bold';}};
window.openSaleModal=window.openDailyWork;
})();
