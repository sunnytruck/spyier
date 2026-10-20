import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RARITIES = ['starter', 'common', 'uncommon', 'rare', 'shop', 'ancient', 'event'];
const CLASS_NAMES = { berserker: '岩砕の拳僧', assassin: '静刃の影師', oracle: '星詠みの法王', necromancer: '黄泉渡りの霊僧', machinist: '岩核の機巧師' };

// These notes describe unfinished integration, not missing official source specifications.
// Source ambiguities remain separate, as recorded by the CP932 importer.
const PENDING = {
  アメジストのナス: ['資料確認', '追加15ゴールドを敵1体ごと／戦闘1回ごとのどちらで数えるかを確定していない。'],
  小さなポスト: ['実装未完了', '休憩後の複数ポーション獲得と、所持枠が満杯の際の選択・入替処理が未実装。'],
  数珠: ['実装未完了', '？部屋の通常敵遭遇抽選を抑止する処理を未接続。'],
  赤い頭蓋骨: ['実装未完了', 'HP50%境界をまたぐ筋力補正が未実装。hpThresholdStrengthは型定義だけで実処理へ未接続。'],
  ペン先: ['実装未完了', '10回目のアタック全体に対するダメージ倍化と継続カウンターを未接続。'],
  爬虫類のトリンケット: ['実装未完了', 'ポーション使用時の一時筋力3とターン終了時の解除を未接続。'],
  折りキャエル: ['実装未完了', '脆弱に相当する状態の倍率を1.5から1.75へ変える処理を未実装。'],
  製本用ナイフ: ['実装未完了', 'ミニオン判定と破滅による撃破原因に限定した回復フックを未実装。'],
  星屑: ['依存機構未実装', '星の消費を参照するが、現在のIWASONは星を獲得・参照する仕様。資料のないカード星コストを独自追加しない。'],
  ちびリージェント: ['依存機構未実装', '星消費時の誘発が必要だが現在のIWASONには星の消費処理がない。星獲得時の効果で代用しない。'],
  共生ウイルス: ['実装未完了', '現在の雷・霜に加えるダークオーブの蓄積・自動発動・解放・HUDが未実装。'],
  ギャンブルチップ: ['実装未完了', '戦闘開始時の任意枚数破棄・同数ドローの専用選択画面が未実装。'],
  ケトルベル: ['実装未完了', '休憩所の筋力トレーニングとラン内上限3回の施設操作が未実装。'],
  ショベル: ['実装未完了', '休憩所の発掘操作と通常レリック抽選への接続が未実装。'],
  ホワイトスター: ['実装未完了', 'エリート撃破時の追加レアカード報酬画面と個別取得済み管理を未接続。'],
  マニ車: ['実装未完了', '通常戦闘の追加カード報酬画面と個別取得済み管理を未接続。'],
  ミイラの手: ['実装未完了', 'パワー使用後のランダムな手札1枚へのターン限定無料化を未接続。'],
  永久コマ: ['実装未完了', '手札が0枚になる都度のドロー誘発と連鎖防止境界を未接続。'],
  懐中時計: ['実装未完了', '前ターンの使用枚数を参照する追加3ドローを未接続。'],
  長持ちキャンディ: ['実装未完了', '戦闘1回おきの追加パワー報酬と戦闘をまたぐカウンターを未接続。'],
  剃刀の牙: ['実装未完了', '使用したアタック・スキルそのものを戦闘中強化する所持品誘発を未接続。'],
  難解なパズル: ['実装未完了', '開始時のランダム生成と対象カード1枚の無料化を未接続。'],
  虹の指輪: ['実装未完了', '各ターンのカード3種の初回使用判定と筋力・敏捷獲得を未接続。'],
  配達人: ['実装未完了', '20%割引と購入直後の在庫補充を一体で行う処理が未実装。'],
  白き獣の像: ['実装未完了', '戦闘報酬へのポーション保証と満杯時の獲得選択を未接続。'],
  不気味なランプ: ['実装未完了', '最初のデバフカードの適用効果を倍化する対象判定を未実装。'],
  脈打つ亡骸: ['実装未完了', 'ターン内HP減少の累計上限20を全HP減少経路へ未接続。'],
  悪魔の舌: ['実装未完了', '自ターン最初のHP減少の実損失量を参照する回復を未接続。'],
  朽ちた兜: ['実装未完了', '戦闘初回の筋力獲得だけを倍化する誘発を未接続。'],
  螺旋のダーツ: ['実装未完了', '石刃使用時の一時敏捷とターン終了時の解除を未接続。'],
  折りズル: ['実装未完了', '弱体に相当する状態の与ダメージ倍率を0.75から0.6へ変える処理を未実装。'],
  オレンジ色の生地: ['実装未完了', '開始時の通常無色プールからのランダム2枚生成を未接続。'],
  ビックハット: ['実装未完了', '開始時のエセリアル対象プールとランダム2枚生成を未接続。'],
  栞: ['実装未完了', '保留カードを対象とする使用時まで持続するコスト減少を未接続。'],
  感情制御回路: ['実装未完了', '前ターンのHP損失記録と開始時の全オーブ自動発動を未接続。'],
  メトロノーム: ['実装未完了', '戦闘内7個目のオーブ生成に対する一度限りの全体攻撃を未接続。'],
  パワーセル: ['実装未完了', '開始時に山札の0コスト2枚を抽出する処理を未接続。'],
  ケミカルX: ['実装未完了', '各Xコスト効果の実行回数・量への追加2を横断的に未接続。'],
  ベルトの留め具: ['実装未完了', 'ポーション所持の変化に応じた敏捷2の付与・解除を未接続。'],
  ミニテント: ['実装未完了', '休憩所での複数操作と各操作の重複実行防止が未実装。'],
  共鳴するトライアングル: ['実装未完了', '1ターン目限定の手札全保留を未接続。'],
  護摩木: ['実装未完了', '戦闘初回のスキル廃棄を検知して同カードのコピーを作る処理を未接続。'],
  神秘のライター: ['依存機構未実装', 'エンチャントの所持・有効判定が未実装のため攻撃への追加9を適用できない。'],
  大釜: ['実装未完了', 'ポーション5個獲得時の所持枠不足に対応する選択・入替が未実装。'],
  道具箱: ['実装未完了', '戦闘開始時の無色3択と手札追加の中断・再開UIが未実装。'],
  薄汚れた敷物: ['実装未完了', '所持時だけ通常報酬に無色を許すプール例外を未接続。'],
  幽霊の種: ['実装未完了', '初期ストライク・防御への戦闘中エセリアル付与を未接続。'],
  溶岩のランプ: ['実装未完了', '戦闘中無被害の追跡とその報酬全体強化を未接続。'],
  ウィトルウィウス的ミニオン: ['依存カード未実装', '名前にミニオンを含む対象カード群が未実装。対象の効果を簡略化せず保留。'],
  不死の紋章: ['実装未完了', '攻撃元のHPと破滅を参照する敵攻撃半減を未接続。'],
  銀のるつぼ: ['実装未完了', '最初の報酬3回強化・最初の宝箱空振りの二つのラン内カウンターを未接続。'],
  轟音のほら貝: ['実装未完了', 'エリート限定の戦闘開始追加2ドローとして未登録・未検証。'],
  失われし金庫: ['実装未完了', '取得時のカード報酬選択とポーション取得を続けて行う処理が未実装。'],
  呪いの真珠: ['依存カード未実装', '資料が指定する呪い「強欲」の正確なカード実装がない。333Gだけを配布しない。'],
  小さなカプセル: ['実装未完了', '取得時に別レリックを抽選し、その取得処理まで連鎖させる予約が未実装。'],
  大きなカプセル: ['実装未完了', '別レリック2件の連続取得と初期カード追加を一体化する取得予約が未実装。'],
  薬草の湿布: ['実装未完了', '初期ストライク・防御を1枚ずつ変化させる条件付き複数対象処理を未接続。'],
  溶岩石: ['実装未完了', 'Act1ボスのレリック2件ドロップと、その連続取得・Act移行への接続が未実装。'],
  パエルの眼: ['実装未完了', 'カード未使用での初回ターン終了を条件とする全手札廃棄・追加ターンと、敵毒・破滅タイミングの接続が未実装。'],
  シーグラス: ['実装未完了', '他職業15枚から任意枚数を取得する専用選択処理が未実装。'],
  プリズムジェム: ['実装未完了', 'ターン開始エナジーと他色報酬の二つを同時に満たすプール例外を未接続。'],
  光り輝く真珠: ['依存カード未実装', '指定カード「発光」の正確な効果実装が未対応。別カードで代用しない。'],
  流木: ['実装未完了', 'カード報酬の一度限りリロールと確定候補の保存が未実装。'],
  錬金術の宝庫: ['実装未完了', '追加4スロットへのランダムポーション同時充填を未接続。'],
  パエルの歯: ['実装未完了', '削除したカード5枚の別領域保存と戦闘後1枚ずつの強化返却が未実装。'],
  パエルの翼: ['実装未完了', '報酬を捧げる選択と2回ごとのレリック取得予約を未実装。'],
  パエルの涙: ['実装未完了', '終了時の残エナジーを条件にした次ターン追加2エナジーを未接続。'],
  アツアツの愛情: ['依存カード未実装', '削除4枚の後にシャッフル時生成する「すす」の正確なカード効果が未対応。'],
  あったか手袋: ['実装未完了', '開始時の山札先頭廃棄と筋力1の複合誘発を未接続。'],
  カボチャのキャンドル: ['実装未完了', 'Act3で消えるターン開始エナジーとAct境界の無効化を未接続。'],
  黄金の印章: ['実装未完了', 'ターン開始時5G支払い可否とエナジー1獲得を未接続。'],
  ダイヤのティアラ: ['実装未完了', '当ターン使用枚数2以下を条件とする敵攻撃半減を未接続。'],
  祝福の枝角: ['依存カード未実装', '開始時に混ぜる「めまい」の正確な状態カード実装が未対応。エナジーだけを付与しない。'],
  繊細な葉: ['実装未完了', '開始時の空ポーション枠のランダム充填を未接続。'],
  鮮やかなスカーフ: ['実装未完了', '各ターン5枚目だけの無料化判定をカード使用可否に未接続。'],
  クロスボウ: ['実装未完了', '開始時アタック生成とそのカードだけのターン限定無料化を未接続。'],
  トゲ付きガントレット: ['実装未完了', 'ターン開始エナジーとパワー限定のコスト増加を合わせて未接続。'],
  手投げ斧: ['実装未完了', '各戦闘最初のカードの追加使用と再帰防止を未接続。'],
  オルゴール: ['実装未完了', '各ターン最初の攻撃のコピー生成とエセリアル付与を未接続。'],
  フィドル: ['実装未完了', '開始時追加2ドローと自ターン中ドロー禁止を合わせて未接続。'],
  王のパラソル: ['実装未完了', 'ショップ到着時の全在庫徴収と取得時効果の連続予約が未実装。'],
  干からびた爪: ['依存カード未実装', '同時に受け取るランダム呪い2枚の資料準拠プールが不足。願い3枚だけの配布にしない。'],
  血染めのバラ: ['依存カード未実装', '指定カード「心酔」の正確な効果実装がない。エナジーだけを付与しない。'],
  選択のジレンマ: ['実装未完了', '戦闘開始時のカード5択と選択カードへの保留付与の中断・再開UIが未実装。'],
  瓶詰めの霧: ['依存カード未実装', '指定カード「愚行」の正確な効果実装がない。カード3枚削除だけを実行しない。'],
  宝飾の仮面: ['実装未完了', '開始時の山札パワー抽出とそのカード限定無料化を未接続。'],
  ししおどし: ['実装未完了', 'ターン開始エナジーと全取得経路のポーション獲得禁止を合わせて未接続。'],
  スネッコアイ: ['依存機構未実装', '混乱によるドロー時ランダムコスト変更が未実装。追加ドローだけを付与しない。'],
  ブラックスター: ['実装未完了', 'エリートの追加レリック報酬と個別取得済み管理を未接続。'],
  ベルベットチョーカー: ['実装未完了', 'ターン開始エナジーとターン内6枚上限を合わせて未接続。'],
  ルーンのピラミッド: ['実装未完了', '全手札を恒常的に捨てなくする終了時処理を未接続。'],
  ウォンゴのミステリーチケット: ['実装未完了', '5戦後のレリック3件連続取得と使用済み管理が未実装。'],
  ザ・ブーツ: ['実装未完了', 'ブロック解決後の各攻撃ヒット最小5ダメージへの補正を未接続。'],
  'ストライクダミー？': ['実装未完了', '資料名ストライク参照の追加1ダメージとして未登録・未検証。'],
  'スネッコアイ？': ['依存機構未実装', '混乱によるドロー時ランダムコスト変更が未実装。'],
  ハンドドリル: ['実装未完了', '敵ブロックを0にした瞬間の脆弱2付与を未接続。'],
  モーの貯金箱: ['実装未完了', '階段移動12Gとショップ支払い時の恒久停止を未接続。'],
  骨茶: ['実装未完了', '次の1戦だけ初手強化する消耗回数と保存・解除を未接続。'],
  '商人の敷物？': ['資料上無効果', '原文が偽物・無効果と明記。効果未実装カードと混同せず、今回は取得イベントへ未追加。'],
  炭火茶: ['実装未完了', '次の5戦だけ開始時筋力2を付与する消耗回数と保存を未接続。'],
  無作法茶: ['依存カード未実装', '次戦の山札に混ぜる「めまい」の正確な状態カード実装が未対応。'],
  歴史学教程: ['実装未完了', '最後に使用した攻撃／スキルの保存とターン開始時の自動コピー使用を未接続。'],
  重い石板: ['依存カード未実装', '同時に受け取る「怪我」の正確なカード実装がない。レア3択だけを配布しない。'],
  薬瓶のホルスター: ['実装未完了', '1枠追加後のポーション2個獲得で起こり得る枠不足選択・入替が未実装。'],
  空飛ぶ靴: ['実装未完了', '次の部屋を道なしで選ぶ例外移動とラン内残り3回の消費を未接続。'],
  万華鏡: ['実装未完了', '他職業カード報酬2画面の連続選択と候補固定保存が未実装。'],
};

export function buildRelicImplementationAudit(catalog, definitions, cards) {
  const runtime = Object.values(definitions);
  const bindings = new Map();
  for (const relic of runtime) {
    if (!relic.sourceRelicId) continue;
    if (bindings.has(relic.sourceRelicId)) throw new Error(`Duplicate runtime source binding: ${relic.sourceRelicId}`);
    bindings.set(relic.sourceRelicId, relic);
  }
  const entries = catalog.relics.map((source) => {
    const relic = bindings.get(source.sourceId);
    if (relic) {
      if (relic.sourceRelicName !== source.sourceName || relic.rarity !== source.rarity) throw new Error(`Source metadata mismatch: ${source.sourceName}`);
      const acquisition = source.acquisition === 'blessing' ? 'ancient' : source.acquisition === 'starterUpgrade' ? 'starter' : source.acquisition;
      if (relic.acquisition !== acquisition) throw new Error(`Source acquisition mismatch: ${source.sourceName}`);
      return { source, relic, status: 'implemented', reason: '実行定義・共通処理へ接続済み。効果の検証結果は各担当テストと統合検証記録を参照。' };
    }
    const explicit = PENDING[source.sourceName];
    const warnings = source.issues.filter((issue) => issue.severity !== 'info');
    if (explicit) return { source, status: explicit[0], reason: explicit[1] };
    if (warnings.length) return { source, status: '資料確認', reason: warnings.map((issue) => issue.message).join(' ') };
    throw new Error(`Missing precise pending reason: ${source.sourceName}`);
  });
  const orphan = [...bindings.keys()].find((id) => !catalog.relics.some((source) => source.sourceId === id));
  if (orphan) throw new Error(`Unknown source binding: ${orphan}`);
  const implemented = entries.filter(({ status }) => status === 'implemented');
  return {
    entries, runtimeCount: runtime.length, implementedCount: implemented.length,
    unboundLegacyCount: runtime.length - implemented.length,
    pendingCount: entries.length - implemented.length,
    rarityCounts: Object.fromEntries(RARITIES.map((rarity) => [rarity, { source: entries.filter(({ source }) => source.rarity === rarity).length, implemented: implemented.filter(({ source }) => source.rarity === rarity).length }])),
    pendingReasons: entries.filter(({ status }) => status !== 'implemented').reduce((counts, { status }) => ({ ...counts, [status]: (counts[status] ?? 0) + 1 }), {}),
    cardCount: Object.keys(cards).length,
    sourceBoundCardCount: Object.values(cards).filter((card) => card.sourceCardId).length,
  };
}

const cell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
export function renderRelicImplementationAudit(audit) {
  const counts = Object.entries(audit.rarityCounts).map(([rarity, count]) => `| ${rarity} | ${count.source} | ${count.implemented} | ${count.source - count.implemented} |`).join('\n');
  const pending = audit.entries.filter(({ status }) => status !== 'implemented').map(({ source, status, reason }) => `| ${source.sourceLine} | ${source.sourceName} | ${source.rarity} | ${status} | ${cell(reason)} |`).join('\n');
  const implemented = audit.entries.filter(({ relic }) => relic).map(({ source, relic }) => `| ${source.sourceName} | \`${relic.id}\` | ${source.rarity} / ${relic.acquisition}${relic.upgradeFrom ? '（通常版の交換のみ）' : ''} | ${relic.classId ? CLASS_NAMES[relic.classId] + (source.classScope.kind === 'explicit' ? '（資料明示）' : '（機能上のIWASON制限）') : '共通'} |`).join('\n');
  const classes = Object.entries(CLASS_NAMES).map(([id, name]) => {
    const exclusive = audit.entries.filter(({ relic }) => relic?.classId === id);
    return `| ${name} | ${exclusive.length} | ${exclusive.map(({ source }) => source.sourceName).join('、')} |`;
  }).join('\n');
  return `# レリック実装状態の全件照合\n\nこの文書は原CP932資料からの固定カタログと現在の実行定義を \`sourceRelicId\` で突き合わせた動的レポート。資料の解析状態 \`pending\`／\`needs_review\` は実装済み判定ではない。重複バインド、資料名・レアリティ・入手区分の不一致、未記載の保留理由がある場合は再生成をエラーにする。\n\n## 件数\n\n資料294件中 **${audit.implementedCount}件を実装**、**${audit.pendingCount}件は未実装・保留**。既存独自${audit.unboundLegacyCount}件を別枠で維持し、ゲームのレリック定義は **${audit.runtimeCount}件**。資料準拠実装には旧IDを再利用した5件を含むため、今回の新規ID追加数は${audit.runtimeCount - 30}件。通常版5件・強化版5件はスターター10件の内訳であり、強化版を最初から配るものではない。\n\n| 資料分類 | 資料総数 | 実装 | 未実装・保留 |\n| --- | ---: | ---: | ---: |\n${counts}\n\n未実装の区分は ${Object.entries(audit.pendingReasons).map(([status, count]) => `${status}${count}件`).join('、')}。「実装未完了」は仕様不明という意味ではなく、今回の実装・接続・検証が完了していない。原文で未定義の効果を独自補完したり、一部の効果だけを配布したりせず取得プールから除外する。\n\n## 入手経路と互換性\n\n- スターター通常版は新規UIランの初期装備。強化版は対応する通常版を置き換え、同時所持時も通常版を抑止。宝箱・エリート・ショップ・一般イベントのランダム候補に混ぜない。\n- コモン・アンコモン・レアの資料実装${['common', 'uncommon', 'rare'].reduce((sum, rarity) => sum + audit.rarityCounts[rarity].implemented, 0)}件は通常報酬。これに旧独自25件を維持する。ショップ${audit.rarityCounts.shop.implemented}件、エンシェント${audit.rarityCounts.ancient.implemented}件、イベント${audit.rarityCounts.event.implemented}件はそれぞれの専用経路に限定。\n- エンシェントは既存祝福4択の候補になり、他のHP・ゴールド・カード等の選択肢を維持する。取得後に必要なカード選択を確定し、選択状態・候補・結果・使用済みカウンターを保存。\n- イベント${audit.rarityCounts.event.implemented}件には7種類の条件付き？イベントを追加し、対価・所持済み制限と退出肢を用意する。\n- 旧ID再利用はヴァジュラ→\`prayer_knuckle\`、バックパック→\`fossil_bookmark\`、ランタン→\`amber_spark\`、ビー玉袋→\`stone_mask\`、レッドマスク→\`ember_lens\`。旧表示名・保存IDを維持し、原文名は別属性へ保存。蛇の指輪はバックパックと別の資料レリックとして職業専用IDを持つ。\n- 資料の脱力→engine weak（画面の弱体）、資料の弱体→engine vulnerable（画面の脆弱）は既存カード資料と共通の翻訳契約。スターターの末尾句点補足を除き、旧5ID以外の表示効果は原文全文を使用する。\n- 旧セーブの所持品・保存済み報酬・祝福候補を再抽選しない。今回追加の取得時効果を旧所持品に遡って実行しない。\n\n## 職業制限\n\n原資料が職業を明示するのはスターター10件のみ。残る専用8件は固有リソース・生成カードを参照するため、効果のない職業へ配らないためのIWASON取得制限であり、原資料に明記された職業分類としては扱わない。レアリティ・入手区分とは独立する。\n\n| 職業 | 専用実装数 | 内訳 |\n| --- | ---: | --- |\n${classes}\n\n## カードの維持\n\nカードは **${audit.cardCount}定義**、うち既存参照資料へ紐付くもの **${audit.sourceBoundCardCount}件**。今回の追加カードは0件。限定カード取得のレリックは前回追加済みの8種類を既存IDで再利用する。資料参照574件との差${574 - audit.sourceBoundCardCount}件は未実装参照カードであり、通常取得可能なカード数とは別。生成専用・祝福限定の出現制限を維持する。\n\n## 実装済み全件\n\n| 資料名 | 実行ID | 分類 / 入手 | 職業 |\n| --- | --- | --- | --- |\n${implemented}\n\n## 未実装・保留全件\n\n全${audit.pendingCount}件を示す。「未接続」は当該レリックとしての処理・取得・検証が未完了という意味で、基礎処理がエンジンに全くないと断定するものではない。資料確認が必要なものと、仕様は読み取れるが実装していないものを分ける。\n\n| 原文見出し行 | 資料名 | 分類 | 区分 | 個別理由 |\n| ---: | --- | --- | --- | --- |\n${pending}\n\n## 再生成・検証\n\n\`node scripts/report-relic-implementation.mjs\` で現在のレジストリを読み込み再生成する。ゲームの定義やセーブを書き換えない。完全な効果検証は \`reference-relic-definitions.test.ts\`、\`relic-reference-combat.test.ts\`、\`relic-acquisition.test.ts\`、\`relic-run-integration.test.ts\` と [レリック更新の検証記録](relic-update-validation.md) を参照。件数の集計や原文との一致だけで戦闘効果を検証したとは扱わない。\n`;
}

async function main(args) {
  let output = resolve(ROOT, 'docs/relic-implementation-audit.md');
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--out') throw new Error('Usage: node scripts/report-relic-implementation.mjs [--out path]');
    output = resolve(args[1]);
  }
  const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { RELIC_DEFINITIONS } = await server.ssrLoadModule('/src/data/relics.ts');
    const { CARD_DEFINITIONS } = await server.ssrLoadModule('/src/data/cards.ts');
    const catalog = JSON.parse(readFileSync(resolve(ROOT, 'src/data/sourceRelics.generated.json'), 'utf8'));
    const audit = buildRelicImplementationAudit(catalog, RELIC_DEFINITIONS, CARD_DEFINITIONS);
    writeFileSync(output, renderRelicImplementationAudit(audit));
    process.stdout.write(`${JSON.stringify({ runtime: audit.runtimeCount, implemented: audit.implementedCount, pending: audit.pendingCount, rarityCounts: audit.rarityCounts, pendingReasons: audit.pendingReasons, cards: audit.cardCount, sourceBoundCards: audit.sourceBoundCardCount }, null, 2)}\n`);
  } finally { await server.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv.slice(2));
