// 現在(ko) — jaと同じ件数・同じ日付を保つ
import type { NowEntry } from '@/types/content'

export const now: NowEntry[] = [
  {
    date: '2026.08',
    body: '이 포트폴리오 허브를 구현 중. Lighthouse CI와 axe를 배포 게이트로 두고, 사이트 자체로 품질을 보이는 형태로 만들고 있다.',
  },
  {
    date: '2026.08',
    body: 'AWS 공인 솔루션스 아키텍트(SAA) 학습 중. 네트워크와 보안 기초를 자격 취득 여부와 무관하게 채워둔다.',
  },
  {
    date: '2026.07',
    body: '좌석 맵 데모의 메인 화면을 원본 인터랙션에 맞춰 조정 중. 팀 경계의 탭 판정과 모달 확대 원점을 실측으로 대조하고 있다.',
  },
  {
    date: '2026.07',
    body: '명함 관리 카메라를 AVCaptureSession 자체 구현으로 교체하고, 실시간 사각형 검출과 자동 촬영을 붙이는 중.',
  },
]
