// ブラウザ向けの束でだけ、npm パッケージ linkedom の代わりに読み込まれる差し替え(next.config.ts の alias が指す)。
// BudouX は HTML を扱う部品のために linkedom(サーバ用の DOM 実装)を import しており、本来は
// budoux の package.json の browser フィールドが dom.js → dom-browser.js へ差し替えてブラウザ標準の DOMParser を使う。
// Turbopack も webpack もこの browser フィールドを当てないため、放っておくと linkedom 一式が全ページ共通の束に入る。
// ここは dom-browser.js と同じく window の DOMParser を渡すだけにする(dom.js が linkedom から取るのは DOMParser だけ)。
// 文節分割(Parser.parse)は DOM を使わないので、差し替えても分割結果は変わらない
export const DOMParser = globalThis.DOMParser
