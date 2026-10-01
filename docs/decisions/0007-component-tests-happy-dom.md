---
status: historical
read_when:
  - コンポーネントのテストの置き場や DOM 環境を変えようとするとき
  - 統合テストの対象を広げようとするとき
source_of_truth: false
last_reviewed: 2026-10-01
---

# 0007. 環境で分かれるコンポーネントの出し分けを、happy-dom の統合テストで見る

## Status

Superseded by [0009](0009-widen-happy-dom-test-scope.md)(対象の範囲。2026-09-29 の`148a540`・`532f480`・`00326c0`・`69b92e0`・`11764fc`から、環境で分かれる出し分けの外と、村のフック・歩行ループの部品・DOM を使う utils へ広がった)

採った時点: Accepted(2026-09-28。`vitest.config.ts` と `src/components/Directory/components/WorkCard/index.test.tsx`)

## Context

テストは単体(DOM を持たない node の Vitest)と E2E(Playwright)の2層で、コンポーネントを描いて確かめる層が無かった。
作品カードは環境で表示が分かれる — `#<slug>` 付きで到着すると詳細が開いている、動きを控える設定では動画もリールも出さない、
`IntersectionObserver` が無ければカードを隠さず写真も色付きで描く。どれも mount 後に決まり、
単体テストにも E2E(`tests/directory.spec.ts` はリンクと slug の直接アクセスだけ)にもこの分岐を見る検査が無かった。
しかもこの分岐は `0ecfac3` で、effect 本文の同期 setState を理由付きの `eslint-disable-next-line` で残した箇所
(`use-detail-open.ts`・`use-card-motion.ts`・`src/hooks/use-reveal.ts`)と、`useSyncExternalStore` へ移した
`use-fully-visible.ts` に当たる。lint の例外として残した以上、振る舞いは別の手段で止めておく必要があった。

## Decision

Vitest に統合テストの層を足す。DOM は happy-dom、描画と操作は React Testing Library と user-event。

- 既定の環境は node のまま。DOM が要るファイルだけ、先頭の `// @vitest-environment happy-dom` で切り替える
- 置き場は対象コンポーネントの隣の `index.test.tsx`。`vitest.config.ts` の `include` に `src/**/*.test.tsx` を足す
- 対象は**環境で分かれる出し分け**だけ。`matchMedia`・`IntersectionObserver`・`fetch` はテストが `vi.stubGlobal` で作る
- 確かめるのは利用者に見えるもの(role・`aria-*`・`inert`・要素の有無)。クラス名は同じ CSS Modules を import して引く

## Consequences

- 既存の単体テストは環境を変えずに node で走る
- 作品カードのテストは、上の4つのフックの分岐を1か所ずつ壊すと、それぞれ落ちることを確かめてから採用した
- happy-dom は配置を計算しない(作品カードの寸法は 0)。`IntersectionObserver` も通知しない空の実装なので、
  「観察できるが画面の外」はテスト側の空の観察器で作る。寸法・rAF に依存する村(`src/components/VillagePage/`)は対象にしない
- 動きを控える設定でも、書き出した HTML と揃えた初回の描画ではリールが一度マウントされ、場面 SVG を取りに行く。
  テストは `fetch` を差し替えて外へ通信させない(差し替えないと happy-dom が `http://localhost:3000` へ接続しに行く)

## Alternatives Considered

- **jsdom** — 入れて比べていない。このテストは `matchMedia` と `IntersectionObserver` を自前で差し替え、DOM 実装に求めるのは
  要素の組み立て・イベントの伝播・`history.replaceState` によるハッシュの書き換えだけで、happy-dom でそれが足りることを確かめた
- **既定の環境を happy-dom にする** — 単体テストまで DOM のある環境で走り、書かれたときの前提(node)と変わる
- **E2E で見る** — 1分岐を見るたびに `npm run build` を待つことになる。E2E は実際の配置・操作に絞る
