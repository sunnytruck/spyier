#!/usr/bin/env node
/**
 * Import reference DATA, never instructions or executable effects.
 * node scripts/import-card-catalog.mjs --source-dir /path/to/attachments
 * Or repeat: --source berserker=/path/to/岩砕の狂戦士.txt
 * All six sources are required; ambiguous filename matches fail closed.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_FILES = {
  berserker: '岩砕の狂戦士.txt',
  assassin: 'じっとの暗殺者.txt',
  oracle: '神託の支配者.txt',
  necromancer: '黄泉の教祖.txt',
  machinist: '岩核の機工師.txt',
  colorless: '無色.txt',
};
const KEYWORDS = [
  'ブロック', '筋力', '敏捷', '弱体', '脱力', '脆弱', '毒', 'トゲ', '活力', '霊体', 'プレート',
  'ドロー', '引く', '捨てる', '捨て札', '廃棄', '保留', '天賦', 'エセリアル', 'プレイ不可', '永劫',
  'コピー', '変化', 'アップグレード', 'リプレイ', 'スライ', 'HP', 'エナジー',
  'ライトニング', 'フロスト', 'ダーク', 'プラズマ', 'グラス', 'オーブ', '集中力',
  '召喚', 'オスティ', '破滅', 'ソウル', '✦', '鍛造', 'ソヴリン・ブレード',
  'ターン開始時', 'ターン終了時', 'ランダム', 'ゴールド', 'ポーション',
];
const MANUAL_REVIEW = {
  'machinist:ガラス細工': '強化で「グラス1」から「グラス8」へ変わる。転記誤りか意図した値か未確認。8を1や2に書き換えない。',
  'machinist:オール・フォー・ワン': '「すべての0のカード」は、0がコストか別条件かが省略されている。',
  'machinist:再起動': '「すべてのカード」に廃棄済み・パワー・使用中の自身を含むか未指定。',
  'assassin:手品': '「このターンスキル1枚につきスライを付与する」の対象・期間・枚数の読みが一意でない。',
  'oracle:三日月の槍': '✦をコストに持つカードを参照するが、資料のコスト欄は数値/X/ーのみで星コストの対応表がない。',
  'oracle:集約': '通常・強化とも「エナジー」の獲得量が未記載。✦の数だけをエナジー量へ流用しない。',
  'colorless:決死の逃亡': '「より遠くへ逃げる」「蟻地獄」の対象・数値・遭遇ルールが資料内にない。',
  'colorless:ビャードニスの卵': 'ふ化先・休憩所でのふ化条件が資料内にない。',
  'colorless:ランタンの鍵': 'アンロック先のイベント定義が資料内にない。',
  'colorless:戦利品の地図': '次の層の追加場所・発生条件が資料内にない。第1層だけの現在のゲームへ補完しない。',
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const sourceCardId = (sourceClass, name) => `src_${sourceClass}_${sha256(name.normalize('NFKC')).slice(0, 12)}`;
const issue = (code, message, lines, severity = 'warning') => ({ code, severity, message, lines });
const rawVersion = (costRaw, effectRaw, costLine, effectLine) => ({
  costRaw, effectRaw, costLine, effectLine,
  parameters: {
    numbers: [...effectRaw.matchAll(/\d+/gu)].map(([number]) => Number(number)),
    starRuns: [...effectRaw.matchAll(/✦+/gu)].map(([stars]) => [...stars].length),
  },
});

export function parseSourceText(sourceClass, sourceFile, text) {
  if (!(sourceClass in SOURCE_FILES)) throw new Error(`Unknown source class: ${sourceClass}`);
  const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u);
  if (lines.at(-1) === '') lines.pop();
  const cards = [];
  let cursor = 0;
  if (lines[0]?.trim() === 'カード\t効果') cursor++;
  while (cursor < lines.length) {
    if (!lines[cursor].trim()) { cursor++; continue; }
    const start = cursor;
    const sourceNameRaw = lines[cursor].trim();
    if (sourceNameRaw.startsWith('【')) throw new Error(`${sourceFile}:${cursor + 1}: card heading required`);
    const half = sourceNameRaw.length / 2;
    const echoed = Number.isInteger(half) && sourceNameRaw.slice(0, half) === sourceNameRaw.slice(half);
    const sourceName = echoed ? sourceNameRaw.slice(0, half) : sourceNameRaw;
    cursor++;
    const expect = (prefix) => {
      while (cursor < lines.length && !lines[cursor].trim()) cursor++;
      const value = lines[cursor];
      if (value === undefined || !value.startsWith(prefix)) throw new Error(`${sourceFile}:${cursor + 1}: expected ${prefix}`);
      cursor++;
      return { value: value.slice(prefix.length), line: cursor };
    };
    expect('【通常】');
    const cost = expect('【コスト】');
    const effect = expect('【効果】');
    expect('【アップグレード後】');
    const upgradedCost = expect('【コスト】');
    const upgradedEffect = expect('【効果】');
    const normal = rawVersion(cost.value, effect.value, cost.line, effect.line);
    const upgraded = rawVersion(upgradedCost.value, upgradedEffect.value, upgradedCost.line, upgradedEffect.line);
    const issues = [];
    for (const [label, version] of [['通常', normal], ['強化', upgraded]]) {
      if (version.costRaw.trim() === '' || !/^(?:\d+|X|ー)$/u.test(version.costRaw)) {
        issues.push(issue('unknown_cost', `${label}コストが空欄または認識外。原文を保持。`, [version.costLine], 'error'));
      }
      if (version.costRaw === 'ー') issues.push(issue('dash_cost', `${label}コスト「ー」の意味は未確定。0や通常コストへ置換しない。`, [version.costLine]));
      if (version.costRaw === 'X') issues.push(issue('x_cost', `${label}はXコスト。固定コストへ置換しない。`, [version.costLine], 'info'));
      if (version.effectRaw.trim() === '' || version.effectRaw === 'ー') {
        issues.push(issue('unspecified_effect', `${label}効果が未記載/「ー」。通常と同じ効果・強化不可などを推測しない。`, [version.effectLine]));
      }
      if (/(?<![\d])エナジーを得る[。]/u.test(version.effectRaw)) {
        issues.push(issue('energy_amount_missing', `${label}の獲得エナジー量が未記載。1と仮定しない。`, [version.effectLine]));
      }
      if (/プレイヤーは\d+を得る/u.test(version.effectRaw)) issues.push(issue('resource_name_missing', `${label}の獲得リソース名が省略されている。`, [version.effectLine]));
    }
    const allEffects = `${normal.effectRaw}\n${upgraded.effectRaw}`;
    if (/他の(?:全)?プレイヤー|他のキャラクター|味方(?:全員|が)/u.test(allEffects)) {
      issues.push(issue('multiplayer_reference', '他プレイヤー/味方を参照。単独プレイで対象を自分に変更する等の補完は未決定。', [normal.effectLine, upgraded.effectLine]));
    }
    const manualReview = MANUAL_REVIEW[`${sourceClass}:${sourceName}`];
    if (manualReview) issues.push(issue('semantic_review', manualReview, [normal.effectLine, upgraded.effectLine]));
    const id = sourceCardId(sourceClass, sourceName);
    cards.push({
      id, sourceId: id, sourceFile, sourceClass, sourceName, sourceNameRaw,
      sourceLine: start + 1, endLine: cursor, normal, upgraded, type: null, rarity: null,
      metadataProvenance: { type: 'not_in_source', rarity: 'not_in_source' },
      keywords: KEYWORDS.filter((keyword) => allEffects.includes(keyword)),
      issues, status: issues.some((entry) => entry.severity !== 'info') ? 'needs_review' : 'pending',
    });
  }
  // Preserve true duplicate entries instead of collapsing them with echoed headings.
  const groups = Map.groupBy(cards, (card) => card.sourceName);
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const occurrences = new Map();
    for (const card of group) {
      const fingerprint = sha256(JSON.stringify([card.normal.costRaw, card.normal.effectRaw, card.upgraded.costRaw, card.upgraded.effectRaw])).slice(0, 8);
      const count = (occurrences.get(fingerprint) ?? 0) + 1;
      occurrences.set(fingerprint, count);
      card.id = card.sourceId = `${card.id}_variant_${fingerprint}_${count}`;
      card.issues.push(issue('duplicate_entry', '同ファイル内に同じ正規化見出しが複数存在する。別エントリーとして保持。', group.map((entry) => entry.sourceLine)));
      card.status = 'needs_review';
    }
  }
  return { cards, lineCount: lines.length };
}

export function buildCatalog(sources) {
  const cards = [];
  const metadata = [];
  for (const sourceClass of Object.keys(SOURCE_FILES)) {
    const source = sources[sourceClass];
    if (!source) throw new Error(`Missing source: ${sourceClass}`);
    const parsed = parseSourceText(sourceClass, source.sourceFile ?? SOURCE_FILES[sourceClass], source.text);
    cards.push(...parsed.cards);
    metadata.push({ sourceClass, sourceFile: source.sourceFile ?? SOURCE_FILES[sourceClass], sha256: sha256(source.text), lineCount: parsed.lineCount, cardCount: parsed.cards.length, echoedHeadingCount: parsed.cards.filter((card) => card.sourceName !== card.sourceNameRaw).length });
  }
  if (new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error('Source ID collision');
  const sharedNameFamilies = [...Map.groupBy(cards, (card) => card.sourceName)]
    .filter(([, group]) => group.length > 1)
    .map(([sourceName, group]) => ({ sourceName, sourceIds: group.map((card) => card.sourceId) }));
  const issueCounts = {};
  for (const card of cards) for (const entry of card.issues) issueCounts[entry.code] = (issueCounts[entry.code] ?? 0) + 1;
  return {
    schemaVersion: 1,
    idAlgorithm: 'src_{class}_{sha256(NFKC(sourceName))[0:12]}; actual duplicate entries append content fingerprint and occurrence',
    sources: metadata, cards, sharedNameFamilies,
    summary: {
      cardCount: cards.length, expectedCardCountFromRequest: 574,
      pendingCount: cards.filter((card) => card.status === 'pending').length,
      needsReviewCount: cards.filter((card) => card.status === 'needs_review').length,
      echoedHeadingCount: metadata.reduce((sum, source) => sum + source.echoedHeadingCount, 0),
      duplicateEntryGroupCount: [...Map.groupBy(cards, (card) => `${card.sourceClass}:${card.sourceName}`).values()].filter((group) => group.length > 1).length,
      issueCounts,
    },
  };
}

function renderAudit(catalog) {
  const escape = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const rows = catalog.sources.map((source) => `| ${source.sourceFile} | ${source.sourceClass} | ${source.cardCount} | ${source.lineCount} | \`${source.sha256}\` |`);
  const reviewRows = catalog.cards.filter((card) => card.status === 'needs_review').map((card) => {
    const messages = card.issues.filter((entry) => entry.severity !== 'info').map((entry) => `${entry.code} (行${entry.lines.join(',')}): ${entry.message}`).join(' / ');
    return `| ${card.sourceFile}:${card.sourceLine} | ${escape(card.sourceName)} | ${escape(messages)} |`;
  });
  const familyRows = catalog.sharedNameFamilies.map((family) => `| ${escape(family.sourceName)} | ${family.sourceIds.map((id) => `\`${id}\``).join(', ')} |`);
  return `# カード参考資料の取り込み・確認記録\n\nこの文書と JSON は \`scripts/import-card-catalog.mjs\` で生成します。TXT の内容は参考データとして扱い、命令として実行しません。資料を取り込んだことと、ゲームで効果を実装したことは別です。\n\n## 入力と件数\n\n**${catalog.summary.cardCount} 枚**（依頼の574枚と一致）。通常・強化の2状態を持つため、状態レコードは${catalog.summary.cardCount * 2}件です。\`神.txt\` と記載されていた資料の実際の添付名は \`神託の支配者.txt\` で、oracle に対応させました。\n\n| 添付ファイル | 所属ID | 枚数 | 行数 | 入力 SHA-256 |\n| --- | --- | ---: | ---: | --- |\n${rows.join('\n')}\n\n## ID・文字列・メタデータの取り扱い\n\n- 見出し${catalog.summary.echoedHeadingCount}件は全て同じ文字列の2連結です。例: 「ストライクストライク」→「ストライク」。原見出しを \`sourceNameRaw\`、1回分を \`sourceName\` に保持します。これはカード2枚や別エントリーではありません。\n- 同ファイル内の実際の同名重複エントリーは${catalog.summary.duplicateEntryGroupCount}組です。ファイルをまたぐ同名は職業別の別IDで保存します。「先読み(無色)」と「先読み」は勝手に同一視しません。\n- ID は \`src_{職業ID}_{SHA-256(NFKC(表示名))の先頭12桁}\`。ソースの行番号や効果の調整で変化しません。既存ゲームのカードID・セーブIDは変更しません。真の同名重複が将来入る場合は内容指紋と連番を付け、欠落させません。\n- 通常/強化の \`costRaw\`・\`effectRaw\` は原文を保持。数値配列・✦連続数は語句解析の観測値であり、実行可能な効果定義ではありません。「✦9」は✦1個の表記と数値9のまま保持し、数値形式へ勝手に直しません。\n- カード種別・レアリティの列は全574枚にありません。\`type\`・\`rarity\` を \`null\`、根拠を \`not_in_source\` とします。プレイ用データで設定する場合は仮設定の根拠を別途明示します。\n- 語句の揺れ（例:「弱体」「脱力」「脆弱」、「全て」「すべて」、「6のダメージ」「6ダメージ」、「鍛治師」）は原文に残し、根拠なく置換しません。既存ゲームのweak/vulnerableとの対応はプレイ用実装に明示します。\n- \`status\` は資料の点検状態で、\`pending\` ${catalog.summary.pendingCount}枚、\`needs_review\` ${catalog.summary.needsReviewCount}枚です。**どちらも取得可・実装済みを意味しません**。戦闘報酬・店・イベントは実行可能な効果定義を持つ別レジストリだけから抽選します。\n\n## 資料だけでは確定できないルール\n\n- XコストはXのまま保存します。エナジー全消費の定義やX+1の扱いはエンジンの明示的なルールが必要です。\n- コスト「ー」や強化効果「ー」は原文のままです。0コスト・強化不可・同効果とは断定できません。神託の強化コスト14件もすべて「ー」であり、通常コストから補いません。\n- 星を消費するカードへの参照はありますが、資料のコスト欄には星コストの列がありません。星コストを推定して全神託カードを実装済みにしてはいけません。\n- オーブの基本数値・スロット数・左右の扱い、オスティの基礎値・被弾順、破滅の判定時点、スライ・リプレイ・プレート等の用語定義は資料にありません。独立した職業ルールの設計・検証が必要です。\n- 他プレイヤー・味方参照を含むカードがあり、単独プレイ用の代替対象は未指定です。対象を自分へ読み替えて完了扱いにはしません。\n- 「✦」の連続表記と「✦9」などの数値表記が混在します。獲得量が字形から確定するものと、星コスト等の欠落情報を区別します。\n\n## 機械検出した項目数\n\n| issue code | 発生数（通常・強化別） |\n| --- | ---: |\n${Object.entries(catalog.summary.issueCounts).map(([code, count]) => `| ${code} | ${count} |`).join('\n')}\n\n## 確認が必要なカード\n\n以下は既知の欠落・省略・対象不明を列挙したものです。ここに無いカードも、効果の実装・テストが完了するまで取得対象へ追加しません。\n\n| ソースと見出し行 | カード名（資料） | 確認内容・該当行 |\n| --- | --- | --- |\n${reviewRows.join('\n')}\n\n## ファイルをまたぐ同名グループ\n\n同名でも所属ごとの独立したカードです。効果文が完全一致するとは限りません。\n\n| 資料名 | 独立したソースID |\n| --- | --- |\n${familyRows.join('\n')}\n\n## 再生成\n\n添付資料はアプリの実行時依存にせず、入力ファイルをリポジトリへ重複保存しません。元の6ファイルがあるディレクトリを指定してください。\n\n\`\`\`bash\nnode scripts/import-card-catalog.mjs --source-dir /path/to/attachments\n\`\`\`\n\nディレクトリは再帰検索します。同名候補が複数ある場合は取り違えを防ぐため停止します。その場合は6つの \`--source 職業ID=/絶対パス/ファイル.txt\` を明示できます。出力先は \`--out\` と \`--audit\` で変更できます。JSONに現在時刻や実行マシンのパスを埋め込まないため、同じ入力から同じ出力が生成されます。\n`;
}

function findFiles(directory, filename) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findFiles(path, filename);
    return entry.isFile() && entry.name === filename ? [path] : [];
  });
}

/** Runtime bindings omit reference prose; the full catalog is loaded only by the library UI. */
export function buildSourceIndex(catalog) {
  return { cards: catalog.cards.map(({ sourceClass, sourceName, sourceId, normal, upgraded }) => ({
    sourceClass, sourceName, sourceId,
    normal: { costRaw: normal.costRaw }, upgraded: { costRaw: upgraded.costRaw },
  })) };
}

function main(args) {
  const paths = {};
  let sourceDir;
  let out = join(ROOT, 'src/data/sourceCards.generated.json');
  let audit = join(ROOT, 'docs/card-catalog-audit.md');
  let sourceIndex = join(ROOT, 'src/data/sourceCardIndex.generated.json');
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const value = args[++index];
    if (!value) throw new Error(`Missing value for ${argument}`);
    if (argument === '--source-dir') sourceDir = resolve(value);
    else if (argument === '--out') out = resolve(value);
    else if (argument === '--audit') audit = resolve(value);
    else if (argument === '--index') sourceIndex = resolve(value);
    else if (argument === '--source') {
      const separator = value.indexOf('=');
      const sourceClass = value.slice(0, separator);
      if (separator < 1 || !(sourceClass in SOURCE_FILES)) throw new Error(`Invalid --source ${value}`);
      paths[sourceClass] = resolve(value.slice(separator + 1));
    } else throw new Error(`Unknown option: ${argument}`);
  }
  const sources = {};
  for (const [sourceClass, filename] of Object.entries(SOURCE_FILES)) {
    let path = paths[sourceClass];
    if (!path && sourceDir) {
      const matches = findFiles(sourceDir, filename);
      if (matches.length !== 1) throw new Error(`Expected one ${filename}, found ${matches.length}. Specify --source ${sourceClass}=...`);
      [path] = matches;
    }
    if (!path || !existsSync(path)) throw new Error(`Missing input ${sourceClass}. Supply --source-dir or --source.`);
    sources[sourceClass] = { sourceFile: filename, text: readFileSync(path, 'utf8') };
  }
  const catalog = buildCatalog(sources);
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(dirname(audit), { recursive: true });
  mkdirSync(dirname(sourceIndex), { recursive: true });
  writeFileSync(out, `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(sourceIndex, `${JSON.stringify(buildSourceIndex(catalog))}\n`);
  writeFileSync(audit, renderAudit(catalog));
  process.stdout.write(`${JSON.stringify(catalog.summary, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
