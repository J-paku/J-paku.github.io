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
    email: 'pjhrecr@gmail.com',
  },
  careers: [
    {
      id: 'current',
      // ※회사명은 비공개로 두고 업종 표기. 공개해도 무방하면 이 줄을 교체
      company: '의료·간병용품 상사(사내 시스템 개발)',
      period: '2025.01 - 현재',
      stack: ['Next.js', 'React', 'TypeScript', 'Swift', '팀 표준 AI 개발 기반'],
      role: '웹개발팀 리더(팀원 4명 + 테스터 1명)',
      summary:
        '사내 업무 시스템의 프론트엔드 전 영역을 설계·구현. 입사 9개월 만에 팀 리더. 웹과 iOS를 혼자 횡단하고 있다.',
      highlights: [
        '기간계 데이터를 Pleasanter로 이관한 위에, 업무 플로우 청취와 데이터 구조에 맞춰 재구축',
        '좌석 맵·명함 관리·장표 등 사내 앱을 상태 동기와 렌더 설계부터 자력 구축',
        '회사에 전례가 없던 Swift/iOS를 도입하고 Apple Enterprise 프로그램 개설',
        '팀 표준 AI 개발 기반을 자작해 배포·정착까지 담당. 도입 2개월 만에 코드 추가 행수는 15,811행에서 63,307행으로',
        '설계 규약을 문서화하고 hook으로 기계 강제하는 운용으로 전환',
      ],
      detail: {
        overview: {
          title: '사내 업무 슈퍼앱',
          body: '현장 업무를 iPhone 1대로 돌린다. 기능을 계속 더해가는 사내 배포형 앱.',
          meta: '2025.06 착수 · 2025.12 본운용 · 운용 중(14개월) · 전사 200명 이상 사용 · 418라우트 · TypeScript 16만 행',
        },
        origin: {
          heading: '앱의 골격을 만든 첫 기능 — 등원 세트',
          lead: '유치원에 소모품을 납품하는 서비스',
          flow: [
            { label: '이동' },
            { label: '납품' },
            { label: '앱 실행' },
            { label: '위치정보로 거래처 자동 판정', emphasis: true },
            { label: '납품 입력' },
            { label: '서멀 프린터로 납품서 실제 인쇄', emphasis: true },
            { label: '붙이고 다음으로' },
          ],
          note: '축적된 데이터는 사업 분석으로 이어진다.',
        },
        core: {
          claim: '이 기능을 만드는 과정에서 앱 전체의 구성이 정해졌다.',
          body: '2025.06에 PWA로 착수했다가 2025.07에 철회했다. Safari가 Web Bluetooth API를 지원하지 않았다. Web UI는 그대로 WKWebView에 얹고, 통신부만 네이티브로 남겼다. 이 구성이 이후 모든 기능의 토대가 됐다.',
        },
        facts: [
          {
            label: '담당 범위',
            value: '과제 정의 · 설계 · 구현 · 배포 기반 정비 · 운용 · 개선',
          },
          {
            label: '통신량',
            value: '납품 화면이 받던 API 응답이 220KB → 1.2KB. 서버 부하와 앱 반응 시간이 동시에 내려갔다',
          },
          {
            label: '인쇄 속도',
            value: '납품 등록 조작부터 납품서 인쇄 완료까지 2초 이내',
          },
          {
            label: '장비',
            value: 'Windows 태블릿과 세트로 쓰던 서멀 프린터째로 불필요해졌다. 180g BLE 프린터 1대로 현장이 돌아간다',
          },
          {
            label: '처음',
            value: 'React, Swift — 앱 전체가 이 2가지의 첫 실전이었다',
          },
        ],
        stacks: {
          heading: '기술 스택',
          groups: [
            {
              title: 'Web',
              rows: [
                { label: '프레임워크', value: 'Next.js 16(Pages Router)' },
                { label: 'UI', value: 'React 19 / Tailwind CSS 4 / MUI 7 / Radix UI' },
                { label: '언어', value: 'TypeScript 5' },
                { label: '데이터 페칭', value: 'SWR 2.3 / axios 1.13 / Zod 4.3' },
                { label: 'API', value: 'Pleasanter REST API' },
                { label: '테이블', value: 'AG Grid 35 / @tanstack/react-virtual 3' },
                { label: '차트', value: 'Recharts 3' },
                { label: '제스처·D&D', value: '@dnd-kit/core 6 / sortablejs / Embla Carousel 8' },
                { label: '상태 관리', value: 'React Hooks(커스텀 훅 분리)' },
                { label: '영속화', value: 'IndexedDB + sessionStorage 폴백' },
                { label: '빌드', value: 'Turbopack + React Compiler' },
                { label: '배포', value: '정적 익스포트(output: export)' },
              ],
            },
            {
              title: 'Native',
              rows: [
                { label: '언어', value: 'Swift 5' },
                { label: 'UI', value: 'UIKit / SwiftUI 병용' },
                { label: '네이티브 연동', value: 'WKWebView postMessage / WKScriptMessageHandler' },
                { label: '카메라', value: 'AVCaptureSession / Vision(사각형 검출·QR)' },
                { label: '인쇄', value: 'SII SDK(Bluetooth 감열)' },
                { label: '배포', value: 'Xcode Archive → In-House .ipa → MDM(Microsoft Intune)' },
              ],
            },
          ],
        },
        features: {
          heading: '기능 일람',
          lead: '착수 기준 / 릴리스는 운영 반영 기준',
          items: [
            {
              date: '2025.06',
              name: '등원 세트',
              tech: ['BLE SDK', 'WKWebView'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2025.10',
              name: '클레임 보고',
              tech: ['REST'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2025.10',
              name: 'AI 영업일보',
              tech: ['REST'],
              roles: ['design', 'release'],
            },
            {
              date: '2026.01',
              name: '레터팩 재고 관리',
              tech: ['QR'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2026.03',
              name: '정기 배송 관리',
              tech: ['.NET 레거시 이관'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2026.04',
              name: '명함 관리',
              tech: ['Gemini', 'AVFoundation'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2026.06',
              name: 'Garoon 연동 사원 맵',
              tech: ['SOAP / REST', '리버스 프록시'],
              roles: ['design', 'build', 'release'],
            },
            {
              date: '2026.07',
              name: '보이스 레코드 AI 요약',
              tech: ['Share Extension', 'App Group'],
              roles: ['design', 'build'],
            },
            {
              date: '2026.08',
              name: '로그 분석 페이지',
              tech: ['Recharts', 'JSONL'],
              roles: ['design', 'build', 'release'],
            },
          ],
        },
        asides: {
          heading: '앱 밖에서 한 일',
          items: [
            {
              title: '파괴적 조작을 hook으로 차단',
              body: 'reset --hard · stash · clean은 실행 전에 멈추고 판단을 사람에게 돌린다. 규약 위반도 커밋 전에 검출한다.',
            },
            {
              title: '팀 표준 AI 개발 기반 자작',
              body: '팀원 4명에게 배포하고 정착까지 동행했다. 도입 후 2개월 만에 팀의 코드 추가 행수가 15,811행에서 63,307행으로 약 4배가 됐다.',
            },
            {
              title: 'Power BI로 사업 지표 가시화',
              body: 'Microsoft SQL Server에서 업무 데이터를 꺼내 대시보드로 만들었다. 앱이 쌓은 데이터가 여기로 온다.',
            },
            {
              title: '웹개발팀 리더',
              body: '2025.10부터. 팀원 4명 + 테스터 1명으로 웹과 iOS 양쪽을 본다.',
            },
          ],
        },
      },
    },
    {
      id: 'contract-dev',
      // ※재직은 수탁개발 회사 1개사이고, 파견처 2곳의 업무를 이 1항목으로 묶었다. 사명은 모두 비공개
      // ※입사·퇴사 월은 확인 필요
      company: '수탁개발 회사 재직(파견처 2곳)',
      period: '2022.04 - 2024.12',
      stack: ['Nuxt.js', 'Vue.js', 'Delphi', 'Oracle', 'PostgreSQL', 'SharePoint', 'Power Automate'],
      role: '프론트엔드 / 사내 정보기반',
      assignments: [
        { period: '2023.10 - 2024.12', label: '파견처: 대형 엘리베이터 제조사 정보시스템 부문' },
        { period: '2022.04 - 2023.09', label: '파견처: 대형 물류 시스템 제조사 정보시스템 부문' },
      ],
      summary:
        '같은 수탁개발 회사에 재직한 채 파견처 2곳을 담당. 후반은 SPA 신규 구축과 레거시 기간계 시스템 이관, 전반은 사내 정보기반 운용과 업무 자동화.',
      highlights: [
        'Nuxt.js로 재고 시스템 신규 구축. 기존 시스템의 동작만 보고 다시 만드는 behavior parity 방식',
        'Delphi 레거시 기간계 시스템의 Oracle → PostgreSQL 이관. 방언 차이를 흡수하며 등가성 보증. 주는 SPA 쪽이고 이쪽은 서브 프로젝트',
        'SharePoint 운용과 Power Automate에 의한 사내 업무 플로우 자동화',
        '※DB 계층 치환이며 UI 프레임워크 치환·신구 공존은 미경험',
        '※전반(2022.04 - 2023.09)은 SPA 개발을 포함하지 않는다. SPA는 후반 파견처부터',
      ],
      detail: {
        overview: {
          title: '파견처 2곳에서의 구축·운용',
          body: '수탁개발 회사에 재직한 채 파견처를 바꿔 2개 현장을 담당했다. 후반은 Nuxt.js에 의한 SPA 신규 구축과 데이터베이스 이관, 전반은 SharePoint에 의한 사내 정보기반 운용과 업무 플로우 자동화.',
          meta: '2022.04 - 2024.12 · 재직은 수탁개발 회사 1개사',
        },
        facts: [
          {
            label: '재직',
            value: '수탁개발 회사 1개사(2022.04 - 2024.12)',
          },
          {
            label: '파견처',
            value: '대형 엘리베이터 제조사(2023.10 - 2024.12)/ 대형 물류 시스템 제조사(2022.04 - 2023.09)',
          },
        ],
        assignments: [
          {
            client: '파견처: 대형 엘리베이터 제조사 정보시스템 부문',
            title: '부품 재고 관리 시스템 신규 구축과 데이터베이스 이관',
            meta: '2023.10 - 2024.12 · 프론트엔드 엔지니어',
            lead: '파견처 정보시스템 부문에서 Nuxt.js에 의한 재고 관리 시스템 신규 구축과, Delphi 레거시 기간계 시스템의 데이터베이스 이관을 담당했다.',
            core: {
              claim: '소스를 읽을 수 없는 전제여도, 동작이 같으면 다시 만들 수 있다.',
              body: '기존 시스템의 소스코드를 참조할 수 없는 상황에서, 화면 동작만 관찰해 사양을 세우고 동등하게 동작하는 SPA를 구축했다(behavior parity 방식).',
            },
            facts: [
              {
                label: '구성',
                value: 'Nuxt.js / Vue.js / Oracle / PostgreSQL / Delphi',
              },
              {
                label: '담당 범위',
                value: 'SPA 신규 구축(주) / 데이터베이스 이관(서브 프로젝트)',
              },
              {
                label: '이관',
                value: 'Oracle → PostgreSQL. SQL 방언 차이를 흡수하며 데이터 등가성을 검증해 담보했다',
              },
              {
                label: '전제',
                value: '기존 시스템의 소스코드는 참조할 수 없다. 화면 동작만이 사양의 출처였다',
              },
              {
                label: '회귀',
                value: '사양서가 없고 동작만이 정답이었기에, 수정이 다른 기능의 회귀를 낳기 쉬웠다. 고치기 전에 검증 수단부터 마련하는 진행 방식은 이 환경에서 몸에 붙었다.',
              },
              {
                label: '비고',
                value: 'DB 계층 치환이며 UI 프레임워크 치환·신구 공존은 미경험',
              },
            ],
          },
          {
            client: '파견처: 대형 물류 시스템 제조사 정보시스템 부문',
            title: '사내 정보기반 운용과 신청·승인 플로우 자동화',
            meta: '2022.04 - 2023.09 · 사내 정보기반 운용·업무 자동화',
            lead: '파견처 정보시스템 부문에서 SharePoint에 의한 사내 정보기반 운용과, Power Automate를 이용한 신청·승인 플로우 자동화를 담당했다.',
            core: {
              claim: '수작업으로 돌던 신청 플로우를, 전수 점검부터 다시 만들었다.',
              body: '기존 플로우의 전수 점검부터 들어가, 어떤 승인이 무엇을 위해 필요한지 정리한 뒤 자동화로 치환했다.',
            },
            facts: [
              {
                label: '구성',
                value: 'SharePoint / Power Automate',
              },
              {
                label: '담당 범위',
                value: '사내 정보기반 운용 · 신청 승인 플로우 자동화',
              },
              {
                label: '비고',
                value: '이 기간은 SPA 개발을 포함하지 않는다. SPA는 후반 파견처부터',
              },
            ],
          },
        ],
      },
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
