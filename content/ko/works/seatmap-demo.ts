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
  // 詳細ページ用。設計で迷った3点と、原本構成・データフロー・保存シーケンスの図解文言
  detail: {
    cases: [
      {
        challenge: '수백 석을 DOM에 상시 배치하면 팬줌 재렌더링이 무거워지고, 배치하지 않으면 좌석에 도달할 수단이 없다',
        decision: '변환 레이어에는 통로·구획만 두고, 개인 좌석은 sr-only 미러 레이어의 버튼으로 분리',
        reason: '렌더링 비용과 보조기술을 통한 도달 가능성을 동시에 만족시키기 위해',
      },
      {
        challenge: '캐시의 수동 버전 상수는 갱신을 잊기 쉽다. 실제로 옛 캐시를 계속 읽는 사고를 낸 적이 있다',
        decision: '캐시 값에 시드 데이터의 해시(지문)를 동봉해, 데이터가 바뀌면 자동으로 캐시 미스가 되게 한다',
        reason: '무효화를 사람의 기억이 아니라 구조로 보장하기 위해',
      },
      {
        challenge: '「회의실 이중 예약이 없다」는 데이터 쪽 조건이라 타입 검사로도 화면 확인으로도 검출할 수 없다',
        decision: '화면·데이터·배포물을 보는 3개의 검증 스크립트를 마련하고, GitHub Pages 배포판에서도 동일하게 실행한다',
        reason: '로컬 PASS만으로 완료라 부르지 않기 위해',
      },
    ],
    diagrams: {
      architecture: {
        title: '원본 구성',
        caption:
          '사내 한정 Garoon을 사외에 열지 않고, Akamai 리버스 프록시와 Pleasanter의 서버간 API로 참조하는 경로. 본 데모는 백엔드 없이 mock JSON으로 클라이언트에서 완결된다.',
        labels: {
          browser: '브라우저',
          iosApp: 'iOS 앱',
          akamai: 'Akamai 프록시',
          pleasanter: 'Pleasanter',
          garoon: 'Garoon',
          serverToServer: '서버간 API',
          internalZone: '사내 한정',
          demoNote: '데모는 mock JSON',
        },
      },
      dataflow: {
        title: '데모판 데이터 흐름',
        caption: '정적 JSON을 지연 응답으로 API처럼 다루고, 편집분은 localStorage로 되돌아가는 순환 구조다.',
        labels: {
          mocks: 'mock JSON',
          fetchMock: '지연 응답',
          swrCache: 'SWR 캐시',
          screenMap: '좌석 맵',
          screenDirectory: '디렉터리',
          screenEdit: '편집',
          storage: 'localStorage',
        },
      },
      sequence: {
        title: '드래그 편집→저장 시퀀스',
        caption: '고스트 미리보기와 낙관적 잠금을 거쳐, 저장 결과가 화면에 반영되는 순서다.',
        labels: {
          actorUser: '사용자',
          actorEditor: '편집 세션',
          actorStore: '저장부',
          actorCache: 'SWR 캐시',
          msgDrag: '드래그',
          msgGhost: '고스트 표시',
          msgDrop: '드롭',
          msgLockCheck: '잠금 조회',
          msgSaved: 'saved',
          msgBlocked: 'blocked',
          msgConflict: 'conflict 파기',
          msgRevalidate: '캐시 갱신',
          msgRender: '화면 반영',
        },
      },
    },
  },
}
