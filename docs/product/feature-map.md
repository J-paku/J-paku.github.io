---
status: active
read_when:
  - どのファイルを触ればよいか当たりを付けたいとき
source_of_truth: false
last_reviewed: 2026-10-18
---

# 画面とファイルの対応

**「どこを触るか」の当たりを付けるための地図。** 網羅ではないので、見つからなければ実物を検索する。

## 村 — `/`・`/ko/`

|                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ルート             | `src/app/(ja)/page.tsx` / `src/app/(ko)/ko/page.tsx`(どちらもサーバのローダー `src/app/village-screen.tsx` を描く)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 画面本体           | `src/components/VillagePage/`(`index.tsx` はクライアントの I/O コンテナで、画面を組み立てる。content の読み出し・シート合成・地点リンクは、サーバのローダー `src/app/village-screen.tsx` が1回だけ作る)                                                                                                                                                                                                                                                                                                                                         |
| 画面の状態とデータ | `src/components/VillagePage/hooks/`(コンテナだけが呼ぶ。寸法・入力・復元・歩行ループ・重ね表示・天気・昼夜・卓上時計のストア)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 操作・描画         | `src/components/VillagePage/components/Village/`(表示部品。値はコンテナから props で受ける)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 規則               | `src/lib/village/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 絵                 | `src/lib/pixel/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| コンテンツ         | `content/world.ts`(地形)・`content/{ja,ko}/village.ts`(文言)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 統合               | `src/components/VillagePage/__tests__/`(村の画面全体を描くテストは直下に動作ごとのファイルで置く。舞台の寸法・歩行ループの眠りと目覚め・池での釣り・雨の日の傘・自動移動の直線飛行・村の入力と道中の配線・村の窓の Tab の輪と吹き出しの位置・卓上時計・昼夜と天気など。村の8つの状態コンテナを直接描くテストはそれぞれのフォルダにあり、一覧は下の「コンテナと統合テスト」。props は `src/components/VillagePage/__tests__/index.fixture.ts` が node で組む。組み立て関数 `src/components/VillagePage/utils/village-props.ts` はローダーと共有) |
| E2E                | `tests/journey.spec.ts`(導線)・`tests/layout.spec.ts`(ko の一覧への出口)・`tests/day-night.spec.ts`(段階ごとの焼いたシートと ko の完走)・`tests/night-transition.spec.ts`(再読み込みせずに夜へ移る時の絵)・`tests/clock.spec.ts`(卓上時計で決めた時刻と再読み込み)・`tests/fishing.spec.ts`(釣りのコマの画素)・`tests/storage-blocked.spec.ts`(保存が使えない時のテーマと村の操作)。統合テストで作れないものだけが残る                                                                                                                          |

詳細は [../architecture/village.md](../architecture/village.md)。

## 一覧 — `/list/`・`/ko/list/`

|                          |                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ルート                   | `src/app/(ja)/list/page.tsx` / `src/app/(ko)/ko/list/page.tsx`(どちらもサーバのローダー `src/app/directory-screen.tsx` を描く)                                                                                                                                                  |
| 画面本体                 | `src/components/Directory/`(`index.tsx` は画面を組み立てる I/O コンテナで、ローダーと同じくサーバ)                                                                                                                                                                              |
| 左列(プロフィール・経歴) | `src/components/Directory/components/ProfileColumn/`                                                                                                                                                                                                                            |
| 作品カード               | `src/components/Directory/components/WorkCard/`(クライアントの状態コンテナ `index.tsx`。折りたたみ詳細・リンクオーバーレイ・場面リール)                                                                                                                                         |
| 右列(担当業務の詳細)     | `src/components/Directory/components/CareerDetail/`(作品カードの下に、詳細を持つ経歴を全件展開する)                                                                                                                                                                             |
| コンテンツ               | `content/{ja,ko}/profile.ts`・`works/*.ts`・`ui.ts`・`village.ts`(村へ移るリンクの文言 `toVillage` だけ)。`skills.ts`・`now.ts` は `src/lib/content/read.ts` が読み込むが、現在どの画面も表示しない                                                                             |
| 統合                     | `src/components/Directory/__tests__/`(作品カードは `src/components/Directory/components/WorkCard/__tests__/`。props は `src/components/Directory/__tests__/index.fixture.ts` が node で組む。組み立て関数 `src/components/Directory/utils/directory-props.ts` はローダーと共有) |
| E2E                      | `tests/directory.spec.ts`(作品カードの内部リンクと、詳細ページを持たない作品の slug 直接アクセス)・`tests/observer-missing.spec.ts`(`IntersectionObserver` が無い時のカードの出現と写真の色)                                                                                    |

## 作品ストーリー — `/works/<slug>/`・`/ko/works/<slug>/`

|                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ルート         | `src/app/(ja)/works/[slug]/page.tsx` / `src/app/(ko)/ko/works/[slug]/page.tsx`(+ 各ルートグループの `src/app/(ja)/works/layout.tsx` と `src/app/(ko)/ko/works/layout.tsx`。ページはサーバのローダー `src/app/story-screen.tsx` を描く)                                                                                                                                                                                                                                                                                       |
| 画面本体       | `src/components/Story/`(`index.tsx` は画面を組み立てる I/O コンテナで、ローダーと同じくサーバ。ストーリーが無ければローダーが `notFound()`)                                                                                                                                                                                                                                                                                                                                                                                  |
| 場面の再生     | `src/components/ui/ScenePlayer/`(`index.tsx` が SVG の原本を隣の `hooks` フォルダのフックで取り、SVG をシャドウルートへ展開する。場面のクロスフェードは表示部品 `src/components/ui/ScenePlayer/components/SceneStack/`)・`src/lib/fetch-svg-source.ts`                                                                                                                                                                                                                                                                       |
| 全画面モーダル | `src/components/Story/components/SceneModal/`(状態コンテナ `index.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| コンテンツ     | `content/{ja,ko}/works/<slug>.ts` の `story`・`ui.ts`・`village.ts`(村へ移るリンクの文言 `toVillage` だけ)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 場面 SVG       | `public/works/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 統合           | `src/components/Story/__tests__/`(CTA と場面の現れ方・前へ/次へと端のフォーカス・自動送りと一時停止・閉じた後のフォーカスの戻り先・取得に失敗した場面の絵の取り直し。子の状態コンテナ5つはそれぞれのフォルダの `__tests__`。props は `src/components/Story/__tests__/index.fixture.ts` が node で組む。組み立て関数 `src/components/Story/utils/story-props.ts` はローダーと共有)・`src/components/ui/ScenePlayer/__tests__/`(場面の再生。子の `SceneSvg` は `src/components/ui/ScenePlayer/components/SceneSvg/__tests__/`) |
| E2E            | `tests/observer-missing.spec.ts`(`IntersectionObserver` が無い時の今の場面)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

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

外の I/O に触れる `PageviewCounter`(計測)・`SettingsMenu`(テーマの保存)・`ScenePlayer`(SVG の原本の取得)は、フォルダの `index.tsx` が I/O コンテナで、外からはそのフォルダを指す。
統合テストは `src/components/ui/PageviewCounter/__tests__/`・`src/components/ui/SettingsMenu/__tests__/`・`src/components/ui/ScenePlayer/__tests__/` で、子の状態コンテナ(`SettingsMenuPanel`・`SceneSvg`)はそれぞれのフォルダの
`src/components/ui/SettingsMenu/components/SettingsMenuPanel/__tests__/`・`src/components/ui/ScenePlayer/components/SceneSvg/__tests__/`。設定メニューの ui の文言は `src/components/ui/SettingsMenu/__tests__/index.fixture.ts` が node で組む。

## コンテナと統合テスト

フックを1つでも呼ぶコンポーネント(と I/O コンテナの6つ)はコンテナで、ファイルは表示部品と同じ `index.tsx`。統合テストはそのコンテナのフォルダに置く。1本なら隣の `index.integration.test.tsx`、2本以上ならそのフォルダの `__tests__` に動作ごとのファイルで置く
([../decisions/0019-hooks-make-containers.md](../decisions/0019-hooks-make-containers.md)・[../decisions/0022-colocate-integration-tests.md](../decisions/0022-colocate-integration-tests.md)・[../decisions/0024-containers-as-index.md](../decisions/0024-containers-as-index.md))。
置き方・ファイルの分け方・部品とフィクスチャの決まりは [../quality/test-strategy.md](../quality/test-strategy.md) の「統合テストの約束」。I/O コンテナの一覧の正本は `scripts/container-dirs.mjs`。
入れ子の行は、その上の I/O コンテナの下にある状態コンテナ。

- `src/components/VillagePage/index.tsx`(村。I/O コンテナ)→ `src/components/VillagePage/__tests__/`
  - `src/components/VillagePage/components/Boot/index.tsx` → `src/components/VillagePage/components/Boot/index.integration.test.tsx`
  - `src/components/VillagePage/components/Village/components/ClockModal/index.tsx` → `src/components/VillagePage/components/Village/components/ClockModal/index.integration.test.tsx`
  - `src/components/VillagePage/components/Village/components/Ground/index.tsx` → `src/components/VillagePage/components/Village/components/Ground/index.integration.test.tsx`
  - `src/components/VillagePage/components/Village/components/Joystick/index.tsx` → `src/components/VillagePage/components/Village/components/Joystick/index.integration.test.tsx`
  - `src/components/VillagePage/components/Village/components/Lighting/index.tsx` → `src/components/VillagePage/components/Village/components/Lighting/index.integration.test.tsx`
  - `src/components/VillagePage/components/Village/components/StopModal/index.tsx` → `src/components/VillagePage/components/Village/components/StopModal/__tests__/`
  - `src/components/VillagePage/components/Village/components/TalkBubble/index.tsx` → `src/components/VillagePage/components/Village/components/TalkBubble/__tests__/`
  - `src/components/VillagePage/components/Village/components/WorldMap/index.tsx` → `src/components/VillagePage/components/Village/components/WorldMap/__tests__/`
- `src/components/Directory/index.tsx`(一覧。I/O コンテナ)→ `src/components/Directory/__tests__/`
  - `src/components/Directory/components/WorkCard/index.tsx` → `src/components/Directory/components/WorkCard/__tests__/`
- `src/components/Story/index.tsx`(作品ストーリー。I/O コンテナ)→ `src/components/Story/__tests__/`
  - `src/components/Story/components/StoryBody/index.tsx` → `src/components/Story/components/StoryBody/__tests__/`
  - `src/components/Story/components/SceneModal/index.tsx` → `src/components/Story/components/SceneModal/__tests__/`
  - `src/components/Story/components/SceneSection/index.tsx` → `src/components/Story/components/SceneSection/__tests__/`
  - `src/components/Story/components/TechChipPopover/index.tsx` → `src/components/Story/components/TechChipPopover/__tests__/`
  - `src/components/Story/components/IntroPreview/index.tsx` → `src/components/Story/components/IntroPreview/__tests__/`
- `src/components/ui/SettingsMenu/index.tsx`(設定メニュー。I/O コンテナ)→ `src/components/ui/SettingsMenu/__tests__/`
  - `src/components/ui/SettingsMenu/components/SettingsMenuPanel/index.tsx` → `src/components/ui/SettingsMenu/components/SettingsMenuPanel/__tests__/`
- `src/components/ui/PageviewCounter/index.tsx`(ページ移動の計測。I/O コンテナ)→ `src/components/ui/PageviewCounter/__tests__/`
- `src/components/ui/ScenePlayer/index.tsx`(場面の再生。I/O コンテナ)→ `src/components/ui/ScenePlayer/__tests__/`
  - `src/components/ui/ScenePlayer/components/SceneSvg/index.tsx` → `src/components/ui/ScenePlayer/components/SceneSvg/__tests__/`

村でない状態コンテナの8つは ADR 0019 の1段階(2026-10-17)まで、村の8つは2段階まで、同じフォルダの表示部品の `index.tsx` だった(`SettingsMenuPanel` は名前も `SettingsMenuView` だった)。
そこから ADR 0024(2026-10-18)まで、コンテナのファイルは `container.tsx` だった。今はコンテナも `index.tsx` で、使う側はフォルダを指す(例: `import StoryBody from './components/StoryBody'`)。

node でしか組めない props は、I/O コンテナのフォルダの `__tests__` の中のフィクスチャが組む。`src/components/VillagePage/__tests__/index.fixture.ts`・`src/components/Directory/__tests__/index.fixture.ts`・
`src/components/Story/__tests__/index.fixture.ts`・`src/components/ui/SettingsMenu/__tests__/index.fixture.ts` の4つ。
村の統合テストだけが使う部品は `src/components/VillagePage/__tests__/` にある。どのファイルも使う準備と後始末は `village.test-helper.ts`、
歩く・押す・待つ・時間・記録・飛行・地点・窓の焦点の手は `village-walk.test-helper.ts`・`village-time.test-helper.ts`・`village-walk-record.test-helper.ts`・
`village-walk-flight.test-helper.ts`・`flight.test-helper.ts`・`village-spots.test-helper.ts`・`village-dialog.test-helper.ts`。
状態コンテナを直接描くテストが共有する props は、会話窓・吹き出し・拡大地図のフォルダの `__tests__` の中の `<フォルダの名前の kebab-case>.test-helper.ts` が組む
(`src/components/VillagePage/components/Village/components/StopModal/__tests__/stop-modal.test-helper.ts`・`src/components/VillagePage/components/Village/components/TalkBubble/__tests__/talk-bubble.test-helper.ts`・`src/components/VillagePage/components/Village/components/WorldMap/__tests__/world-map.test-helper.ts`。ほかのフォルダはテストの中で組む)。
単体テストも使う `src/components/VillagePage/components/Village/utils/walk-loop/walk-loop.test-helper.ts` は `__tests__` に入れず、単体テストの隣に置く。

村は1段階では、統合テストを中身を変えずに1本のまま `village.integration.test.tsx` へ移しただけだった。
2段階で、村の画面全体を描くテストは当時のリポジトリ直下の `__tests__` の `village-page` の直下の動作ごとのファイルへ、8つの状態コンテナを直接描くテストはそれぞれのフォルダへ分け、その1本は消した。
その後、統合テストはリポジトリ直下からコンテナのフォルダへ移した([../decisions/0022-colocate-integration-tests.md](../decisions/0022-colocate-integration-tests.md))。
