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
    system: '시스템',
    light: '라이트',
    dark: '다크',
  },
  work: {
    wipBadge: '준비 중',
    period: '기간',
    role: '역할',
    scale: '규모',
    stack: '기술',
    live: '공개 페이지',
    repo: '리포지토리',
    backToList: '작품 목록으로 돌아가기',
  },
  quality: {
    title: '품질 지표',
    measuredAt: '측정 일시',
    violations: '위반 건수',
    viewRun: '실행 결과 보기',
  },
  notFound: {
    title: '페이지를 찾을 수 없습니다',
    body: '찾으시는 페이지가 존재하지 않거나 이동 또는 삭제되었을 수 있습니다.',
    backHome: '홈으로 돌아가기',
  },
}
