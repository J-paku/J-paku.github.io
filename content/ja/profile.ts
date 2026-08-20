// プロフィール(ja) — 名前・ポジショニング・経歴・強み3点
import type { Profile } from '@/types/content'

export const profile: Profile = {
  name: 'J-Paku',
  role: 'フロントエンド',
  scope: ['Web', 'iOS', '業務アプリ基盤', 'DB'],
  headline: '業務システムのUIを、モバイルの操作感まで設計し運用まで持つ',
  location: '大阪',
  goal: 'UI/UXをほぼ全て自分で設計してきたが、その判断が本当に良いのかを検証する手段がない。反論が返ってくる環境で、自分の設計判断の精度を上げたい。',
  links: {
    github: 'https://github.com/J-paku',
    email: 'pjhrecr@gmail.com',
  },
  careers: [
    {
      id: 'current',
      // ※社名は非公開とし、業種表記にしている。公開して問題なければこの行を差し替える
      company: '医療・介護用品商社(社内システム開発)',
      period: '2025.01 - 現在',
      stack: ['Next.js', 'React', 'TypeScript', 'Swift', 'Claude'],
      role: 'Web開発チームリーダー(メンバー4名 + テスター1名)',
      summary:
        '社内業務システムのフロントエンド全域を設計・実装。入社9か月でチームリーダー。Web・iOSの両方を1人で横断している。',
      highlights: [
        '基幹データをPleasanterへ移行した上で、業務フローの聞き取りとデータ構造に合わせて再構築',
        '座席マップ・名刺管理・帳票などの社内アプリを、状態同期と描画設計から自力で構築',
        '会社として前例のなかったSwift/iOSを導入し、Apple Enterpriseプログラムを開設',
        'AIエージェント開発環境(ハーネス)を自作し、チームへ配布・定着まで担当',
        '設計規約を文書化し、hookで機械的に強制する運用へ切り替え',
      ],
      detail: {
        overview: {
          title: '社内業務スーパーアプリ',
          body: '現場の業務をiPhone1台で回す。機能を足し続ける社内配布型アプリ。',
          meta: '2025.06着手 · 2025.12本運用 · 運用中(14か月)',
        },
        origin: {
          heading: 'アプリの骨格を作った最初の機能 — 登園セット',
          lead: '幼稚園に消耗品を納品するサービス',
          flow: [
            { label: '移動' },
            { label: '納品' },
            { label: 'アプリ起動' },
            { label: '位置情報で取引先を自動判定', emphasis: true },
            { label: '納品入力' },
            { label: 'サーマルプリンターで納品書を実印刷', emphasis: true },
            { label: '貼って次へ' },
          ],
          note: '蓄積したデータは事業分析につながる。',
        },
        core: {
          claim: 'この機能を作る中で、アプリ全体の構成が決まった。',
          body: '2025.06にPWAで着手し、2025.07に撤回。SafariがWeb Bluetooth APIに対応していなかった。Web UIはそのままWKWebViewに載せ、通信部だけをネイティブ側に切り出した。この構成がその後の全機能の土台になった。',
        },
        facts: [
          {
            label: '構成',
            value: 'Next.js Web UI / WKWebView / BLEプリンターSDK(ネイティブ) / Pleasanter API / Microsoft Intune',
          },
          {
            label: '担当範囲',
            value: '課題定義 · 設計 · 実装 · 配布基盤の整備 · 運用 · 改善',
          },
          {
            label: '通信量',
            value: '納品画面が受け取っていたAPI応答が220KB → 1.2KB。サーバー負荷が下がり、アプリの反応も速くなった',
          },
          {
            label: '印刷速度',
            value: '納品登録の操作から納品書の印刷完了まで2秒以内',
          },
          {
            label: '機材',
            value: 'Windowsタブレットが、セットで使っていたサーマルプリンターごと不要になった。180gのBLEプリンター1台で現場が回る',
          },
          {
            label: '初めて',
            value: 'React、Swift — アプリ全体が、この2つにとって初の実戦だった',
          },
        ],
        features: {
          heading: '機能一覧',
          lead: '着手基準 / リリースは本番反映基準',
          items: [
            {
              date: '2025.06',
              name: '登園セット',
              tech: ['BLE SDK', 'WKWebView'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2025.10',
              name: 'クレーム報告',
              tech: ['REST'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2025.10',
              name: 'AI営業日報',
              tech: ['REST'],
              roles: ['design', 'release'],
            },
            {
              date: '2026.01',
              name: 'レターパック在庫管理',
              tech: ['QR'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2026.03',
              name: '定期配送管理',
              tech: ['.NETレガシー移管'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2026.04',
              name: '名刺管理',
              tech: ['Gemini', 'AVFoundation'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2026.06',
              name: 'Garoon連携 社員マップ',
              tech: ['SOAP / REST', 'リバースプロキシ'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2026.07',
              name: 'ボイスレコードAI要約',
              tech: ['Share Extension', 'App Group'],
              roles: ['design', 'build'],
            },
            {
              date: '2026.08',
              name: 'ログ分析ページ',
              tech: ['Recharts', 'JSONL'],
              roles: ['design', 'build', 'release'],
            },
          ],
        },
        asides: {
          heading: 'アプリの外でやったこと',
          items: [
            {
              title: '破壊的操作をhookで遮断',
              body: 'reset --hard · stash · cleanは実行前に止め、判断を人に返す。規約違反もコミット前に検出する。',
            },
            {
              title: 'AIエージェント開発環境の自作',
              body: 'メンバー4名へ配布し、定着まで伴走した。導入から2か月で、チームのコード追加行数は15,811行から63,307行へ約4倍になった。',
            },
            {
              title: 'Power BIで事業指標を可視化',
              body: 'Microsoft SQL Serverから業務データを取り出してダッシュボードにした。アプリが貯めたデータがここへ来る。',
            },
            {
              title: 'Web開発チームリーダー',
              body: '2025.10から。メンバー4名 + テスター1名で、WebとiOSの両方を見る。',
            },
          ],
        },
      },
    },
    {
      id: 'spa-migration',
      // ※在籍は1社(受託開発会社)で、その中の派遣先ごとに分けている。社名は双方とも非公開
      // ※入社・退社月は要確認。在籍2年10か月
      company: '受託開発会社に在籍 — 派遣先: システム開発会社',
      period: '2023.10 - 2024.12',
      stack: ['Nuxt.js', 'Vue.js', 'Delphi', 'Oracle', 'PostgreSQL'],
      role: 'フロントエンドエンジニア',
      summary:
        'SPA新規構築とレガシー基幹システムの移行を担当。AI補助のない環境で、ブラウザ挙動と非同期制御の基礎をここで作った。',
      highlights: [
        'Nuxt.jsによる在庫システムの新規構築。既存システムの動作のみを見て作り直すbehavior parity方式',
        'Delphi製レガシー基幹システムのOracle → PostgreSQL移行。方言差を吸収しながら等価性を担保。主はSPA側で、こちらはサブプロジェクト',
        '※DB層の置き換えであり、UIフレームワークの置き換え・新旧共存は未経験',
      ],
      detail: {
        overview: {
          title: '部品在庫管理システムの新規構築とデータベース移行',
          body: '派遣先の情報システム部門で、Nuxt.jsによる在庫管理システムの新規構築と、Delphi製レガシー基幹システムのデータベース移行を担当した。',
          meta: '2023.10 - 2024.12 · 派遣先の情報システム部門',
        },
        core: {
          claim: 'ソースを読めない前提でも、挙動が同じなら作り直せる。',
          body: '既存システムのソースコードを参照できない状況で、画面の挙動だけを観察して仕様を起こし、同等に動作するSPAを構築した(behavior parity方式)。',
        },
        facts: [
          {
            label: '構成',
            value: 'Nuxt.js / Vue.js / Oracle / PostgreSQL / Delphi',
          },
          {
            label: '担当範囲',
            value: 'SPAの新規構築(主) / データベース移行(サブプロジェクト)',
          },
          {
            label: '移行',
            value: 'Oracle → PostgreSQL。SQL方言の差を吸収しながら、データの等価性を検証して担保した',
          },
          {
            label: '前提',
            value: '既存システムのソースコードは参照できなかった。画面の挙動だけが仕様の出どころだった',
          },
          {
            label: '回帰',
            value: '仕様書が無く挙動だけが正だったため、修正が別機能の回帰を生みやすかった。修正の前に検証手段を先に用意する進め方は、この環境で身についた。',
          },
          {
            label: '注記',
            value: 'DB層の置き換えであり、UIフレームワークの置き換え・新旧共存は未経験',
          },
        ],
      },
    },
    {
      id: 'infra-automation',
      company: '受託開発会社に在籍 — 派遣先: 事業会社の情報システム部門',
      period: '2022.04 - 2023.09',
      stack: ['SharePoint', 'Power Automate'],
      role: '社内情報基盤の運用・業務自動化',
      summary:
        '社内情報基盤の運用と、業務フローの自動化を担当。SharePointとPower Automateが中心で、SPAの開発はこの期間には含まれない。',
      highlights: [
        'SharePointの運用と、Power Automateによる社内業務フローの自動化',
        '※この期間はSPA開発を含まない。SPAは次の派遣先から',
      ],
      detail: {
        overview: {
          title: '社内情報基盤の運用と申請・承認フローの自動化',
          body: '派遣先の情報システム部門で、SharePointによる社内情報基盤の運用と、Power Automateを用いた申請・承認フローの自動化を担当した。',
          meta: '2022.04 - 2023.09 · 派遣先の情報システム部門',
        },
        core: {
          claim: '手作業で回っていた申請フローを、棚卸しから作り直した。',
          body: '既存フローの棚卸しから入り、どの承認が何のために要るのかを整理したうえで自動化した。',
        },
        facts: [
          {
            label: '構成',
            value: 'SharePoint / Power Automate',
          },
          {
            label: '担当範囲',
            value: '社内情報基盤の運用 · 申請承認フローの自動化',
          },
          {
            label: '注記',
            value: 'この期間はSPA開発を含まない。SPAは次の派遣先から',
          },
        ],
      },
    },
  ],
  strengths: [
    {
      title: '状態同期の設計',
      body: 'バージョンベースの楽観的ロック、楽観的更新とロールバック、touched-id単位のundo衝突検証。複数端末から同じデータを触る前提で、壊れない同期の形を自分で決めてきた。',
    },
    {
      title: 'タッチインタラクションと描画設計',
      body: 'アンカー基準のピンチズーム、慣性パン、2段階ズームで描画対象そのものを切り替えるアーキテクチャ。指で触って成立するかを基準に、描画とイベントの構造を組む。',
    },
    {
      title: '品質を環境で担保する',
      body: 'レビューで指摘するのではなく、違反コードがそもそも入らない状態を作る。規約をhookで機械検査し、人のレビューは設計判断に集中させる。',
    },
  ],
}
