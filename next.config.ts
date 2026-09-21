import path from 'node:path'
import type { NextConfig } from 'next'

// BudouX が import する linkedom(サーバ用の DOM 実装)を、ブラウザ向けの束でだけこの差し替えに置き換える。
// budoux の browser フィールドはどちらの束ね器も当てないため、放っておくと全ページ共通の束に linkedom 一式が入る。
// サーバ側(SSG)は元の linkedom のまま。理由の詳細は差し替え先のファイル冒頭にある
const LINKEDOM_BROWSER_STUB = './src/utils/linkedom-browser-stub.ts'

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
  // CI の next build(Turbopack)用。browser 条件はブラウザ向けの束の解決にだけ効く
  // このキーは消さない。Next 16 はフラグ無しの next build で webpack 関数があって turbopack キーが無いとエラーで終了する(next/dist/lib/turbopack-warning.js)
  turbopack: {
    resolveAlias: {
      linkedom: { browser: LINKEDOM_BROWSER_STUB },
    },
  },
  // ローカル検証の next build --webpack 用。isServer が false の束がブラウザ向け
  webpack: (config, { isServer, dir }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        linkedom: path.join(dir, LINKEDOM_BROWSER_STUB),
      }
    }
    return config
  },
}

export default nextConfig
