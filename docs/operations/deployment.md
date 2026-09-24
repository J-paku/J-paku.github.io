---
status: active
read_when:
  - CI のワークフローを変えるとき
  - 配信が反映されないとき
  - 配信を戻したいとき
source_of_truth: true
last_reviewed: 2026-09-24
---

# 配信

**`main` への push = リリース。** 別のリリース手順もステージング環境も無い。
正本は `.github/workflows/deploy.yml`。ここにはその読み方と、ローカルで再現する方法を書く。

## 流れ

```
push to main
  → build ジョブ(直列。前段が落ちたら後段は走らない)
      docs:check → typecheck → lint → format:check → test → build
      → Playwright Chromium をキャッシュから戻す(miss なら入れる)→ test:e2e
      → out/ を :4173 で配信 → wait-on
      → axe(全ルート) → CJK フォントの .deb をキャッシュから戻して入れる → 日本語改行検査
      → upload-pages-artifact
  → deploy ジョブ(GitHub Pages)
```

- Node は `.nvmrc`。ローカルと同じ版を使う
- `concurrency: pages` + `cancel-in-progress` なので、連続 push では後の1本だけが生き残る
- Pages の設定は **Settings → Pages → Source = GitHub Actions**

## キャッシュ

| 対象 | 置き場 | キー | miss のとき |
|---|---|---|---|
| npm の取得物 | `setup-node` の `cache: npm` | `package-lock.json` | `npm ci` がそのまま取りに行く |
| Playwright のブラウザ本体 | `~/.cache/ms-playwright` | `<OS>-playwright-<package-lock.json のハッシュ>` | `playwright install --with-deps chromium`。hit でも OS 側の依存は `playwright install-deps chromium` で入れる |
| CJK フォント(`fonts-noto-cjk` の `.deb`) | `~/.cache/apt-fonts` | `<OS>-fonts-noto-cjk-v1` | `apt-get download` で落とす。hit でも miss でも最後に `dpkg -i` で入れる |

- フォントを apt ごとキャッシュしないのは、apt のアーカイブが root 所有で cache アクションが復元できないから。`.deb` だけを利用者側のディレクトリに持つ
- **無効化の仕方。** Playwright は `package-lock.json` が変われば自動で作り直される。フォントはキーの `v1` を上げる(版を固定していないので、新しい版を拾いたいときも同じ)
- hit したかどうかは Actions のログで、各 cache step の出力(`Cache restored from key` か `Cache not found`)を見る

**トレードオフ。** 利用者1人のリポジトリで push の頻度が低く、これまではキャッシュを管理する手間のほうが短縮される時間より大きかったので入れていなかった。
2026-09-24 に入れたのは、Playwright のブラウザ本体(約 150MB)の取得と CJK フォントの apt 導入が毎回繰り返されてビルド時間の固定費になっており、cache アクション 2 step で済むので管理の手間も小さくなったから。
チームで回すなら、Playwright の公式イメージ(ブラウザと依存を焼き込んだコンテナ)と `setup-node` のキャッシュから先に入れる。

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
