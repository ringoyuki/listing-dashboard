(async()=>{'use strict';await(window.OwnerEntryReady||Promise.resolve());if(!window.RYOwner)await new Promise(r=>window.addEventListener('ry-owner-ready',r,{once:true}));
const R=RYReplenish,N=NormalSales,bridge=RYOwner,key='ry_owner_preflight_v1';let prep=JSON.parse(localStorage.getItem(key)||'null'),catalog=null,source=null;
const panel=document.createElement('section');document.body.append(panel);
const el=(tag,text,parent=panel)=>{const n=document.createElement(tag);n.textContent=text;parent.append(n);return n;};
const status=()=>document.getElementById('replenishment-status');
function download(x,name){const url=URL.createObjectURL(new Blob([JSON.stringify(x,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function button(text,fn){const b=el('button',text);b.className='button';b.onclick=async()=>{try{await fn();}catch(e){status().textContent=e.message;}};return b;}
function fileInput(text,accept,fn){const l=el('label',text),i=document.createElement('input');i.type='file';i.accept=accept;l.append(i);i.onchange=async()=>{try{if(i.files[0])await fn(i.files[0]);}catch(e){status().textContent=e.message;}};}
function savePrep(){const s=JSON.stringify(prep);localStorage.setItem(key,s);if(localStorage.getItem(key)!==s)throw Error('照合データ保存の読戻し失敗');}
function currentPrep(){if(!prep)throw Error('現物・既存センターピンの照合データを読み込んでください');if(N.date(Date.parse(prep.checkedAt))!==N.date(Date.now()))throw Error('本日の照合データが必要です');if(JSON.parse(localStorage.getItem('ry_owner_conflicts_v1')||'[]').length)throw Error('旧受付の追加結果が競合保留中です。照合してから発行してください');return prep;}
function render(){
 panel.replaceChildren();el('h2','JSON補充・センターピン連携');
 el('p','作業終了・最終結果を受領してから切り替えます。旧受付の追加提出は自動統合しません。');
 const m=el('p','');m.id='replenishment-status';
 const conflicts=JSON.parse(localStorage.getItem('ry_owner_conflicts_v1')||'[]');if(conflicts.length)el('p','競合保留 '+conflicts.length+'件。旧受付の追加結果は未反映です。');
 fileInput('オーナー専用の現物・センターピン照合データ ','.json',async f=>{const x=JSON.parse(await f.text());if(x.format!=='ry-owner-preflight-v1'||!Array.isArray(x.center)||!Number.isFinite(Date.parse(x.checkedAt)))throw Error('照合データ形式が違います');R.identities(x.identity);prep=x;savePrep();status().textContent='照合データを端末保存しました。スタッフJSONには含めません。';});
 fileInput('最新Shops商品CSV ','.csv',async f=>{
 const b=await f.arrayBuffer();let text=new TextDecoder('utf-8').decode(b);if(text.includes('\ufffd'))text=new TextDecoder('shift_jis').decode(b);
 const parsed=ShopsCsvReview.parse(text,'product'),base=SingleWork.csv(SingleWork.empty(),text,f.name,Date.now());
 const byId=new Map(parsed.rows.map(r=>[r['商品ID'],r]));if(byId.size!==parsed.rows.length)throw Error('CSVの商品IDが重複しています');
 catalog=base.catalog.map(c=>{const r=byId.get(c.shopItemId),raw=r['商品登録日時']||'';const listedAt=/^\d{4}[/-]\d{2}[/-]\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)?raw.replaceAll('/','-').replace(' ','T')+'+09:00':raw;return {...c,productId:c.shopItemId,listedAt,public:r['商品ステータス']==='2'};});
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
 source={fileName:f.name,modifiedTime:new Date(f.lastModified).toISOString(),createdTime:new Date(f.lastModified).toISOString(),sha256:hash};status().textContent='CSV '+catalog.length+'商品を読み込みました。Driveで最新を選んだことを確認して発行してください。';
 });
 el('p','照合データ：'+(prep?prep.checkedAt:'未取込')+'。転生対応・規定施策終了・既存登録の照合が済んだ現物だけ補充します。');
 for(const [id,r]of Object.entries(bridge.get()).filter(([,r])=>!r.closedBy&&r.receivedAt&&['A','B'].includes(r.file.assignee))){
 const s=R.summary(r);el('p',r.file.assignee+'さん：今回初回処理 '+s.newFirst+'／150。'+(s.notify?'次回JSON補充が必要':'継続中'));
 if(s.notify)button(r.file.assignee+'さん：最終結果を確定し、補充JSONを発行',()=>{
 const p=currentPrep();if(!catalog||!source)throw Error('最新Shops CSVを読み込んでください');
 const records=bridge.get(),day=N.date(Date.now()).replaceAll('-','');let seq=Date.now();while(records[day+'_'+String(seq)])seq++;
 const receipt=day+'_'+String(seq).padStart(4,'0'),out=R.issue(records,receipt,source,catalog,p.identity,p.center,Date.now(),id);
 const next={...records,[id]:{...r,closedBy:receipt,closedAt:new Date().toISOString()},[receipt]:{file:out.file,events:[],issuedFrom:id,notified:false}};
 bridge.save(next);download(out.file,N.filename(out.file));render();status().textContent=out.addedProducts+'商品・'+out.addedLanes+'販路を追加。旧受付を終了しました。新JSONをスタッフへ渡してください。';
 });
 }
 button('発行済みの最新補充JSONを再保存',()=>{for(const r of Object.values(bridge.get()).filter(r=>r.issuedFrom&&!r.closedBy))download(r.file,N.filename(r.file));});
 button('センターピン照合済み取込データを保存',()=>{const p=currentPrep(),c=R.centerCandidates(bridge.get(),p.identity),plan=R.centerPlan(c,p.center);plan.checkedAt=p.checkedAt;plan.spreadsheetId=p.spreadsheetId;download(plan,'RY_センターピン取込_'+N.date(Date.now())+'.json');status().textContent='確定対象 '+c.fixed.length+'／相談 '+c.consult.length+'／例外 '+c.exceptions.length+'。シート反映は未実施。G・I列を変更するデータはありません。';});
 button('オーナー管理の控えを保存',()=>download({format:'ry-owner-backup-v1',records:bridge.get(),preflight:prep,conflicts},'RY_オーナー控え_'+N.date(Date.now())+'.json'));
 el('p','シート書込みはGoogleの正規認証で行います。この画面から公開URL経由で書き込みません。照合データとオーナー控えはスタッフに渡さないでください。');
}
window.refreshReplenishment=render;render();
})();

