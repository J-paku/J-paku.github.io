---
status: historical
read_when:
  - happy-dom で見るテストの対象を広げる・狭めるとき
  - 村のフックや部品を happy-dom のテストで見てよいか迷ったとき
source_of_truth: false
last_reviewed: 2026-10-01
---

# 0009. happy-dom で見るテストを、props・操作で分かれる部品、DOM を使う utils、寸法・rAF の実物に頼らない村のフック・部品へ広げる

## Status

Accepted(2026-09-29、`148a540`・`532f480`・`00326c0`・`69b92e0`・`11764fc`。今の層の分け方は`60750cf`が [../quality/test-strategy.md](../quality/test-strategy.md) に書いた)。[0007](0007-component-tests-happy-dom.md) の対象の決め方を置き換える

## Context

[0007](0007-component-tests-happy-dom.md) は happy-dom の統合テストを足したとき、対象を**環境で分かれる出し分け**だけに絞り、
寸法・rAF に依存する村(`src/components/VillagePage/`)は対象にしないとした。そのときの対象は作品カード
(`src/components/Directory/components/WorkCard/index.test.tsx`)1つだった。

2026-09-29 に、happy-dom で走るテストを5つのコミットで足した。

- `148a540` — 作品カードの部品(LinksOverlay・WorkLinks・ShotMedia)・経歴(CareerDetail)・設定メニュー(SettingsMenu)の隣に `index.test.tsx` を置き54件。
  本文は「対象は条件分岐の数を数えて多い順に選び、村は対象にしない(寸法と rAF に依存するため)」。
  各ファイルの見出しが見るとしている分岐は、環境(動きの有無・ポインタの種類)だけでなく、作品・経歴が持つ項目(リンクの種類・手順や技術スタックの有無)と、
  操作(開閉・Esc・外側の押下・テーマ選択)で分かれる表示を含む
- `532f480` — 村のフック3つ(`src/components/VillagePage/components/Village/hooks/use-map-data.ts`・`src/components/VillagePage/components/Village/hooks/use-village-world.ts`・
  `src/components/VillagePage/components/Village/hooks/use-village-overlay/use-village-travel.ts`)を `renderHook` で25件。
  本文は「選んだ基準は、本文が DOM・rAF・タイマー・保存に触れず、引数と runtime の ref・コールバックの結果だけで確かめられること」
- `00326c0` — 村の歩行ループの部品(`src/components/VillagePage/components/Village/utils/walk-loop/`)に78件。
  本文は「DOM へ直接書く部品は happy-dom で(中略)見る。rAF と performance.now は差し替えて決定的に回す」
- `69b92e0` — 村の組み立て・地図・操作帯・会話などの utils 17ファイルに166件。happy-dom で走るのはそのうち3ファイル
  (`src/components/VillagePage/components/Village/utils/focusables.test.ts`・`src/components/VillagePage/utils/phase-init.test.ts`・
  `src/components/VillagePage/components/Village/components/WorldMap/utils/arrange-badges.test.ts`)。
  本文は「DOM に触れる focusables・phase-init・arrange-badges だけ happy-dom。happy-dom は配置を計算しないので、arrange-badges は getBoundingClientRect を差し替えて寸法を与える」
- `11764fc` — 共通(`src/utils/`)と作品カードの utils 6ファイルに58件。本文は「linkedom-browser-stub だけ happy-dom、ほかは node」。
  `src/utils/linkedom-browser-stub.test.ts`の見出しは「budouxがlinkedomから取り出す名前をすべて持ち、中身がブラウザ標準のDOMParserであることを見る」

5件の本文は、何を選びどう確かめたかを書いているが、範囲を広げることにした理由は書いていない。
同じ日の`60750cf`が [../quality/test-strategy.md](../quality/test-strategy.md) へ「単体に happy-dom で回るもの(DOM に書く utils・renderHook のフック)があること、統合の対象が 6 部品になったこと」を反映した。

## Decision

happy-dom で見るテストの対象を、0007 の「環境で分かれる出し分けだけ」から次のとおり広げる。
既定の環境は node のままで、DOM が要るファイルだけが先頭の `// @vitest-environment happy-dom` で切り替えるのは 0007 と同じ。

- **コンポーネントを描く統合テスト** — 環境に加えて、**props・操作で分かれる出し分け**も対象にする。部品は条件分岐の数が多い順に選ぶ(`148a540`)。
  確かめるのが利用者に見えるもの(role・`aria-*`・名前・要素の有無)であること、環境は `vi.stubGlobal`・`fetch` は差し替え・実データは `readContent` から条件で選ぶことは作品カードと同じ
- **村のフック** — 本文が DOM・rAF・タイマー・保存に触れず、引数と runtime の ref・コールバックの結果だけで確かめられるフックを、`renderHook` で呼ぶ(`532f480`)。
  層は単体で、置き場はフックの隣の `*.test.ts`
- **村の DOM へ書く部品** — 歩行ループの部品は、書いた transform・属性・印の値を happy-dom で見る。rAF と `performance.now` は差し替えて決定的に回す(`00326c0`)。層は単体
- **DOM を読む・書く・DOMParser を使う utils(村の外の `src/utils/` を含む)** — 村の`focusables`・`phase-init`・`arrange-badges`(`69b92e0`)と、
  `src/utils/`の`linkedom-browser-stub`(`11764fc`)。同じコミットで足したほかの utils は node のまま。
  層は単体で、置き場は対象の隣の `*.test.ts`
- **村のコンポーネントを描く統合テストは引き続き作らない**(`148a540` の本文「村は対象にしない(寸法と rAF に依存するため)」)

## Consequences

- 0007 の「寸法・rAF に依存する村は対象にしない」は、村のコンポーネントを描く統合テストに限った決まりになった。
  村のフック・歩行ループの部品・村の utils のテストは、寸法と rAF の実物に触れない形でこれを避けている。
  - `renderHook` のテストは、歩行ループを起こす口(runtime の `wake`)を `vi.fn()` にし、
    「歩行ループは起こされたことだけを見て、実際には歩かせない」(`src/components/VillagePage/components/Village/hooks/use-village-overlay/use-village-travel.test.ts` の見出し)
  - DOM のイベントとフォーカスを本体に持つフック(`use-links-overlay`・`use-menu-open`・`use-modal-focus`)は「本体が DOM のイベントとフォーカスなので外した」(`532f480`)
  - 歩行ループの部品のテストは、rAF を「頼まれたフレームを溜めるだけの偽物」に替えてテストが時刻を渡して回す
    (`src/components/VillagePage/components/Village/utils/walk-loop/create-animation-loop.test.ts` の見出し)。
    happy-dom が配置を計算しない(`clientWidth` が 0)ことは、枠の幅を覚えた値かスパイで渡して避ける
    (`src/components/VillagePage/components/Village/utils/walk-loop/paint-camera.test.ts` の見出し)
  - 村の utils で寸法を読む arrange-badges は、`getBoundingClientRect` を差し替えて寸法を与える(`69b92e0`)
- 単体の層にも happy-dom で走るファイル(DOM を使う utils・歩行ループの部品・`renderHook` のフック)ができた。DOM を持たない node が既定であることは変わらない。層の分け方の正本は [../quality/test-strategy.md](../quality/test-strategy.md)
- リンクを出す部品を描くようになり、`next/link` が末尾スラッシュをビルド時の環境変数で受け取ることに合わせて、
  `vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')` で配信物と同じ href を見ている(`148a540`)
- 5件とも、対象を一度壊して落ちることを確かめてから採った(各本文)

## Alternatives Considered

- **村のコンポーネントも統合テストで描く** — `148a540` の本文が「寸法と rAF に依存するため」対象にしないと書いており、0007 と同じ理由で採っていない
- ほかに比べた案の記録は無い
