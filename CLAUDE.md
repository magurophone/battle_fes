# BATTLE FES 2026 Claude向けメモ

## 基本方針

このプロジェクトで作業するときは、必ず `PROGRESS.md` を見て現在の進捗を確認すること。

## 作業ルール

1. 作業前に `PROGRESS.md` を読んで状況を把握する
2. 実装を進めたら `PROGRESS.md` を更新する
3. 新しいタスクや未解決事項が出たら `PROGRESS.md` に追記する
4. 方針変更があれば理由も含めて記録する

## プロジェクト概要

- ColorSing の夏フェス向けイベントページ
- ベースは単一HTMLファイル `battlefes.html`
- 公開用は `public/index.html`
- Cloudflare Pages で公開

## 主なファイル

- `battlefes.html`
  - 編集用の元HTML
- `public/index.html`
  - 公開用HTML
- `PROGRESS.md`
  - 実装進捗、残タスク、チェックリスト
- `PROJECT_STATUS.md`
  - 現在の構成、公開状態、事故履歴を含む状況整理

## 現在の技術メモ

- 投票機能は Cloudflare Pages Functions + KV を利用
- 管理画面は `/admin/`
- 管理画面用の集計とコメントログ確認機能あり
- スコア計算: `投票数 × 2000pt + ColorSing ライブスコア`
  - 審査員なし。リスナー投票とライブスコアのみで決定
- 投票タイマーは `battlefes.html` の JS 冒頭 `VOTE_OPEN` / `VOTE_CLOSE` で設定
  - 現在は `null`（無効化中）。本番前に設定する

## イベント情報（仮）

- 日程: 2026/7/19（日）
- 投票開始: 全チームのパフォーマンス終了後（仮: 23:00）

## Git 管理

- リポジトリ: https://github.com/magurophone/battle_fes
- ブランチ: `master`（現行）

## 注意点

- `battlefes.html` と `public/index.html` は別ファイルなので、必要に応じて両方反映する
- 文字コード事故が発生した履歴があるため、日本語ファイルの編集は慎重に行う
- `safe-edit-guard.ps1` の実行は不要（Claude は文字コード事故を起こさない）
- 状況整理は `PROJECT_STATUS.md` を優先して確認する
