---
status: active
read_when:
  - import の向きで ESLint に落とされたとき
  - 'use client' を足す・動かすとき
  - 新しいレイヤーやフォルダを作ろうとするとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# 境界

このリポジトリには3種類の境界がある。**レイヤー(import の向き)**、**server と client**、**データとコード**。
1つ目は ESLint が機械的に守らせる。残り2つは規約として守る。

## レイヤー(機械が守らせる)

許される向きは一方向だけ。

```
content(データ) ─┐
                 ↓
utils ← lib ← hooks ← components ← app
```

- `src/utils/` — 純粋関数・定数のみ。`lib` `hooks` `components` `app` と `content` の実データを import しない
- `src/lib/` — 外の世界(ファイル読み・保存・ネットワーク)に触れる層。`hooks` `components` `app` を import しない
- `src/hooks/` — `components` `app` と `content` の実データを import しない
- `src/components/` — `app` と `content` の実データを import しない
- `src/app/` — `content` を直接読まない。`@/lib/content/read` 経由
- `content/` — データ。`src/` を一切 import しない

加えて2つ。

- **`content/` の実データ(`@content/ja` `@content/ko` `@content/world`)を読んでよいのは `src/lib/content/` だけ。** 型(`@content/types/...`)はどこから読んでもよい
- **バレル禁止。** `from '.'`(同フォルダ)と `from '..'`(親フォルダ)は全ファイルで禁止。`./index` か `@/<絶対パス>` を使う

正本は `eslint.config.mjs`。**この表を信じる前に、落ちたときのメッセージを読む**(禁止理由がそのまま書いてある)。
規則を変えるときは表ではなく `eslint.config.mjs` を直し、この文書を直す。→ [ADR 0004](../decisions/0004-lint-enforced-layer-boundaries.md)

### 型の正本が下の層にあるとき

`DayPhase` の定義は `src/utils/day-phase.ts` にある。`src/lib/pixel/palette-phase.ts` はそれを **import するだけで再 export しない**。
同じ型の入口が2つあると、呼び出し側ごとにどちらを使うかがばらつくため。同じ状況を作るときはこの前例に合わせる。

## server と client

既定はサーバコンポーネント。`'use client'` は**ブラウザの入力・アニメーション・保存・DOM 実測が必要な島**にだけ置く。

現在クライアントなのは、村の操作系(`src/components/VillagePage/components/Boot/` と `src/components/VillagePage/components/Village/` 配下)、一覧の `WorkCard`、
作品ストーリーのモーダル・ポップオーバー・場面再生(`src/components/Story/` 配下と `src/components/ui/ScenePlayer/` `src/components/ui/SettingsMenu/`)。

線を引くときの基準:

- **content を読むのはサーバ側**。クライアントへは props で必要な値だけ渡す(`read.ts` は `server-only` なので持ち込めない)
- 重い組み立て(スプライトシートの合成など)はサーバで1回だけ行い、結果を props で渡す
- `'use client'` を上へ動かすと、その下は全部クライアントになる。**島は小さいほどよい**

## データとコード

`content/` は「コードツリーの外に置いたデータ」。ja / ko の対称を目で確認できる状態を保つのが目的で、
ロジックを持ち込まない。編集の決まりは [../../content/AGENTS.md](../../content/AGENTS.md)。
