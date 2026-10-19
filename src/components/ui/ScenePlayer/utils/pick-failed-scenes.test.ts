// 取得に失敗した場面を選ぶ(pick-failed-scenes)のテスト。失敗した URL を持つ場面の id だけが選ばれ、
// 同じ id でも URL が替わった場面と、並びに無い URL の失敗は選ばれないかを見る
import { describe, expect, it } from 'vitest'
import { pickFailedScenes } from './pick-failed-scenes'

const scenes = [
  { id: 'scene-1', image: '/s1.svg' },
  { id: 'scene-2', image: '/s2.svg' },
  { id: 'scene-3', image: '/s3.svg' },
]

describe('pickFailedScenes', () => {
  it('失敗した URL を持つ場面の id だけを、場面の順に選ぶ', () => {
    const failed = pickFailedScenes(scenes, new Set(['/s3.svg', '/s1.svg']))

    expect([...failed]).toEqual(['scene-1', 'scene-3'])
  })

  it('同じ id でも URL が替わった場面は、前の URL が失敗していても選ばない', () => {
    const nextScenes = [scenes[0], { id: 'scene-2', image: '/s2-v2.svg' }, scenes[2]]

    expect([...pickFailedScenes(nextScenes, new Set(['/s2.svg']))]).toEqual([])
  })

  it('失敗が無ければ、どの場面も選ばない', () => {
    expect([...pickFailedScenes(scenes, new Set())]).toEqual([])
  })
})
