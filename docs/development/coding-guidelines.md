---
status: active
read_when:
  - コードを書く前に書き方を確かめたいとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# 書き方

整形は Prettier が、依存の向きは ESLint が機械的に守らせる(`.prettierrc` / `eslint.config.mjs` が正本)。
ここには**機械が見ない決まり**を書く。

## 言語

- **コードコメントは日本語のみ。** 英語のコメントを混ぜない
- コメントは「何をしているか」ではなく**「なぜそうしたか」**を書く。既存ファイルの冒頭コメントがその見本
- 表示文字列をコンポーネントに書かない(不変ルール2)。日本語・韓国語のリテラルは `content/` にだけ置く

## 型

- **`any` 禁止。** 例外は第三者 API の戻り・`catch` の引数・型ガードの引数
- 外から来た値(`localStorage`・`fetch` の応答)は**型ガードを通してから使う**。壊れていれば既定値へ丸める
- `tsconfig.json` は `strict` に加えて `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` が有効。使わない変数は消す
- 同じ型の入口を2つ作らない。下の層の型を上の層から**再 export しない** → [../architecture/boundaries.md](../architecture/boundaries.md)

## 命名とファイル

- ファイル名は **kebab-case**。コンポーネントフォルダだけ **PascalCase**、その入口が `index.tsx`
- フックは `use-` 始まり。**フックのフォルダに `index.ts` を作らない**(不変ルール4)
- `hooks` フォルダには `use-` 始まりのフック(と `.test.ts`)以外を置かない。純粋関数・レンダラーは `utils` フォルダへ
- ファイル名は動詞-名詞の kebab-case、3語まで(例: `paint-camera.ts`)。長い名前を付けない
- **バレル禁止**(→ [../architecture/boundaries.md](../architecture/boundaries.md))

## 分け方

- **行数ではなく責務の数で分ける。** 単一責務なら長くても分けない。責務が2つなら短くても分ける
- 1つのファイルが「フック」と「純粋関数」を同時に export していたら分割の合図
- 2箇所以上が使い始めたら、その時点で上位(`src/hooks/` `src/utils/` `src/components/ui/`)へ引き上げる

## 直すときに触ってよい範囲

- **変えた行が1つずつ依頼に直結すること。** ついでの整形・コメント更新・リファクタを混ぜない
- 自分の変更で使われなくなった import・変数は消す。**元から死んでいたコードは消さず、報告に書く**
- その場の多数派の書き方に合わせる。好みで様式を変えない

## 色

色リテラルを書かない。定義は `src/styles/tokens.css` だけ → [../architecture/frontend.md](../architecture/frontend.md)。
