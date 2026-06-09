# BATTLE FES 2026 実装進捗

## 段階公開（情報を順次出していく運用）

サイトは情報を段階的に増やしていく方針。現在 **一時的に非表示** にしているブロックと、再表示の手順は以下。`battlefes.html` / `public/index.html` の両方に同じ印（`<!-- 段階公開: ... -->` コメント）を入れてあるので、`hidden` 属性を外すだけで戻せる。

| 非表示中のブロック | 場所 | 再表示の手順 |
|---|---|---|
| ルールオブエンゲージメント | `#about` 内 `<div class="about-rules" hidden>` | `hidden` を外す |
| タイムテーブル | `<section id="schedule" hidden>` ＋ 直前の `<div class="divider" hidden>` | 両方の `hidden` を外す |
| ナビ「スケジュール」リンク | `.nav-drawer` の `<a href="#schedule" ... hidden>` | タイムテーブル再表示に合わせて `hidden` を外す |

※ 検証用スクリプト: `node scripts/shot-stage-hide.mjs`（表示状態の確認＋全画面スクショ）

## プレースホルダ・差し替えガイド

「Coming soon」「未定」「???」が表示されている全箇所と、確定後に何を入れるかの一覧。

### チーム内共有リンク（説明資料から案内する `/clip/` ページ）

情報解禁前のため、ここに反映したメンバーは **特設サイト本体 `public/index.html` / `battlefes.html` には掲載しない**。ColorSing URL が未共有の枠は名前・アイコンのみ表示し、`URL LATER` の非リンク扱いにする。

| チーム | 枠 | 現在の表示 | URL |
|---|---:|---|---|
| CRIMSON | 2 | んごご | 未設定 |
| CRIMSON | 3 | PK | 未設定 |
| GOLDEN | 2 | あわ | 未設定 |
| NOVA | 2 | なぽる | 設定済み |

### チーム紹介セクション（`#teams` / `public/index.html` 657-695行 付近）

| 箇所 | クラス | 現在 | 確定後に入れる内容 |
|---|---|---|---|
| 各チームのジャンル | `.team-genre.placeholder` | `Coming soon` | 例: 旧案では `POWER / J-POP` / `HARMONY / BALLAD` / `ALL-ROUND` |
| 各メンバータグ（3チーム × 3名 = 9個） | `<a class="member-tag placeholder">` | `Coming soon` | 確定したら `placeholder` クラスを外し、テキストを実名に。`href` を ColorSing プロフィールURLに設定 |
| 各チーム説明文 | `<p class="team-desc placeholder">` | `コンセプト・出演者は順次公開予定です` | コンセプト確定後、`placeholder` クラスを外し本文を入れる。旧案は下記控えを参照 |

### 投票セクション（`#vote` / JS の `teams` 配列）

| 箇所 | 現在 | 確定後に入れる内容 |
|---|---|---|
| `teams[i].members` 文字列 | `Coming soon` | メンバー名連結（旧案: `ユーザー名A / B / C` 形式）。投票カード `.vote-card-members` に表示される |

### スケジュールセクション（`#schedule`）

| 箇所 | 現在 | 確定後に入れる内容 |
|---|---|---|
| 9公演の `.sched-title` | `<span class="sched-team">CRIMSON</span>` だけ | 必要ならメンバー名を後ろに追加（例: `CRIMSON 〇〇さん`）。または順序表記（例: `CRIMSON 1st`） |

### イベント情報

| 項目 | 現在 | 備考 |
|---|---|---|
| 開催日 | 2026/7/18（土） | 確定 |
| 開始時刻 | 19:45 | 仮確定。変更時はスケジュール14箇所＋VOTE_OPEN/CLOSE 3ファイルを再計算 |
| `VOTE_OPEN` | `2026-07-18T20:45:00+09:00` | R1終了 = R2先頭。3ファイル同期: `public/index.html`, `battlefes.html`, `functions/api/_lib/vote-store.js` |
| `VOTE_CLOSE` | `2026-07-18T22:30:00+09:00` | 本投票15分終了 |
| `VOTE_POINT_MAX` | `2026-07-18T22:15:00+09:00` | 本投票開始。以後は最大5000PT固定 |

### 旧チーム説明文（控え）

コンセプト議論時の参考用。差し替え時はこれをベースにブラッシュアップ:

- **CRIMSON**: 圧倒的な歌唱力で勝負するパワー系チーム。ジャンルを問わない幅広いレパートリーが武器。感情をそのままぶつけるストレートなパフォーマンスが持ち味。
- **NOVA**: ハーモニーと表現力で勝負するアーティスト系チーム。感情豊かなバラードから疾走感あるアップテンポまで、聴く者の心を揺さぶるパフォーマンスに注目。
- **GOLDEN**: バランス型の万能チーム。どんな曲も高水準にこなすオールラウンダー集団。安定感と確実性を武器に、ハイレベルな完成度で他チームを圧倒する。

### `placeholder` クラスについて

CSS は `public/index.html` `.placeholder` 定義参照。`color: var(--muted); font-style: italic; opacity: 0.55; animation: placeholderPulse 2.6s ease-in-out infinite` で薄く点滅。確定時はクラスを外せば通常表示に戻る。

---


## ステータス凡例

- `✓` 完了
- `🔧` 作業中
- `⬜` 未着手

---

## フロントエンド

### デザイン

- `✓` 全体カラーテーマ
  - 夏フェス、夜、暖色系
- `✓` ヒーローセクション背景画像
- `✓` ヒーローオーバーレイ
  - 上部暗め、下部透過
- `✓` セクションタイトルフォント
  - `Bebas Neue` + `Dela Gothic One`
- `✓` ボタンデザイン
  - pill型、すりガラス系
- `✓` チップ
  - 日付バッジ、すりガラス
- `⬜` Aboutセクション強調テキスト
  - 中抜きアウトライン（`.outline-accent` CSSが未適用）
- `✓` ヒーローロゴ画像化
  - `/assets/logos/logo-B-trim.png` + `/assets/logos/sublogo-colorsing-trim.png`
- `✓` ヒーロー花火エフェクト
  - 四隅で時間差4連発（`/assets/effects/firework.png`）
- `✓` 投票セクション god rays
  - `/assets/effects/godrays.png` を背景にゆらぎアニメ
- `✓` チームカード背景画像
  - `/assets/teams/{crimson,nova,golden}.png`

### 機能

- `✓` パーティクルエフェクト
  - 暖色、蛍風
- `✓` スクロールアニメーション
  - `IntersectionObserver`
- `⬜` SCROLLインジケーター アンカーリンク化
  - `<a href="#about">` への変換が未適用
- `✓` 投票システム
  - チーム選択 + 個人賞3つ（MVP / エンタメ / モーメント）の bulk 投票
  - 重複投票対策（カテゴリ別 fingerprint）
- `✓` 投票フロー
  - 名前入力 → チーム選択 → モーダルで個人賞3つ + 任意コメント + イベント感想 → 送信 → サンクスオーバーレイ → ロック
  - 同じ人を複数賞に選べないUI制御 (disabled-by-other)
  - テストモード中は管理者ログイン済みブラウザだけ開始前送信を許可
- `🔧` ランキング表示
- `⬜` 顧客向けの見せ方調整
  - 順位だけ表示するか
  - ざっくり割合を出すか
  - プログレスバー演出をどう見せるか

---

## バックエンド

### 投票関連API

- `✓` `POST /api/votes`
  - 多カテゴリ bulk 投票（team + 個人賞3カテゴリを1リクエストで送信）
  - サーバ側でタイムスタンプ強制上書き（クライアント信頼しない）
  - カテゴリ別 fingerprint で 409 重複判定
- `✓` `GET /api/results`
  - `config: { categories, teams, members }` を返す（フロントの動的描画に使用）
- `✓` 投票データ保存
  - Cloudflare D1、投票ごとの正本レコード（`vote_submissions` / `vote_picks`）
  - 100〜200人規模想定のため、読み出し時に D1 レコードを集計して結果を生成
- `✓` イベント感想ログ
  - submission 内の `eventComment` を読み出し時に一覧化
- `✓` 重複投票防止
  - サーバーサイド判定（カテゴリ別 fingerprint）
  - 同時投票で集計キーが上書きされないよう、集計値ではなく投票レコードを正本化
- `✓` 名前、コメント、投票時刻のログ保存

### 投票カテゴリ設定

- `✓` `functions/api/_lib/vote-categories.js`
  - TEAMS / MEMBERS / CATEGORIES をデータ駆動で定義
  - 追加カテゴリは設定変更のみで対応可能（API/UIともに動的に描画）

### 管理画面

- `✓` 管理画面 `/admin/`
  - 多カテゴリ対応（カテゴリ別ブロックで Total/Unique/Submissions/Updated/Last vote を表示）
  - Vote Log は `<details>` で折り畳み（DOM 軽量化）
  - イベント全体感想ログ表示
  - 401/403 のメッセージ明示、空状態フォールバック、user input は escapeHtml で XSS 安全化
- `✓` 管理API
  - `/api/admin/results`
  - `/api/admin/live-scores`
  - `/api/admin/reset`（旧スキーマの legacy キーも一括削除）
- `✓` 管理画面パスワード保護
- `✓` パスワードの Cloudflare secret 化
- `🔧` デザイン改善は未対応

### スコア計算

- `✓` ライブスコア登録
  - 管理画面 `/admin/` で各メンバーの「推しボーナス実％」と「枠内月間推しPt（）内」を入力
  - `枠内月間推しPt ÷ (1 + 推しボーナス実％ / 100)` で実ライブスコアを算出し、D1 に保存
  - 枠内月間推しPtとライブスコアは100単位に丸める
- `✓` 管理画面での総合スコア計算
  - `投票ポイント合計 + ライブスコア`
- `⬜` スコア表示用エンドポイント

---

## 残タスク

### フロントエンド

- `⬜` Aboutセクション `section-label` 色統一
  - `.about-text p` の CSS 特異性で上書きされている
- `⬜` Aboutセクション強調テキスト `.outline-accent` CSS追加
- `✓` SCROLLインジケーター `<a href="#about">` に変換済み
- `✓` `hero-bg.webp` preload → `public/hero-bg.webp` 実在確認済み（問題なし）
- `✓` スケジュール 21:40「審査発表」削除済み
- `⬜` チーム名、メンバー名を実データへ差し替え
  - 新デザイン統合で 4 → 3チーム（CRIMSON / NOVA / GOLDEN、AZURE削除）
  - About `stat-num` は参加チーム数 `3` ／ 出演者数 `9` に反映済み
- `🔧` スケジュール日程（7/18 土、開始19:45）
  - 構成: 開会式15分 → R1 45分 → R2 45分 → R3 45分 → 本投票15分 → 結果発表・閉会式15分
  - 9公演（A1→B1→C1→A2→B2→C2→A3→B3→C3）、各15分・連続
  - 19:45開始 → 22:45 終了（3h00min）
- `🔧` 投票タイマー `VOTE_OPEN` / `VOTE_CLOSE`
  - VOTE_OPEN: 2026-07-18T20:45:00+09:00（R1終了 = R2先頭）
  - VOTE_POINT_MAX: 2026-07-18T22:15:00+09:00（本投票開始、最大5000PT固定）
  - VOTE_CLOSE: 2026-07-18T22:30:00+09:00（本投票15分終了）
  - 同期箇所: public/index.html, battlefes.html, functions/api/_lib/vote-store.js

### バックエンド

- `✓` API本実装
- `✓` 管理画面実装
- `⬜` 本番運用前の仕様微調整

---

## イベント本番前チェックリスト

> ✅ **E2E API 検証完了** (2026-05-09 実施)
>
> 本番経路（`battle-fes.pages.dev`）+ 実 D1 で 6 ステップ全 PASS:
>
> - [x] 1 票送信 → 200
> - [x] 同一 fingerprint で再送信 → 409
> - [x] `/api/admin/results` で送信内容（候補ID・コメント・eventImpression）反映確認
> - [x] `/api/admin/reset` で全カテゴリ + legacy + fingerprint キー削除（後続 GET でクリーン確認済み）
>
> Preview と Production は同一 D1 database `battle-fes-vote-db` を参照するため Preview 検証＝本番直叩き相当。
> テストスクリプト: `.tooling/e2e-vote-test.js`（ADMIN_TOKEN env で実行）
> ローカル安全確認: `node scripts/local-api-regression.mjs` / `node scripts/local-frontend-smoke.mjs`

- [ ] イベント開始時刻を最終確定（現在 7/18 土 19:45 仮）
- [ ] 変更時はスケジュール14箇所の時刻を再計算して反映
- [x] `VOTE_OPEN` / `VOTE_POINT_MAX` / `VOTE_CLOSE` を現行時刻に同期（4ファイル: public/index.html, battlefes.html, public/admin/index.html, functions/api/_lib/vote-store.js）
- [ ] チーム名、メンバー名を確定データへ差し替え
- [x] 判明済みリーダー名を各チームの3番手候補へ反映
  - CRIMSON #3: まぐろふぉん
  - NOVA #3: りんか🔔
  - GOLDEN #3: iran痔
- [ ] 顧客向け結果表示の見せ方を最終決定
- [ ] 試験用リセットボタンを残すか削除するか決定
- [x] 時間加重投票のバックエンド実装（早い投票ほど価値が低い）
- [ ] 個人賞 (MVP / エンタメ / モーメント) の最終ラベル・候補メンバー確定（現状 `functions/api/_lib/vote-categories.js` に 3 賞 + プレースホルダ名）
- [ ] 「最多ライブスコアpt獲得賞」の自動算出ロジック実装（投票ベースではなく ColorSing スコア由来）

---

## スコア仕様メモ

```text
最終ポイント = 投票数 × 2000pt + ライブスコア
```

- 投票はリスナー1人1票
- 集計の正本はバックエンドで管理
