<!-- content/ の読み方と、実装セッションへの引き継ぎメモ -->

# content/

設計仕様書「ポートフォリオハブ 設計仕様書 — J-paku.github.io」の**コンテンツ枠を埋めたもの**。
コードツリー外に置き、`ja` / `ko` の対称を目で確認できる状態を保つ。

## 構成

```
content/
├── ja/
│   ├── profile.ts   Profile
│   ├── skills.ts    SkillCategory[]
│   ├── now.ts       NowEntry[]
│   └── works/
│       ├── seatmap-demo.ts          status: 'published'
│       ├── ai-harness.ts            status: 'published'
│       ├── meishi-cross-platform.ts status: 'wip'
│       └── gatchanko.ts             status: 'wip'
└── ko/  (同一ツリー・同一型)
```

型の定義元は `src/types/content.ts` の1箇所。`ko` は `ja` と同じ型を満たすため、キーの過不足は `tsc --noEmit` で落ちる。

## 仕様書からの差分(1点)

**`period` / `role` / `scale` を optional にした。** 仕様書の「wipカードは title / tagline のみ」を型で表すため。`status: 'wip'` の作品はこの3つを持たない。

## works の集約

バレル(`index.ts` 再export)は使わない。ローダー側で Vite の `import.meta.glob` を使い、
`content/{locale}/works/*.ts` を列挙する。**デモ追加 = ファイル1個追加**が成立する。

## 未確定・要確認

| 箇所 | 内容 |
| --- | --- |
| `profile.careers[0].company` | 現職の社名を業種表記にしている。実名で出すならこの行を差し替える |
| `profile.careers[1].period` | 前職の入社・退社月が未確定(在籍2年10か月のみ確定) |
| wip 2件 | title / tagline のみ。「現在」セクションとセットでのみ成立させる |
