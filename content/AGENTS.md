# content/ で作業するとき

ここは**データ**。`src/` を import しない。ロジックを置かない。
フォルダの読み方は [README.md](README.md)、型の関係は [../docs/product/domain-model.md](../docs/product/domain-model.md)。

| 直したいもの | ファイル |
|---|---|
| ボタン名・読み上げ名などの UI 文言 | `content/ja/ui.ts` / `content/ko/ui.ts` |
| 名前・肩書き・経歴 | `content/ja/profile.ts` / `content/ko/profile.ts` |
| 作品カードと作品ストーリー | `content/ja/works/<slug>.ts` / `content/ko/works/<slug>.ts` |
| 村の文言(案内・地点ごとの会話) | `content/ja/village.ts` / `content/ko/village.ts` |
| 村の地形・構造物・会話地点(言語共通) | `content/world.ts` |
| 型 | `content/types/content.ts` / `content/types/world.ts` |

## 守ること

1. **ja と ko は同じ型を満たす。** 片方だけ足さない。ko の欠けを ja で埋めない
2. **表示文字列はここにしか置かない**(不変ルール2)。コンポーネントに日本語・韓国語のリテラルを書かない
3. **作品を足す = ファイル追加 + `src/lib/content/read.ts` の登録表に ja/ko を1行ずつ。** バレルも glob も使わない
4. **村の地点を足す = `world.ts` の `spots` + 両言語の `village.ts` の `stops`。** キーは過不足なく一致させる
5. **コース外の地点には `order` を付けない。** `order` は全ワールド通しの 1..n の連番
6. ロケール共通の値(`glyph`・`story.scenes[].image`)は ja/ko に同じ値を書く。型を分けない
7. `status: 'wip'` の作品は(不変ルール5) `period` / `role` / `scale` / `detail` / `story` を持たない。詳細ページも作らない

## 壊れているかの確かめ方

```bash
npm run typecheck   # キーの過不足
npm run build       # 登録漏れ・地点と文言のずれ・村の到達性と歩数
```

落ちるときのメッセージと上限値の一覧は [../docs/product/business-rules.md](../docs/product/business-rules.md)。
