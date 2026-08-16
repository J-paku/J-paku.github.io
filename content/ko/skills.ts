// スキル(ko) — jaと同じカテゴリ構成・同じevidence slugを保つ
import type { SkillCategory } from '@/types/content'

export const skills: SkillCategory[] = [
  {
    category: '언어·타입',
    items: [
      {
        name: 'TypeScript',
        evidence: ['seatmap-demo', 'ai-harness'],
        note: 'any/unknown 자율 금지, 3층 types 배치 규약 운용',
      },
      { name: 'JavaScript(ES2022+)', evidence: ['seatmap-demo', 'ai-harness'] },
      { name: 'Swift(SwiftUI / UIKit)', evidence: ['meishi-cross-platform'] },
    ],
  },
  {
    category: '프레임워크',
    items: [
      { name: 'React 19', evidence: ['seatmap-demo'] },
      { name: 'Next.js 16(Pages Router / 정적 익스포트)', evidence: ['seatmap-demo'] },
      { name: 'Nuxt.js / Vue', evidence: [], note: '전 직장에서 2년 10개월. 공개 작품 없음' },
    ],
  },
  {
    category: '상태·데이터 동기',
    items: [
      {
        name: '낙관적 갱신과 롤백',
        evidence: ['seatmap-demo'],
        note: '버전 기반 낙관적 잠금, touched-id 단위 undo 충돌 검증',
      },
      { name: 'SWR(증분 동기·재검증 설계)', evidence: ['seatmap-demo'] },
      { name: 'IndexedDB(오프라인 영속화)', evidence: [], note: '사내 앱에서 스키마 v10까지 운용. 공개 작품 없음' },
    ],
  },
  {
    category: '인터랙션·렌더',
    items: [
      {
        name: '핀치줌 / 관성 팬',
        evidence: ['seatmap-demo'],
        note: '앵커 기준 줌, friction 감쇠, 스프링 바운스',
      },
      { name: '2단 줌 렌더 아키텍처', evidence: ['seatmap-demo'] },
      { name: '드래그&드롭 / 탭 판정 분리', evidence: ['seatmap-demo'] },
    ],
  },
  {
    category: '크로스플랫폼',
    items: [
      { name: 'WKWebView ↔ JS 브리지', evidence: ['meishi-cross-platform'] },
      { name: 'AVFoundation + Vision(사각형 검출·자동 촬영)', evidence: ['meishi-cross-platform'] },
      { name: 'BLE(모바일 프린터 연동)', evidence: [], note: '사내 앱에서 구현. 공개 작품 없음' },
    ],
  },
  {
    category: '개발 환경·AI 오케스트레이션',
    items: [
      {
        name: '멀티 에이전트 하네스 설계',
        evidence: ['ai-harness'],
        note: '훅 25개, eval 36케이스, worktree 격리 병렬 실행',
      },
      { name: 'Git worktree 기반 병렬 작업 격리', evidence: ['ai-harness'] },
      { name: 'JSONL trace 실행 기록·자동 채점', evidence: ['ai-harness'] },
    ],
  },
  {
    category: '품질·접근성',
    items: [
      { name: 'pre-commit 타입·규약 체크(tsc / ESLint / knip)', evidence: ['ai-harness'] },
      {
        name: 'WCAG 준거 ARIA·키보드 조작',
        evidence: ['seatmap-demo'],
        note: '포커스 트랩과 자동 검증은 미정비. 이 허브에서 CI 게이트화해 메우는 중',
      },
      {
        name: 'Lighthouse CI / axe 자동 검증',
        evidence: [],
        note: '이 사이트 자체의 CI 게이트. 위반이 1건이라도 있으면 배포가 실패한다',
      },
    ],
  },
]
