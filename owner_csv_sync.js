(function(root){'use strict';
 async function fingerprint(work,job){
  const value=JSON.stringify([work.id,work.role,job.code,job.baseItem.shopItemId,job.price,job.symbol]);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 }
 async function receipt(work,feed){
  if(!work)return null;
  if(feed?.format!=='listing-owner-csv-hashes-v1'||!Array.isArray(feed.entries))throw Error('変更済み情報の形式が不正です');
  const entries=new Map();
  for(const e of feed.entries){if(!/^[a-f0-9]{64}$/.test(e.hash)||!Number.isFinite(Date.parse(e.at)))throw Error('変更済み情報が不正です');entries.set(e.hash,e.at);}
  const items=[];let verifiedAt='';
  for(const j of work.jobs){const at=entries.get(await fingerprint(work,j));if(!at)continue;items.push({code:j.code,productId:j.baseItem.shopItemId,price:j.price,symbol:j.symbol});if(at>verifiedAt)verifiedAt=at;}
  return items.length?{format:'listing-owner-csv-applied-v1',id:work.id,role:work.role,verifiedAt,items}:null;
 }
 async function markReviews(work){
  if(!work)return;
  const held=new Set(['e9212594af46bd1d312e40cfd193f82c50aaf59c616bc9131f00d9fe9e7df6ca','6a09b362e4b92913773d2ffc4e489306374a0232fd210cea1fe34c2b9ada3ed0']);
  for(const job of work.jobs){const hash=await fingerprint(work,job);if(held.has(hash)){
   job.emergencyReview='△はオーナーが個別に価格を決めた段階です。通常の価格・記号変更はスキップします。タイムセール・コメントセールは実施可能です。セール終了後も売れ残っている場合は、特価販売の判断をお願いします、と報告してください。';
   job.triangleSaleEnd=hash==='e9212594af46bd1d312e40cfd193f82c50aaf59c616bc9131f00d9fe9e7df6ca'?'2026-09-21T23:00:00+09:00':'2026-09-20T23:00:00+09:00';
  }}
 }
 const api={fingerprint,receipt,markReviews};if(typeof module!=='undefined')module.exports=api;else root.OwnerCsvSync=api;
})(typeof globalThis!=='undefined'?globalThis:this);
