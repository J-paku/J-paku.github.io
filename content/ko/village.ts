// 村マップ(韓国語)の表示文言。ja と同じキーを揃える
import type { VillageText } from '@content/types/world'

export const village: VillageText = {
  intro:
    '프론트엔드 / 프로덕트 엔지니어 J-Paku의 포트폴리오. 걸어서 다섯 곳을 돌면 제가 어떤 문제를 푸는지 알 수 있습니다.',
  promise: '1분 · 5곳 · 대표 작업 3개',
  hint: '방향키·WASD로 이동 · E로 대화 · M으로 지도',
  noTarget: '근처에 말 걸 곳이 없네. 문이나 건물을 찾아보자',
  arriveAt: '{place} 앞이에요. 이야기를 들어볼까요?',
  exitHint: '아래 매트를 밟으면 밖으로 나갈 수 있습니다.',
  headTo: '다음은 {place}. 걸어가 보세요.',
  talk: '이야기 듣기',
  close: '닫기',
  openMap: '지도 열기',
  mapTitle: '마을 지도',
  closeMap: '지도 닫기',
  fastTravel: '{place}(으)로 이동',
  visitedOf: '{n} / {total} 방문',
  skipVillage: '맵을 건너뛰고 작품 목록으로',
  shortcuts: '작품으로 바로 가기',
  toList: '웹으로 보기',
  toVillage: '마을로 보기',
  allSeen: '다섯 곳을 모두 봤어요. 「{list}」에서 작품을 다시 볼 수 있어요.',
  buttonA: '선택',
  buttonB: '취소',
  joystick: '이동 스틱',
  stops: {
    home: {
      place: 'PC',
      arrive: '책상 위 PC가 켜져 있어요. 열어볼까요?',
      talk: 'PC 열기',
      title: 'Frontend / Product Engineer — J-Paku',
      claim: '회사의 업무 시스템을 웹과 앱 양쪽에서 개발하고 있습니다.',
      proof:
        '설계부터 구현, 출시 이후 운영까지 일관되게 담당하고 있습니다. iOS 연동과 모바일다운 조작감까지 포함해 설계하고 구현합니다.',
      hook: '먼저 명함 공방을 살펴봐 주세요.',
      next: '명함 공방으로',
      detail:
        '현재 업무 앱은 전사 200명 이상이 이용하고 있습니다. 입사 9개월 만에 팀 리더가 되었습니다.',
    },
    meishi: {
      place: '명함 공방',
      title: 'iOS 카메라로 명함을 찍다',
      claim: 'iOS 카메라로 명함을 촬영하고, 그 자리에서 데이터화할 수 있는 앱을 만들었습니다.',
      proof:
        '촬영 기능은 AVFoundation과 Vision을 사용해 구현했고, 인식한 문자 정보를 정리하는 데는 Gemini를 활용하고 있습니다. 기존 웹 관리 화면은 WKWebView로 그대로 활용했습니다.',
      hook: '다음은 손가락으로 직접 움직이는 화면입니다.',
      next: '인터랙션 연구소로',
      detail:
        '부서별로 나뉘어 있던 거래처 데이터도 전사 공통 마스터로 통합했습니다. 첫 출시 이후에도 계속해서 기능을 추가하고 있습니다.',
      link: {
        label: '명함 앱 이야기 읽기',
        target: { kind: 'story', slug: 'meishi-cross-platform' },
      },
    },
    lab: {
      place: '인터랙션 연구소',
      title: '손가락으로 움직이는 좌석 맵',
      claim: '좌석과 팀 배치를 손가락으로 직접 움직이며 확인할 수 있는 좌석 맵을 만들었습니다.',
      proof:
        '앵커를 기준으로 한 핀치 줌과 관성 스크롤을 구현했고, @use-gesture/react와 렌더링 방식 전환을 함께 사용했습니다.',
      hook: '다음은 AI 로봇을 만나보세요.',
      next: 'AI 로봇에게',
      detail:
        '개발 중에는 iOS 버전에서 축소할 때 앱이 꺼지는 문제도 발견했습니다. 원인은 메모리 부족이었고, 한계에 도달하기 전에 줌을 제어해 해결했습니다.',
      link: {
        label: '데모 열기',
        target: { kind: 'external', url: 'https://j-paku.github.io/seatmap-demo/' },
      },
    },
    robot: {
      place: 'AI 로봇',
      title: 'AI 개발 결과를 흔들리지 않게 만드는 구조',
      claim: '같은 요청에서 최대한 같은 품질의 결과를 낼 수 있는 AI 개발 환경을 만들었습니다.',
      proof:
        'AI의 행동을 제어하는 훅을 25개 마련하고, 36개 케이스의 eval로 구조 자체를 검증하고 있습니다. 환경의 설계·구현뿐 아니라 팀 도입과 운용까지 담당했습니다.',
      hook: '마지막으로 우체통에 들러보세요.',
      next: '우체통으로',
      detail:
        '도입 2개월 만에 팀의 코드 추가 줄 수는 약 4배가 되었습니다. AI 팀이 자동으로 완료한 작업 중 87.6%는 사람의 손질 없이 완료됩니다.',
      link: {
        label: 'AI 개발 기반 페이지',
        target: { kind: 'external', url: 'https://j-paku.github.io/ai-harness/' },
      },
    },
    mailbox: {
      place: '우체통',
      title: '편하게 연락해 주세요',
      claim:
        '지금까지 업무 시스템을 잇는 설계, 손가락으로 직관적으로 다루는 UI, 그리고 팀이 반복해서 쓸 수 있는 개발 환경을 소개했습니다.',
      proof:
        '잠깐 이야기를 나눠보고 싶으신 분도, 개발에 대해 상담하고 싶으신 분도 편하게 연락해 주세요.',
      hook: '감사합니다. 궁금한 곳은 지도에서 언제든 다시 갈 수 있습니다.',
      next: '전체 요약 보기',
      detail: '이메일은 다음과 같습니다. pjhrecr@gmail.com',
      link: {
        label: '이메일 쓰기',
        target: { kind: 'external', url: 'mailto:pjhrecr@gmail.com' },
      },
    },
  },
}
