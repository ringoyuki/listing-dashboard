"""
==================================================
Shops 画像 ZIP → GitHub アップロードスクリプト（案B）
==================================================

使い方:
  1. GITHUB_TOKEN に Personal Access Token を設定
  2. python upload_images.py "ZIPファイルのパス"

GitHubトークンの取得:
  https://github.com/settings/tokens → Generate new token (classic)
  必要なスコープ: repo（全部チェック）

アップロード先:
  https://github.com/ringoyuki/product-images
  URL例: https://raw.githubusercontent.com/ringoyuki/product-images/main/images/商品ID_1.jpg
"""

import sys
import os
import zipfile
import base64
import json
import urllib.request
import urllib.error

# ===== 設定 =====
GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"   # ← ここにトークンを入れる
GITHUB_USER  = "ringoyuki"
GITHUB_REPO  = "product-images"
GITHUB_BRANCH = "main"
IMAGE_FOLDER = "images"   # リポジトリ内のフォルダ名
# ================

BASE_URL = f"https://raw.githubusercontent.com/{GITHUB_USER}/{GITHUB_REPO}/{GITHUB_BRANCH}/{IMAGE_FOLDER}"

def upload_file(path_in_repo: str, file_bytes: bytes) -> str:
    """GitHub APIでファイルをアップロード。成功したら公開URLを返す。"""
    api_url = f"https://api.github.com/repos/{GITHUB_USER}/{GITHUB_REPO}/contents/{path_in_repo}"
    encoded = base64.b64encode(file_bytes).decode("utf-8")

    # 既存ファイルのSHAを取得（上書き時に必要）
    sha = None
    req = urllib.request.Request(api_url, headers={
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    })
    try:
        with urllib.request.urlopen(req) as res:
            existing = json.loads(res.read())
            sha = existing.get("sha")
    except urllib.error.HTTPError:
        pass  # 新規ファイルなら404が返るのでOK

    body = {
        "message": f"Upload {os.path.basename(path_in_repo)}",
        "content": encoded,
        "branch": GITHUB_BRANCH
    }
    if sha:
        body["sha"] = sha

    req2 = urllib.request.Request(
        api_url,
        data=json.dumps(body).encode("utf-8"),
        method="PUT",
        headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req2) as res:
        result = json.loads(res.read())
        return result["content"]["download_url"]


def process_zip(zip_path: str):
    """ZIPを解凍してGitHubにアップロード。商品ID → URL一覧のJSONを返す。"""
    if not os.path.exists(zip_path):
        print(f"❌ ファイルが見つかりません: {zip_path}")
        return

    if GITHUB_TOKEN == "YOUR_GITHUB_TOKEN_HERE":
        print("❌ GITHUB_TOKEN を設定してください（スクリプト上部）")
        return

    product_map = {}  # { 商品ID: [url1, url2, ...] }

    with zipfile.ZipFile(zip_path, "r") as zf:
        # 画像ファイルだけ抽出（jpg/png）
        img_files = [
            n for n in zf.namelist()
            if n.lower().endswith((".jpg", ".jpeg", ".png")) and not n.startswith("__MACOSX")
        ]
        img_files.sort()

        print(f"📦 {len(img_files)} 枚の画像を処理します...")

        for name in img_files:
            basename = os.path.basename(name)   # 例: 2JSfc8Qgrkfqbwe7CfUViH_1.jpg
            if not basename:
                continue

            # 商品ID を _ で分割して取得
            parts = os.path.splitext(basename)[0].rsplit("_", 1)
            if len(parts) != 2:
                print(f"  ⚠️ スキップ（命名規則外）: {basename}")
                continue

            product_id = parts[0]
            img_bytes   = zf.read(name)
            path_in_repo = f"{IMAGE_FOLDER}/{basename}"

            print(f"  ⬆️ アップロード中: {basename}")
            try:
                url = upload_file(path_in_repo, img_bytes)
                product_map.setdefault(product_id, []).append(url)
                print(f"     ✅ {url}")
            except Exception as e:
                print(f"     ❌ エラー: {e}")

    # 結果JSONを保存（shopify.jsが読み込む）
    out_path = os.path.join(os.path.dirname(zip_path), "shopify_image_map.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(product_map, f, ensure_ascii=False, indent=2)

    print()
    print(f"✅ 完了！ {sum(len(v) for v in product_map.values())} 枚をアップロードしました")
    print(f"📄 URLマップ保存先: {out_path}")
    print()
    print("次のステップ:")
    print("  このJSONファイルを 出品管理/shopify_image_map.json に置いて")
    print("  Shopify出力を実行すると画像URLが自動で含まれます")

    return product_map


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使い方: python upload_images.py ZIPファイルのパス")
        print("例:     python upload_images.py \"C:/Users/Desktop/商品名.zip\"")
        sys.exit(1)

    process_zip(sys.argv[1])
