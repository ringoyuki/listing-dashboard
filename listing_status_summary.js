(()=>{'use strict';
window.updateStats=function(){document.getElementById('stat-total').textContent=items.filter(i=>!i.csvAbsent&&String(i.status)==='2'&&i.stock>=1).length;};
const search=window.doSearch;
window.doSearch=function(){const priv=document.getElementById('filter-private'),sold=document.getElementById('filter-sold'),previous=priv?.checked;if(priv&&sold?.checked)priv.checked=true;try{search.apply(this,arguments);}finally{if(priv)priv.checked=previous;}document.querySelectorAll('#results .rbadge-private').forEach(n=>{if(n.textContent.includes('非公開保存')&&!n.nextElementSibling?.classList.contains('extra-zero-stock')){const b=document.createElement('span');b.className='rbadge rbadge-sold extra-zero-stock';b.textContent='📦 売り切れ';n.after(b);}});};
updateStats();
})();
