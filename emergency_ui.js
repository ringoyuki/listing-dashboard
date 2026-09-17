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
 function resultFile(w){return {format:'listing-ab-result-v1',id:w.id,role:w.role,exportedAt:now(),records:Object.values(state.records||{}).filter(r=>w.jobs.some(j=>j.code===r.code)),resume:{work:clone(w),drafts:clone(state.drafts||{}),updatedAt:state.workUpdatedAt||now()}};}
 function staff(parent){node('h2','スタッフ：A用／B用ファイルを読み込む',parent);
  upload('前回の作業結果から途中入力も復元する',raw=>{if(raw.format!=='listing-ab-result-v1'||!raw.resume||raw.resume.work.id!==raw.id||raw.resume.work.role!==raw.role)throw Error('復元用の作業結果ではありません');if(state.work&&(state.work.id!==raw.id||state.work.role!==raw.role))throw Error('別の担当・配布データが開いています');if(state.work&&state.workUpdatedAt&&raw.resume.updatedAt<state.workUpdatedAt)throw Error('現在より古い保存結果です。上書きしません');const work=R.validateWork(raw.resume.work);if(!Array.isArray(raw.records)||new Set(raw.records.map(r=>r.code)).size!==raw.records.length)throw Error('完了記録が不正です');for(const r of raw.records){const j=work.jobs.find(j=>j.code===r.code);if(!j||r.role!==raw.role)throw Error('担当外の記録があります');R.record(j,r.checks,r.completedAt);}state.work=work;state.records=Object.fromEntries(raw.records.map(r=>[r.code,r]));state.drafts=raw.resume.drafts||{};},parent);
  upload('担当の配布ファイル',raw=>{if(raw.format!=='listing-ab-work-v1'||!['A','B'].includes(raw.role)||!Array.isArray(raw.jobs)||raw.jobs.some(j=>j.role!==raw.role))throw Error('担当別の配布ファイルではありません');if(state.work&&state.work.id!==raw.id&&Object.keys(state.records||{}).length)throw Error('前の作業結果を保存し、別のブラウザプロファイルで新しい配布を開始してください');if(state.work&&state.work.id===raw.id&&state.work.role!==raw.role)throw Error('同じ保存領域でA・Bを切り替えないでください');R.validateWork(raw);if(state.work&&state.work.id!==raw.id)throw Error('別の配布が開いています。結果を保存してオーナーへ確認してください');if(state.work)for(const j of state.work.jobs){const next=raw.jobs.find(n=>n.code===j.code);if(next&&R.stable(next)!==R.stable(j))throw Error('配布済み商品の指示が変わっています。オーナーへ確認してください');if(!next&&!state.records[j.code])throw Error('未完了の商品が新しい配布から欠落しています');}state.work=raw;state.records=state.records||{};state.drafts=state.drafts||{};},parent);
  const w=state.work;if(!w)return;node('h2',w.role+'画面：担当'+w.jobs.length+'件／完了'+w.jobs.filter(j=>state.records&&state.records[j.code]).length+'件',parent);node('p','記号・価格変更のみ。再出品・セールは行いません。価格相違、売却済み、商品不一致は保留してオーナーへ確認してください。',parent);
  button('作業結果を保存して渡す',()=>download(w.role+'作業結果_'+now().slice(0,16).replace(/:/g,'')+'_'+w.id+'.json',resultFile(w)),parent);
  if(w.jobs.length&&w.jobs.every(j=>state.records[j.code]))button('全件完了：結果を保存して次の配布へ',()=>{download(w.role+'作業結果_'+w.id+'.json',resultFile(w));state.archives=state.archives||[];state.archives.push({work:state.work,records:state.records,drafts:state.drafts});delete state.work;state.records={};state.drafts={};save();render();},parent);
  w.jobs.forEach(j=>{const section=node('details',undefined,parent);node('summary',(state.records[j.code]?'完了：':'未完了：')+j.code+' ／ '+j.baseItem.title,section);node('h2',j.symbol+' ／ Shops指定価格 '+j.price.toLocaleString()+'円',section);
   const shopid=j.baseItem.shopItemId;if(shopid){const a=node('a','Shops商品ページ',section);a.href='https://jp.mercari.com/shops/product/'+encodeURIComponent(shopid);a.target='_blank';a.rel='noopener';}
   const draft=state.drafts[j.code]||(state.drafts[j.code]={});
   Object.keys(j.platforms).forEach(p=>{const box=node('section',undefined,section),target=j.platforms[p];node('h3',labels[p]+'：'+(target===null?'オーナー確認':target.toLocaleString()+'円に合わせる'),box);
    const q=encodeURIComponent(j.code),qt=encodeURIComponent(j.baseItem.title||j.code),search={mercari:'https://jp.mercari.com/search?keyword='+q,rakuma:'https://fril.jp/s?query='+q,yahoo_flea:'https://paypayfleamarket.yahoo.co.jp/search/'+q+'?page=1',yahoo_auction:'https://auctions.yahoo.co.jp/search/search?p='+qt};
    let href=p==='shops'?j.baseItem.shopsUrl:search[p];if(href){try{const u=new URL(href);if(u.protocol==='https:'&&['mercari-shops.com','jp.mercari.com','fril.jp','paypayfleamarket.yahoo.co.jp','auctions.yahoo.co.jp'].includes(u.hostname)){const a=node('a',p==='shops'?'Shops管理画面を開く':'商品を検索する',box);a.href=u.href;a.target='_blank';a.rel='noopener';}}catch(e){}}
    const d=draft[p]||(draft[p]={status:'pending',confirmed:false,symbolConfirmed:false});
    const before=input('number',d.before,box);before.placeholder='変更前の商品ページの実価格';before.oninput=()=>{d.before=before.value===''?null:Number(before.value);save();};
    if(target!==null)button('指定価格をコピー',async()=>{if(!Number.isSafeInteger(d.before)||d.before<target)throw Error('変更前の実価格を確認してください。指定価格より安い場合は値上げせず保留してください');await navigator.clipboard.writeText(String(target));msg('指定価格をコピーしました。価格と記号を確認して記録してください。');},box);
    const status=select([['pending','未完了・確認待ち'],['done','指定価格に変更済み（同額なら価格変更不要）'],...(p==='shops'?[]:[['unlisted','未出品と確認済み']])],d.status,box);
    const price=input('number',d.price,box);price.placeholder='変更後の実価格';status.onchange=()=>{d.status=status.value;save();};price.oninput=()=>{d.price=price.value===''?null:Number(price.value);save();};
    check('商品が一致し、作業結果／未出品の根拠を確認した',d.confirmed,v=>{d.confirmed=v;save();},box);
    check('指定記号への変更を確認した（ヤフオクは価格確認のみ）',d.symbolConfirmed,v=>{d.symbolConfirmed=v;save();},box);
   });
   const note=input('text',draft.note||'',section);note.placeholder='保留理由・オーナーへの確認事項';note.oninput=()=>{draft.note=note.value;save();};
   const done=button('各販路の確認を終えて完了にする',async()=>{if(state.records[j.code])throw Error('すでに完了しています');state.records[j.code]=R.record(j,draft,now());await save();render();},section);done.disabled=!!state.records[j.code];
  });
 }
 function render(){app.replaceChildren();const notice=node('p','この画面は記号・価格変更専用です。配布ファイルは担当者以外に渡さず、既存ツールで同じ商品を同時に操作しないでください。',app);notice.className='warn';
  const staffBox=node('section',undefined,app);staff(staffBox);
  if(state.work)return;const ownerBox=node('details',undefined,app);node('summary','オーナー：設定・担当割り当て・結果統合',ownerBox);settings(ownerBox);owner(ownerBox);
 }
 render();
})().catch(e=>{document.getElementById('message').hidden=false;document.getElementById('message').textContent='画面を開始できません：'+e.message;});
