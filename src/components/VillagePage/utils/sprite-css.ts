// スプライトシートの配信 URL・段階ごとの背景規則・Village へ渡す配置情報を組む純粋関数
import type { Sheet, SheetLayout } from '@/lib/pixel/art'
import { sheetFileName, SHEET_DIR } from '@/lib/pixel/sheet-file'
import type { SheetKind } from '@/lib/pixel/sheet-file'
import { DAY_PHASES, type DayPhase } from '@/utils/day-phase'

// 既定(属性なし)を昼にするので、規則を足すのは昼以外の段階だけ。手書きの一覧にすると
// 段階が増えたとき規則の無いまま配信されてしまうため、必ず DAY_PHASES から導く
const NON_DEFAULT_PHASES: readonly DayPhase[] = DAY_PHASES.filter(phase => phase !== 'day')

// シートの置き場は public/sprites/<種類>-<段階>-<指紋>.png(焼くのは scripts/build-sprites.mjs)。
// data URI をやめたのは、同じ base64 が <style> と hydration の払い出しへ二重に載り、
// index.html の 73% が base64 になっていたため(実測 37,424 / 93,822 バイト)。
// 実ファイルなら HTML から消えて画像としてキャッシュされる。
// 名前の作り方は sheet-file.ts の sheetFileName が唯一の正本。ここと build-sprites.mjs が
// 同じ関数を呼ぶので、URL と焼き出し先がすれ違うことが無い。
// 指紋を名前へ入れるのは、HTML(index・count を載せている)と PNG が別々にキャッシュされる
// ためで、名前が固定だと「新しい HTML × 古い PNG」で町中の絵がずれる(詳細は sheet-file.ts)。
// 名前が実体とずれたら out/ に参照先が無くなるので verify-export が落とす
export const sheetUrl = (kind: SheetKind, phase: DayPhase): string =>
  `/${SHEET_DIR}/${sheetFileName(kind, phase)}`

// preload は入れない。実測で割に合わなかった(Slow 3G / 300ms 往復の2条件・各3回):
// (1) 段階を決めるインラインスクリプトから preload を挿す案 — 要求の開始が 788〜826ms で、
//     入れない場合の 800〜839ms と変わらない。body のスクリプトも背景画像の解決も、
//     同じ「head の CSS が届くまで待つ」に引っかかるので前倒しにならない。HTML は +254 バイト(gzip)
// (2) head に昼の2枚だけ preload を置く案 — 昼の帯(24時間中10時間)では効く(Slow 3G で
//     シート到着が 8,702ms → 3,973ms)が、残り14時間は時間が変わらないまま 3.4KB を捨て、
//     「preloaded but not used」の警告が出る。得をするのは
//     「動きを控える設定 × 400kbps 級 × 昼の帯」だけで、損は全訪問の58%が払う
// (3) 昼の1枚だけ data URI で残す案 — 計測した内訳では昼の2枚ぶんで約 7.3KB(gzip)を
//     毎ページ・毎訪問で配ることになる。1回で済む 3,419 バイトの取得と引き換えにはできない
// 入れない場合の実測: 既定(動きを控えない)は覆いが外れる 554〜619ms 前にシートが届く。
// 動きを控える設定(覆いが 300ms)かつ Slow 3G のときだけ 69〜95ms 遅れる

// 背景はこの規則 1 本で解析させる(要素ごとの var() 展開は避ける)。
// 町の684要素にカスタムプロパティ経由でURIを配ると再解析で約1秒止まる(実測)ため、
// 段階の切替もこの<style>1本で済ませる。既定は昼、他の段階は data-phase の分だけ詳細度を上げて上書きする
// クラス名は呼び出し側(VillagePage)が import した scene.module.css をそのまま受け取る。
// ここで import すると scene.module.css の出力位置が動き、CSS の出力順が変わる。
// 主人公の絵は体の箱より大きい画布なので、箱(.player)ではなく箱からはみ出す::beforeへ当てる
export const spriteBackgroundCss = (sceneStyles: Readonly<Record<string, string>>): string => {
  const base = `.${sceneStyles.sprite}{background-image:url('${sheetUrl('sprite', 'day')}')}.${sceneStyles.player}::before{background-image:url('${sheetUrl('player', 'day')}')}`
  const overrides = NON_DEFAULT_PHASES.map(phase => {
    const scope = `.${sceneStyles.root}[data-phase='${phase}']`
    return `${scope} .${sceneStyles.sprite}{background-image:url('${sheetUrl('sprite', phase)}')}${scope} .${sceneStyles.player}::before{background-image:url('${sheetUrl('player', phase)}')}`
  }).join('')
  return base + overrides
}

export const sheetLayout = ({ index, count, tile, height }: Sheet): SheetLayout => ({
  index,
  count,
  tile,
  height,
})
