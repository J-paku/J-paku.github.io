<!-- GitHubはREADMEをlang="en"のページに埋め込むため、ブラウザが日本語のCJK字形を選べず、
     中国語・韓国語の字形に落ちることがある。本文をlang="ja"で包んで字形を確定させる。
     空行を挟めば中のMarkdownは通常どおり解釈される -->
<div lang="ja">

# J-paku.github.io

ポートフォリオのハブサイト。GitHub Pagesのユーザーサイトとして`https://j-paku.github.io/`に配信しています。トップは**歩いて回る小さな村**です。1分で「何を作ったか」より「どんな問題を解くか」が分かる構成にしています。村を飛ばしたい人のために、「作品一覧へ」から従来の一覧画面(`/list/`)へいつでも行けます。

**まずこの2つ。** どちらもブラウザだけで、そのまま触れます。

- [**座席マップデモ**](https://j-paku.github.io/seatmap-demo/) — オフィスの座席とチーム配置を、指の操作でそのまま扱う。実務の社内座席管理ツールをモックデータで再構成
- [**チーム標準のAI開発基盤**](https://j-paku.github.io/ai-harness/) — AIの行動をコードで縛り、チームへ配布・定着まで

| 座席マップデモ | チーム標準のAI開発基盤 |
|---|---|
| [![座席マップデモ](https://j-paku.github.io/shots/seatmap-demo.svg)](https://j-paku.github.io/seatmap-demo/) | [![チーム標準のAI開発基盤](https://j-paku.github.io/shots/ai-harness.svg)](https://j-paku.github.io/ai-harness/) |

> コードエージェント(Claude Code・Codex・Cursor など)で作業する場合は [AGENTS.md](AGENTS.md) から読んでください。
> 設計・規約・検証の文書は [docs/](docs/README.md) にあります。

## このサイトが紹介している仕事

**ここは「紹介している中身」の節です。** seatmap-demo・ai-harness・名刺登録アプリを1か所にまとめ、「何を作ったか」だけでなく**「なぜそう作ったか」**まで見せるのがこのサイトの目的です。

| 作品 | 文脈 | 触れる場所 |
|---|---|---|
| 座席マップデモ | 実務の再構成 — 社内座席管理ツールを業務データ抜きで | [デモ](https://j-paku.github.io/seatmap-demo/)・[リポジトリ](https://github.com/J-paku/seatmap-demo) |
| チーム標準のAI開発基盤 | 技術アウトプット — 実務での自作ツール(社内配布・定着まで) | [ページ](https://j-paku.github.io/ai-harness/)・[リポジトリ](https://github.com/J-paku/ai-harness) |
| 名刺登録アプリ | 実務の進行中案件 — 名刺管理のiOS化 | 社内アプリなので公開デモは無く、[作品ストーリー](https://j-paku.github.io/works/meishi-cross-platform/)として読める |

## このリポジトリそのもの

**ここから下はすべてこのサイト自身の作りです。** 上の3つの仕事とは切り離して読んでください。

| 画面 | パス | 役割 |
|---|---|---|
| 村 | `/`・`/ko/` | 自室と町の2ワールド。会話地点で短い会話を読む |
| 一覧 | `/list/`・`/ko/list/` | 経歴の担当業務パネル・作品カード・折りたたみ詳細。経歴側はJSが無くても読める |
| 作品ストーリー | `/works/<slug>/`・`/ko/works/<slug>/` | iPhone枠の中で画面が切り替わるスクロールストーリー |

### 主な特徴

- **日本語/한국어の2言語対応** — 言語はURLパスだけで決まる(`/`=ja、`/ko`=ko)
- **村はDOMだけで動く** — Canvas・WebGL・ゲームエンジン不使用。移動・衝突・経路・会話地点・釣りの判定は`src/lib/village/`の純粋関数で、React・DOMに依存しない
- **ドット絵は自作、コードで描く** — タイルとキャラクターを文字マトリクスとして定義し、ビルド時にPNGスプライトシートへ焼く
- **村の空は大阪の時刻で4段階に変わる** — 雨と雪は実際の大阪の降水。卓上時計で村の時刻を動かせて、池では現職の機能を釣り上げられる
- **小さく保つ** — 町(屋外)は30×20マス、自室(屋内)は10×8マス。画面に映るのは常に10×9マス
- **アクセシビリティ** — スキップリンク「マップを飛ばして作品一覧へ」と作品ショートカットで同じ内容に到達できる。会話窓は`aria-live`、モーダルはフォーカストラップとEsc
- **ライト/ダークテーマ** — 右上で切り替え。初回描画前にインラインスクリプトで保存値を適用し、ちらつきを避ける

仕組みと理由は [docs/architecture/village.md](docs/architecture/village.md) と [docs/architecture/data-flow.md](docs/architecture/data-flow.md) にあります。

### 設計上の決定

- **Next.js App Routerの静的エクスポート。** Server Actions・ISR・Middlewareは使わない
- **localeは`pathname`だけで決める。** 自動リダイレクトも`?lang=`も設けず、URLを唯一の情報源にする
- **表示文字列は`content/`(ja・ko)に、ブラウザ保存は`src/lib/preferences.ts`に集約する。** 前者は両言語が同一の型を満たすので翻訳キーの過不足を`tsc`が検出し、後者はテーマが`localStorage`、村の位置と訪問記録が`sessionStorage`
- **外部へ出る通信は4系統だけ。** Google Fonts・その書体ファイル・GoatCounterの計測タグ・Open-Meteoに限り、どれも失敗が村を止めない作りにしてある。計測先URLは環境変数`NEXT_PUBLIC_GOATCOUNTER_URL`(GitHubの変数`GOATCOUNTER_URL`)から入り、未設定なら計測タグを出さない

境界の線引きは [docs/architecture/boundaries.md](docs/architecture/boundaries.md)、過去の判断の記録は [docs/decisions/README.md](docs/decisions/README.md) にあります。

### 品質とCI

`main`へのpushでGitHub Actionsがビルドし、**配信物に対して**typecheck・lint・format・単体テスト・E2E・axe・日本語改行の検査を通してからPagesへ公開します。ローカルのPASSだけでは完了と見なさず、配信版でも同じ確認を繰り返す運用です。走らせ方は [docs/agents/verification.md](docs/agents/verification.md)、配信の仕組みは [docs/operations/deployment.md](docs/operations/deployment.md) にあります。

### 技術スタック

Next.js App Routerの静的エクスポート・React・TypeScript・CSS Modules・zustand(村の時刻だけ)・BudouX(日本語改行)・Vitest・Playwrightで作っています。バージョンは`package.json`に載せています。

### ローカルでの実行

```bash
npm install
npm run dev
```

http://localhost:3000 で表示を確認できます(`dev`もスプライトを焼いてから立ち上がります)。

```bash
npm run build      # スプライトを焼く → next build → verify-export(out/を生成)
npm run start      # out/をポート4173で配信
npm run test       # vitest run
npm run test:e2e   # playwright test(out/を配信して実走。buildは含まない)
npm run typecheck  # tsc --noEmit
```

`npm run test:e2e`はビルドしません。`out/`を`serve`で配信して実走するので、先に`npm run build`が必要です。残りのコマンドは [docs/development/commands.md](docs/development/commands.md) にあります。

### ディレクトリ

`content/`に表示文字列と村の定義、`src/`にアプリ本体、`scripts/`にビルドと検査、`tests/`にE2Eを置いています。単体テストは`tests/`ではなく`src`の中に対象と並べて置いています。設計文書は`docs/`で、どのファイルがどの画面に対応するかは [docs/product/feature-map.md](docs/product/feature-map.md) にあります。

> 配信はSettings → Pages → Sourceを「GitHub Actions」にした状態で、`main`へのpushにより行われます。

</div>
