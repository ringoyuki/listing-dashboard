# -*- coding: utf-8 -*-
"""
毎日インポート用スクリプト
デスクトップ or ダウンロードフォルダの最新 product_data_*.csv を自動検出して
seed_data.js に変換します
"""
import csv, json, re, sys, time, random, string, os, glob

APP_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(APP_DIR, "seed_data.js")

# CSVを検索する場所（新しいファイルを優先）
SEARCH_DIRS = [
    os.path.expanduser("~\\Desktop"),
    os.path.expanduser("~\\Downloads"),
]

COL_ITEM_ID   = 0
COL_NAME      = 62
COL_DESC      = 63
COL_STOCK     = 67
COL_MGMT_CODE = 70
COL_PRICE     = 155

MARKERS = {"●管理番号","■管理番号","▲管理番号","〇管理番号","□管理番号","△管理番号"}
CODE_PAT = re.compile(r"^[A-E]\d{4,}")

def find_latest_csv():
    candidates = []
    for d in SEARCH_DIRS:
        for f in glob.glob(os.path.join(d, "product_data_*.csv")):
            candidates.append((os.path.getmtime(f), f))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]

def extract_code(desc):
    lines = desc.split("\n")
    for i, l in enumerate(lines):
        stripped = l.strip()
        matched = any(stripped == m or stripped.startswith(m) for m in MARKERS)
        if matched:
            for c in lines[i+1:i+5]:
                c = c.strip()
                if CODE_PAT.match(c):
                    return c
    return ""

def gen_id():
    return str(int(time.time()*1000)) + "".join(random.choices(string.ascii_lowercase, k=4))

def main():
    print("=" * 50)
    print("  出品管理 毎日インポートツール")
    print("=" * 50)

    csv_path = find_latest_csv()
    if not csv_path:
        print("\n⚠ CSVファイルが見つかりませんでした")
        print("  デスクトップ or ダウンロードフォルダに")
        print("  product_data_YYYY-MM-DD.csv を置いてください")
        input("\nEnterキーで閉じる...")
        return

    filename = os.path.basename(csv_path)
    print(f"\n✅ 検出: {filename}")
    print(f"   場所: {csv_path}")
    print("\n変換中...")

    items = []
    skipped = 0
    no_code = 0

    with open(csv_path, encoding="cp932", errors="replace") as f:
        reader = csv.reader(f)
        next(reader)  # ヘッダーをスキップ
        for row in reader:
            if len(row) < 71:
                skipped += 1
                continue
            if row[COL_STOCK].strip() != "1":
                skipped += 1
                continue
            item_id   = row[COL_ITEM_ID].strip()
            title     = row[COL_NAME].strip()
            desc      = row[COL_DESC].strip()
            mgmt_code = row[COL_MGMT_CODE].strip()
            price     = row[COL_PRICE].strip()
            code = mgmt_code or extract_code(desc)
            if not code:
                code = "CHECK"
                no_code += 1
            urls = {}
            if item_id:
                urls["mercari_shops"] = "https://mercari-shops.com/products/" + item_id
            items.append({
                "id": gen_id(),
                "code": code,
                "title": title,
                "price": price,
                "memo": "",
                "urls": urls,
                "sold": False,
                "createdAt": int(time.time()*1000)
            })

    # seed_data.js として出力（fetchなしで読み込めるJS形式）
    js_content = "// 自動生成ファイル - update_data.py により生成\n"
    js_content += "// 元ファイル: " + filename + "\n"
    js_content += "// 生成日時: " + time.strftime("%Y/%m/%d %H:%M:%S") + "\n"
    js_content += "window._SEED_DATA = "
    js_content += json.dumps(items, ensure_ascii=False)
    js_content += ";\n"
    js_content += "window._SEED_FILE = '" + filename + "';\n"

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"\n✅ 完了！")
    print(f"   出品中:       {len(items)} 件")
    print(f"   スキップ:     {skipped} 件（在庫0など）")
    if no_code > 0:
        print(f"   管理番号不明: {no_code} 件（CHECKと表示）")
    print(f"\n📂 出力: seed_data.js")
    print("\nブラウザでダッシュボードを開きます...")
    time.sleep(1)

    import subprocess
    index_path = os.path.join(APP_DIR, "index.html")
    subprocess.Popen(["start", "", index_path], shell=True)

    time.sleep(2)
    print("\n完了しました！ブラウザで確認してください。")
    print("（このウィンドウは自動で閉じます）")
    time.sleep(3)

if __name__ == "__main__":
    main()
