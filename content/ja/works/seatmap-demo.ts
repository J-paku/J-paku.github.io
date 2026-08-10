// 作品(ja) — 座席マップデモ。社内ツールを業務データ抜きで再構成した公開デモ
import type { Work } from '@/types/content'

export const seatmapDemo: Work = {
  slug: 'seatmap-demo',
  status: 'published',
  title: '座席マップデモ',
  tagline: 'オフィスの座席とチーム配置を、指の操作でそのまま扱う',
  glyph: '座席',
  context: '実務の再構成 — 社内座席管理ツールを業務データ抜きで',
  contextKind: 'work',
  period: '2026.07 - 2026.08',
  role: '設計・実装(個人)',
  scale: '主要画面3(マップ / ディレクトリ / 編集)・データはすべてモックJSON',
  stack: [
    'Next.js 16',
    'React 19',
    'TypeScript 5.7',
    'Tailwind CSS 4',
    'SWR',
    '@use-gesture/react',
    '静的エクスポート',
  ],
  links: {
    live: 'https://j-paku.github.io/seatmap-demo/',
    repo: 'https://github.com/J-paku/seatmap-demo',
  },
  // カード用サムネイル。実キャプチャは社内データ(氏名・連絡先)が写るため使えないので、
  // 主要3画面(座席マップ / 社員一覧 / 社員詳細)と拠点平面図を文字なしの図解へ起こした自作SVG
  thumbnail: '/shots/seatmap-demo.svg',
}
