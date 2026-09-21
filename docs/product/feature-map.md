---
status: active
read_when:
  - どのファイルを触ればよいか当たりを付けたいとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# 画面とファイルの対応

**「どこを触るか」の当たりを付けるための地図。** 網羅ではないので、見つからなければ実物を検索する。

## 村 — `/`・`/ko/`

| | |
|---|---|
| ルート | `src/app/(ja)/page.tsx` / `src/app/(ko)/ko/page.tsx` |
| 画面本体 | `src/components/VillagePage/`(`index.tsx` はサーバ。シート合成と地点リンクをここで1回だけ作る) |
| 操作・描画 | `src/components/VillagePage/components/Village/`(クライアント) |
| 規則 | `src/lib/village/` |
| 絵 | `src/lib/pixel/` |
| コンテンツ | `content/world.ts`(地形)・`content/{ja,ko}/village.ts`(文言) |
| E2E | `tests/journey.spec.ts`(導線)・`tests/layout.spec.ts`(舞台の寸法)・`tests/day-night.spec.ts`(昼夜と天気)・`tests/clock.spec.ts`(自室の卓上時計)・`tests/fishing.spec.ts`(池での釣り) |

詳細は [../architecture/village.md](../architecture/village.md)。

## 一覧 — `/list/`・`/ko/list/`

| | |
|---|---|
| ルート | `src/app/(ja)/list/page.tsx` / `src/app/(ko)/ko/list/page.tsx` |
| 画面本体 | `src/components/Directory/` |
| 左列(プロフィール・経歴) | `src/components/Directory/components/ProfileColumn/`・`src/components/Directory/components/CareerDetail/` |
| 作品カード | `src/components/Directory/components/WorkCard/`(クライアント。折りたたみ詳細・リンクオーバーレイ・場面リール) |
| コンテンツ | `content/{ja,ko}/profile.ts`・`skills.ts`・`now.ts`・`works/*.ts`・`ui.ts` |

## 作品ストーリー — `/works/<slug>/`・`/ko/works/<slug>/`

| | |
|---|---|
| ルート | `src/app/(ja)/works/[slug]/page.tsx` / `src/app/(ko)/ko/works/[slug]/page.tsx`(+ 各ルートグループの `src/app/(ja)/works/layout.tsx` と `src/app/(ko)/ko/works/layout.tsx`) |
| 画面本体 | `src/components/Story/` |
| 場面の再生 | `src/components/ui/ScenePlayer/`(SVG をシャドウルートへ展開)・`src/lib/fetch-svg-source.ts` |
| 全画面モーダル | `src/components/Story/components/SceneModal/` |
| コンテンツ | `content/{ja,ko}/works/<slug>.ts` の `story` |
| 場面 SVG | `public/works/` |

`src/utils/scene-durations.ts` は各場面 SVG の `animation-duration` を写した表。**SVG 側の周期を変えたらここも直す。**

## 画面をまたぐ部品 — `src/components/ui/`

`DeviceFrame`(iPhone 枠)・`Logo`・`Navigation`・`PhraseText`(日本語の文節改行)・`PlaybackIcon`・
`PlaybackPulse`(再生切り替えのパルスと停止中の印)・`ScenePlayer`・`SettingsMenu`(言語とテーマ)・
`TechTag`。

**2箇所以上から使い始めた時点でここへ引き上げる。** 1箇所しか使わない部品は画面側のフォルダに置く。
