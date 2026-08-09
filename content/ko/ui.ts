import type { UiStrings } from '@/types/content'

// Header・LocaleSwitcher・ThemeToggle이 소비하는 UI 문자열(한국어)
export const ui: UiStrings = {
  skipToMain: '본문으로 건너뛰기',
  nav: {
    label: '사이트 내비게이션',
    works: '작품',
    now: '현재',
    skills: '스킬',
    about: '소개',
  },
  localeMenu: {
    label: '언어 선택',
    ja: '日本語',
    ko: '한국어',
  },
  theme: {
    label: '테마 전환',
    light: '라이트',
    dark: '다크',
  },
  work: {
    index: '작품 목록',
    openLinks: '링크 열기',
    wipBadge: '준비 중',
    period: '기간',
    role: '역할',
    scale: '규모',
    stack: '기술',
    live: '공개 페이지',
    repo: 'GitHub',
    backToList: '작품 목록으로 돌아가기',
    shotPlaceholder: '화면 캡처는 준비 중',
  },
  quality: {
    title: '품질 지표',
    measuredAt: '측정 일시',
    violations: '위반 건수',
    viewRun: '실행 결과 보기',
    // 푸터의 계측표. 값은 두지 않고 계측 환경과 알려진 약점을 먼저 말한다
    footer: {
      label: 'MEASURED',
      environment:
        'Lighthouse는 「/」만 1회 계측. axe-core는 「/」「/ko」 2개 URL을 검사',
      limitation:
        '커맨드 팔레트를 펼친 상태나 wip 작품 페이지의 내부 상태는 대상 밖 — 실측이 닿는 범위만 담보한다',
    },
  },
  colophon: {
    copyright: '© 2026 朴',
    credit: 'Design explored with Variant',
  },
  notFound: {
    title: '페이지를 찾을 수 없습니다',
    body: '찾으시는 페이지가 존재하지 않거나 이동 또는 삭제되었을 수 있습니다.',
    backHome: '홈으로 돌아가기',
  },
  commandPalette: {
    openButtonLabel: '커맨드 팔레트 열기',
    title: '커맨드 팔레트',
    searchLabel: '명령 검색',
    placeholder: '작품・언어・테마 검색',
    resultCount: '{count}개의 명령을 찾았습니다',
    groupWorks: '작품',
    groupLocale: '언어',
    groupTheme: '테마',
    groupExternal: '외부 링크',
  },
}
