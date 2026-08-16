import type { UiStrings } from '@/types/content'

// Header・SettingsMenu 등이 소비하는 UI 문자열(한국어)
export const ui: UiStrings = {
  skipToMain: '본문으로 건너뛰기',
  localeMenu: {
    label: '언어 선택',
    ja: '日本語',
    ko: '한국어',
  },
  settingsMenu: {
    label: '설정',
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
    shotPlaceholder: '화면 캡처는 준비 중',
    showDetail: '자세히 보기',
    hideDetail: '접기',
  },
  workStory: {
    back: '목록으로 돌아가기',
    viewScene: '화면 보기',
    close: '닫기',
    prevScene: '이전 장면',
    nextScene: '다음 장면',
  },
  quality: {
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
}
