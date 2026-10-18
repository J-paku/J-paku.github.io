---
status: historical
read_when:
  - コンテナのファイルを `container.tsx` などの別の名前に分け直したくなったとき
  - ファイルの名前だけでコンテナと表示部品を見分けたくなったとき
  - 画面のサーバのローダーがなぜ `src/app/` にあるのかを問われたとき
source_of_truth: false
last_reviewed: 2026-10-18
---

# 0024. コンテナも入口を `index.tsx` にし、`container.tsx` を無くす

## Status

Accepted(2026-10-18、利用者の決定)。コンテナのファイルを `container.tsx` から同じフォルダの `index.tsx` へ移し、コンポーネントのフォルダの入口をいつも `index.tsx` にする。
画面の3つのサーバのローダーは `src/app/` へ、場面の再生(ScenePlayer)の表示部品は `src/components/ui/ScenePlayer/components/SceneStack/` へ移す。次の部分を置き換える。

- [0017](0017-screen-containers.md) の D2 のうち、画面のフォルダの `index.tsx` をサーバのローダーにし、アプリのルート(`src/app/`)がそれを import する部分。
  ローダーは `src/app/` の `directory-screen.tsx`・`story-screen.tsx`・`village-screen.tsx` へ移り、画面のフォルダの `index.tsx` は画面のコンテナになる。
  ローダーがすること(サーバの読み出し・スプライトの生成・`notFound()`・初回の HTML に要るインラインの `<style>`・`<script>`)と中身は変えない
- [0019](0019-hooks-make-containers.md) の「定義」の、コンテナのファイル名を `container.tsx` にし、画面のローダーを画面のフォルダの `index.tsx` とする部分と、
  「ファイルの形」の、状態コンテナのフォルダに `index.tsx` を置かず、外から `.../<Name>/container` を指す部分。
  同じく「機械が守らせる所」の、ESLint の規則 `layer/hook-only-in-container` が `**/container.tsx` を外す部分と、状態コンテナのフォルダに `index.tsx` があると落とす検査。
  その検査のうち、フォルダの名前で import できてしまう `index.ts`・`index.d.ts`・`index.js`・`index.jsx` を落とす部分は残る(`index.tsx` のある全てのフォルダへ広げた。`scripts/check-test-boundary.mjs`)。
  Alternatives Considered の「状態コンテナも入口を `index.tsx` のままにする — 採らない」と「統合テストの名前を `index.integration.test.tsx` にする — 採らない」
- [0022](0022-colocate-integration-tests.md) の「置き場と名前」のうち、対のファイルの名前を `container.integration.test.tsx` にして `index.integration.test.tsx` を採らない部分と、
  統合テストが自分のコンテナを `./container`・`../container`・`@/components/.../container` で import する部分、I/O コンテナのフィクスチャの名前 `container.fixture.ts`。
  「カバレッジ」の、画面の3つのローダーを名前の一覧(`SCREEN_LOADERS`)で表示部品のファイル別100%から外す部分と、
  Alternatives Considered の「対のファイルの名前を `index.integration.test.tsx` にする — 採らない」

[0011](0011-extreme-constraints.md) は、テストの境界を変えるには新しいADRを求める。統合テストの対のファイルとフィクスチャの名前と、統合テストが自分のコンテナを import する形は、
0022 がテストの境界として決めたものなので、このADRで決める。テストの置き場・本数・断定は変えない。

## Context

決める前(`0d4212f`)のこのリポジトリは次の状態だった。

- **コンテナは `container.tsx` が22個だった**(I/O コンテナが6つ、状態コンテナが16個。0019)。状態コンテナのフォルダには `index.tsx` が無く、外からは `.../<Name>/container` を指していた
- **`index.tsx` は45個で、フックを呼ばない表示部品の42個と、画面の3つ(`Directory`・`Story`・`VillagePage`)のサーバのローダーだった**(0017 の D2)
- **`index.tsx` と `container.tsx` の両方があるフォルダが4つあった。** 画面の3つ(`index.tsx` がローダーで、`container.tsx` を描く)と、場面の再生の `ui/ScenePlayer`
  (`index.tsx` が場面を重ねて切り替える表示部品で、`container.tsx` がそれを描く)
- 統合テストの対のファイル `container.integration.test.tsx` が5つ、I/O コンテナのフィクスチャ `container.fixture.ts` が4つあった(0022)
- 0019 は Alternatives Considered で「状態コンテナも入口を `index.tsx` のままにする」を、ファイルの名前だけではどれがコンテナか見えないとして採らなかった。
  0019 と 0022 は「統合テストの対のファイルを `index.integration.test.tsx` にする」を、画面のフォルダの `index.tsx` がローダーで、テストの名前と描く相手がずれるとして採らなかった

2026-10-18、利用者が一覧(`Directory`)のフォルダの中身を貼り、`index.tsx` とコンテナを1つにまとめると決めた。次は利用者の言葉(利用者の言葉を日本語にした。以下も同じ)。

- 「これ、なんで index とコンテナが別々にあるの、なんで?? 1つにまとめてよ、index に...」

範囲と進め方は、AskUserQuestion での利用者の答えで決めた。

- 範囲: 「全部のコンテナを index に」。
  選んだ選択肢の説明(問いの側が書いたもので、利用者の言葉ではない)は、コンテナ22個の `container.tsx` を全部 `index.tsx` にする、画面の3つのサーバのローダーは `src/app` のルートの側へ、
  ScenePlayer の表示部品は components/ の下へ移す、対のテストの名前は `index.integration.test.tsx`、
  失うものはファイルの名前だけを見てコンテナかどうか分からなくなること(検査がフックの呼び出しで判定する)、だった
- 計画: 「進めて、通ったらコミット・push」

## Decision

1. **コンポーネントのフォルダの入口は、いつも `index.tsx`。** `container.tsx` という名前のファイルは置かない(あれば落ちる)
2. **コンテナは、`src/components/` の下の `index.tsx`(`hooks`・`__tests__` の中の `index.tsx` を除く)のうち、次のどちらかに当たるもの。** ほかの `index.tsx` は表示部品
   - (a) React のフック(名前が `use` に大文字か数字が続く関数)を呼ぶ
   - (b) I/O コンテナの6つ(一覧の正本は `scripts/container-dirs.mjs`)のフォルダの `index.tsx`
3. **フックを呼んでよいのは、`src/components/` の中では `index.tsx`(`hooks`・`__tests__` の中の `index.tsx` を除く)だけ**(今までの `container.tsx` の場所)。`hooks` フォルダのフックのファイルは今までどおり
4. **コンテナは自分の統合テストを持つ。** 1本なら `<フォルダ>/index.integration.test.tsx`(対のファイル)、2本以上なら `<フォルダ>/__tests__/<動作>.integration.test.tsx`。
   表示部品(フックを呼ばず、I/O の一覧にも無い `index.tsx`)は、自分のテストも `__tests__` も持たない。
   表示部品がフックを呼び始めるとコンテナになるので、テストが無ければ境界の検査(`npm run test:boundary`)が落とす
5. **I/O コンテナのフィクスチャの名前は `index.fixture.ts`**(今までは `container.fixture.ts`)。置く所の決まりは今までどおり
6. **統合テストは、自分のコンテナを別名 `@/components/<フォルダの道>` で import する**(今までは `@/components/<フォルダの道>/container`)
7. **画面の3つ(`Directory`・`Story`・`VillagePage`)のサーバのローダーは、`src/app/directory-screen.tsx`・`src/app/story-screen.tsx`・`src/app/village-screen.tsx` へ移す**
   (中身はそのまま、import だけ直す)。ルートのファイル(`src/app/(ja|ko)/…/page.tsx`)はそのローダーを import する。
   画面のフォルダの `index.tsx` は今までの `container.tsx`(直列化された props で画面を組む)
8. **ScenePlayer の表示部品(今までの `src/components/ui/ScenePlayer/index.tsx`。場面のクロスフェード)は、`src/components/ui/ScenePlayer/components/SceneStack/index.tsx` へ移す**
   (その部品だけが使う CSS も一緒に、`scene-player.module.css` から `scene-stack.module.css` へ)。`container.tsx` が `index.tsx` になる
9. **ほかの決まりは変えない。** 統合テストの置き場(コンテナのフォルダ)、部品の置き場、コンテナは `src/components/<名前>/`(`ui` の下は `src/components/ui/<名前>/`)の下にだけ置けること、
   I/O コンテナの一覧は6つで固定、フックのファイルとコンポーネントのファイル別100%、`hooks`フォルダにテストを置かない、どのテストでも`renderHook`を使わない、など。
   表示部品のファイル別100%から画面のローダー3つを外していた一覧(`SCREEN_LOADERS`)は、ローダーが `src/components` の外へ出るので要らなくなる
10. **content を読むのは画面のローダーだけ。** I/O コンテナとその隣の `hooks` フォルダも、content の読み出し(`src/lib/content/` の下)へは届かない(間に lib・utils を挟んでも同じ)。
    コンテナはローダーが読み出した値を props で受け取る。画面とローダーは画面ごとに1つの対(`scripts/check-layers.mjs` の `SCREEN_LOADER_OF`)で、画面のコンテナを import してよいローダーはその対の1つだけ。
    対のローダーのファイルが無いときと、ローダーを `src/components/` の中へ戻した(I/O コンテナの `index.tsx` が content を読む)ときは、`npm run test:boundary`(`scripts/check-layers.mjs`)が落とす

### この記録と同じ作業で移すもの

`container.tsx` の22個を同じフォルダの `index.tsx` へ、画面のローダーの3つを上の7の名前へ、ScenePlayer の表示部品とその CSS を上の8の場所へ、
対のファイルの5つを `index.integration.test.tsx` へ、フィクスチャの4つを `index.fixture.ts` へ移し、それらを指す import を直す。
移すときに、テスト(`test(…)` の名前と断定)は変えず、消さない。

## Consequences

- **どのコンポーネントのフォルダも、入口は `index.tsx` の1つになる。** 外からはフォルダの道(`@/components/<フォルダの道>`)で import する。
  1つのフォルダに入口が2つある形(上の4つのフォルダ)は無くなる
- **失うもの: ファイルの名前だけでは、どれがコンテナか分からない。** コンテナかどうかは、検査がその `index.tsx` のフックの呼び出しと I/O コンテナの一覧から決める。
  人が見分けるには、ファイルの中のフックの呼び出しか、隣の `index.integration.test.tsx`・`__tests__` の有無を見る。
  0019 が `index.tsx` のままにする案を退けた理由がこれで、利用者は選択肢の説明でこれを見たうえで選んだ([Context](#context))
- **フックの無い I/O コンテナもコンテナに数える。** 一覧と作品ストーリーの画面の `index.tsx` はフックを呼ばないが、I/O コンテナの一覧にあるので、自分の統合テストを持ち、外の世界に触れてよい(content の読み出しを除く。Decision 10)
- **部品にフックを1つ足すと、ファイルの名前は変わらないままコンテナになる。** そのフォルダに統合テスト(1本なら隣の `index.integration.test.tsx`)が要り、無ければ `npm run test:boundary` が落とす。
  ファイルを `container.tsx` へ改名する手順は無くなる
- **画面のローダーは `src/components` の外(`src/app/`)に出て、`src/components` の中の `.tsx` は全部ブラウザで描ける。**
  統合のカバレッジのファイル別100%から外す一覧(`SCREEN_LOADERS`)とそれを確かめる処理は要らなくなる
- **対のファイルの名前 `index.integration.test.tsx` は、対にする相手の `index.tsx` に合う。** 0019・0022 が `index.integration.test.tsx` を退けた理由(画面のフォルダの `index.tsx` はローダーで、描く相手とずれる)は、
  ローダーが `src/app/` へ出たので当たらなくなった

## Alternatives Considered

- **`index.tsx` と `container.tsx` が両方あるフォルダの4つ(画面の3つと `ui/ScenePlayer`)だけを1つにまとめる** — 利用者が選ばなかった。範囲の問いで「全部のコンテナを index に」を選んだ([Context](#context))。
  この案では、ほかの18個のコンテナは `container.tsx` のまま残る
- **今のまま(`container.tsx` と `index.tsx` を分けたまま)にする** — 利用者が退けた([Context](#context))
- ほかに比べた案の記録は無い
