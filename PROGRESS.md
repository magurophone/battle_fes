# BATTLE FES 2026 実装進捗

2026-07-19: 管理画面 `/admin/` のログイン入力が約1秒後に消える不具合を修正。イベント終了後も1秒周期の `refreshLeaderAccessAtUnlock()` が未ログイン状態で管理APIを呼び、401時の `setLoggedInUi(false)` が入力欄を空にしていた。未ログイン／ダッシュボード非表示時は解禁確認APIへ進まない条件を追加し、`scripts/local-frontend-smoke.mjs` にPC・スマホで「1.3秒待っても入力値保持」「管理API呼び出し0件」「ログイン画面維持」の回帰テストを追加。全PlaywrightスモークPASS後、Cloudflare Pages Production / masterへデプロイ済み（deployment `6c06a5b6-e837-42ee-83d9-1c72d8102aa0`）。本番 `/admin/` でもPC・スマホともHTTP 200、入力値保持、未ログイン管理API呼び出し0件を確認済み。

2026-07-15: 開発裏話その4画像 `public/assets/promo/backstage-4-type-visual.png` を修正。①「UFCのカウントダウン表示を参考」チップを画像から削除（ユーザー指示。記事 `docs/backstage-4-type-visual.md` のUFC言及は本文に残っている・削除は未指示）。`promo/shot-backstage-type-visual.mjs` の検証assertは「UFCが含まれないこと」に反転済み。②ROUND 1 / CRIMSON の色収差風ズレ影（赤/青オフセット text-shadow）が静止画でブレに見えるため黒ドロップシャドウへ変更。等倍クロップで輪郭シャープを確認済み。

## 未デプロイ（次回セッションで判断）

以下はローカル完了・本番未反映。デプロイは `powershell -ExecutionPolicy Bypass -File .\scripts\deploy-safe.ps1`。
- 個人賞60,000ptのHTMLソース秘匿対応（`public/index.html` / `battlefes.html` / `public/admin/index.html`、テスト全PASS済み）
- 7/14の管理画面2権限分離などが未デプロイならそれも含む（PROGRESS各エントリ参照）
- ※ SNS画像・配信背景は `public/assets/promo/` 配下にあるため、デプロイすると公開URLからアクセス可能になる点に留意

## SNS開発裏話シリーズ 残ネタ（ドラフトは口調=その1準拠で作成済み、会話ログ）

- 投稿済み/準備済み: その1 AZURE（7/11投稿）／その2 ライブスコア（画像 `backstage-2-livescore.png`）／その3 1人1票（画像 `backstage-3-onevote.png`）／その4 フォント（画像 `backstage-4-type-visual.png`＋記事）
- 残り候補: 没演出集／管理画面チラ見せ（数字マスクのスクショ素材が必要）／「いつ投票が一番効くか」（**7/17前日推奨**・時間加重の話）／「結果は23:00に自動公開」（**7/18当日推奨**）
- 方針: 個人賞ポイントはシリーズ全体で言及禁止（当日結果発表まで秘匿）／不正対策の判定方法の詳細は書かない／対外コピーに名前以外の絵文字禁止

2026-07-14: SNS「開発裏話」その4（フォントとサイトイメージ）の記事と添付画像を作成。事前に本番 `https://battle-fes.pages.dev` をPlaywrightでPC 1440px／スマホ390pxの全セクション・モバイルメニューまで確認。UFC参考の範囲は主に投票開始カウントダウンメーター（黒い計器盤、DAYS/HOURS/MIN/SEC、フラップ式数字、オレンジ発光）に限定し、サイト全体がUFC風という表現は避けた。フォントは日本語見出し `Dela Gothic One` と、チーム名・ROUND・カウントダウン数字に使う軍用ステンシル系 `Black Ops One` の役割を紹介。記事は `docs/backstage-4-type-visual.md`、画像は `public/assets/promo/backstage-4-type-visual.png`（1600×900 @2x）、生成元は `promo/backstage-type-visual.html` + `node promo/shot-backstage-type-visual.mjs`。レンダースクリプトで8桁／4区分／2書体／キャンバス内収まり／フォント読込／ブラウザエラーなしをPlaywright検証済み。未デプロイ。

2026-07-13: SNS「開発裏話」その3（1人1票）の添付画像を作成。`public/assets/promo/backstage-3-onevote.png`（1600×900 @2x）。Q&A見出し「2回投票したらどうなるの？→できません―1人1票」、1回目=受付/2回目=自動で無効のチケット対比、下部に「あなたの1票を待っています」+「VOTE OPEN 7.18 SAT 20:45」。不正対策の仕組みの詳細（判定方法）は回避ヒントになるため画像・文章とも記載しない方針。生成元 `promo/backstage-onevote.html` + `node promo/shot-backstage-onevote.mjs`。

2026-07-12: SNS「開発裏話」シリーズ その2（ライブスコアの決まり方）の添付画像を作成。`public/assets/promo/backstage-2-livescore.png`（1600×900 @2x）。内容は配信前/配信後メーター差分の3ステップ、1k=1,000の単位説明、推しボーナス割り戻しのフェア調整式。生成元 `promo/backstage-livescore.html` + `node promo/shot-backstage-livescore.mjs`。数字（120k/170k/+50k）は説明用の架空例。裏話シリーズのドラフト（その2〜8、口調はその1準拠）は会話内で共有済み。個人賞ポイントはシリーズ全体で非公開方針。

2026-07-12: 【方針】個人賞の加点ポイント（各部門60,000pt）は当日の結果発表まで対外的に伏せる。理由: 事前に金額を告知すると「3部門とも同じチームのメンバーに投票する」最適化行動を誘発するため。SNS開発裏側シリーズのネタからも除外。公開サイトのルール文言は「個人賞加点」という要素名のみで金額非表示（現状維持でOK）。ただし結果画面テンプレートとして「各部門60,000pt」の文字列が `public/index.html` のHTMLソース内に存在する（表示は23:00以降）。→ 同日対応済み: `public/index.html` / `battlefes.html` の「各部門60,000pt」「同率受賞 · 60,000ptを◯名で分配」を、公開後の `finalResults.awards[].bonusPoint` 合計から算出する動的文言に変更（データ未取得時は「受賞メンバーの所属チームに加点」）。`public/admin/index.html` の `pointPerAward: 60000` フォールバックも 0 に変更（実値はAPI応答で上書き）。60,000という数字は公開HTMLソースから消え、サーバー側 `functions/api/_lib/vote-store.js` の定数のみに存在。API回帰18件・フロントスモーク9件全PASS、結果画面レビュー画像で「各部門60,000pt・同率時は均等分配」「60,000ptを2名で分配」がAPI値から正しく描画されることを確認済み。

2026-07-12: 管理画面を運営者／リーダーの2権限へ分離。既存の共通 `ADMIN_TOKEN` はリーダー権限として、22:50まではライブスコア入力・チーム別ライブスコア・合計ライブスコアだけ返す。投票結果、個人賞、総合順位、コメント／ログ、最終結果はAPIレスポンスから除外し、管理画面でもタブを非表示にする。`2026-07-18T22:50:00+09:00` 以降は結果閲覧だけ自動解禁し、開いている画面も1秒監視で再取得する。新設 `OWNER_TOKEN` は時刻に関係なく全結果・設定・リセット・締切後テストを利用可能。リーダーは22:50以降もリセット／締切後切替APIを拒否する。運営者専用パスワードの値はCloudflare Secretだけに保存し、リポジトリには置かない。

2026-07-12: 公開フロントの最終結果発表を全面実装。22:30締切後〜23:00は票数を見せず「最終結果を集計中」ステージを表示し、23:00にページ更新なしで公式結果へ自動遷移する。結果は総合優勝の大判ヒーロー、3チーム総合順位、ライブスコア／個人賞加点／投票ポイントの内訳、個人賞3部門の受賞者を表示。同率個人賞は全受賞者と各配分ポイントを表示する。`/api/results` は公開時刻後だけライブスコアを読み、`finalResults` としてサーバー側で確定した順位・内訳を返す。公開前は個人賞と、締切後の全結果をAPIでも封印する。管理画面の「締切後表示 ON」は同じブラウザのテストモード公開フロントへ連動し、管理APIの実集計で結果画面を表示する。X共有は優勝・個人賞・ハッシュタグ・結果URLを入力済みのWeb Intentを生成し、公式結果ポストURLを `RESULT_ANNOUNCEMENT_POST_URL` へ設定すると引用ポスト導線になる。名前・画像・チーム演出はAPIの `memberId / memberName / teamId` と既存画像マップから自動反映。PC／スマホ／reduced-motion／23:00境界／管理画面連動／横スクロール／X URLを実ブラウザで検証。API回帰17件、フロントスモーク全件PASS。レビュー画像は `output/review/final-results-desktop.png` と `output/review/final-results-mobile.png`。

2026-07-12: 貫通BONUSキーワード9文字の透過PNG版を追加。チームごとの配信背景に直接載せられるよう、`promo/bonus-char.html` に `?trans=1` モードを実装（外枠線なし・中央放射スクリム強化・文字は金縁＋暗縁の二重シャドウ）。白/黒/グレー/派手色の4背景合成で可読性検証済み。`node promo/shot-bonus-char.mjs` が従来の不透明版に加えて `public/assets/promo/bonus/char-{1..9}-trans.png` を出力し、配布用 `public/assets/promo/bonus/貫通bonus_透過.zip` にまとめ済み。

2026-07-12: 当日配信背景（スマホ縦 1080×1920）2枚を作成。初版は黒背景の独自デザインだったが「サイトの文脈に沿っていない」「開会式中に 19:45 START 表記はおかしい」との指摘で作り直し。現行版は特設サイトのヒーローと同一の視覚言語: `hero-bg.webp` 写真背景＋暗幕グラデ、`sublogo-colorsing-trim` → `logo-B-trim` → Dela Gothic タグライン、marble の date-chip ピル意匠、スポットライト。①開会式 `public/assets/promo/stream-bg-opening.png`（チップ「開会式｜OPENING CEREMONY」、時刻表記なし、下部にチームワードマーク3枚）②本投票〜結果発表 `public/assets/promo/stream-bg-result.png`（FINAL STAGE＋「本投票・結果発表」、チップ「本投票｜22:30 締切」「結果発表｜22:30〜」、投票URL）。生成元は `promo/stream-bg.html`（`?scene=opening|result` 切替、`&guides=1` で配信UI占有領域を赤表示）+ `node promo/shot-stream-bg.mjs`。既存素材のみ使用、SNS投稿画像のレイアウト流用なし。ColorSing配信UIのレイアウト指定（ユーザー提供の見取り図）に基づき、上部0〜310px＝アイコン/視聴中/歌唱曲名、1060px〜下端＝歌詞バー+コメント欄は情報禁止領域とし、ロゴ・テキストはすべて y=330〜1040 の帯（`.safe`）内に配置。背景写真のみ全面。ガイド付きレンダリングで領域内収まりを検証済み。

2026-07-12: 個人賞60,000pt・同率分割対応の検証完了。node scripts/local-api-regression.mjs は15件すべてPASS、node scripts/local-frontend-smoke.mjs も公開投票・PCカードstacking・スマホカード・管理画面・管理画面SPの全項目PASS。

2026-07-12: 個人賞加点を各部門50,000ptから **60,000pt** へ変更。同率1位が複数いる場合は部門の60,000ptを受賞メンバー数で整数分割し、各メンバーの所属チームへ合算する。割り切れない場合は総額を正確に60,000ptへ保つため、候補ID順に1ptずつ余りを配る。APIの individualAwardBonuses.awards は同率受賞者全員を返し、各要素へ tiedWinnerCount と実配分 bonusPoint を格納。管理画面の個人賞トップ表示も1名だけを選ばず、同率受賞者全員と「同率トップ／同率受賞」を表示する。2名・3名・9名同率、同一チーム内同率、D1/API経由の3部門同率を回帰テストへ追加。

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
- [x] 顧客向け結果表示を実装（23:00自動公開、総合優勝・全順位内訳・個人賞・同率・X共有）
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
- 個人賞は3部門それぞれ60,000pt。同率1位は受賞メンバー数で分割して各所属チームへ合算
- 端数は候補ID順に1ptずつ配り、各部門の加点総額を必ず60,000ptに保つ
- 集計の正本はバックエンドで管理
