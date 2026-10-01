---
status: active
read_when:
  - content の型を足す・変えるとき
  - どこに値を置けばよいか迷うとき
source_of_truth: false
last_reviewed: 2026-10-01
---

# ドメインモデル

**型定義の正本は `content/types/content.ts`(表示データ)と `content/types/world.ts`(村)。**
ここには型どうしの関係と、どこに何を置くかの判断だけを書く。フィールドの一覧は型ファイルを直接読む。

## 表示データ

```
Content                      locale ごとに1つ
├── ui: UiStrings            ボタン名・読み上げ名などの UI 文言
├── profile: Profile         名前・肩書き・守備範囲・リンク
│   ├── careers: Career[]        在籍1社 = 1件。id が ja/ko 共通の安定キー
│   │   ├── assignments: CareerAssignment[] 左列に出す派遣先の1行(持たない経歴もある)
│   │   └── detail: CareerDetail 右列に展開して並べる担当業務の詳細
│   │       └── assignments: CareerDetailAssignment[] 派遣先ごとの担当内容(派遣先が複数の経歴だけ)
│   └── strengths: Strength[]
├── skills: SkillCategory[]  項目ごとに evidence(根拠の作品 slug)を持つ
├── now: NowEntry[]          日付 + 1行
└── works: Work[]            一覧のカード
    ├── detail?: WorkDetail  カード内で開く節の列
    └── story?: WorkStory    専用ページの中身(intro / scenes / outro)
```

判断の目安:

- **`ja` と `ko` は同じ型を満たす。** キーの過不足は `tsc --noEmit` が落とす。ko の欠けを ja で埋めない
- **ロケール共通の値**(`glyph`・`story.scenes[].image`)は ja/ko に同じ値を書く。型を分けない
- `status: 'wip'` の作品は `period` / `role` / `scale` / `detail` / `story` を持たない
- 「担当外の工程」を表すのは `CareerFeature.roles` に**含めないこと**。別のフラグを足さない
- 装飾のための記号(`·` の区切り、節番号 `ASSIGNMENT 01`)は content に持たせず、コンポーネント側が作る

## 村

```
WorldSet
├── startWorldId            ここから始まる
└── worlds: Record<id, World>
    └── World
        ├── kind            'exterior'(ミニマップ・拡大地図を持つ)/ 'interior'
        ├── tiles[y][x]     Tile。通行可否は種類で決まる
        ├── structures[]    Structure。占有マスは通行不可
        ├── spots[]         Spot。structureId で構造物と結ぶ。order はコース順(全ワールド通し)
        └── warps[]         Warp。target で別ワールドへ

VillageText(locale ごと)
├── 画面の文言(intro / hint / arriveAt ...)
└── stops: Record<spot.id, StopText>   ← action を持つ地点(卓上時計・池)を除いた地点 ID と一致させる
```

`World` は言語共通(`content/world.ts`)、文言だけが locale 別(`content/{ja,ko}/village.ts`)。
地点を足すときは **world 側の `spots` と両言語の `stops` を同時に**足す。片方だけだとビルドが落ちる。
ただし `action` を持つ地点(卓上時計・池)は `stops` に入れない。文言は `text.clock` / `text.fishing` が持ち、
`stops` に入れると「未知の地点」としてビルドが落ちる(`src/lib/content/validate-world.ts` の `validateVillageText`)。
構造物を持たない地点は `structureId` の代わりに、`arrivalArea`(建物の無い出口。その範囲への到着で会話窓を開く)か
`action`(池。話しかけると会話窓ではなく釣りが始まる)のどちらかを持つ。どちらも無いとビルドが落ちる(`src/lib/content/validate-world.ts`)。

構造物の種類ごとの寸法は `content/types/world.ts` の `Structure` のコメントに書いてある。
ただし**通行判定の正本は `src/lib/village/collision.ts`**(家は `area` 全体が通行不可で、`solid` は通行判定には使わない)。
家の `solid` は見た目の壁の境界のほか、`src/lib/village/spot.ts` で会話マス(`spotAt`)・吹き出しの位置(`talkAnchor`)・
押した物の判定(`objectSpotAt` / `routeToSpot`)に使う。
型のコメントは見た目の説明を含むので、当たり判定を変えるときは `collision.ts` を読む。
