// コンテナ(container.tsx)を置くフォルダの一覧の正本(ADR 0017 の D1)。check-layers.mjs と check-test-boundary.mjs が同じものを使う。
// 名前が container.tsx でも、この一覧の外に置いたものはコンテナに数えない。数えると、どこにでも外の世界の import を許す場所を作れてしまうため
// (check-layers.mjs が一覧の外の container.tsx と、一覧のフォルダに container.tsx が無いことを落とす)。
// コンテナを足す・移すときは、この一覧と ADR 0017 の D1 を合わせて直す(利用者の決定が要る)。
// パスはリポジトリ直下からの '/' 区切りで、末尾に '/' を付けない。
//
// 使い方: import { SCREEN_CONTAINER_DIRS, SHARED_CONTAINER_DIRS, CONTAINER_DIRS } from './container-dirs.mjs'

// 画面の3つ。フォルダの index.tsx がサーバのローダー(D2)で、コンテナを描くのはローダーと、同じフォルダの統合テスト・フィクスチャだけ
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

export const CONTAINER_DIRS = [...SCREEN_CONTAINER_DIRS, ...SHARED_CONTAINER_DIRS]
