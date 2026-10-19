// 取得に失敗した画像の印へ、その画像の URL を足す(hooks/use-scene-sources.ts の状態の更新に渡す。id には URL が来る)。
// もう印があれば同じ集まりをそのまま返し、状態を変えない(描き直しを起こさない)。
// 無ければ URL を足した新しい集まりを返し、前の集まりは変えない
export const markFailed = (failed: ReadonlySet<string>, id: string): ReadonlySet<string> =>
  failed.has(id) ? failed : new Set(failed).add(id)
