---
status: active
read_when:
  - 村の地形・地点を足す/動かすとき
  - 作品や経歴を追加するとき
  - ビルドが「整合性検査に失敗」で落ちたとき
source_of_truth: false
last_reviewed: 2026-09-21
---

# 決まりごと

**この表の数値は写しである。正本は右列のファイル。** 破るとビルドか CI が落ちる。

## 村の大きさと歩数(`src/lib/content/validate-world.ts`)

| 決まり | 現在の値 | 理由 |
|---|---|---|
| 1ワールドの広さの上限 | `MAX_WORLD_WIDTH` × `MAX_WORLD_HEIGHT` | 全部歩いても1分かからない大きさに留める |
| 屋外の家の軒数の上限 | `MAX_HOUSES` | 同上 |
| 屋外の開始セルから各会話地点までの歩数 | `MAX_STEPS_TO_SPOT` 以内 | 訪問者を歩かせすぎない |

あわせて次も検査される。

- `tiles` の行数・列数が `width` / `height` と一致する
- 構造物 ID・地点 ID がそれぞれのワールド内で一意(地点が構造物と同じ ID を名乗るのは可)
- 家の `solid` が `area` の中にあり、扉 `doorX` が `area` の横幅の中にある
- 地点の立ち位置が通行可で、`structureId` の構造物が実在する
- ワープは足元か隣接マスから触れられ、移動先のワールドとマスが実在して通行可
- **`order` は全ワールド通しの `1..n` の連番**。欠けると次の地点の案内が途切れる
- `VillageText.stops` のキーが全ワールドの地点 ID と**過不足なく一致**する

## 会話地点のコース

現在のコースは5か所。`home`(自室)→ `meishi` → `lab` → `robot` → `mailbox` の順。

**`monument`(経歴碑)は `order` を持たない = コース外。** 次の地点の案内・訪問数・「5か所すべて見ました」の
判定から除かれる。話しかけと地図からの移動はできる。**コース外の地点を足すときは `order` を付けない。**

## コンテンツの対称性(`src/lib/content/validate.ts`)

- ja に在る `slug` は ko にも在る(逆も)
- 同じ `slug` の `status` / `story` の有無 / `detail` の有無 / 場面 ID の並びが ja と ko で一致する
- `content/ja/works/*.ts` の実ファイルと `read.ts` の登録表 `WORKS` が過不足なく一致する
- `profile.careers` の `id` の並びが ja と ko で一致する

## 画面の約束

- **wip 作品は詳細ページを作らない。** カードにリンクを付けず、slug への直接アクセスは 404(不変ルール5)
- `/works/<slug>/` が存在するのは `status: 'published'` かつ `story` を持つ作品だけ。列挙は `listStorySlugs`
- 村を操作しなくても同じ内容に届く。スキップリンクと作品ショートカットを消さない → [../quality/accessibility.md](../quality/accessibility.md)
- 自動再生・ループするモーションには必ず停止トグルを付ける(WCAG 2.2.2)。文言は `ui.work.pauseMotion` / `resumeMotion`
- 業務データが写るため**実画面のキャプチャを置かない。** 画面は自作 SVG で再現する → [../quality/security.md](../quality/security.md)
