// ワールドを移った直後、新しいタイルが DOM に載るまで前の場面を据え置き、待ちが長引いた時だけ
// 読み込み中の覆いを出す。載るまでのフレーム数は端末の速さ次第なので、フレームではなく経過時間で決める
import type { World } from '@content/types/world'
import type { WalkFrameState } from './types'

// ワールド切替後、この時間を超えても新しいタイルが DOM に載らなければ読み込み中の覆いを出す。
// 通常は 1〜2 フレームで載るので(実測 5〜15ms)、覆いは遅い端末でしか見えない
export const LOADING_DELAY_MS = 100

// ワープ直後は React がまだ前のワールドのタイルを描いている。ここで新しい原点へ飛ばすと
// 前のワールドが枠の外へ押し出されて黒画面だけが残る(町の描画待ちで実測約1秒)。
// 新しいタイルが DOM に載る(data-world が一致する)まで前の場面をそのまま見せておく。
// 待ちが閾値を超えたら読み込み中の覆いを出し、載った時点で外す。
// 載っていれば true を返し、呼ぶ側はそのまま描き進める
export const waitForWorldTiles = (
  frameState: WalkFrameState,
  layer: HTMLElement | null,
  loading: HTMLElement | null,
  world: World
): boolean => {
  if (layer !== null && layer.dataset.world !== world.id) {
    const now = performance.now()
    if (frameState.waitSince === null) frameState.waitSince = now
    if (loading !== null && now - frameState.waitSince > LOADING_DELAY_MS) {
      loading.dataset.show = ''
    }
    return false
  }
  frameState.waitSince = null
  if (loading !== null) delete loading.dataset.show
  return true
}
