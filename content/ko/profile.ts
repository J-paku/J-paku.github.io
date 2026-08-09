// プロフィール(ko) — jaと同じ型・同じキー構成を満たす
import type { Profile } from '@/types/content'

export const profile: Profile = {
  name: 'J-Paku',
  role: '프론트엔드',
  scope: ['Web', 'iOS', '업무앱 기반', 'DB'],
  headline: '업무 시스템의 UI를, 모바일 조작감까지 설계하고 운용까지',
  location: '오사카',
  goal: 'UI/UX를 거의 전부 스스로 설계해왔지만, 그 판단이 정말 좋은지 검증할 수단이 없다. 반론이 돌아오는 환경에서 설계 판단의 정확도를 올리고 싶다.',
  links: {
    github: 'https://github.com/J-paku',
  },
  careers: [
    {
      // ※회사명은 비공개로 두고 업종 표기. 공개해도 무방하면 이 줄을 교체
      company: '의료·간병용품 상사(사내 시스템 개발)',
      period: '2025.01 - 현재',
      stack: ['Next.js', 'React', 'TypeScript', 'Swift', 'Claude'],
      role: '웹개발팀 리더(팀원 4명 + 테스터 1명)',
      summary:
        '사내 업무 시스템의 프론트엔드 전 영역을 설계·구현. 입사 9개월 만에 팀 리더. 웹과 iOS를 혼자 횡단하고 있다.',
      highlights: [
        '좌석 맵·명함 관리·장표 등 사내 앱을 상태 동기와 렌더 설계부터 자력 구축',
        '회사에 전례가 없던 Swift/iOS를 도입하고 Apple Enterprise 프로그램 개설',
        'AI 에이전트 개발 환경(하네스)을 자작해 팀에 배포·정착까지 담당',
        '설계 규약을 문서화하고 hook으로 기계 강제하는 운용으로 전환',
      ],
    },
    {
      // ※입사·퇴사 월은 확인 필요. 재직 2년 10개월
      company: '시스템 수탁개발 회사(고객사 상주)',
      period: '2022 - 2024',
      stack: ['Nuxt.js', 'Vue.js', 'Delphi', 'Oracle', 'PostgreSQL'],
      role: '프론트엔드 엔지니어',
      summary:
        'SPA 신규 구축과 레거시 기간계 시스템 이관을 담당. AI 보조가 없는 환경에서 브라우저 동작과 비동기 제어의 기초를 여기서 만들었다.',
      highlights: [
        'Nuxt.js로 재고 시스템 신규 구축. 기존 시스템의 동작만 보고 다시 만드는 behavior parity 방식',
        'Delphi 레거시 기간계 시스템의 Oracle → PostgreSQL 이관. 방언 차이를 흡수하며 등가성 보증',
        '※DB 계층 치환이며 UI 프레임워크 치환·신구 공존은 미경험',
      ],
    },
  ],
  strengths: [
    {
      title: '상태 동기 설계',
      body: '버전 기반 낙관적 잠금, 낙관적 갱신과 롤백, touched-id 단위 undo 충돌 검증. 여러 단말에서 같은 데이터를 만지는 전제로, 깨지지 않는 동기 형태를 직접 정해왔다.',
    },
    {
      title: '터치 인터랙션과 렌더 설계',
      body: '앵커 기준 핀치줌, 관성 팬, 2단 줌으로 렌더 대상 자체를 바꾸는 아키텍처. 손가락으로 만져서 성립하는지를 기준으로 렌더와 이벤트 구조를 짠다.',
    },
    {
      title: '품질을 환경으로 담보',
      body: '리뷰에서 지적하는 대신, 잘못된 코드가 애초에 들어오지 않는 상태를 만든다. 규약을 hook으로 기계 검사하고 사람의 리뷰는 설계 판단에 집중시킨다.',
    },
  ],
}
