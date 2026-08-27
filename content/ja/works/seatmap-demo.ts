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
  role: '設計・実装',
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
  video: '/shots/seatmap-demo-live.mp4',
  // 詳細ページ用。WKWebViewが起こしたクラッシュの原因調査と、着手の動機を語る2節
  detail: {
    sections: [
      {
        id: 'wkwebview-crash',
        title: '落ちる原因を、測って突き止める',
        paragraphs: [
          '原本のiOS版(Swift)は、座席マップのWeb画面をWKWebViewで表示している。運用でいちばん手を焼いたのは、マップを縮小するとアプリごと落ちる不具合で、コードを追っても原因が見えなかった。',
          '決め手はXcodeのデバッグでプロセスのリソースを見ることだった。縮小するほど表示範囲が広がってWKWebViewのメモリが跳ね上がり、あるところでプロセスごと強制終了されていた。',
          '修正も実測から組み立てた。落ちる縮小率を測り、そこへ届く前で止まるズームの下限を設けた。モバイルもPCも同じ制限にしている。',
        ],
      },
      {
        id: 'why-built',
        title: 'なぜ作ったか',
        paragraphs: [
          '外出先で電話をかけようとして、手が止まる。相手は会議中かもしれない。確かめるには、PC表示のまま運用されていたGaroonのスケジュール画面をスマートフォンで拡大しながら読み、別の座席表と頭の中で突き合わせるしかなかった。新人には、その課長がどの席の誰なのかを調べる手段そのものが無い。電話帳への登録は担当者のVBA作業待ちだった。',
          '「かける前に、相手の今がわかる」画面が1つあれば、この往復は全部消える。座席・役職・予定を1画面に集めたのが、このツールになった。',
        ],
      },
    ],
  },
}
