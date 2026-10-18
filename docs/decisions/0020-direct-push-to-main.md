---
status: historical
read_when:
  - ブランチと PR を通して main へ取り込む形に戻したくなったとき
  - CI をどのきっかけ(push・PR)で走らせるかを変えたくなったとき
  - main のブランチ保護を変えたくなったとき
source_of_truth: false
last_reviewed: 2026-10-18
---

# 0020. PR の方式をやめ、`main` へ直接 push して push のときの CI で検査する

## Status

Accepted(2026-10-18、利用者の決定)。`main` へ直接 push し、検査は push のときの CI に任せる。
2026-10-13 の `d9e6045` から続けていた、`main` への PR でも CI を走らせ、依存の版と `.github/workflows/` の変更を PR の CI が通ってから取り込む形と、
GitHub の設定で `main` に掛けていた PR の必須をやめる([Context](#context)の2つ目)。
`main` に入る前に CI で止める段が無くなるので、[0011](0011-extreme-constraints.md) の、制約を下げるには ADR が要るという決まりと同じ趣旨で、このADRで決める。

CI の段(`.github/workflows/deploy.yml` の build ジョブ)と、`deploy` ジョブの `needs: build` は変えない

## Context

決める前(`0910cf4`)のこのリポジトリは次の状態だった。

- **`main` への PR でも CI が走っていた。** `d9e6045`(2026-10-13)が `.github/workflows/deploy.yml` に `pull_request`(`main`)のトリガーを足し、
  PR では `upload-pages-artifact` の段と `deploy` ジョブを `if: github.event_name != 'pull_request'` で飛ばしていた。
  `concurrency` の組は、PR なら PR 番号ごと(`pr-<番号>`)、push と `workflow_dispatch` なら `pages` に分けていた
- **`main` にはブランチ保護を掛けていた。** PR を必須にし、必須の検査に `build` を置き、force push とブランチの削除を禁じ、管理者にも同じものを掛けていた。
  これは GitHub の設定で、リポジトリの中には写しが無い。変える前の状態(PR の必須と必須の検査 `build`)は、2026-10-13 に設定した記録(リポジトリの外)に拠る。
  変えた後の状態(Decision の3。PR の必須と必須の検査が無く、force push・削除の禁止と管理者への適用が残っていること)は、2026-10-18 に `gh api repos/J-paku/J-paku.github.io/branches/main/protection` で確かめた
- **依存の版と `.github/workflows/` の変更は、PR を開いてその PR の CI が通ってから取り込んでいた**(当時の [../agents/verification.md](../agents/verification.md))。
  手元で CI を再現するのは、CI が落ちた原因を追うときだけだった
- Dependabot(`.github/dependabot.yml`)の PR も、取り込む前にその PR の CI が通ったことを確かめていた

2026-10-18、利用者が「PR の方式を無くす」と決めた。理由の記録は無い

## Decision

1. **`main` へ直接 push する。** ブランチを切って PR で取り込む形はやめる
2. **CI は `main` への push と `workflow_dispatch` のときだけ走らせる。** `.github/workflows/deploy.yml` から、`pull_request` のトリガーと、PR のためだけにあったもの
   (`concurrency` の組を PR 番号で分ける式、`upload-pages-artifact` の段と `deploy` ジョブの `if: github.event_name != 'pull_request'`)を消す。`concurrency` の組は `pages` の1つになる
3. **`main` の保護から、PR の必須と必須の検査(`build`)を外す。** GitHub の設定で、2026-10-18 に変えた
4. **push の前に手元で走らせるものは [../agents/verification.md](../agents/verification.md) に従う。** どの変更でも commit の直前に `npm run verify` を1回通し、表が指すものを足す。
   依存の版と `.github/workflows/` を変えたときは、PR の CI の代わりに、push の前に [../operations/deployment.md](../operations/deployment.md) の「ローカルで CI を再現する」のコマンドを全部通す
   (`d9e6045` の前の決まりに戻す。このコマンドが CI の段と同じではないことは [Consequences](#consequences))

次のものは残す。

- `main` の保護のうち、force push の禁止・ブランチの削除の禁止・管理者にも掛けること
- push のときの CI の全部。build ジョブの段は1つも減らさない
- `deploy` ジョブの `needs: build`。build ジョブが通らなければ配信しない
- 権限の分け方。最上位は `contents: read` だけで、`pages: write`・`id-token: write` は `deploy` ジョブにだけ渡す

## Consequences

- **壊れたコミットも先に `main` に入る。** CI が落ちるのは `main` に入った後になる。
  `deploy` ジョブは `needs: build` なので壊れた版は配信されないが、直すコミットを push して CI が通るまで、`main` の先頭は壊れたままで、配信も止まる
- **Dependabot の PR には CI が走らない。** Dependabot は今も PR を開くが、その PR では検査が走らない。
  取り込む前に [../operations/deployment.md](../operations/deployment.md) の「ローカルで CI を再現する」のコマンドを全部通す([../agents/verification.md](../agents/verification.md) の表の「依存の版」の行)
- **依存の版・ワークフローの変更も、`main` に入る前に試せるのは手元の再現だけになる。** 手元の再現のコマンドは CI の段の写しで、CI そのものではない。
  2026-10-18 の時点で、そのコマンドの列([../operations/deployment.md](../operations/deployment.md))には変異テストが無く、統合テストも `--coverage` を付けずに走らせている
- `concurrency` の組が `pages` の1つだけになるので、`main` への連続 push では後の1本だけが生き残る(PR を入れる前と同じ)
- 切り戻しは今までどおり `git revert` して push する([../operations/deployment.md](../operations/deployment.md) の「反映されない・戻したい」)

## Alternatives Considered

- **PR の方式を続ける**(2026-10-13 からの形) — 利用者が退けた
- ほかに比べた案の記録は無い
