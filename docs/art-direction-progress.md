# アート刷新・カード30種類の継続記録

2026-10-21、基点 `df05bdc`。開始時はクリーン、カード271定義（参照240/574）、レリック198定義（参照173/294）。既存3Act・5職業・固有HUD・マップ・取得区分・セーブを維持する。

## アートの基準

古代岩石信仰・ダークファンタジー・じっと教。墨緑の奥行きある神殿、石灰のキャラクター、磨かれた金の光を使う。四角い囲いを減らし、キャラクター、ルート、儀式がそれぞれ画面の主役になる構図にする。既存キャラクターの顔・装備を維持し、独自SVGの建築・祭壇・地図・カード図像を追加する。他作品の画像・枠・アイコンを使用しない。

## Phaseと再開地点

- [x] Phase 1：戦闘とカード。大きいキャラクター、神殿の空間、独自カード枠・図像、PC扇状手札、タッチ・大量手札の内部スクロール。ビルドと主要動作を確認してコミット。
- [x] Phase 2：タイトル・祝福・マップ。神殿内のタイトル、儀式の4択、地図主体の画面。既存の開始・再開・確認・保存・移動を保持。ビルドと主要動作後コミット。
- [x] Phase 3：新15種類（5職業各3）。通常・強化、取得制限、保存、追加共通効果を検証してコミット。
- [x] Phase 4：残り15種類（5職業各3）。カードの使用順・廃棄・生成・リソース参照を拡張し、30種類を監査、回帰確認してコミット。
- [x] Phase 5：同期する打撃・短いヒットストップ、レスポンシブ、軽減設定、全回帰と本番ビルド、ブラウザ、通常push、Pages公開確認。

## 作業中のファイル分担

- 戦闘：BattleScreen / BattleHand / CardView と art-battle.css / art-cards.css。
- シーン：TitleScreen / BlessingScreen / MapScreen と art-scenes.css。Appの保存・dispatch境界は維持する。
- 舞台：WorldScene / TempleSeal と `src/assets/world/*.svg`。差し替え用manifestに集約。
- 第1弾：artExpansionPhase3Cards.ts と専用テスト、共通型・効果resolver・参照値。
- 第2弾：artExpansionPhase4Cards.ts と専用テスト、cardMetrics.ts。
- 共通統合：engine/index / draw / turn / resources / persistence / cardRuntime / classCards登録。セーブは任意フィールドを追加し旧データを再抽選しない。
- QA：scripts/browser/art-direction-*、docs/art-direction-validation.md。固定した旧本番成果物と新画面を比較する。

未コミット変更を破棄しない。再開時には本書と `git status`、直近のコミットを確認し、完成済みPhaseを作り直さない。資料にない効果・種別・レアリティを正式仕様と断定しない。未実装のカードを取得候補へ混ぜない。

Phase 1コミット `3e9c357`：ステージ済みのソースだけを一時展開し、カード基盤の作業中変更へ依存せず本番ビルドと全66ファイル4,071テスト成功。1920×1080・1366×768・390×844で6戦闘画面を確認、全viewport内。正確なSHAは `git log --oneline --grep="Reframe combat"` で確認できる。

再開時の最新状態・カード301定義・4,410テスト成功・残課題は [PROGRESS.md](PROGRESS.md) を優先する。Phase 2 `55dc193`、Phase 3 `e9d6432`、Phase 4 `e00246e` をコミット済み。

Phase 5：本番ビルドで72画面／操作ケースと12命中演出ケース成功、ブラウザ例外0。全71ファイル4,410テスト成功。公開反映のSHAと次回の未完了項目はPROGRESS.mdへ記録。
