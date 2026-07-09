# モダンデザイン改修 指示書（BATTLE FES 特設サイト）

対象: `public/index.html`（正）と `battlefes.html`（編集用の元HTML。同一の変更を両方に反映すること）。
目的: 動きの語彙が「入ったら1回フェードイン」だけの2015年型なのを、(1)スクロール連続結合の視差 と (2)役割別リビール振り付け に更新する。

## 絶対条件

- 確認や質問は不要。具体的なコード修正まで自主的に完遂すること。
- 既存の日本語のUI文言・aria-label・コメント・ヒント文言・確認ダイアログ等は **日本語のまま維持**。構造改善は歓迎するが、文言を英語に置換しない（プロジェクト方針）。
- 外部ライブラリ禁止。vanilla JS のみ。
- アニメーションは transform / opacity / clip-path のみ（layout を動かすプロパティ禁止）。
- 既存機能（投票UI、カウントダウン、花火canvas、ハンバーガーナビ、`prefers-reduced-motion` 分岐 `index.html` 2176行付近 / JS `prefersReducedMotion()` 3048行付近）を壊さない。reduced-motion 時は新規の視差・リビールも無効化（即時表示）すること。
- HTMLの構造変更は最小限。コンテンツ文言・リンク・画像は一切変更しない。

## 実装1: スクロール視差（連続結合の動き）

共通基盤: rAF 単一ループ + lerp（`現在値 += (目標値 - 現在値) * 0.12`）。
- 各対象要素の「ビューポート内進行度 p（0〜1）」を毎フレーム計算し、CSS変数（例 `--p`）に書く。
- IntersectionObserver で画面内にある要素だけ計算対象にする（画面外は skip）。
- 読み（getBoundingClientRect）と書き（style.setProperty）をフレーム内で分離。対象要素に `will-change: transform`。

対象A: ヒーロー背景 `.hero-bg`（`#hero` は overflow:hidden 済み）
- 高さを 112% にし、スクロール量に応じて translateY。**translate範囲は必ずはみ出し分（±6%）の中に収める**こと。0→+12% のような片寄せは上端の下地露出事故になるので禁止。
- 既存の `.hero-bg::after` グラデーションオーバーレイは維持。

対象B: チームカード背景 `.team-card::before`（3枚、`--team-bg`）
- 疑似要素は JS から直接触れないので、`.team-card` に `--p` を書き、`::before` 側で `transform: scale(1.08) translateY(calc((var(--p) - 0.5) * -8%))` のように参照する。
- 既存の hover 時 `scale(1.10)` 拡大と競合しないよう transform を統合すること（hover は scale のみ変え、translateY は視差変数を維持）。

## 実装2: リビールの役割分化 + スタガー

現状: `.reveal`（32px下からフェード 0.7s、`index.html` 2220-2225行）一種類のみ、observer は `unobserve` で初回のみ（3377-3386行）。これを役割別に分ける。イージングは `cubic-bezier(0.16, 1, 0.3, 1)` を基準にする。

1. **セクション見出し**（`.section-label` + `.section-title` 全セクション）: 行単位マスクリビール。`overflow: hidden` の親 + 内側要素 `translateY(110%) → 0`、0.9s。label→title の順で 0.1s 時差。既存の text-shadow 装飾は維持。
2. **チームカード**: `clip-path: inset(0 0 100% 0) → inset(0 0 0 0)` で上から「置かれる」出現（opacityフェードは使わない）。カード間スタガーは既存の delay-1/2/3 相当（0.12s刻み）を維持してよい。
3. **区切り線** `.divider`: `transform: scaleX(0) → 1`（transform-origin: left）、0.8s。
4. **スケジュール行** `.schedule-item` と `.round-divider`: 行ごとの時差リビール。1行あたり 0.06s 刻み程度の控えめなスタガー（translateY(16px)+opacity、0.5s）。全部同時は禁止だが、待たされる長さにしないこと。
5. **ルール説明の3カラム** `.ar-round`（01/02/03）: 0.1s スタガー。
6. 出現は初回のみで良い（既存の unobserve 方式を維持）。リトリガー化は不要。

ヒーロー内の既存 `fadeUp` 群（CSSアニメーション、ページロード演出）はスクロールリビールとは別物なので**変更不要**。

## やらないこと（スコープ外）

- sticky レール / カウンター（今回見送り）
- フッターの変更（一切触らない）
- 投票ページへの誘導リンク追加（不要と決定済み）
- 文言・コンテンツ・色・書体の変更

## 検証（実装後に必ず実施）

- `node scripts/serve-preview.mjs` で配信し、Playwright（同梱ブラウザが無ければ `executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'`）で:
  1. スクロール位置を変えながら `.hero-bg` / `.team-card` の computed transform が**連続的に変化する**ことを実測
  2. ビューポート単位のスクロール撮影（fullPage撮影はリビールで画面外要素が透明のため使用不可）で PC(1280px) / SP(390px) 両方を検分
  3. JSコンソールエラーなし、横スクロールなし
  4. `prefers-reduced-motion: reduce` エミュレーション時に視差・リビールが無効（コンテンツが即時全表示）であること
- `battlefes.html` にも同一変更が入っていること（diff で確認）。
