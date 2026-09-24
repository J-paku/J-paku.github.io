---
status: active
read_when:
  - 環境を作り直すとき
  - 開発サーバや実機確認で詰まったとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# セットアップ

## 必要なもの

Node は `.nvmrc` の版を使う(CI も `node-version-file: .nvmrc` で同じ版を読む)。パッケージマネージャは npm。

```bash
npm install
npm run dev     # http://localhost:3000
```

E2E を走らせるなら Chromium も要る。

```bash
npx playwright install --with-deps chromium
```

## 開発サーバと配信物の違い

`npm run dev` が配るのは開発サーバのバンドルで、`npm run build` が作る `out/` とは別物である。
**受け入れの確認は `out/` を静的配信して行う。**

```bash
npm run build   # next build + scripts/verify-export.mjs
npm run start   # out/ を :4173 で配信(Playwright の baseURL と同じ)
```

Playwright は `webServer` 設定で `npx serve out -l 4173` を自分で起動するが、`out/` は作らない。
E2E のポートは `E2E_PORT` で変えられる(`E2E_PORT=4199 npm run test:e2e`。`npm run start` は `:4173` のまま)。
**先に `npm run build` を済ませておく。** 古い `out/` が残っていると、直したはずのものが直っていないように見える。

## WSL で `/mnt/c` の下に置いている場合

`/mnt/c` 上では Turbopack のファイル監視が取りこぼし、**ソースを直してもブラウザへ古いバンドルが配られ続ける**。
監視の間隔を設定で足しても復旧しない例が実測されている。dev で確かめたいならサーバを再起動する。
検証は dev サーバではなく `npm run build` の成果物に対して走らせる。→ [debugging.md](debugging.md)

## 実機(スマートフォン)から開く

`next.config.ts` の `allowedDevOrigins` に LAN のプライベートアドレス帯を許可してある。
未設定だと Next は localhost 以外のオリジンからの `/_next/*` 取得を拒み、**JS が届かずボタンだけ死ぬ**(リンクは動く)。
本番の静的エクスポートには影響しない。

## CJK フォントが無い環境での計測

ヘッドレス環境に日本語フォントが無いと、CJK が豆腐グリフへフォールバックして**テキスト幅を実際より狭く測る**。
改行検査を走らせる前にフォントの有無を確かめる。

```bash
fc-list :lang=ja | wc -l    # 0 なら測定値を信用しない
```

CI では `fonts-noto-cjk` を入れてから改行検査を走らせている。
