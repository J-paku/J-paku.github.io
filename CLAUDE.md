# J-paku.github.io — 作業ルール

仕様書: `portfolio-hub-spec/` — 入口は `ROUTING.md`。その段階が指定した文書だけを読む。

グローバル規約(`~/.claude/CLAUDE.md` と `~/.claude/rules/**`)に従う。

## 不変ルール(違反したら即中断して報告)

1. **locale は `location.pathname` からのみ決まる。** `?lang=`・自動リダイレクトを作らない
2. **表示文字列を `content/` の外にハードコードしない。** コンポーネントに日本語・韓国語リテラル禁止
3. **`localStorage` へのアクセスは `src/lib/preferences.ts` 一箇所だけ**
4. **フックはフォルダ化しても `index.ts` を作らない。** コンポーネントのみ `index.tsx` が入口
5. **wip 作品は詳細ページを作らない。** カードにリンクを付けず、slug 直接アクセスは NotFound
6. 1段階 = 1セッション

## 完了条件

- `npm run typecheck` 通過
- `npm run test` 通過
- 各仕様書の「受け入れ基準」を実行結果で確認
- 配信に関わる変更は **GitHub Pages 配信版** でも同じ確認を繰り返す

ローカル PASS だけで完了と言わない。

## コミット規則

**形式**: `<type>: <日本語の要約>` + 本文は箇条書き(日本語・簡潔)

- **type**: `feat` / `fix` / `hotfix` / `refactor` / `docs`
- **AI署名を付けない**: `Co-Authored-By` も `Claude-Session` も書かない

## コードスタイル

- コードコメントは日本語のみ
- `any` 禁止(第三者API・catch・型ガード引数を除く)、ダブルクォート禁止(JSON除く)、セミコロン禁止
- ファイル名は kebab-case。コンポーネントフォルダのみ PascalCase
- バレル(`index.ts` の再export)禁止
