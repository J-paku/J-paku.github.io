// 村マップ(日本語)の表示文言。地点の文言は spot.id で引く
import type { VillageText } from '@content/types/world'

export const village: VillageText = {
  intro:
    'フロントエンドエンジニア J-Paku のポートフォリオ。5 か所を歩いて回ると、私がどんな問題を解くのかが分かります。',
  promise: '1 分・5 か所・代表作 3 つ',
  hint: '矢印キー・WASD で移動、E で話す、M で地図',
  arriveAt: '{place}の前です。話を聞きますか?',
  exitHint: '下のマットに乗ると外に出られます。',
  headTo: '次は{place}。歩いて行ってみてください。',
  talk: '話を聞く',
  close: '閉じる',
  openMap: '地図を開く',
  mapTitle: '村の地図',
  closeMap: '地図を閉じる',
  fastTravel: '{place}へ移動',
  visitedOf: '{n} / {total} 訪問',
  skipVillage: 'マップを飛ばして作品一覧へ',
  shortcuts: '作品へ直接移動',
  toList: '一覧で見る',
  toVillage: 'マップで見る',
  buttonA: '決定',
  buttonB: 'キャンセル',
  joystick: '移動スティック',
  stops: {
    home: {
      place: 'PC',
      arrive: '机の PC がついています。開いてみますか?',
      talk: 'PC を開く',
      title: 'はじめまして。1 分だけ歩いてみませんか?',
      claim: '業務システムの UI を作り、モバイルの操作感と運用まで引き受けています。',
      proof:
        'プロダクトをつなぐ仕事、手になじむ UI、チームが繰り返せる環境。この 3 か所を順に案内します。',
      hook: 'まずは、カメラと Web をつないだ工房へ行きましょう。',
      next: '名刺工房へ',
      detail:
        'フロントエンドエンジニアの J-Paku です。画面を作って終わりにせず、実際の業務でどう使われ、どう保たれるかまで設計します。',
    },
    meishi: {
      place: '名刺工房',
      title: '撮った名刺が、チームのデータになるとしたら?',
      claim: 'iOS のカメラと Web の管理画面を、ひとつのアプリ体験としてつなぎました。',
      proof:
        '撮影 → 登録 → Web で管理。既存の管理画面を活かしながら、モバイルと Web の境界を設計した仕事です。',
      hook: '次は、指で直接扱う UI です。研究所でお見せします。',
      next: 'インタラクション研究所へ',
      detail:
        '名刺を撮影してデータにし、管理画面へつなぐ流れです。新しい画面を作るだけでなく、すでに動いていた Web と iOS の機能をどう接続するかに集中しました。',
      link: {
        label: '名刺アプリの話を読む',
        target: { kind: 'story', slug: 'meishi-cross-platform' },
      },
    },
    lab: {
      place: 'インタラクション研究所',
      title: '複雑な配置も、指先には自然に。',
      claim: '座席とチーム配置を、ピンチズーム・パン・直接操作で扱うマップを作りました。',
      proof: 'タッチ入力と描画を一緒に設計し、画面を指で扱う体験を仕事の中心に置きました。',
      hook: 'こういう仕事をチームでも繰り返せるようにするには? 最後の作業台へ行きましょう。',
      next: 'AI 作業台へ',
      detail:
        'オフィスの座席とチーム配置を扱うデモです。アンカー基準のピンチズーム、慣性パン、ズーム段階に応じた描画構成が要です。',
      link: {
        label: 'デモを開く',
        target: { kind: 'external', url: 'https://j-paku.github.io/seatmap-demo/' },
      },
    },
    bench: {
      place: 'AI 作業台',
      title: 'うまくいった 1 回を、チームで繰り返せる形に。',
      claim: 'AI 開発の再現性を、個人のコツではなく環境の設計で担保しようとしました。',
      proof:
        'フック・回帰検証・配布パッケージに加え、チームが実際に使うところまで導入を支援しました。',
      hook: 'プロダクト、操作感、チームの環境まで見ていただきました。広場で一度まとめましょう。',
      next: '出会いの広場へ',
      detail:
        '同じ依頼でも人や日によって結果が変わる問題から始まりました。規約を実行時に検査し、回帰検証で環境を確かめます。',
      link: {
        label: 'AI 開発基盤のページ',
        target: { kind: 'external', url: 'https://j-paku.github.io/ai-harness/' },
      },
    },
    plaza: {
      place: '出会いの広場',
      title: 'こんな問題を、一緒に解く人が必要ですか?',
      claim: 'プロダクトをつなぐ設計・手になじむ UI・チームで繰り返せる開発。',
      proof: '今必要な力に合う仕事を選んでさらに読むことも、そのまま連絡することもできます。',
      hook: 'ありがとうございました。気になる場所はもう一度どうぞ。話はここに残っています。',
      next: '全体の要約を見る',
      detail:
        '短い散策で見た 3 つの軸をまとめます。プロダクトとプラットフォームの接続、直接操作するインタラクション、品質を繰り返せる環境。',
      link: {
        label: 'メールで話す',
        target: { kind: 'external', url: 'mailto:pjhrecr@gmail.com' },
      },
    },
  },
}
