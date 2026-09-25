// 地点の文言の引き先を 1 か所に集める。吹き出し・行き先の案内・地図の一覧が同じ関数で引く。
// action を持つ地点(時計・釣り場)は会話窓を開かないので text.stops を持たず、専用の欄を見る。
// ここを通さずに text.stops[id] を直接引くと、action の地点で undefined を踏んで落ちる
import type { Spot, VillageText } from '@content/types/world'

// 地点名
export const placeName = (text: VillageText, spot: Spot): string =>
  spot.action === 'clock'
    ? text.clock.place
    : spot.action === 'fishing'
      ? text.fishing.place
      : text.stops[spot.id].place

// 地点に立った時の呼びかけ。地点ごとの文言があればそれ、無ければ arriveAt に場所名を入れる。
// 釣り場の地点は地点の吹き出しを出さず水辺の吹き出し(waterBubble)にまとめるので、ここへは来ない
export const arriveSpeech = (text: VillageText, spot: Spot): string =>
  spot.action === 'clock'
    ? text.clock.arrive
    : (text.stops[spot.id].arrive ?? text.arriveAt.replace('{place}', placeName(text, spot)))

// 吹き出しの行動ボタン(A)の文言。釣り場の地点は arriveSpeech と同じ理由でここへ来ない
export const talkLabelOf = (text: VillageText, spot: Spot): string =>
  spot.action === 'clock' ? text.clock.talk : (text.stops[spot.id].talk ?? text.talk)

// 地点へ向かう時の案内「〇〇へ向かいます」
export const headToSpeech = (text: VillageText, spot: Spot): string =>
  text.headTo.replace('{place}', placeName(text, spot))
