// 作品(ko) — 座席マップデモ。jaと同じ2節構成・同じkeyを保つ
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
  role: '설계·구현',
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
  // 詳細ページ用。WKWebViewが起こしたクラッシュの原因調査と、着手の動機を語る2節
  detail: {
    sections: [
      {
        id: 'wkwebview-crash',
        title: '죽는 원인을, 재서 밝혀내다',
        paragraphs: [
          '원본 iOS 앱(Swift)은 좌석 맵 웹 화면을 WKWebView로 띄운다. 운영에서 가장 애먹은 문제는 지도를 축소하면 앱째로 죽는 것이었는데, 코드를 봐도 원인을 알 수 없었다.',
          '실마리는 Xcode 디버거로 프로세스 리소스를 들여다본 것이었다. 축소할수록 표시 범위가 넓어져 WKWebView의 메모리가 치솟았고, 어느 지점에서 프로세스째로 강제 종료되고 있었다.',
          '수정도 실측에서 출발했다. 죽는 축소율을 측정해, 거기 닿기 전에 멈추는 줌 하한을 뒀다. 모바일과 PC 모두 같은 제한을 적용했다.',
        ],
      },
      {
        id: 'why-built',
        title: '왜 만들었나',
        paragraphs: [
          '외근 중 전화를 걸려다 손이 멈춘다. 상대가 회의 중일 수도 있다. 확인하려면 PC용 Garoon 일정 화면을 스마트폰으로 확대해 가며 읽고, 별도의 좌석표와 머릿속에서 맞춰 볼 수밖에 없었다. 신입사원에게는 그 과장이 어느 자리의 누구인지 알아볼 수단 자체가 없었다. 전화번호부 등록은 담당자의 VBA 작업을 기다려야 했다.',
          '「걸기 전에 상대의 지금을 알 수 있는」 화면이 하나 있으면, 이 왕복은 전부 사라진다. 좌석·직급·일정을 한 화면에 모은 것이 이 툴이 됐다.',
        ],
      },
    ],
  },
}
