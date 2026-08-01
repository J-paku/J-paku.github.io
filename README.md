# J-paku.github.io

ポートフォリオハブサイトです。`https://j-paku.github.io/` に GitHub Pagesのユーザーサイトとして配信します。

## これは何か

seatmap-demo・ai-harnessの2件のデモをまとめ、それぞれの「何を作ったか」だけでなく
「なぜそう作ったか」を示すケーススタディを載せるポートフォリオハブです。現時点ではツールチェーンの
セットアップのみが完了した空のシェルで、ルーティング・コンテンツ・デザインはこれから追加します。

## 技術スタック

`package.json`記載のバージョンをそのまま記載しています。

| 分類 | 技術 | バージョン |
|---|---|---|
| ビルドツール | Vite | 8.2.0 |
| UI | React / React DOM | 19.2.8 |
| ルーティング | react-router | 7.18.2 |
| 言語 | TypeScript | 6.0.2 |
| スタイル | CSS Modules(追加パッケージなし・Vite標準機能) | - |
| テスト | Vitest / Testing Library(react) | 4.1.10 / 16.3.2 |
| Lint | oxlint | 1.75.0 |
| CI/CD | GitHub Actions | - |

## ローカルでの実行

```bash
npm install
npm run dev
```

http://localhost:5173 で表示を確認できます。

```bash
npm run build       # tsc -b && vite build(dist/ を生成)
npm run preview     # ビルド結果をポート4173でプレビュー
npm run test        # vitest run --passWithNoTests
npm run typecheck   # tsc -b --noEmit
npm run lint        # oxlint
```

## ディレクトリ構成

```text
J-paku.github.io/
├── .github/workflows/  # deploy.yml(Actionsによるビルド・Pages配信)
├── src/                # アプリ本体。現時点は最小シェル(App.tsx / main.tsx)のみ
├── public/             # 静的アセット(現時点は空)
├── index.html
├── vite.config.ts
├── tsconfig*.json
└── package.json
```

`content/`(本文コンテンツ)・ルーティング・デザイントークンは今後追加します。

## 配信

GitHub Pagesのユーザーサイト(`base: '/'`、ルート配信)として、`main`ブランチへのpushをトリガーに
GitHub Actions(`.github/workflows/deploy.yml`)がビルドして配信します。

> リポジトリの Settings → Pages → Source を「GitHub Actions」に設定する必要があります。
> 「Deploy from a branch」のままではこのワークフローは配信されません。
