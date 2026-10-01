---
status: active
read_when:
  - ルーティングやメタデータを変えるとき
  - ビルド・配信の仕組みを前提にした判断をするとき
source_of_truth: true
last_reviewed: 2026-10-01
---

# 全体像

## 形

単一の Next.js アプリ。monorepo ではなく、パッケージマネージャは npm(`package-lock.json`)。
**バックエンドは無い。** `next.config.ts` が `output: 'export'` を指定しており、ビルド結果の `out/` を GitHub Pages がそのまま配る。
したがって Server Actions・ISR・Middleware・API Routes は使えない。リクエスト時に動くコードは存在しない。

```
content/     表示文字列(ja/ko)・村の地形・その型。src を参照しないデータ(置く処理はデータを組み立てるだけの展開まで)
src/app/     ルート定義と、ja/ko が共有する枠・組み立て(html-shell / locale-routes)。画面本体は components に置く
src/components/  VillagePage(村)/ Directory(一覧)/ Story(作品)の3画面 + ui/(横断部品)
src/hooks/   画面横断のフック
src/lib/     外の世界(ファイル読み・保存・ネットワーク)に触れる層 + 村エンジン
src/utils/   副作用の無い純粋関数・定数
src/styles/  共通スタイルとデザイントークン
scripts/     ビルド前の生成(build-sprites)+ ソースの検査(check-docs。リポジトリの文書を見る。CI ではビルドの前に走る)+ 配信物に対する検査(verify-export / a11y / 日本語改行)+ 検査の共有部品(expected-disclosures)
tests/       Playwright E2E
```

## ルーティング

App Router のルートグループを2本持ち、同じサーバコンポーネントを locale 違いで呼ぶ。

| URL | ファイル | 画面 |
|---|---|---|
| `/` | `src/app/(ja)/page.tsx` | 村 |
| `/ko/` | `src/app/(ko)/ko/page.tsx` | 村 |
| `/list/` | `src/app/(ja)/list/page.tsx` | 一覧 |
| `/ko/list/` | `src/app/(ko)/ko/list/page.tsx` | 一覧 |
| `/works/<slug>/` | `src/app/(ja)/works/[slug]/page.tsx` | 作品ストーリー |
| `/ko/works/<slug>/` | `src/app/(ko)/ko/works/[slug]/page.tsx` | 作品ストーリー |
| 404 | `public/404.html` | 二言語の 404 |

- `trailingSlash: true` なので `/ko/list/` は `out/ko/list/index.html` という実ファイルになる
- `<slug>` は `generateStaticParams` が列挙し、`dynamicParams = false` で未知の slug は 404
- `<html>` の枠は `src/app/html-shell.tsx` が1つ持つ
- `(ja)` / `(ko)` の layout・not-found と村・一覧の page が共有する中身は `src/app/locale-routes.tsx` の組み立て関数
  (`createRootLayout` / `createNotFound` / `createVillageMetadata` / `createListMetadata`)が持ち、各ルートファイルはそこへ自分の locale を渡すだけ。
  画面本体(VillagePage・Directory)は各 page が自分で import する(layout 経由で全ページが読むファイルに画面を置くと、そのクライアント JS・CSS が無関係なページにまで載るため)
- 作品ストーリーの page(`src/app/(ja)/works/[slug]/page.tsx` と `src/app/(ko)/ko/works/[slug]/page.tsx`)は組み立て関数を使わず、ja / ko で同じ形の写しを持つ。コードの違いは定数 `LOCALE` だけ
- locale の判定は `src/utils/locale-path.ts` の `parseLocale` に集約する。各所で `pathname.startsWith('/ko')` を書かない
- canonical・言語間リンク・OG は `src/lib/metadata.ts` の `buildMetadata` が全ページ同じ規則で組む

**locale は URL だけで決まる。** `?lang=` も自動リダイレクトも作らない(→ [ADR 0002](../decisions/0002-locale-from-url-only.md))。

## レンダリングのモデル

既定はサーバコンポーネント。`'use client'` を置くのは、ブラウザの入力・アニメーション・保存が要る島だけ。
どこが島かと、その線の引き方は [boundaries.md](boundaries.md) にある。

ビルド時に起きることが多いのがこのリポジトリの特徴で、`npm run build` は `scripts/build-sprites.mjs`(スプライトシートの PNG を焼く)→ `next build` → `scripts/verify-export.mjs` の順に走る(正本は `package.json` の `build`)。次の3つはすべてこの中で終わる。

1. `content/` の整合性検査(足りない翻訳キー・登録漏れ・村の到達性。`next build` の中)→ [data-flow.md](data-flow.md)
2. ドット絵の PNG スプライトシート合成(`next build` の前、`scripts/build-sprites.mjs`)→ [village.md](village.md)
3. `out/` の自己整合性検査(`next build` の後、`scripts/verify-export.mjs`)→ [../operations/deployment.md](../operations/deployment.md)

どれも失敗すればビルドが落ちる。**壊れたものが配信に進まないのは、実行時の防御ではなくビルドの停止で担保している。**

## 実行時に外へ出る通信

静的エクスポートの自己完結という原則に対する例外は3つ。取りに行く=村の天気(Open-Meteo、`src/lib/weather.ts`)、
送る=アクセス計測(GoatCounter、`src/lib/analytics.ts` と `src/app/html-shell.tsx`)、読み込む=Web フォント(Google Fonts、`src/app/html-shell.tsx`)。
詳細と失敗時の振る舞いは [data-flow.md](data-flow.md)。

## 技術スタック

インストール済みの版の正本は `package.json`。主要なものだけ挙げると
Next.js(App Router・静的エクスポート)/ React / zustand(村の卓上時計の状態を、離れたクライアントの島どうしで共有する。保存はしない)/ TypeScript / CSS Modules / BudouX(日本語の文節分割)/
Vitest(単体)/ @playwright/test(E2E)/ ESLint + Prettier / GitHub Actions。
