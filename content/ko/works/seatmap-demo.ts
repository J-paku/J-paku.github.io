// 作品(ko) — 座席マップデモ。jaと同じ7節・同じkeyを保つ
import type { Work } from '@/types/content'

export const seatmapDemo: Work = {
  slug: 'seatmap-demo',
  status: 'published',
  title: '좌석 맵 데모',
  tagline: '오피스의 좌석과 팀 배치를, 손가락 조작 그대로 다룬다',
  glyph: '座席',
  context: '실무의 재구성 — 사내 좌석 관리 툴을 업무 데이터 없이',
  contextKind: 'work',
  period: '2026.07 - 2026.08',
  role: '설계·구현(개인)',
  scale: '주요 화면 3(맵 / 디렉터리 / 편집)· 데이터는 전부 목 JSON',
  stack: [
    'Next.js 16',
    'React 19',
    'TypeScript 5.7',
    'Tailwind CSS 4',
    'SWR',
    '@use-gesture/react',
    '정적 익스포트',
  ],
  links: {
    live: 'https://j-paku.github.io/seatmap-demo/',
    repo: 'https://github.com/J-paku/seatmap-demo',
  },
  // カード用サムネイル。実キャプチャは社内データ(氏名・連絡先)が写るため使えないので、
  // 主要3画面(座席マップ / 社員一覧 / 社員詳細)と拠点平面図を文字なしの図解へ起こした自作SVG
  thumbnail: '/shots/seatmap-demo.svg',
}
