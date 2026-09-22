// 正面・背面は頭部を固定した二つの歩行コマで軸足を交互にする。
// 釣っている間は歩行コマではなく竿を持つコマを使う(向きの左右反転は歩行と同じ)。
// 竿のコマは釣りの段階と、その段階に入ってからの経過で決まる。時間でまだコマが変わるか(animating)も
// 返し、歩行ループはそれだけを見て眠ってよいかを決める(ループ側に時間の定数を持たない)
// sprites.ts は node:crypto を読むので、値ではなく型だけを取り込む。import type は出力から消えるので、
// クライアントのバンドルへ sprites.ts が入らない
import type { FISHING_MOTIONS } from '@/lib/pixel/sprites'
import type { MoveState } from './movement'

// 竿を振る時間。振りかぶり・引き・投げ・振り抜きを 4 等分で出し、終われば構え(待機)のコマへ戻る。
// 振っている間は竿先が動くので、糸は FishingFloat がこの間だけ隠す
export const FISHING_SWING_MS = 480
// かかった合図で体が引かれる 1 周期。浮きの village-float-bite(fishing-float.module.css の
// `0.3s steps(1) 2`)と同じ長さ。steps(1) は 0%→50% の間を 0% の値のまま保つので、浮きは各周期の
// 後半 [150, 300)ms に沈む。体はその沈み始めに合わせて引かれるコマ(bite)を出し、前後を力むコマ(tense)で挟む
export const FISHING_BITE_TUG_MS = 300
// 釣り上げで竿を引く時間。過ぎたら掲げたコマのまま止める
export const FISHING_PULL_MS = 200

// 竿を持つ間の段階。釣りのフックの FishingPhase から idle を除いたものと同じ名前にする
// (lib は components を読まないので、ここでは名前だけを持つ)
export type FishingPosePhase = 'casting' | 'bite' | 'landing' | 'caught'
// 歩行ループへ渡す釣りの印。since はその段階に入った時刻(performance.now() 基準)
export type FishingPose = { phase: FishingPosePhase; since: number }

// 竿のコマの鍵の末尾。構え(待機)は末尾なし、動くコマの名前はシートの FISHING_MOTIONS から導く。
// ここへ名前を書き写すと、片方だけ綴りが変わっても spriteIndex が無い鍵を黙って 0 番の絵で描き、
// 型検査でも単体テストでも気付けない
type FishingSuffix = '' | `-${(typeof FISHING_MOTIONS)[number]}`
// 段階に入ってからの経過が end より前なら、この接尾辞のコマを出す
type FishingStep = readonly [end: number, suffix: FishingSuffix]
// steps を上から見て最初に当たった行を使う。どれにも当たらなければ settled のまま時間で変わらない。
// 動きを控える設定では steps を飛ばして最初から settled を出す
type FishingTimeline = { steps: readonly FishingStep[]; settled: FishingSuffix }

const SWING_BEAT_MS = FISHING_SWING_MS / 4
// 浮きが沈み始める周期内の時刻と、その前後で力む長さ。力む長さは E2E が合図の区切りを出すのにも使う
const BITE_SINK_MS = FISHING_BITE_TUG_MS / 2
export const BITE_BRACE_MS = 50
// 浮きが沈む回数(CSS の反復回数)。その後は力んだまま釣り上げを待つ。E2E が CSS の反復回数と比べる
export const BITE_TUGS = 2
// かかった合図の 1 周期: [0,100) 待機, [100,150) tense, [150,250) bite, [250,300) tense
const BITE_TUG_STEPS: readonly FishingStep[] = [
  [BITE_SINK_MS - BITE_BRACE_MS, ''],
  [BITE_SINK_MS, '-tense'],
  [FISHING_BITE_TUG_MS - BITE_BRACE_MS, '-bite'],
  [FISHING_BITE_TUG_MS, '-tense'],
]

const FISHING_TIMELINES: Record<FishingPosePhase, FishingTimeline> = {
  casting: {
    steps: [
      [SWING_BEAT_MS, '-windup'],
      [SWING_BEAT_MS * 2, '-backswing'],
      [SWING_BEAT_MS * 3, '-cast'],
      [FISHING_SWING_MS, '-follow'],
    ],
    settled: '',
  },
  bite: {
    steps: Array.from({ length: BITE_TUGS }, (_, tug) =>
      BITE_TUG_STEPS.map(([end, suffix]): FishingStep => [end + tug * FISHING_BITE_TUG_MS, suffix])
    ).flat(),
    settled: '-tense',
  },
  landing: { steps: [[FISHING_PULL_MS, '-pull']], settled: '-hoist' },
  caught: { steps: [], settled: '-hoist' },
}

const fishingFrame = (
  phase: FishingPosePhase,
  reduceMotion: boolean,
  elapsedMs: number
): { suffix: FishingSuffix; animating: boolean } => {
  const { steps, settled } = FISHING_TIMELINES[phase]
  const step = reduceMotion ? undefined : steps.find(([end]) => elapsedMs < end)
  return step === undefined
    ? { suffix: settled, animating: false }
    : { suffix: step[1], animating: true }
}

export const playerPose = (
  state: MoveState,
  reduceMotion: boolean,
  fishing: FishingPosePhase | null = null,
  fishingElapsedMs = 0
) => {
  const walking = !reduceMotion && state.motion !== null && state.motion.progress < 0.5
  const side = state.facing === 'left' || state.facing === 'right'
  const direction = state.facing === 'left' ? 'right' : state.facing
  const frame = walking ? (!side && state.stride === 1 ? 2 : 1) : 0
  const rod = fishing === null ? null : fishingFrame(fishing, reduceMotion, fishingElapsedMs)
  return {
    key: rod === null ? `player-${direction}-${frame}` : `player-fish-${direction}${rod.suffix}`,
    flip: state.facing === 'left',
    animating: rod?.animating ?? false,
  }
}
