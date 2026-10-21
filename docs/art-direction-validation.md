# アート刷新・カード統合の検証

2026-10-21。比較基点は `df05bdc`。旧本番成果物を固定した別サーバーと新画面を比較し、色だけでなく構図・キャラクター寸法・舞台・カード図像・手札配置の変化を目視した。

## 自動テスト・ビルド

- Phase 1／2：それぞれステージ済みソースを一時ディレクトリへ展開し、未完了カードエンジンへ依存せず本番ビルド・全66ファイル4,071件に成功。
- Phase 3：同様に単独スナップショットを展開し、本番ビルド・69ファイル4,256件に成功。
- 全30枚と演出統合後：`npm test` **71ファイル4,410件成功**。`npm run build` 成功。500kB超の既存チャンク警告あり。
- カードは通常／強化の独立数値、資料コスト、対象、条件、使用順、廃棄・生成・回収、シード、保存を検証。旧セーブ・マップ・祝福・ボス報酬・職業HUDの既存回帰も維持する。

## ブラウザ操作

Chromium、1920×1080・1366×768・390×844。各画面を撮影し、さらに375×667のタイトル・祝福・マップと遷移を確認した。

- 5職業それぞれの単体敵／3体敵／15枚手札、50枚手札、9／27オーブ、状態異常密度の表示と操作。
- 主要UIのviewport内配置、手札内部スクロール、カード詳細／強化切り替え、PCドラッグ・対象選択・タッチ、無効ドロップ・連打の二重処理防止。
- タイトル→職業→祝福4択→確認→受領→ロード→マップ→戦闘→タイトル→再開。保存全文・候補・資源が意図せず変更されないことを確認。
- 実カード使用・敵ターン後の状態を公開reducerの結果と完全比較し、再読み込み後の一致も確認。
- 図鑑で新30枚を名前検索し、通常／強化の切り替え60表示と実装301種類の件数を本番画面で確認（1366×768、例外0）。
- 開発サーバーと最終本番成果物でそれぞれ72ケースすべて成功、ブラウザ例外0。最終ソースからfixtureを再生成して確認した。
- 祝福のモバイル表示は効果・代償の全文と44px操作領域を優先し、ページ内縦スクロールを許す。PC戦闘・マップはページの縦スクロールなし。

## 命中演出

本番ビルドで12ケース成功、ブラウザ例外0。単発／多段、防御、盾への接触、自傷、敵攻撃、岩霊護衛、低負荷、軽減、instant、skip、fastを確認した。実イベント順と保存状態の一致、Canvas描画、WAAPIの停止区間、背景だけの揺れ、主要HUD位置、skip後の後始末を確認。描画テストによるfps保証ではない。

## 再実行

```bash
npm ci
npm test
npm run build
npm run preview -- --port 5284
```

別のターミナルで（検証環境のPython PlaywrightとChromiumを使用）：

```bash
npx esbuild scripts/browser/art-direction-fixtures.ts --bundle --platform=node --format=esm --outfile=/tmp/spyier-art-fixtures.mjs
node /tmp/spyier-art-fixtures.mjs /tmp/spyier-art-fixtures.json
IWASON_ART_URL=http://127.0.0.1:5284/spyier/ python scripts/browser/art-direction-check.py
npx esbuild scripts/browser/art-direction-effects-fixtures.ts --bundle --platform=node --format=esm --outfile=/tmp/spyier-art-effects-fixtures.mjs
node /tmp/spyier-art-effects-fixtures.mjs /tmp/spyier-art-fixtures.json /tmp/spyier-art-effects-fixtures.json
IWASON_ART_URL=http://127.0.0.1:5284/spyier/ python scripts/browser/art-direction-effects-check.py
```

全体の勝率・カード全組み合わせ、人間による長時間の3Act攻略、実機Safari／Android、低性能実機60fpsは未検証。新しい30枚は5職業各6枚であり、最新の5系統分類を完成したとは扱わない。次回の開始地点は [PROGRESS.md](PROGRESS.md)。
