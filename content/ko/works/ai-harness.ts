// 作品(ko) — AIエージェント開発環境。jaと同じ7節・同じkeyを保つ
import type { Work } from '@/types/content'

export const aiHarness: Work = {
  slug: 'ai-harness',
  status: 'published',
  title: 'AI 에이전트 개발 환경(하네스)',
  tagline: '같은 의뢰를 언제나 같은 결과로. 재현성을 환경 설계로 담보한다',
  glyph: '検証',
  context: '기술 아웃풋 — 실무 자작 툴(사내 배포·정착까지)',
  contextKind: 'work',
  period: '2026.02 - 현재',
  role: '설계·구현·사내 배포(개인)',
  scale: '훅 25개 / eval 36케이스 / 이용자 4명 / 2개월간 AI팀 자동 실행 105건',
  stack: ['Claude', 'Codex', 'Node.js', 'Bash', 'Git worktree', 'JSONL trace'],
  links: {
    live: 'https://j-paku.github.io/ai-harness/',
    repo: 'https://github.com/J-paku/ai-harness',
  },
  // カード用サムネイル。fan-out 実行フローを文字なしで図解した自作SVG(seatmap と同じ視覚文法)
  thumbnail: '/shots/ai-harness.svg?v=3',
}
