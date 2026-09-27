// ミニマップの点の印と拡大地図の ✓/? の字が共用する印の色

// 会話地点の印。訪問済みの緑は地図の草(#6bb36a)と紛れないよう濃くする。
// 拡大地図の ✓/? の字(WorldMap の components/SpotGlyph)と番号の札(world-map.module.css の .badge)も同じ緑・黒を使う
export const MARKER_COLORS = {
  visited: '#2f9e44',
  unvisited: '#1a1a18',
  plate: '#fff',
  plateEdge: '#1a1a18',
} as const
