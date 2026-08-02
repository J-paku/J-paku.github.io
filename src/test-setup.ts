import '@testing-library/jest-dom/vitest'

// jsdom 29.1.1 は HTMLDialogElement の showModal/close を実装していない(実測: 両者ともtype undefined)。
// CommandPaletteのテストを走らせるための最小限のシムであり、フォーカストラップ・inert化の
// 正しさは一切保証しない(それらは実ブラウザ側のPlaywright検証で担保する)。
// showModalはopen属性を立てるだけ、closeはopen属性を下ろしてcloseイベントを飛ばすだけの実装
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, _returnValue?: string): void {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
