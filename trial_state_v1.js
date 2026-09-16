/* Pure transitions: all prices are absolute platform targets. */
(function(root){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const active=['ready','changed','posted','cancelling'];
  function price(n){if(!Number.isSafeInteger(n)||n<300)throw Error('販売価格を300円以上の整数で確認してください');return n;}
  function observe(row,data){
    if(row.phase!=='draft')throw Error('この販路は確認済みです');
    const r=copy(row);
    if(!['checked','unlisted','on_sale','sold'].includes(data.status))throw Error('出品状態を確認してください');
    r.status=data.status;
    if(data.status!=='checked'){
      r.phase=data.status==='on_sale'?'review':data.status;r.likes=null;return r;
    }
    if(!data.seen)throw Error('現在の実価格を確認してください');
    if(!Number.isSafeInteger(data.likes)||data.likes<0)throw Error('いいね数を確認してください');
    r.before=price(data.current);r.likes=data.likes;
    if(r.after===null||r.normal===null||r.before<r.after)r.phase='review';
    else if(r.before===r.after)r.phase='unchanged';
    else if(r.before>r.normal)r.phase='align';
    else if(r.before<r.normal)r.phase='review';
    else if(r.platform==='yahoo_flea')r.phase='hold';
    else if(r.likes<3)r.phase='hold';
    else r.phase='ready';
    return r;
  }
  function cancel(row){
    const r=copy(row);
    if(['closed','cancelled'].includes(r.phase))throw Error('既に終了しています');
    // Even a draft can have an external action the staff forgot to record.
    // Never silently mark cancellation complete.
    if(r.phase!=='cancelling')r.cancelFrom=r.phase;
    r.phase='cancelling';r.checks={};delete r.restoreVerified;
    return r;
  }
  function applyFreshness(row,freshness){
    const r=copy(row);
    if(freshness&&freshness.wait&&r.phase==='ready'){
      r.phase='hold';r.holdReason='recent_activity';r.readyOn=freshness.readyOn;
    }
    return r;
  }
  function verifyRestore(row,current){
    if(!active.includes(row.phase))throw Error('終了確認の対象ではありません');
    price(row.normal);price(current);
    // Current normal price may mean another worker has already restored it.
    if(current!==row.after&&current!==row.normal)throw Error('指定価格と異なります。別スタッフの変更をオーナーへ確認してください');
    const r=copy(row);r.restoreVerified={current,normal:r.normal,after:r.after};return r;
  }
  function finish(row,data){
    if(!active.includes(row.phase))throw Error('既に終了、または未実施です');
    if(!data.commentsRemoved||!data.reservationsCleared)throw Error('コメントとセール予約の後片付けを確認してください');
    if(!data.sold){
      if(!row.restoreVerified||row.restoreVerified.normal!==row.normal||row.restoreVerified.after!==row.after)throw Error('戻す前の実価格を確認してください');
      if(price(data.current)!==row.normal)throw Error('その販路の通常指定価格へ合わせてください');
    }
    const r=copy(row);r.phase=r.phase==='cancelling'?'cancelled':'closed';r.sold=!!data.sold;return r;
  }
  // Registration-only cancellation leaves the real page unchanged, after explicit confirmation.
  function cancelUnchanged(row,data){
    if(row.phase!=='cancelling'||['changed','posted'].includes(row.cancelFrom))throw Error('価格変更済みです。終了確認を行ってください');
    if(!data.noExternalChanges)throw Error('販売サイトで未作業であることを確認してください');
    const r=copy(row);r.phase='cancelled';return r;
  }
  function cancelLegacyTasks(tasks,today,reason){
    if(!Array.isArray(tasks))throw Error('タスクデータが不正です');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(today))throw Error('取消日が不正です');
    if(!['recent_activity','relisted_low_response','wrong_date','other'].includes(reason))throw Error('取消理由を選んでください');
    let changed=0;
    const result=copy(tasks).map(t=>{
      const x=copy(t);
      if(x.status==='pending'&&x.type==='revert_check'){
        x.status='cancelled';x.cancelledAt=today;x.cancelReason=reason;changed++;return x;
      }
      if(x.status==='done'&&x.type==='sale'&&x.dueDate>=today){
        x.status='cancelled';x.cancelledAt=today;x.cancelReason=reason;changed++;return x;
      }
      return x;
    });
    if(!changed)throw Error('取り消せるセール予約・終了確認がありません');
    return {tasks:result,changed};
  }
  const api={observe,applyFreshness,cancel,verifyRestore,finish,cancelUnchanged,cancelLegacyTasks};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TrialState=api;
})(typeof window!=='undefined'?window:this);
