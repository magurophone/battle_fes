# BATTLE FES 2026 Claude向けメモ

## 基本方針

このプロジェクトで作業するときは、必ず `PROGRESS.md` を見て現在の進捗を確認すること。
セッション開始時の具体的な作業手順は `WORKFLOW.md` も確認すること。

## 作業ルール

1. 作業前に `PROGRESS.md` を読んで状況を把握する
2. チームリンク追加や本番デプロイは `WORKFLOW.md` の手順に従う
3. 実装を進めたら `PROGRESS.md` を更新する
4. 新しいタスクや未解決事項が出たら `PROGRESS.md` に追記する
5. 方針変更があれば理由も含めて記録する

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
- `public/materials/index.html`
  - 関係者向け説明資料トップ。SNS告知文、ロードマップ、チーム別リンク案内を置く
- `public/clip/{fgars,b95ta,8yegy}/index.html`
  - チームごとのColorSingプロフィール導線。CRIMSON / NOVA / GOLDEN の順
- `public/assets/members/`
  - チームリンク・公開サイトで使うメンバー画像
- `PROGRESS.md`
  - 実装進捗、残タスク、チェックリスト
- `WORKFLOW.md`
  - セッション開始時に確認する作業手順。資料側チームリンク更新、本番デプロイ、確認コマンド
- `PROJECT_STATUS.md`
  - 現在の構成、公開状態、事故履歴を含む状況整理

## 関係者向け資料・チームリンク更新ワークフロー

ユーザーから「特設サイトにはまだ掲載せず、説明資料のチームごとのリンクに追加」と言われた場合は、公開サイト本体ではなくチーム別クリップリンクだけを更新する。

1. 触る場所
   - NOVA: `public/clip/b95ta/index.html`
   - CRIMSON: `public/clip/fgars/index.html`
   - GOLDEN: `public/clip/8yegy/index.html`
   - 画像保存先: `public/assets/members/`
2. 触らない場所
   - `public/index.html`
   - `battlefes.html`
   - 投票候補マスタ `functions/api/_lib/vote-categories.js`
   - これらは「特設サイトにも掲載」「投票候補も確定」と明示された場合だけ更新する
3. ColorSingプロフィール確認
   - Windows の curl は証明書失効チェックで止まることがあるため、ColorSing / CDN 確認は `curl.exe --ssl-no-revoke -L "<URL>"` を使う
   - ページHTMLの `__NEXT_DATA__` / OGP から `userName` と `userProfileImageUrl` を確認する
   - 表示名はカード上では短い名前を優先する。例: `なぽる ワンフレ入賞感謝🥉` なら `なぽる`
4. カード更新
   - `is-pending` の枠を通常の `<a class="member-link" ...>` に差し替える
   - `href` は ColorSing 共有URL、`aria-label` は「{名前}のColorSingプロフィールを開く」
   - `member-action` は `OPEN`
   - 残り未確定枠は `COMING SOON` のまま残す
5. ローカル確認
   - 静的確認: `node scripts/serve-preview.mjs` で `http://127.0.0.1:8788/clip/.../`
   - HTTP確認: `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8788/clip/b95ta/index.html`
   - Playwright確認をする場合、同梱ブラウザが無ければ Edge を指定する: `executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'`

## 本番デプロイ手順

- 本番URL: `https://battle-fes.pages.dev`
- Cloudflare Pages project: `battle-fes`
- Production branch: `master`
- 公開ディレクトリ: `public`
- デプロイコマンド:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-safe.ps1
```

`scripts/deploy-safe.ps1` の実体は以下と同等。

```powershell
npx wrangler pages deploy public --project-name battle-fes --branch master --commit-dirty=true --commit-message "deploy"
```

デプロイ後は必ず以下を確認する。

```powershell
npx wrangler pages deployment list --project-name battle-fes
curl.exe --ssl-no-revoke -I https://battle-fes.pages.dev/clip/b95ta/
curl.exe --ssl-no-revoke -I https://battle-fes.pages.dev/assets/members/{追加画像}.jpg
curl.exe --ssl-no-revoke -L https://battle-fes.pages.dev/clip/b95ta/
```

`deployment list` で最新行が `Production / master` なら本番反映。`curl` のHTMLで追加した名前とColorSing URLが見えることも確認する。

## 現在の技術メモ

- 投票機能は Cloudflare Pages Functions + D1 を利用
- 管理画面は `/admin/`
- 管理画面用の集計とコメントログ確認機能あり
- スコア計算: `投票数 × 2000pt + ライブスコア`
  - 審査員なし。リスナー投票とライブスコアのみで決定
  - ライブスコアは管理画面 `/admin/` から、各メンバーの「推しボーナス実％」と「枠内月間推しPt（）内」を入力して算出・保存する
- 投票タイマーは `battlefes.html` / `public/index.html` の JS 冒頭 `VOTE_OPEN` / `VOTE_CLOSE` / `VOTE_POINT_MAX` と、`functions/api/_lib/vote-store.js` の同等定数を同期する
  - 現在は `2026-07-18T20:45:00+09:00` 受付開始、`2026-07-18T22:15:00+09:00` 最大PT到達、`2026-07-18T22:30:00+09:00` 受付終了

## イベント情報（仮）

- 日程: 2026/7/18（土）
- 開始時刻: **19:45（仮確定）**
- 進行: 開会式15分 → R1 45分 → R2 45分 → R3 45分 → 本投票15分 → 結果発表・閉会式15分（合計3h00min、終了22:45）
- 投票受付: R1終了後 = R2先頭（20:45）〜 本投票終了（22:30）。本投票（22:15-22:30 の15分）が最も重い時間加重方式（実装済み）

## Git 管理

- リポジトリ: https://github.com/magurophone/battle_fes
- ブランチ: `master`（現行）

## 注意点

- `battlefes.html` と `public/index.html` は別ファイルなので、必要に応じて両方反映する
- 文字コード事故が発生した履歴があるため、日本語ファイルの編集は慎重に行う
- `safe-edit-guard.ps1` の実行は不要（Claude は文字コード事故を起こさない）
- 状況整理は `PROJECT_STATUS.md` を優先して確認する
