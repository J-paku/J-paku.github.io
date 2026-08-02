// content/{locale}/ を集約し、並び替えと整合性検査を経て Content を組み立てるローダー。
// バレル(content/{loc}/index.ts)は作らず、import.meta.glob の列挙だけで
// 「デモ追加 = 作品ファイル1個追加」を成立させる
import type { CaseSectionKey, Content, Locale, Work } from '@/types/content'
import { CASE_SECTION_ORDER } from '@/types/content'
import { now as nowJa } from '@content/ja/now'
import { now as nowKo } from '@content/ko/now'
import { profile as profileJa } from '@content/ja/profile'
import { profile as profileKo } from '@content/ko/profile'
import { skills as skillsJa } from '@content/ja/skills'
import { skills as skillsKo } from '@content/ko/skills'
import { ui as uiJa } from '@content/ja/ui'
import { ui as uiKo } from '@content/ko/ui'

// glob のパターンは静的リテラルでなければならないため locale 分だけ並べる(補間不可)。
// 型引数にモジュール形状を与えることで any/unknown を経由せず Work 型のまま扱える
const JA_WORK_MODULES = import.meta.glob<Record<string, Work>>('/content/ja/works/*.ts', {
  eager: true,
})
const KO_WORK_MODULES = import.meta.glob<Record<string, Work>>('/content/ko/works/*.ts', {
  eager: true,
})

// dev では即throwして事故を作業中に潰す。本番はconsole.warnに留めて描画自体は継続する
const reportIntegrityIssue = (message: string): void => {
  if (import.meta.env.DEV) {
    throw new Error(message)
  }
  console.warn(message)
}

// ファイル名(拡張子抜き)と slug の一致を検査する。コピペでslugが残る事故をここで捕まえる
export const assertSlugMatchesFilename = (slug: string, filePath: string): void => {
  const filename = filePath.split('/').pop()?.replace(/\.ts$/, '')
  if (filename !== slug) {
    reportIntegrityIssue(
      `content-loader: ファイル "${filePath}" の slug "${slug}" がファイル名と一致しない`,
    )
  }
}

// 02-content.md の指摘の補完: CaseSection に key があっても配列の要素数は型で強制されない。
// published は CASE_SECTION_ORDER の7keyを過不足・重複なく持ち、wip は sections が空であることを実行時に検査する
export const assertSectionsIntegrity = (work: Work): void => {
  if (work.status === 'wip') {
    if (work.sections.length > 0) {
      reportIntegrityIssue(`content-loader: wip作品 "${work.slug}" は sections を持てない`)
    }
    return
  }

  const keys: CaseSectionKey[] = work.sections.map((section) => section.key)
  const uniqueKeys = new Set(keys)
  const matchesOrder =
    keys.length === CASE_SECTION_ORDER.length &&
    uniqueKeys.size === keys.length &&
    CASE_SECTION_ORDER.every((key) => uniqueKeys.has(key))

  if (!matchesOrder) {
    reportIntegrityIssue(
      `content-loader: 公開作品 "${work.slug}" の sections が CASE_SECTION_ORDER の7節と一致しない`,
    )
  }
}

// 1) published が先・wipが後 2) published同士はperiod降順(新しい方が上) 3) wip同士はslug昇順
// ハードコードしたslug一覧は持たない。ファイルを追加すればこの規則だけで並び順が決まる
export const sortWorks = (works: Work[]): Work[] =>
  [...works].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'published' ? -1 : 1
    }
    if (a.status === 'published') {
      return (b.period ?? '').localeCompare(a.period ?? '')
    }
    return a.slug.localeCompare(b.slug)
  })

const collectWorks = (modules: Record<string, Record<string, Work>>): Work[] => {
  const works = Object.entries(modules)
    .map((entry): Work | null => {
      const [filePath, moduleExports] = entry
      // export忘れのファイルは Object.values が空配列を返し、[0] は undefined になる。
      // 型を明示することで as に頼らず undefined 経由を追跡できるようにする
      const work: Work | undefined = Object.values(moduleExports)[0]
      if (!work) {
        reportIntegrityIssue(`content-loader: ファイル "${filePath}" に export が見つからない`)
        return null
      }
      assertSlugMatchesFilename(work.slug, filePath)
      assertSectionsIntegrity(work)
      return work
    })
    .filter((work): work is Work => work !== null)
  return sortWorks(works)
}

const CONTENT_BY_LOCALE: Record<Locale, Content> = {
  ja: {
    ui: uiJa,
    profile: profileJa,
    skills: skillsJa,
    now: nowJa,
    works: collectWorks(JA_WORK_MODULES),
  },
  ko: {
    ui: uiKo,
    profile: profileKo,
    skills: skillsKo,
    now: nowKo,
    works: collectWorks(KO_WORK_MODULES),
  },
}

// locale に対応する生の Content を返す。ja/ko の fallback 合成は行わない(use-content.ts が merge-content.ts 経由で担う)
export const loadContent = (locale: Locale): Content => CONTENT_BY_LOCALE[locale]
