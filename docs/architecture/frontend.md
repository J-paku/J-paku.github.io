---
status: active
read_when:
  - コンポーネントやフックを追加・分割するとき
  - スタイル・色・テーマを触るとき
source_of_truth: true
last_reviewed: 2026-10-15
---

# 画面とコンポーネント

画面は3つ。それぞれ `src/components/` 直下の1フォルダが本体で、`src/app/` 側はルート定義と、ja/ko が共有する枠・組み立て
(`src/app/html-shell.tsx` / `src/app/locale-routes.tsx`)を持ち、画面本体は持たない。

| 画面           | 本体                                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 村             | `src/components/VillagePage/`(詳細は [village.md](village.md))                                                                                                                                                                                   |
| 一覧           | `src/components/Directory/`                                                                                                                                                                                                                      |
| 作品ストーリー | `src/components/Story/`                                                                                                                                                                                                                          |
| 横断部品       | `src/components/ui/`(複数の画面にまたがって使う部品か、2箇所以上から使う部品を置く。同じ画面の中の2箇所でもよい。全画面に掛かる殻(`src/app/html-shell.tsx`)や他の横断部品から使う部品は、import が1箇所でも複数の画面にまたがるものとして数える) |

どこまでがサーバで、どこからがクライアントの島かは [boundaries.md](boundaries.md) にまとめてある。

どのファイルがどの画面に属するかの一覧は [../product/feature-map.md](../product/feature-map.md)。

## ローダー・コンテナ・表示部品

画面の3つと、複数の画面にまたがり外の I/O に触れる横断部品の3つは、ファイルを役割で分ける([ADR 0017](../decisions/0017-screen-containers.md))。

| ファイル                                          | 役割                                                                                                                                                                                                                                         | 置く所                                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `index.tsx`(画面のローダー)                       | サーバでしかできないことだけを行う。content の読み出し(`@/lib/content/read`)・`node:` のモジュールを使うスプライトの生成・`notFound()`・初回の HTML に必ず要るインラインの `<style>`・`<script>`。直列化できる props で `./container` を描く | 画面の3つ(`src/components/VillagePage/`・`src/components/Directory/`・`src/components/Story/`)。ルート(`src/app/`)はこれを import する |
| `container.tsx`(コンテナ)                         | 画面の組み立て(静的なマークアップを含む)。画面の状態・データのフックとストアを呼び、外の世界に触れる import を持つ。フックが無くてもよい                                                                                                     | 画面の3つと、横断部品の `src/components/ui/SettingsMenu/`・`src/components/ui/PageviewCounter/`・`src/components/ui/ScenePlayer/`      |
| コンテナの隣の `hooks` フォルダ                   | 外の世界に触れるフックを置いてよい唯一の所。画面のフォルダの直下のもの(`src/components/VillagePage/hooks/`)は画面の状態・データのフックで、コンテナだけが呼ぶ                                                                                | `src/components/VillagePage/hooks/`・`src/components/ui/SettingsMenu/hooks/`・`src/components/ui/ScenePlayer/hooks/`                   |
| 表示部品(上のどれでもない `.tsx` と `src/hooks/`) | 受け取った props を描く。その部品の DOM の中で閉じる UI のフック(フォーカス・スクロール・観察器・外側の押下で閉じるなど)は使ってよい                                                                                                         | それ以外の全部                                                                                                                         |

- コンテナを置くのは上の6つだけ(一覧の正本は `scripts/container-dirs.mjs`。一覧の外の `container.tsx` と、一覧のフォルダに `container.tsx` が無いことを `npm run test:boundary` が落とす)。
  フックを持つからコンテナにするのではなく、役割(画面か、外の I/O に触れる横断部品か)で決める。足すなら一覧と [ADR 0017](../decisions/0017-screen-containers.md) の D1 を直す
- 表示部品は、外の世界に触れるモジュール・村の時計のストア・`next/navigation`・画面のフック(画面のフォルダの直下の `hooks` フォルダ)を import しない。
  一覧と正本は [boundaries.md](boundaries.md) の「コンテナと表示部品」
- コンポーネントを描くテストは、コンテナの隣の `container.browser.test.tsx` だけ(コンテナごとに1本)→ [../quality/test-strategy.md](../quality/test-strategy.md)

## コンポーネントのフォルダ

コンポーネントは必ず**フォルダ + `index.tsx`** で作る。外からは `@/components/<Name>` だけを見ればよい状態にする。
例外はコンテナを持つ横断部品で、外から `container.tsx` を直接指す(`@/components/ui/SettingsMenu/container` など)。フォルダの形は3つで違う。

- `ScenePlayer` — `container.tsx` と、コンテナが描く表示部品の `index.tsx` を持つ。場面 SVG の原本を取るフックはコンテナの隣の `src/components/ui/ScenePlayer/hooks/` に置く
- `SettingsMenu` — 開閉のフック(`use-menu-open`)を呼ぶ部品を、状態コンテナ `src/components/ui/SettingsMenu/components/SettingsMenuPanel/` の `container.tsx` にし、
  そのフックはその隣の `src/components/ui/SettingsMenu/components/SettingsMenuPanel/hooks/` に置く。フォルダの直下に `index.tsx` は無い。
  直下の `src/components/ui/SettingsMenu/hooks/` はコンテナの隣で、コンテナのフック(テーマの保存の `use-theme-choice`)の置き場だから
- `PageviewCounter` — 何も描かないので表示部品が無く、`container.tsx` だけを持つ

**表示部品が自分の UI のフックを持つなら `components/<Name>View/` へ下ろし、その隣の `hooks` フォルダに置く。** コンテナのあるフォルダの直下の `hooks` フォルダは、コンテナのフックの置き場なので使わない。

```
src/components/Directory/components/WorkCard/
  index.tsx            入口。Props を受け、下位部品へ配る
  work-card.module.css このフォルダのスタイル(下位部品と共有してよい)。ファイル名はフォルダ名の kebab-case
  components/          このカード専用の下位部品
  hooks/               このカード専用のフック
```

- フォルダ名は **PascalCase**、その中のファイル名は **kebab-case**(`index.tsx` を除く)
- Props の型は `index.tsx` の中に直接書く。このリポジトリに `type.ts` を置く前例は無い
- **バレルを作らない**(理由と正確な条件は [boundaries.md](boundaries.md))
- 2箇所以上から使い始めた部品・フック・純粋関数は、その時点で上位(`src/components/ui/`・`src/hooks/`・`src/utils/`)へ引き上げる。
  部品は、import が1箇所でも、そこが全画面に掛かる殻(`src/app/html-shell.tsx`)や他の横断部品で複数の画面にまたがるなら
  `src/components/ui/` に置く(`PageviewCounter` は殻から、`SettingsMenu` は `Navigation` から使う)

## フック

- **フックのフォルダには `index.ts` を作らない**(不変ルール4)。呼び出し側はファイルを直接指す
- 画面の状態・データのフック(保存・天気・時計のストアなど外の世界に触れるもの)は、コンテナのあるフォルダの直下の `hooks` フォルダに置き、コンテナだけが呼ぶ
  (`src/components/VillagePage/hooks/`。下のフォルダ `use-village-guide`・`use-village-overlay`・`use-walk-loop` を含む)。
  横断部品の外の世界に触れるフック(テーマの保存・場面 SVG の原本の取得)も、そのコンテナの隣の `hooks` フォルダに置く
- その部品の DOM の中で閉じる UI のフックは、それを使う部品のフォルダの中の `hooks` フォルダに置く(`src/components/VillagePage/components/Village/hooks/`(窓のフォーカスの輪と押しっぱなしの向き)・
  `src/components/Directory/components/WorkCard/hooks/`・`src/components/Story/components/StoryBody/hooks/use-active-scene.ts`(今読んでいる場面を `IntersectionObserver` で追う)など)。
  画面のフォルダの直下の `hooks` フォルダはコンテナの隣のフォルダなので、UI のフックを置かない。横断するものだけ `src/hooks/` に置く(`src/hooks/` は表示部品の側で、外の世界に触れない)
- 命名は `use-` 始まりの kebab-case
- `hooks` フォルダには `use-` 始まりのフック以外を置かない。テストも置かない(フックは配線だけを持ち、ロジックは純粋関数へ移して測る。
  [../quality/test-strategy.md](../quality/test-strategy.md) の「テストの境界」)。純粋関数・レンダラーは `utils` フォルダへ
- ファイル名は動詞-名詞の kebab-case、3語まで(例: `paint-camera.ts`)。長い名前を付けない

## スタイル

- CSS Modules。1つのコンポーネントフォルダに `*.module.css` は1つまでで、ファイル名はフォルダ名の kebab-case
- 下位部品は自分の `*.module.css` を持たずに親のものを読んでよい(`CareerDetail` の下位部品 → `career-detail.module.css`、
  `WorldMap` の下位部品 → `world-map.module.css`、`Story` の `StoryBody` → `story.module.css`)
- ファイルの置き方の例外は村に2つある。`src/components/VillagePage/components/Boot/boot.css` は CSS Modules ではなく、`#boot` の id で当てる大域 CSS。
  `src/components/VillagePage/components/Village/scene.module.css` はフォルダ名(`Village`)と違う名前で、下位部品
  (`WorldLayer`・`Ground`・`LampVeil`・`FishingFloat`。後の2つは自分の `*.module.css` と両方読む)に加えて親の `src/components/VillagePage/index.tsx` も
  読む(スプライトの背景 CSS のクラス名に使う。`src/components/VillagePage/utils/sprite-css.ts`)
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
