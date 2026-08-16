// 作品(ko) — 名刺登録アプリ(名刺管理のクロスプラットフォーム化)。公開済み。ストーリー本文(story)を保持
import type { Work } from '@/types/content'

export const meishiCrossPlatform: Work = {
  slug: 'meishi-cross-platform',
  status: 'published',
  title: '명함등록어플',
  tagline: 'iOS 카메라로 명함을 찍고, 웹 관리 화면과 하나의 앱으로 잇는다',
  glyph: '名刺',
  context: '실무 진행 중 안건 — 명함 관리의 iOS화',
  contextKind: 'work',
  role: '설계·구현·릴리스',
  stack: ['Swift', 'AVFoundation', 'Vision', 'WKWebView', 'React'],
  links: {},
  // カード用サムネイル。story場面4つ(カメラ撮影・その場で登録・Web統合・拠点距離)を
  // 文字なしの図解へ起こした自作SVG
  thumbnail: '/shots/meishi-cross-platform.svg',
  story: {
    intro: {
      title: '명함등록어플',
      lead: '종이 명함을, 비추기만 하면 데이터로. iOS 네이티브 카메라와 기존 웹 관리화면을 하나의 앱으로 잇는다.',
    },
    scenes: [
      {
        id: 'camera',
        title: '「비추면 찍힌다」를 직접 만들다',
        body: 'UIImagePickerController에 기대지 않고 AVCaptureSession으로 카메라를 직접 제어. Vision의 사각형 검출로 명함 윤곽을 실시간으로 쫓아, 틀이 안정된 순간 자동으로 셔터를 끊는다.',
        chips: [
          { name: 'AVFoundation', note: '프리뷰·노출·셔터까지 AVCaptureSession으로 직접 제어' },
          { name: 'Vision', note: '사각형 검출로 명함 윤곽을 실시간 추적' },
          { name: 'Swift', note: '검출 안정 판정과 자동촬영 상태 관리' },
        ],
        image: '/works/meishi/scene1-camera.svg',
      },
      {
        id: 'register',
        title: '찍은 명함이 그 자리에서 데이터가 된다',
        body: '촬영한 명함은 그 자리에서 확인하고 등록 폼으로. 카메라에서 저장까지 앱 안에서 끊기지 않는다.',
        chips: [
          { name: 'Swift', note: '촬영부터 등록까지 화면 전환과 상태 관리' },
        ],
        image: '/works/meishi/scene2-register.svg',
      },
      {
        id: 'web',
        title: '돌아가는 관리화면은 다시 만들지 않는다',
        body: '기존 React 웹 관리화면을 WKWebView로 앱에 통합. 네이티브 촬영 경험과 웹 관리 기능이 하나의 앱으로 이어진다.',
        chips: [
          { name: 'WKWebView', note: '네이티브와 웹의 다리. 기존 자산을 그대로 살린다' },
          { name: 'React', note: '관리화면은 기존 React 구현을 계속 사용' },
        ],
        image: '/works/meishi/scene3-web.svg',
      },
      {
        id: 'nearby',
        title: '명함을 회사 공통 자산으로 바꾼다',
        body: '주소는 Yahoo!지오코더로 위도경도로 변환해, 지금 있는 곳에서 거래처까지의 거리를 표시. 부서별로 나뉘어 있던 거래처 마스터는 회사 공통 새 마스터로 통합하고, 기존 참조는 명칭 정규화로 이었다.',
        chips: [
          { name: 'Yahoo!지오코더', note: '주소→위도경도 변환과 현재 위치 기준 거리 산출' },
          { name: '데이터 설계', note: '부서별 마스터를 공통 마스터로 통합. 기존 참조는 명칭 정규화로 접속' },
        ],
        image: '/works/meishi/scene4-nearby.svg',
      },
    ],
    outro: {
      title: '경계를 설계하는 크로스플랫폼',
      body: '네이티브에서만 가능한 경험은 Swift로 만들고, 이미 돌아가는 웹은 그대로 살린다. 어디에 경계를 긋는지까지 포함해 설계한 구성. 개발은 지금도 진행중.',
      stackSummary: [
        { name: 'Swift', note: '카메라·등록 플로우 네이티브 구현' },
        { name: 'AVFoundation', note: '카메라 제어' },
        { name: 'Vision', note: '사각형 검출' },
        { name: 'WKWebView', note: '웹 통합의 다리' },
        { name: 'React', note: '기존 관리화면 계속 사용' },
        { name: 'Yahoo!지오코더', note: '거리 표시 기반' },
      ],
    },
  },
}
