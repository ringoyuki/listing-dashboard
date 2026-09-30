const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./daily_work_core'),P=require('./daily_sale_plan'),L=require('./staff_product_links');
class Element{
 constructor(tag,text=''){this.tagName=tag;this.textContent=text;this.children=[];this.value='';}
 appendChild(n){this.children.push(n);n.parent=this;return n;}
 replaceChildren(){this.children=[];}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 scrollIntoView(){}
 querySelector(){return null;}
}
function harness(){
 const now=Date.now(),end=new Date(now+3600000).toISOString();
 const job={id:'demo',code:'合成_1',productId:'test',title:'架空商品',platform:'mercari',kind:'sale',price:9000,normalPrice:10000,url:'https://jp.mercari.com/item/m1234',startAt:new Date(now-60000).toISOString(),endAt:end};
 const initial=P.pause(P.prepare(C.merge({jobs:[]},{format:'daily-staff-v1',batch:'synthetic',jobs:[job]}),now),'mercari',end,now);
 const data=new Map([['daily_staff_work_v1',JSON.stringify(initial)]]);
 const document={createElement:t=>new Element(t),body:new Element('body'),head:new Element('head')};
 const ctx={document,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},DailyWorkCore:C,DailySalePlan:P,StaffProductLinks:L,items:[{code:job.code,shopItemId:job.productId,stock:1}],Date,console,setInterval:()=>{},setTimeout:()=>{},smGetAll:()=>({}),navigator:{clipboard:{writeText:async()=>{}}}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('daily_work_ui.js','utf8'),ctx);ctx.openDailyWork();
 function all(n=document.body){return [n,...n.children.flatMap(all)];}
 function button(label){const b=all().find(n=>n.tagName==='button'&&n.textContent===label);assert.ok(b,'button '+label);return b;}
 return {ctx,data,all,button};
}
test('スタッフに対象作成フォームを出さず、共有未設定と指定候補を表示',async()=>{const h=harness();const texts=h.all().map(n=>n.textContent).join('\n');assert.doesNotMatch(texts,/セール対象を準備|この販路をセール予定に追加/);assert.match(texts,/共有接続は未設定/);await h.button('指定されたセール候補').onclick();assert.ok(h.all().some(n=>n.tagName==='h3'&&n.textContent.includes('合成_1')));assert.equal(h.button('変更作業を完了').disabled,true);});
test('価格の食い違いはコピーも完了も停止し、正しい確認後は終了作業を残す',async()=>{const h=harness();await h.button('指定されたセール候補').onclick();h.all().filter(n=>n.tagName==='input')[0].value='9800';await h.button('実価格を記録して作業条件を確認').onclick();assert.equal(h.button('変更作業を完了').disabled,true);assert.equal(h.button('価格をコピー').disabled,true);h.all().filter(n=>n.tagName==='input')[0].value='10000';await h.button('実価格を記録して作業条件を確認').onclick();assert.equal(h.button('変更作業を完了').disabled,false);await h.button('変更作業を完了').onclick();const s=JSON.parse(h.data.get('daily_staff_work_v1'));assert.equal(s.jobs.find(r=>r.id==='demo:restore').status,'pending');assert.equal(s.jobs.find(r=>r.id==='demo').status,'done');});
test('別画面の更新を古い画面から上書きしない',async()=>{const h=harness();await h.button('指定されたセール候補').onclick();const state=JSON.parse(h.data.get('daily_staff_work_v1'));state.marker='new-state';h.data.set('daily_staff_work_v1',JSON.stringify(state));h.all().filter(n=>n.tagName==='input')[0].value='10000';await h.button('実価格を記録して作業条件を確認').onclick();assert.equal(JSON.parse(h.data.get('daily_staff_work_v1')).marker,'new-state');assert.match(h.all().map(n=>n.textContent).join('\n'),/別の画面で記録が更新/);});
test('旧セール中の通常価格変更は販売先を変更する前からコピー禁止',async()=>{const h=harness();h.ctx.smGetAll=()=>({'合成_1':{tasks:[{type:'revert_check',status:'pending',dueDate:'2099-01-01',id:'old'}]}});const s=JSON.parse(h.data.get('daily_staff_work_v1'));const j={...s.jobs[0].spec,id:'regular',kind:'price'};h.ctx.DailyWork.receiveApprovedInstructions({format:'daily-staff-v1',batch:'regular',jobs:[j]});await h.button('開始・予約待ち 1').onclick();assert.equal(h.button('価格をコピー').disabled,true);assert.equal(h.button('変更作業を完了').disabled,true);});
test('手動登録は緊急用に残し、開く前は入力フォームを表示しない',async()=>{const h=harness();assert.equal(h.all().filter(n=>n.tagName==='input').length,0);await h.button('緊急登録フォームを開く').onclick();assert.ok(h.all().some(n=>n.tagName==='h3'&&n.textContent==='緊急用｜手動で見つけた商品の登録'));assert.equal(h.all().filter(n=>n.tagName==='input').length,7);assert.match(h.all().map(n=>n.textContent).join('\n'),/追加の値引きはここでは設定しません/);});
