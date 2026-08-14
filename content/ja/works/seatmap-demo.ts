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
  // 詳細ページ用。設計で迷った3点と、原本構成・データフロー・保存シーケンスの図解文言
  detail: {
    cases: [
      {
        challenge: '数百席をDOMに常時置くとパンズームの再描画が重く、置かなければ座席へ到達する手段が無い',
        decision: '変換レイヤーには通路・区画だけを置き、個人の座席はsr-onlyミラーレイヤーのボタンへ分離',
        reason: '描画コストと支援技術での到達可能性を同時に満たすため',
      },
      {
        challenge: 'キャッシュの手動バージョン定数は更新を忘れる。実際に古いキャッシュを読み続ける事故を起こした',
        decision: 'キャッシュ値にシードデータのハッシュ(指紋)を同梱し、データが変われば自動でキャッシュミスにする',
        reason: '無効化を人の記憶ではなく構造に保証させるため',
      },
      {
        challenge: '「会議室の二重予約が無い」はデータ側の条件で、型検査でも画面確認でも検出できない',
        decision: '画面・データ・配布物を見る3つの検証スクリプトを用意し、GitHub Pagesの配信版でも同じものを走らせる',
        reason: 'ローカルのPASSだけを完了と呼ばないため',
      },
    ],
    diagrams: {
      architecture: {
        title: '原本の構成',
        caption:
          '社内限定のGaroonを社外に開かず、Akamaiリバースプロキシ+Pleasanterのサーバー間APIで参照する経路。本デモはバックエンドを持たず、mock JSONでクライアント側のみ完結する。',
        labels: {
          browser: 'ブラウザ',
          iosApp: 'iOSアプリ',
          akamai: 'Akamaiプロキシ',
          pleasanter: 'Pleasanter',
          garoon: 'Garoon',
          serverToServer: 'サーバー間API',
          internalZone: '社内限定',
          demoNote: 'デモはmock JSON',
        },
      },
      dataflow: {
        title: 'デモ版のデータフロー',
        caption: '静的JSONを遅延レスポンスでAPI風に扱い、編集分はlocalStorageへ書き戻る循環構成。',
        labels: {
          mocks: 'mock JSON',
          fetchMock: '遅延レスポンス',
          swrCache: 'SWRキャッシュ',
          screenMap: '座席マップ',
          screenDirectory: 'ディレクトリ',
          screenEdit: '編集',
          storage: 'localStorage',
        },
      },
      sequence: {
        title: 'ドラッグ編集→保存シーケンス',
        caption: 'ゴーストプレビューと楽観ロックを経て、保存結果が画面へ反映される順序。',
        labels: {
          actorUser: 'ユーザー',
          actorEditor: '編集セッション',
          actorStore: '保存部',
          actorCache: 'SWRキャッシュ',
          msgDrag: 'ドラッグ',
          msgGhost: 'ゴースト表示',
          msgDrop: 'ドロップ',
          msgLockCheck: 'ロック照会',
          msgSaved: 'saved',
          msgBlocked: 'blocked',
          msgConflict: 'conflict破棄',
          msgRevalidate: 'キャッシュ更新',
          msgRender: '画面反映',
        },
      },
    },
  },
}
