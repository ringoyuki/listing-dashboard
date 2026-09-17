(()=>{'use strict';
 const $=id=>document.getElementById(id);let data=null,raw=null,rows=null,selected=new Set(),generation=0;
 function invalidate(){rows=null;selected.clear();$('price-preview').hidden=true;$('price-confirm').checked=false;$('price-files').replaceChildren();}
 function setData(next){data=next;generation++;invalidate();$('price-tool').hidden=!next;}
 $('price-json').onchange=async()=>{raw=null;invalidate();const current=++generation,file=$('price-json').files[0];if(!file)return;
  try{const next=JSON.parse(await file.text());ShopsPriceCsv.instructions(next);if(current!==generation)return;raw=next;$('price-message').textContent='指示JSONを読み込みました。変更一覧を作成してください。';}catch(e){if(current===generation)$('price-message').textContent=e.message;}
 };
 function count(){ $('price-confirm').checked=false;$('price-files').replaceChildren();$('price-selected').textContent='選択 '+selected.size+'件 ／ 変更可能 '+rows.filter(r=>r.eligible).length+'件';}
 function render(){
  $('price-rows').replaceChildren();const frag=document.createDocumentFragment();
  for(const r of rows){const tr=document.createElement('tr'),td=document.createElement('td'),box=document.createElement('input');box.type='checkbox';box.disabled=!r.eligible;box.checked=selected.has(r.id);box.setAttribute('aria-label',r.code+'を一括変更');box.onchange=()=>{if(box.checked)selected.add(r.id);else selected.delete(r.id);count();};td.append(box);tr.append(td);
   [r.code+'（'+r.role+'担当） '+r.title,(r.beforePrice??'—')+'円 → '+r.targetPrice+'円',(r.beforeSymbol||'—')+' → '+r.targetSymbol,r.eligible?'変更可能':r.reasons.join('／')].forEach(v=>{const c=document.createElement('td');c.textContent=v;tr.append(c);});frag.append(tr);
  }$('price-rows').append(frag);count();
 }
 $('preview-price').onclick=()=>{invalidate();try{if(!data||!raw)throw Error('CSVの照合と指示JSONの選択を先に行ってください');rows=ShopsPriceCsv.plan(data[0],data[2],raw);$('price-preview').hidden=false;render();$('price-message').textContent='変更可能な商品の中から対象を選択してください。対象外は理由を表示しています。';}catch(e){$('price-message').textContent=e.message;}};
 $('price-all').onclick=()=>{if(!rows)return;selected=new Set(rows.filter(r=>r.eligible).map(r=>r.id));render();};
 $('price-none').onclick=()=>{if(!rows)return;selected.clear();render();};
 $('price-confirm').onchange=()=>{$('price-files').replaceChildren();if(!$('price-confirm').checked||!selected.size)return;
  try{const files=ShopsPriceCsv.exportFiles(data[0],data[2],raw,[...selected]);const labels={price:'価格のみ',symbol:'記号のみ',price_symbol:'価格と記号'};
   for(const file of files){const button=document.createElement('button');button.textContent=labels[file.type]+'：'+file.count+'件のCSVを保存';button.onclick=()=>{
    try{const current=ShopsPriceCsv.exportFiles(data[0],data[2],raw,[...selected]).find(f=>f.type===file.type);if(!current||!$('price-confirm').checked)throw Error('変更一覧を再確認してください');
     const bytes=ShopsSaleCsv.encodeSjis(current.csv),url=URL.createObjectURL(new Blob([bytes],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='shops_product_update_'+file.type+'_'+new Date().toISOString().replace(/[:.]/g,'-')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);button.textContent=labels[file.type]+'：保存済み（再保存可）';$('price-message').textContent='CSVを保存しました。Shopsへの変更はまだ行われていません。変更後は最新の商品CSVを再取得して確認してください。';
    }catch(e){$('price-message').textContent='保存中止：'+e.message;}
   };$('price-files').append(button);}
  }catch(e){$('price-message').textContent=e.message;}
 };
 window.ShopsPriceUi={setData};
})();
