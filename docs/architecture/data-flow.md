---
status: active
read_when:
  - コンテンツの読み込み・検証を変えるとき
  - ブラウザ保存や外部 API 取得を足すとき
source_of_truth: true
last_reviewed: 2026-10-01
---

# データの流れ

このアプリのデータの出入りは3種類しかない。**ビルド時に確定するコンテンツ**、**ブラウザにだけ残る設定と進行**、
**実行時の外との通信**(天気を取る・アクセス計測を送る・Web フォントを読む)。それぞれ窓口になるファイルが決まっている。

## 1. コンテンツ(ビルド時)

```
content/ja/*.ts  content/ko/*.ts  content/world.ts
        └────────── src/lib/content/read.ts ──────────┘
                            ↓ 検証を通ってから
                    src/app/**/page.tsx(サーバ)
                            ↓ props
                    src/components/**
```

- `src/lib/content/read.ts` が唯一の入口。先頭で `import 'server-only'` しており、クライアントへ持ち込むと import の時点で落ちる
- 作品はバレルや glob で集めず、`read.ts` の **登録表 `WORKS`** に ja/ko を1行ずつ足す。登録表と `content/ja/works/*.ts` の実ファイル一覧はビルド時に突き合わせ、漏れがあればビルドが落ちる
- 検証は2本。`validate.ts` が ja/ko の slug・status・場面 ID の一致を、`validate-world.ts` が村の座標・ID 重複・到達性・歩数上限を見る。問題があれば `read.ts` が `throw` してビルドが止まる
- **`content/` は `src/` を import しない。** 型は `content/types/` に置く(`content.ts` = 表示データ、`world.ts` = 村)
- `src/lib/content/` 以外から `@content/ja` `@content/ko` `@content/world` を直接 import することは ESLint が禁じている。型(`@content/types/...`)は全レイヤーから読んでよい

規則の中身(何が落ちるか)は [../product/business-rules.md](../product/business-rules.md)、型の関係は [../product/domain-model.md](../product/domain-model.md)。

## 2. ブラウザ保存

**`src/lib/preferences.ts` が唯一の窓口**(不変ルール3)。他のファイルから `localStorage` / `sessionStorage` を直接触らない。

| 何を | どこに | キー |
|---|---|---|
| テーマ(light / dark) | `localStorage` | `theme` |
| 村の現在位置(`worldId` / マス / 向き)と訪問記録 | `sessionStorage` | `preferences.ts` を参照 |

- 読み出しは必ず型ガードを通す。壊れた値・古いスキーマは黙って捨てて既定値に戻す
- 初回ペイント前にテーマを当てるインラインスクリプトだけは `src/app/html-shell.tsx` に直書きされている。そこの文字列 `'theme'` は `THEME_STORAGE_KEY` と同じ値を保つこと(片方だけ変えるとテーマが復元されない)

## 3. 外部への通信(実行時)

静的エクスポートの自己完結に対する例外は3つ。取りに行く=村の天気(Open-Meteo、`src/lib/weather.ts`)、
送る=アクセス計測(GoatCounter、`src/lib/analytics.ts` と `src/app/html-shell.tsx`)、読み込む=Web フォント(Google Fonts、`src/app/html-shell.tsx`)。
どれも落ちても画面は動く。

村の天気は `src/lib/weather.ts` が Open-Meteo(API キー不要)を呼ぶ。

- 呼ぶのはクライアント。村を描いたあと `use-weather.ts` がマウント時に1回だけ実行する
- 送るのは固定の緯度経度(大阪)だけ。訪問者の位置情報は扱わない。応答は保存しない
- **失敗は全部 `'none'` に丸める。** タイムアウト(5秒)・ネットワーク障害・応答形の不一致・オフライン、どれでも雨は降らないだけで、村の描画も操作も止めない
- 雨が出ないのはバグではなくフォールバック。E2E は応答を差し替えて両方を確かめる(`tests/day-night.spec.ts`)

アクセス計測は GoatCounter。計測タグの読み込みは `src/app/html-shell.tsx` で、ページ読み込み時の1件はタグが自動で送る。
計測先 URL は環境変数 `NEXT_PUBLIC_GOATCOUNTER_URL`(GitHub の変数 `GOATCOUNTER_URL`)からビルド時に入り、未設定なら計測タグを出さない。
next/link による移動はタグから見えないため、`src/components/ui/PageviewCounter/` が pathname の変わるたびに `src/lib/analytics.ts` の送信関数を呼ぶ
(マウント時は送らず、読み込み時の1件と二重にしない)。Cookie は使わない。計測が落ちても画面は動く。

Web フォントは `src/app/html-shell.tsx` が Google Fonts の配信 CSS を `<link>` で読む(自前の `@font-face` は持たない)。
Inter・Playfair Display は共通で、Noto Sans・Noto Serif だけ locale で JP / KR を切り替える。
読めなくても、`src/styles/tokens.css` の書体指定の後段にあるシステム書体で文字は描かれる。

## 外の世界に触れてよい場所

`src/lib/` だけ。例外は `src/app/html-shell.tsx` が `<head>` に直書きする次の3つに限る。

- 初回ペイント前にテーマを当てるインラインスクリプト(`localStorage` を読む。不変ルール3の例外 → 2節)
- Google Fonts へつなぐ `<link>`(preconnect と配信 CSS → 3節)
- GoatCounter の計測タグの `<script>`(計測先 URL が設定されたときだけ出る → 3節)

`src/utils/` は同じ入力に同じ出力を返す純粋関数と定数に限る。
DOM の実測(`ResizeObserver` など)はページが閉じれば消えるので「外」ではなく、フックに置く。
