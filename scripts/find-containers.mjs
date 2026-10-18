// コンポーネントのフォルダの入口 index.tsx がコンテナかを決める判定の正本(ADR 0024。ADR 0019 の「フックを呼ぶ部品は container.tsx」を置き換えた)。
// check-test-boundary.mjs・check-layers.mjs・check-coverage-ignores.mjs・check-hook-rule.mjs が同じものを使う。
//
// 決まり: コンポーネントのフォルダの入口は、いつも index.tsx(container.tsx という名前は使わない。あれば check-test-boundary.mjs が落とす)。
// コンテナは次のどちらかの index.tsx で、ほかの index.tsx は表示部品(同じ props なら同じ画面)。
//   (a) src/components の下の index.tsx(hooks/ と __tests__/ の中は除く。下の isEntryCandidate)で、フックを使うもの
//   (b) I/O コンテナの一覧(scripts/container-dirs.mjs)のフォルダの index.tsx(フックを使わなくても。外の世界に触れてよい所なので)
// (a) の index.tsx は ESLint の規則 layer/hook-only-in-container が外れる所と同じ(eslint.config.mjs。合うかは scripts/check-hook-rule.mjs が見る)。
// 表示部品がフックを呼び始めるとコンテナになり、統合テストが無ければ check-test-boundary.mjs が落とす。
//
// 「フックを使う」は、ESLint の規則(scripts/eslint-rules/hook-only-in-container.mjs)が報告するものと同じものを数える:
//   - フックの呼び出し。呼ぶ相手の名前が HOOK_NAME(規則と同じ /^use[A-Z0-9]/)に合うもの。useX(…)・React.useX(…)・React['useX'](…)・
//     ?. の呼び出し・型の書き方で包んだ呼ぶ相手(useX!(…)・(useX as T)(…)・useX<T>(…) など)も同じ名前で見る
//   - フックを別の名前で受ける所(import { useState as s }・const s = useState・s = React.useState・(s = useState) => …・
//     const { useState: s } = React・({ useState: s } = React)・({ useLabel: label }) => …)。規則は index.tsx で外れるので、
//     別の名前で受けてから呼ぶ形(const s = useState の後の s(0))をここで数えないと、フックを呼ぶ index.tsx が表示部品に見えてしまう
// 同じ名前で受けるもの(import { useState } from 'react'・const { useState } = React)と型だけの import は数えない(呼べば上の呼び出しで数える)。
// 規則と同じ断片で同じ名前を拾うかは scripts/check-hook-rule.mjs が突き合わせる(ESTree と TypeScript の構文木で別に書いているので、ずれを落とす)。
//
// TypeScript の構文木で読む(正規表現だと注釈・文字列の中の useX( を拾う)。読み方の壊れは、読み込んだ時に下の「自己検査」で落とす。
//
// 使い方: import { CONTAINER_ENTRY, isEntryCandidate, isContainer, hookUsesOf } from './find-containers.mjs'
import ts from 'typescript'
import { HOOK_NAME } from './eslint-rules/hook-only-in-container.mjs'
import { TESTS_DIR } from './container-dirs.mjs'
import { parseSource } from './read-imports.mjs'

// コンポーネントのフォルダの入口(コンテナも表示部品もこの名前)
export const CONTAINER_ENTRY = 'index.tsx'
// フックを使えばコンテナになる入口を置くフォルダの根
const COMPONENTS_DIR = 'src/components'

// src/components の下の index.tsx で、hooks/ と __tests__/ の中でないもの(フックを使えばコンテナになる入口)。
// hooks/ の中は use-*.ts(x) のフックだけを置く所で、__tests__/ の中はテストの側なので入口に数えない(どちらの index.tsx も ESLint の規則が掛かる)
export const isEntryCandidate = file => {
  if (!file.startsWith(`${COMPONENTS_DIR}/`)) return false
  const parts = file.split('/')
  if (parts.at(-1) !== CONTAINER_ENTRY) return false
  return !parts.slice(0, -1).some(part => part === 'hooks' || part === TESTS_DIR)
}

// I/O コンテナの一覧のフォルダの index.tsx か。ioDirs は scripts/container-dirs.mjs の CONTAINER_DIRS(自己検査では偽の一覧)
export const isIoContainer = (file, ioDirs) =>
  ioDirs.some(dir => file === `${dir}/${CONTAINER_ENTRY}`)

// フックの名前か
const isHookName = name => name !== undefined && HOOK_NAME.test(name)

// 呼ぶ相手・受ける値を包むだけの式(括弧・as・!・satisfies・<T>x・x<T>)。中身の名前で見る
const unwrap = node =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isTypeAssertionExpression(node) ||
  ts.isExpressionWithTypeArguments(node)
    ? unwrap(node.expression)
    : node

// 文字列で書いた名前('useX'・`useX`)。名前で書けないものは undefined
const literalNameOf = node =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined

// 呼ぶ相手・受ける値の名前。識別子はその名前、メンバーは右端の名前(obj.useX・obj['useX']・obj[`useX`])。名前で書けないものは undefined
const memberNameOf = node => {
  const inner = unwrap(node)
  if (ts.isIdentifier(inner)) return inner.text
  if (ts.isPropertyAccessExpression(inner))
    return ts.isIdentifier(inner.name) ? inner.name.text : undefined
  if (ts.isElementAccessExpression(inner)) return literalNameOf(inner.argumentExpression)
  return undefined
}

// 分割のキーの名前({ useX: s }・{ 'useX': s }・{ ['useX']: s })。名前で書けないキーは undefined
const keyNameOf = key => {
  if (key === undefined) return undefined
  if (ts.isIdentifier(key)) return key.text
  if (ts.isComputedPropertyName(key)) return literalNameOf(key.expression)
  return literalNameOf(key)
}

// 分割代入の左辺(({ useX: s } = o) の { useX: s })の中のオブジェクト・配列か
const isAssignmentPattern = node => {
  const { parent } = node
  if (ts.isBinaryExpression(parent)) {
    return parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.left === node
  }
  if (ts.isPropertyAssignment(parent)) {
    return parent.initializer === node && isAssignmentPattern(parent.parent)
  }
  if (ts.isArrayLiteralExpression(parent) || ts.isSpreadElement(parent)) {
    return isAssignmentPattern(parent)
  }
  if (ts.isForOfStatement(parent) || ts.isForInStatement(parent)) return parent.initializer === node
  return false
}

// 1 ファイルでフックを使う所を、規則の報告と同じ形で出る順に返す(呼び出しは「useX」、別の名前で受ける所は「useX as 受ける名前」)
export const hookUsesOf = (file, code) => {
  const source = parseSource(file, code)
  const found = []
  // 値を受ける側の名前。識別子はその名前、既定値付き(s = fallback)はその左。分割などの形は書いたままの文字
  const receiverOf = node => {
    if (ts.isIdentifier(node)) return node.text
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return receiverOf(node.left)
    }
    return node.getText(source)
  }
  // フック name を receiver で受けている。受ける名前が同じなら、その後の呼び出しで数えるので数えない
  const addAlias = (name, receiver) => {
    const alias = receiverOf(receiver)
    if (alias !== name) found.push(`${name} as ${alias}`)
  }
  // 受ける値がフックの名前の識別子かメンバーなら、受ける側を数える(const s = useState・s = React.useState)
  const checkValue = (receiver, value) => {
    const inner = unwrap(value)
    const isName =
      ts.isIdentifier(inner) ||
      ts.isPropertyAccessExpression(inner) ||
      ts.isElementAccessExpression(inner)
    const name = isName ? memberNameOf(inner) : undefined
    if (isHookName(name)) addAlias(name, receiver)
  }
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const name = memberNameOf(node.expression)
      if (isHookName(name)) found.push(name)
    } else if (ts.isImportSpecifier(node)) {
      const clause = node.parent.parent
      const typeOnly = node.isTypeOnly || clause.phaseModifier === ts.SyntaxKind.TypeKeyword
      const name = keyNameOf(node.propertyName ?? node.name)
      if (!typeOnly && isHookName(name)) addAlias(name, node.name)
    } else if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      if (node.initializer !== undefined) checkValue(node.name, node.initializer)
    } else if (ts.isBindingElement(node)) {
      // 分割の中のキー(const { useX: s } = …・({ useX: s }) => …)と、既定値({ s = useState })
      if (ts.isObjectBindingPattern(node.parent) && node.propertyName !== undefined) {
        const name = keyNameOf(node.propertyName)
        if (isHookName(name)) addAlias(name, node.name)
      }
      if (node.initializer !== undefined) checkValue(node.name, node.initializer)
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      checkValue(node.left, node.right)
    } else if (ts.isPropertyAssignment(node) && isAssignmentPattern(node.parent)) {
      // 分割代入の中のキー(({ useX: s } = …))
      const name = keyNameOf(node.name)
      if (isHookName(name)) addAlias(name, node.initializer)
    } else if (
      ts.isShorthandPropertyAssignment(node) &&
      node.objectAssignmentInitializer !== undefined &&
      isAssignmentPattern(node.parent)
    ) {
      // 分割代入の中の既定値(({ s = useState } = …))
      checkValue(node.name, node.objectAssignmentInitializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

// フックを1つでも使うか
const usesHooks = (file, code) => hookUsesOf(file, code).length > 0

// file がコンテナか。ioDirs は I/O コンテナの一覧、readCode はパス → 中身(フックを使えばコンテナになる入口だけを読む)
export const isContainer = (file, ioDirs, readCode) =>
  isIoContainer(file, ioDirs) || (isEntryCandidate(file) && usesHooks(file, readCode(file)))

// ---- 自己検査 ----
// 入口の判定・フックの数え方・I/O コンテナの判定が壊れると(いつも false を返すなど)、フックを呼ぶ index.tsx が表示部品に見えて、
// 統合テストの無いコンテナも、置き場の決まりの外のコンテナも「違反なし」で通る。そこでコンテナと分かっている断片と
// 表示部品と分かっている断片を、使う側と同じ関数でメモリの上で判定し、期待と違えば読み込んだ時点で落とす
const FAKE_IO_DIRS = ['src/components/Screen', 'src/components/ui/Player']
const ENTRY = 'src/components/A/index.tsx'
// [パス, 中身, コンテナか]
const CASES = [
  // フックの呼び出し(型引数・React. ・[…] で引く形・?. ・型の書き方で包んだもの・入れ子の関数の中)
  [ENTRY, `const ref = useRef<HTMLDivElement>(null)`, true],
  [ENTRY, `const [a] = React.useState(0)`, true],
  [ENTRY, `const id = React['useId']()`, true],
  [ENTRY, `useState?.(0)`, true],
  [ENTRY, `const a = (useState as typeof useState)(0)`, true],
  [ENTRY, `const a = useState!(0)`, true],
  [ENTRY, `const shape = use3d()`, true],
  [ENTRY, `export default function A() {\n  const f = () => useLabel()\n  return f\n}`, true],
  // 別の名前で受ける所
  [ENTRY, `import { useState as state } from 'react'\nconst [a] = state(0)`, true],
  [ENTRY, `const s = useState\nconst [a] = s(0)`, true],
  [ENTRY, `const { useState: s } = React`, true],
  [ENTRY, `let s\ns = React.useState`, true],
  [ENTRY, `export const pick = () => ({ useState: s } = React)`, true],
  [ENTRY, `function A({ useLabel: label }) {\n  return label\n}`, true],
  // I/O コンテナの一覧のフォルダの index.tsx は、フックを使わなくてもコンテナ
  ['src/components/Screen/index.tsx', 'export default function Screen() {}', true],
  ['src/components/ui/Player/index.tsx', '', true],
  // 表示部品(フックを使わない・注釈と文字列の中・use()・memo() など・同じ名前で受けるだけ・型だけ)
  [ENTRY, 'export default function A() {\n  return null\n}', false],
  [ENTRY, `// useState(0)\nconst label = 'useState(0)'`, false],
  [ENTRY, `/* const [a] = useState(0) */\nconst shown = \`useRef()\``, false],
  [ENTRY, `const value = use(promise)\nconst A = memo(forwardRef(Base))`, false],
  [ENTRY, `user()\nuseless()\nconst view = <A useLabel={label} />`, false],
  [ENTRY, `import { useState } from 'react'\nconst { useRef } = React`, false],
  [
    ENTRY,
    `import type { useState as State } from 'react'\nimport { type useRef as Ref } from 'react'`,
    false,
  ],
  [ENTRY, `const value = { useLabel: label }\ntype Load = typeof useState`, false],
  // フックを使っても、入口でないもの(もとの container.tsx・index.ts・hooks/ と __tests__/ の中・src/components の外・名前の前の方が同じだけのフォルダ)
  ['src/components/A/container.tsx', 'const [a] = useState(0)', false],
  ['src/components/A/index.ts', 'const [a] = useState(0)', false],
  ['src/components/A/hooks/index.tsx', 'const [a] = useState(0)', false],
  ['src/components/A/__tests__/index.tsx', 'const [a] = useState(0)', false],
  ['src/app/x/index.tsx', 'const [a] = useState(0)', false],
  ['src/componentsX/A/index.tsx', 'const [a] = useState(0)', false],
  ['src/components/ScreenX/index.tsx', '', false],
]
const selfCheckFailures = CASES.filter(
  ([file, code, expected]) => isContainer(file, FAKE_IO_DIRS, () => code) !== expected
).map(([file, code, expected]) => `${file} ${JSON.stringify(code)} → ${expected}`)
if (selfCheckFailures.length > 0) {
  throw new Error(
    `find-containers: 自己検査に失敗(期待と違う判定): ${selfCheckFailures.join(', ')}`
  )
}
