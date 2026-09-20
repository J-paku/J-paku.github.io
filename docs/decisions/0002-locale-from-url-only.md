---
status: historical
read_when:
  - 言語の切り替え方を変えようとするとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# 0002. locale を URL パスだけで決める

## Status

Accepted(不変ルール1。判定の実装は `src/utils/locale-path.ts`)

## Context

配信先は GitHub Pages の静的ファイルで、リクエスト時に動くサーバが無い。
`Accept-Language` を見て出し分けることも、リダイレクトをサーバ側で返すこともできない。
一方で ja / ko の両方に到達可能な URL が必要だった。

## Decision

**locale は `location.pathname` だけで決まる。** `/ko` 配下が `ko`、それ以外は `ja`。
`?lang=` のクエリも、保存値や言語設定による自動リダイレクトも作らない。
判定は `parseLocale` 1箇所に集約し、各所で `pathname.startsWith('/ko')` を書かない。

## Consequences

- URL が唯一の情報源になり、共有されたリンクが必ず同じ言語で開く
- `localStorage` に残すのはテーマだけで、言語は残さない
- ルートグループを2本(`(ja)` と `(ko)/ko`)持つことになり、**ページを足すときは両方に足す**
- 訪問者のブラウザ言語に合わせた初期表示はできない。切り替えは `SettingsMenu` の明示操作だけ

## Alternatives Considered

- **クライアント側で言語判定してリダイレクト** — 初回描画後に URL が変わり、共有リンクと実際の表示がずれる
- **1本のルートで locale を状態として持つ** — 静的エクスポートでは両言語の HTML を吐けなくなり、検索と共有に不利
