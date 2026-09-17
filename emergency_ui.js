(async function(){
 'use strict';const R=EmergencyCore,KEY='listing_ab_workspace_v1';let state;
 const db=await new Promise((resolve,reject)=>{const req=indexedDB.open(KEY,1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 state=await new Promise((resolve,reject)=>{const req=db.transaction('state').objectStore('state').get('current');req.onsuccess=()=>resolve(req.result||{});req.onerror=()=>reject(req.error);});
 let writes=Promise.resolve(),saveBlocked=false,pendingWrites=0;
 window.addEventListener('beforeunload',e=>{if(pendingWrites){e.preventDefault();e.returnValue='';}});
 let config=R.settings(window.OPERATIONS_CONFIG||R.defaults),app=document.getElementById('app');
 const clone=x=>JSON.parse(JSON.stringify(x));
 const now=()=>{const d=new Date();return new Date(d.getTime()+9*3600000).toISOString().replace('Z','+09:00');};
 function msg(text){const el=document.getElementById('message');el.hidden=false;el.textContent=text;}
 function save(){if(saveBlocked)throw Error('保存エラーがあります。画面を再読み込みしてください');const expected=state._revision||0;state._revision=expected+1;state.workUpdatedAt=now();const next=clone(state);pendingWrites++;
  writes=writes.then(()=>new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),get=store.get('current');get.onsuccess=()=>{if(((get.result||{})._revision||0)!==expected){tx.abort();return;}store.put(next,'current');};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(Error('保存に失敗、または別タブで更新されています。再読み込みして確認してください'));}));
  writes.then(()=>{pendingWrites--;},e=>{pendingWrites--;saveBlocked=true;msg(e.message);});return writes;
 }
 function node(tag,text,parent){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e;}
 function button(text,fn,parent){const b=node('button',text,parent);b.onclick=async()=>{try{await writes;await fn();await writes;}catch(e){msg(e.message);}};return b;}
 function copyButton(label,value,parent){
  const b=node('button',label,parent);b.dataset.copy='true';const feedback=node('small','',parent);
  const success=()=>{feedback.textContent='コピーしました：'+value;b.textContent='✓ コピー済み：'+value;};
  function fallback(){const field=node('textarea',String(value),parent);field.readOnly=true;field.setAttribute('aria-label','コピーする内容');field.focus();field.select();let copied=false;try{copied=document.execCommand('copy');}catch(e){}if(copied){field.remove();success();}else{feedback.textContent='自動コピーできませんでした。選択された内容を Ctrl+C でコピーしてください。';}}
  b.onclick=()=>{try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(String(value)).then(success,fallback);}else fallback();}catch(e){fallback();}};return b;
 }
 function select(options,value,parent){const e=node('select',undefined,parent);options.forEach(([v,t])=>{const o=node('option',t,e);o.value=v;});e.value=value;return e;}
 function input(type,value,parent){const e=node('input',undefined,parent);e.type=type;e.value=value??'';return e;}
 function check(text,value,fn,parent){const l=node('label',undefined,parent),i=input('checkbox','',l);i.checked=!!value;node('span',text,l);i.onchange=()=>{try{fn(i.checked);}catch(e){msg(e.message);}};return i;}
 function download(name,obj){const text=typeof obj==='string'?obj:JSON.stringify(obj,null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));const a=node('a',undefined,document.body);a.href=url;a.download=name;a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
 function upload(label,fn,parent){const l=node('label',label,parent),i=input('file','',l);i.accept='.json';i.onchange=async()=>{try{await writes;if(!i.files[0])return;const raw=JSON.parse(await i.files[0].text());await fn(raw,i.files[0].name);await save();render();}catch(e){msg(e.message);}};}
 function settings(parent){const box=node('details',undefined,parent);node('summary','オーナー用：運用設定と公開用ファイル',box);node('p','ここでの編集は配布用設定です。公開済みのスタッフ画面は「設定を公開」の操作後に再読み込みして反映します。配布済みの仕事は、その配布時点の指定価格を保持します。',box);
  check('新しいセールをON（OFFでも終了・取消確認は必要）',config.salesEnabled,v=>config.salesEnabled=v,box);
  check('A・B分担をON（OFFは次の配布からAのみ。配布済みの担当は維持）',config.splitEnabled,v=>config.splitEnabled=v,box);
  node('label','途中の通常値下げ',box);const mode=select([['fixed','固定額（円）'],['percent','現在価格の割合（％）']],config.discountMode,box),value=input('number',config.discountValue,box);
  node('label','記号ごとの基準価格に対する割合（％）',box);const rates=config.rates.map((v,n)=>{node('span',['●','■','▲','〇','□'][n],box);return input('number',v,box);});rates[0].disabled=true;
  node('label','次の作業までの日数（目安）',box);const days=input('number',config.interval,box);node('label','高額商品の確認基準（円）',box);const high=input('number',config.highPrice,box);
  function read(){return R.settings({...config,discountMode:mode.value,discountValue:Number(value.value),rates:rates.map(i=>Number(i.value)),interval:Number(days.value),highPrice:Number(high.value)});}
  button('計算例を確認',()=>{const c=read();msg('16,800円の途中値下げ → '+(16800-(c.discountMode==='fixed'?c.discountValue:Math.floor(16800*c.discountValue/100))).toLocaleString()+'円 ／ ●から■ → '+(Math.floor(16800*c.rates[1]/10000)*100).toLocaleString()+'円');},box);
  button('この配布作成に設定を使う',()=>{config=read();msg('これから作る配布データに使用します。既存の配布分は変更しません。');},box);
  button('公開用の設定ファイルを保存',()=>{config=read();download('operations_config.js','/* Public owner settings; no credentials. */\nwindow.OPERATIONS_CONFIG = '+JSON.stringify(config,null,2)+';\n');msg('operations_config.jsを保存しました。パソコン側の公開操作が必要です。');},box);
 }
 function owner(parent){
  node('h2','オーナー：開始データと担当の準備',parent);node('p','Aさんから受け取った最新JSONを最初に読み込み、各商品の担当と指定価格を確定します。各自が通常JSONを読み込んで作業を始める方式ではありません。',parent);
  upload('1. 最新の通常バックアップJSONを読み込む',(raw,name)=>{R.snapshot(raw);if(state.master&&state.master.jobs.some(j=>!state.master.applied[j.code]))throw Error('未完了の配布があります。新しい配布を始める前に結果を統合してください');state.master=null;state.source=raw;state.sourceName=name;state.assignments={};},parent);
  if(state.source){node('p','読み込み：'+state.sourceName,parent);const snap=R.snapshot(state.source),box=node('section',undefined,parent);node('h2','2. 配布する商品を選ぶ（古い順）',box);
   const search=input('search','',box);search.placeholder='管理番号・商品名で検索';const list=node('div',undefined,box);
   const show=()=>{list.replaceChildren();let count=0;snap.items.slice().sort((a,b)=>String(a.saleBasisAt||a.shopsUpdatedAt||'').localeCompare(String(b.saleBasisAt||b.shopsUpdatedAt||''))).filter(i=>!search.value||String(i.code+' '+i.title).includes(search.value)).forEach(item=>{
    let p;try{p=R.propose(item,snap.data[item.code]||{},config);}catch(e){return;}if(++count>100)return;
    const line=node('details',undefined,list);node('summary',item.code+' ／ '+item.title+' ／ '+Number(item.price).toLocaleString()+'円',line);
    const sd=snap.data[item.code]||{};node('p','登録済みのオーナー指示：'+(sd.ownerInstruction||'未登録')+' ／ '+(sd.ownerInstructionNote||'補足なし'),line);
    const a=state.assignments[item.code]||{},role=select([['','割り当てない'],['A','Aさん'],['B','Bさん']],a.role||'',line),price=input('number',a.price??p.price,line);
    node('p',p.symbol+'に変更／'+p.note,line);node('small',p.approvalRequired?'オーナーの事前承認が必要です':'個別のオーナー指示があれば優先してください',line);
    let approved=a.approved||false;check('この記号・価格でオーナー承認済み',approved,v=>{approved=v;update();},line);
    function update(){if(role.value)state.assignments[item.code]={code:item.code,role:role.value,price:Number(price.value),symbol:p.symbol,approved};else delete state.assignments[item.code];save();}
    role.onchange=update;price.oninput=update;
   });node('small','表示は先頭100件まで。管理番号検索で対象を絞れます。セール後処理が残る商品や売却済み等は配布対象から外します。',list);};search.oninput=show;show();
   button('3. 担当を固定して配布データを作る',async()=>{if(state.master)throw Error('既存配布があります。新しい配布は最新JSONを読み込んで作成してください');const assignments=Object.values(state.assignments||{});const master=R.create(state.source,assignments,config,crypto.randomUUID(),now());state.master=master;delete state.source;state.assignments={};await save();download('AB管理元_'+master.id+'.json',master);render();},box);
  }
  upload('管理元ファイルを再開する',(raw)=>{if(raw.format!=='listing-ab-master-v1'||!Array.isArray(raw.jobs))throw Error('管理元ファイルではありません');if(state.master&&state.master.id!==raw.id&&state.master.jobs.some(j=>!state.master.applied[j.code]))throw Error('別の未完了配布が残っています');if(state.master&&state.master.id===raw.id&&Object.keys(state.master.applied).some(code=>R.stable(state.master.applied[code])!==R.stable((raw.applied||{})[code])))throw Error('保存済みの進捗より古い、または異なる管理元です。上書きしません');state.master=raw;},parent);
  const m=state.master;if(!m)return;const section=node('section',undefined,parent);node('h2','配布中：'+m.jobs.length+'件／統合済み'+Object.keys(m.applied).length+'件',section);node('small','配布ID：'+m.id,section);
  ['A','B'].forEach(role=>button(role+'さん用の配布ファイルを保存',()=>download(role+'作業用_'+m.id+'.json',R.pack(m,role)),section));
  button('Bさんへ次の50件を追加',()=>{state.master=R.appendSimple(state.master,'B',50,now());save();download('AB管理元_'+m.id+'.json',state.master);download('B作業用_'+m.id+'.json',R.pack(state.master,'B'));render();},section);
  button('Aさんへ次の50件を追加',()=>{state.master=R.appendSimple(state.master,'A',50,now());save();download('AB管理元_'+m.id+'.json',state.master);download('A作業用_'+m.id+'.json',R.pack(state.master,'A'));render();},section);
  node('small','追加対象は未割当・古い順・個別確認なしの商品のみ。既にAさんへ割り当てた商品は取りません。',section);
  upload('作業結果ファイルを統合する',raw=>{const merged=R.merge(state.master,raw,state.master.raw);state.master=merged.master;msg('統合 '+merged.applied.length+'件／二重取り込み '+merged.duplicates.length+'件／競合 '+merged.conflicts.join(', '));download('AB管理元_'+m.id+'.json',state.master);},section);
  upload('配布後の最新通常JSONを照合元にする',raw=>{R.snapshot(raw);if(Object.keys(state.master.applied).length)throw Error('結果統合後の照合元の差し替えはできません。統合前に最新JSONを読み込んでください');state.master.raw=raw;msg('最新状態を照合元に設定しました。以降、配布時点と異なる商品は競合として保留します。');},section);
  button('統合後の通常JSONを保存',()=>{download('shuppin_data_AB統合_'+now().slice(0,10)+'.json',state.master.raw);msg('通常ツールへの取り込み前に既存JSONを保存してください。未取り込みの結果や競合は反映されていません。');},section);
 }
 const labels={shops:'メルカリShops',mercari:'メルカリ',rakuma:'ラクマ',yahoo_flea:'Yahoo!フリマ',yahoo_auction:'ヤフオク'};
 function searchUrl(platform,mode,code,title){
  let term=String(mode==='code'?code:(title||code)).trim();
  if(platform==='rakuma'&&mode==='title'&&Array.from(term).length>40){const cut=Array.from(term).slice(0,40).join('');const at=cut.lastIndexOf(' ');term=at>0?cut.slice(0,at):cut;}
  const q=encodeURIComponent(term);
  return {mercari:'https://jp.mercari.com/search?keyword='+q,rakuma:'https://fril.jp/s?query='+q,yahoo_flea:'https://paypayfleamarket.yahoo.co.jp/search/'+q+'?page=1',yahoo_auction:'https://auctions.yahoo.co.jp/search/search?p='+q}[platform];
 }
 function resultFile(w){return {format:'listing-ab-result-v1',id:w.id,role:w.role,exportedAt:now(),records:Object.values(state.records||{}).filter(r=>w.jobs.some(j=>j.code===r.code)),activity:Object.values(state.activity||{}).filter(e=>e.batch===w.id&&e.role===w.role),followups:w.jobs.flatMap(j=>Object.entries((state.drafts||{})[j.code]||{}).filter(([p,d])=>labels[p]&&['missing','sold','error','owner_wait'].includes(d.status)).map(([p,d])=>({code:j.code,platform:p,status:d.status,updatedAt:d.updatedAt||null,note:state.drafts[j.code].note||''}))),resume:{work:clone(w),drafts:clone(state.drafts||{}),updatedAt:state.workUpdatedAt||now()}};}
 function ownerSwitch(parent){
  if(new URLSearchParams(location.search).get('ownerSwitch')!=='1')return;
  const box=node('details',undefined,parent);node('summary','オーナー専用：説明用の担当切り替え',box);
  node('p','途中状態をこのブラウザに退避します。スタッフのPCとは同期しません。このURLはスタッフに渡さないでください。アクセス認証ではなく、通常画面での誤操作を防ぐ機能です。',box);
  if(state.work)button('現在の結果を保存し、担当選択へ戻る',async()=>{
   if(!confirm(state.work.role+'さんの途中状態を退避し、担当選択へ戻ります。作業結果JSONもダウンロードします。よろしいですか？'))return;
   const result=resultFile(state.work);
   download(result.role+'作業結果_切替前_'+now().slice(0,16).replace(/:/g,'')+'.json',result);
   const previous=clone(state);
   state.ownerParked=state.ownerParked||{};
   state.ownerParked[JSON.stringify([state.work.id,state.work.role])]={work:clone(state.work),records:clone(state.records||{}),drafts:clone(state.drafts||{}),activity:clone(state.activity||{}),savedAt:now()};
   delete state.work;state.records={};state.drafts={};state.activity={};
   try{await save();}catch(e){state=previous;throw e;}
   render();window.scrollTo(0,0);msg('途中状態を退避しました。ダウンロードも確認してください。別の担当ファイルを選ぶか、退避した担当へ戻れます。');
  },box);
  if(!state.work)Object.entries(state.ownerParked||{}).forEach(([key,parked])=>{
   button(parked.work.role+'さんの途中状態に戻る（'+parked.savedAt+'）',async()=>{
    R.validateWork(parked.work);const previous=clone(state);
    state.work=clone(parked.work);state.records=clone(parked.records);state.drafts=clone(parked.drafts);state.activity=clone(parked.activity);delete state.ownerParked[key];
    try{await save();}catch(e){state=previous;throw e;}
    render();window.scrollTo(0,0);
   },box);
  });
 }
 function staff(parent){node('h2','スタッフ：A用／B用ファイルを読み込む',parent);
  node('p','初回は下の「担当の配布ファイル」でA作業用またはB作業用JSONを選びます。従来画面のインポートには入れません。',parent);
  upload('担当の配布ファイル',raw=>{if(raw.format!=='listing-ab-work-v1'||!['A','B'].includes(raw.role)||!Array.isArray(raw.jobs)||raw.jobs.some(j=>j.role!==raw.role))throw Error('担当別の配布ファイルではありません');if(state.work&&state.work.id!==raw.id&&Object.keys(state.records||{}).length)throw Error('前の作業結果を保存し、別のブラウザプロファイルで新しい配布を開始してください');if(state.work&&state.work.id===raw.id&&state.work.role!==raw.role)throw Error('同じ保存領域でA・Bを切り替えないでください');R.validateWork(raw);if(!state.work&&state.ownerParked&&state.ownerParked[JSON.stringify([raw.id,raw.role])])throw Error('この担当の途中状態が退避されています。オーナー専用URLの「途中状態に戻る」を使用してください');if(state.work&&state.work.id!==raw.id)throw Error('別の配布が開いています。結果を保存してオーナーへ確認してください');if(state.work)for(const j of state.work.jobs){const next=raw.jobs.find(n=>n.code===j.code);if(next&&R.stable(next)!==R.stable(j))throw Error('配布済み商品の指示が変わっています。オーナーへ確認してください');if(!next&&!state.records[j.code])throw Error('未完了の商品が新しい配布から欠落しています');}state.work=raw;state.records=state.records||{};state.drafts=state.drafts||{};},parent);
  const recovery=node('details',undefined,parent);node('summary','復元が必要なときだけ（オーナーの案内で使用）',recovery);node('p','通常は開く必要はありません。同じPC・同じブラウザではそのまま続きから作業できます。',recovery);
  upload('前回の作業結果から途中入力も復元する',raw=>{if(raw.format!=='listing-ab-result-v1'||!raw.resume||raw.resume.work.id!==raw.id||raw.resume.work.role!==raw.role)throw Error('復元用の作業結果ではありません');if(state.work&&(state.work.id!==raw.id||state.work.role!==raw.role))throw Error('別の担当・配布データが開いています');if(state.work&&state.workUpdatedAt&&raw.resume.updatedAt<state.workUpdatedAt)throw Error('現在より古い保存結果です。上書きしません');const work=R.validateWork(raw.resume.work);if(!Array.isArray(raw.records)||new Set(raw.records.map(r=>r.code)).size!==raw.records.length)throw Error('完了記録が不正です');for(const r of raw.records){const j=work.jobs.find(j=>j.code===r.code);if(!j||r.role!==raw.role)throw Error('担当外の記録があります');R.record(j,r.checks,r.completedAt);}WorkCounts.entries(raw);state.activity=Object.fromEntries((raw.activity||[]).map(e=>[e.id,e]));state.work=work;state.records=Object.fromEntries(raw.records.map(r=>[r.code,r]));state.drafts=raw.resume.drafts||{};},recovery);
  const w=state.work;if(!w)return;node('p','価格・記号をコピー → 販売先で指定どおりに保存・確認 → 実際に行った作業を選択。変更前後の金額・記号の入力は不要です。',parent);node('h2',w.role+'画面：担当'+w.jobs.length+'件／完了'+w.jobs.filter(j=>state.records&&state.records[j.code]).length+'件',parent);node('p','記号・価格変更のみ。再出品・セールは行いません。価格は高くても安くても各販路の指定価格へ揃えます。売却済み・商品不一致は変更しないでください。',parent);
  button('作業結果を保存して渡す',()=>download(w.role+'作業結果_'+now().slice(0,16).replace(/:/g,'')+'_'+w.id+'.json',resultFile(w)),parent);
  const finishGuide=node('section',undefined,parent);
  node('h3','今日の作業を終えるとき',finishGuide);
  node('p','① 上のボタンで作業結果JSONをダウンロード → ② 下のDriveフォルダーを開く → ③ ダウンロードしたJSONをアップロードしてください。自動ではアップロードされません。全件終わっていなくても毎日の終了時に保存します。',finishGuide);
  const driveLink=node('a','📁 作業結果JSONの保存先（Google Drive）を開く',finishGuide);
  driveLink.href='https://drive.google.com/drive/folders/1JHkLM9rVcMcGPOWTCHLZABur7hxcEN0K';driveLink.target='_blank';driveLink.rel='noopener';
  node('p','ファイル名のA/B・日付・配布IDはそのまま残してください。アップロードできない場合は、ダウンロードしたJSONをオーナーへファイル添付で送ってください。',finishGuide);
  node('p','翌日：同じPC・同じブラウザなら、このページを開いて続きから再開します。通常の再読み込みでも自動保存した入力は残ります。保存中の警告が出たら画面を閉じずに待ってください。',finishGuide);
  node('small','「前回の作業結果から途中入力も復元する」は別PCや復旧時に最新の作業結果JSONを選びます。「担当の配布ファイル」は初回・追加配布時に使います。毎日元の配布ファイルを読み直す必要はありません。ブラウザのデータ削除・シークレットモードでは保存が失われる場合があるため、終了時のJSON保存も必ず行ってください。',finishGuide);

  if(w.jobs.length&&w.jobs.every(j=>state.records[j.code]))button('全件完了：結果を保存して次の配布へ',()=>{download(w.role+'作業結果_'+w.id+'.json',resultFile(w));state.archives=state.archives||[];state.archives.push({work:state.work,records:state.records,drafts:state.drafts,activity:state.activity});delete state.work;state.records={};state.drafts={};state.activity={};save();render();},parent);
  w.jobs.forEach((j,index)=>{const section=node('details',undefined,parent);section.dataset.productCode=j.code;section.className='product-card '+(index%2?'product-alternate':'')+(state.records[j.code]?' product-complete':'');node('summary',(state.records[j.code]?'完了：':'未完了：')+j.code+' ／ '+j.baseItem.title,section);node('h2','変更後の記号：'+j.symbol+' ／ Shops指定価格 '+j.price.toLocaleString()+'円',section);
   const shopid=j.baseItem.shopItemId;if(shopid){const a=node('a','Shops商品ページ',section);a.href='https://jp.mercari.com/shops/product/'+encodeURIComponent(shopid);a.target='_blank';a.rel='noopener';}
   const draft=state.drafts[j.code]||(state.drafts[j.code]={});
   Object.keys(j.platforms).forEach(p=>{const box=node('section',undefined,section),target=j.platforms[p];node('small','管理番号：'+j.code,box);node('h3',labels[p]+'：'+(target===null?'オーナー確認':target.toLocaleString()+'円に合わせる'),box);node('h3','変更後の記号： '+j.symbol,box);
    const searches=p==='shops'?[['Shops管理画面を開く',j.baseItem.shopsUrl]]:(p==='yahoo_auction'?['title']:['code','title']).map(mode=>[mode==='code'?'管理番号で検索':'タイトルで検索',searchUrl(p,mode,j.code,j.baseItem.title)]);
    const searchLinks=node('p',undefined,box);searchLinks.style.display='flex';searchLinks.style.flexWrap='wrap';searchLinks.style.gap='18px';
    for(const [label,href] of searches){if(href){try{const u=new URL(href);if(u.protocol==='https:'&&['mercari-shops.com','jp.mercari.com','fril.jp','paypayfleamarket.yahoo.co.jp','auctions.yahoo.co.jp'].includes(u.hostname)){const a=node('a',label,searchLinks);a.href=u.href;a.target='_blank';a.rel='noopener';}}catch(e){}}}
    if(p==='rakuma')node('small','タイトル検索は長い場合に40文字以内へ短縮します。',box);
    if(p==='yahoo_auction')node('small','管理番号で探す場合は、検索先の「条件指定」で「タイトルと商品説明」を選択してください。説明文の検索対象は冒頭1,000文字までです。',box);
    const identity=node('p','商品ページを開いたら、管理番号が「'+j.code+'」と一致することを確認してから、価格・記号を変更してください。',box);identity.className='identity-check';
    const d=draft[p]||(draft[p]={status:'pending',confirmed:false,symbolConfirmed:false});
    if(target!==null)copyButton('指定価格をコピー',String(target),box);copyButton('記号 '+j.symbol+' をコピー',j.symbol,box);
    node('p','変更後の価格：'+(target===null?'確認が必要':target.toLocaleString()+'円（自動表示・再入力不要）'),box);
    const options=[['pending','未着手'],['both','価格と記号を変更した'],['missing','商品が見つかりません'],['sold','売却済み'],['working','作業中'],['price','価格だけ変更した'],['symbol','記号だけ変更した'],['none','もともと指定どおりだった（確認のみ）'],...(d.status==='done'&&!d.declaredAction?[['done','記録済み（旧方式）']]:[]),...(p==='shops'?[]:[['unlisted','未出品と確認済み']]),['error','変更できません（エラー）'],['owner_wait','オーナー確認待ち']];
    const descriptions={pending:'まだこの販路の作業を始めていません。',working:'変更・確認の途中です。',done:'指定価格・記号に揃っていることを確認し、実際に行った作業だけを記録します。変更しなかったものは数えません。',unlisted:'この販路に出品していないと確認できた場合です。見つからないだけなら下の項目を選びます。',missing:'検索しても見つかりません。いったん次の商品へ進めます。',sold:'売却済みを確認しました。結果JSONに記録し、オーナーがチェックします。',error:'保存できないなどの予期せぬエラーです。下の欄に理由を記入してください。',owner_wait:'指示や承認の確認が必要です。下の欄に理由を記入してください。'};
    const status=select(options,d.status==='done'?(d.declaredAction||'done'):d.status,box),help=node('small',descriptions[d.status]||'',box);
    const report=node('div',undefined,box);
    function showReport(){
     report.replaceChildren();
     if(!['missing','sold'].includes(d.status))return;
     const text='管理番号：'+j.code+'\n販路：'+labels[p]+'\n'+(d.status==='missing'?'商品が見つかりません。掲載先の確認をお願いします。':'売却済みでした。ほかの販路の出品状況をご確認ください。');
     node('p',text,report).style.whiteSpace='pre-wrap';
     copyButton('オーナーへの報告文をコピー',text,report);
     node('small','コピー後、チャットに貼り付けて送信してください。',report);
    }
    showReport();
    const eventId=JSON.stringify([w.id,w.role,j.code,p]);
    status.onchange=async()=>{const old=clone(d);try{
     const selected=status.value;d.declaredAction=['price','symbol','both','none'].includes(selected)?selected:null;d.status=d.declaredAction?'done':selected;d.updatedAt=now();
     if(d.status==='done'||d.status==='unlisted'){
      d.price=d.status==='done'?target:null;d.confirmed=true;d.symbolConfirmed=d.status==='done';
      const e=WorkCounts.event(w.id,w.role,j,p,d,now());state.activity=state.activity||{};state.activity[e.id]=e;
      await save();box.querySelectorAll('input,select,button').forEach(el=>{if(!el.dataset.copy)el.disabled=true;});node('small','この販路は記録済みです。誤りがあれば管理番号・販路をオーナーへ連絡してください。',box);
     }else{d.confirmed=false;d.symbolConfirmed=false;await save();}
     help.textContent=descriptions[d.status];showReport();
    }catch(e){Object.assign(d,old);status.value=d.status==='done'?(d.declaredAction||'done'):d.status;msg(e.message);}};
    if(state.records[j.code]||(state.activity&&state.activity[eventId])){box.querySelectorAll('input,select,button').forEach(el=>{if(!el.dataset.copy)el.disabled=true;});node('small','記録済み：入力内容を保持しています',box);}
   });
   const note=input('text',draft.note||'',section);note.placeholder='保留理由・オーナーへの確認事項';note.oninput=()=>{draft.note=note.value;save();};
   const done=button('各販路の確認を終えて完了にする',async()=>{if(state.records[j.code])throw Error('すでに完了しています');const finished=R.record(j,draft,now());const additions=Object.keys(j.platforms).filter(p=>!(state.activity||{})[JSON.stringify([w.id,w.role,j.code,p])]).map(p=>WorkCounts.event(w.id,w.role,j,p,draft[p],now()));state.activity=state.activity||{};additions.forEach(e=>state.activity[e.id]=e);state.records[j.code]=finished;await save();render();const completedCard=Array.from(app.querySelectorAll('[data-product-code]')).find(el=>el.dataset.productCode===j.code);if(completedCard){completedCard.scrollIntoView({block:'start',behavior:'auto'});const heading=completedCard.querySelector('summary');if(heading)heading.focus({preventScroll:true});}},section);done.disabled=!!state.records[j.code];
  });
 }
 function render(){app.replaceChildren();const notice=node('p','この画面は記号・価格変更専用です。配布ファイルは担当者以外に渡さず、既存ツールで同じ商品を同時に操作しないでください。',app);notice.className='warn';
  ownerSwitch(app);const staffBox=node('section',undefined,app);staff(staffBox);
  if(state.work)return;const ownerBox=node('details',undefined,app);node('summary','オーナー：設定・担当割り当て・結果統合',ownerBox);settings(ownerBox);owner(ownerBox);
 }
 render();
})().catch(e=>{document.getElementById('message').hidden=false;document.getElementById('message').textContent='画面を開始できません：'+e.message;});
