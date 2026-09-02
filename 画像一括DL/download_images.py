#!/usr/bin/env python3
"""
オークタウンCSV → 商品画像一括ダウンロード
- 標準画像（画像1〜10）: auctown URL → https変換してDL
- HTML内追加画像（i.ibb.co）: そのままDL
- バナー画像（jauce/zenmarket/yimg等）: 除外
- 管理番号ごとにフォルダ作成
"""
import os, re, csv, time, requests

CSV_FILE = r'C:\Users\hirok\Desktop\csv_easy_20260824065529.csv'
OUTPUT_DIR = r'C:\Users\hirok\Desktop\商品画像データ'

BANNER_PATTERNS = ['jauce.jp', 'zenmarket.jp', 's.yimg.jp', 'auctions.yahoo.co.jp', 'banner']

def is_banner(url):
    return any(p in url.lower() for p in BANNER_PATTERNS)

def get_mgmt_id(desc):
    # 管理番号の後の改行/<BR>の後に来る、アルファベットで始まるIDを取得
    # 例: ●管理番号 131_0514<BR>D53687_811
    m = re.search(r'管理番号[^\r\n<]*(?:<BR>|<br>|\n)\s*([A-Za-z][A-Za-z0-9_\-]+)', desc, re.IGNORECASE)
    return m.group(1) if m else None

def dl(url, path):
    try:
        # auctownはSSL証明書がないのでhttp://のまま、検証無効で取得
        verify = 'static.auctown.jp' not in url
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}, timeout=15, verify=verify)
        if r.status_code == 200 and len(r.content) > 500:
            with open(path, 'wb') as f:
                f.write(r.content)
            return True
        print(f'    X HTTP {r.status_code}: {url}')
    except Exception as e:
        print(f'    X Error: {e}')
    return False

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(CSV_FILE, 'r', encoding='shift_jis') as f:
        rows = list(csv.DictReader(f))
    print(f'商品数: {len(rows)}件')
    print(f'保存先: {OUTPUT_DIR}')
    print('=' * 50)
    ok = fail = 0
    for idx, row in enumerate(rows):
        title = row.get('タイトル', f'商品_{idx+1}')
        desc = row.get('説明', '')
        mid = get_mgmt_id(desc)
        folder = mid if mid else re.sub(r'[\\/:*?"<>|]', '_', title[:30])
        save_dir = os.path.join(OUTPUT_DIR, folder)
        os.makedirs(save_dir, exist_ok=True)
        print(f'\n[{idx+1}/{len(rows)}] {folder}')
        urls = []
        for i in range(1, 11):
            u = row.get(f'画像{i}', '').strip()
            if u and u.startswith('http'):
                # auctownはhttp://のまま使う（httpsはSSL証明書エラー）
                urls.append(('auctown', u))
        html_imgs = re.findall(r'https?://i\.ibb\.co/[^\s<>"]+\.(?:jpg|jpeg|png|gif)', desc, re.IGNORECASE)
        for u in html_imgs:
            if u not in [x[1] for x in urls]:
                urls.append(('html', u))
        print(f'  画像: {len(urls)}枚')
        for i, (t, u) in enumerate(urls):
            ext = u.split('.')[-1].split('?')[0][:4]
            fn = f'{i+1:02d}_{t}.{ext}'
            fp = os.path.join(save_dir, fn)
            if os.path.exists(fp):
                print(f'    {fn} (skip)')
                continue
            print(f'    {fn} ... ', end='')
            if dl(u, fp):
                print('OK')
                ok += 1
            else:
                fail += 1
            time.sleep(0.3)
    print(f'\n完了! 成功: {ok}枚 / 失敗: {fail}枚')
    print(f'保存先: {OUTPUT_DIR}')

if __name__ == '__main__':
    main()
