---
status: active
read_when:
  - テストを足す・直すとき
  - どのテストを走らせるか決めるとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# テスト

## 2層しかない

| 層 | 置き場 | 対象 | 環境 |
|---|---|---|---|
| 単体(Vitest) | 対象ファイルの隣 `*.test.ts` | **純粋関数のみ** | `environment: 'node'`。DOM を持たない |
| E2E(Playwright) | `tests/*.spec.ts` | 実際のクリック・キー操作 | `out/` を `:4173` で静的配信 |

- Vitest が拾うのは `src/**/*.test.ts` だけ(`vitest.config.ts`)。`content/` や `tests/` は対象外
- **コンポーネントのレンダリングテストは無い。** 画面の確認は E2E が受け持つ
- 純粋関数に切り出せる計算は切り出してから単体テストを書く。`src/lib/village/` と `src/lib/pixel/` がその形になっている
- フィクスチャは `*.fixture.ts`(Vitest の対象から外れる名前)

## E2E の5本

| ファイル | 見るもの |
|---|---|
| `tests/journey.spec.ts` | 村の導線。会話 → 扉 → 作品 → 一覧、地図の高速移動、位置と訪問の保存、テーマ、当たり判定を ja/ko 双方で |
| `tests/layout.spec.ts` | 舞台の寸法。PC・縦持ち・横持ち・タブレットで操作帯の配置が崩れないか |
| `tests/day-night.spec.ts` | 時計を4段階に固定した空と、Open-Meteo の応答を差し替えた雨の有無 |
| `tests/clock.spec.ts` | 自室の卓上時計。決めた時刻が空の段階と夜の灯りへ効くか、町へ出ても続き再読み込みで実時刻へ戻るか |
| `tests/fishing.spec.ts` | 池での釣り。吹き出しから直接投げる → 浮き → 巻物 → 経験の会話窓と、投げている間の移動の止め方 |

E2E は `out/` を配る。**先に `npm run build` を済ませる。**

## 新しい検査は必ず一度落とす

書いたテストが**本当にその欠陥を検出できるか**を、採用する前に確かめる。
修正を外す / 期待値を反転する のどちらかで **PASS → FAIL が動くこと**を見てから採用する。動かないならそのテストは無い。

理由: このリポジトリでは過去に、直しを外しても PASS し続ける検査を書いたことがある(配信物が古いままだった)。
PASS は調査を止めるので、FAIL より危険である。

## 走らせる範囲

反復中は落ちた spec だけを狭く走らせる(`npx playwright test tests/journey.spec.ts -g '<名前>'`)。
**全体は commit の直前に1回**。詳しくは [../agents/verification.md](../agents/verification.md)。
