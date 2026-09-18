<!-- content/ の読み方と、実装セッションへの引き継ぎメモ -->

# content/

設計仕様書「ポートフォリオハブ 設計仕様書 — J-paku.github.io」の**コンテンツ枠を埋めたもの**。
コードツリー外に置き、`ja` / `ko` の対称を目で確認できる状態を保つ。

## 構成

```
content/
├── types/
│   ├── content.ts   Content・Work・UiStrings など表示データの型
│   └── world.ts     World・VillageText など村の型
├── world.ts         World(村の地形・構造物 structures・会話地点 spots。言語共通)
├── ja/
│   ├── ui.ts        UiStrings
│   ├── profile.ts   Profile
│   ├── skills.ts    SkillCategory[]
│   ├── now.ts       NowEntry[]
│   ├── village.ts   VillageText(案内文・操作文言と、地点ごとの stops)
│   └── works/
│       ├── seatmap-demo.ts          status: 'published'
│       ├── ai-harness.ts            status: 'published'
│       └── meishi-cross-platform.ts status: 'published'(story あり)
└── ko/  (同一ツリー・同一型)
```

型の定義元は `content/types/content.ts` と `content/types/world.ts` の2箇所(データ側が型を持ち、`src/` はそれを参照する)。`ko` は `ja` と同じ型を満たすため、キーの過不足は `tsc --noEmit` で落ちる。
`village.ts` の `stops` のキーは `world.ts` の `spots[].id` と一致させる(ずれは build 時の `validateVillageText` が落とす)。

## 仕様書からの差分(1点)

**`period` / `role` / `scale` を optional にした。** 仕様書の「wipカードは title / tagline のみ」を型で表すため。`status: 'wip'` の作品はこの3つを持たない。

## works の集約

バレルは使わない。`src/lib/content/read.ts` の登録表(WORKS)に ja/ko の import を1行ずつ足す。
登録表と `content/ja/works/*.ts` の実ファイル一覧は build 時に突き合わせ、漏れがあれば build が落ちる。

## 未確定・要確認

| 箇所                         | 内容                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| `profile.careers[0].company` | 現職の社名を業種表記にしている。実名で出すならこの行を差し替える           |
| `profile.careers[1].period`  | 前職の入社・退社月が未確定(在籍2年10か月のみ確定)                          |
| wip 作品                     | 現在 0 件。追加する場合は title / tagline のみ持たせ、詳細ページは作らない |
