// 工程バッジの表示名(careerRoleLabels)の単体テスト。経歴パネルと村の釣果が同じ表を引くので、
// 工程と名前の取り違えと、工程名でない文言の混入を見る
import { describe, expect, it } from 'vitest'
import type { CareerRole, UiStrings } from '@content/types/content'
import { careerRoleLabels } from './career-role-labels'

// careerRoleLabelsが読むのはcareerだけなので、UI文字列はcareer以外を持たせずに組む。
// 担当/担当外の読み上げ文言(roleOwned・roleNotOwned)にも値を入れ、表へ混ざったら見分けが付くようにする
const uiWithRoles = (names: Record<CareerRole, string>): UiStrings =>
  ({
    career: {
      openDetail: '詳しく',
      tabDetail: '担当業務',
      backToWorks: '作品へ戻る',
      roleDesign: names.design,
      roleBuild: names.build,
      roleRelease: names.release,
      roleOwned: '担当',
      roleNotOwned: '担当外',
    },
  }) as Partial<UiStrings> as UiStrings

// タプル: [説明, 工程ごとの名前]。3つとも違う値にして、designにroleBuildを当てるような取り違えを値で捕まえる
const cases: Array<[string, Record<CareerRole, string>]> = [
  ['日本語の名前', { design: '設計', build: '実装', release: 'リリース' }],
  ['韓国語の名前', { design: '설계', build: '구현', release: '릴리스' }],
]

describe('careerRoleLabels', () => {
  it.each(cases)('%s: 工程ごとに同じ工程の名前を当て、3工程以外の鍵を持たない', (_label, names) => {
    expect(careerRoleLabels(uiWithRoles(names))).toStrictEqual(names)
  })
})
