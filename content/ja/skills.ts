// スキル(ja) — 列挙ではなく、各項目に根拠となる作品slugを紐づける
import type { SkillCategory } from '@/types/content'

export const skills: SkillCategory[] = [
  {
    category: '言語・型',
    items: [
      {
        name: 'TypeScript',
        evidence: ['seatmap-demo', 'ai-harness'],
        note: 'any/unknownを自主禁止し、3層のtypes配置規約を運用',
      },
      { name: 'JavaScript(ES2022+)', evidence: ['seatmap-demo', 'ai-harness'] },
      { name: 'Swift(SwiftUI / UIKit)', evidence: ['meishi-cross-platform'] },
    ],
  },
  {
    category: 'フレームワーク',
    items: [
      { name: 'React 19', evidence: ['seatmap-demo'] },
      { name: 'Next.js 16(Pages Router / 静的エクスポート)', evidence: ['seatmap-demo'] },
      { name: 'Nuxt.js / Vue', evidence: [], note: '前職で2年10か月。公開作品なし' },
      { name: 'Tauri', evidence: ['gatchanko'] },
    ],
  },
  {
    category: '状態・データ同期',
    items: [
      {
        name: '楽観的更新とロールバック',
        evidence: ['seatmap-demo'],
        note: 'バージョンベースの楽観的ロック、touched-id単位のundo衝突検証',
      },
      { name: 'SWR(増分同期・再検証設計)', evidence: ['seatmap-demo'] },
      { name: 'IndexedDB(オフライン永続化)', evidence: [], note: '社内アプリでスキーマv10まで運用。公開作品なし' },
    ],
  },
  {
    category: 'インタラクション・描画',
    items: [
      {
        name: 'ピンチズーム / 慣性パン',
        evidence: ['seatmap-demo'],
        note: 'アンカー基準ズーム、friction減衰、スプリングバウンス',
      },
      { name: '2段階ズームの描画アーキテクチャ', evidence: ['seatmap-demo'] },
      { name: 'ドラッグ&ドロップ / タップ判定の切り分け', evidence: ['seatmap-demo'] },
    ],
  },
  {
    category: 'クロスプラットフォーム',
    items: [
      { name: 'WKWebView ↔ JSブリッジ', evidence: ['meishi-cross-platform'] },
      { name: 'AVFoundation + Vision(矩形検出・自動撮影)', evidence: ['meishi-cross-platform'] },
      { name: 'BLE(モバイルプリンタ連携)', evidence: [], note: '社内アプリで実装。公開作品なし' },
    ],
  },
  {
    category: '開発環境・AIオーケストレーション',
    items: [
      {
        name: 'マルチエージェント・ハーネス設計',
        evidence: ['ai-harness'],
        note: 'フック25個、eval 36ケース、worktree隔離による並列実行',
      },
      { name: 'Git worktreeによる並列作業の隔離', evidence: ['ai-harness'] },
      { name: 'JSONL traceによる実行記録・自動採点', evidence: ['ai-harness'] },
    ],
  },
  {
    category: '品質・アクセシビリティ',
    items: [
      { name: 'pre-commitでの型・規約チェック(tsc / ESLint / knip)', evidence: ['ai-harness'] },
      {
        name: 'WCAG準拠のARIA・キーボード操作',
        evidence: ['seatmap-demo'],
        note: 'フォーカストラップと自動検証は未整備。このハブでCIゲート化して埋めている',
      },
      {
        name: 'Lighthouse CI / axeによる自動検証',
        evidence: [],
        note: 'このサイト自体のCIゲート。違反が1件でもあればデプロイが落ちる',
      },
    ],
  },
]
