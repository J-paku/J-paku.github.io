---
status: active
read_when:
  - axe が違反を出したとき
  - モーダル・トグル・装飾要素を足すとき
source_of_truth: true
last_reviewed: 2026-09-21
---

# アクセシビリティ

CI は配信物の全ルートに axe を当て、**WCAG 適合の違反 0 件**をゲートにしている(`scripts/check-a11y.mjs`)。
`best-practice` タグの指摘は別集計で、終了コードには反映しない。**ゲートになるタグの正本はそのスクリプト。**

## 守っていること

- **村を操作しなくても同じ内容に届く。** スキップリンク(`skipVillage`)と作品ショートカットを消さない
- 会話窓は `role='status'` + `aria-live='polite'`。更新を読み上げさせる
- モーダルは2通りある。作品ストーリーの場面モーダルは**ネイティブ `<dialog>` の `showModal()`**(フォーカストラップと背景の不活性化をブラウザが保証する)、村の会話・地図は `role='dialog'` の固定配置。**新しいモーダルを足すなら前者を選ぶ**
  - 例外は**村の枠の中に収める窓**。村の会話・地図に加えて**卓上時計の設定窓(`ClockModal`)**も `role='dialog'` の手製トラップで作る —
    枠の中に収めて操作帯(`--band`)を覆わない要件があり、top layer へ出る `showModal()` では満たせないため
- 自動再生・ループするモーションには停止トグルを付ける(WCAG 2.2.2)。`aria-pressed` で状態を出すのではなく**ラベルそのものを入れ替える**(`ui.work.pauseMotion` / `resumeMotion`)
- `prefers-reduced-motion` で動きを止める。村では歩行コマのアニメーションも止まる

## 落とし穴

- **`aria-hidden` を付けても色コントラスト検査は逃れられない。** 支援技術から隠れるだけで、画面には見えているため。情報を持たない装飾文字は要素にせず**疑似要素で描く**(`content: attr(data-glyph)`。作品カードの背景グリフがその実例)
- コントラストは**実際に重なる組み合わせ**で測る。`tokens.css` のコメントに実測値が入っているので、色を変えたら同じ形で測り直して書き換える
- `role='button'` を既存のリンクやカードに足すと `nested-interactive`(wcag2a)に触れることがある。キーボードの等価経路がすでにあるなら、role を足さずコメントで理由を残す

## 走らせ方

`npm run build && npm run start` で配信してから `scripts/check-a11y.mjs` を走らせる。
引数のパス列は [../operations/deployment.md](../operations/deployment.md) の実行例(= `.github/workflows/deploy.yml`)をそのまま使う。

**ルートを消したらこの引数列からも消す** —
消し忘れると、静的配信では 404 を測って落ち、SPA 的なフォールバックがある環境では別の画面を測って通ってしまう。
