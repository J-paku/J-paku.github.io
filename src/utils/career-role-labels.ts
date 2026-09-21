// 工程バッジの表示名。経歴パネルと村の釣果の双方が同じ表を要るので、写し違いを防ぐためここ一箇所で組む
import type { CareerRole, UiStrings } from '@content/types/content'

export const careerRoleLabels = (ui: UiStrings): Record<CareerRole, string> => ({
  design: ui.career.roleDesign,
  build: ui.career.roleBuild,
  release: ui.career.roleRelease,
})
