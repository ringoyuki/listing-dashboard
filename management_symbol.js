(function(root){'use strict';
 function read(description,code){
  const text=String(description||'');
  const matches=[...text.matchAll(/(?:^|\r\n|\n|\r)[ \t　]*([●■▲〇□○△])[ \t　]*管理番号[^\r\n]*(?:\r\n|\n|\r)([^\r\n]*)/g)];
  if(matches.length!==1)return {symbol:'',error:'管理番号欄の記号を一意に確認できません'};
  if(matches[0][2].trim()!==String(code||'').trim())return {symbol:'',error:'説明文と商品管理コードが一致しません'};
  return {symbol:matches[0][1],error:''};
 }
 const api={read};if(typeof module!=='undefined')module.exports=api;root.ManagementSymbol=api;
})(typeof globalThis!=='undefined'?globalThis:this);
