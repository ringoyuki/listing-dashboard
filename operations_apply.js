/* Apply public settings before sale manager is loaded. */
(function(){const c=window.OPERATIONS_CONFIG;if(!c)return;
 if(typeof CONFIG!=='undefined'){
  CONFIG.SALE_INTERVAL=c.interval;CONFIG.HIGH_PRICE_ALERT=c.highPrice;
  CONFIG.SALE_DISC_AMT=c.discountMode==='fixed'?c.discountValue:500;
  CONFIG.SYMBOL_RATES=Object.fromEntries(['●','■','▲','〇','□'].map((s,i)=>[s,c.rates[i]/100]));
 }
})();
function smConfiguredDiscount(price){const c=window.OPERATIONS_CONFIG;const amount=c?(c.discountMode==='fixed'?c.discountValue:Math.floor(Number(price)*c.discountValue/100)):SALE_DISC_AMT;if(!Number.isSafeInteger(amount)||amount<1||Number(price)-amount<300){alert('値下げ後の価格が範囲外です。オーナーへ確認してください。');throw Error('値下げ後の価格が範囲外');}return amount;}
