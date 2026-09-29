(function (root) {
  'use strict';
  function shopsNoticeWindow(isoInstant) {
    var date = new Date(isoInstant);
    if (!Number.isFinite(date.getTime())) return null;
    var hour = new Date(date.getTime() + 9 * 3600000).getUTCHours();
    return hour >= 9 && hour < 23;
  }
  var api = { shopsNoticeWindow: shopsNoticeWindow };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root.document) return;
  var doc = root.document;
  function mount() {
    if (doc.getElementById('price-timing-guidance')) return;
    var host = doc.querySelector('main') || doc.getElementById('app-main');
    if (!host) return;
    var panel = doc.createElement('details');
    panel.id = 'price-timing-guidance';
    panel.style.cssText = 'margin:16px;padding:12px 16px;border:1px solid #708098;border-radius:8px;line-height:1.7';
    panel.innerHTML = '<summary>価格変更する時間帯の目安</summary><p>メルカリShopsの値下げ通知は23:00〜翌9:00（日本時間）には送信されません。通常メルカリに同じ時間制限は確認できていません。</p><p>100円・500円の値下げや記号の変更だけで通知・上位表示が保証されるわけではありません。12時台・20時台は比較を始める候補です。商品ごとの実際の更新時刻で結果を記録します。</p><p>セール予約・開催中の商品は、その終了後に在庫と現行価格を確認してから通常価格の案を反映します。値下げツールとスタッフの同時操作を避けてください。</p><p><a href="https://help.jp.mercari.com/guide/articles/1294/" target="_blank" rel="noopener">公式：Shops値下げ通知</a> ／ <a href="https://help.jp.mercari.com/guide/articles/239/" target="_blank" rel="noopener">公式：メルカリ通知</a></p><p id="price-timing-now" role="status"></p><small>2026-09-29確認。時間帯の案内のみで、価格変更・予約・通知の実行はしません。</small>';
    var heading = host.querySelector('h1');
    if (heading) heading.insertAdjacentElement('afterend', panel);
    else host.appendChild(panel);
    function refresh() {
      var allowed = shopsNoticeWindow(new Date().toISOString());
      doc.getElementById('price-timing-now').textContent = allowed ? '現在はShopsの通知対象時間帯です。通知の実施は金額等の条件によるため保証されません。' : '現在はShopsの値下げ通知が送信されない時間帯です。';
    }
    refresh();
    root.setInterval(refresh, 60000);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount);
  else mount();
})(typeof window === 'undefined' ? {} : window);
