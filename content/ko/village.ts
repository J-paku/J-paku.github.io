// 村マップ(韓国語)の表示文言。ja と同じキーを揃える
import type { VillageText } from '@content/types/world'

export const village: VillageText = {
  intro:
    '프론트엔드 / 프로덕트 엔지니어 J-Paku의 포트폴리오. 걸어서 다섯 곳을 돌면 제가 어떤 문제를 푸는지 알 수 있습니다.',
  promise: '1분 · 5곳 · 대표 작업 3개',
  hint: '방향키·WASD로 이동 · Z로 대화·X로 닫기 · M으로 지도',
  hintTouch: '스틱으로 이동 · A로 대화 · 오른쪽 아래 지도를 탭하면 이동',
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
  toList: '작품 목록으로',
  toVillage: '마을로 보기',
  allSeen: '다섯 곳을 모두 봤어요. 「{list}」에서 작품을 다시 볼 수 있어요.',
  buttonA: '선택',
  buttonB: '취소',
  joystick: '이동 스틱',
  // 卓上時計の設定窓(action: 'clock' の地点)。会話窓ではなくこの文言を使う
  clock: {
    place: '책상시계',
    arrive: '책상 위에 시계가 놓여 있다.',
    talk: '시간 설정하기',
    prompt: '책상시계가 놓여 있다. 시간을 설정하시겠습니까?',
    realtime: '현재시간',
    custom: '커스텀시간',
    cancel: '그만두기',
    setRealtime: '현재시간으로 설정했습니다. 포트폴리오 마을이 현재시간 기준으로 바뀝니다.',
    customIntro: '커스텀시간을 설정합니다. 포트폴리오 마을의 시간대를 직접 바꿀 수 있습니다.',
    pick: '시간을 선택해주세요.',
    hourLabel: '시',
    minuteLabel: '분',
    prevHour: '1시간 뒤로',
    nextHour: '1시간 앞으로',
    prevMinute: '10분 뒤로',
    nextMinute: '10분 앞으로',
    decide: '결정',
    setCustom: '커스텀시간을 설정했습니다. 포트폴리오 마을의 시간이 {time}(으)로 변경됩니다.',
    cancelled: '설정을 취소했습니다.',
  },
  fishing: {
    prompt: '낚시를 해볼까…?',
    go: '낚는다',
    cast: '……',
    bite: '뭔가 걸렸다!',
    landed: '경험을 낚아 올렸다!',
    complete: '모든 경험을 낚아 올렸다!',
    caughtPlace: '낚아 올린 경험',
    caughtClaim: '{date}에 착수한 사내 업무 앱 기능입니다.',
    caughtTech: '사용한 기술: {tech}',
    caughtRoles: '담당한 공정: {roles}',
    caughtHook: '한 번 더 던지면 다른 경험이 낚일지도 모릅니다.',
    caughtNext: '작품 목록으로',
  },
  stops: {
    home: {
      place: 'PC',
      arrive: '책상 위 PC가 켜져 있어요. 열어볼까요?',
      talk: 'PC 열기',
      title: 'Frontend / Product Engineer',
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
        'AI의 행동을 제어하는 훅을 25개 마련하고, eval로 구조 자체를 계속 검증해 회귀를 막고 있습니다. 환경의 설계·구현뿐 아니라 팀 도입과 운용까지 담당했습니다.',
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
    journey: {
      place: '다음 여정',
      title: '다음 여정은 아직 정해지지 않았습니다.',
      claim: '다음 여정을 함께하시지 않겠습니까?',
      proof: '새로운 팀과 함께 풀어갈 문제를 만나고 싶습니다.',
      detail: '함께 만들고 싶은 것이 있다면 편하게 연락해 주세요.',
      hook: '이 길 너머의 이야기를 함께 이어가요.',
      next: '작품 목록 보기',
      link: {
        label: '다음 여정 이야기하기',
        target: { kind: 'external', url: 'mailto:pjhrecr@gmail.com' },
      },
    },
    monument: {
      place: '경력비',
      title: '지금까지의 길',
      claim: '2022년부터 회사 2곳에서 사내 시스템의 프론트엔드를 만들어 왔습니다.',
      entries: [
        {
          logo: '/logos/koyama.png',
          company: '小山株式会社',
          period: '2025.01 - 현재',
          body: '사내 업무 슈퍼앱의 Web 전 영역과 iOS 담당. 입사 9개월 만에 Web 개발팀 리더',
        },
        {
          logo: '/logos/meitec-fielders.png',
          company: 'メイテックフィルダーズ',
          period: '2022.04 - 2024.12',
          body: '파견처 2곳의 정보시스템 부서에서 Nuxt.js SPA 신규 구축과 SharePoint 운용·자동화',
        },
      ],
      proof:
        '전반은 파견처 정보시스템 부서에서, 지금은 상사의 사내 개발팀에서 리더를 맡고 있습니다.',
      hook: '궁금한 작품은 지도에서 언제든 돌아갈 수 있습니다.',
      next: '작품 일람으로',
      detail: '각 현장에서 무엇을 만들었는지는 작품 일람의 프로필에 이어집니다.',
      talk: '읽기',
    },
  },
}
