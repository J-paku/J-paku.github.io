// 池での釣りの統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { FISHING_BITE_MS, FISHING_CAST_MS, FISHING_LAND_MS } from '@/lib/village/fishing'
import { BITE_TUGS, FISHING_BITE_TUG_MS, FISHING_SWING_MS } from '@/lib/village/player-pose'
import {
  FRAME_MS,
  SLACK_MS,
  advanceUntil,
  focusVillage,
  isVisible,
  leaveRoom,
  readCell,
  runFor,
  villageFrame,
  villagePlayer,
  walk,
  worldLayer,
} from './village-walk.test-helper'
import {
  firstSeen,
  recordAttribute,
  recordFacing,
  recordLineMounts,
} from './village-walk-record.test-helper'
import { PHASE_CLOCKS, startVillageClock } from './village-time.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// E2E が見ていた池での釣りを、E2E からこの統合テストへ移したもの(ADR 0016 の「統合へ移す」)と、
// それが通らないフックの分岐を確かめる検査(describe の末尾)。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date。E2E の page.clock と同じく時間として替える)で止め、
// テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)、画面の A・B を押すのは CDP の Input で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('池での釣り', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa

  // 描いて、起動の覆いが外れたら枠へ焦点を置く(E2E の openVillage)。既定は E2E と同じ PC の 1280×720
  const openVillage = async (width = 1280, height = 720) => {
    await page.viewport(width, height)
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
  }

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  const fishing = text.fishing
  // 釣りのコマの名前(シートのキーの末尾)。向き d のキーは player-fish-{d}-{名前} で、構え(待ち)だけは
  // 末尾の無い player-fish-{d}。左向きは右向きのキーを反転して描く(時間割の正本は src/lib/village/player-pose.ts)
  type FishFacing = 'up' | 'down' | 'right'
  // 投げる 4 コマ。振りかぶり → 竿を後ろへ引く → 振り下ろす → 振り抜く。FISHING_SWING_MS を 4 等分して順に出す
  const CAST_FRAMES = ['windup', 'backswing', 'cast', 'follow'] as const
  // かかった合図。張る(tense)と引かれる(bite)
  const BITE_FRAMES = ['tense', 'bite'] as const
  // 釣り上げ。引き上げる(pull)と掲げる(hoist)
  const LAND_FRAMES = ['pull', 'hoist'] as const
  const fishKey = (facing: FishFacing, frame?: string) =>
    frame === undefined ? `player-fish-${facing}` : `player-fish-${facing}-${frame}`
  // 投げてから結果窓が出るまでに、初めて描かれる順のコマ。投げる 4 コマ → 構え → かかった合図 → 釣り上げ
  const firstSeenPoses = (facing: FishFacing) => [
    ...CAST_FRAMES.map(frame => fishKey(facing, frame)),
    fishKey(facing),
    ...BITE_FRAMES.map(frame => fishKey(facing, frame)),
    ...LAND_FRAMES.map(frame => fishKey(facing, frame)),
  ]
  // そのうち投げている間(構えのコマで止まるまで)の分
  const castPoses = (facing: FishFacing) => firstSeenPoses(facing).slice(0, CAST_FRAMES.length + 1)

  // 水面に出る 1 枚(浮き → 巻物)と、竿の先から浮きへ渡る糸。どちらも E2E と同じ取っ手で引く
  const floatEl = () => document.querySelector<HTMLElement>('[data-village-float]')
  const lineEl = () => document.querySelector<HTMLElement>('[data-village-line]')
  const floatPhase = () => floatEl()?.dataset.floatPhase
  const sprite = () => villagePlayer().dataset.sprite
  // 吹き出し。kind を渡すと台詞(speech)か考え事(thought)の一方だけ
  const bubbles = (kind?: 'speech' | 'thought') => [
    ...document.querySelectorAll<HTMLElement>(
      kind === undefined
        ? '[data-village-bubble]'
        : `[data-village-bubble][data-village-bubble-kind="${kind}"]`
    ),
  ]
  const bubbleWith = (words: string, kind?: 'speech' | 'thought') =>
    bubbles(kind).find(bubble => (bubble.textContent ?? '').includes(words)) ?? null
  const promptBubble = () => bubbleWith(fishing.prompt)
  const thoughtBubble = () => bubbleWith(fishing.exhausted, 'thought')
  // 枠の下端の案内文(role=status)と、枠に重ねる窓
  const speech = () => page.getByRole('status').element().textContent ?? ''
  const dialog = page.getByRole('dialog')
  const dialogText = () => dialog.query()?.textContent ?? ''

  // 自宅前 (14,12) から池のほとり (5,13) へ。横道 y12 は道が続き、その 1 段下 y13 も道。
  // 池は x0-5/y14-19 なので、(5,13) の真下 (5,14) が水面になる。着いた時の向きは下(= 水面)
  const goToPondShore = async () => {
    await leaveRoom(setId)
    await walk(setId, 'ArrowLeft', 9)
    await walk(setId, 'ArrowDown', 1)
  }

  // 直接投げる入力の経路。E2E は ja を Z、ko を吹き出しのボタンで通す。ここは言語ではなく経路で 2 本に分ける
  type CastVia = 'key' | 'bubble'
  const castFrom = async (via: CastVia) => {
    if (via === 'key') {
      await userEvent.keyboard('z')
      return
    }
    const bubble = promptBubble()
    if (bubble === null) throw new Error('水辺の吹き出しが無い')
    await page.elementLocator(bubble).getByRole('button', { name: fishing.go }).click()
  }
  const CAST_INPUTS: readonly { via: CastVia; label: string }[] = [
    { via: 'key', label: 'Z キー' },
    { via: 'bubble', label: '吹き出しのボタン' },
  ]

  for (const { via, label } of CAST_INPUTS) {
    test(`池の吹き出しから直接投げると経験が釣れる(${label}で投げる)`, async () => {
      await openVillage()
      await goToPondShore()
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
      // 水は通れないので、もう一度下を押しても足は止まったまま向きだけ水面へ向く
      await walk(setId, 'ArrowDown', 1)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
      expect(isVisible(promptBubble()), '水辺の吹き出し').toBe(true)
      expect(dialog.query()).toBeNull()
      expect(floatEl()).toBeNull()
      expect(lineEl()).toBeNull()
      // 短いモーションも取りこぼさず、実際に描かれたコマを記録する。
      // 糸も差し込まれた瞬間の見え方を記録する(投げる前に掛けないと最初の 1 本を見逃す)
      const poses = recordAttribute(villagePlayer(), 'data-sprite')
      const lineMounts = recordLineMounts(worldLayer())
      await castFrom(via)
      await expect.poll(() => dialog.query(), { message: '投げても窓は出ない' }).toBeNull()
      await expect
        .poll(() => promptBubble(), { message: '投げたら水辺の吹き出しを下ろす' })
        .toBeNull()
      await expect.poll(speech).toContain(fishing.cast)
      // 投げた先の水のマスに浮きが出る。糸は浮きと同時に置かれる。この要素を控え、かかった後も同じ要素のままかを後で見る
      // (作り直されると隠す動きが頭からやり直しになり、かかった瞬間に糸が一度消える)
      await expect.poll(floatPhase).toBe('casting')
      const castLine = lineEl()
      expect(castLine, '投げている間の糸').not.toBeNull()
      // 投げる 4 コマを順に描き、構えのコマで止まる
      await advanceUntil(() => sprite() === fishKey('down'), '構えのコマで止まる')
      expect(firstSeen(poses).slice(0, CAST_FRAMES.length + 1), '投げる 4 コマと構え').toEqual(
        castPoses('down')
      )
      // 竿を振り終えると、竿の先から浮きまで糸が見える(振っている間は隠れている)。
      // 隠すのは CSS の動き(実時間)なので、見えるまでは本物の時計で待つ
      await expect.poll(() => isVisible(lineEl()), { timeout: SLACK_MS }).toBe(true)
      expect(lineEl()?.dataset.lineFacing, '水面を向いた下向きの糸').toBe('down')
      // 見えるようになる前、差し込まれた瞬間は隠れていた。2 本以上差し込まれていても落ちる
      expect(lineMounts, '差し込まれた瞬間の糸の見え方').toEqual(['hidden'])
      // 隠していたのは竿を振る長さ(FISHING_SWING_MS)の動き。長さは計算値が秒で返る
      expect(getComputedStyle(castLine ?? document.body).animationDuration).toBe(
        `${FISHING_SWING_MS / 1000}s`
      )
      // 投げている間は窓が無くても移動が止まる(押しても保存された位置が変わらない)
      await walk(setId, 'ArrowUp', 1)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
      // かかると浮きが沈む絵へ差し替わる。糸は沈んだ浮きへ渡ったまま
      await advanceUntil(
        () => speech().includes(fishing.bite),
        'かかった合図の文言',
        FISHING_CAST_MS + SLACK_MS
      )
      await expect.poll(floatPhase).toBe('bite')
      // 浮きが沈む合図は、主人公が引かれる合図の 1 周期と同じ長さで、引かれる回数だけ繰り返す
      const floatStyle = getComputedStyle(floatEl() ?? document.body)
      expect(floatStyle.animationDuration).toBe(`${FISHING_BITE_TUG_MS / 1000}s`)
      expect(floatStyle.animationIterationCount).toBe(String(BITE_TUGS))
      // 投げている間の糸がそのまま残っている = 作り直されず、同じ要素のまま沈んだ浮きへ渡っている
      expect(lineEl(), 'かかった後も投げた時と同じ糸').toBe(castLine)
      expect(isVisible(lineEl()), 'かかった後の糸').toBe(true)
      // そのあと巻物が水から跳ね、浮いている間だけ会話窓が「釣り上げた」に変わる
      await advanceUntil(
        () => /landing|caught/.test(floatPhase() ?? ''),
        '巻物が跳ねる',
        FISHING_BITE_MS + SLACK_MS
      )
      // 巻物が跳ねた後は浮きが無いので、糸も消える
      expect(lineEl()).toBeNull()
      expect(speech()).toContain(fishing.landed)
      // 釣れた中身は機能一覧から選ぶので題は決まらない。場所名で結果窓だと分かる。巻物は窓の裏に残したまま
      await advanceUntil(
        () => dialogText().includes(fishing.caughtPlace),
        '結果窓',
        FISHING_LAND_MS + SLACK_MS
      )
      expect(floatPhase()).toBe('caught')
      expect(lineEl()).toBeNull()
      // 結果窓が出ている間は竿を掲げたコマのまま
      expect(sprite()).toBe(fishKey('down', 'hoist'))
      // ここまでに描かれたコマは、投げる 4 コマ・構え・かかった合図(張る・引かれる)・釣り上げ(引き上げる・掲げる)で、
      // それ以外は一瞬も出ていない
      expect(firstSeen(poses).toSorted()).toEqual(firstSeenPoses('down').toSorted())
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      // 閉じれば水面が片付き、主人公も歩行コマ(下向きの待ち)へ戻る
      expect(floatEl()).toBeNull()
      expect(lineEl()).toBeNull()
      await advanceUntil(() => sprite() === 'player-down-0', '歩行コマ(下向きの待ち)へ戻る')
      // 錠も外れ、また歩ける
      await walk(setId, 'ArrowUp', 1)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 12 } })
    }, 30_000)

    test(`すべて釣り上げた後は、水辺で考え事の吹き出しが出てもう投げない(${label}で投げる)`, async () => {
      const total = villageJa.catches.length
      // 中身が無いと 1 回も投げずに後半の確認へ進み、何も確かめないまま通ってしまう
      expect(total).toBeGreaterThan(0)
      await openVillage()
      await goToPondShore()
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
      // まだ釣っていない物を先に出すので、機能の数だけ投げれば全部が揃う。
      // どれが釣れるかは乱数で決まるので題は見ず、揃った瞬間の文言だけを見る
      for (let count = 1; count <= total; count += 1) {
        // 揃うまでは台詞の吹き出しのまま。考え事は出ない
        expect(isVisible(promptBubble()), `${count} 匹目の前の水辺の吹き出し`).toBe(true)
        expect(thoughtBubble()).toBeNull()
        await castFrom(via)
        await expect.poll(speech).toContain(fishing.cast)
        await runFor(FISHING_CAST_MS)
        await expect.poll(speech).toContain(fishing.bite)
        await runFor(FISHING_BITE_MS)
        await expect.poll(floatPhase).toMatch(/landing|caught/)
        // 最後の 1 匹で揃った時だけ complete。それまでは普段の釣り上げ文。
        // complete は landed を中に含む(「すべての経験を…」)ので、揃う前は complete でないことも見る
        expect(speech()).toContain(count === total ? fishing.complete : fishing.landed)
        if (count < total) expect(speech()).not.toContain(fishing.complete)
        await runFor(FISHING_LAND_MS)
        await expect.poll(dialogText).toContain(fishing.caughtPlace)
        // 最後の 1 匹の結果窓は、もう投げないので「もう一度投げると…」の一言を出さない
        if (count === total) expect(dialogText()).not.toContain(fishing.caughtHook)
        else expect(dialogText()).toContain(fishing.caughtHook)
        await dialog.getByRole('button', { name: text.close }).click()
        await expect.element(dialog).not.toBeInTheDocument()
        expect(floatEl()).toBeNull()
        await runFor(FRAME_MS * 2)
      }
      // 揃えて閉じると、水辺の吹き出しはボタン付きの台詞からボタンの無い考え事へ替わる
      expect(isVisible(thoughtBubble()), '考え事の吹き出し').toBe(true)
      expect(thoughtBubble()?.querySelectorAll('button').length).toBe(0)
      expect(bubbles('speech')).toEqual([])
      // Z と E を押しても投げない。竿を持つコマが一瞬でも出たら記録に残る
      const poses = recordAttribute(villagePlayer(), 'data-sprite')
      villageFrame().focus()
      await userEvent.keyboard('z')
      await runFor(FRAME_MS * 2)
      expect(floatEl()).toBeNull()
      expect(speech()).not.toContain(fishing.cast)
      await userEvent.keyboard('e')
      await runFor(FRAME_MS * 2)
      expect(floatEl()).toBeNull()
      expect(speech()).not.toContain(fishing.cast)
      // 投げていれば結果窓が出ている頃まで時計を進めてから、窓も竿のコマも出ていないことを見る
      await runFor(FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS)
      expect(dialog.query()).toBeNull()
      expect(floatEl()).toBeNull()
      expect(sprite()).not.toMatch(/player-fish-/)
      expect(firstSeen(poses).filter(pose => pose.startsWith('player-fish-'))).toEqual([])
      // 錠は掛かっていない。1 マス離れて水に背を向けると考え事は消え、戻って水面を向けばまた出る
      await walk(setId, 'ArrowUp', 1)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 12 } })
      expect(thoughtBubble()).toBeNull()
      await walk(setId, 'ArrowDown', 1)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
      expect(isVisible(thoughtBubble()), '戻った水辺の考え事の吹き出し').toBe(true)
      expect(bubbles('speech')).toEqual([])
    }, 60_000)

    test(`池の中へは踏み込めず、東の岸から左の水面へ投げると糸と主人公を左右反転して描く(${label}で投げる)`, async () => {
      await openVillage()
      await goToPondShore()
      await walk(setId, 'ArrowDown', 1)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
      // 東の岸 (6,15) からも同じ。左隣 (5,15) は水面
      await walk(setId, 'ArrowRight', 1)
      await walk(setId, 'ArrowDown', 2)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 6, y: 15 } })
      await walk(setId, 'ArrowLeft', 1)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 6, y: 15 } })
      // 足は止まったまま左の水面を向いているので、ここからも投げられる。糸は右向きの絵を左右反転して渡す
      expect(isVisible(promptBubble()), '東の岸の水辺の吹き出し').toBe(true)
      // 主人公も左向きは右向きのシートを反転して描く。投げる前からコマが替わるたびに控える
      const facing = recordFacing(villagePlayer())
      await castFrom(via)
      await expect.poll(() => isVisible(lineEl()), { timeout: SLACK_MS }).toBe(true)
      expect(lineEl()?.dataset.lineFacing).toBe('left')
      // インラインの scaleX(-1) は計算値では行列で返る
      expect(getComputedStyle(lineEl() ?? document.body).transform).toBe(
        'matrix(-1, 0, 0, 1, 0, 0)'
      )
      await advanceUntil(
        () => dialogText().includes(fishing.caughtPlace),
        '結果窓',
        FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS + SLACK_MS
      )
      // 投げてから結果窓が出るまでに描いたコマは、どれも右向きの釣りのシートを反転したもの。
      // 釣りのコマを 1 つも描かずに通っていないよう、段階ごとに止まるコマ(構え・張る・掲げる)が反転して記録にあることも見る
      expect(
        facing.filter(entry => !/^player-fish-right(-[a-z]+)?:flip$/.test(entry)),
        '右向きの釣りのシート・反転以外で描いたコマ'
      ).toEqual([])
      for (const pose of [fishKey('right'), fishKey('right', 'tense'), fishKey('right', 'hoist')]) {
        expect(facing, `${pose} も反転して描いた`).toContain(`${pose}:flip`)
      }
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      expect(lineEl()).toBeNull()
    }, 30_000)
  }
})
