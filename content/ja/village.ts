// 村マップ(日本語)の表示文言。地点の文言はspot.idで引く
import type { VillageText } from '@content/types/world'

export const village: VillageText = {
  intro:
    'フロントエンド / プロダクトエンジニアJ-Pakuのポートフォリオ。5か所を歩いて回ると、私がどんな問題を解くのかが分かります。',
  promise: '1分・5か所・代表作3つ',
  hint: '矢印キー・WASDで移動、Eで話す、Mで地図',
  hintTouch: 'スティックで移動、Aで話す、右下の地図をタップで移動',
  noTarget: '近くに話せる相手がいない。扉や建物を探してみよう',
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
  toList: '作品一覧へ',
  toVillage: 'マップで見る',
  allSeen: '5か所すべて見ました。「{list}」から作品をもう一度たどれます。',
  buttonA: '決定',
  buttonB: 'キャンセル',
  joystick: '移動スティック',
  stops: {
    home: {
      place: 'PC',
      arrive: '机のPCがついています。開いてみますか?',
      talk: 'PCを開く',
      title: 'Frontend / Product Engineer',
      claim: '会社の業務システムを、Webとアプリの両方で開発しています。',
      proof:
        '設計から実装、リリース後の運用まで一貫して担当しています。iOS連携や、モバイルならではの操作性も含めて設計・実装しています。',
      hook: 'まずは、「名刺工房」を見てみてください。',
      next: '名刺工房へ',
      detail:
        '現在の業務アプリは、全社200名以上が利用しています。入社9か月でチームリーダーになりました。',
    },
    meishi: {
      place: '名刺工房',
      title: 'iOSのカメラで、名刺を撮る',
      claim: 'iOSのカメラで名刺を撮影し、その場でデータ化できるアプリを作りました。',
      proof:
        '撮影機能はAVFoundationとVisionを使って実装し、読み取った文字情報の整理にはGeminiを利用しています。既存のWeb管理画面はWKWebViewでそのまま活用しました。',
      hook: '次は、指で触れて動かす画面です。',
      next: 'インタラクション研究所へ',
      detail:
        '部門ごとに分かれていた得意先データも、全社共通のマスタに統合しました。初回リリース後も継続して機能追加を行っています。',
      link: {
        label: '名刺アプリの話を読む',
        target: { kind: 'story', slug: 'meishi-cross-platform' },
      },
    },
    lab: {
      place: 'インタラクション研究所',
      title: '指で動かす座席マップ',
      claim: '座席やチームの配置を、指で直接動かしながら確認できる座席マップを作りました。',
      proof:
        'アンカーを基準にしたピンチズームや慣性スクロールを実装し、@use-gesture/reactと描画方式の切り替えを組み合わせています。',
      hook: '次は、AIロボに会ってみてください。',
      next: 'AIロボへ',
      detail:
        '開発中には、iOS版で縮小時にアプリが落ちる問題も発見しました。原因はメモリ不足で、限界に達する前にズームを制御することで解消しました。',
      link: {
        label: 'デモを開く',
        target: { kind: 'external', url: 'https://j-paku.github.io/seatmap-demo/' },
      },
    },
    robot: {
      place: 'AIロボ',
      title: 'AI開発の結果を、ぶらさない仕組み',
      claim: '同じ依頼から、できるだけ同じ品質の結果を出せるAI開発環境を作りました。',
      proof:
        'AIの行動を制御するフックを25個用意し、evalで仕組みそのものを継続的に検証して回帰を防いでいます。環境の設計・実装だけでなく、チームへの導入と運用まで担当しました。',
      hook: '最後に、ポストへ寄ってみてください。',
      next: 'ポストへ',
      detail:
        '導入2か月で、チームのコード追加行数は約4倍になりました。AIチームが自動で完了した作業のうち、87.6%は人の手直しなしで完了しています。',
      link: {
        label: 'AI開発基盤のページ',
        target: { kind: 'external', url: 'https://j-paku.github.io/ai-harness/' },
      },
    },
    mailbox: {
      place: 'ポスト',
      title: '気軽にご連絡ください',
      claim:
        'ここまで、業務システムをつなぐ設計、指で直感的に扱えるUI、そしてチームで繰り返し使える開発環境を紹介してきました。',
      proof: '少し話を聞いてみたい方も、開発について相談したい方も、気軽にご連絡ください。',
      hook: 'ありがとうございました。気になる場所には、地図からいつでも戻れます。',
      next: '全体の要約を見る',
      detail: 'メールはこちらです。pjhrecr@gmail.com',
      link: {
        label: 'メールを書く',
        target: { kind: 'external', url: 'mailto:pjhrecr@gmail.com' },
      },
    },
    journey: {
      place: '次の旅',
      title: '次の旅は、まだ決まっていません。',
      claim: '次の旅を、ご一緒しませんか？',
      proof: '新しいチームと、ともに取り組む課題に出会いたいと思っています。',
      detail: '一緒に作りたいものがあれば、気軽にご連絡ください。',
      hook: 'この道の先の物語を、一緒につないでいきましょう。',
      next: '作品一覧を見る',
      link: {
        label: '次の旅について話す',
        target: { kind: 'external', url: 'mailto:pjhrecr@gmail.com' },
      },
    },
    monument: {
      place: '経歴碑',
      title: 'これまでの道',
      claim: '2022年から2社で、社内システムのフロントエンドを作ってきました。',
      entries: [
        {
          logo: '/logos/koyama.png',
          company: '小山株式会社',
          period: '2025.01 - 現在',
          body: '社内業務スーパーアプリのWeb全域とiOSを担当。入社9か月でWeb開発チームリーダー',
        },
        {
          logo: '/logos/meitec-fielders.png',
          company: 'メイテックフィルダーズ',
          period: '2022.04 - 2024.12',
          body: '派遣先2社の情報システム部門で、Nuxt.jsのSPA新規構築とSharePointの運用・自動化',
        },
      ],
      proof: '前半は派遣先の情報システム部門で、今は商社の社内開発チームでリーダーをしています。',
      hook: '気になる作品は地図からいつでも戻れます。',
      next: '作品一覧へ',
      detail: 'それぞれの現場で何を作ったかは、作品一覧のプロフィールに続いています。',
      talk: '読む',
    },
  },
}
