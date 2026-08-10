// 作品(ja) — AIエージェント開発環境(ハーネス)。構築・配布・定着・課題までの記録
import type { Work } from '@/types/content'

export const aiHarness: Work = {
  slug: 'ai-harness',
  status: 'published',
  title: 'AIエージェント開発環境(ハーネス)',
  tagline: '同じ依頼を、いつも同じ結果へ。再現性を環境の設計で担保する',
  glyph: '検証',
  context: '技術アウトプット — 実務での自作ツール(社内配布・定着まで)',
  contextKind: 'work',
  period: '2026.02 - 現在',
  role: '設計・実装・社内配布(個人)',
  scale: 'フック25個 / eval 36ケース / 利用者4名 / 2か月でAIチーム自動実行105件',
  stack: ['Claude', 'Codex', 'Node.js', 'Bash', 'Git worktree', 'JSONL trace'],
  links: {
    live: 'https://j-paku.github.io/ai-harness/',
    repo: 'https://github.com/J-paku/ai-harness',
  },
  // カード用サムネイル。実機キャプチャは左端が切れて見えたため、デモのヒーローを1200×900で組み直した自作画像
  thumbnail: '/shots/ai-harness.png',
}
