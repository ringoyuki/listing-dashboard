/* Convenience gate only; this is not server-side authentication. */
(function(root){'use strict';
 const key='listing-owner-simple-login-v1',digest='401177ff45a5c8f91679dc374c69a082e9089f89a3c406c820a738a8b5b94ca0';
 function normalize(value){return String(value).normalize('NFKC').trim();}
 async function matches(id,password){
  const a=normalize(id),b=normalize(password);if(!/^\d{4}$/.test(a)||!/^\d{4}$/.test(b))return false;
  const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(a+':'+b));
  return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')===digest;
 }
 async function enter(){
  if(new URLSearchParams(root.location.search).get('ownerSwitch')!=='1')return;
  const main=document.querySelector('main');
  function toolbar(){const nav=document.createElement('nav');nav.style.cssText='padding:12px;background:#1d2230;border-radius:10px;margin-bottom:16px';
   const link=document.createElement('a');link.href='shops_csv.html';link.textContent='Shops CSV照合・タイムセール予約の準備を開く';nav.append(link);
   const logout=document.createElement('button');logout.type='button';logout.textContent='ログアウト';logout.onclick=()=>{try{sessionStorage.removeItem(key);}catch{}root.location.reload();};nav.append(logout);main.prepend(nav);
  }
  try{if(sessionStorage.getItem(key)==='open'){toolbar();return;}}catch{}
  main.hidden=true;
  const box=document.createElement('section');box.style.cssText='max-width:420px;margin:60px auto;padding:28px';
  const title=document.createElement('h1');title.textContent='オーナー用ログイン';box.append(title);
  const help=document.createElement('p');help.textContent='ID・パスワードは半角・全角どちらでも入力できます。';box.append(help);
  const form=document.createElement('form');box.append(form);
  function field(label,type,autocomplete){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type=type;input.inputMode='numeric';input.autocomplete=autocomplete;input.required=true;l.append(input);form.append(l);return input;}
  const id=field('ログインID','text','username'),password=field('パスワード','password','current-password');
  const submit=document.createElement('button');submit.type='submit';submit.textContent='ログイン';form.append(submit);
  const message=document.createElement('p');message.setAttribute('role','status');form.append(message);document.body.append(box);id.focus();
  await new Promise(resolve=>{form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;
   try{if(!await matches(id.value,password.value)){message.textContent='IDまたはパスワードが違います。';return;}
    try{sessionStorage.setItem(key,'open');}catch{}password.value='';box.remove();main.hidden=false;toolbar();resolve();
   }catch{message.textContent='ログイン処理を開始できません。ページを再読み込みしてください。';}finally{submit.disabled=false;}
  };});
 }
 root.OwnerSimpleLogin={enter,normalize,matches};
 if(typeof module!=='undefined')module.exports={normalize,matches};
})(typeof globalThis!=='undefined'?globalThis:this);
