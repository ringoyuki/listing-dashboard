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
 const api={fingerprint,receipt};if(typeof module!=='undefined')module.exports=api;else root.OwnerCsvSync=api;
})(typeof globalThis!=='undefined'?globalThis:this);
