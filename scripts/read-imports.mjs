// src と __tests__ のファイルの import を TypeScript の構文木で読む(check-layers.mjs と check-test-boundary.mjs が使う)。
// 正規表現で読むと、注釈・文字列の中の import を拾い、型だけの import と実行時に読み込まれる import を分けられないため。
// 判定が壊れていないかは、使う側の自己検査が偽のファイルで確かめる。
//
// require('…') の呼び出しは集めない。ESLint の @typescript-eslint/no-require-imports が src の全部で落とす
// (2026-10-14 に src の部品・フック・utils・テストの設定を npx eslint --print-config で見て、どれも 2(エラー)だった)。
// import x = require('…') の形は TypeScript の import なので集める。
//
// 使い方: import { parseSource, importsOf } from './read-imports.mjs'
import ts from 'typescript'

// 1 ファイルを構文木にする。親をたどれるようにする(check-layers.mjs の大域の名前の判定が親の欄を見る)
export const parseSource = (file, code) => {
  const kind = /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind)
}

// import 文の型だけの判定。import type と、波括弧の中が全部 type 付きのものだけが型だけ。
// 既定の import・名前空間の import・何も取り出さない import(副作用だけ)は実行時に読み込まれる
const isTypeOnlyImport = clause => {
  if (clause === undefined) return false
  if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return true
  if (clause.name !== undefined) return false
  const bindings = clause.namedBindings
  if (bindings === undefined || !ts.isNamedImports(bindings)) return false
  return bindings.elements.length > 0 && bindings.elements.every(element => element.isTypeOnly)
}

// export ... from の型だけの判定。export * と export * as は実行時に読み込まれる
const isTypeOnlyExport = node => {
  if (node.isTypeOnly) return true
  const clause = node.exportClause
  if (clause === undefined || !ts.isNamedExports(clause)) return false
  return clause.elements.length > 0 && clause.elements.every(element => element.isTypeOnly)
}

// 1 ファイルの import を { specifier, typeOnly } で返す。式で組んだ動的 import の指定子は undefined
export const importsOf = source => {
  const found = []
  const visit = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({
        specifier: node.moduleSpecifier.text,
        typeOnly: isTypeOnlyImport(node.importClause),
      })
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push({ specifier: node.moduleSpecifier.text, typeOnly: isTypeOnlyExport(node) })
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      found.push({ specifier: node.moduleReference.expression.text, typeOnly: node.isTypeOnly })
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [first] = node.arguments
      const literal = first !== undefined && ts.isStringLiteralLike(first)
      found.push({ specifier: literal ? first.text : undefined, typeOnly: false })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
