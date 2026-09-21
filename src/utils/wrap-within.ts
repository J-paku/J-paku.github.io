// 範囲外の値を巡回させて丸める。時計の針は一周する作りなので、-1 時は 23 時・25 時は 1 時が自然。
// 針を動かす側(ClockModal)と時刻を受け取る側(use-village-time)で同じ丸め方を使うため、
// 剰余の式はここ 1 か所だけに置く(片方だけ直すと窓の表示と空の段階が食い違う)
export const wrapWithin = (value: number, span: number): number => ((value % span) + span) % span
