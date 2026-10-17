---
status: historical
read_when:
  - 部品にフックを足したくなったとき・フックを呼ぶ部品をどこに置くか迷ったとき
  - コンテナ(`container.tsx`)と表示部品の分け方と、外の世界に触れてよい所を問われたとき
  - 統合テストをどこに置き、どう名付け、どう分けるかを問われたとき
source_of_truth: false
last_reviewed: 2026-10-17
---

# 0019. フックを1つでも呼ぶコンポーネントをコンテナ(`container.tsx`)にし、統合テストをリポジトリ直下の `__tests__` に動作ごとに分けて置く

## Status

Accepted(2026-10-17、利用者の決定)。2つの段階で入れ、2つとも済んだ([2つの段階](#2つの段階))。次の部分を置き換える。

- [0017](0017-screen-containers.md)の D1 のうち、コンテナを役割で決め、画面の3つと横断部品の3つの6つのフォルダだけに置く部分(「フックを持つからコンテナなのではなく、役割で決める」)。
  フックを1つでも呼ぶコンポーネントがコンテナになり、どのフォルダにも置ける。0017 の6つは、外の世界に触れてよい「I/O コンテナ」として残る
- 0017 の D3 のうち、表示部品がその部品の DOM の中で閉じる UI のフック(フォーカス・スクロール・観察器・`useId`・`useMemo`・`useState` など)を使ってよいとした部分。表示部品はフックを1つも呼ばない
- 0017 の D5(コンポーネントを描くテストはコンテナの隣の `container.browser.test.tsx` だけで、コンテナごとにちょうど1本)。
  統合テストはリポジトリ直下の `__tests__` の下に、動作ごとの `<動作>.integration.test.tsx` として置き、コンテナごとに1本以上にする
- 当時の [../architecture/frontend.md](../architecture/frontend.md) の「表示部品が自分の UI のフックを持つなら `components/<Name>View/` へ下ろし、その隣の `hooks` フォルダに置く」。フックを呼ぶ部品は、それ自身がコンテナになる
- [0016](0016-testing-trophy-browser-integration.md)と[0018](0018-move-e2e-and-gate-all-hooks.md)が統合テストの名前と置き場として書いた、コンテナの隣の `container.browser.test.tsx`

0017 の D2(画面のローダー)・D3 の外の世界の入口の一覧・D4(外の世界の import を書いてよい所)・D6(統合テストの約束)・D7、
`hooks`フォルダに単体テストを置かない・どのテストでも`renderHook`を使わない([0011](0011-extreme-constraints.md))、
フックのファイル別100%と、統合テストで届かない行だけを E2E を名指しする注釈で外す決まり(0018)は変えない

## Context

2026-10-17、利用者がコンテナの決め方を「役割」から「フックを呼ぶかどうか」へ替えると決めた。

決める前(`90cf908`)のこのリポジトリは次の状態だった。

- **コンテナは6つのフォルダだけだった**(0017 の D1。一覧の正本は `scripts/container-dirs.mjs`)。一覧の外に `container.tsx` を置くと `npm run test:boundary` が落とした
- **フックを呼ぶ表示部品が多かった。** 0017 の D3 が、部品の DOM の中で閉じる UI のフックを表示部品に許していたため。
  一覧の作品カード(WorkCard)、作品ストーリーの StoryBody・SceneModal・SceneSection・TechChipPopover・IntroPreview、場面の再生の SceneSvg、設定メニューの SettingsMenuView(この決定で SettingsMenuPanel へ名前を変えた)と、
  村の起動の覆い(Boot)・`Village` の下の7つの部品(ClockModal・Ground・Joystick・Lighting・StopModal・TalkBubble・WorldMap)
- **コンポーネントにはファイル別のカバレッジの門が無かった。** 統合テストのカバレッジ(`vitest.integration.config.ts`)でファイル別100%を掛けていたのはフック(`hooks`フォルダの下)だけで、
  コンポーネント(`.tsx`)は全体の床にしか入っていなかった(0018 は「コンポーネント(`.tsx`)のファイル別100%は、このADRでは決めない」とした)
- 2026-10-17、作品ストーリーの StoryBody(当時は `src/components/Story/components/StoryBody/` の `index.tsx` で、表示部品だった)の分岐のカバレッジが75%だと分かった。
  統合テストが、場面が0個のときの分岐を通っていなかった。コンポーネントにはファイル別の門が無いので、この75%で落ちる門は無かった
- **統合テストはコンテナごとに1本の6本だった**(コンテナの隣の `container.browser.test.tsx`。0017 の D5)。村の1本は4066行あった
- 同じ向きの形は、利用者の指示(2026-10-15)にもあった

### 0017 が退けた案との違い

0017 は「フックを使う部品をコンテナにする」と「表示部品はフックを0個にする」を退けた。この決定はその2つに近いが、次の点で違う。以下は補足で、利用者が述べた理由ではない。

- 0017 は、フックの要らない画面(一覧・作品ストーリー)にコンテナを置くために形だけのフックを置くことになる、とした。
  この決定では0017 の6つを I/O コンテナとして残すので、フックの無い一覧と作品ストーリーの `container.tsx` もそのまま残り、形だけのフックは要らない
- 0017 は、一覧で並ぶ部品(作品カード3枚・場面の節4つ・技術チップ16個・場面 SVG 最大8枚)のフックを、項目ごとの Map として上へ書き直すことになる、とした。
  この決定ではコンテナをどの深さにも置けるので、並ぶ部品はそれぞれが状態コンテナになり、フックを上へ集めない
- 0017 は、モーダルの「マウントしている = 開いている」という前提と、村の「フックを呼ぶ順 = effect の順」を崩す、とした。
  モーダル(SceneModal)はそれ自身が状態コンテナになるので、マウントの前提は変わらない。村は2つめの段階で移した。ファイルの名前を変えただけでフックを呼ぶ順は動かさないので、[../../src/components/VillagePage/AGENTS.md](../../src/components/VillagePage/AGENTS.md) の守ること2 はそのまま

## Decision

### 定義

- **表示部品** — フックを1つも呼ばないコンポーネントの `.tsx`。同じ props なら同じ画面を描く。入口のファイルは `index.tsx`。
  - 「フックを呼ぶ」は、呼ぶ相手の名前が `/^use[A-Z0-9]/` に合う呼び出しを言う。識別子の `useX(...)` も、メンバーの `React.useX(...)` も数える
  - React の組み込みのフック(`useState`・`useEffect`・`useRef`・`useMemo`・`useId`・`useCallback`・`useLayoutEffect` など)も数える。例外は置かない(`useMemo`・`useId` も例外ではない)
  - `memo()`・`forwardRef()` はフックではない
- **コンテナ** — フックを1つでも呼ぶコンポーネント。ファイル名は `container.tsx`。2種類ある
  - **I/O コンテナ** — `scripts/container-dirs.mjs` に既にある6つのフォルダ(画面の `VillagePage`・`Directory`・`Story`、横断部品の `ui/SettingsMenu`・`ui/PageviewCounter`・`ui/ScenePlayer`)の `container.tsx`。
    外の世界の入口(`@/lib/preferences`・`@/lib/weather`・`@/lib/analytics`・`@/lib/fetch-svg-source`・`@/lib/content/` の下・`@/lib/metadata`・村の時計のストア `use-village-time`・`next/navigation`・画面のフック)を import してよいのは、
    この6つと、その隣の `hooks` フォルダだけ(0017 の D3・D4 のまま)
  - **状態コンテナ** — それ以外のすべての `container.tsx`。import の制限は表示部品と同じで、外の世界の入口を import しない。
    「状態を持つ」ことと「外の世界に触れる」ことは別の軸として扱う
- **画面のローダー** — 画面の3つのフォルダの `index.tsx`。サーバでだけ働く。0017 の D2 のまま

### ファイルの形

- 状態コンテナのフォルダには `container.tsx` があり、**`index.tsx` は無い。** import する側は `.../<Name>/container` を指す(例: `import StoryBody from './components/StoryBody/container'`)。default export の名前はコンポーネントの名前のまま
- 表示部品のフォルダは今までどおり `index.tsx` を入口にする
- `hooks` フォルダを置けるのは、`container.tsx` があるフォルダだけ。例外はルートの共用のフック `src/hooks/` だけ
- `hooks` フォルダには `use-` 始まりのフックのファイルだけを置く(今までどおり)

### テストの置き場

統合テストは `src/` の外、リポジトリ直下の `__tests__` フォルダへ移し、動作ごとに複数のファイルに分ける。
E2E の `tests/` はそのまま。単体テスト(utils・lib の隣の `*.test.ts`)は移さない。

- **単位のフォルダ(unit)** — I/O コンテナの6つは、それぞれ `__tests__/<unit>/` を持つ。
  `<unit>` は `src/components/` の下のフォルダのパスを kebab-case にしたもので、`story`・`directory`・`village-page`・`ui/settings-menu`・`ui/pageview-counter`・`ui/scene-player` の6つ。
  I/O コンテナ自身のテストは、そのフォルダの直下に置く
- **状態コンテナのフォルダ** — `__tests__/<unit>/<kebab(Name)>/`。`<unit>` はその状態コンテナを囲む一番近い I/O コンテナ、`Name` は状態コンテナのフォルダの名前。
  例えば StoryBody(`src/components/Story/components/StoryBody/`)は `__tests__/story/story-body/`、場面の再生の SceneSvg は `__tests__/ui/scene-player/scene-svg/`、
  設定メニューの SettingsMenuPanel は `__tests__/ui/settings-menu/settings-menu-panel/`。1つの unit の中で名前は重ならない
- **I/O コンテナの6つの外にある状態コンテナ** — 囲む I/O コンテナが無いので、自分で unit になる(利用者の決定)。unit は、その状態コンテナが入っている一番上のコンポーネントのフォルダで、
  `src/components/<Name>/` の下なら `__tests__/<kebab(Name)>/`、`src/components/ui/<Name>/` の下なら `__tests__/ui/<kebab(Name)>/`。
  その一番上のフォルダ自身の `container.tsx` のテストは unit のフォルダの直下に、それより深い状態コンテナは `__tests__/<unit>/<kebab(Name)>/` に置く。
  unit になっても I/O の許しは受けない(外の世界の入口を import しない)。2026-10-17 の時点で当てはまる `container.tsx` は無い
- **ファイルの名前** — kebab-case の `<動作>.integration.test.tsx`(例: `open-modal.integration.test.tsx`・`focus-return.integration.test.tsx`・`auto-advance.integration.test.tsx`)。
  1ファイル = 動作のまとまり1つ(たいてい、今の一番外の `describe` 1つが覆う範囲)。コンテナ1つに1本以上ある。
  フォルダの中の統合テストは全部、そのフォルダに対応するコンテナを `@/components/.../container` で import する(型だけの import は数えない)
- **`__tests__` に置ける名前** — `*.integration.test.tsx`・`*.test-helper.ts`・`container.fixture.ts`・`*.md` だけ。単体テストの `*.test.ts` も置かない(どちらの設定にも拾われない)
- **親と子の役割** — 親のテストは流れとつながりを見る(子が現れる・子のコールバックが親の側の結果(保存・移動・子どうしの間の焦点の戻り)に届く)。子のテストは子自身の動作を見る。
  断定を移すときに捨てない。移した断定は全部、新しいファイルにある。
  子のコンポーネントは本物を描き、モックはネットワークと時間だけ(0017 の D6)。role・名前・文字で探す。`renderHook` を使わず、`hooks` フォルダにテストを置かず、フックの戻り値を読まない
- **props の作り方** — 子のテストは、親の unit の `container.fixture.ts` が `provide` した値を `inject(...)` で受ける(キーは全体で共通)か、手で作る。
  実際のコンテンツでは作れない分岐は、props を変えた版を直接渡してよい(0017 の D6)
- **フィクスチャとテストの部品** — `container.fixture.ts`(node でしか組めない props を組む globalSetup)は、unit のフォルダの直下(`__tests__/<unit>/container.fixture.ts`)へ移す。
  統合テストだけが使う `*.test-helper.ts` は、それを使う unit のフォルダへ移す。`src/` の単体テストや E2E も使う部品は元の場所に置く。
  統合テストの外のテストの側(`src` と `__tests__` の両方の `*.test.ts`・`*.test-helper.ts`・`*.fixture.ts`)は、コンポーネントを描く道具(`@testing-library/react`・`react-dom` とその下)を import しない。
  `src` の単体テストがそれを読んで happy-dom でコンポーネントを描く道を塞ぐための、もとからの決まりで、`__tests__` の部品にも掛ける
- 古い名前 `container.browser.test.tsx` と、古い決まり「コンテナごとに隣にちょうど1本」は無くなる

### カバレッジ

- 統合の設定(`vitest.integration.config.ts`。`npm run test:integration -- --coverage`)で、**全部の `hooks` フォルダの中のファイルと、全部の `container.tsx`** をファイル別100%(文・分岐・関数・行)にする
- 表示部品は、今までどおり全体の床にだけ入る
- 統合の層が構造上届かない行だけ、今の注釈 `/* v8 ignore next -- e2e: tests/<file>.spec.ts > <E2E のテスト名> */` で外してよい(`scripts/check-coverage-ignores.mjs` が確かめる。0018 のまま)

### 機械が守らせる所

- **ESLint のローカルのプラグイン `layer` の規則 `layer/hook-only-in-container`**(`scripts/eslint-rules/hook-only-in-container.mjs`)が、`src/**/*.{ts,tsx}` のフックの呼び出しを全部落とす。
  外すのは `**/container.tsx`、`hooks` フォルダの中の `use-*.ts(x)`(`src/hooks/` を含む)、テストの部品(`*.test.ts(x)`・`*.fixture.ts`・`*.test-helper.ts`)
- **`scripts/check-hook-rule.mjs`(`npm run test:boundary`)が、その規則を確かめてから src を検査する。**
  規則の判定と `eslint.config.mjs` の掛け方を偽の断片で自己検査し、src と `__tests__` のファイルが lint の対象の外になっていないことも見る。
  src の `*.ts`・`*.tsx` のファイルごとに、規則が掛かるかを名前の決まり(外れるのは上の `container.tsx`・`hooks` フォルダの中の `use-*.ts(x)`・テストの部品だけ)と突き合わせ、1つでも違えば落とす。
  規則の組みの `ignores` に実在のパスを足すと、そのファイルは lint も偽の断片の自己検査も通り、規則が掛かるファイルの数が1つ減るだけになるため。
  この抜け道(と、フォルダを足す・後ろの組みで `off` や `warn` にする・`ignores` から外す)を実際の設定に入れて、突き合わせが拾うことも自己検査する。
  そのうえで src の `*.ts`・`*.tsx` を全部 lint して違反を数える(`eslint-disable` の注釈で黙らせた呼び出しも数える)
- **`scripts/container-dirs.mjs` は I/O コンテナの6つの一覧(唯一の正本)を持ち続ける。** 例外を許す一覧は持たない。
  1つめの段階から2つめの段階までの間だけ、村を移し終えるまでの減るだけの待ちの一覧を2つ持っていた(まだフックを呼ぶ表示部品の `PENDING_CONTAINER_FILES` と、隣に `container.tsx` が無い `hooks` フォルダの `PENDING_HOOK_DIRS`)。
  2つめの段階で村を移し終えたので、2つとも、それを使う検査と自己検査の事例ごと消した
- **`npm run test:boundary`(`scripts/check-test-boundary.mjs`・`scripts/check-layers.mjs`・`scripts/check-coverage-ignores.mjs`・`scripts/check-hook-rule.mjs` の4つ)は次のときも落ちる。**
  - `container.tsx` に対応する `__tests__` のフォルダに `*.integration.test.tsx` が無い
  - 対応するフォルダの中の統合テストが、そのフォルダのコンテナを import していない
  - `*.integration.test.ts`・`*.integration.test.tsx`・`*.browser.test.*` が、ほかの所(`src/` の中のどこでも)にある
  - `__tests__` の下に、`*.integration.test.tsx`・`*.test-helper.ts`・`container.fixture.ts`・`*.md` のほかの名前のファイルがある(`*.test.ts` も)
  - どのコンテナにも対応しない `__tests__` のフォルダがある
  - 1つの unit の中で、状態コンテナの kebab-case の名前が重なる
  - 隣に `container.tsx` が無い `hooks` フォルダがある(`src/hooks/` を除く)
  - 状態コンテナのフォルダに `index.tsx` がある(フォルダの名前で import できてしまう `index.ts`・`index.d.ts`・`index.js`・`index.jsx` も。`scripts/check-test-boundary.mjs`)。
    I/O コンテナの6つのフォルダは今の形のまま許す(画面の3つの `index.tsx` はローダー、`src/components/ui/ScenePlayer/index.tsx` はコンテナが描く表示部品)
  - 状態コンテナが外の世界の入口を import する
  - `container.fixture.ts` が unit のフォルダの直下でない所にある
  - 統合テストの外のテストの側(`src` と `__tests__` の `*.test.ts`・`*.test-helper.ts`・`*.fixture.ts`)が、コンポーネントを描く道具(`@testing-library/react`・`react-dom` とその下)を import する
- **テストを見る道具は全部 `__tests__` を見る。** `tsconfig.json` の include、ESLint、Prettier(`npm run format:check`)、`scripts/check-docs.mjs`(検査するフォルダ)、
  `scripts/check-layers.mjs`(テストは import を許す側)、`vitest.integration.config.ts`(`include` は `__tests__/**/*.integration.test.tsx`、globalSetup は `__tests__/**/container.fixture.ts`)。
  単体の `vitest.config.ts` はこれらのファイルを拾わない
- 0017 の「名前が `container.tsx` でも一覧の外のものはコンテナに数えない」は、上の定義に替わる。一覧の外の `container.tsx` は状態コンテナで、表示部品と同じ import の制限を受ける

### 2つの段階

利用者の決定で、2つの段階に分けて入れる。不変ルール6「1段階 = 1セッション」([../../AGENTS.md](../../AGENTS.md))のとおり、段階ごとに1つのセッションで行う。

**1つめの段階(この記録と同じ作業)。** 次の8つの部品のフォルダの `index.tsx` を `container.tsx` へ変え、状態コンテナにする。
設定メニューの SettingsMenuView は、利用者の決定で名前を SettingsMenuPanel に変える(フォルダの名前も変える)。

| 部品                                             | フォルダ                                                       | 統合テストのフォルダ                              |
| ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------- |
| StoryBody                                        | `src/components/Story/components/StoryBody/`                   | `__tests__/story/story-body/`                     |
| SceneModal                                       | `src/components/Story/components/SceneModal/`                  | `__tests__/story/scene-modal/`                    |
| SceneSection                                     | `src/components/Story/components/SceneSection/`                | `__tests__/story/scene-section/`                  |
| TechChipPopover                                  | `src/components/Story/components/TechChipPopover/`             | `__tests__/story/tech-chip-popover/`              |
| IntroPreview                                     | `src/components/Story/components/IntroPreview/`                | `__tests__/story/intro-preview/`                  |
| WorkCard                                         | `src/components/Directory/components/WorkCard/`                | `__tests__/directory/work-card/`                  |
| SceneSvg                                         | `src/components/ui/ScenePlayer/components/SceneSvg/`           | `__tests__/ui/scene-player/scene-svg/`            |
| SettingsMenuPanel(もとの名前は SettingsMenuView) | `src/components/ui/SettingsMenu/components/SettingsMenuPanel/` | `__tests__/ui/settings-menu/settings-menu-panel/` |

村でない5本の `container.browser.test.tsx` は、動作ごとに分けて `__tests__/<unit>/` の下へ移す。
村の1本(4066行)は中身を変えず(import だけ直して)、`__tests__/village-page/` の `village.integration.test.tsx` 1本へ移す(この1本は2つめの段階で分けて消した)。

**2つめの段階(1つめの次のセッション)。** 村の8つの部品のフォルダの `index.tsx` を `container.tsx` へ変え(import を直して)、状態コンテナにした。
どれも I/O コンテナの `src/components/VillagePage/` の下なので unit は `village-page` で、統合テストのフォルダは `__tests__/village-page/` の下の、自分のフォルダの名前の kebab-case(入れ子でも自分の名前だけ)。

| 部品       | フォルダ                                                               | 統合テストのフォルダの名前 |
| ---------- | ---------------------------------------------------------------------- | -------------------------- |
| Boot       | `src/components/VillagePage/components/Boot/`                          | `boot`                     |
| ClockModal | `src/components/VillagePage/components/Village/components/ClockModal/` | `clock-modal`              |
| Ground     | `src/components/VillagePage/components/Village/components/Ground/`     | `ground`                   |
| Joystick   | `src/components/VillagePage/components/Village/components/Joystick/`   | `joystick`                 |
| Lighting   | `src/components/VillagePage/components/Village/components/Lighting/`   | `lighting`                 |
| StopModal  | `src/components/VillagePage/components/Village/components/StopModal/`  | `stop-modal`               |
| TalkBubble | `src/components/VillagePage/components/Village/components/TalkBubble/` | `talk-bubble`              |
| WorldMap   | `src/components/VillagePage/components/Village/components/WorldMap/`   | `world-map`                |

`Village`(`src/components/VillagePage/components/Village/`)は表示部品のままなので、その直下の `hooks` フォルダは置けない。
そこにあった2つのフックは、どちらも3か所(ClockModal・StopModal・WorldMap の `hooks`)が使うので、`src/hooks/` へ中身を変えずに(import だけ直して)引き上げた
(`src/hooks/use-dialog-focus.ts`・`src/hooks/use-held-direction.ts`)。
`src/hooks/` は `components` を import しない層なので([../architecture/boundaries.md](../architecture/boundaries.md))、窓の焦点の輪が読む純粋関数とその単体テストも、
`Village` の `utils` から `src/utils/` へ中身を変えずに移した(`src/utils/focusables.ts`・`src/utils/wrap-focus-index.ts`)。
待ちの一覧の2つは、それを使う検査と自己検査の事例ごと消した。

村の統合テストの1本(1つめの段階で移した `village.integration.test.tsx`)は、動作ごとのファイルに分けて消した。`test(…)` の名前は変えずに移した。
村の画面全体(`VillagePageContainer`)を描くテストは `__tests__/village-page/` の直下に置く。
8つの状態コンテナのテストは上の表のフォルダに置き、そのコンテナを props で直接描く(1つのファイルに、画面全体を描くテストと混ぜない)。
直接描いて届くようになった分岐はテストで覆った。どのテストも通れない防御の分岐(TalkBubble の、いつも付く吹き出しの ref と、いつも囲む村の枠の null の確かめ、
WorldMap の、押した位置のマスが決まらない場合)は、コミット `f10f530` の前例のとおり、動きを変えずにその場合のコードが無い形に直し、理由を1行の注に書いた。
起動の覆いの Boot には、開発の StrictMode でクライアントへ描くと覆いが外れない不具合があった(片付けで手順を止めても印の `data-run` が残り、走らせ直した effect が印を見て何もしない)。
片付けで印を下ろすように直し、`__tests__/village-page/boot/logo-flight.integration.test.tsx` に StrictMode で描く再現のテストを置いた

### 0011 が新しいADRを求める変更

統合テストの置き場と名前(テストの境界)を変えることと、`container.browser.test.tsx` と、村の1本を移した `village.integration.test.tsx` を分けて消すこと(断定は全部、新しいファイルへ移す)は、このADRが決めたこととする
(0011 は「テストを消す」「テストの境界を変える」に新しいADRを求める)。`hooks`フォルダに単体テストを置かない・どのテストでも`renderHook`を使わないは変えない

## Consequences

- **部品にフックを1つ足すと、その部品はコンテナになる。** ファイルは `container.tsx` になって `index.tsx` が無くなり、`__tests__` の下に統合テストのフォルダが1つ要り、ファイル別100%の門に入る。
  どれかが欠けると、ESLint の規則か `npm run test:boundary` か統合のカバレッジの門が落ちる
- **フックを呼ばない表示部品の分岐には、この決定でもファイル別の門が無い。** 表示部品は全体の床にだけ入る([Alternatives Considered](#alternatives-considered))
- **コンテナは、外から `container` を直接指す。** 0017 では横断部品のコンテナだけの例外だったものが、状態コンテナの全部に広がる。表示部品の入口は今までどおり `index.tsx`
- **統合テストが `src/` の外へ出るので、テストを見る道具の設定を全部 `__tests__` へ向ける**([機械が守らせる所](#機械が守らせる所))
- **フックを呼ぶ所と `hooks` フォルダの置き場に、例外を許す一覧は無い。** 1つめの段階から2つめの段階までの間だけ村に残した例外(フックを呼ぶ表示部品が8つと、隣にコンテナの無い `hooks` フォルダが5つ)は、2つめの段階で無くなった

## Alternatives Considered

- **`useMemo`・`useId` などを例外にして、表示部品に許す** — 採らない。許すフックの一覧が増え続ける
- **状態コンテナも入口を `index.tsx` のままにする** — 採らない。ファイルの名前だけでは、どれがコンテナか見えない
- **統合テストの名前を `index.integration.test.tsx` にする** — 採らない。画面のフォルダの `index.tsx` はサーバのローダーなので、テストの名前と描く相手がずれる
- **すべての `.tsx` をファイル別100%にする** — 採らない。表示部品の分岐ごとにテストが要り、費用が大きい
- **外の世界の import を許す所を、すべてのコンテナへ広げる** — 採らない。厳しい側を保つ決定(I/O は0017 の6つとその隣の `hooks` フォルダだけ)に反する
- **統合テストをコンテナの隣に置く** — 利用者がリポジトリ直下の `__tests__` を選んだ
