<!-- GitHubはREADMEをlang="en"のページに埋め込むため、ブラウザが日本語のCJK字形を選べず、
     中国語・韓国語の字形に落ちることがある。本文をlang="ja"で包んで字形を確定させる。
     空行を挟めば中のMarkdownは通常どおり解釈される -->
<div lang="ja">

# J-paku.github.io

[![deploy](https://github.com/J-paku/J-paku.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/J-paku/J-paku.github.io/actions/workflows/deploy.yml)

ポートフォリオのハブサイト。GitHub Pagesのユーザーサイトとして`https://j-paku.github.io/`に配信しています。トップは**歩いて回る小さな村**です。1分で「何を作ったか」より「どんな課題を解決するか」が分かる構成にしています。村を飛ばしたい人のために、「作品一覧へ」から従来の一覧画面(`/list/`)へいつでも行けます。

**まずこの2つ。** どちらもブラウザだけで、そのまま触れます。

- [**座席マップデモ**](https://j-paku.github.io/seatmap-demo/) — オフィスの座席とチーム配置を、タッチ操作で直感的に扱える。実務の社内座席管理ツールをモックデータで再構成
- [**チーム標準のAI開発基盤**](https://j-paku.github.io/ai-harness/) — AIの動作をコードで制約し、チームへの配布から定着まで

| 座席マップデモ                                                                                               | チーム標準のAI開発基盤                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| [![座席マップデモ](https://j-paku.github.io/shots/seatmap-demo.svg)](https://j-paku.github.io/seatmap-demo/) | [![チーム標準のAI開発基盤](https://j-paku.github.io/shots/ai-harness.webp)](https://j-paku.github.io/ai-harness/) |

> コードエージェント(Claude Code・Codex・Cursor など)で作業する場合は [AGENTS.md](AGENTS.md) から読んでください。
> 設計・規約・検証の文書は [docs/](docs/README.md) にあります。

## このサイトが紹介している仕事

このサイトでは、seatmap-demo・ai-harness・名刺登録アプリの3つの取り組みを紹介しています。成果物だけでなく、それぞれの課題や設計判断の背景も伝えることを目的としています。

| 作品                   | 文脈                                                      | 触れる場所                                                                                                          |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 座席マップデモ         | 実務の再構成 — 社内座席管理ツールを業務データ抜きで       | [デモ](https://j-paku.github.io/seatmap-demo/)・[リポジトリ](https://github.com/J-paku/seatmap-demo)                |
| チーム標準のAI開発基盤 | 技術アウトプット — 実務での自作ツール(社内配布・定着まで) | [ページ](https://j-paku.github.io/ai-harness/)・[リポジトリ](https://github.com/J-paku/ai-harness)                  |
| 名刺登録アプリ         | 実務で進行中の案件 — 名刺管理のiOS化                      | 社内アプリなので公開デモはなく、[作品ストーリー](https://j-paku.github.io/works/meishi-cross-platform/)として読める |

## このリポジトリそのもの

**ここから下では、このサイト自体の実装について説明します。** 上の3つの仕事とは切り離して読んでください。

| 画面           | パス                                  | 役割                                                                         |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| 村             | `/`・`/ko/`                           | 自室と町の2ワールド。会話ポイントで短い会話を楽しめる                        |
| 一覧           | `/list/`・`/ko/list/`                 | 経歴の担当業務パネル・作品カード・折りたたみ詳細。経歴側はJSが無くても読める |
| 作品ストーリー | `/works/<slug>/`・`/ko/works/<slug>/` | iPhone枠の中で画面が切り替わるスクロールストーリー                           |

### 主な特徴

- **日本語・韓国語の2言語に対応** — 言語はURLパスだけで決まる(`/`=ja、`/ko`=ko)
- **村はDOMだけで動く** — Canvas・WebGL・ゲームエンジン不使用。移動・衝突・経路・会話地点・釣りの判定は`src/lib/village/`の純粋関数で、React・DOMに依存しない
- **ドット絵はコードで描く** — タイルとキャラクターを文字マトリクスとして定義し、ビルド時にPNGスプライトシートへ焼く。作者が用意した原画(画像生成の出力を含む)がある絵はそれを写し、写した後は1ドットも変えない([ADR 0008](docs/decisions/0008-verbatim-pixel-art-originals.md)・[ADR 0010](docs/decisions/0010-read-originals-by-dot-pitch.md))。原作ゲームの素材は持ち込まない
- **村の空は大阪の時刻で4段階に変わる** — 雨や雪は大阪の実際の気象データに連動。卓上時計で村の時刻を動かせて、池では現職の機能を釣り上げられる
- **小さく保つ** — 町(屋外)は30×20マス、自室(屋内)は10×8マス。画面に映るのは常に10×9マス
- **アクセシビリティ** — スキップリンク「マップを飛ばして作品一覧へ」と作品ショートカットで同じ内容に到達できる。会話窓(`StopModal`)は`role='dialog'`、枠の下端の案内文(`SpeechBox`)は`role='status'`+`aria-live`、モーダルはフォーカストラップとEsc
- **ライト/ダークテーマ** — 右上で切り替え。初回描画前にインラインスクリプトで保存値を適用し、ちらつきを避ける

仕組みと理由は [docs/architecture/village.md](docs/architecture/village.md) と [docs/architecture/data-flow.md](docs/architecture/data-flow.md) にあります。

### 設計上の決定

- **Next.js App Routerの静的エクスポート。** Server Actions・ISR・Middlewareは使わない
- **localeは`pathname`だけで決める。** 自動リダイレクトも`?lang=`も設けず、URLを唯一の情報源にする
- **表示文字列は`content/`(ja・ko)に、ブラウザ保存は`src/lib/preferences.ts`に集約する。** 前者は両言語が同一の型を満たすので翻訳キーの過不足を`tsc`が検出し、後者はテーマが`localStorage`、村の位置と訪問記録が`sessionStorage`
- **外部へ出る通信は3系統だけ。** Open-Meteo(村の天気)・GoatCounter(アクセス計測)・Google Fonts(Webフォント。配信CSSとそこから読む書体ファイルで1系統と数える)に限り、どれも失敗が村を止めない作りにしてある。計測先URLは環境変数`NEXT_PUBLIC_GOATCOUNTER_URL`(GitHubの変数`GOATCOUNTER_URL`)から入り、未設定なら計測タグを出さない

境界の線引きは [docs/architecture/boundaries.md](docs/architecture/boundaries.md)、過去の判断の記録は [docs/decisions/README.md](docs/decisions/README.md) にあります。

### アーキテクチャ

コードを層ごとに分け、importの依存方向を一方向に制限しています。右の層から左の層へのimportのみを許可し（`components`から`lib`や`utils`は利用できますが、`utils`から`lib`は利用できません）、違反した場合はESLintでエラーになります（[ADR 0004](docs/decisions/0004-lint-enforced-layer-boundaries.md)）。

```text
utils ← lib ← hooks ← components ← app
```

- **`src/utils/`には純粋関数と定数のみを配置し、`src/lib/`はファイルの読み書きやネットワーク通信など外部とのやり取りを担当し、村の移動計算のような純粋関数も置きます。**
- **`content/`はデータ専用とし、`src/`からのimportは一切行いません。** 実データを読み込めるのは`src/lib/content/`のみで、ページ（`src/app/`）から直接読み込むことも禁止しています。ただし、型のimportは制限しません。
- **バレルファイル経由のimport（`from '.'`・`from '..'`）は禁止しています。**
- **サーバーコンポーネントを基本とします。** `'use client'`は、ユーザー操作、アニメーション、ブラウザ側での保存、DOMのサイズ計測などが必要な部分に限定しています。`content/`はサーバー側で読み込み、クライアントには必要なデータのみをpropsで渡します。また、読み込みを担当する`src/lib/content/read.ts`には`server-only`を指定しており、クライアント側からimportするとビルドエラーになります。
- **ロジックは純粋関数に切り出し、ReactはロジックとUIをつなぐ役割に徹します。** 判定や計算は`src/lib/`、`src/utils/`、またはコンポーネント専用のutilsにある純粋関数にまとめ、フックやコンポーネントから呼び出します。ロジックの正しさは単体テストと、後述する「品質とCI」の各種チェックで検証します。

各層の依存ルールは`eslint.config.mjs`で定義しています。サーバーとクライアント、データとコードの境界については、[docs/architecture/boundaries.md](docs/architecture/boundaries.md)にまとめています。

### 品質とCI

AIエージェントに実装を任せることで、複数の作業を並行して進められるようになり、開発速度が向上します。一方で、人がすべての変更を確認するコードレビューがボトルネックになります。

このリポジトリでは、**人によるコードレビューを、テストや静的解析などの自動チェックに置き換え、それらをすべて通過したコードを信頼する**方針を採用しています。これにより、レビュー工程が開発速度を制限する問題の解消を図っています。

『Clean Code』の著者Robert C. Martinが「extreme constraints」と呼んだ考え方（[出典](https://x.com/unclebobmartin/status/2080257779395154409)）を参考に、ロジックを純粋関数に切り出してテストで検証し、制約は原則として厳しくする方向にのみ変更します。この方針を採用した経緯は[ADR 0011](docs/decisions/0011-extreme-constraints.md)に記録しています。

`main`へのpush時には、GitHub Actionsで以下のチェックを実行します。

- **ソースコードに対するチェック：** docs:check、typecheck、lint、format:check、単体テスト（全体のカバレッジの下限値と、純粋なモジュールのファイルごとのカバレッジ）、テストの配置・実装ルール（`hooks`フォルダへの単体テスト配置禁止、`renderHook`の使用禁止、コンポーネントを描画するテストはコンテナのフォルダに置く統合テストのみ）、フックを呼べる場所の制限（フックを呼べるのは`src/components`の中の`index.tsx`と`hooks`フォルダのフックだけ。ESLintの独自ルールと、そのルール自体の自己検査）、表示部品と状態コンテナからアプリの外へ届くimportの禁止、統合テスト（Vitest Browser Modeで、ビルドせずに実際のChromiumで画面を描画）、ミューテーションテスト（Strykerを使い、コードに意図的な変更を加えてテストが検出できるかを確認）
- **ビルド後の成果物に対するチェック：** E2E、axe、Lighthouse CI、日本語の改行チェック

これらのチェックを通過した場合にのみ、GitHub Pagesへ公開します。また、ローカルでテストが成功しただけでは完了とせず、公開後のサイトでも受け入れ確認を行います。

検証手順は[docs/agents/verification.md](docs/agents/verification.md)、デプロイの仕組みは[docs/operations/deployment.md](docs/operations/deployment.md)にまとめています。

テストはテスティングトロフィーの考え方に沿って、次の4層に分けています。層はモックの量ではなく、実行環境とファイル名で機械的に決めます（[ADR 0016](docs/decisions/0016-testing-trophy-browser-integration.md)）。計算などのロジックは純粋関数として切り出し、単体テストで検証します。

| 層   | ツール                                                                                                                       | テスト対象                                                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 静的 | TypeScript・ESLint・Prettier・文書の参照チェック                                                                             | 型、レイヤー境界、整形、文書のリンクや参照パス                                                                                                                                                               |
| 単体 | Vitest（基本はNode環境。DOMを扱うutilsのみhappy-dom）                                                                        | 純粋関数、`fetch`やStorageをモックして検証する`src/lib/`の処理、DOMを扱うutils。コンポーネントを描画するテストは置きません                                                                                   |
| 統合 | Vitest Browser Mode（実際のChromiumで実行。ビルド不要。コンテナのフォルダの`*.integration.test.tsx`をコンテナごとに1本以上） | コンテナ（フックを1つでも呼ぶコンポーネントと、I/Oコンテナ）を、フックや子コンポーネントと一緒に描画したときの振る舞い。コンポーネントを描画するテストはこの層にだけ置きます。モックはネットワークと時間のみ |
| E2E  | Playwright（ビルド済みの`out/`を配信して実行）                                                                               | ビルド結果でしか確認できないもの（静的な経路、404、初回描画前のテーマ、ビルド時に生成するスプライトの絵など）と、ページをまたぐ主要な導線。再読み込みなど、統合テストでは再現できない場合もここで確認        |

村の画面は実際のDOMサイズやrAFによる歩行ループに依存し、配置を計算しないhappy-domでは確認できません。そのため村も、実際のブラウザで描画する統合テストの対象にしています。歩行や釣り、飛行、昼夜と天気といった村の振る舞いは、以前はE2Eテストで確認していましたが、統合テストへ移しました。E2Eテストに残しているのは、ビルド時に生成するスプライトの絵や再読み込みのように、統合テストでは再現できないものだけです（[ADR 0018](docs/decisions/0018-move-e2e-and-gate-all-hooks.md)）。

コンポーネントのファイルは、どれもフォルダの入口の`index.tsx`で、フックを呼ぶかどうかで役割を分けています。フックを1つでも呼ぶものは「コンテナ」、フックを1つも呼ばず受け取った値を描画するだけのものは「表示部品」です。ファイルの名前は同じなので、どちらに当たるかは検査がフックの呼び出しから判定します。ほかに、サーバでだけ動いてコンテンツを読み込む「ローダー」（`src/app/`の画面ごとの`*-screen.tsx`）があります。コンテナのうち、保存や通信などアプリの外とのやり取りをまとめてよいのは、画面の3つと横断部品の3つの「I/Oコンテナ」だけで（フックを呼ばなくてもコンテナに数えます）、それ以外は、アプリの外とやり取りしない「状態コンテナ」です。フックを呼ぶ場所はESLintの独自ルールで検査します。アプリの外とやり取りするimportをI/Oコンテナとその隣の`hooks`フォルダ以外に書くと、間にフックや部品を挟んだ場合も含めて、importのつながりをたどる検査（`npm run test:boundary`）が失敗します。統合テストはコンテナのフォルダに置き、そのコンテナのテストが1本なら隣の`index.integration.test.tsx`、2本以上ならそのフォルダの`__tests__`の中に動作別のファイルで置きます（[ADR 0019](docs/decisions/0019-hooks-make-containers.md)・[ADR 0022](docs/decisions/0022-colocate-integration-tests.md)・[ADR 0024](docs/decisions/0024-containers-as-index.md)）。

純粋なモジュール（`src/lib/`、`src/utils/`、コンポーネント専用のutilsに配置した`.ts`ファイル）には、さらに厳格な品質基準を設け、あわせてテストの置き方にもルールを設けています。

- **ファイルごとに、すべてのコードをテストで通します。** 文・分岐・関数・行のどこか1か所でもテストが通らなければ、そのファイルはチェックに失敗します。
- **意図的に加えた変更を、テストですべて検出します。** 単体テストで検出できない変更が1つでも残っていれば、チェックに失敗します。通常のカバレッジが「テスト実行時にそのコードを通ったか」を測るのに対し、ミューテーションテストでは「コードを意図的に変更したときに、テストが失敗するか」を確認します。
- **対象ファイルはルールに基づいて自動選択します。** 対象を手動で列挙するのではなく、`scripts/gate-targets.mjs`が設定の読み込み時に`src`以下を走査して選択します。そのため、新しいファイルも追加した時点で両方のチェック対象になります。ただし、ドット絵の行列やカラーパレットのようにデータだけを定義したファイルと、`linkedom`の差し替え用ファイルは、個別に扱いを分けています（[ADR 0014](docs/decisions/0014-gate-all-pure-modules.md)）。
- **push時は差分を対象にミューテーションテストを実行します。** CIでは最も新しく保存された実行結果をキャッシュとして引き継ぎ、依存関係・設定が変更された場合も引き継ぎます。キャッシュがない場合は、すべての対象に対して実行します。ローカルで実行結果がない場合は、同じリポジトリの別の作業ツリーにある最新の実行結果をコピーして引き継ぎます。差分判定では対象ファイルとそのテストのみを比較し、依存関係・設定の変更も見ないため、週1回は手動ですべての対象に対して実行し、見落としを補います（[ADR 0013](docs/decisions/0013-incremental-mutation-on-push.md)・[ADR 0023](docs/decisions/0023-inherit-latest-mutation-result.md)）。
- **`hooks`フォルダへの単体テスト配置を禁止します。** 「ロジックは純粋関数に置き、フックはUIとの連携に徹する」という設計方針を守るため、すべてのテストで`renderHook`の使用も禁止しています。これらのルールに違反すると`npm run test:boundary`が失敗します。ロジックは純粋関数へ切り出し、フックの動作は、そのフックを使うコンテナを統合テストで描画して確認します。コンポーネントを描画するテストも、コンテナのフォルダに置く統合テストにだけ置けます。フックとコンポーネントのカバレッジは単体テストでは測らず、統合テストで測ります（統合テストにも全体の下限値があります）。すべてのフックと、`src/components`の中のすべてのコンポーネント（コンテナと表示部品）を対象に、統合テストのカバレッジでファイルごとに100%を求めています。フックとコンテナのうち、統合テストでは構造上通れない行だけは、その行を確認しているE2Eテストを名指しする注釈でカバレッジから外し、名指しした先が実在するかを検査します（[ADR 0011](docs/decisions/0011-extreme-constraints.md)・[ADR 0016](docs/decisions/0016-testing-trophy-browser-integration.md)・[ADR 0017](docs/decisions/0017-screen-containers.md)・[ADR 0018](docs/decisions/0018-move-e2e-and-gate-all-hooks.md)・[ADR 0019](docs/decisions/0019-hooks-make-containers.md)・[ADR 0022](docs/decisions/0022-colocate-integration-tests.md)・[ADR 0024](docs/decisions/0024-containers-as-index.md)）。
- **新しいテストや検査は、意図的に失敗することを確認してから採用します。** 修正を元に戻したり、期待値を反転させたりして、PASSからFAILに変わることを確認します。意図した失敗を検出できないものは、有効なテストとして扱いません。

各テストの配置ルールとE2Eテストの一覧は、[docs/quality/test-strategy.md](docs/quality/test-strategy.md)にまとめています。

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

`content/`に表示文字列と村の定義、`src/`にアプリ本体、`scripts/`にビルドと検査、`tests/`にE2Eを置いています。単体テストは`src`の中に対象と並べて、統合テストはコンテナのフォルダに置いています。設計文書は`docs/`で、どのファイルがどの画面に対応するかは [docs/product/feature-map.md](docs/product/feature-map.md) にあります。

> 配信はSettings → Pages → Sourceを「GitHub Actions」にした状態で、`main`へのpushにより行われます。

</div>
