(()=>{'use strict';
  const $=id=>document.getElementById(id);let result=null,busy=false,data=null,preview=null,selected=new Set();
  const kinds=['product','registration','update'];
  function resetPreview(){preview=null;selected.clear();$('sale-preview').hidden=true;$('sale-confirm').checked=false;$('export-sale').disabled=true;}
  function clear(){result=null;data=null;$('result').hidden=true;$('sale').hidden=true;resetPreview();window.ShopsPriceUi?.setData(null);}
  kinds.forEach(k=>$(k).addEventListener('change',()=>{clear();$('message').textContent='ファイルが変わりました。「3つのCSVを照合する」を押してください。';}));
  async function read(file){const b=await file.arrayBuffer();try{return new TextDecoder('utf-8',{fatal:true}).decode(b);}catch{return new TextDecoder('shift_jis',{fatal:true}).decode(b);}}
  $('run').onclick=async()=>{
    if(busy)return;clear();const files=kinds.map(k=>$(k).files[0]);
    if(files.some(f=>!f)){$('message').textContent='3種類すべてのCSVを選択してください。設定済み0件のCSVも必要です。';return;}
    busy=true;$('run').disabled=true;kinds.forEach(k=>$(k).disabled=true);
    try{data=await Promise.all(files.map(async(f,i)=>ShopsCsvReview.parse(await read(f),kinds[i])));
      result=ShopsCsvReview.analyze(...data);result.sources=files.map((f,i)=>({kind:kinds[i],name:f.name,lastModified:f.lastModified}));
      window.ShopsPriceUi?.setData(data);
      const c=result.counts;$('summary').textContent=`商品 ${c.products}件 ／ 候補 ${c.candidates}件 ／ 対象外 ${c.excluded}件 ／ 照合不能 ${c.unmatched}件`;
      $('message').textContent=`照合しました。未設定 ${c.registration}件・設定済み ${c.update}件。\n`+files.map(f=>f.name).join('\n');$('result').hidden=false;$('sale').hidden=false;render();
    }catch(e){clear();$('message').textContent='照合を中止しました：'+e.message;}finally{busy=false;$('run').disabled=false;kinds.forEach(k=>$(k).disabled=false);}
  };
  function render(){if(!result)return;const q=$('search').value.toLowerCase(),f=$('filter').value;
    const selected=result.rows.filter(r=>(f==='all'||r.status===f)&&[r.code,r.title,r.id].join(' ').toLowerCase().includes(q));
    $('shown').textContent=`該当 ${selected.length}件`;$('rows').replaceChildren();const frag=document.createDocumentFragment();
    for(const r of selected){const tr=document.createElement('tr');const values=[(r.code||'管理番号未登録')+'\n'+r.id,r.title,r.price==null?'—':`${r.price.toLocaleString()}円 ／ 在庫 ${r.stock??'不明'}`,`いいね ${r.likes??'—'} ／ 閲覧 ${r.views??'—'}`,r.status+(r.reasons.length?'：'+r.reasons.join('／'):'')];values.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;td.style.whiteSpace='pre-wrap';if(i===1)td.className='title';if(i===4&&r.status==='候補')td.className='candidate';tr.append(td);});frag.append(tr);}$('rows').append(frag);
  }
  $('filter').onchange=render;$('search').oninput=render;
  const optionIds=['discount-mode','discount-amount','sale-start','sale-end'];
  optionIds.forEach(id=>$(id).addEventListener('input',()=>{resetPreview();$('sale-message').textContent='条件が変わりました。価格の変更一覧を作り直してください。';}));
  function options(){return {mode:$('discount-mode').value,amount:$('discount-amount').value,start:$('sale-start').value,end:$('sale-end').value};}
  function updateSelection(){
    $('sale-confirm').checked=false;$('export-sale').disabled=true;
    $('sale-selected').textContent=`出力対象 ${selected.size}件 ／ 出力可能 ${preview.rows.filter(r=>r.eligible).length}件`;
  }
  function renderSale(){
    $('sale-rows').replaceChildren();const frag=document.createDocumentFragment();
    for(const r of preview.rows){const tr=document.createElement('tr'),cell=document.createElement('td'),check=document.createElement('input');
      check.type='checkbox';check.checked=selected.has(r.id);check.disabled=!r.eligible;check.setAttribute('aria-label',(r.code||r.id)+'を出力');
      check.onchange=()=>{if(check.checked)selected.add(r.id);else selected.delete(r.id);updateSelection();};cell.append(check);tr.append(cell);
      const money=v=>v==null?'—':v.toLocaleString()+'円';
      [(r.code||'管理番号未登録')+' '+r.title,money(r.price),money(r.referencePrice)+'（'+r.referenceRule+'）',money(r.salePrice),r.eligible?'出力可能':r.saleReasons.join('／')].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});frag.append(tr);
    }$('sale-rows').append(frag);updateSelection();
  }
  $('preview-sale').onclick=()=>{
    resetPreview();if(!data)return;
    try{preview=ShopsSaleCsv.plan(...data,options());$('sale-message').textContent=`開始 ${preview.options.start.replace('T',' ')} → 終了 ${preview.options.end.replace('T',' ')}（日本時間）。現在価格から計算しています。出力対象を選んでください。`;$('sale-preview').hidden=false;renderSale();}
    catch(e){$('sale-message').textContent=e.message;}
  };
  $('select-all').onclick=()=>{if(!preview)return;selected=new Set(preview.rows.filter(r=>r.eligible).map(r=>r.id));renderSale();};
  $('select-none').onclick=()=>{selected.clear();if(preview)renderSale();};
  $('sale-confirm').onchange=()=>{$('export-sale').disabled=!($('sale-confirm').checked&&selected.size>0);};
  $('export-sale').onclick=()=>{
    if(!data||!preview||!$('sale-confirm').checked||!selected.size)return;
    try{
      if(JSON.stringify(options())!==JSON.stringify(preview.options))throw Error('条件が変わりました。変更一覧を作り直してください');
      const csv=ShopsSaleCsv.exportCsv(...data,preview.options,[...selected]);
      const bytes=ShopsSaleCsv.encodeSjis(csv),url=URL.createObjectURL(new Blob([bytes],{type:'text/csv'})),a=document.createElement('a');
      a.href=url;a.download='timesale_registration_prepared_'+new Date().toISOString().replace(/[:.]/g,'-')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      $('sale-message').textContent=`${selected.size}件のCSVを保存しました。セール予約はまだ行われていません。同じCSVの重複アップロードを避け、Shopsの設定履歴を確認してください。`;
      $('sale-confirm').checked=false;$('export-sale').disabled=true;
    }catch(e){$('sale-message').textContent='保存を中止しました：'+e.message;$('sale-confirm').checked=false;$('export-sale').disabled=true;}
  };
  $('save').onclick=()=>{if(!result)return;const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Shops照合結果_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();
