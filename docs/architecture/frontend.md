---
status: active
read_when:
  - コンポーネントやフックを追加・分割するとき
  - スタイル・色・テーマを触るとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# 画面とコンポーネント

画面は3つ。それぞれ `src/components/` 直下の1フォルダが本体で、`src/app/` 側はルート定義だけを持つ。

| 画面 | 本体 |
|---|---|
| 村 | `src/components/VillagePage/`(詳細は [village.md](village.md)) |
| 一覧 | `src/components/Directory/` |
| 作品ストーリー | `src/components/Story/` |
| 横断部品 | `src/components/ui/`(2画面以上から使う部品だけを置く) |

どこまでがサーバで、どこからがクライアントの島かは [boundaries.md](boundaries.md) にまとめてある。

どのファイルがどの画面に属するかの一覧は [../product/feature-map.md](../product/feature-map.md)。

## コンポーネントのフォルダ

コンポーネントは必ず**フォルダ + `index.tsx`** で作る。外からは `@/components/<Name>` だけを見ればよい状態にする。

```
src/components/Directory/components/WorkCard/
  index.tsx            入口。Props を受け、下位部品へ配る
  work-card.module.css このフォルダ専用のスタイル。ファイル名はフォルダ名の kebab-case
  components/          このカード専用の下位部品
  hooks/               このカード専用のフック
```

- フォルダ名は **PascalCase**、その中のファイル名は **kebab-case**(`index.tsx` を除く)
- Props の型は `index.tsx` の中に直接書く。このリポジトリに `type.ts` を置く前例は無い
- **バレルを作らない**(理由と正確な条件は [boundaries.md](boundaries.md))
- 2箇所以上から使い始めた部品・フック・純粋関数は、その時点で上位(`src/components/ui/`・`src/hooks/`・`src/utils/`)へ引き上げる

## フック

- **フックのフォルダには `index.ts` を作らない**(不変ルール4)。呼び出し側はファイルを直接指す
- 画面専用のフックはその画面のフォルダの `<画面>/hooks/` に、横断するものだけ `src/hooks/` に置く
- 命名は `use-` 始まりの kebab-case

## スタイル

- CSS Modules。1つのコンポーネントフォルダに1つの `*.module.css`
- **新しく書く CSS に色リテラル(`#rrggbb` / `rgb()` / `hsl()`)を置かない。** 色の定義は `src/styles/tokens.css` に置き、参照は `var(--...)` で行う
- テーマは `<html data-theme="light|dark">` の1属性だけで決まる。`prefers-color-scheme` の分岐は持たない
  - 初回ペイント前に `src/app/html-shell.tsx` のインラインスクリプトが `localStorage` の保存値を反映する(ちらつき回避)
  - 切り替えは `src/components/ui/SettingsMenu/` が `document.documentElement.dataset.theme` を書き、`src/lib/preferences.ts` 経由で保存する
- `tokens.css` のダーク側は**ライトで定義した色変数を1つ残らず再定義する**。再定義漏れでライトの値が漏れ、コントラストが 1.99:1 になった事故が実際にある(同ファイル冒頭のコメント参照)
- **例外は村の画面。** 村はライト/ダークのテーマに連動せず独自の配色をとるため、`src/components/VillagePage/` 配下の CSS は
  トークンをその場で再定義したり(`village-page.module.css` の `--ground` など)、リテラルを直接使ったりしている。
  村の絵(スプライト)はテーマではなく時刻の4段階に連動する → [village.md](village.md)
- 村の外(`src/components/Directory/` `src/components/Story/` `src/components/ui/`)では例外を作らない。**既存のリテラルを見つけても、依頼と無関係なら直さず報告に書く**

新しい色を足したくなったら、まず `tokens.css` に既存の意味の変数が無いかを見る。半透明が要るときは
`color-mix(in srgb, var(--...) 97%, transparent)` の形でトークンを薄める。

## 日本語のテキスト

本文は文節で折る。分割は `src/utils/ja-phrase.ts`(BudouX)が行い、表示側は `src/components/ui/PhraseText/` を使う。
`overflow-wrap: anywhere` を使わない(文節境界より優先されて語中で折れる)。基準は [../quality/japanese-typography.md](../quality/japanese-typography.md)。
