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
// monument: cell(左上)から 2×2(経歴碑)、stele: cell(上のマス)から縦 1×2(コードのみ対応、現状は未設置) — いずれも通行不可
// lamp: 絵は cell(上のマス = 灯)から縦 1×2(下は柱)だが、通行不可は cell の 1 マスだけ(柱の足元は通れる)
// campfire: 1×1(ロボットの隣の焚き火) — 通行不可
// clock: 1×1(自室の小机に載せた卓上時計) — 通行不可
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
  | { id: string; kind: 'monument'; cell: Cell }
  | { id: string; kind: 'stele'; cell: Cell }
  | { id: string; kind: 'lamp'; cell: Cell }
  | { id: string; kind: 'campfire'; cell: Cell }
  | { id: string; kind: 'clock'; cell: Cell }
// 会話地点。cell = 立ち位置(通行可)。order は 1 始まりのコース順(全ワールド通し)。
// order が無い地点はコース外(次の地点・訪問数・完走判定からは除くが、話しかけ・地図表示・地図からの移動はできる)
export type Spot = {
  id: string
  structureId?: string // 建物の無い道の出口は arrivalArea だけを持つ
  arrivalArea?: Rect // この範囲に入ると会話窓を自動で開く
  cell: Cell
  facing: Direction
  order?: number
  // 話しかけると会話窓ではなく時計の設定窓を開く地点。order は付けず、訪問数にも数えない。
  // 文言は text.stops ではなく text.clock が持つ
  action?: 'clock'
}
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
  entries?: { logo: string; company: string; period: string; body: string }[] // 経歴などの一覧。logo は /logos/ 配下のパス。モーダルでは claim と proof の間に並べる
}

// 卓上時計の設定窓の文言。{time} は「18:00」のような時刻に置換
export type ClockText = {
  place: string // 地点名(吹き出し・読み上げ)
  arrive: string // 時計の前に立った時の吹き出し
  talk: string // 会話ボタン(A)の文言
  prompt: string // 1次: 「時計が置かれている。時間を設定しますか?」
  realtime: string // 選択肢: 現在時間
  custom: string // 選択肢: カスタム時間
  cancel: string // 選択肢: やめる
  setRealtime: string // 結果: 現在時間に設定した
  customIntro: string // 2次の見出し
  pick: string // 「時間を選んでください。」
  hourLabel: string // 時の読み上げ名
  minuteLabel: string // 分の読み上げ名
  prevHour: string // ◀(時を1つ戻す)の読み上げ名
  nextHour: string // ▶(時を1つ進める)
  prevMinute: string // 分を10分戻す
  nextMinute: string // 分を10分進める
  decide: string // 決定
  setCustom: string // 結果: カスタム時間を設定した。{time} を置換
  cancelled: string // 結果: 設定を取消した
}

// 釣りの文言。水辺の吹き出しと結果窓に使う
export type FishingText = {
  prompt: string // 水辺の吹き出し
  go: string // 吹き出しのボタン「釣る」
  exhausted: string // 全部を釣り上げた後、水辺で prompt の代わりに浮かぶ考え事の吹き出し(ボタン無し)
  cast: string // 投げた直後の会話窓「……」
  bite: string // 「何かがかかった!」
  landed: string // 釣り上げた瞬間の会話窓「経験を釣り上げた!」
  complete: string // 全部を初めて釣り上げた時だけ landed の代わりに出す「すべての経験を釣り上げた!」
  caughtPlace: string // 結果窓の場所名「釣り上げた経験」
  caughtClaim: string // {date} を機能の着手時期に置換
  caughtTech: string // {tech} を技術名(' / ' 区切り)に置換
  caughtRoles: string // {roles} を担当工程名('・' 区切り)に置換
  caughtHook: string // 結果窓の締めの一言
  caughtNext: string // 結果窓の次へ(作品一覧へのリンク)
}

export type VillageText = {
  intro: string // マップ上部の1行
  promise: string // 「1分・5か所・代表作3つ」の約束(intro の下)
  hint: string // 操作案内(会話窓の既定文)。キーボード向け
  hintTouch: string // 操作案内のタッチ向け(スティック・A・地図をタップ)。pointer: coarse で置き換える
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
  allSeen: string // 5 か所すべて話した後の案内。{list} は toList に置換
  buttonA: string // A ボタンの読み上げ名(決定)
  buttonB: string // B ボタンの読み上げ名(キャンセル)
  joystick: string // 仮想スティックの読み上げ名(タッチ端末)
  fishing: FishingText // 池での釣りの文言
  stops: Record<string, StopText> // spot.id → 文言
  clock: ClockText // 卓上時計の設定窓(action: 'clock' の地点の文言)
}
