// フックを呼んでよい所を決める ESLint の規則 layer/hook-only-in-container(docs/decisions/0019-hooks-make-containers.md)。
//
// 決まり: フックを1つでも呼ぶ部品はコンテナで、ファイルの名前は container.tsx。それ以外の部品は表示部品で、フックを1つも呼ばない
// (同じ props なら同じ画面になる)。フックの呼び出しは、呼ぶ相手の名前が /^use[A-Z0-9]/ に合う呼び出しのこと。
// useX(…) も React.useX(…) も数え、React の組み込みのフック(useState・useEffect・useRef・useMemo・useId など)も例外にしない。
// memo()・forwardRef() はフックではない。use() も名前が合わないので数えない。
//
// なぜ: ファイル別100%のカバレッジの門が掛かるのは container.tsx と hooks/ の中だけで、表示部品は全体の下限にしか入らない(ADR 0019)。
// 表示部品がフックを呼ぶと、状態とその移り変わりがその門の外に出る。フックを呼ぶかどうかをファイルの名前で分かるようにして、
// 状態を持つ部品が必ず門の内側に来るようにする。
//
// 見るのは名前だけ。[…] で引く形(React['useX'](…))・?. の呼び出し・型の書き方で包んだ呼ぶ相手(useX!(…)・(useX as T)(…) など)も同じ名前で見る。
// 名前だけで見るので、フックを別の名前で受けてから呼ぶと(const s = useState の後の s(0))呼び出しを数えられない。
// そこでフックの名前を別の名前で受ける所も報告する:
//   - import { useState as state } from 'react'(import する名前がフックで、受ける名前が違う)
//   - const s = useState・const s = React.useState・s = useState・既定値の (s = useState) => …(受ける値がフックの名前の識別子かメンバー)
//   - const { useState: s } = React・関数の引数の ({ useLabel: label })(分割で、フックの名前のキーを別の名前で受ける)
// 同じ名前で受けるもの(import { useState } from 'react'・const { useState } = React)は、その後の呼び出しが上で数えられるので報告しない。
// 型だけの import(import type { … }・import { type … })は値にならず呼べないので見ない。
// 受ける形だけを見るので、値として渡す形(f(useState)・[useState]・{ s: useState }・export { useState as s })は見ない。
// どこに掛け、どこで外すか(コンテナ・hooks/ の use-*.ts(x)・テストの側・2段階目までの待ちの一覧)は eslint.config.mjs が決める。
// 判定と掛け方が壊れていないか、注釈で黙らせた呼び出しが無いかは scripts/check-hook-rule.mjs(npm run test:boundary)が確かめる。

// フックの名前。呼ぶ相手の名前がこの形ならフック
const HOOK_NAME = /^use[A-Z0-9]/
// 呼ぶ相手を包むだけの式。中身の名前で見る
const WRAPPERS = new Set([
  'ChainExpression',
  'TSAsExpression',
  'TSInstantiationExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
])

// 報告の文面。落ちた人がこのファイルを開かなくても直し方が分かるように書く
const FIX =
  'フックを呼んでよいのは、コンテナ(container.tsx)と hooks/ の中の use-*.ts(x) だけ(ADR 0019)。' +
  '状態を持つ部品なら、このファイルを同じフォルダのコンテナ container.tsx にする(index.tsx は残さず、import する側は …/<名前>/container を指す)。' +
  '持たない部品なら、フックを呼ばない表示部品(同じ props なら同じ画面)に直し、値は props で受け取る。' +
  '部品でない関数なら、コンテナの隣の hooks/ か src/hooks/ の use-*.ts(x) に移す'
const MESSAGE = `フック {{name}}() を呼んでいる。${FIX}`
const ALIAS_MESSAGE = `フック {{name}} を別の名前 {{alias}} で受けている(別の名前で呼ぶと、フックの呼び出しとして数えられない)。${FIX}`

const unwrap = node => (WRAPPERS.has(node.type) ? unwrap(node.expression) : node)

// [] で引くキーや、キーの欄の文字列の名前(['useX']・[`useX`]・'useX')。名前で書けないものは undefined
const literalNameOf = node => {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis[0].value.cooked
  return undefined
}

// 呼ぶ相手の名前。識別子はその名前、メンバーは右端の名前(obj.useX・obj['useX']・obj[`useX`])。名前で書けない相手は undefined
const calleeNameOf = node => {
  const callee = unwrap(node)
  if (callee.type === 'Identifier') return callee.name
  if (callee.type !== 'MemberExpression') return undefined
  const { computed, property } = callee
  if (!computed) return property.type === 'Identifier' ? property.name : undefined
  return literalNameOf(property)
}

// フックの名前か
const isHookName = name => name !== undefined && HOOK_NAME.test(name)

// 値を受ける側の名前。識別子はその名前、既定値付き(s = fallback)はその左。分割などの形は書いたままの文字
const aliasOf = (node, sourceCode) => {
  if (node.type === 'Identifier') return node.name
  if (node.type === 'AssignmentPattern') return aliasOf(node.left, sourceCode)
  return sourceCode.getText(node)
}

// 分割のキーの名前({ useX: s }・{ 'useX': s }・{ ['useX']: s })。名前で書けないキーは undefined
const keyNameOf = ({ computed, key }) => {
  if (!computed && key.type === 'Identifier') return key.name
  return literalNameOf(key)
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'フックを呼んでよいのはコンテナ(container.tsx)と hooks/ の use-*.ts(x) だけ(ADR 0019)',
    },
    schema: [],
    messages: { hookCall: MESSAGE, hookAlias: ALIAS_MESSAGE },
  },
  create: context => {
    const { sourceCode } = context
    // フック name を receiver で受けている。受ける名前が同じなら、その後の呼び出しで数えるので報告しない
    const reportAlias = (node, name, receiver) => {
      const alias = aliasOf(receiver, sourceCode)
      if (alias !== name) {
        context.report({ node, messageId: 'hookAlias', data: { name, alias } })
      }
    }
    // 受ける値がフックの名前の識別子かメンバーなら、受ける側を報告する(const s = useState・s = React.useState)
    const checkValue = (node, receiver, value) => {
      const inner = unwrap(value)
      if (inner.type !== 'Identifier' && inner.type !== 'MemberExpression') return
      const name = calleeNameOf(inner)
      if (isHookName(name)) reportAlias(node, name, receiver)
    }
    return {
      CallExpression: node => {
        const name = calleeNameOf(node.callee)
        if (isHookName(name)) {
          context.report({ node: node.callee, messageId: 'hookCall', data: { name } })
        }
      },
      ImportSpecifier: node => {
        if (node.importKind === 'type' || node.parent.importKind === 'type') return
        const name =
          node.imported.type === 'Identifier' ? node.imported.name : literalNameOf(node.imported)
        if (isHookName(name)) reportAlias(node, name, node.local)
      },
      VariableDeclarator: node => {
        if (node.init !== null) checkValue(node, node.id, node.init)
      },
      AssignmentExpression: node => {
        if (node.operator === '=') checkValue(node, node.left, node.right)
      },
      // 既定値(引数の (s = useState) => …・分割の { s = useState })
      AssignmentPattern: node => checkValue(node, node.left, node.right),
      // 分割の中のキー(const { useX: s } = …・({ useX: s }) => …・({ useX: s } = …))
      'ObjectPattern > Property': node => {
        const name = keyNameOf(node)
        if (isHookName(name)) reportAlias(node, name, node.value)
      },
    }
  },
}

export default rule
