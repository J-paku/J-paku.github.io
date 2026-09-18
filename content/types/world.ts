// 村マップの型定義。座標は左上原点の整数マス、tiles[y][x] で引く
// 表示文字列は content/{ja,ko}/village.ts が持ち、ここには型だけを置く

export type Direction = 'up' | 'down' | 'left' | 'right'
export type Cell = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }
// 屋外: 通行可 grass / grass-alt / path / plaza / flower、不可 water / tree(1マス) / fence
// 屋内: 通行可 floor / mat、不可 wall / doorway(doorway は壁の扉。ぶつかるとワープ)
export type Tile =
  | 'grass'
  | 'grass-alt'
  | 'path'
  | 'water'
  | 'plaza'
  | 'flower'
  | 'tree'
  | 'fence'
  | 'floor'
  | 'wall'
  | 'mat'
  | 'doorway'
export type RoofColor = 'red' | 'blue'
// house: area = 屋根行 + 壁行(見た目)、solid = 壁行(通行不可)。扉は最下段の壁で doorX の列
// robot: 1×1(AI 作業台の相棒ロボット)、mailbox: 1×1(郵便ポスト)
// desk: cell から 3×2(PC 机)、bed: cell から 1×2、table: cell から 2×2 — いずれも通行不可
export type Structure =
  | {
      id: string
      kind: 'house'
      roof: RoofColor
      area: Rect
      solid: Rect
      doorX: number
      doorWidth?: 1 | 2
    }
  | { id: string; kind: 'robot'; cell: Cell }
  | { id: string; kind: 'mailbox'; cell: Cell }
  | { id: string; kind: 'desk'; cell: Cell }
  | { id: string; kind: 'bed'; cell: Cell }
  | { id: string; kind: 'table'; cell: Cell }
// 会話地点。cell = 立ち位置(通行可)。order は 1 始まりのコース順(全ワールド通し)
export type Spot = { id: string; structureId: string; cell: Cell; facing: Direction; order: number }
// ワープ。cell に到着するか、通行不可な cell(扉)へぶつかったら target のワールド・マス・向きへ移る
export type Warp = {
  id: string
  cell: Cell
  target: { worldId: string; cell: Cell; facing: Direction }
}
export type LinkTarget = { kind: 'story'; slug: string } | { kind: 'external'; url: string }
export type World = {
  id: string
  // exterior だけがミニマップ・拡大地図を持つ
  kind: 'exterior' | 'interior'
  width: number
  height: number
  start: Cell
  startFacing: Direction
  tiles: Tile[][] // tiles[y][x]
  structures: Structure[]
  spots: Spot[]
  warps: Warp[]
}
// 村全体 = 複数ワールド。startWorldId のワールドの start から始まる
export type WorldSet = {
  id: string
  startWorldId: string
  worlds: Record<string, World>
}

// 会話地点 1 つ分の文言。link は任意(内部ルート or 外部)
export type StopText = {
  place: string // 場所名(吹き出し・地図・モーダル見出し)
  title: string // モーダルの一言見出し
  claim: string // 主張(1 文)
  proof: string // 根拠(1 文)
  hook: string // 次の場所へ誘う一言
  next: string // 次へボタンの文言
  detail: string // 補足段落
  arrive?: string // 到着の吹き出し。無ければ arriveAt に place を入れる
  talk?: string // 会話ボタンの文言。無ければ text.talk
  link?: { label: string; target: LinkTarget }
}

export type VillageText = {
  intro: string // マップ上部の1行
  promise: string // 「1分・5か所・代表作3つ」の約束(intro の下)
  hint: string // 操作案内(会話窓の既定文)
  noTarget: string // 近くに話せる地点が無い時の一言(E を押した時など)
  arriveAt: string // 地点到着の吹き出し。{place} を置換
  exitHint: string // 屋内で出口を案内する一言
  headTo: string // 次の目的地案内。{place} を置換
  talk: string // 「話を聞く」ボタン
  close: string // 閉じる
  openMap: string // ミニマップ/M の読み上げ名
  mapTitle: string // 拡大地図の見出し
  closeMap: string
  fastTravel: string // 地図の地点ボタン読み上げ名。{place} を置換
  visitedOf: string // 「{n} / {total} 訪問」
  skipVillage: string
  shortcuts: string
  toList: string
  toVillage: string
  buttonA: string // A ボタンの読み上げ名(決定)
  buttonB: string // B ボタンの読み上げ名(キャンセル)
  joystick: string // 仮想スティックの読み上げ名(タッチ端末)
  stops: Record<string, StopText> // spot.id → 文言
}
