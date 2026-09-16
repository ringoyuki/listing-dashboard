/* Trial pricing rules. No purchase costs, credentials or external writes. */
(function(root) {
  'use strict';
  const END = '2026-10-04';
  function amount(value) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 300) {
      throw new Error('販売価格は300円以上の整数で確認してください');
    }
    return value;
  }
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日付が不正です');
    const d = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== value) throw new Error('日付が不正です');
    return d;
  }
  function period(start) {
    const d = date(start);
    if (start < '2026-09-16' || start > END) throw new Error('試験期間外です');
    d.setUTCDate(d.getUTCDate()+2);
    const end = d.toISOString().slice(0,10) > END ? END : d.toISOString().slice(0,10);
    const restore = date(end);
    restore.setUTCDate(restore.getUTCDate()+1);
    return {start, end, restore:restore.toISOString().slice(0,10)};
  }
  function freshness(value, today, minimumDays) {
    minimumDays = minimumDays === undefined ? 10 : minimumDays;
    if (!Number.isSafeInteger(minimumDays) || minimumDays < 1) throw new Error('観察日数が不正です');
    const normalize = v => String(v||'').trim().replace(/\//g,'-').slice(0,10);
    const source = normalize(value), now = normalize(today);
    const a=date(source), b=date(now);
    const days=Math.floor((b.getTime()-a.getTime())/86400000);
    if(days<0)throw new Error('更新日が未来です');
    const ready=new Date(a.getTime());ready.setUTCDate(ready.getUTCDate()+minimumDays);
    return {source,days,minimumDays,readyOn:ready.toISOString().slice(0,10),wait:days<minimumDays};
  }
  function prices(shops) {
    amount(shops);
    const flea = Math.floor(shops / 1000) * 1000;
    // Never offer a zero-yen price: low-priced flea listings need owner review.
    return {shops, mercari:amount(shops+1000), rakuma:shops,
      yahoo_flea:flea >= 300 ? flea : null, yahoo_auction:shops};
  }
  function discount(price) {
    amount(price);
    return price < 10000 ? Math.min(500, Math.floor(price*0.05)) : price < 30000 ? 1000 : 1500;
  }
  function plan(shops, start, mode, actual) {
    if (!['comment_request','price_first'].includes(mode)) throw new Error('コメントセール方式が未確定です');
    const normal = prices(shops);
    const original = Object.assign({},normal);
    if (actual) {
      Object.keys(actual).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(original,key)) throw new Error('販売先が不正です');
        original[key] = actual[key] === null ? null : amount(actual[key]);
      });
    }
    const timing = period(start);
    const rows = Object.keys(original).map(platform => {
      const before = original[platform];
      if (before === null) return {platform,normal:normal[platform],before:null,after:null,action:'unlisted_or_review'};
      if (platform === 'yahoo_auction') return {platform,normal:normal[platform],before,after:normal[platform],action:'no_sale'};
      // Preserve cross-platform offsets by applying one Shops-based reduction.
      const baseAfter = shops - discount(shops);
      let after = normal[platform] - discount(shops);
      if (platform === 'yahoo_flea') {
        // Round the discounted Shops reference, not the already-rounded flea price.
        // A custom lower current price must never be increased by this proposal.
        after = Math.floor(baseAfter/1000)*1000;
      }
      if (after < 300 || baseAfter < 300) return {platform,normal:normal[platform],before,after:null,action:'owner_review'};
      if (after > before) return {platform,normal:normal[platform],before,after,action:'owner_review'};
      if (after === before) return {platform,normal:normal[platform],before,after,action:'no_change'};
      return {platform,normal:normal[platform],before,after,discount:before-after,
        action:platform==='mercari'||platform==='rakuma' ? mode : 'price_first'};
    });
    return {timing, rows};
  }
  function comment(row, end) {
    date(end);
    if (!['mercari','rakuma'].includes(row.platform)) throw new Error('コメント対象の販売先ではありません');
    if (!['comment_request','price_first'].includes(row.action)) throw new Error('セール対象ではありません');
    amount(row.before); amount(row.after);
    if (row.after >= row.before) throw new Error('値引きがありません');
    const yen = n => n.toLocaleString('ja-JP')+'円';
    const common = '期間限定価格\n'+yen(row.before)+' → '+yen(row.after)+'\n'+end.replace(/-/g,'/')+' 23:59まで。';
    return row.action === 'comment_request'
      ? common+'\n購入をご希望の方は「購入希望」とコメントください。確認後、価格を変更します。'
      : common+'\n販売価格を変更しています。';
  }
  function observation(platform, status, likes, at) {
    if (!['shops','mercari','rakuma','yahoo_flea','yahoo_auction'].includes(platform)) throw new Error('販売先が不正です');
    if (!['checked','unlisted','unknown'].includes(status)) throw new Error('確認状態が不正です');
    if (status === 'checked' && (!Number.isSafeInteger(likes) || likes < 0)) throw new Error('いいね数を整数で入力してください');
    if (!at || !Number.isFinite(Date.parse(at))) throw new Error('確認日時が不正です');
    return {platform,status,likes:status==='checked'?likes:null,at};
  }
  const api = {END,prices,discount,period,freshness,plan,comment,observation};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrialRules = api;
})(typeof window !== 'undefined' ? window : this);
