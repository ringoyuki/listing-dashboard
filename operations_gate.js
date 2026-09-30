/* Emergency switch: new sales stop; cleanup remains available. */
(function(){
 'use strict';const c=window.OPERATIONS_CONFIG;
 if(!c)return;
 const disabled=()=>window.OPERATIONS_CONFIG.salesEnabled!==true;
 for(const name of ['smAfterSale','smExecMercariComment']){
  const old=window[name];if(typeof old!=='function')continue;
  window[name]=function(){if(disabled()){alert('自動のセール提案は停止中です。商品管理の毎日の作業から進めてください。');return;}return old.apply(this,arguments);};
 }
 for(const name of ['smOnLikes','smDoChange','smManualChange','smBatchCopyTasks']){
  const old=window[name];if(typeof old!=='function')continue;
  window[name]=function(){if(disabled()){alert('日数だけで記号・価格を変更しません。商品管理の承認済み指示を使用してください。');return;}return old.apply(this,arguments);};
 }
 const oldComplete=window.smCompleteTask;
 if(typeof oldComplete==='function')window.smCompleteTask=function(code,id){const t=(smGetItem(code).tasks||[]).find(t=>t.id===id);if(disabled()&&(!t||t.type!=='revert_check')){alert('商品管理の毎日の作業で記録してください。');return;}return oldComplete.apply(this,arguments);};
})();
