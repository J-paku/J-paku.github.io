// 一覧の画面(コンテナ)の、左列(ProfileColumn)の連絡先の統合テスト(Vitest Browser Mode)。一覧を実際の Chromium で、子と一緒に描き(ADR 0016)、
// 列の底の連絡先の面に、プロフィールが持つ連絡先(メールアドレス・GitHub)だけがリンクとして並ぶことを、リンクの行き先で確かめる。
// props は入口(src/app/directory-screen.tsx)と同じ組み方で index.fixture.ts が node で組み、inject で受け取る。
// 実データに無い形(連絡先を欠いたプロフィール)は、連絡先を差し替えた props の写しをテストが直接渡す
import { cleanup, render, within } from '@testing-library/react'
import type { ProfileLinks } from '@content/types/content'
import DirectoryContainer from '@/components/Directory'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import columnStyles from '@/components/Directory/components/ProfileColumn/profile-column.module.css'
import type { DirectoryData } from './index.fixture'
import {
  directoryJa,
  prepareEachTest,
  queryOrThrow,
  restoreEachTest,
} from './directory.test-helper'

const { profile } = directoryJa
const { email, github } = profile.links
// 前提: 実データのプロフィールはメールアドレスと GitHub の両方を持つ。片方を外した写しとの差で出し分けを見る
if (email === undefined || github === undefined) {
  throw new Error('メールアドレスとGitHubの両方を持つプロフィールがcontentに無い')
}

// 連絡先だけを差し替えた画面の props
const withLinks = (links: ProfileLinks): DirectoryData => ({
  ...directoryJa,
  profile: { ...profile, links },
})

const renderDirectory = (data: DirectoryData = directoryJa) =>
  render(<DirectoryContainer {...data} />)

// 列の底の連絡先の面。作品カードの下部パネルにも GitHub のリンクが並ぶので、面の中だけを見る
const contactCard = () => within(queryOrThrow(document.body, `.${columnStyles.out}`))
// 連絡先の面に並ぶリンクの行き先
const contactHrefs = () =>
  contactCard()
    .queryAllByRole('link')
    .map(link => link.getAttribute('href'))
// GitHub のリンクの文字。行き先の無い <a> はリンクとして数えられないので、文字が残っていないかも見る
const GITHUB_LABEL = 'GitHub'

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('左列の連絡先(ProfileColumn)', () => {
  it('メールアドレスとGitHubを持てば、メールの mailto のリンクと GitHub へのリンクをこの順に並べる', () => {
    renderDirectory()

    expect(contactHrefs()).toEqual([`mailto:${email}`, github])
  })

  it('メールアドレスを持たなければメールのリンクを出さず、GitHub のリンクだけを並べる', () => {
    renderDirectory(withLinks({ github }))

    expect(contactHrefs()).toEqual([github])
    expect(contactCard().queryByText(email)).toBeNull()
  })

  it('GitHubを持たなければ GitHub のリンクを出さず、メールのリンクだけを並べる', () => {
    renderDirectory(withLinks({ email }))

    expect(contactHrefs()).toEqual([`mailto:${email}`])
    expect(contactCard().queryByText(GITHUB_LABEL)).toBeNull()
  })
})
