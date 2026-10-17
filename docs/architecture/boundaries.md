---
status: active
read_when:
  - import の向きで ESLint に落とされたとき
  - `npm run test:boundary` の `check-layers` に落とされたとき
  - ESLint の `layer/hook-only-in-container` に落とされたとき
  - 'use client' を足す・動かすとき
  - 新しいレイヤーやフォルダを作ろうとするとき
source_of_truth: true
last_reviewed: 2026-10-17
---

# 境界

このリポジトリには3種類の境界がある。**レイヤー(import の向き。コンテナと表示部品の分け方を含む)**、**server と client**、**データとコード**。
1つ目は機械が守らせる(import の向きとフックを呼んでよい所は ESLint、外の世界に触れてよい所は `scripts/check-layers.mjs`、テストと `hooks` フォルダの置き場は `npm run test:boundary`)。残り2つも一部は機械化済みで、`content/` から `src/` への import は ESLint が落とし(`eslint.config.mjs`)、
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

`src/components/` と `src/hooks/` の中は、フックを呼んでよいファイルを**コンテナ**と `hooks` フォルダのフックに限り([ADR 0019](../decisions/0019-hooks-make-containers.md))、
外の世界に触れてよいファイルを **I/O コンテナ**に限る([ADR 0017](../decisions/0017-screen-containers.md))。2つは別の軸で、状態を持つ(フックを呼ぶ)ことは外の世界に触れてよい理由にならない。
ファイルの分け方(ローダー・コンテナ・表示部品)は [frontend.md](frontend.md) の「ローダー・コンテナ・表示部品」。

- **I/O コンテナ** — 画面の3つ(`src/components/VillagePage/`・`src/components/Directory/`・`src/components/Story/`)と、
  横断部品の3つ(`src/components/ui/SettingsMenu/`・`src/components/ui/PageviewCounter/`・`src/components/ui/ScenePlayer/`)の `container.tsx` と、そのフォルダの直下の `hooks` フォルダ。
  この6つの一覧の正本は `scripts/container-dirs.mjs`。外の世界に触れてよいのはここだけ
- **状態コンテナ** — それ以外のすべての `container.tsx`(フックを1つでも呼ぶコンポーネント)と、その隣の `hooks` フォルダ。フックを呼んでよいが、import の制限は表示部品と同じ(下の一覧を import しない)
- **ローダー** — 画面の3つのフォルダの `index.tsx`(横断部品のフォルダの `index.tsx` はローダーではない)。サーバでだけ働き、content の読み出し(`@/lib/content/read`)と `notFound()` はここで行う
- **表示部品** — フックを1つも呼ばない、それ以外のすべての `.tsx`。`src/hooks/` も import の制限は同じ。次を import しない
  - 外の世界に触れるモジュール: `@/lib/preferences`・`@/lib/weather`・`@/lib/analytics`・`@/lib/fetch-svg-source`・`@/lib/content/` の下・`@/lib/metadata`
  - 村の時計のストア(`src/components/VillagePage/hooks/use-village-time.ts`)
  - `next/navigation`
  - 画面のフック(画面のフォルダの直下の `hooks` フォルダの下)
  - 画面のコンテナ(画面の3つの `container.tsx`。描くのはそのフォルダのローダーと、統合テスト・フィクスチャだけ)

  import の要らない外の世界の入口(`fetch`・`localStorage`・`sessionStorage`・`indexedDB`・`navigator.sendBeacon`・`document.cookie`・`XMLHttpRequest`・`WebSocket`・`EventSource`)も使わない。

`@/lib/village/`・`@/lib/pixel/` は I/O の無い純粋なロジックなので、表示部品から使ってよい。
ただし `node:` のモジュールを使う `src/lib/pixel/sheet-file.ts`・`src/lib/pixel/png.ts` はローダーだけが使う(ブラウザでは読み込めない。この2つは下の検査の入口に入っておらず、機械では見ていない)。
型だけの import(`import type`・`import { type X }`・`export type`)は上の禁止に掛からない(実行時に読み込まれないため)。表示部品は `@/lib/weather` の `Precipitation`・`@/lib/preferences` の `Theme` などの型を props に使ってよい。

機械が守らせる所は次の3つ。どれも例外を許す一覧を持たない。

**フックを呼んでよい所** — ESLint のローカルのプラグイン `layer` の規則 `layer/hook-only-in-container`(`scripts/eslint-rules/hook-only-in-container.mjs`。`npm run lint`)と、
その規則を使う `scripts/check-hook-rule.mjs`(`npm run test:boundary`)。

- `src/**/*.{ts,tsx}` のフックの呼び出しを全部落とす。フックの呼び出しは、呼ぶ相手の名前が `/^use[A-Z0-9]/` に合うもの(識別子の `useX(...)` も、メンバーの `React.useX(...)` も)。
  React の組み込みのフック(`useState`・`useMemo`・`useId` など)も数え、例外は無い。`memo()`・`forwardRef()` はフックではない
- 外すのは `**/container.tsx`、`hooks` フォルダの中の `use-*.ts(x)`(`src/hooks/` を含む)、テストの部品(`*.test.ts(x)`・`*.fixture.ts`・`*.test-helper.ts`)
- `scripts/check-hook-rule.mjs` は、規則の判定と `eslint.config.mjs` の掛け方を偽の断片で自己検査し、src と `__tests__` のファイルが lint の対象の外になっていないことを確かめてから、
  src の `*.ts`・`*.tsx` を全部 lint して違反を数える。`eslint-disable` の注釈で黙らせた呼び出しも違反に数える
- 同じ `scripts/check-hook-rule.mjs` は、src のファイルごとに規則が掛かるかを名前の決まり(外れるのは上の `container.tsx`・`hooks` フォルダの中の `use-*.ts(x)`・テストの部品だけ)と突き合わせ、
  1つでも違えば落とす。規則の組みの `ignores` に実在のパスを足す・後ろの組みで `off` や `warn` にすると、そのファイルは lint も通ってしまうため。
  この抜け道を実際の設定に入れて突き合わせが拾うことも、走るたびに自己検査する
- 落ちたら、その部品を状態コンテナ(`container.tsx`)にし、フックをその隣の `hooks` フォルダへ置く([frontend.md](frontend.md) の「コンポーネントのフォルダ」)

**外の世界に触れてよい所** — `scripts/check-layers.mjs`(`npm run test:boundary`)。src の import を全部読んでつながりをたどり、式の中の大域の名前も見る。
ESLint の `no-restricted-imports` はファイル1つずつの指定子しか見ないので、「入口を import するフックを表示部品が import する」形を見逃すため。

- **許す側**は I/O コンテナの6つの `container.tsx`・その隣の `hooks` フォルダ(下のフォルダも)・ローダー(画面の3つのフォルダの `index.tsx`)・`src/app/`・`src/lib/`・テスト(`__tests__/` の統合テストと、src の単体テストの `*.test.ts`)・`*.fixture.ts`・`*.test-helper.ts`。
  それ以外の src のファイル(状態コンテナとその隣の `hooks` フォルダ、表示部品と、その utils、`src/hooks/`、`src/utils/`)が、上の入口か、入口へ届くファイルを import すると落ちる。間にフック・部品・utils を何段挟んでも同じで、落ちたときは入口へ届く道(import のつながり)を出す。
  パッケージの入口は前方一致で見る(`next/navigation` の後ろに拡張子を付けて書いても同じ)
- **許す側の外のファイルは、import の要らない外の世界の入口を使わない。** 構文木で式の中の名前を見て、`window.`・`globalThis.`・`self.` を付けたもの・`['…']` で引くもの・分割代入で取り出すものも数える。
  注釈・文字列・型の位置は数えない。名前だけで見るので、同じ名前の変数や引数を作ってそれを使っても落ちる(名前を変える)
- **I/O コンテナは届く道を外へ伝えない。** 横断部品の I/O コンテナ(`src/components/ui/ScenePlayer/container.tsx` など)は、外から `container.tsx` を直接指して描く決まりなので([ADR 0017](../decisions/0017-screen-containers.md) の Consequences)
- **許す側の外のファイルは、I/O コンテナの隣の `hooks` フォルダ**(一覧のフォルダの直下の `hooks` の下。画面の3つと横断部品の3つのどれも)**を import しない。** 今は入口へ届かないフックでも、そこは画面の状態・データのフックの置き場なので落ちる。
  状態コンテナのフックは、そのコンテナの隣の `hooks` フォルダに置く
- **画面のコンテナを import してよいのは、同じフォルダのローダーと、テスト(`__tests__/` の統合テストとフィクスチャ)だけ。** 許す側(`src/app/` など)でも同じで、ルートはローダーを指す。
  型だけの import は数えない
- **一覧のフォルダに `container.tsx` が無いと落ちる。** 改名・移動で一覧が空振りして、そのフォルダの `hooks` の許しだけが黙って残らないように。
  一覧の外の `container.tsx` は状態コンテナで、外の世界の import を許さない。I/O コンテナを足すなら、一覧と ADR を直す
- 入口の一覧と許す側の正本は `scripts/check-layers.mjs`、I/O コンテナの一覧の正本は `scripts/container-dirs.mjs`。
  落ちたら、その import を I/O コンテナ(またはその隣の `hooks` フォルダ)へ移し、値を props で下へ渡す

**テストと `hooks` フォルダの置き場** — `npm run test:boundary`(`scripts/check-test-boundary.mjs`・`scripts/check-layers.mjs`)。テストの置き場の決まりは [../quality/test-strategy.md](../quality/test-strategy.md)。次のときに落ちる。

- `container.tsx` に対応する `__tests__` のフォルダ(I/O コンテナは `__tests__/<unit>/`、状態コンテナは `__tests__/<unit>/<kebab(Name)>/`)に `*.integration.test.tsx` が無い。
  I/O コンテナの6つの外にある状態コンテナは自分で unit になり、入っている一番上のコンポーネントのフォルダが unit を決める(`src/components/<Name>/` の下なら `__tests__/<kebab(Name)>/`、
  `src/components/ui/<Name>/` の下なら `__tests__/ui/<kebab(Name)>/`。I/O の許しは受けない)
- 対応するフォルダの中の統合テストが、そのフォルダのコンテナを(型だけでなく)import していない
- `*.integration.test.ts`・`*.integration.test.tsx`・`*.browser.test.*` が、ほかの所(`src/` の中のどこでも)にある
- `__tests__` の下に、`*.integration.test.tsx`・`*.test-helper.ts`・`container.fixture.ts`・`*.md` のほかの名前のファイルがある(単体テストの `*.test.ts` も置かない)
- どのコンテナにも対応しない `__tests__` のフォルダがある
- 1つの unit の中で、状態コンテナの kebab-case の名前が重なる
- 隣に `container.tsx` が無い `hooks` フォルダがある(`src/hooks/` を除く)
- 状態コンテナのフォルダに `index.tsx` がある(フォルダの名前で import できてしまう `index.ts`・`index.d.ts`・`index.js`・`index.jsx` も)。import する側は `.../<Name>/container` を直接指す。
  I/O コンテナの6つのフォルダは今の形のまま許す(画面の3つの `index.tsx` はローダー、`src/components/ui/ScenePlayer/index.tsx` はコンテナが描く表示部品)
- 状態コンテナが外の世界の入口を import する(上の「外の世界に触れてよい所」)
- `container.fixture.ts` が unit のフォルダの直下でない所にある
- 統合テストの外のテストの側(`src` と `__tests__` の `*.test.ts`・`*.test-helper.ts`・`*.fixture.ts`)が、コンポーネントを描く道具(`@testing-library/react`・`react-dom` とその下)を import する

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
