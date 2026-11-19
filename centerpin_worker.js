(()=>{'use strict';
const C=window.CenterpinCore,KEY='centerpin_oneworker_v1';let state=C.empty(),filter='open',fault=false;
const $=x=>document.getElementById(x), el=(tag,text,parent,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;if(parent)parent.appendChild(n);return n;};
function msg(s){$('msg').textContent=s;}
try{const raw=localStorage.getItem(KEY);if(raw){const obj=JSON.parse(raw);if(obj.format!=='centerpin-worker-results-v1'||!Array.isArray(obj.jobs))throw Error();state=obj;}}catch(e){fault=true;msg('以前の保存が壊れています。上書きは停止しました。');}
function persist(next){if(fault)throw Error('保存状態が読めないため上書きしません');const raw=JSON.stringify(next);localStorage.setItem(KEY,raw);if(localStorage.getItem(KEY)!==raw)throw Error('保存後の読み戻しに失敗しました');state=next;}
function link(text,url,parent){if(!url||typeof url!=='string')return;try{const u=new URL(url);if(u.protocol!=='https:')return;const a=el('a',text,parent);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch(e){}}
function money(n){return n==null?'指定なし':Number(n).toLocaleString('ja-JP')+'円';}
function actionName(a){return {sale:'期間限定セール',price:'価格変更',relist:'写真撮り直し・転生出品',yahoo_auction:'Yahoo!オークション（1円）',mercari_auction:'メルカリオークション（損益分岐）',hold:'価格維持・確認'}[a]||a;}
function stageName(x){return {pending:'未着手',started:'開始済み',notice:'終了前日告知済み',draft:'下書き保存済み',blocked:'確認待ち',done:'実作業完了',sold:'売却報告',unsold:'未落札終了'}[x]||x;}
function run(id,action){try{const time=new Date().toISOString();const r=state.jobs.find(x=>x.id===id);if(action==='done'&&!confirm('販売先で実作業を終えたことを確認しましたか？（セールの場合は価格復帰・関連コメント削除も含みます）'))return;
if(action==='unsold'&&!confirm('オークション終了と未落札を確認しましたか？'))return;
persist(C.change(state,id,action,time));msg('保存しました。終了時に結果JSONを出力してください。');render();}catch(e){msg(e.message);}}
function render(){const jobs=state.jobs;
$('count').textContent=`読み込み済み ${jobs.length}件 ／ 未完了 ${jobs.filter(x=>C.ACTIVE.includes(x.status)).length}件 ／ 完了・売却・未落札 ${jobs.filter(x=>!C.ACTIVE.includes(x.status)).length}件`;
const list=$('jobs');list.replaceChildren();const visible=jobs.filter(x=>filter==='all'||(filter==='open')===C.ACTIVE.includes(x.status));
for(const x of visible){const j=x.job,card=el('article',null,list),title=el('h2',j.code+'｜'+actionName(j.action),card);el('div',j.title,card);el('p',`管理元 ${j.ledgerKey} ／ 旧行 ${j.sourceRow} ／ ${stageName(x.status)}`,card,'muted');
const p=el('p',null,card);el('span','実施価格 '+money(j.price),p,'price');if(j.action==='sale')el('span',' ／ 通常価格 '+money(j.normalPrice),p);if(j.action==='yahoo_auction')el('span',' ／ 予定 '+new Date(j.startAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+' ～ '+new Date(j.endAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}),p);
if(x.noticeDate)el('p','セール終了前日：'+x.noticeDate+' ／ 期間終了：'+new Date(x.saleEndAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}),card,'warning');
const links=el('div',null,card,'row');link('台帳を開く',j.ledgerUrl,links);link('Shopsを開く',j.shopUrl,links);link('メルカリ管理番号検索','https://jp.mercari.com/search?keyword='+encodeURIComponent(j.code),links);
const acts=el('div',null,card,'row');const b=(label,action)=>{const v=el('button',label,acts);v.onclick=()=>run(x.id,action);};
if(x.status==='pending'){if(['sale','yahoo_auction','mercari_auction'].includes(j.action))b('開始済み','started');if(j.action==='relist')b('下書き保存済み','draft');if(['price','relist','hold'].includes(j.action))b('実作業完了','done');b('売却済み','sold');b('要確認','blocked');}
else if(x.status==='started'){if(j.action==='sale')b('終了前日コメント投稿済み','notice');if(['yahoo_auction','mercari_auction'].includes(j.action))b('未落札で終了','unsold');b('実作業完了','done');b('売却済み','sold');b('要確認','blocked');}
else if(x.status==='notice'){b('セール価格復帰・コメント削除完了','done');b('売却済み','sold');}
else if(x.status==='draft'){b('新ページ公開確認済み','done');b('要確認','blocked');}
else if(x.status==='blocked'){b('未着手へ戻す','pending');b('開始済み','started');b('実作業完了','done');b('売却済み','sold');}
}
if(!visible.length)el('p','この表示の作業はありません。',list,'muted');}
$('pick').addEventListener('change',async e=>{try{const f=e.target.files?.[0];if(!f)return;const b=JSON.parse(await f.text());const next=C.merge(state,b);persist(next);msg(`指示 ${b.jobs.length}件を検証し、取り込みました。`);render();}catch(e){msg('取り込みできません：'+e.message);}e.target.value='';});
$('export').addEventListener('click',()=>{try{const out=C.resultFile(state,new Date().toISOString());const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));const a=el('a','',document.body);a.href=url;a.download='センターピン_スタッフ結果_'+new Date().toISOString().slice(0,10)+'.json';a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);msg('結果JSONを保存しました。ファイルをオーナーへ返してください。');}catch(e){msg(e.message);}});
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{filter=b.dataset.filter;render();});
window.addEventListener('storage',e=>{if(e.key===KEY){fault=true;msg('別の画面で作業記録が更新されました。重複操作を避けて再読み込みしてください。');}});
render();})();