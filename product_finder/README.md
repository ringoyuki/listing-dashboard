# Product Finder (商品特定スクリプト)

指定された管理番号と基準画像を元に、以下のサイトから商品を検索・特定します。
- メルカリ
- 楽天ラクマ
- Yahoo!フリマ
- Yahoo!オークション

## 必要要件

- Python 3.8+
- Playwright
- Pandas
- Pillow, imagehash

## セットアップ

1. 依存ライブラリのインストール
   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```

2. プロキシ設定
   `.env` ファイルを編集し、Scrapelessプロキシの認証情報を設定してください。
   ```ini
   PROXY_SERVER=http://proxy.scrapeless.com:8000
   PROXY_USERNAME=your_username
   PROXY_PASSWORD=your_password
   ```

## 使い方

```bash
# 基本検索
python main.py A10234

# 画像比較あり
python main.py A10234 --image path/to/image.jpg

# ブラウザを表示して実行
python main.py A10234 --visible
```

結果は `results_{管理番号}.csv` に保存されます。
