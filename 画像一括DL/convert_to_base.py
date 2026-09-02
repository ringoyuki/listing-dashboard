#!/usr/bin/env python3
"""
オークタウンCSV → BASE CSV 変換ツール
- ヤフオク固有のHTML（バナー・出品一覧リンク等）を自動除去
- 説明文をBASE向けプレーンテキストに変換
- 画像をDL＆ZIPにまとめて、BASE CSVに画像ファイル名を記載
- 管理番号ごとにフォルダ分け
"""
import os, re, csv, time, zipfile, requests

# === 設定 ===
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR  = os.path.dirname(SCRIPT_DIR)  # 出品管理132

# オークタウンCSVを自動検出（csv_easy を含むファイル）
AUCTOWN_CSV = None
for f in os.listdir(PARENT_DIR):
    if 'csv_easy' in f and f.endswith('.csv'):
        AUCTOWN_CSV = os.path.join(PARENT_DIR, f)
        break
if not AUCTOWN_CSV:
    print('エラー: オークタウンCSV（csv_easy_*.csv）が見つかりません')
    print(f'検索先: {PARENT_DIR}')
    exit(1)

OUTPUT_DIR  = os.path.join(PARENT_DIR, 'BASE出力')

# 公開状態: 0=非公開（まず確認してから公開推奨）, 1=公開
DEFAULT_PUBLIC = 0
DEFAULT_TAX = 10
DEFAULT_STOCK = 1

def get_mgmt_id(desc):
    """管理番号を抽出（アルファベットで始まるID）"""
    m = re.search(r'管理番号[^\r\n<]*(?:<BR>|<br>|\n)\s*([A-Za-z][A-Za-z0-9_\-]+)', desc, re.IGNORECASE)
    return m.group(1) if m else None

def clean_description(html_desc):
    """ヤフオクHTML説明文 → BASE用プレーンテキスト"""
    text = html_desc

    # 1. RINGO YUKI出品一覧リンクを除去（上下両方）
    text = re.sub(r'<A[^>]*>→?RINGO YUKI出品一覧←?</A>', '', text, flags=re.IGNORECASE)

    # 2. マイ・オークションバナーを除去
    text = re.sub(r'<A[^>]*><IMG[^>]*banner\.gif[^>]*></A>', '', text, flags=re.IGNORECASE)

    # 3. 海外バナーセクション全体を除去（━━━ 以降のFor International Customers部分）
    text = re.sub(r'━+.*?$', '', text, flags=re.DOTALL)
    text = re.sub(r'▼\s*For International Customers\s*▼.*?$', '', text, flags=re.DOTALL)

    # 4. 商品画像のIMGタグを除去（ibb.coの画像はBASEに別途アップロードするため）
    text = re.sub(r'<DIV>\s*<IMG[^>]*>\s*</DIV>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<IMG[^>]*SRC=["\']?https?://i\.ibb\.co[^>]*>', '', text, flags=re.IGNORECASE)

    # 5. BR → 改行、残りのHTMLタグ除去
    text = text.replace('<BR>', '\n').replace('<br>', '\n')
    text = re.sub(r'<[^>]+>', '', text)

    # 6. クリーンアップ
    text = re.sub(r'[ \t]+\n', '\n', text)       # 行末スペース除去
    text = re.sub(r'\n{3,}', '\n\n', text)        # 3行以上の空行を2行に
    text = text.strip()

    return text

def dl_image(url, filepath):
    """画像を1枚ダウンロード"""
    try:
        verify = 'static.auctown.jp' not in url
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}, timeout=15, verify=verify)
        if r.status_code == 200 and len(r.content) > 500:
            with open(filepath, 'wb') as f:
                f.write(r.content)
            return True
        print(f'    X HTTP {r.status_code}: {url}')
    except Exception as e:
        print(f'    X Error: {e}')
    return False

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    img_dir = os.path.join(OUTPUT_DIR, '画像')
    os.makedirs(img_dir, exist_ok=True)

    # オークタウンCSV読み込み
    with open(AUCTOWN_CSV, 'r', encoding='shift_jis') as f:
        rows = list(csv.DictReader(f))

    print(f'商品数: {len(rows)}件')
    print(f'出力先: {OUTPUT_DIR}')
    print('=' * 50)

    # BASE CSVヘッダー
    base_headers = ['商品ID','商品名','種類ID','種類名','説明','価格','税率',
                     '在庫数','公開状態','表示順','種類在庫数']
    for i in range(1, 21):
        base_headers.append(f'画像{i}')

    base_rows = []
    all_images = []  # (ファイル名, パス) のリスト → ZIP用

    for idx, row in enumerate(rows):
        title = row.get('タイトル', '').strip()
        desc_html = row.get('説明', '')
        price = row.get('価格', '').strip()
        if not price:
            price = row.get('開始価格', '').strip()

        # 管理番号
        mgmt_id = get_mgmt_id(desc_html)
        product_id = mgmt_id or f'item_{idx+1}'

        print(f'\n[{idx+1}/{len(rows)}] {product_id} - {title[:40]}...')

        # 説明文変換
        desc_clean = clean_description(desc_html)

        # 画像収集 & ダウンロード
        image_urls = []

        # 標準画像（画像1〜10）
        for i in range(1, 11):
            u = row.get(f'画像{i}', '').strip()
            if u and u.startswith('http'):
                image_urls.append(u)

        # HTML内の追加画像（i.ibb.coのみ）
        html_imgs = re.findall(r'https?://i\.ibb\.co/[^\s<>"]+\.(?:jpg|jpeg|png|gif)', desc_html, re.IGNORECASE)
        for u in html_imgs:
            if u not in image_urls:
                image_urls.append(u)

        print(f'  画像: {len(image_urls)}枚')

        # 画像ダウンロード & ファイル名リスト作成
        image_filenames = []
        for i, url in enumerate(image_urls):
            ext = url.split('.')[-1].split('?')[0][:4]
            filename = f'{product_id}_{i+1:02d}.{ext}'
            filepath = os.path.join(img_dir, filename)

            if not os.path.exists(filepath):
                print(f'    {filename} ... ', end='')
                if dl_image(url, filepath):
                    print('OK')
                    image_filenames.append(filename)
                    all_images.append((filename, filepath))
                else:
                    image_filenames.append('')  # 失敗時は空欄
                time.sleep(0.3)
            else:
                print(f'    {filename} (skip: existing)')
                image_filenames.append(filename)
                all_images.append((filename, filepath))

        # BASE CSV行を作成
        base_row = {
            '商品ID': '',  # 新規登録時は空
            '商品名': title,
            '種類ID': '',
            '種類名': '',
            '説明': desc_clean,
            '価格': price,
            '税率': str(DEFAULT_TAX),
            '在庫数': str(DEFAULT_STOCK),
            '公開状態': str(DEFAULT_PUBLIC),
            '表示順': '',
            '種類在庫数': '',
        }
        # 画像1〜20
        for i in range(1, 21):
            if i <= len(image_filenames):
                base_row[f'画像{i}'] = image_filenames[i-1]
            else:
                base_row[f'画像{i}'] = ''

        base_rows.append(base_row)

    # BASE CSV出力
    csv_path = os.path.join(OUTPUT_DIR, 'base_import.csv')
    with open(csv_path, 'w', encoding='cp932', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=base_headers)
        writer.writeheader()
        writer.writerows(base_rows)
    print(f'\n✓ BASE CSV 出力: {csv_path}')

    # 画像をZIPにまとめる
    if all_images:
        zip_path = os.path.join(OUTPUT_DIR, 'base_images.zip')
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for fname, fpath in all_images:
                if os.path.exists(fpath):
                    zf.write(fpath, fname)
        print(f'✓ 画像ZIP 出力: {zip_path} ({len(all_images)}枚)')

    print(f'\n{"="*50}')
    print(f'完了！')
    print(f'')
    print(f'【BASEへの登録手順】')
    print(f'1. BASEの管理画面 → Apps → CSV商品管理 → 商品登録・編集')
    print(f'2. 「base_import.csv」をアップロード')
    print(f'3. 「base_images.zip」を画像として一緒にアップロード')
    print(f'4. 公開状態は「非公開」で登録済み → 確認後に公開切替')

if __name__ == '__main__':
    main()
