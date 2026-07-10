# BATTLE FES 2026 実装進捗

2026-07-10: スマホのチーム背景点滅修正版を Cloudflare Pages 本番へ最終デプロイ済み。deployment `82efafa1-034b-494f-9cd1-d26e6190d480`（Production / master）。直前の `b38f80b4-02b3-464c-94ad-964ca5079127` では判断を誤ってスマホ背景視差を停止していたため、同日中に上書きして動的表現を復旧。本番Pixel 5相当でスクロール前後の `--p` 最大変化量 0.4954、全カード opacity 1、reload直後も opacity 1 / clip-path解除済みを確認。本番HTMLで `site-team-v1` 参照と旧 `warmTeamCardMedia` 撤去を確認し、新WebPのHTTP 200・`Cache-Control: public, max-age=31536000, immutable` も確認済み。

2026-07-10: スマホでページ更新時にチーム紹介カードの背景が消える／点滅する問題を再修正。原因は、モバイルCSSがカードを `opacity: 0` で開始し、`warmTeamCardMedia()` が画像未完了でも1.4秒タイムアウトを `teamMediaReady` 扱いにして表示を始めていたこと。低速画像再現ではカード表示開始時点で背景・人物画像が0件完了となる競合を確認した。対策として、スマホ／タッチ／900px以下はカードを初期描画から常時表示し、画像待ちによる表示ゲートを撤去。チームカード背景の `--p` 更新とtransform視差はスマホでも維持し、PCのsticky stackingも維持した。特設サイト専用画像を `public/assets/site-team-v1/` のWebP 12枚へ最適化し、転送合計を約17.5MiBから810,940 bytesへ削減。専用ディレクトリには `_headers` で1年間 immutable cacheを設定し、元画像更新時に再生成できる `npm run build:site-team-media` を追加。`scripts/local-frontend-smoke.mjs` は専用画像を2.2秒遅延させた初期表示＋reload直後でも、全カードが `visible` / opacity 1 / clip-path解除済みであること、スマホで背景視差の `--p` が動き続けることを通常設定・reduced-motionの両方で検証。全フロントスモークPASS、Pixel 5相当の実画面スクリーンショットでも背景・人物トリミングを確認済み。

## 段階公開（情報を順次出していく運用）

サイトは情報を段階的に増やしていく方針。現在 **一時的に非表示** にしているブロックと、再表示の手順は以下。`battlefes.html` / `public/index.html` の両方に同じ印（`<!-- 段階公開: ... -->` コメント）を入れてあるので、`hidden` 属性を外すだけで戻せる。

関係者資料 `public/materials/index.html` のSNS文言カードは、6/13・6/20・6/27を配布済みに更新済み。

2026-07-07: SNS投稿戦略を変更。理由: Xのアルゴリズム上、複数アカウントの分散投稿よりも1ポストにエンゲージを集中させるほうが有利なため、以後の投稿は運営アカウント1名のみが行い、各ライバーはいいね・リポスト・引用で支援する方式に切り替え。運営アカウントは青バッジ取得済みで長文投稿が可能。これに伴い7/1の「全メンバー・スケジュール解禁」単独投稿は見送り、内容を7月の統合長文ポストに吸収。統合ポスト（投稿日 7/11）完成・本番反映済み。確定文言は資料の「統合告知（運営長文ポスト）」カード（7/11）に掲載。投稿用画像は**3枚構成**（日付マークなし・この順で添付）: ①`sns-6-13.png`（キービジュアル・既存）／②`sns-unified-hero.png`（全メンバー＋タイムテーブル、7/1デザイン踏襲）／③`sns-unified-value.png`（1票＝最大約3,700円分／100票＝37万円分／課金力じゃなく応援の数、の価値訴求・新規デザイン）。②③の生成元は `promo/sns-unified.html` ＋ `node promo/shot-sns-unified.mjs`。設計仕様と失敗の経緯は `docs/sns-unified-post-spec.md`。方針: 投稿済み画像のデザイン流用禁止／情報は集約し画像は3枚まで／「審査員なし」は書かない（ColorSingで審査員は元々いない）／対外コピーに名前以外の絵文字禁止。貫通BONUS告知は別日の単独投稿に分離（日程・7/17前日・7/18当日カードの扱いは未決）。対外コピーには名前以外の絵文字を入れない（ブランド方針）。

2026-07-09: 投票システム改定。個人賞3部門（MVP / エンタメ / モーメント）の各1位メンバー所属チームへ、部門ごとに **50,000pt** を総合スコアへ加点する実装を追加。総合スコアは `投票ポイント合計 + 個人賞加点 + ライブスコア`。個人賞は投票時に必須選択のため、投票が入れば3部門すべてで受賞者が出る。同票時は既存トップ判定と同じく票数降順・同票なら候補ID昇順で1名を受賞者扱い。管理画面の総合表・トップ判定・合計表示に反映済み。検証: `node scripts/local-api-regression.mjs` / `node scripts/local-frontend-smoke.mjs` PASS。

2026-07-09: 管理画面のテストモードに「締切後表示」切替を追加。`/api/admin/vote-status` が D1 `system_state.admin_vote_status_override` を `closed` / 解除で保存し、`/api/admin/results` 系の管理画面表示だけを締切後扱いにする。公開 `/api/results` と `/api/votes` の投票受付判定には反映しない。公開フロントの結果ランキングは `2026-07-18T23:00:00+09:00` 以降のみ表示。検証: `node scripts/local-api-regression.mjs` / `node scripts/local-frontend-smoke.mjs` PASS。

2026-07-09: 管理画面の総合表示を修正。WINNER表示、全体集計、チーム別内訳を別ブロックに分離し、全チーム合計が優勝チーム単体の数値に見えないようにした。合計ラベルも「全チーム投票ポイント」「全チーム個人賞加点」「全チームライブスコア」「全チーム総合スコア」へ変更。

2026-07-09: 管理画面の総合表示を読み上げ運用順へ調整。全体集計とチーム別内訳の得点項目を `ライブスコア → 個人賞加点 → 投票ポイント → 総合スコア` の順に変更。

2026-07-09: 公開フロントのセクション見出し演出を調整。`.section-title` のみ、既存の行マスクから1文字ずつ下から生えるマスクリビールへ変更。文字出現後にグロウ/影を遅れてフェードイン。SPで文字マスク内の `text-shadow` が角張って切れるため、セクションタイトルの効果は親要素の `drop-shadow` に統一。対象は `イベントについて` / `参加チーム` / `タイムスケジュール` / `リスナー投票`。本文・ラベル・投票UIには適用しない。sticky 表示は ROUND ナビと干渉するため不採用。`prefers-reduced-motion` では即表示・グロウ最終状態。

2026-07-09: PCのチームカード stacking 条件を調整。従来の `min-width: 1000px` ではノートPC幅・ブラウザズーム・サイドバー表示時に演出が無効になりやすかったため、タッチ端末を避けつつ `min-width: 769px` + `hover: hover` + `pointer: fine` に変更。`scripts/local-frontend-smoke.mjs` は 1280px と 900px の両方で sticky stacking を検証する。

2026-07-06: モダンデザイン改修を本番デプロイ（deployment 4d08594c / Production / master）。内容: (1)スクロール連続結合の視差（`.hero-bg` ±7.6%・`.team-card::before` ±14%、rAF+lerp 単一ループ+IntersectionObserver、`--p` 変数） (2)役割別リビール＋リトリガー（見出し=行マスク `line-reveal`、カード=clip-path 初回のみ・再入時フェード、divider=scaleX、スケジュール行=バッチ内相対スタガー上限0.3s） (3)チームカード1カラム大判化（アバターは全員156px統一、SPは clamp で縮小） (4)静と動: PC でチームカードのスタッキング（`.teams-grid > .team-card { position: sticky; top: 100px }`、次のカードが前のカードに重なる）＋ schedule の ROUND ラベル sticky。不採用: 左レール見出し sticky（センター構図と衝突）、teams カウンター（浮いて見える）、フッターロゴ（ヘッダーと重複）。注意: `prefers-reduced-motion: reduce`（Windows「アニメーション効果」オフ）では基本リビールとヒーロー視差は無効。チームカード背景パララックスはスマホを含め動的維持。sticky スタッキングは動く。指示書は `docs/modern-design-spec.md` / `docs/modern-design-spec-phase2.md`。

2026-07-01: 特設サイトとGOLDENチームリンクのiran痔画像参照を7月用 `public/assets/members/golden-iran-july.jpg` に差し替え済み。

2026-07-01: 投票システムをテストモード/Playwright/API回帰で検証。共有IPで別ブラウザが重複扱いになり得るfingerprintをブラウザID併用へ改善し、コメントフィルタ表示も修正済み。投票ポイント・BONUS・ライブスコア計算は推しボーナスが減らない前提で確認済み。

2026-06-27: 投票ルール公開に合わせて、`battlefes.html` / `public/index.html` の `#about` 内ルールオブエンゲージメントを表示状態へ変更済み。

2026-06-22: 関係者資料・チームリンク用のなぽる画像を `public/assets/members/nova-naporu.jpg` に差し替え。`public/clip/b95ta/index.html` と `promo/sns-strategy.html` のなぽる画像は拡大表示を外し、7/1投稿用画像 `public/assets/promo/sns-7-01.png` も再生成済み。

| 非表示中のブロック | 場所 | 再表示の手順 |
|---|---|---|
| タイムテーブル | `<section id="schedule" hidden>` ＋ 直前の `<div class="divider" hidden>` | 両方の `hidden` を外す |
| ナビ「スケジュール」リンク | `.nav-drawer` の `<a href="#schedule" ... hidden>` | タイムテーブル再表示に合わせて `hidden` を外す |

※ 検証用スクリプト: `node scripts/shot-stage-hide.mjs`（表示状態の確認＋全画面スクショ）

## プレースホルダ・差し替えガイド

「Coming soon」「未定」「???」が表示されている全箇所と、確定後に何を入れるかの一覧。

### チーム内共有リンク（説明資料から案内する `/clip/` ページ）

情報解禁前のため、ここに反映したメンバーは **特設サイト本体 `public/index.html` / `battlefes.html` には掲載しない**。ColorSing URL が未共有の枠は名前・アイコンのみ表示し、`URL LATER` の非リンク扱いにする。

| チーム | 反映状況 | 現在の表示 |
|---|---|---|
| CRIMSON | 3名設定済み | まぐろふぉん / んごご / PK |
| NOVA | 3名設定済み | りんか / なぽる / 犬飼音子(ねこ) |
| GOLDEN | 3名設定済み | iran痔 / あわ / 潮てら |

### チーム紹介セクション（`#teams` / `public/index.html` 657-695行 付近）

| 箇所 | クラス | 現在 | 確定後に入れる内容 |
|---|---|---|---|
| 各チームのジャンル | `.team-genre.placeholder` | `Coming soon` | 例: 旧案では `POWER / J-POP` / `HARMONY / BALLAD` / `ALL-ROUND` |
| 各メンバータグ（3チーム × 3名 = 9個） | `<a class="member-tag placeholder">` | `Coming soon` | 確定したら `placeholder` クラスを外し、テキストを実名に。`href` を ColorSing プロフィールURLに設定 |
| 各チーム説明文 | `<p class="team-desc">` | 反映済み | CRIMSON / NOVA / GOLDEN の確定コンセプトを掲載済み |

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

- `✓` スマホでチームカード周辺が点滅する問題を再修正（2026-07-09）
  - 原因1: `team-card` の再入時フェードがスクロール境界で `visible` / `reveal-replayed` を付け外しし、カードが一瞬 opacity 0 になる場合があった
  - 原因2: 端末判定が外れる環境では `--p` の毎フレーム更新で `.team-card::before` の背景レイヤーが再ラスタライズされやすかった
  - 原因3: 初回表示の `clip-path` ワイプ開始時に、2MB級チーム背景PNGとメンバー画像を同じフレームで合成し、表示瞬間に一度だけ点滅する場合があった
  - 原因4: `prefers-reduced-motion: reduce` では `.team-card::before` を固定transformにしていたため、端末設定によってチームカード背景パララックスが完全静的になった
  - 対策: スマホ/タッチ/狭幅ではチームカードのリビールは一度表示したら固定し、背景パララックス自体は維持。`--p` 書き込みをしきい値で間引き、背景transformを `scale3d + translate3d` にしてレイヤー化を安定させる。初回表示は重い `clip-path` ワイプではなくフェードアップにし、表示前にチーム背景とメンバー画像を `decode()` する
  - 2026-07-10追記: 更新時の再発原因は初期非表示と画像待ち競合だったため、それらを撤去。チームカード背景の `--p` 更新と `.team-card::before` パララックスはスマホでも維持
  - 検証: スマホ相当Playwrightで通常設定/reduced-motionとも `--p` が動くこと、`reveal-replayed` が0件、カードが表示されたままになること、初回表示時の `clip-path` が `inset(0px)` 固定で opacity/transform のみ変化することを確認。PC幅では `.teams-grid > .team-card` の sticky stacking（1枚目と2枚目が `top:100px` で重なり、後続カードが前面に来る）も確認。`scripts/local-frontend-smoke.mjs` に回帰テスト追加

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
  - `投票ポイント合計 + 個人賞加点 + ライブスコア`
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
最終ポイント = 投票ポイント合計 + 個人賞加点 + ライブスコア
```

- 投票はリスナー1人1票
- 個人賞は3部門それぞれの1位メンバー所属チームへ50,000pt加点
- 集計の正本はバックエンドで管理
