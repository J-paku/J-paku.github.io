---
status: active
read_when:
  - CI のワークフローを変えるとき
  - 配信が反映されないとき
  - 配信を戻したいとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# 配信

**`main` への push = リリース。** 別のリリース手順もステージング環境も無い。
正本は `.github/workflows/deploy.yml`。ここにはその読み方と、ローカルで再現する方法を書く。

## 流れ

```
push to main
  → build ジョブ(直列。前段が落ちたら後段は走らない)
      docs:check → typecheck → lint → format:check → test → build
      → Playwright Chromium を入れて test:e2e
      → out/ を :4173 で配信 → wait-on
      → axe(全ルート) → CJK フォントを入れて 日本語改行検査
      → upload-pages-artifact
  → deploy ジョブ(GitHub Pages)
```

- Node は `.nvmrc`。ローカルと同じ版を使う
- `concurrency: pages` + `cancel-in-progress` なので、連続 push では後の1本だけが生き残る
- Pages の設定は **Settings → Pages → Source = GitHub Actions**

## ローカルで CI を再現する

push する前にこれを通しておく。落ちる場所は CI と同じ順に出る。

```bash
npm run docs:check && npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build
npm run test:e2e
npm run start &
npx wait-on http://localhost:4173
node scripts/check-a11y.mjs http://localhost:4173 / /ko/ /list/ /ko/list/ /works/meishi-cross-platform/ /ko/works/meishi-cross-platform/
node scripts/check-ja-linebreak.mjs http://localhost:4173 / /ko/ /list/ /ko/list/ /works/meishi-cross-platform/ /ko/works/meishi-cross-platform/
```

**ワークフローの引数(検査するパスの列)を変えたら、上のコマンドも合わせる。**

## `scripts/verify-export.mjs` が見ているもの

`npm run build` の後段。`out/` の自己整合性を確かめる。

- 必須ページ(両言語のトップ・一覧・作品ストーリー・`404.html`)が実在する
- HTML が参照する css / js が同じツリーに実在する。**参照が0件なら「全部揃っている」ではなく「検査できていない」として落とす**
- `next build` が上書きしてしまう `out/404.html` を `public/404.html`(二言語版)から戻し、中身が二言語で村の画面を含まないことを確かめる。`out/404/index.html` も noindex で村の画面を含まないか見る
- HTML が参照する同一オリジンの静的ファイル(`public/` のロゴ・画像・favicon など拡張子付きのもの)が `out/` に実在し空でない

## 反映されない・戻したい

- **反映の確認はファイル名やハッシュの変化で見る。** 「それらしい文字列が含まれるか」の部分一致で待つと、古い版に引っかかって即座に成立してしまう
- **切り戻しは `git revert` して push するだけ。** 配信済みの成果物を差し替える仕組みは無いので、戻すにはもう一度ビルドが走る
- インフラ側の一過性の失敗は、空コミットか `workflow_dispatch` で再実行する
- 配信版でも受け入れ確認を繰り返す。**ローカルの PASS だけで完了と言わない**
