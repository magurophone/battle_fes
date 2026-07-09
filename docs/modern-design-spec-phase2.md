# モダンデザイン改修 フェーズ2 指示書（BATTLE FES 特設サイト）

対象: `public/index.html`（正）と `battlefes.html`（同一変更を両方に反映）。
前提: フェーズ1（スクロール視差 + リビール役割分化）は実装済み。既存の `--p` 視差変数・`line-reveal`・`team-card` の clip-path リビール・`schedule-reveal` を壊さないこと。

## 絶対条件（フェーズ1と同じ）

- 確認や質問は不要。具体的なコード修正まで自主的に完遂すること。
- 既存の日本語のUI文言・aria-label・コメント・ヒント文言等は **日本語のまま維持**。文言を英語に置換しない（プロジェクト方針）。
- 外部ライブラリ禁止。vanilla JS のみ。アニメーションは transform / opacity / clip-path のみ。
- `prefers-reduced-motion: reduce` では新規アニメーション（カウンターの数字ロール等）を無効化。sticky 配置自体は motion ではないので維持してよい。
- コンテンツ文言・リンク・画像・色・書体は変更しない。フッターは触らない。

## 実装1: チームカードの大判1カラム化（検証済みモック準拠）

`#teams` の `.teams-grid` を1カラム縦積みに変更する。検証済みの注入CSF値:

- `.teams-grid { grid-template-columns: 1fr; gap: 2rem; }`
- `.team-card { min-height: 480px; }`（PC）
- roster を中央寄せ: `.team-roster { justify-content: center; }`
- アバター拡大: メンバー150px、リーダー175px（PC）。
- `.roster-name` の max-width をアバター幅に追随させる（リーダー185px / メンバー160px、フォント 1.05rem / 0.95rem）。
- `.team-name { font-size: 3.2rem; }`（PC）
- **SP対応（必須・モックで発覚した課題）**: 390px幅では 150px×3 + gap が横にはみ出し、名前が欠けた。`--roster-avatar-size` を `clamp()` か media query で縮小し（目安: SPで 88〜96px、リーダーも同率縮小）、SP(390px)で3人が横に収まり名前が欠けないこと。既存のSPブレークポイント（`@media (max-width: 768px)` 付近）に合わせる。
- 既存の `--team-bg` 視差（`::before` の `--p` 参照）と clip-path リビールはそのまま生かす。カードが大きくなるぶん背景アートの見える面積が増えるのが狙い。

## 実装2: teams の sticky カウンター（②、PCのみ）

- `#teams` 左端に sticky のカウンターレール（例: `01 / 03` 表示）。`position: sticky; top: 80px` 級（fixedヘッダー高67pxの下）。
- IntersectionObserver でビューポート中央にあるチームカードを判定し、番号を更新。
- 数字の切り替えは translateY ロール（0.4s、transform のみ）。reduced-motion 時はロール無しで即時切替。
- `@media (max-width: 900px)` では非表示（SPは画面が狭くレールを置く余白がない）。
- レイアウトを崩さないこと: 既存 section は `max-width: 1100px; margin: 0 auto` なので、レールは絶対配置か負マージンでコンテンツ幅を侵食しない形にする。

## 実装3: schedule の sticky ROUND ラベル（②、PC/SP両方）

- `.schedule-list` 内の各ラウンド（`.round-divider` とそれに続く `.schedule-item` 群）を `.round-group` ラッパーで包む（HTML構造変更はこのラッパー追加のみ。行の中身は不変）。
- `.round-divider` を `position: sticky; top: 67px`（SPはヘッダー高64px）で、そのラウンドの行が流れる間だけ留まるようにする。
- sticky 中の視認性のため `.round-divider` に背景（既存の背景色 `#060c1a` 系の不透明〜半透明+blur は可。ただしグラデーション新設はしない）を敷いてよい。
- ラウンド外の項目（19:45 開会式、22:15 本投票開始、22:30 結果発表、22:45 終了）はラッパーに含めない。
- 既存の `.schedule-reveal` スタガーと干渉しないこと（ラッパー追加後も行のリビールが機能すること）。

## 検証（実装後に必ず実施）

`node scripts/serve-preview.mjs` + Playwright（`executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'`）で:

1. PC(1280×800): teams が1カラム大判で表示され、カウンターが 01→02→03 と追随すること（スクロール位置を変えて実測）
2. SP(390×844): メンバー3人が横に収まり名前が欠けないこと、カウンターレールが非表示なこと
3. schedule: スクロール中に ROUND ラベルがヘッダー下に留まり、次のラウンドで入れ替わること（PC/SP）
4. フェーズ1の機能が生きていること: `.hero-bg` / `.team-card` の視差が連続変化、リビール発火、reduced-motion で即時表示
5. JSコンソールエラーなし（投票APIの404は既知で無視）、横スクロールなし
6. `battlefes.html` にも同一変更（grep で新規クラスの出現数が一致すること）
