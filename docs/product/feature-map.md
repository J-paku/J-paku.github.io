---
status: active
read_when:
  - どのファイルを触ればよいか当たりを付けたいとき
source_of_truth: false
last_reviewed: 2026-10-17
---

# 画面とファイルの対応

**「どこを触るか」の当たりを付けるための地図。** 網羅ではないので、見つからなければ実物を検索する。

## 村 — `/`・`/ko/`

|                    |                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ルート             | `src/app/(ja)/page.tsx` / `src/app/(ko)/ko/page.tsx`                                                                                                                                                                                                                                                                                                                                                                   |
| 画面本体           | `src/components/VillagePage/`(`index.tsx` はサーバのローダー。content の読み出し・シート合成・地点リンクをここで1回だけ作る。`container.tsx` はクライアントのコンテナで、画面を組み立てる)                                                                                                                                                                                                                             |
| 画面の状態とデータ | `src/components/VillagePage/hooks/`(コンテナだけが呼ぶ。寸法・入力・復元・歩行ループ・重ね表示・天気・昼夜・卓上時計のストア)                                                                                                                                                                                                                                                                                          |
| 操作・描画         | `src/components/VillagePage/components/Village/`(表示部品。値はコンテナから props で受ける)                                                                                                                                                                                                                                                                                                                            |
| 規則               | `src/lib/village/`                                                                                                                                                                                                                                                                                                                                                                                                     |
| 絵                 | `src/lib/pixel/`                                                                                                                                                                                                                                                                                                                                                                                                       |
| コンテンツ         | `content/world.ts`(地形)・`content/{ja,ko}/village.ts`(文言)                                                                                                                                                                                                                                                                                                                                                           |
| 統合               | `__tests__/village-page/village.integration.test.tsx`(舞台の寸法・歩行ループの眠りと目覚め・池での釣り・雨の日の傘・自動移動の直線飛行・村の窓の Tab の輪と吹き出しの押し戻し・卓上時計・昼夜と天気。props は `__tests__/village-page/container.fixture.ts` が node で組む。組み立て関数 `src/components/VillagePage/utils/village-props.ts` はローダーと共有)                                                         |
| E2E                | `tests/journey.spec.ts`(導線)・`tests/layout.spec.ts`(ko の一覧への出口)・`tests/day-night.spec.ts`(段階ごとの焼いたシートと ko の完走)・`tests/night-transition.spec.ts`(再読み込みせずに夜へ移る時の絵)・`tests/clock.spec.ts`(卓上時計で決めた時刻と再読み込み)・`tests/fishing.spec.ts`(釣りのコマの画素)・`tests/storage-blocked.spec.ts`(保存が使えない時のテーマと村の操作)。統合テストで作れないものだけが残る |

詳細は [../architecture/village.md](../architecture/village.md)。

## 一覧 — `/list/`・`/ko/list/`

|                          |                                                                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ルート                   | `src/app/(ja)/list/page.tsx` / `src/app/(ko)/ko/list/page.tsx`                                                                                                                                                    |
| 画面本体                 | `src/components/Directory/`(`index.tsx` はサーバのローダー、`container.tsx` が組み立てる。どちらもサーバ)                                                                                                         |
| 左列(プロフィール・経歴) | `src/components/Directory/components/ProfileColumn/`                                                                                                                                                              |
| 作品カード               | `src/components/Directory/components/WorkCard/`(クライアントの状態コンテナ `container.tsx`。折りたたみ詳細・リンクオーバーレイ・場面リール)                                                                       |
| 右列(担当業務の詳細)     | `src/components/Directory/components/CareerDetail/`(作品カードの下に、詳細を持つ経歴を全件展開する)                                                                                                               |
| コンテンツ               | `content/{ja,ko}/profile.ts`・`works/*.ts`・`ui.ts`・`village.ts`(村へ移るリンクの文言 `toVillage` だけ)。`skills.ts`・`now.ts` は `src/lib/content/read.ts` が読み込むが、現在どの画面も表示しない               |
| 統合                     | `__tests__/directory/`(作品カードは子フォルダ `work-card`。props は `__tests__/directory/container.fixture.ts` が node で組む。組み立て関数 `src/components/Directory/utils/directory-props.ts` はローダーと共有) |
| E2E                      | `tests/directory.spec.ts`(作品カードの内部リンクと、詳細ページを持たない作品の slug 直接アクセス)・`tests/observer-missing.spec.ts`(`IntersectionObserver` が無い時のカードの出現と写真の色)                      |

## 作品ストーリー — `/works/<slug>/`・`/ko/works/<slug>/`

|                |                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ルート         | `src/app/(ja)/works/[slug]/page.tsx` / `src/app/(ko)/ko/works/[slug]/page.tsx`(+ 各ルートグループの `src/app/(ja)/works/layout.tsx` と `src/app/(ko)/ko/works/layout.tsx`)                                                                                                                                                                                                                                   |
| 画面本体       | `src/components/Story/`(`index.tsx` はサーバのローダーで、ストーリーが無ければ `notFound()`。`container.tsx` が組み立てる。どちらもサーバ)                                                                                                                                                                                                                                                                   |
| 場面の再生     | `src/components/ui/ScenePlayer/`(`container.tsx` が SVG の原本を隣の `hooks` フォルダのフックで取り、SVG をシャドウルートへ展開する)・`src/lib/fetch-svg-source.ts`                                                                                                                                                                                                                                          |
| 全画面モーダル | `src/components/Story/components/SceneModal/`(状態コンテナ `container.tsx`)                                                                                                                                                                                                                                                                                                                                  |
| コンテンツ     | `content/{ja,ko}/works/<slug>.ts` の `story`・`ui.ts`・`village.ts`(村へ移るリンクの文言 `toVillage` だけ)                                                                                                                                                                                                                                                                                                   |
| 場面 SVG       | `public/works/`                                                                                                                                                                                                                                                                                                                                                                                              |
| 統合           | `__tests__/story/`(CTA と場面の現れ方・前へ/次へと端のフォーカス・自動送りと一時停止・閉じた後のフォーカスの戻り先・取得に失敗した場面の絵の取り直し。子の状態コンテナ5つはその下のフォルダ。props は `__tests__/story/container.fixture.ts` が node で組む。組み立て関数 `src/components/Story/utils/story-props.ts` はローダーと共有)・`__tests__/ui/scene-player/`(場面の再生。子の `scene-svg` はその下) |
| E2E            | `tests/observer-missing.spec.ts`(`IntersectionObserver` が無い時の今の場面)                                                                                                                                                                                                                                                                                                                                  |

## 404 — 存在しない経路

|        |                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------- |
| 配信物 | `public/404.html`(二言語の案内の素の HTML。`next build` が上書きする `out/404.html` を `scripts/verify-export.mjs` が戻す) |
| E2E    | `tests/not-found.spec.ts`(404 応答と二言語の案内、そこから村と一覧へその言語のまま戻る導線)                                |

`src/utils/scene-durations.ts` は各場面 SVG の `animation-duration` を写した表。**SVG 側の周期を変えたらここも直す。**

## 横断部品 — `src/components/ui/`

`DeviceFrame`(iPhone 枠)・`Logo`・`Navigation`・`PageviewCounter`(アプリ内の移動を計測へ送る。何も描かない)・
`PhraseText`(日本語の文節改行)・`PlaybackIcon`・
`PlaybackPulse`(再生切り替えのパルスと停止中の印)・`ScenePlayer`・`SettingsMenu`(言語とテーマ)・
`TechTag`。

**複数の画面にまたがって使うか、2箇所以上から使い始めた時点でここへ引き上げる。** 全画面に掛かる殻(`src/app/html-shell.tsx`)や
他の横断部品から使う部品は、import が1箇所でも複数の画面にまたがるものとして数える(`PageviewCounter` は殻から、`SettingsMenu` は `Navigation` から使う)。
1つの画面の中の1箇所でしか使わない部品は画面側のフォルダに置く。

外の I/O に触れる `PageviewCounter`(計測)・`SettingsMenu`(テーマの保存)・`ScenePlayer`(SVG の原本の取得)は I/O コンテナ(`container.tsx`)を持ち、外からはそれを指す。
統合テストは `__tests__/ui/pageview-counter/`・`__tests__/ui/settings-menu/`・`__tests__/ui/scene-player/` で、子の状態コンテナ(`SettingsMenuPanel`・`SceneSvg`)はその下の
`__tests__/ui/settings-menu/settings-menu-panel/`・`__tests__/ui/scene-player/scene-svg/`。設定メニューの ui の文言は `__tests__/ui/settings-menu/container.fixture.ts` が node で組む。

## コンテナと統合テスト — `__tests__/`

フックを1つでも呼ぶコンポーネントはコンテナ(`container.tsx`)で、統合テストはリポジトリ直下の `__tests__/` に、コンテナごとのフォルダで置く
([../decisions/0019-hooks-make-containers.md](../decisions/0019-hooks-make-containers.md))。
フォルダの名前の付け方・ファイルの分け方・フィクスチャの決まりは [../quality/test-strategy.md](../quality/test-strategy.md) の「統合テストの約束」。I/O コンテナの一覧の正本は `scripts/container-dirs.mjs`。
入れ子の行は、その上の I/O コンテナの下にある状態コンテナ。

- `src/components/VillagePage/container.tsx`(村。I/O コンテナ)→ `__tests__/village-page/`
- `src/components/Directory/container.tsx`(一覧。I/O コンテナ)→ `__tests__/directory/`
  - `src/components/Directory/components/WorkCard/container.tsx` → `__tests__/directory/work-card/`
- `src/components/Story/container.tsx`(作品ストーリー。I/O コンテナ)→ `__tests__/story/`
  - `src/components/Story/components/StoryBody/container.tsx` → `__tests__/story/story-body/`
  - `src/components/Story/components/SceneModal/container.tsx` → `__tests__/story/scene-modal/`
  - `src/components/Story/components/SceneSection/container.tsx` → `__tests__/story/scene-section/`
  - `src/components/Story/components/TechChipPopover/container.tsx` → `__tests__/story/tech-chip-popover/`
  - `src/components/Story/components/IntroPreview/container.tsx` → `__tests__/story/intro-preview/`
- `src/components/ui/SettingsMenu/container.tsx`(設定メニュー。I/O コンテナ)→ `__tests__/ui/settings-menu/`
  - `src/components/ui/SettingsMenu/components/SettingsMenuPanel/container.tsx` → `__tests__/ui/settings-menu/settings-menu-panel/`
- `src/components/ui/PageviewCounter/container.tsx`(ページ移動の計測。I/O コンテナ)→ `__tests__/ui/pageview-counter/`
- `src/components/ui/ScenePlayer/container.tsx`(場面の再生。I/O コンテナ)→ `__tests__/ui/scene-player/`
  - `src/components/ui/ScenePlayer/components/SceneSvg/container.tsx` → `__tests__/ui/scene-player/scene-svg/`

状態コンテナの8つは、ADR 0019 の1段階(2026-10-17)まで同じフォルダの `index.tsx` だった(`SettingsMenuPanel` は名前も `SettingsMenuView` だった)。状態コンテナのフォルダに `index.tsx` は無く、
使う側は `.../<Name>/container` を指す(例: `import StoryBody from './components/StoryBody/container'`)。

node でしか組めない props は、unit のフォルダの直下のフィクスチャが組む。`__tests__/village-page/container.fixture.ts`・`__tests__/directory/container.fixture.ts`・
`__tests__/story/container.fixture.ts`・`__tests__/ui/settings-menu/container.fixture.ts` の4つ。
村の統合テストだけが使う部品(`village-walk.test-helper.ts`・`village-walk-record.test-helper.ts`・`village-walk-flight.test-helper.ts`・`village-time.test-helper.ts`)は `__tests__/village-page/` にある。
単体テストも使う `src/components/VillagePage/components/Village/utils/walk-loop/walk-loop.test-helper.ts` は src に残る。

村は1段階では、統合テストを中身を変えずに1本のまま `__tests__/village-page/village.integration.test.tsx` へ移しただけ。
フックを呼ぶ村の8つの部品(`src/components/VillagePage/components/Boot/index.tsx` と、`Village` の下の `ClockModal`・`Ground`・`Joystick`・`Lighting`・`StopModal`・`TalkBubble`・`WorldMap`)はまだ `index.tsx` のままで、
`container.tsx` へ移してテストを動作ごと・状態コンテナごとに分けるのは2段階。それまでは `scripts/container-dirs.mjs` の待ちの一覧が持つ。
