/* Emergency switch: new sales stop; cleanup remains available. */
(function(){
 'use strict';const c=window.OPERATIONS_CONFIG;
 if(!c)return;
 const disabled=()=>window.OPERATIONS_CONFIG.salesEnabled!==true;
 for(const name of ['smAfterSale','smExecMercariComment']){
  const old=window[name];if(typeof old!=='function')continue;
  window[name]=function(){if(disabled()){alert('新しいセールはOFFです。記号・価格変更はA・B作業画面を使用してください。終了・取消確認は引き続き必要です。');return;}return old.apply(this,arguments);};
 }
 for(const name of ['smOnLikes','smDoChange','smManualChange','smBatchCopyTasks']){
  const old=window[name];if(typeof old!=='function')continue;
  window[name]=function(){if(disabled()){alert('現在は緊急運用です。重複作業を防ぐため、担当別のA・B作業画面で記号・価格変更と記録を行ってください。');return;}return old.apply(this,arguments);};
 }
 const oldComplete=window.smCompleteTask;
 if(typeof oldComplete==='function')window.smCompleteTask=function(code,id){const t=(smGetItem(code).tasks||[]).find(t=>t.id===id);if(disabled()&&(!t||t.type!=='revert_check')){alert('緊急運用の変更結果はA・B作業画面で記録し、管理元で統合します。');return;}return oldComplete.apply(this,arguments);};
 const bar=document.createElement('div');bar.style.cssText='padding:12px;background:#263549;color:#fff;text-align:center;position:relative;z-index:100';
 const text=document.createElement('span');text.textContent='新しいセール：'+(disabled()?'OFF':'ON')+' ／ 分担：'+(c.splitEnabled?'ON':'OFF')+'　';bar.appendChild(text);
 const link=document.createElement('a');link.href='emergency.html';link.textContent='A・B作業画面／オーナー運用設定';link.style.color='#b6daff';bar.appendChild(link);document.body.prepend(bar);
})();
