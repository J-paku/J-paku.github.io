<!-- content/ の読み方と、実装セッションへの引き継ぎメモ -->

# content/

表示文字列と村の定義。コードツリー外に置き、`ja` / `ko` の対称を目で確認できる状態を保つ。
**編集するときの決まりは [AGENTS.md](AGENTS.md)**。この文書はフォルダの読み方だけを持つ。

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

## works の集約

バレルは使わない。`src/lib/content/read.ts` の登録表(WORKS)に ja/ko の import を1行ずつ足す。
登録表と `content/ja/works/*.ts` の実ファイル一覧は build 時に突き合わせ、漏れがあれば build が落ちる。

## 覚えておくこと

`period` / `role` / `scale` は optional。`status: 'wip'` の作品はこの3つを持たず、詳細ページも作らない(現在 wip は 0 件)。
