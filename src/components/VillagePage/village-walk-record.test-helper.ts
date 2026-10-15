// 村の統合テストで、短い間しか出ないコマ・印・押し離しを取りこぼさずに控える記録の道具。
// どれも MutationObserver と捕捉段のリスナー(DOM の API)で控え、読むのはテストの側。
// 時刻はページの performance.now()(偽の時計。歩行ループが経過を数えるのと同じ時計)で付ける。
// 同じ通知に同じ属性の書き換えが続けて入っていれば、その回に書かれた値は次の記録の「書き換え前の値」として読む
// (React と歩行ループが同じフレームで書き換えても、間の値を落とさない)。
// 観察とリスナーは、そのテストが終わる時(onTestFinished)に外す。次のテストへ持ち越さない
import { onTestFinished } from 'vitest'

// 観察を始め、テストの終わりに外す
const observe = (target: Node, callback: MutationCallback, options: MutationObserverInit) => {
  const observer = new MutationObserver(callback)
  observer.observe(target, options)
  onTestFinished(() => observer.disconnect())
}

// 窓へ捕捉段のリスナーを付け、テストの終わりに外す
const listen = <K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void
) => {
  const controller = new AbortController()
  window.addEventListener(type, listener, { capture: true, signal: controller.signal })
  onTestFinished(() => controller.abort())
}

// ある属性の書き換えを順に控える。values は書かれた値の並び(同じ値の重複も残す)
export type AttributeMark = { value: string; at: number }

// 書き換えごとに、その回に書かれた値を返す。後に同じ要素・同じ属性の記録が続けば、その oldValue がこの回の値
const writtenValues = (records: readonly MutationRecord[]) =>
  records.flatMap((record, index) => {
    const name = record.attributeName
    if (!(record.target instanceof Element) || name === null) return []
    const later = records
      .slice(index + 1)
      .find(next => next.target === record.target && next.attributeName === name)
    const value = (later === undefined ? record.target.getAttribute(name) : later.oldValue) ?? ''
    return [{ target: record.target, name, value }]
  })

// target の attribute が書き換わるたびに値と時刻を控える
export const recordAttribute = (target: Element, attribute: string): AttributeMark[] => {
  const marks: AttributeMark[] = []
  observe(
    target,
    records => {
      const at = performance.now()
      for (const { value } of writtenValues(records)) marks.push({ value, at })
    },
    { attributes: true, attributeOldValue: true, attributeFilter: [attribute] }
  )
  return marks
}

// 書かれた値を、初めて出た順に重複なしで並べる(E2E の data-observed-poses と同じ並び)
export const firstSeen = (marks: readonly AttributeMark[]) =>
  marks.reduce<string[]>((seen, { value }) => (seen.includes(value) ? seen : [...seen, value]), [])

// 主人公のコマか transform が替わるたびに「コマ:反転の有無」を控える。
// 両方とも歩行ループが同じフレームで書くので、通知を受けた時点の transform がそのコマを描いた時の向き
export const recordFacing = (player: HTMLElement): string[] => {
  const entries: string[] = []
  observe(
    player,
    () => {
      const pose = player.dataset.sprite ?? ''
      const flip = player.style.transform.includes('scaleX(-1)') ? 'flip' : 'none'
      entries.push(`${pose}:${flip}`)
    },
    { attributes: true, attributeFilter: ['data-sprite', 'style'] }
  )
  return entries
}

// ワールドの層へ糸が差し込まれた瞬間の見え方(計算値の visibility)を順に控える。
// 竿を振っている間は隠すので、差し込まれたその場では hidden のはず
export const recordLineMounts = (world: HTMLElement): string[] => {
  const mounts: string[] = []
  observe(
    world,
    records => {
      for (const node of records.flatMap(record => [...record.addedNodes])) {
        if (!(node instanceof Element) || !node.matches('[data-village-line]')) continue
        mounts.push(getComputedStyle(node).visibility)
      }
    },
    { childList: true }
  )
  return mounts
}

// ---- 傘の時系列 ----

// sprite は主人公の data-sprite、world はワールドの層の data-world、key は「keydown:ArrowUp」の形の押し離し
export type TimelineKind = 'sprite' | 'world' | 'key'
export type TimelineEntry = { kind: TimelineKind; value: string; at: number }

// root の下の主人公のコマ・ワールドの印と、キーの押し離しを 1 本の時系列に書き足す。
// 主人公の要素が入れ替わっても拾えるよう root の下を丸ごと見る。描く前に呼ぶ
export const recordTimeline = (root: Node): TimelineEntry[] => {
  const timeline: TimelineEntry[] = []
  observe(
    root,
    records => {
      const at = performance.now()
      for (const { target, name, value } of writtenValues(records)) {
        const isWorld = name === 'data-world'
        if (!isWorld && !target.matches('[data-village-player]')) continue
        timeline.push({ kind: isWorld ? 'world' : 'sprite', value, at })
      }
    },
    {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-sprite', 'data-world'],
    }
  )
  for (const type of ['keydown', 'keyup'] as const) {
    listen(type, event => {
      if (!event.repeat) {
        timeline.push({ kind: 'key', value: `${type}:${event.key}`, at: performance.now() })
      }
    })
  }
  return timeline
}

// ---- 押し離しの瞬間の印 ----

// 押し離し・クリックの瞬間に、飛行の影が飛んでいる印(data-flying)を出していたかを控える。
// 捕捉の段階で窓に付けるので村の枠より先に読む。クリックは key を 'click' として控える
export type KeyMark = { type: string; key: string; flying: string | null }
export const recordKeys = (): KeyMark[] => {
  const marks: KeyMark[] = []
  const flyingNow = () =>
    document.querySelector<HTMLElement>('[data-flight-shadow]')?.dataset.flying ?? null
  for (const type of ['keydown', 'keyup'] as const) {
    listen(type, event => {
      if (!event.repeat) marks.push({ type, key: event.key, flying: flyingNow() })
    })
  }
  listen('click', () => {
    marks.push({ type: 'click', key: 'click', flying: flyingNow() })
  })
  return marks
}

// key を押し下ろした時刻(performance.now())を控える。押した瞬間と、その前に写したフレームを突き合わせるのに使う
export const recordKeyDownTimes = (key: string): number[] => {
  const times: number[] = []
  listen('keydown', event => {
    if (event.key === key && !event.repeat) times.push(performance.now())
  })
  return times
}
