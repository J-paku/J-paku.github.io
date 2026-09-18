// 村マップ(韓国語)の表示文言。ja と同じキーを揃える
import type { VillageText } from '@content/types/world'

export const village: VillageText = {
  intro:
    '프론트엔드 엔지니어 J-Paku의 포트폴리오. 걸어서 다섯 곳을 돌면 제가 어떤 문제를 푸는지 알 수 있습니다.',
  promise: '1분 · 5곳 · 대표 작업 3개',
  hint: '방향키·WASD로 이동 · E로 대화 · M으로 지도',
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
  dpad: { up: '위로', down: '아래로', left: '왼쪽으로', right: '오른쪽으로' },
  joystick: '이동 스틱',
  stops: {
    home: {
      place: 'PC',
      arrive: '책상 위 PC가 켜져 있어요. 열어볼까요?',
      talk: 'PC 열기',
      title: '반갑습니다. 1분만 걸어볼까요?',
      claim: '업무 시스템의 UI를 만들고, 모바일 조작감과 운용까지 이어갑니다.',
      proof:
        '제품을 잇는 일, 손에 맞는 UI, 팀이 반복할 수 있는 환경. 이 세 곳을 차례로 안내할게요.',
      hook: '먼저, 카메라와 웹을 연결한 공방으로 가볼까요?',
      next: '명함 공방으로',
      detail:
        '프론트엔드 엔지니어 J-Paku입니다. 화면을 만드는 데서 끝내지 않고 실제 업무에서 어떻게 쓰이고 유지되는지까지 설계합니다.',
    },
    meishi: {
      place: '명함 공방',
      title: '찍은 명함이, 팀의 데이터가 된다면?',
      claim: 'iOS 카메라와 웹 관리 화면을 하나의 앱 경험으로 연결했습니다.',
      proof:
        '촬영 → 등록 → 웹 관리. 기존 관리 화면을 살리면서 모바일과 웹의 경계를 설계한 작업입니다.',
      hook: '다음은 손가락으로 직접 다루는 UI예요. 연구소에서 보여드릴게요.',
      next: '인터랙션 연구소로',
      detail:
        '명함을 촬영해 데이터로 만들고 관리 화면으로 이어지는 흐름입니다. 새 화면만 만드는 것이 아니라 이미 돌아가던 웹과 iOS 기능을 어떻게 연결할지에 집중했습니다.',
      link: {
        label: '명함 앱 이야기 읽기',
        target: { kind: 'story', slug: 'meishi-cross-platform' },
      },
    },
    lab: {
      place: '인터랙션 연구소',
      title: '복잡한 배치도, 손끝에는 자연스럽게.',
      claim: '좌석과 팀 배치를 핀치 줌·팬·직접 조작으로 다루는 맵을 만들었습니다.',
      proof:
        '터치 입력과 렌더링을 함께 설계해, 화면을 손가락으로 다루는 경험을 작업의 중심에 놓았습니다.',
      hook: '이런 작업을 팀에서도 반복할 수 있게 하려면? 마지막 작업대로 가보죠.',
      next: 'AI 작업대로',
      detail:
        '오피스의 좌석과 팀 배치를 다루는 데모입니다. 앵커를 기준으로 한 핀치 줌, 관성 팬, 줌 단계에 따른 렌더링 구성이 핵심입니다.',
      link: {
        label: '데모 열기',
        target: { kind: 'external', url: 'https://j-paku.github.io/seatmap-demo/' },
      },
    },
    bench: {
      place: 'AI 작업대',
      title: '잘된 한 번을, 팀의 반복 가능한 방식으로.',
      claim: 'AI 개발의 재현성을 개인의 요령 대신 환경 설계로 담보하려 했습니다.',
      proof: '훅·회귀 검증·설치 패키지와 함께, 팀이 실제로 쓰도록 도입 지원까지 진행했습니다.',
      hook: '제품, 조작감, 팀의 환경까지 보셨네요. 광장에서 한 번 정리할까요?',
      next: '만남의 광장으로',
      detail:
        '같은 요청도 사람과 날에 따라 결과가 달라지는 문제에서 시작했습니다. 규약을 실행 시점에 검사하고 회귀 검증으로 환경을 확인합니다.',
      link: {
        label: 'AI 개발 기반 페이지',
        target: { kind: 'external', url: 'https://j-paku.github.io/ai-harness/' },
      },
    },
    plaza: {
      place: '만남의 광장',
      title: '이런 문제, 함께 풀 사람이 필요하신가요?',
      claim: '제품을 잇는 설계 · 손에 맞는 UI · 팀이 반복할 수 있는 개발.',
      proof: '지금 필요한 역량과 맞는 작업을 골라 더 보거나, 바로 연락하실 수 있어요.',
      hook: '고맙습니다. 궁금한 곳은 다시 눌러주세요. 이야기는 여기 남아 있어요.',
      next: '전체 요약 보기',
      detail:
        '짧은 탐방에서 본 세 축을 한 번에 정리합니다. 제품과 플랫폼의 연결, 직접 조작하는 인터랙션, 품질을 반복 가능하게 만드는 환경.',
      link: {
        label: '이메일로 이야기 나누기',
        target: { kind: 'external', url: 'mailto:pjhrecr@gmail.com' },
      },
    },
  },
}
