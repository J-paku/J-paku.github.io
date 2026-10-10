---
status: historical
read_when:
  - 変異テストの走らせ方(commit の前・push・全体)を変えたくなったとき
  - CI の変異テストが前回の結果を引き継いでよいか迷ったとき
source_of_truth: false
last_reviewed: 2026-10-11
---

# 0013. 変異テストは push ごとに変わった変異体だけを走らせ、全体は週1回手で走らせる

## Status

Accepted(2026-10-11、利用者の決定)。[0011](0011-extreme-constraints.md)が門に置いた変異テスト(`npm run test:mutation`)の走らせ方だけを決める。
対象(`stryker.config.mjs`の`mutate`)としきい値(`break` 100)は0011のまま

## Context

- 0011で変異テストをCIの門に加え、pushのたびに対象の変異体を全部走らせていた(`.github/workflows/deploy.yml`)
- 2026-10-11の手元の実測で、全体の実行は6分7秒かかり、そのうち最初のテスト実行の準備が192秒だった
- 0011は「下限を下げる・テストを消す・`mutate`から外す」に新しいADRを求めている。pushごとに全部を走らせる形から変わった変異体だけを走らせる形へ移すと、
  見る範囲が狭まる(下の[Consequences](#consequences))ので、このADRで決める

## Decision

変異テストを3段で走らせる。利用者が、業界で一般的な形として決めた。

1. **commitの前(pre-commit)には走らせない。** gitのフックは置いていない(今も無く、そのまま)
2. **push(CI)では変わった変異体だけを走らせる。** StrykerJSの`incremental`で前回の結果をファイルに残して引き継ぎ、CIはそのファイルをキャッシュで持ち回る
   - 設定は`stryker.config.mjs`の`incremental`・`incrementalFile`。CIの段は`.github/workflows/deploy.yml`の`npm run test:mutation`の前後(`actions/cache/restore`・`actions/cache/save`)
   - キャッシュの鍵は、`package-lock.json`・`stryker.config.mjs`・`vitest.config.ts`の指紋とコミットのハッシュ。指紋が同じ鍵のうち最も新しい結果を復元する。
     指紋が変わる(依存・設定が変わる)と復元されず、全部が走る
   - 変異テストが落ちても結果は保存し、次のpushを速くする。取り消された実行は保存しない
   - キャッシュがまだ無い最初のpushでは、引き継ぐ結果が無いので全部が走る。利用者の要望(「最初なので最初のpushでは全部が走るべき」)のとおり
3. **全体の実行は週1回、手で`npm run test:mutation -- --force`を走らせる。** CIの`schedule`のワークフローは作らない。週1回の実行は、エージェントが覚えておいて利用者に知らせる

## Consequences

- **pushごとの変異テストは、前回から変わった所しか見ない。** `incremental`が前回と比べるのは`mutate`のファイルとテストファイルだけで、
  依存パッケージ・設定・`mutate`のファイルがimportする別のファイルが変わっても気付かず、前回の結果を使い回す
  - 依存パッケージと、Stryker・Vitestの設定の変更は、キャッシュの鍵の指紋で埋める(どれかが変わると全部が走る)
  - `mutate`のファイルがimportする別のファイルの変更は、鍵にも入らない。そこだけが変わったpushでは、変異体が新しく生き残っても次の全体の実行まで見落としうる
- **その穴を埋める全体の実行は人の手に頼る。** 週1回の`--force`を忘れると、上の見落としは残ったままになる
- しきい値は変えない。走らせた変異体と引き継いだ結果を合わせて`break` 100で判定する
- 速くなるのは変異体を走らせる部分だけで、最初のテスト実行は`incremental`でも毎回走る(Stryker 10.0.0は前回の結果と比べる前に最初のテスト実行を済ませる)。
  pushごとにどれだけ縮むかは、この記録の時点では測っていない
- 手元で`npm run test:mutation`を走らせたときも、同じ結果ファイル(`stryker.config.mjs`の`incrementalFile`。gitは追跡しない)を引き継ぐ。全部を測り直すときは`-- --force`を付ける

## Alternatives Considered

- **pushのたびに全部を走らせ続ける**(0011の時点の形) — 全体の実行が6分7秒かかることから、利用者が退けた
- **commitの前(pre-commit)に走らせる** — 利用者が採らないと決めた(上の3段の1)
- **週1回の全体の実行をCIの`schedule`のワークフローで走らせる** — 利用者が作らないと決めた。理由の記録は無い
- ほかに比べた案の記録は無い
