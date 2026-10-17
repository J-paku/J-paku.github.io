// 外の世界に触れてよいコンテナ(I/O コンテナ)を置くフォルダの一覧の正本(ADR 0019。もとは ADR 0017 の D1)。
// check-layers.mjs と check-test-boundary.mjs が同じものを使う。
// コンテナはフックを1つでも呼ぶ部品(container.tsx)で、この一覧のフォルダの container.tsx だけが I/O コンテナ。
// 一覧の外の container.tsx は状態コンテナで、import の制限は表示部品と同じ(外の世界の入口を import しない)。
// 「状態がある」と「外に触れる」は別の軸なので、状態コンテナを足すのにこの一覧は直さない。
// I/O コンテナの外の状態コンテナは、自分で統合テストの単位になる(下の unitRootOf。I/O の許しは受けない)。
// 外の世界に触れる場所を足す・移すときだけ、この一覧と ADR 0019 を合わせて直す(利用者の決定が要る)。
// パスはリポジトリ直下からの '/' 区切りで、末尾に '/' を付けない。
//
// 使い方: import { SCREEN_CONTAINER_DIRS, SHARED_CONTAINER_DIRS, CONTAINER_DIRS } from './container-dirs.mjs'
//   待ちの一覧: PENDING_CONTAINER_FILES・PENDING_HOOK_DIRS
//   統合テストのフォルダ: TEST_ROOT・kebabOf・unitDirOf(単位の元のフォルダ → 単位フォルダ)・
//   unitRootOf(コンテナのフォルダ → 単位の元のフォルダ)・testDirOf(コンテナのフォルダ → 対応する __tests__ のフォルダ)

// 画面の3つ。フォルダの index.tsx がサーバのローダー(ADR 0017 の D2)で、コンテナを描くのはローダーと、
// __tests__/<unit>/ の下の統合テスト・フィクスチャだけ
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

// 2段階目(村)で消す待ちの一覧の2つ。どちらも減るだけで、足さない。
// 項目が無くなった・もう違反しなくなったときは npm run test:boundary(PENDING_CONTAINER_FILES は scripts/check-hook-rule.mjs、
// PENDING_HOOK_DIRS は scripts/check-test-boundary.mjs)が落とすので、
// 直したらその項目をここから消す。2段階目で村を移し終えたら、一覧ごと消す(ADR 0019)

// まだフックを呼んでいる表示部品(index.tsx)。2段階目まで ESLint の layer/hook-only-in-container から外す
export const PENDING_CONTAINER_FILES = [
  'src/components/VillagePage/components/Boot/index.tsx',
  'src/components/VillagePage/components/Village/components/ClockModal/index.tsx',
  'src/components/VillagePage/components/Village/components/Ground/index.tsx',
  'src/components/VillagePage/components/Village/components/Joystick/index.tsx',
  'src/components/VillagePage/components/Village/components/Lighting/index.tsx',
  'src/components/VillagePage/components/Village/components/StopModal/index.tsx',
  'src/components/VillagePage/components/Village/components/TalkBubble/index.tsx',
  'src/components/VillagePage/components/Village/components/WorldMap/index.tsx',
]

// 隣に container.tsx の無い hooks/ フォルダ。2段階目まで「hooks/ は container.tsx のあるフォルダにだけ置く」の例外にする
export const PENDING_HOOK_DIRS = [
  'src/components/VillagePage/components/Village/components/ClockModal/hooks',
  'src/components/VillagePage/components/Village/components/Joystick/hooks',
  'src/components/VillagePage/components/Village/components/StopModal/hooks',
  'src/components/VillagePage/components/Village/components/WorldMap/hooks',
]

// 統合テストを置くリポジトリ直下のフォルダ(E2E の tests/ とは別)
export const TEST_ROOT = '__tests__'

// フォルダの名前の kebab-case(VillagePage → village-page・SVGPlayer → svg-player)。
// 判定が壊れていないかは check-test-boundary.mjs の自己検査が確かめる
export const kebabOf = name =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()

const COMPONENTS_DIR = 'src/components/'
// 横断部品を置くフォルダ。この下では、1つ下のフォルダ(ui/<名前>)が最上位のコンポーネントのフォルダ
const SHARED_DIR = 'ui'

// 単位の元のフォルダ(I/O コンテナのフォルダか、状態コンテナが入る最上位のコンポーネントのフォルダ)に対応する
// 統合テストのフォルダ(単位フォルダ)。src/components/ の下のパスを区切りごとに kebab-case にする
// (src/components/ui/SettingsMenu → __tests__/ui/settings-menu・src/components/ui/Logo → __tests__/ui/logo)
export const unitDirOf = dir => {
  if (!dir.startsWith(COMPONENTS_DIR)) {
    throw new Error(`container-dirs: 単位の元のフォルダは ${COMPONENTS_DIR} の下に置く: ${dir}`)
  }
  return `${TEST_ROOT}/${dir.slice(COMPONENTS_DIR.length).split('/').map(kebabOf).join('/')}`
}

// コンテナのフォルダ dir が入る単位の元のフォルダ(ADR 0019)。ioDirs は I/O コンテナのフォルダの一覧(ふつうは CONTAINER_DIRS)。
//   - I/O コンテナのフォルダか、その下 → いちばん近い I/O コンテナのフォルダ
//   - I/O コンテナの外 → 状態コンテナが自分で単位になる。単位の元は、入っている最上位のコンポーネントのフォルダ
//     (src/components/<名前>/… なら src/components/<名前>、src/components/ui/<名前>/… なら src/components/ui/<名前>)
//   - どちらでもない(src/components/ の外と、src/components/・src/components/ui/ の直下)→ undefined
// 名前の前の方が同じだけのフォルダ(src/components/StoryX は src/components/Story の下ではない)は、区切りで見分ける
export const unitRootOf = (dir, ioDirs) => {
  const [nearest] = ioDirs
    .filter(ioDir => dir === ioDir || dir.startsWith(`${ioDir}/`))
    .sort((a, b) => b.length - a.length)
  if (nearest !== undefined) return nearest
  if (!dir.startsWith(COMPONENTS_DIR)) return undefined
  const parts = dir.slice(COMPONENTS_DIR.length).split('/')
  const depth = parts[0] === SHARED_DIR ? 2 : 1
  return parts.length < depth ? undefined : `${COMPONENTS_DIR}${parts.slice(0, depth).join('/')}`
}

// コンテナのフォルダ dir に対応する統合テストのフォルダ。単位の元のフォルダ自身なら単位フォルダ、その下の状態コンテナなら
// 単位フォルダの下の kebab(自分のフォルダの名前)(入れ子でも、名前は自分のフォルダの名前だけ)。単位が決まらなければ undefined。
// 判定が壊れていないかは check-test-boundary.mjs の自己検査が確かめる
export const testDirOf = (dir, ioDirs) => {
  const root = unitRootOf(dir, ioDirs)
  if (root === undefined) return undefined
  const unitDir = unitDirOf(root)
  return dir === root ? unitDir : `${unitDir}/${kebabOf(dir.split('/').at(-1))}`
}
