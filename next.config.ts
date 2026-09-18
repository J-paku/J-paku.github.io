import type { NextConfig } from 'next'

// GitHub Pages へ静的配信する。リクエスト時に動くサーバは無いので export 固定。
// trailingSlash: true で /ko/list/ が out/ko/list/index.html として実ファイルになる
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // 開発サーバを LAN の実機(iPhone)から開くための許可。未設定だと Next 16 は localhost 以外の
  // オリジンからの /_next/* 取得を拒み、JS が届かずボタンだけ死ぬ(リンクは動く)。本番 export には無関係
  allowedDevOrigins: ['192.168.11.*', '192.168.*.*', '10.*.*.*'],
}

export default nextConfig
