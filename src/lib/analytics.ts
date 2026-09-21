// GoatCounter への送信はこのファイルに集約する(preferences.ts と並ぶ外部境界)。
// 計測タグ本体は src/app/html-shell.tsx が読み込み、ページ読み込み時の1件はタグ自身が送る。
// next/link による移動はタグから見えないので、PageviewCounter がこの関数で2件目以降を送る。
// Cookie は使わず、IP と User-Agent のハッシュで8時間セッションを判定するため、日別ユニークがそのまま取れる

type GoatCounter = {
  count?: (vars: { path: string }) => void
}

declare global {
  interface Window {
    goatcounter?: GoatCounter
  }
}

// count.js は async 読み込みで、広告ブロックに弾かれることもある。
// 計測は落ちてよい機能なので、未ロード時は何もせず黙って返す
export function countPageview(path: string): void {
  window.goatcounter?.count?.({ path })
}
