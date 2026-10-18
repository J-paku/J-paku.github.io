// 外の世界に触れてよいコンテナ(I/O コンテナ)を置くフォルダの一覧の正本(ADR 0019。もとは ADR 0017 の D1)。
// check-layers.mjs と check-test-boundary.mjs が同じものを使う。
// コンテナはフックを1つでも呼ぶ部品(container.tsx)で、この一覧のフォルダの container.tsx だけが I/O コンテナ。
// 一覧の外の container.tsx は状態コンテナで、import の制限は表示部品と同じ(外の世界の入口を import しない)。
// 「状態がある」と「外に触れる」は別の軸なので、状態コンテナを足すのにこの一覧は直さない。
// 外の世界に触れる場所を足す・移すときだけ、この一覧と ADR 0019 を合わせて直す(利用者の決定が要る)。
// パスはリポジトリ直下からの '/' 区切りで、末尾に '/' を付けない。
//
// 使い方: import { SCREEN_CONTAINER_DIRS, SHARED_CONTAINER_DIRS, CONTAINER_DIRS } from './container-dirs.mjs'
//   統合テストのフォルダ: TESTS_DIR(フォルダの名前)・inTestsDir(パスがその中にあるか)

// 画面の3つ。フォルダの index.tsx がサーバのローダー(ADR 0017 の D2)で、コンテナを描くのはローダーと、
// 画面のフォルダの下の統合テストと、画面のフォルダのフィクスチャ(container.fixture.ts)だけ
export const SCREEN_CONTAINER_DIRS = [
  'src/components/VillagePage',
  'src/components/Directory',
  'src/components/Story',
]

// 複数の画面にまたがり外の I/O に触れる横断部品の3つ。表示部品が外から container.tsx を直接指して描く
export const SHARED_CONTAINER_DIRS = [
  'src/components/ui/SettingsMenu',
  'src/components/ui/PageviewCounter',
  'src/components/ui/ScenePlayer',
]

// I/O コンテナの6つ(外の世界に触れてよいコンテナ)
export const CONTAINER_DIRS = [...SCREEN_CONTAINER_DIRS, ...SHARED_CONTAINER_DIRS]

// 統合テストを2本以上持つコンテナが、自分のフォルダ(container.tsx のあるフォルダ)の直下に作るフォルダの名前(ADR 0022)。
// 1本なら作らず、container.tsx の隣の container.integration.test.tsx(対のファイル)にする。
// 統合テストの部品・フィクスチャもこの中か container.tsx の隣に置き、中はテストの側として扱う
export const TESTS_DIR = '__tests__'

// パスが TESTS_DIR のフォルダの中にあるか(深さを問わない。リポジトリ直下の __tests__/ も)。
// 名前の前の方が同じだけのフォルダ(__tests__x/)は数えない
export const inTestsDir = file => file.split('/').slice(0, -1).includes(TESTS_DIR)
