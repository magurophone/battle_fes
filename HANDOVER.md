# BATTLE FES 2026 セッション引き継ぎ

更新日: 2026-07-15 JST

## 2026-07-15 セッション終了時点（最新・以下の過去記録より優先）

### GitHub／本番

- ブランチ: `master`
- 最新コミット: `81fe3365d5c690b658f06ccbf17d896170f2600d` (`Increase X header export quality`)
- GitHubへのpush完了済み。
- Cloudflare Pages本番デプロイ完了済み。
  - Production deployment: `9d0923d9-8b8b-4e60-9c12-f42e334d1bd4`
  - Source: `81fe336`
  - 本番: `https://battle-fes.pages.dev`
  - Deployment URL: `https://9d0923d9.battle-fes.pages.dev`

### 今回までに本番反映済みの主な変更

- ヒーローの「投票する」CTAは本投票時間（22:15〜22:30）だけ表示。投票テストモードでは確認可能、結果テストモードでは非表示。
- 結果発表画面の文字つぶれ、カウントアップの多重発火、誤ったクラッカー発火を修正。演出は更新時ではなくスクロール範囲へ入った時に発火する。
- 総合順位・個人賞カードを優勝カードと同幅へ拡大し、人物アイコンは四角形へ変更。カード形状はサイト既存の角張ったデザイン文脈へ調整。
- 管理画面は運営者／リーダー権限を分離。リーダーは22:50まで結果内訳を閲覧不可、22:50以降は自動解禁。運営者用Secretの平文はリポジトリへ保存しない。
- XヘッダーをHTML/CSSで作成し、3000×1000で高画質出力。
  - 生成元: `promo/x-header.html`
  - Playwright: `promo/shot-x-header.mjs`
  - PNG: `public/assets/promo/x-header-battle-fes.png`
  - Xアップロード用JPEG: `public/assets/promo/x-header-battle-fes-upload.jpg`
- スマホナビは検討の結果、既存のハンバーガーメニューを維持。常設上部タブ案は取り消しており、再導入しない。

### UI検証の恒久ルール

- フロントエンド／UI変更は毎回Playwrightで実表示を確認する。
- PC／スマホ、表示境界時刻、スクロール発火、操作状態を変更内容に応じて確認する。
- 再発防止できる項目は `scripts/local-frontend-smoke.mjs` へ回帰テストを追加する。
- デプロイ前は `scripts/deploy-safe.ps1` を使い、Playwrightを含むpreflightを必ず通す。
- 上記ルールはリポジトリ内だけでなく、全案件共通の `C:\Users\iimy\.codex\AGENTS.md` にも保存済み。

### 作業ツリーに残っている未コミット作業

以下はユーザーの別作業を含むため、今回のコミットには混ぜず、そのまま保全してある。次回も勝手にstage／revert／削除しない。

- `PROGRESS.md`
- `battlefes.html`
- `public/index.html`
- `public/admin/index.html`
- `promo/bonus-char.html`、`promo/shot-bonus-char.mjs`
- `public/assets/promo/bonus/` 内の既存変更・透過画像・ZIP
- 開発裏話その2〜4、配信背景のHTML／レンダースクリプト／画像
- 未追跡の `docs/backstage-4-type-visual.md`、`promo/backstage-*.html`、`promo/stream-bg.html` など

特に `public/index.html` と `battlefes.html` には、個人賞の表示額をAPI値から動的算出してHTMLソースへ固定額を残さない変更が未コミットで存在する。意図的に保全してある。

### 次回の開始手順

1. この最新セクションを読む。
2. `git status --short` と `git diff` で未コミット作業を再確認する。
3. 続行する作業の範囲だけをstageする。
4. UI変更後はPlaywright、デプロイ前は `scripts/deploy-safe.ps1` を実行する。

---

以下は以前のセッション記録。未完了のSNS素材などの詳細参照用として残す。

## 次セッションで最初に確認すること

1. `WORKFLOW.md`、`CLAUDE.md`、`PROJECT_STATUS.md`、`PROGRESS.md` を読む。
2. `git status --short` を確認し、既存の作業中変更を戻さない。
3. 本番サイトは `https://battle-fes.pages.dev`。
4. フロント／画像HTMLを変更した場合は、完了報告前に必ずPlaywrightで実表示を確認する。

## 今回の依頼と重要なユーザー指示

既存の「バトルフェス開発裏話」その1〜3に続く、その4「フォントとサイトイメージ」の記事と添付画像を準備する依頼。

ユーザーから途中で次の修正指示があった。

- 想像で進めず、最初に実サイトを細部まで見ること。
- UFCを参考にしたのは、主に投票開始までのカウントダウンメーター。
- 軍用ステンシル系フォントの話も記事へ入れる。
- 「サイト全体がUFC風」とは書かない。

今後もデザインや記事を作る前に、公開中の実サイトと既存シリーズを先に確認する。

## 既存ポストその1〜3

ユーザーが示した既存投稿画像:

- `C:\Users\iimy\Desktop\HM8AhFPagAAOfF3.jpg`
  - その1。没チーム `AZURE` の青いイメージ。
- `C:\Users\iimy\Desktop\HNBAYyBbEAAQicr.jpg`
  - その2。ライブスコアの決まり方。
- `C:\Users\iimy\Desktop\HNGIzgGbMAAroXi.jpg`
  - その3。2回投票不可／1人1票。

その2・3の生成元は既存の以下のファイル。

- `promo/backstage-livescore.html`
- `promo/shot-backstage-livescore.mjs`
- `promo/backstage-onevote.html`
- `promo/shot-backstage-onevote.mjs`

## 実サイト確認結果

2026-07-14に本番 `https://battle-fes.pages.dev` をPlaywrightで直接確認済み。

確認条件:

- PC: 1440×1000
- スマホ: 390×844
- ヒーロー、About、チーム、スケジュール、投票を目視確認
- スマホメニューの開閉も確認
- ブラウザエラーなし

主な実装上の書体:

- 本文: `Noto Sans JP`
- 日本語の大見出し: `Dela Gothic One`
- チーム名、ROUND、カウントダウン数字など: `Black Ops One`
- 英字ラベル: `Bebas Neue`
- 数字・補助情報: `JetBrains Mono`
- 一部の装飾数字: `Cinzel`

サイト全体の視覚:

- 夜の夏フェス会場、花火、観客、暖色の光
- 濃紺からワイン色のグラデーション
- ゴールド／オレンジの発光
- チーム別のCRIMSON／NOVA／GOLDENカラー
- 粒子、グレイン、マーブル素材

UFC参考として扱う範囲:

- 投票開始カウントダウンの黒い計器盤
- 大きな数字を `DAYS / HOURS / MIN / SEC` に分ける構成
- 発光する区切り点
- フラップ式に切り替わる角張った数字
- 試合開始前の緊張感

軍用ステンシルの話:

- `Black Ops One` の切れ込みを持つ無骨な字形を使用。
- チーム名、`ROUND`、スケジュール時刻、カウントダウン数字などに使用。
- 競技・作戦・対戦表の空気を出す役割。
- 軍用ステンシルはUFC参考とは別のフォント設計上の話として説明する。

## 作成済み「開発裏話 その4」

### 記事

- `docs/backstage-4-type-visual.md`

現行本文:

> バトルフェス開発裏話　その4
>
> 今回は、フォントとサイトイメージのお話です。
>
> 特設サイトの「投票開始まで」のカウントダウンメーターは、UFCのカウントダウン表示を参考に作りました。
>
> 大きな数字を DAYS・HOURS・MIN・SEC に分け、数字が切り替わるフラップ式の動きとオレンジの光を追加。投票開始が近づくほど、「試合が始まる」ような緊張感が出るようにしています。
>
> フォントも、場所ごとに使い分けました。
>
> 日本語の大見出しには、太くて輪郭の強い「Dela Gothic One」。チーム名や「ROUND」、カウントダウンの数字には、軍用ステンシル系の「Black Ops One」を使っています。
>
> 文字の途中に切れ込みがある少し無骨な書体を入れることで、普通の音楽イベントではなく、「チーム同士が競うバトル」であることが伝わるようにしました。
>
> そこに花火やライブ会場の写真、ゴールドの光を重ねて、「夏フェスの熱量」と「バトル前の緊張感」の両方が伝わるサイトを目指しています。
>
> サイトを見る時は、文字やカウントダウンにも注目してみてください！

### 添付画像

- 完成PNG: `public/assets/promo/backstage-4-type-visual.png`
- 生成元: `promo/backstage-type-visual.html`
- レンダー／回帰確認: `promo/shot-backstage-type-visual.mjs`

画像仕様:

- 1600×900キャンバス、`deviceScaleFactor: 2`
- 実ファイルは3200×1800 PNG
- 上段: 実サイト準拠の `04:02:50:10` カウントダウン
- 画像内表記: `UFCのカウントダウン表示を参考`
- 下段左: `Dela Gothic One` と「リスナー投票」
- 下段右: `Black Ops One` と `ROUND 1 / CRIMSON`
- 下部コピー: `夏フェスの熱量 × バトル前の緊張感`
- UFCロゴ、オクタゴン、選手写真、UFC固有レイアウトの複製は使用していない。

## UFCとのデザイン重複についての整理

重なる部分:

- 黒背景と暖色発光
- 大数字を主役にする構成
- `DAYS / HOURS / MIN / SEC` の4分割
- 発光するコロン
- 太く角張った英字と広い文字間隔
- 試合開始前の緊張感

これらはUFCだけの固有表現ではなく、格闘技・スポーツイベントで広く使われるデザイン文法でもある。

BATTLE FES独自部分:

- フラップ式の数字
- オレンジ～ゴールドの配色
- `Black Ops One` と `Dela Gothic One` の組み合わせ
- 花火、ライブ会場、ワイン色の背景
- マーブルとグレイン
- 日本語中心の情報設計

記事で推奨する表現:

- 現行: `UFCのカウントダウン表示を参考に作りました。`
- より一般化する場合: `UFCなど、格闘技イベントの試合前カウントダウン演出を参考に作りました。`

避ける表現:

- `UFCのサイトデザインを参考にした`
- `サイト全体をUFC風にした`

## 検証済み事項

実行コマンド:

```powershell
node promo\shot-backstage-type-visual.mjs
```

成功済みのPlaywright検証:

- 1600×900キャンバス内に全要素が収まる
- カウントダウンは8桁／4区分
- フォントカードは2枚
- `Dela Gothic One`、`Black Ops One`、`Noto Sans JP` の読込成功
- UFC参考表記と軍用ステンシル表記が存在
- ページ／コンソールエラーなし
- 完成画像を目視確認済み

`node --check promo\shot-backstage-type-visual.mjs` と `git diff --check` も成功済み。

## 未確定・次回判断

- ユーザーは完成画像と記事に対する最終承認をまだ明示していない。
- UFC表現を現行の固有名詞入りで確定するか、`UFCなど、格闘技イベント` に一般化するかは未確定。
- ユーザーが参考にした特定のUFC画面は未共有。厳密な1対1比較が必要なら元画像を受け取る。
- 本番デプロイはしていない。ユーザーの明示指示と画像承認なしにデプロイしない。

## 作業ツリー上の注意

開始時点から多数の変更／未追跡ファイルが存在していた。ユーザーの別作業を含むため、無関係な変更を戻したり整理したりしない。

今回追加・更新した主なファイル:

- `docs/backstage-4-type-visual.md`
- `promo/backstage-type-visual.html`
- `promo/shot-backstage-type-visual.mjs`
- `public/assets/promo/backstage-4-type-visual.png`
- `PROGRESS.md` 冒頭の2026-07-14記録
- `HANDOVER.md`

セッション終了時点で未デプロイ・未コミット。
