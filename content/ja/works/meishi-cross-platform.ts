// 作品(ja) — 名刺登録アプリ(名刺管理のクロスプラットフォーム化)。公開済み。ストーリー本文(story)を保持
import type { Work } from '@/types/content'

export const meishiCrossPlatform: Work = {
  slug: 'meishi-cross-platform',
  status: 'published',
  title: '名刺登録アプリ',
  tagline: 'iOSのカメラで名刺を撮り、Webの管理画面と1つのアプリとして繋ぐ',
  glyph: '名刺',
  context: '実務の進行中案件 — 名刺管理のiOS化',
  contextKind: 'work',
  role: '設計・実装・リリース',
  stack: ['Swift', 'AVFoundation', 'Vision', 'WKWebView', 'React'],
  links: {},
  // カード用サムネイル。story場面4つ(カメラ撮影・その場で登録・Web統合・拠点距離)を
  // 文字なしの図解へ起こした自作SVG
  thumbnail: '/shots/meishi-cross-platform.svg',
  story: {
    intro: {
      title: '名刺登録アプリ',
      lead: '紙の名刺を、かざすだけでデータへ。iOSネイティブのカメラと既存のWeb管理画面を、1つのアプリとして繋ぐ。',
    },
    scenes: [
      {
        id: 'camera',
        title: '「かざすだけで撮れる」を自前で組む',
        body: 'UIImagePickerControllerに頼らず、AVCaptureSessionでカメラを直接制御。Visionの矩形検出で名刺の輪郭をリアルタイムに追い、枠が安定した瞬間に自動でシャッターを切る。',
        chips: [
          { name: 'AVFoundation', note: 'プレビュー・露出・シャッターまでAVCaptureSessionで直接制御' },
          { name: 'Vision', note: '矩形検出で名刺の輪郭をリアルタイムに追跡' },
          { name: 'Swift', note: '検出の安定判定と自動撮影の状態管理' },
        ],
        image: '/works/meishi/scene1-camera.svg',
      },
      {
        id: 'register',
        title: '撮った名刺が、その場でデータになる',
        body: '撮影した名刺はその場で確認して登録フォームへ。カメラから保存までがアプリの中で途切れない。',
        chips: [
          { name: 'Swift', note: '撮影から登録までの画面遷移と状態管理' },
        ],
        image: '/works/meishi/scene2-register.svg',
      },
      {
        id: 'web',
        title: '動いている管理画面は、作り直さない',
        body: '既存のReact製Web管理画面をWKWebViewでアプリへ統合。ネイティブの撮影体験とWebの管理機能が、1つのアプリとして繋がる。',
        chips: [
          { name: 'WKWebView', note: 'ネイティブとWebの橋渡し。既存資産をそのまま活かす' },
          { name: 'React', note: '管理画面は既存のReact実装を継続利用' },
        ],
        image: '/works/meishi/scene3-web.svg',
      },
      {
        id: 'nearby',
        title: '名刺を、会社共通の資産に変える',
        body: '住所はYahoo!ジオコーダで緯度経度に変換し、いま居る場所から得意先までの距離を表示。部門ごとに分かれていた得意先マスタは会社共通の新マスタへ統合し、既存の参照は名称の正規化で繋いだ。',
        chips: [
          { name: 'Yahoo!ジオコーダ', note: '住所→緯度経度の変換と、現在地からの距離算出' },
          { name: 'データ設計', note: '部門別マスタを共通マスタへ統合。既存参照は名称正規化で接続' },
        ],
        image: '/works/meishi/scene4-nearby.svg',
      },
    ],
    outro: {
      title: '境界を設計するクロスプラットフォーム',
      body: 'ネイティブでしか出来ない体験はSwiftで作り、既に動いているWebはそのまま活かす。どこに境界を引くかまで含めて設計した構成。開発は現在も進行中。',
      stackSummary: [
        { name: 'Swift', note: 'カメラ・登録フローのネイティブ実装' },
        { name: 'AVFoundation', note: 'カメラ制御' },
        { name: 'Vision', note: '矩形検出' },
        { name: 'WKWebView', note: 'Web統合の橋渡し' },
        { name: 'React', note: '既存管理画面の継続利用' },
        { name: 'Yahoo!ジオコーダ', note: '距離表示の基盤' },
      ],
    },
  },
}
