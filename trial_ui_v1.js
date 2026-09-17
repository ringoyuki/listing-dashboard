/* Staff trial workflow. Only selling prices and observations are stored. */
(function () {
  'use strict';
  const R = window.TrialRules;
  const S = window.TrialState;
  const labels = {shops:'メルカリShops',mercari:'メルカリ',rakuma:'ラクマ',yahoo_flea:'Yahoo!フリマ'};
  let selected = '', panel;
  const today = () => smTodayStr();
  const activePeriod = () => today() >= '2026-09-16' && today() <= R.END;
  const get = code => smGetItem(code).trial20261004;
  const itemFor = code => items.find(i => i.code === code);
  const pending = t => t && t.rows && t.rows.some(r => ['ready','changed','posted','cancelling','review','align'].includes(r.phase));
  const clone = x => JSON.parse(JSON.stringify(x));
  const eligible = i => i && i.code && i.code !== 'CHECK' && Number(i.stock)>0 && String(i.status)==='2';
  const legacySaleActive = sd => !!(sd&&Array.isArray(sd.tasks)&&sd.tasks.some(t=>(t.type==='revert_check'&&t.status==='pending')||(t.type==='sale'&&t.status==='done'&&t.dueDate>=today())));
  function put(code,t) {
    if(typeof SM_KEY!=='undefined'){
      const all=JSON.parse(localStorage.getItem(SM_KEY)||'{}');
      if(!all||Array.isArray(all)||typeof all!=='object')throw Error('保存データの形式が不正です。上書きせずオーナーへ連絡してください');
    }
    const sd=smGetItem(code),current=sd.trial20261004;
    if((current&&current.revision||0)!==(t.revision||0))throw new Error('別画面で更新されました。画面を開き直してください');
    t.revision=(t.revision||0)+1;t.updatedAt=new Date().toISOString();
    sd.trial20261004=t; smSetItem(code,sd);
    if(JSON.stringify(get(code))!==JSON.stringify(t))throw new Error('保存を確認できません。JSONを保存し、作業を中止してください');
  }
  function node(tag,text,parent) {
    const e=document.createElement(tag); if(text!==undefined)e.textContent=text;
    if(parent)parent.appendChild(e); return e;
  }
  function button(text,fn,parent) {
    const b=node('button',text,parent); b.type='button'; b.onclick=()=>{try{fn();}catch(e){alert(e.message);}};return b;
  }
  function check(text,value,fn,parent) {
    const l=node('label',undefined,parent),i=node('input',undefined,l);i.type='checkbox';i.checked=!!value;
    node('span',text,l);i.onchange=()=>{try{fn(i.checked);}catch(e){i.checked=!i.checked;alert(e.message);}};return i;
  }
  function input(value,kind,parent) {const e=node('input',undefined,parent);e.type=kind;e.value=value===null||value===undefined?'':value;return e;}
  function num(v) { if(!/^\d+$/.test(String(v)))throw new Error('数字を整数で入力してください');const n=Number(v);if(!Number.isSafeInteger(n))throw new Error('数字が大きすぎます');return n; }
  function fmt(n) {return n===null?'要確認':n.toLocaleString('ja-JP')+'円';}
  async function copy(text) {try{await navigator.clipboard.writeText(text);showToast('コピーしました',1500);}catch(e){alert('コピーできませんでした。表示された文章を選択してコピーしてください。');}}
  function conflict(code,t) {
    const i=itemFor(code); if(!i)return '商品が見つかりません';
    if(String(i.shopItemId||'')!==t.shopId)return '商品IDが変わりました。再出品の可能性があります。オーナーへ確認してください';
    const sd=smGetItem(code);
    if(['stop','relist'].includes(sd.ownerInstruction))return '停止・再出品のオーナー指示があります';
    if(String(sd.ownerInstructionUpdatedAt||'')!==t.ownerAt)return 'オーナー指示が更新されました。旧価格を適用せず確認してください';
    if(String(i.actualSymbol||'')!==t.symbol)return 'CSVの記号が変わりました。別作業との重複を確認してください';
    const shop=t.rows.find(r=>r.platform==='shops');
    const allowed=[t.base];if(shop&&['ready','changed','posted','closed','cancelling'].includes(shop.phase))allowed.push(shop.after);
    if(!allowed.includes(Number(i.price)))return 'CSVの価格が変わりました。別スタッフの作業を確認してください';
    return '';
  }
  function guard(code,t) {
    if(!eligible(itemFor(code)))throw new Error('在庫・公開状態を確認してください。販売中の商品だけ実施できます');
    const c=conflict(code,t);if(c)throw new Error(c);
  }
  function setup(code) {
    if(window.OPERATIONS_CONFIG && !window.OPERATIONS_CONFIG.salesEnabled)throw Error('新しいセールはOFFです。終了・取消確認だけ行ってください');
    if(!activePeriod())throw new Error('新規の試験作業は10月4日までです');
    const i=itemFor(code),sd=smGetItem(code);if(!eligible(i))throw new Error('販売中・在庫ありの商品を選んでください');
    if(get(code))throw new Error('この商品は登録済みです。追加値下げは作成しません');
    if((sd.tasks||[]).some(t=>t.status==='pending'&&t.type==='revert_check'))throw new Error('既存セールの終了確認を先に完了してください');
    if(['stop','relist'].includes(sd.ownerInstruction))throw new Error('オーナー指示を先に確認してください');
    const basis=i.saleBasisAt||i.shopsUpdatedAt||i.shopsRegDate||'';
    let freshness=null;if(basis){try{freshness=R.freshness(basis,today(),10);}catch(e){throw Error('更新基準日を確認できません。オーナーへ連絡してください');}}
    const plan=R.plan(Number(i.price),today(),'price_first');
    if(items.filter(x=>x.code===code).length!==1)throw new Error('管理番号が重複しています。オーナーへ確認してください');
    const t={version:2,createdAt:new Date().toISOString(),base:Number(i.price),shopId:String(i.shopItemId||''),symbol:String(i.actualSymbol||''),ownerAt:String(sd.ownerInstructionUpdatedAt||''),timing:plan.timing,freshness,
      rows:plan.rows.filter(r=>r.platform!=='yahoo_auction').map(r=>Object.assign(r,{phase:'draft',status:'unknown',likes:null,checks:{}})),history:[]};
    put(code,t);render();
  }
  function saveObservation(code,platform,status,likes,before,seen,commentEnabled) {
    const t=clone(get(code)),r=t.rows.find(x=>x.platform===platform);guard(code,t);
    if(r.phase!=='draft')throw new Error('作業中の価格は変更できません');
    if(!activePeriod())throw new Error('試験期間が終了しました');
    if(status==='unknown')throw new Error('確認済み、または未出品を選んでください');
    const at=new Date().toISOString(),obs={platform,status,likes:status==='checked'?num(likes):null,at};
    Object.assign(r,S.applyFreshness(S.observe(r,{status,likes:obs.likes,current:status==='checked'?num(before):null,seen}),t.freshness));
    Object.assign(r,{observedAt:at,commentEnabled:platform==='mercari'||(platform==='rakuma'&&commentEnabled)});
    t.history.push(obs);put(code,t);render();
  }
  function updateCheck(code,platform,key,value) {const t=clone(get(code)),r=t.rows.find(x=>x.platform===platform);r.checks[key]=value;put(code,t);}
  function change(code,platform) {
    if(window.OPERATIONS_CONFIG && !window.OPERATIONS_CONFIG.salesEnabled)throw Error('新しいセールはOFFです。終了・取消確認だけ行ってください');
    const t=clone(get(code)),r=t.rows.find(x=>x.platform===platform);guard(code,t);
    if(today()>t.timing.end)throw new Error('セール期限を過ぎています。価格変更を始めないでください');
    if(r.phase!=='ready'||!r.checks.changed)throw new Error('指定価格への変更後、商品画面を確認してください');
    if(t.base>=30000&&!r.checks.ownerApproved)throw new Error('高額商品のセールは、オーナーの事前承認を確認してください');
    r.phase=r.commentEnabled?'changed':'posted';r.changedAt=new Date().toISOString();put(code,t);render();
  }
  function posted(code,platform) {
    if(window.OPERATIONS_CONFIG && !window.OPERATIONS_CONFIG.salesEnabled)throw Error('新しいセールはOFFです。終了・取消確認だけ行ってください');const t=clone(get(code)),r=t.rows.find(x=>x.platform===platform);guard(code,t);if(today()>t.timing.end)throw new Error('期限を過ぎています');if(r.phase!=='changed'||!r.checks.posted)throw new Error('正しいコメントを投稿したことを確認してください');r.phase='posted';put(code,t);render();}
  function close(code,platform,current,likes,sold) {
    const t=clone(get(code)),r=t.rows.find(x=>x.platform===platform);
    if(!['ready','changed','posted','cancelling'].includes(r.phase))throw new Error('既に終了しています');
    if(today()<=t.timing.end&&!sold&&r.phase!=='cancelling')throw new Error('終了日の翌日から確認できます');
    if(!r.checks.removed)throw new Error('セールコメント削除（未投稿なら不要）を確認してください');
    if(!sold){
      const c=conflict(code,t);if(c)throw new Error(c);
      if(!eligible(itemFor(code)))throw new Error('CSVでは販売中ではありません。在庫と実商品を確認してください');
      const n=num(current);
      if(n!==r.normal)throw new Error('その販路の通常指定価格と一致しません');
      const obs=R.observation(platform,'checked',num(likes),new Date().toISOString());t.history.push(obs);r.likes=obs.likes;r.observedAt=obs.at;
    }
    Object.assign(r,S.finish(r,{current:sold?null:num(current),sold,commentsRemoved:r.checks.removed,reservationsCleared:r.checks.reservations}));
    r.closedAt=new Date().toISOString();t.history.push({platform,event:r.phase,at:r.closedAt,sold});put(code,t);render();
  }
  function cancel(code,platform){const t=clone(get(code)),r=t.rows.find(x=>x.platform===platform);Object.assign(r,S.cancel(r));t.history.push({platform,event:'cancel_requested',at:new Date().toISOString()});put(code,t);render();}
  function draft(code,platform,key,value){const t=clone(get(code)),r=t.rows.find(x=>x.platform===platform);if(r.phase!=='draft')throw Error('確認済みです');r.draft=r.draft||{};r.draft[key]=value;put(code,t);}
  function refreshObservation(code,platform,status,likes) {
    const t=clone(get(code)),r=t.rows.find(x=>x.platform===platform);
    const o=R.observation(platform,status,status==='checked'?num(likes):null,new Date().toISOString());
    t.history.push(o);r.status=o.status;r.likes=o.likes;r.observedAt=o.at;put(code,t);render();
  }
  function beginLegacyCancel(code,reason){
    if(!['recent_activity','relisted_low_response','wrong_date','other'].includes(reason))throw Error('取消理由を選んでください');
    const sd=smGetItem(code);if(!legacySaleActive(sd))throw Error('取り消せるセール予約・終了確認がありません');
    sd.legacySaleCancellation={status:'checking',reason,requestedAt:new Date().toISOString(),priceStatus:'unknown',checks:{reservation:false,comments:false,normalConfirmed:false}};
    smSetItem(code,sd);render();
  }
  function legacyCheck(code,key,value){
    const sd=smGetItem(code),x=sd.legacySaleCancellation;if(!x||x.status!=='checking')throw Error('取消確認が開始されていません');
    x.checks[key]=value;smSetItem(code,sd);
  }
  function legacyPriceStatus(code,value){
    if(!['unknown','unchanged','restored'].includes(value))throw Error('価格の状態を選んでください');
    const sd=smGetItem(code),x=sd.legacySaleCancellation;if(!x||x.status!=='checking')throw Error('取消確認が開始されていません');
    x.priceStatus=value;if(value!=='restored')x.checks.normalConfirmed=false;smSetItem(code,sd);render();
  }
  function finishLegacyCancel(code){
    const sd=smGetItem(code),x=sd.legacySaleCancellation;if(!x||x.status!=='checking')throw Error('取消確認が開始されていません');
    if(!x.checks.reservation||!x.checks.comments)throw Error('予約とコメントの後片付けを確認してください');
    if(x.priceStatus==='unknown')throw Error('価格を変更したか確認してください');
    if(x.priceStatus==='restored'&&!x.checks.normalConfirmed)throw Error('オーナー確認済みの通常指定価格へ戻したことを確認してください');
    const result=S.cancelLegacyTasks(sd.tasks,today(),x.reason);sd.tasks=result.tasks;
    x.status='completed';x.completedAt=new Date().toISOString();x.cancelledTaskCount=result.changed;
    sd.tasks.push({id:'cancel_'+Date.now(),type:'sale_cancel',status:'done',dueDate:today(),completedAt:today(),desc:'セール予約取消（販売サイト確認済み）',reason:x.reason});
    smSetItem(code,sd);showToast('セール予約の取消確認を記録しました',2500);render();
  }
  function exportTrial() {
    const data=items.map(i=>({code:i.code,trial:get(i.code)})).filter(i=>i.trial);
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),items:data},null,2)],{type:'application/json'}));
    const a=node('a');a.href=url;a.download='試験記録_'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function render() {
    if(!panel)return;panel.replaceChildren();
    const head=node('header',undefined,panel);node('h2','10月4日までの販売試験',head);
    button('記録を保存',exportTrial,head);button('閉じる',()=>{panel.remove();panel=null;smRenderAll();},head);
    button('試験の確認内容を報告用にコピー',()=>{
      const lines=[];items.forEach(item=>{const trial=get(item.code);if(!trial)return;trial.rows.filter(r=>r.phase!=='draft').forEach(r=>{
        lines.push('('+(lines.length+1)+') '+item.code+' '+labels[r.platform]+'\nいいね：'+(r.likes===null?'未確認・未出品':r.likes)+'／状態：'+r.phase+'\n通常指定 '+fmt(r.normal)+'／セール指定 '+fmt(r.after)+'／確認時実価格 '+fmt(r.before)+'\n終了 '+trial.timing.end+'\n'+(typeof smPublicShopsUrl==='function'?smPublicShopsUrl(item):''));
      });});if(!lines.length)throw Error('確認済みの試験記録がありません');copy(lines.join('\n\n'));
    },head);
    node('p','各販路で実価格といいねを確認。3件以上の販路だけセール候補、0～2件は見送りです。Yahoo!フリマは記録のみ、ヤフオクは従来作業です。',panel);
    const body=node('div',undefined,panel);body.className='trial-body';const list=node('aside',undefined,body),detail=node('main',undefined,body);
    const search=input('', 'search',list);search.placeholder='管理番号・商品名';
    const rows=node('div',undefined,list);
    const draw=()=>{rows.replaceChildren();items.filter(i=>(eligible(i)||get(i.code))&&(!search.value||(i.code+' '+i.title).toLowerCase().includes(search.value.toLowerCase()))).forEach(i=>{
      const t=get(i.code),sd=smGetItem(i.code);const label=!t?(legacySaleActive(sd)||sd.legacySaleCancellation&&sd.legacySaleCancellation.status==='checking'?'セール取消確認':'確認待ち'):pending(t)?(today()>t.timing.end?'終了確認':'作業中'):t.rows.some(r=>r.phase==='draft')?'確認待ち':t.rows.some(r=>r.phase==='review')?'オーナー確認':'記録済み';
      const b=button(i.code+'｜'+label,()=>{selected=i.code;render();},rows);b.className=i.code===selected?'selected':'';
    });};search.oninput=draw;draw();
    const i=itemFor(selected);if(!i){node('p','左から商品を選んでください。対象全商品を表示します。',detail);return;}
    node('h3',i.code+' '+i.title,detail);
    const t=get(i.code);
    if(!t){
      node('p','今回の価格帯別セールは1商品につき1回です。別スタッフの作業中・既存セール中の商品は先に確認してください。',detail);
      const sd=smGetItem(i.code),cancelState=sd.legacySaleCancellation;
      if(legacySaleActive(sd)||cancelState&&cancelState.status==='checking'){
        const cancelBox=node('section',undefined,detail);node('h3','既存セール予約の取消確認',cancelBox);
        node('p','販売サイトは自動で変更されません。どこまで実施済みかを確認し、必要な後片付けを済ませてください。',cancelBox);
        if(!cancelState||cancelState.status!=='checking'){
          const reason=node('select',undefined,cancelBox);[['','取消理由を選択'],['recent_activity','最近更新されたため観察'],['relisted_low_response','再出品直後・反応が少ない'],['wrong_date','予定日の誤登録'],['other','その他']].forEach(([v,l])=>{const o=node('option',l,reason);o.value=v;});
          button('取消確認を開始',()=>beginLegacyCancel(i.code,reason.value),cancelBox);
        }else{
          check('販売サイトのセール予約・タイムセールを取り消した（未予約なら不要）',cancelState.checks.reservation,v=>legacyCheck(i.code,'reservation',v),cancelBox);
          check('投稿済みのセールコメントを削除した（未投稿なら不要）',cancelState.checks.comments,v=>legacyCheck(i.code,'comments',v),cancelBox);
          node('p','予約時に販売価格を変更しましたか？',cancelBox);
          const priceStatus=node('select',undefined,cancelBox);[['unknown','未確認'],['unchanged','価格は変更していない'],['restored','価格を変更したため通常指定価格へ戻した']].forEach(([v,l])=>{const o=node('option',l,priceStatus);o.value=v;});priceStatus.value=cancelState.priceStatus||'unknown';priceStatus.onchange=()=>legacyPriceStatus(i.code,priceStatus.value);
          if(cancelState.priceStatus==='restored'){
            node('p','旧セールでは変更前価格を安全に確定できない場合があります。画面の参考値を信じて足し戻さず、オーナーが確認した各販路の通常指定価格へ戻してください。',cancelBox).className='trial-warning';
            check('オーナー確認済みの各販路の通常指定価格へ戻し、実ページで確認した',cancelState.checks.normalConfirmed,v=>legacyCheck(i.code,'normalConfirmed',v),cancelBox);
          }
          button('取消確認を完了',()=>finishLegacyCancel(i.code),cancelBox);
        }
      }
      button('販路別の実価格・いいねを確認する',()=>setup(i.code),detail).disabled=!activePeriod()||legacySaleActive(sd);return;
    }
    node('p','終了：'+t.timing.end+' 23:59 ／ 終了確認：'+t.timing.restore,detail);
    if(t.freshness&&t.freshness.wait)node('p','最近の販売施策更新から'+t.freshness.days+'日です。'+t.freshness.readyOn+'まではセールを開始せず、反応を観察します。',detail).className='trial-warning';
    const warning=conflict(i.code,t);if(warning)node('p','要確認：'+warning,detail).className='trial-warning';
    t.rows.forEach(r=>{
      const box=node('section',undefined,detail);node('h3',labels[r.platform],box);
      const href=r.platform==='shops'?(typeof smPublicShopsUrl==='function'?smPublicShopsUrl(i):''):(typeof makeUrl==='function'?makeUrl(r.platform,'title',i.code,i.title):'');
      if(href&&/^https:\/\//.test(href)){const link=node('a','商品ページ・検索を開く',box);link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.style.color='#a5b4fc';}
      node('p','通常指定価格：'+fmt(r.normal)+(r.platform==='yahoo_flea'?' ／ 今回は記録のみ':' ／ セール指定価格：'+fmt(r.after))+' ／ '+({draft:'実価格を確認',ready:'価格変更待ち',align:'通常指定価格へ合わせる',changed:'コメント投稿待ち',posted:'セール実施中',closed:'終了確認済み',review:'オーナー確認',unchanged:'同額のため変更不要',unlisted:'未出品',hold:'今回は見送り・記録のみ',sold:'売却済み',cancelling:'取消の後片付け中',cancelled:'取消済み'}[r.phase]),box);
      if(!['closed','cancelled'].includes(r.phase))button('この販路の試験を取り消す',()=>{if(confirm('取消手順に進みます。販売サイトの変更は自動では戻りません。'))cancel(i.code,r.platform);},box);
      if(r.phase==='draft'){
        const d=r.draft||{};
        const status=node('select',undefined,box);[['unknown','未確認'],['checked','出品あり・セール中ではない'],['unlisted','未出品'],['on_sale','既にセール中・予約あり'],['sold','売却済み']].forEach(([v,l])=>{const o=node('option',l,status);o.value=v;});
        status.value=d.status||'unknown';status.onchange=()=>draft(i.code,r.platform,'status',status.value);
        node('p','商品ページの実際の現在価格（必ず確認して入力）',box);const before=input(d.before,'number',box);before.oninput=()=>draft(i.code,r.platform,'before',before.value);
        node('p','この販路のいいね数（実数・未確認は空欄）',box);const likes=input(d.likes,'number',box);likes.min=0;likes.oninput=()=>draft(i.code,r.platform,'likes',likes.value);
        const seen=check('実際の商品ページで現在価格を確認した',d.seen,v=>draft(i.code,r.platform,'seen',v),box);
        const cc=r.platform==='rakuma'?check('ラクマにもセールコメントを投稿する',d.comment,v=>draft(i.code,r.platform,'comment',v),box):null;
        button('確認内容を保存',()=>saveObservation(i.code,r.platform,status.value,likes.value,before.value,seen.checked,cc&&cc.checked),box);
      }else{
        node('p','確認時価格：'+fmt(r.before)+' ／ いいね：'+(r.likes===null?'未確認・未出品':r.likes)+' ／ '+(r.observedAt||''),box);
        if(r.phase==='align'){
          node('p','セールではなく通常指定価格へ合わせる作業です。コメント投稿は不要です。',box);
          button(fmt(r.normal)+' に合わせる：金額コピー',()=>{guard(i.code,get(i.code));copy(String(r.normal));},box);
          const actual=input(null,'number',box);actual.placeholder='変更後の実際の価格';
          button('通常指定価格への修正を記録',()=>{const latest=clone(get(i.code));guard(i.code,latest);const row=latest.rows.find(x=>x.platform===r.platform);if(row.phase!=='align'||num(actual.value)!==row.normal)throw Error('通常指定価格と一致することを確認してください');row.phase='hold';row.alignedAt=new Date().toISOString();latest.history.push({platform:r.platform,event:'normal_price_aligned',at:row.alignedAt,price:row.normal});put(i.code,latest);render();},box);
        }
        if(r.phase==='hold'&&r.holdReason==='recent_activity'){
          node('p','最近の更新・再出品後の観察期間です。予約済みのセールは取り消し、'+r.readyOn+'以降に実価格といいねを再確認します。',box);
          if(today()>=r.readyOn&&today()<=R.END)button('観察期間が終わったので再確認する',()=>{const latest=clone(get(i.code)),row=latest.rows.find(x=>x.platform===r.platform);row.phase='draft';row.status='unknown';row.likes=null;row.draft={};delete row.holdReason;delete row.readyOn;latest.timing=R.period(today());delete latest.freshness;latest.history.push({platform:r.platform,event:'freshness_recheck',at:new Date().toISOString()});put(i.code,latest);render();},box);
        }
        if(r.phase==='ready'&&today()<=t.timing.end){
          if(t.base>=30000){node('p','高額商品：セール実施前に上部の報告コピーでオーナーへ確認してください。',box);check('この販路のセール指定価格・期間についてオーナーの承認を得た',r.checks.ownerApproved,v=>updateCheck(i.code,r.platform,'ownerApproved',v),box);}
          button(fmt(r.after)+' をコピー',()=>copy(String(r.after)),box).disabled=!!warning||!eligible(i);
          if(r.platform==='shops')node('p','Shopsの表示価格を指定価格に合わせてください。既存タイムセールがある場合は重ねて設定しないでください。',box);
          check('指定価格へ変更し、変更後の商品画面も確認した',r.checks.changed,v=>updateCheck(i.code,r.platform,'changed',v),box);
          button('価格変更を記録',()=>change(i.code,r.platform),box);
        }
        if(r.phase==='changed'&&today()<=t.timing.end){
          const text=R.comment(Object.assign({},r,{action:'price_first'}),t.timing.end);node('pre',text,box);
          button(labels[r.platform]+'用コメントをコピー',()=>copy(text),box).disabled=!!warning||!eligible(i);
          check('表示価格とコメントの金額・期限が一致することを確認して投稿した',r.checks.posted,v=>updateCheck(i.code,r.platform,'posted',v),box);
          button('コメント投稿を記録',()=>posted(i.code,r.platform),box);
        }
        if(['ready','changed','posted','cancelling'].includes(r.phase)){
          if(r.phase==='cancelling'&&!['changed','posted'].includes(r.cancelFrom)){
            button('販売サイトは一切変更していないため登録だけ取り消す',()=>{
              if(!confirm('この試験では価格・予約・コメントを一切変更していませんか？変更済みならキャンセルして下の後片付けを行ってください。'))return;
              const latest=clone(get(i.code)),row=latest.rows.find(x=>x.platform===r.platform);
              Object.assign(row,S.cancelUnchanged(row,{noExternalChanges:true}));latest.history.push({platform:r.platform,event:'cancelled_without_external_changes',at:new Date().toISOString()});put(i.code,latest);render();
            },box);
          }
          if(today()>t.timing.end||r.phase==='cancelling'){
            node('p','終了・取消：戻す先は通常指定価格 '+fmt(r.normal)+' です。途中で別スタッフが変更した場合はオーナー確認。金額の足し戻しはしません。',box);
            const beforeRestore=input(null,'number',box);beforeRestore.placeholder='戻す前の実際の現在価格';
            button('現在価格を確認して通常指定価格をコピー',()=>{const latest=clone(get(i.code));guard(i.code,latest);const row=latest.rows.find(x=>x.platform===r.platform);Object.assign(row,S.verifyRestore(row,num(beforeRestore.value)));put(i.code,latest);copy(String(row.normal));},box);
            const current=input(null,'number',box);current.placeholder='確認後の販売価格';const likes=input(null,'number',box);likes.placeholder='終了時いいね数';
            check('セールコメントを削除した（未投稿の場合は不要）',r.checks.removed,v=>updateCheck(i.code,r.platform,'removed',v),box);
            button('価格・コメントの終了確認を完了',()=>close(i.code,r.platform,current.value,likes.value,false),box);
          }
          check('この試験のセール予約・タイムセールを終了／取消した（未設定なら不要）',r.checks.reservations,v=>updateCheck(i.code,r.platform,'reservations',v),box);
          if(today()<=t.timing.end&&r.phase!=='cancelling')check('売却の場合：セールコメント削除を確認した（削除不可なら不要）',r.checks.removed,v=>updateCheck(i.code,r.platform,'removed',v),box);
          button('売却・他販路売却による終了を記録',()=>{if(confirm('実際に売却済みであることを確認しましたか？'))close(i.code,r.platform,'','',true);},box);
        }
        const more=node('details',undefined,box);node('summary','いいね数を追加記録',more);const likes=input(null,'number',more);
        button('現在のいいね数を保存',()=>refreshObservation(i.code,r.platform,'checked',likes.value),more);
      }
    });
    const terminal=t.rows.every(r=>['closed','cancelled','hold','unchanged','unlisted','sold'].includes(r.phase));
    if(today()>R.END&&terminal&&!t.legacyReleased)button('全販路を確認済み：通常運用へ戻す',()=>{if(!confirm('全販路の価格・予約・コメントの後片付けを確認し、通常タスクへ戻しますか？'))return;const latest=clone(get(i.code));latest.legacyReleased=true;latest.releasedAt=new Date().toISOString();latest.history.push({event:'legacy_released',at:latest.releasedAt});put(i.code,latest);render();smRenderAll();},detail);
  }
  window.openSalesTrial=function(code){
    selected=code||selected;if(!panel){panel=node('div',undefined,document.body);panel.id='sales-trial';}render();
  };
  const oldRender=window.smRenderTasks;
  window.smRenderTasks=function(){oldRender();const list=document.getElementById('sm-task-list');if(!list)return;
    const entries=node('div');
    button('販売試験：実価格・いいね確認／終了作業',()=>openSalesTrial(),entries);
    items.filter(i=>get(i.code)&&!get(i.code).legacyReleased).forEach(i=>{
      const t=get(i.code);if(!pending(t)&&!t.rows.some(r=>r.phase==='draft'))return;
      button(i.code+'：'+(today()>t.timing.end?'終了・取消を確認':'試験の未完了作業へ'),()=>openSalesTrial(i.code),entries);
    });list.prepend(entries);
  };
  const oldTasks=window.smGetAllTasks;
  window.smGetAllTasks=function(){return oldTasks().filter(task=>{const t=get(task.code);return !t||t.legacyReleased||task.type==='revert_check';});};
  const oldCandidate=window.smGetOwnerReportCandidate;
  window.smGetOwnerReportCandidate=function(code){const t=get(code);return t&&!t.legacyReleased?null:oldCandidate.apply(this,arguments);};
  const oldUndo=window.smUndo;
  window.smUndo=function(){const undo=JSON.parse(localStorage.getItem('sm_undo')||'null');if(undo&&get(undo.code)){alert('試験中の商品は試験画面の販路別取消を使ってください。古い状態への巻き戻しを防ぎます。');openSalesTrial(undo.code);return;}return oldUndo.apply(this,arguments);};
  // Existing pending tasks are retained, but prevent a second price operation after trial enrolment.
  ['smOnLikes','smAfterSale','smDoChange','smManualChange','smExecMercariComment'].forEach(name=>{
    const old=window[name];if(typeof old!=='function')return;window[name]=function(code){const t=get(code);if(t&&!t.legacyReleased){alert('販売試験の対象です。二重値下げを防ぐため、試験画面で作業してください。終了後も旧タスクへの復帰はオーナー確認が必要です。');openSalesTrial(code);return;}
      if(name==='smAfterSale'){
        const item=itemFor(code),sd=smGetItem(code),saleDate=arguments[3]||today();
        if(legacySaleActive(sd)){alert('未完了のセール予約・終了確認があります。二重登録せず、販売試験画面の取消確認を行ってください。');openSalesTrial(code);return;}
        const basis=item&&(item.saleBasisAt||item.shopsUpdatedAt||item.shopsRegDate);
        if(basis){try{const fresh=R.freshness(basis,saleDate,10);if(fresh.wait){alert('最近の更新・再出品から'+fresh.days+'日です。'+fresh.readyOn+'まではセールを開始せず反応を観察してください。');openSalesTrial(code);return;}}catch(e){alert('更新日を確認できないため、セール設定を止めました。オーナーへ確認してください。');return;}}
        if((sd.tasks||[]).some(x=>x.type==='sale'&&x.status!=='cancelled'&&x.dueDate===saleDate)){alert('同じ実施日のセールが既に登録されています。二重登録を止めました。');return;}
      }
      return old.apply(this,arguments);};
  });
  const oldComplete=window.smCompleteTask;
  window.smCompleteTask=function(code,id){const t=get(code),task=(smGetItem(code).tasks||[]).find(x=>x.id===id);if(t&&!t.legacyReleased&&(!task||task.type!=='revert_check')){alert('試験対象の旧タスクは保留中です。試験画面を確認してください。');openSalesTrial(code);return;}return oldComplete.apply(this,arguments);};
  const style=node('style',undefined,document.head);style.textContent='#sales-trial{position:fixed;inset:12px;z-index:10020;background:#151722;color:#e2e8f0;padding:18px;overflow:auto;border:1px solid #64748b;border-radius:12px;font-family:system-ui}#sales-trial header{display:flex;gap:10px;align-items:center;flex-wrap:wrap}#sales-trial h2{flex:1}#sales-trial .trial-body{display:grid;grid-template-columns:230px 1fr;gap:18px}#sales-trial aside{max-height:70vh;overflow:auto}#sales-trial aside button{display:block;width:100%;text-align:left}#sales-trial section{border:1px solid #475569;border-radius:8px;padding:12px;margin-bottom:12px}#sales-trial button,#sales-trial input,#sales-trial select{background:#252a40;color:#fff;border:1px solid #64748b;border-radius:6px;padding:9px;margin:4px;max-width:95%}#sales-trial button{cursor:pointer}#sales-trial button:disabled{opacity:.4;cursor:default}#sales-trial label{display:block;margin:10px 0}#sales-trial input[type=checkbox]{margin-right:8px}#sales-trial pre{white-space:pre-wrap;background:#202537;padding:12px}#sales-trial .selected{border-color:#a78bfa;background:#44316a}#sales-trial .trial-warning{color:#fca5a5} @media(max-width:650px){#sales-trial .trial-body{grid-template-columns:1fr}#sales-trial aside{max-height:180px}}';
})();
