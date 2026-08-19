// GoatCounter への送信はこのファイルに集約する(preferences.ts と並ぶ外部境界)。
// 計測タグ本体は index.html が読み込む。Cookie は使わず、IP と User-Agent の
// ハッシュで8時間セッションを判定するため、日別ユニークがそのまま取れる

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
