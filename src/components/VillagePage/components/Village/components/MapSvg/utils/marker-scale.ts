// 点の印を描くか(ミニマップ)・描かないか(拡大地図)を分ける縮尺の境目

// この縮尺より小さい地図(ミニマップの 4)は地点と扉を点で描く。
// これ以上(拡大地図の 16)は描かず、地図の上に重ねた地点のボタンが ✓/? の字と番号の札を持つ(WorldMap の components/SpotButton)
export const DOT_MARKER_SCALE_LIMIT = 8
