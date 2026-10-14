---
status: active
read_when:
  - import の向きで ESLint に落とされたとき
  - `npm run test:boundary` の `check-layers` に落とされたとき
  - 'use client' を足す・動かすとき
  - 新しいレイヤーやフォルダを作ろうとするとき
source_of_truth: true
last_reviewed: 2026-10-14
---

# 境界

このリポジトリには3種類の境界がある。**レイヤー(import の向き。コンテナと表示部品の分け方を含む)**、**server と client**、**データとコード**。
1つ目は機械が守らせる(import の向きは ESLint、コンテナと表示部品の分け方は `scripts/check-layers.mjs`)。残り2つも一部は機械化済みで、`content/` から `src/` への import は ESLint が落とし(`eslint.config.mjs`)、
`src/lib/content/read.ts` をクライアントへ持ち込むと先頭の `import 'server-only'` でビルドが落ちる。
それ以外(`'use client'` を島だけに置く・`content/` に判定・検証を持ち込まない)は規約として守る。

## レイヤー(機械が守らせる)

許される向きは一方向だけ。

```
content(データ) ─┐
                 ↓
utils ← lib ← hooks ← components ← app
```

- `src/utils/` — 純粋関数・定数のみ。`lib` `hooks` `components` `app` と `content` の実データを import しない
- `src/lib/` — 外の世界(ファイル読み・保存・ネットワーク)に触れる層。`hooks` `components` `app` を import しない
- `src/hooks/` — `components` `app` と `content` の実データを import しない
- `src/components/` — `app` と `content` の実データを import しない
- `src/app/` — `content` を直接読まない。`@/lib/content/read` 経由
- `content/` — データ。`src/` を一切 import しない

加えて2つ。

- **`content/` の実データ(`@content/ja` `@content/ko` `@content/world`)を読んでよいのは `src/lib/content/` だけ。** 型(`@content/types/...`)はどこから読んでもよい
- **バレル禁止。** `from '.'`(同フォルダ)と `from '..'`(親フォルダ)は全ファイルで禁止。`./index` か `@/<絶対パス>` を使う

正本は `eslint.config.mjs`。**この表を信じる前に、落ちたときのメッセージを読む**(禁止理由がそのまま書いてある)。
規則を変えるときは表ではなく `eslint.config.mjs` を直し、この文書を直す。→ [ADR 0004](../decisions/0004-lint-enforced-layer-boundaries.md)

### コンテナと表示部品(機械が守らせる)

`src/components/` と `src/hooks/` の中は、外の世界に触れてよいファイルを**コンテナ**に限る([ADR 0017](../decisions/0017-screen-containers.md))。
ファイルの分け方(ローダー・コンテナ・表示部品)は [frontend.md](frontend.md) の「ローダー・コンテナ・表示部品」。

- **コンテナ** — 名前が `container.tsx` のファイルと、そのフォルダの直下の `hooks` フォルダ。画面の3つ(`src/components/VillagePage/`・`src/components/Directory/`・`src/components/Story/`)と、
  横断部品の3つ(`src/components/ui/SettingsMenu/`・`src/components/ui/PageviewCounter/`・`src/components/ui/ScenePlayer/`)にだけある。
  この6つの一覧の正本は `scripts/container-dirs.mjs` で、名前が `container.tsx` でも一覧の外のものはコンテナに数えない
- **ローダー** — 画面の3つのフォルダの `index.tsx`(横断部品のフォルダの `index.tsx` はローダーではない)。サーバでだけ働き、content の読み出し(`@/lib/content/read`)と `notFound()` はここで行う
- **表示部品** — それ以外のすべての `.tsx` と `src/hooks/`。次を import しない
  - 外の世界に触れるモジュール: `@/lib/preferences`・`@/lib/weather`・`@/lib/analytics`・`@/lib/fetch-svg-source`・`@/lib/content/` の下・`@/lib/metadata`
  - 村の時計のストア(`src/components/VillagePage/hooks/use-village-time.ts`)
  - `next/navigation`
  - 画面のフック(画面のフォルダの直下の `hooks` フォルダの下)
  - 画面のコンテナ(画面の3つの `container.tsx`。描くのはそのフォルダのローダーと、統合テスト・フィクスチャだけ)

  import の要らない外の世界の入口(`fetch`・`localStorage`・`sessionStorage`・`indexedDB`・`navigator.sendBeacon`・`document.cookie`・`XMLHttpRequest`・`WebSocket`・`EventSource`)も使わない。

`@/lib/village/`・`@/lib/pixel/` は I/O の無い純粋なロジックなので、表示部品から使ってよい。
ただし `node:` のモジュールを使う `src/lib/pixel/sheet-file.ts`・`src/lib/pixel/png.ts` はローダーだけが使う(ブラウザでは読み込めない。この2つは下の検査の入口に入っておらず、機械では見ていない)。
型だけの import(`import type`・`import { type X }`・`export type`)は上の禁止に掛からない(実行時に読み込まれないため)。表示部品は `@/lib/weather` の `Precipitation`・`@/lib/preferences` の `Theme` などの型を props に使ってよい。

守らせるのは `scripts/check-layers.mjs`(`npm run test:boundary`)で、src の import を全部読んでつながりをたどり、式の中の大域の名前も見る。
ESLint の `no-restricted-imports` はファイル1つずつの指定子しか見ないので、「入口を import するフックを表示部品が import する」形を見逃すため。

- **許す側**は一覧のフォルダの `container.tsx`・その隣の `hooks` フォルダ(下のフォルダも)・ローダー(画面の3つのフォルダの `index.tsx`)・`src/app/`・`src/lib/`・テスト(`*.test.ts`・`*.test.tsx`・`*.browser.test.tsx`)・`*.fixture.ts`・`*.test-helper.ts`。
  それ以外の src のファイル(表示部品と、そのフック・utils、`src/hooks/`、`src/utils/`)が、上の入口か、入口へ届くファイルを import すると落ちる。間にフック・部品・utils を何段挟んでも同じで、落ちたときは入口へ届く道(import のつながり)を出す。
  パッケージの入口は前方一致で見る(`next/navigation` の後ろに拡張子を付けて書いても同じ)
- **許す側の外のファイルは、import の要らない外の世界の入口を使わない。** 構文木で式の中の名前を見て、`window.`・`globalThis.`・`self.` を付けたもの・`['…']` で引くもの・分割代入で取り出すものも数える。
  注釈・文字列・型の位置は数えない。名前だけで見るので、同じ名前の変数や引数を作ってそれを使っても落ちる(名前を変える)
- **コンテナは届く道を外へ伝えない。** 横断部品のコンテナ(`src/components/ui/ScenePlayer/container.tsx` など)は、表示部品が外から `container.tsx` を直接指して描く決まりなので([ADR 0017](../decisions/0017-screen-containers.md) の Consequences)
- **許す側の外のファイルは、コンテナの隣の `hooks` フォルダ**(一覧のフォルダの直下の `hooks` の下。画面の3つと横断部品の3つのどれも)**を import しない。** 今は入口へ届かないフックでも、そこは画面の状態・データのフックの置き場なので落ちる。
  表示部品の UI のフックは、使う部品の隣の `hooks` フォルダに置く
- **画面のコンテナを import してよいのは、同じフォルダのローダー・統合テスト(`container.browser.test.tsx`)・フィクスチャ(`container.fixture.ts`)だけ。** 許す側(`src/app/` など)でも同じで、ルートはローダーを指す。
  型だけの import は数えない
- **一覧の外に `container.tsx` を置くと落ちる。一覧のフォルダに `container.tsx` が無くても落ちる。** 前者は、どこにでも外の世界の import を許す場所(とその隣のローダーまがいの `index.tsx`)を作れないように。
  後者は、改名・移動で一覧が空振りして、そのフォルダの `hooks` の許しだけが黙って残らないように。新しいコンテナを置くなら、一覧と [ADR 0017](../decisions/0017-screen-containers.md) の D1 に足す
- 入口の一覧と許す側の正本は `scripts/check-layers.mjs`、コンテナを置くフォルダの一覧の正本は `scripts/container-dirs.mjs`(`scripts/check-test-boundary.mjs` も同じものを使う)。
  落ちたら、その import をコンテナ(またはその隣の `hooks` フォルダ)へ移し、値を props で表示部品へ渡す

### 型の正本が下の層にあるとき

`DayPhase` の定義は `src/utils/day-phase.ts` にある。`src/lib/pixel/palette-phase.ts` はそれを **import するだけで再 export しない**。
同じ型の入口が2つあると、呼び出し側ごとにどちらを使うかがばらつくため。同じ状況を作るときはこの前例に合わせる。

## server と client

既定はサーバコンポーネント。`'use client'` は**ブラウザの入力・アニメーション・保存・DOM 実測が必要な島**にだけ置く。

現在クライアントなのは、村のコンテナ(`src/components/VillagePage/container.tsx`)とその下の全部(起動の覆い・見出し・`src/components/VillagePage/components/Village/` 配下・設定メニュー)、一覧の `WorkCard`、
作品ストーリーのモーダル・ポップオーバー・場面再生(`src/components/Story/` 配下と `src/components/ui/ScenePlayer/` `src/components/ui/SettingsMenu/`)、
全ページ共通のアクセス計測(`src/components/ui/PageviewCounter/`。pathname の変化を見て送るだけで何も描かない)。
一覧と作品ストーリーのコンテナ(`src/components/Directory/container.tsx`・`src/components/Story/container.tsx`)はフックを持たず、サーバのまま描く。
画面のローダー(各画面の `index.tsx`)は常にサーバ。

線を引くときの基準:

- **content を読むのはサーバ側**。クライアントへは props で必要な値だけ渡す(`read.ts` は `server-only` なので持ち込めない)
- 重い組み立て(スプライトシートの合成など)はサーバで1回だけ行い、結果を props で渡す
- `'use client'` を上へ動かすと、その下は全部クライアントになる。**島は小さいほどよい**

## データとコード

`content/` は「コードツリーの外に置いたデータ」。ja / ko の対称を目で確認できる状態を保つのが目的で、
置いてよい処理はデータを組み立てるだけの展開(`content/world.ts` の `expandBlocks`)まで。判定・検証は `src/lib/` に置く。編集の決まりは [../../content/AGENTS.md](../../content/AGENTS.md)。
