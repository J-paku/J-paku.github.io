---
status: historical
read_when:
  - テストをどの層(静的・単体・統合・E2E)に置くか迷ったとき
  - E2E を消して統合テストへ移したくなったとき
  - フックをどう確かめ、どこまでカバレッジを測るかを問われたとき
source_of_truth: false
last_reviewed: 2026-10-13
---

# 0016. 層の基準をテスティングトロフィーにし、画面単位の統合テストを実ブラウザ(Vitest Browser Mode)で一番厚くする

## Status

Accepted(2026-10-13、利用者の決定)。次の部分を置き換える。

- [0009](0009-widen-happy-dom-test-scope.md)の「村のコンポーネントを描く統合テストは引き続き作らない」。村も画面単位で統合テストの対象にする
- [0011](0011-extreme-constraints.md)の「ファイルの境界」のうち、フックとコンポーネントの「振る舞いはE2Eと統合テストで見る」と「フックはカバレッジも測らない」。
  フックはそれを使う画面を統合テストで描いて見て、統合テストへ移し終えたフォルダからファイル別100%で測る
- happy-dom でコンポーネントを描くテストを「統合」と呼んでいた所([0007](0007-component-tests-happy-dom.md)・0009・0011・[../quality/test-strategy.md](../quality/test-strategy.md))。
  それは単体に数え、「統合」は Vitest Browser Mode で画面を描くテストを指す

`hooks`フォルダに単体テストを置かない・どのテストでも`renderHook`を使わない(0011。`npm run test:boundary`)は変えない

## Context

2026-10-13、利用者がテストの方針をテスティングトロフィーへ移すと決めた。目的は2つ。

1. フックの振る舞いを、ビルド無しで回る速い統合テストで止める
2. E2E の本数と時間を減らす

決める前のこのリポジトリは次の状態だった。

- **E2E は15ファイル・130件**(件数は2026-10-11に`npx playwright test --list`で数えたもの。[../quality/test-strategy.md](../quality/test-strategy.md))。
  うち12ファイル(journey・layout・day-night・night-transition・clock・dialog-focus・fishing・idle-loop・flight・umbrella・not-found・storage-blocked)が村を開く。
  E2E は`npm run build`の結果の`out/`を配って走るのでビルドが要り、全体は手元で約3分44秒かかる(2026-10-11、0015 で 130 件へ減らす前の実測。[../agents/verification.md](../agents/verification.md))
- **フックは43ファイル**(`hooks`フォルダの下。`src/hooks/`の2つを含む。2026-10-13に数えた)で、うち30が村(`src/components/VillagePage/`)にある。
  0011から`renderHook`を使わず、カバレッジも測らない(`vitest.config.ts`が`src/**/hooks/**`を外す)。
  村のコンポーネントを描くテストは無い(0009)ので、村の30のフックは E2E でしか動かない
- **happy-dom(20.14.5、`package-lock.json`)は配置を計算しない。** `getBoundingClientRect()`は空の DOMRect を返し、`ResizeObserver.observe()`は実装が無い。
  村は実際の寸法・rAF の歩行ループ・`ResizeObserver`(`use-stage-scale`・`use-walk-loop`など)に依存するので、happy-dom で村の画面を描いても確かめたいものが再現しない。
  0009が村を統合テストの対象から外した理由は「寸法と rAF に依存するため」(`148a540`の本文)だった
- happy-dom でコンポーネントを描くテストは8本(作品カードとその部品3つ・経歴・設定メニュー・ページ移動の計測・技術チップ)で、「統合」と呼んでいた

### 調べた基準

利用者の決定の前に次を調べた。引用は原文のまま。

- **Kent C. Dodds / Testing Library**
  - [The Testing Trophy and Testing Classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications) — 層は静的・単体・統合・E2E。
    単体はコンポーネント1つ、統合は HTTP を MSW で差し替えたページ全体、E2E はほとんどモックしないアプリ全体とする
    (「Testing Library can be used to test individual React components (unit tests), entire pages with HTTP requests mocked via MSW (integration tests), the full app with very few mocks (end-to-end tests)」)。
    物差しは「it's all about getting a good return on your investment where 'return' is 'confidence' and 'investment' is 'time.'」で、呼び名そのものは「But ultimately it really doesn't matter.」とする
  - [Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests) — 「Write tests. Not too many. Mostly integration.」。
    一方で「mandating 100% code coverage for applications. That's a really bad idea.」、
    「When you mock something you're removing all confidence in the integration between what you're testing and what's being mocked.」
  - [静的・単体・統合・E2E の違いの記事](https://kentcdodds.com/blog/static-vs-unit-vs-integration-vs-e2e-tests) — 「The idea behind integration tests is to mock as little as possible.」
  - [How to test custom React hooks](https://kentcdodds.com/blog/how-to-test-custom-react-hooks) — 一度しか使わないフックは「(those should be covered by your component tests)」
  - [Guiding Principles](https://testing-library.com/docs/guiding-principles) — 「The more your tests resemble the way your software is used, the more confidence they can give you.」
  - [renderHook](https://testing-library.com/docs/react-testing-library/api/#renderhook) — 「mostly interesting for libraries publishing hooks.」
    「You should prefer render since a custom test component results in more readable and robust tests」
- **Google**
  - [『Software Engineering at Google』ch11](https://abseil.io/resources/swe-book/html/ch11.html) — テストを大きさで分ける。small は単一プロセス、medium は単一マシン(ネットワークは localhost だけ)、large は制限なし。範囲(scope)は別の軸とする。
    ブラウザが要るテストは medium に入る(「testing a UI component like a date picker often requires running an entire browser, even to validate a single code path」)
  - [Just Say No to More End-to-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)(2015) — 70/20/10 の配分
  - [Where do our flaky tests come from?](https://testing.googleblog.com/2017/04/where-do-our-flaky-tests-come-from.html)(2017) — 揺れるテストの率は small 0.5%・medium 1.6%・large 14%
- **Microsoft** [Shift testing left with unit tests](https://learn.microsoft.com/en-us/devops/develop/shift-left-make-testing-fast-reliable) — L0〜L4 の層と「Write tests at the lowest possible level」
- **Spotify** [Testing of Microservices](https://engineering.atspotify.com/2018/01/testing-of-microservices)(2018) — honeycomb
- **Ham Vocke** [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) —
  「If a higher-level test spots an error and there's no lower-level test failing, you need to write a lower-level test」
- **実行環境** — [Vitest 4](https://vitest.dev/blog/vitest-4) で Browser Mode が実験扱いを外れた(「With this release we are removing the `experimental` tag from Browser Mode.」)。
  このリポジトリの vitest は 4.1.10(`package-lock.json`)

## Decision

### 層は4つで、実行環境とファイル名で決める

層の考え方はテスティングトロフィーに合わせ、配分もトロフィーどおり統合を一番厚くする。
Kent は層の境目をモックの量に置くが、モックの量は機械で判定できない。このリポジトリは人がコードを読まず機械の門で信頼する(0011)ので、
層は**どこで走るか**と**ファイル名**で機械的に決める。

| 層 | 対象 | 実行環境 | ファイル名 |
|---|---|---|---|
| 静的 | 型・lint・整形・文書の参照 | tsc・ESLint・Prettier・`scripts/check-docs.mjs` | — |
| 単体 | 純粋関数(ファイル別100%・変異100%)、DOM を使う utils、コンポーネント1つだけを描くテスト(今まで「統合」と呼んでいた happy-dom の8本) | Vitest の node と happy-dom | `*.test.ts`・`*.test.tsx` |
| 統合(一番厚い) | 画面単位のコンポーネントを、フック・子と一緒に描く。村も含む。モックはネットワーク(天気)と時間だけ | Vitest Browser Mode(Chromium、ビルド無し) | `*.browser.test.tsx`(仮) |
| E2E | ビルド結果でしか確かめられないもの(静的経路・404・初回ペイント前のテーマ・言語の接頭を保つ移動・保存が塞がれた時)と、ページをまたぐ核心の旅程を数本 | Playwright と`out/` | `tests/**/*.spec.ts` |

### テストを書くときの拠り所(4つ)

1. **実際の使い方に似るほど信頼が増す。** 断定は利用者に見えるもの(role・名前・`aria-*`・要素の有無)で行う(Testing Library の Guiding Principles)
2. **確かめられる一番小さい層に置く。**(Microsoft「Write tests at the lowest possible level」)
3. **上の層でバグが出たら、下の層にテストを足す。**(Ham Vocke の上の引用)
4. **本物の実装を先に使い、モックはネットワークと時間だけにする。**(Kent「When you mock something you're removing all confidence …」)

2と「統合を一番厚くする」は食い違わない。純粋関数で確かめられるものは単体に置く。フックの配線は`renderHook`を使わない(下)ので、画面を描かないと確かめられない。
寸法・rAF に頼る画面(村)のフックは、happy-dom で描いても確かめたいものが再現しない(Context)ので、確かめられる一番小さい層が統合になる。

### フック

- **`renderHook`を使わない決まり(`npm run test:boundary`)は変えない。** フックは、そのフックを使うコンポーネントを統合テストで描いて見る。
  Testing Library の`renderHook`の説明と、Kent の「(those should be covered by your component tests)」に合わせた形である
- **フックはファイル別カバレッジ100%にする。** 統合テストへ移し終えたフォルダから掛け、掛けたフォルダの一覧は減らせないよう機械で検査する。
  全部移し終えたら一覧を消し、「全フック」を対象にする規則にする。それまで、一覧に無いフォルダのフックは今までどおり測らない

### E2E を消す条件

- **E2E は、統合テストが同じ欠陥を一度落とすのを見てから消す。** [../quality/test-strategy.md](../quality/test-strategy.md) の「新しい検査は必ず一度落とす」を、移す先のテストに当てはめたもの
- 下の「統合へ移す」にある spec をこの条件で消すのは、このADRが決めたこととする(0011は「テストを消す」に新しいADRを求める)。
  どの欠陥を入れてどの統合テストが落ちたかは、消すコミットの本文に書く

### 変異テストは単体だけ

- 変異テスト(Stryker)は今までどおり単体だけで回し、統合テストは使わない。Stryker が読む設定は node だけのものに分ける
- 理由: Stryker の vitest-runner の公式文書は Limitations に「Currently, [Browser Mode] is not supported.」と書き、変更履歴は 8.0.0 で「support browser mode」と書いていて食い違う。
  このリポジトリの版(10.0.0、`package-lock.json`)で Browser Mode のテストを使えるかは測っていない

### ネットワークのモックは今の方式

差し替えは今の方式(`vi.stubGlobal`、E2E は Playwright の route)を続ける。MSW は入れない。

### E2E に残すもの・移すもの(予定)

| 行き先 | spec |
|---|---|
| E2E に残す | not-found・directory・storage-blocked と、journey の一部(村↔作品↔一覧の移動、完走1回) |
| 統合へ移す | layout・day-night・night-transition・clock・dialog-focus・fishing・idle-loop・flight・umbrella・story・scene-refetch |

journey のそれ以外のテストの行き先は、この表では決めていない。

### Kent との違い

- **フックをファイル別100%にする。** Kent はアプリに100%を求めることを「That's a really bad idea.」と書く。
  このリポジトリは人がコードを読まず、制約を通ったものを信頼する(0011)ので、0011どおり厳しい側を採る
- **MSW を使わない。** Kent の分け方では、統合テストは HTTP を MSW で差し替える。このリポジトリは今の差し替えの方式を続ける

## Consequences

この記録の時点(2026-10-13)では、設定もテストもまだ変えていない。以下は導入で起きること・導入で確かめることである。
基盤の段階(同日)で測った結果・決めた形は、その項に書き足した。

- **新しい依存`@vitest/browser-playwright`は4.1.10に版を固定する**(`^`を付けない)。peer が`vitest: 4.1.10`で、`latest`の5.0.4は vitest 5 を求め、今の vitest 4.1.10(`package-lock.json`)と衝突する。
  vitest を上げるときは、これも同じ版へそろえて上げることになる
- **ブラウザ側の時間帯を別に固定する。** `TZ=UTC`(`package.json`の scripts と`vitest.config.ts`の`env`)は node のプロセスにだけ効き、ブラウザには効かない。
  provider の`contextOptions`で固定する。基盤の段階で`timezoneId: 'UTC'`を置き(`vitest.integration.config.ts`)、ブラウザの中の`Intl.DateTimeFormat().resolvedOptions().timeZone`が`UTC`になるのを確かめた。
  外すと、この機器では`Asia/Tokyo`になった。
  昼夜の段階は JST で決まる([0006](0006-jst-fixed-day-phase.md))ので、村の統合テストは機器の時間帯に結果を左右させないことが要る
- **偽の時計に気をつける。** Vitest の偽の時計を入れると、locator の操作が時計を進めない([vitest-dev/vitest#10058](https://github.com/vitest-dev/vitest/issues/10058)、2026-10-13の時点で open)。
  時間を差し替える統合テストで当たりうる
- **Stryker 用に node だけの設定を分ける。** Browser Mode 対応が未実測のため。今の`stryker.config.mjs`は`vitest.config.ts`を読む。
  基盤の段階では projects で分けず、統合テストを別の設定ファイル(`vitest.integration.config.ts`)にした。Stryker が読む`vitest.config.ts`へブラウザのテストを入れないためで、
  `vitest.config.ts`は`*.browser.test.tsx`を exclude で外す。
  `stryker.config.mjs`か`vitest.config.ts`を変えると CI の変異テストはキャッシュの鍵の指紋が変わり、最初の push で全部が走る([0013](0013-incremental-mutation-on-push.md))
- **統合テストで測ったフックのカバレッジを、今の`npm run test:coverage`の門で数えられるかは測っていない。** 基盤の段階で確かめる。
  基盤の段階では、統合テストのカバレッジを単体の門へ合わせず、別の設定で測る形にした(`npm run test:integration -- --coverage`、報告は`coverage/integration`)。
  床はまだ掛けておらず、`npm run test:coverage`の門で数えられるかも確かめていない
- **CI の時間への影響は測っていない。** 統合テストは Chromium を立てて走り、E2E は移した分だけ減る。どちらも導入の段階で実測する
- **移行は段階を分ける。** 不変ルール「1段階 = 1セッション」([../../AGENTS.md](../../AGENTS.md))に従い、次の順で進める。3はフォルダごとに複数のセッションに分けうる
  1. 文書(このADRと[../quality/test-strategy.md](../quality/test-strategy.md))
  2. 基盤: 依存の追加、node と browser の設定の分離(projects ではなく別の設定ファイル`vitest.integration.config.ts`。上の Stryker の項)、ブラウザ側の時間帯の固定、CI。まずテスト1本で実際に動くことを確かめる
  3. フォルダごとに統合テストを足し、そのフォルダのフックへ100%の門を掛け、重なる E2E を消す
- **移行の途中は、同じ振る舞いを E2E と統合テストが二重に見る期間がある。** E2E は、統合テストが同じ欠陥を落とすのを見るまで消さないため
- **呼び名が変わる。** happy-dom の8本(`index.test.tsx`)は単体に数え、ファイル名は変えない。0007・0009・0011の本文の「統合テスト」は happy-dom のテストを指す
- 0011の Consequences の「フックの振る舞いを見るのはE2Eだけになった」は、統合テストへ移し終えたフォルダから当てはまらなくなる

## Alternatives Considered

- **Google のテストの大きさ(small・medium・large)で層を決める** — ブラウザが要るテストは medium に入る(ch11)。
  Vitest Browser Mode のコンポーネントテストも、localhost で`out/`を配る今の E2E も単一マシンの medium になり、ビルドが要るかどうかで分けられない。採らない
- **Microsoft の L0〜L4・Spotify の honeycomb を層の基準にする** — 利用者がトロフィーを選んだので採らない。Microsoft の「Write tests at the lowest possible level」は拠り所の2として採った。
  それぞれを退けた理由は、ほかに記録が無い
- **happy-dom に偽の寸法・rAF を足して村を描く** — happy-dom は`ResizeObserver.observe()`に実装が無く、`getBoundingClientRect()`は空の DOMRect を返すので、
  画面の大きさが変わったときにマス寸法を計算し直すことを確かめられない。採らない
- **Playwright の新しいコンポーネントテスト(`mount`)** — Next.js では gallery 用の Vite サーバを別に立てる必要がある。
  旧`@playwright/experimental-ct-react`は1.62.1で更新が止まっている(今の`@playwright/test`は1.63.0、`package-lock.json`)。採らない
- **村は E2E のまま見続ける** — 目的の2つ(フックをビルド無しの速いテストで止める・E2E を減らす)のどちらにも届かず、村の30のフックは E2E でしか動かないまま残る。採らない
