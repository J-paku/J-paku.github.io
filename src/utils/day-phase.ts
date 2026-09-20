// 昼夜の時間帯そのものの定義と、現在時刻から大阪(JST)の時間帯を判定する純粋関数
// DayPhaseの正本をここに置くのは、utils→libの一方向レイヤー境界(eslint)によりutilsからは
// lib(palette-phase.ts)を参照できないため。lib側はこのファイルから型を取り込む
// 訪問者のローカルタイムゾーンではなくUTCから計算するのは、村の舞台が大阪でJSTが
// 夏時間の無い固定オフセット(UTC+9)だから。こうすることで世界中どこから見ても同じ空になる

// 段階の一覧はこの組が唯一の正本。型は組から導くので、段階を足すとシート焼き・CSS規則・
// テストの網羅を手書き配列で持っている側が型エラーで落ちる(黙って未検証のまま出荷されない)
export const DAY_PHASES = ['dawn', 'day', 'dusk', 'night'] as const
export type DayPhase = (typeof DAY_PHASES)[number]

export const dayPhaseAt = (now: Date): DayPhase => {
  const jstHour = (now.getUTCHours() + 9) % 24
  if (jstHour >= 5 && jstHour < 7) return 'dawn'
  if (jstHour >= 7 && jstHour < 17) return 'day'
  if (jstHour >= 17 && jstHour < 19) return 'dusk'
  return 'night'
}
