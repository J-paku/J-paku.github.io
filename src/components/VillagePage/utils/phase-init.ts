// 初回描画の前に Village の根の data-phase を実際の段階へ直すインラインスクリプトの本文
import { dayPhaseAt } from '@/utils/day-phase'

// 静的 HTML は昼で焼かれるので、hydration を待つと昼の村を見せてから夜へ飛ぶ。
// ブートの覆いは時間で外れるだけ(動きを控える設定では 300ms)なので隠し切れない。
// テーマと同じく、描画の前にインラインスクリプトで属性を書き換えて飛びを消す。
// 判定式の正本は dayPhaseAt。入力が UTC の「時」だけであることを使って 24 時間ぶんの答えを
// ここで焼き込み、スクリプト側は表を引くだけにする(判定を二重に書かない)
const PHASE_BY_UTC_HOUR = Array.from({ length: 24 }, (_, hour) =>
  dayPhaseAt(new Date(Date.UTC(2026, 0, 1, hour)))
).join(',')

// 直前の要素(= Village の根)に data-phase があるときだけ書き換える。
// この <script> は必ず <Village> の直後に置くこと
export const PHASE_INIT = `;(function(){try{var p='${PHASE_BY_UTC_HOUR}'.split(',');var s=document.currentScript;var el=s===null?null:s.previousElementSibling;if(el!==null&&el.hasAttribute('data-phase')){el.setAttribute('data-phase',p[new Date().getUTCHours()])}}catch(e){}})()`
