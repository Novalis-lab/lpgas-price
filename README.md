# プロパンガス料金の目安（愛知・岐阜・三重）

使用量（m3）から、県の平均的なプロパンガス（LPガス）料金の目安を計算する Web ツールです。
請求額を入れると、平均との差額（円）と割合（%）も表示します。

公開ページ：https://novalis-lab.github.io/lpgas-price/

## ファイル

| ファイル | 内容 |
|---|---|
| `index.html` / `style.css` / `app.js` | 画面（HTML・CSS・JavaScript だけ。地図・API キーは使っていません） |
| `data.json` | 料金データと調査月 |
| `scripts/update-data.mjs` | 料金データを取得して `data.json` を更新するスクリプト |
| `.github/workflows/update-data.yml` | 上のスクリプトを毎週月曜 9:00（日本時間）に自動で動かす設定 |

## 計算方法

- 基本料金（0m3）・5・10・20・50m3 の点を直線でつなぐ（線形補間）
- 50m3 を超える分は、20〜50m3 の傾きを延長
- 結果は円単位で四捨五入

## データの自動更新

- 出典：[石油情報センター「一般小売価格 LP（プロパン）ガス 確報（偶数月調査）」](https://oil-info.ieej.or.jp/price/price_ippan_lp_gusu.html)
- 毎週、上のページから愛知県・岐阜県・三重県の行と調査月を取り出し、数字が変わったときだけ `data.json` をコミットします
- 読み込みに失敗したとき、数字が正しく取れなかったときは `data.json` を書き換えません（Actions の実行が「失敗」になります）
- 手動ですぐ実行するには：GitHub の **Actions** タブ →「料金データの更新」→ **Run workflow**
