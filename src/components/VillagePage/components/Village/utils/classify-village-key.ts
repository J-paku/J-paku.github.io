// 村の枠で押されたキーが何の行動かを決める。preventDefault・ref への書き込み・村の処理の呼び出しは
// use-village-input が結果を見て行い、ここは DOM も React も持たない(分岐を網羅的に単体で測るため)
import type { Direction } from '@content/types/world'

// event.code で引くので IME やキー配列の影響を受けない
const CODE_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
}

const TALK_CODES: readonly string[] = ['KeyE', 'Enter', 'NumpadEnter']

// キーイベントのうち判定に使う値だけ。React の KeyboardEvent をそのまま渡せる
export type VillageKey = {
  code: string
  repeat: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

// kind ごとの行い(use-village-input):
//   escape/map/talk は村の処理、a/b は A/B の行き先を呼ぶ。walk は held へ書いてループを起こし、
//   scroll は held を捨てて scrollHeld へ書く。release は held を捨てるだけ、none は何もしない
export type VillageKeyAction =
  | { kind: 'escape' | 'map' | 'a' | 'b' | 'talk' | 'release' | 'none'; preventDefault: boolean }
  | { kind: 'walk' | 'scroll'; direction: Direction; preventDefault: boolean }

// 方向キーでなければ undefined。キーを離した時の解除にも使う
export const keyDirection = (code: string): Direction | undefined => CODE_TO_DIRECTION[code]

// locked は会話窓などが開いて歩けない間
export const classifyVillageKey = (key: VillageKey, locked: boolean): VillageKeyAction => {
  if (key.code === 'Escape') return { kind: 'escape', preventDefault: true }
  // M は地図の開閉。開いている間も受け付ける(onMap 側が開いていれば閉じる・会話中は無視する)
  if (key.code === 'KeyM') return { kind: 'map', preventDefault: true }
  // Z/X は画面の A/B と同じ。会話窓が開いている間も受け付け(地図は焦点が枠の外なので届かない)、
  // 行き先は onA/onB 側が決める
  if (key.code === 'KeyZ' || key.code === 'KeyX') {
    // Ctrl・Cmd・Alt 付きは取り消し・切り取りなどの操作なので A/B にせず、既定の動作のまま流す
    if (key.ctrlKey || key.metaKey || key.altKey) return { kind: 'none', preventDefault: false }
    // 押しっぱなしの自動反復は捨てる(A が連打になって次の地点が続けて送られないように)
    if (key.repeat) return { kind: 'none', preventDefault: true }
    return { kind: key.code === 'KeyZ' ? 'a' : 'b', preventDefault: true }
  }
  const direction = keyDirection(key.code)
  if (locked) {
    // 会話窓が開いている間は全方向を本文送り・焦点移動に回す。
    // 方向キー以外は歩きを止めるだけで既定の動作を残す
    return direction === undefined
      ? { kind: 'release', preventDefault: false }
      : { kind: 'scroll', direction, preventDefault: true }
  }
  if (direction !== undefined) return { kind: 'walk', direction, preventDefault: true }
  if (TALK_CODES.includes(key.code)) return { kind: 'talk', preventDefault: true }
  return { kind: 'none', preventDefault: false }
}
