// グループキー→ui.commandPaletteのラベルの対応づけ。ラベルは常にcontent由来とし、
// src側に日本語・韓国語リテラルを書かない(不変ルール2)
import type { UiStrings } from '@/types/content'
import type { CommandGroupKey } from '../type'

export function getCommandGroupLabel(ui: UiStrings['commandPalette'], group: CommandGroupKey): string {
  switch (group) {
    case 'works':
      return ui.groupWorks
    case 'locale':
      return ui.groupLocale
    case 'theme':
      return ui.groupTheme
    case 'external':
      return ui.groupExternal
  }
}
