# 打撃の演出契約（Phase 5）

`src/presentation/hitFeedback.ts` は戦闘エンジンが発行した命中キューの実ダメージ・軽減・護衛の値だけを読み、演出量を返す。ダメージを再計算せず、戦闘状態・カード効果・乱数・セーブを変更しない。

- 通常の実ダメージは30〜55msの接触姿勢を持ち、既存のimpactキューの中で復帰する。fastや多数ヒットでキューが短くなった場合、停止部分をキュー予算の42%以下へ圧縮する。タイムラインに待ち時間や入力ロックを追加しない。
- 接触姿勢は同じ変形を持つ2つのキーフレームで保持する。時間軸はlinearとし、復帰区間だけにイージングを適用する。
- カメラは `.battle-arena > .world-scene` のみを最大5px（lowでは2.4px以下）動かす。HP、行動予告、固有HUD、カード、ダメージ数字の親要素は動かさない。
- 完全ブロック・岩霊の護衛は短い盾の接触表現を使い、HP被害の揺れを出さない。毒・破滅・棘・直接HP減少、HP消費は物理打撃の停止・揺れから除外する。既存の毒・犠牲・職業別のモチーフは維持する。
- Canvasに墨色の接触核、欠けた輪郭、岩片と火花を描く。1命中あたりの粒子は最大28、lowは最大9、CanvasのDPRはfullで2以下、lowで1以下。演出乱数はゲームのPRNGを使わない。
- 実ダメージの数字を読みやすいゴシック体とし、値に応じた拡大は1.24倍以内。軽減と岩霊の肩代わりは別表示。親の画面座標を固定し、文字の浮上と舞台の揺れを分離する。
- reduced motion／instantは停止・揺れ・Canvas・数字アニメーションを実行しない。skip／中止は既存の `iwason:presentation-reset` でWAAPI、RAF、Canvas、数字とタイマーを解除する。通常終了後の数字は既存の短い表示時間で消える。

ブラウザ検証用の状態は `.battle-effects-layer` の `data-hit-surface`、`data-hit-hold-ms`、`data-hit-shake-px` から確認できる。これらは表示用の情報であり保存対象ではない。

検証：`npm test -- src/tests/hit-feedback.test.ts src/tests/presentation-timeline.test.ts src/tests/class-effects.test.ts` が3ファイル69テスト成功。`npx tsc -b --pretty false` 成功。ブラウザ検証と最終ビルドは全Phaseの統合後に記録する。

統合検証：全71ファイル4,410件と本番ビルド成功。本番Chromiumの単発／多段・盾・護衛・自傷・軽減・skip等12ケースが成功。実cue順／状態不変／背景だけの揺れを確認し、60fps実機計測は未実施。
