// 昼夜の時間帯そのものの定義と、現在時刻から大阪(JST)の時間帯を判定する純粋関数
// DayPhaseの正本をここに置くのは、utils→libの一方向レイヤー境界(eslint)によりutilsからは
// lib(palette-phase.ts)を参照できないため。lib側はこのファイルから型を取り込む
// 訪問者のローカルタイムゾーンではなくUTCから計算するのは、村の舞台が大阪でJSTが
// 夏時間の無い固定オフセット(UTC+9)だから。こうすることで世界中どこから見ても同じ空になる

// 段階の一覧はこの組が唯一の正本。型は組から導くので、段階を足すとシート焼き・CSS規則・
// テストの網羅を手書き配列で持っている側が型エラーで落ちる(黙って未検証のまま出荷されない)
export const DAY_PHASES = ['dawn', 'day', 'dusk', 'night'] as const
export type DayPhase = (typeof DAY_PHASES)[number]

// 村の時刻(0〜23時)から段階を決める判定式の正本。実時刻と机上時計(利用者が一時的に
// 時刻を動かす仕掛け)で別々のしきい値を持たないよう、時だけを受け取る形にして1本に寄せてある
export const dayPhaseAtHour = (hour: number): DayPhase => {
  if (hour >= 5 && hour < 7) return 'dawn'
  if (hour >= 7 && hour < 17) return 'day'
  if (hour >= 17 && hour < 19) return 'dusk'
  return 'night'
}

export const dayPhaseAt = (now: Date): DayPhase => dayPhaseAtHour((now.getUTCHours() + 9) % 24)
