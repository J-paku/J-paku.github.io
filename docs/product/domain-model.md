---
status: active
read_when:
  - content の型を足す・変えるとき
  - どこに値を置けばよいか迷うとき
source_of_truth: false
last_reviewed: 2026-09-21
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
│   │   ├── assignments[]        在籍中に替わった派遣先(持たない経歴もある)
│   │   └── detail: CareerDetail 右列に差し替えで出す担当業務の詳細
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
└── stops: Record<spot.id, StopText>   ← spots と過不足なく一致させる
```

`World` は言語共通(`content/world.ts`)、文言だけが locale 別(`content/{ja,ko}/village.ts`)。
地点を足すときは **world 側の `spots` と両言語の `stops` を同時に**足す。片方だけだとビルドが落ちる。

構造物の種類ごとの寸法は `content/types/world.ts` の `Structure` のコメントに書いてある。
ただし**通行判定の正本は `src/lib/village/collision.ts`**(家は `area` 全体が通行不可で、`solid` は見た目の境界にしか使わない)。
型のコメントは見た目の説明を含むので、当たり判定を変えるときは `collision.ts` を読む。
