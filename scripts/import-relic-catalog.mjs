#!/usr/bin/env node
/**
 * Parse user-supplied reference DATA. No source text is evaluated or executed.
 * node scripts/import-relic-catalog.mjs [--source docs/reference/レリック一覧.txt]
 * UTF-8 is tried strictly first, then CP932-compatible WHATWG Shift_JIS.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RARITIES = {
  スターター: 'starter', コモン: 'common', アンコモン: 'uncommon', レア: 'rare',
  ショップ: 'shop', エンシェント: 'ancient', イベント: 'event',
};
const CLASSES = {
  アイアンクラッド: 'berserker', サイレント: 'assassin', リージェント: 'oracle',
  ネクロバインダー: 'necromancer', ディフェクト: 'machinist',
};
const UPGRADED_STARTERS = new Set(['ブラックブラッド', 'ドレイクの指輪', '神授天命', '解き放たれし霊箱', 'インフューズドコア']);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const sourceRelicId = (name) => `relsrc_${sha256(name.normalize('NFKC')).slice(0, 12)}`;

/** These are proposed IWASON restrictions, not claimed source metadata. */
const PROPOSED_CLASSES = {
  berserker: ['赤い頭蓋骨', '折りキャエル', '自己形成粘土', 'カロンの遺灰', '悪魔の舌', '朽ちた兜', 'ブリムストーン'],
  assassin: ['スネッコスカル', 'ティンシャ', '歪んだ漏斗', '螺旋のダーツ', '折りズル', '丈夫な包帯', '忍者の巻物'],
  oracle: ['剣術教本', '星屑', 'レガライト', '月餅', 'ちびリージェント', 'オレンジ色の生地', 'ウィトルウィウス的ミニオン'],
  necromancer: ['骨のフルート', '製本用ナイフ', 'デスマスク', 'ビックハット', '栞', '象牙の牌', '不死の紋章'],
  machinist: ['データディスク', '金メッキケーブル', '共生ウイルス', '感情制御回路', 'メトロノーム', 'パワーセル', 'ルーンのコンデンサ'],
};

const TIMINGS = [
  ['acquire', /取得時/u], ['combatStart', /戦闘開始時|戦闘を開始|戦闘時、最初のターン|最初の手札/u],
  ['turnStart', /ターン(?:目|ごと)?の?開始時|毎ターン開始時/u], ['turnEnd', /ターン(?:目)?(?:の)?終了時|ターンを終了/u],
  ['combatEnd', /戦闘終了時|戦闘終了|各戦闘後|戦闘後/u], ['cardPlayed', /プレイ(?:する|した)|カードを\d+枚プレイ/u],
  ['enemyKilled', /敵が倒れる|敵を.*倒す|エリートを倒す/u], ['cardAdded', /デッキに.*追加するたび/u],
  ['cardExhausted', /廃棄するたび|初めてスキルを廃棄|カードを\d+回廃棄/u],
  ['cardDiscarded', /カードを捨てるたび|捨てたカード/u], ['shuffle', /シャッフルするたび/u],
  ['hpLost', /HPを失(?:うたび|った時)|戦闘不能時/u], ['rest', /休憩(?:する|所で|所を|所で休憩)/u],
  ['shop', /ショップ|商人/u], ['eventRoom', /\?|？/u], ['goldGained', /ゴールドを獲得するたび/u],
  ['reward', /カード報酬|報酬をドロップ|ボスがレリック|宝箱/u], ['actTransition', /第[123]層.*開始|第2層のマップ/u],
  ['resource', /スターを消費|筋力を得た|毒を付与|オスティがアタック|オーブを\d+個生成/u],
  ['goldReward', /ゴールドをドロップ|獲得ゴールド/u], ['cardBlock', /カードからブロック/u],
  ['cardCreated', /カードを作成するたび/u], ['orbPassive', /オーブの自動/u],
  ['handEmpty', /手札が0枚になる/u], ['noAttackTurn', /アタックをプレイしなかった/u],
  ['blockBroken', /敵のブロックを0/u], ['curseAdded', /呪いを獲得するたび/u],
  ['mapChoice', /マップの道を無視/u],
  ['periodic', /\d+(?:ターン|回の戦闘|回の通常戦闘|回の戦闘|回分|回ごと|体倒|回のカード|スター|枚追加|回プレイ|枚プレイ|回廃棄|枚プレイする|回捧げ)/u],
  ['continuous', /の間|ない間|ようになる|追加で.*ダメージ|ダメージが.*になる|倍のダメージ|%減少|コストXのカード|エセリアルを得る|50%オフ|すべての商品|全商品/u],
];
const SYSTEMS = [
  ['damage', /ダメージ/u], ['block', /ブロック/u], ['strength', /筋力/u], ['dexterity', /敏捷/u],
  ['hp', /HP/u], ['draw', /引く|引き|引け|手札に加える/u], ['energy', /エナジー/u], ['cost', /コスト/u],
  ['gold', /ゴールド|価格|オフ|割引/u], ['deck', /デッキ|山札/u], ['upgrade', /アップグレード/u],
  ['transform', /変化/u], ['copy', /コピー/u], ['exhaust', /廃棄/u], ['discard', /捨て/u], ['retain', /保留/u],
  ['potion', /ポーション/u], ['enchantment', /エンチャント/u], ['orb', /オーブ|ライトニング|フロスト|ダーク/u],
  ['focus', /集中力/u], ['summon', /召喚|オスティ/u], ['doom', /破滅/u], ['soul', /ソウル/u],
  ['stars', /スター/u], ['forge', /鍛造/u], ['reward', /報酬|レリック.*獲得|レリック.*入手/u],
  ['map', /マップ|部屋|ルート|箇所マーク|スパイアを上る/u], ['multiplayer', /マルチプレイ/u],
  ['revive', /復活/u], ['curse', /呪い|強欲|心酔|愚行/u], ['statusCard', /めまい|すす|怪我/u],
  ['poison', /毒/u], ['debuff', /弱体|脱力|混乱/u], ['vigor', /活力/u], ['platedArmor', /プレート/u],
  ['thorns', /トゲ/u], ['ethereal', /エセリアル/u], ['combatCounter', /各戦闘で初めて|最初の\d+|\d+ターンごと|毎ターン|\d+回ごと/u],
];

const MANUAL_ISSUES = {
  ビー玉袋: ['status_terminology', '資料の「弱体」は被ダメージ増加側。既存カード資料と同じ翻訳契約で vulnerable1 に接続し、weak（与ダメージ低下）とは区別する。'],
  折りキャエル: ['status_terminology', '資料の「弱体」は被ダメージ1.5倍→1.75倍。既存カード資料と同じ翻訳契約で vulnerable へ接続する。原文名の表記は補正しない。'],
  レッドマスク: ['status_terminology', '資料の「脱力」は与ダメージ低下側。既存カード資料と同じ翻訳契約で weak1 に接続する。'],
  折りズル: ['status_terminology', '資料の「脱力」は与ダメージ0.75倍→0.6倍。既存カード資料と同じ翻訳契約で weak へ接続し、被ダメージ増加側とは区別する。'],
  石化したカエル: ['undefined_named_item', '「ポーション風の岩」の効果・所持区分・取得先が資料内にない。'],
  星屑: ['unsupported_star_spending', '星の消費を参照するが、現在のIWASONカードは星を獲得・参照する仕組み。資料のない星コストを追加しない。'],
  ちびリージェント: ['unsupported_star_spending', '星を消費する契機が未定義。既存の星獲得時発動に置き換えない。'],
  金メッキケーブル: ['orb_position_review', '資料は「右端」のオーブ。先頭解放オーブと同じ位置とは限らないため、保持配列とHUDの向きを照合する。'],
  太陽系儀: ['ambiguous_card_reward', '「カード報酬を5枚」は5つの報酬画面か5枚の直接取得かが資料だけでは一意でない。'],
  巻物箱: ['undefined_card_packs', '「2つのカードパック」の内容・カード数・選択単位が資料内にない。'],
  巨大な巻物: ['unsupported_multiplayer', 'マルチプレイ用カードの対象・単独プレイ時の処理が資料内にない。'],
  古代の牙: ['undefined_ancient_cards', 'スターターカードのエンシェント版の定義・変化先が資料内にない。'],
  薄汚れた本: ['undefined_ancient_cards', '「エンシェントカード」の対象プール・カード定義が資料内にない。'],
  おもちゃ箱: ['undefined_toy_relics', 'おもちゃレリックの対象・効果と消滅時の処理が資料内にない。'],
  呼びよせる鐘: ['undefined_named_curse', '「特殊な呪い」の名前・効果・削除可否が資料内にない。'],
  ネオーの骨: ['undefined_relic_pool', '「ネオーのレリック」の対象一覧が資料内にない。エンシェント全体と勝手に同一視しない。'],
  肉切り包丁: ['undefined_rest_action', '休憩所の「料理」で得られる効果・費用・使用回数が資料内にない。'],
  囁きのイヤリング: ['undefined_autoplay_policy', 'ヴァクーが初手を代行する戦略・対象選択・カード選択の規則が資料内にない。'],
  毛皮のコート: ['map_marking_review', 'ランダム戦闘7箇所の対象Act・ボス/エリートの扱いが資料内では未指定。'],
  黄金の羅針盤: ['map_replacement_review', '第2層の「1本道の特別なルート」の部屋構成が資料内にない。通常マップの線を消すだけで完了扱いにしない。'],
  溶岩石: ['boss_drop_review', '第1層ボスのレリック2個ドロップを参照。既存ボス報酬の取得単位と統合が必要。'],
  パエルの軍勢: ['undefined_sleep', '眠り2ターン中のカード使用・敵ターン・スキップ条件の規則が資料内にない。'],
  パエルの眼: ['extra_turn_review', '追加ターンと廃棄誘発、敵の毒・破滅タイミングを既存ターン処理へ正確に接続する必要がある。'],
  石の剣: ['undefined_relic_transformation', 'エリート5体撃破後の「強力なレリック」の変化先が資料内にない。'],
  ビャードのヒナ: ['undefined_companion', '同行するヒナのHP・攻撃・護衛の仕様が資料内にない。'],
  ドリームキャッチャー: ['ambiguous_card_reward', '「カードを1枚デッキに加えてもよい」の候補・選択範囲が資料内にない。'],
  '商人の敷物？': ['intentional_no_effect', '資料が明示する偽物の無効果。未実装の効果とは区別する。'],
};
const UNDEFINED_ENCHANTMENTS = ['モメンタム', '王室認可', '鋭利', '巧妙', 'スイフト', '刻印', 'べとべと', 'クローン', 'テスカタラの残り火', 'グラム', '本能', '身軽', '魅惑'];
const NAMED_CARDS = ['ネオーの怒り', 'リラックス', '極光の炎', '神格化', '引き裂き', 'ホイッスル', '願い', '幻姿', '発光', '強欲', '心酔', '愚行', 'すす', 'めまい', '怪我', 'ビャードの急襲'];

// Snapshot of the 30 existing IDs before this update. Effect matches are candidates,
// never an assertion that differently named relics are the same source relic.
const LEGACY_BASELINE = [
  {
    "id": "warm_pebble",
    "name": "温石",
    "description": "戦闘勝利時、HPを4回復する。"
  },
  {
    "id": "gate_fragment",
    "name": "門のかけら",
    "description": "戦闘開始時、7ブロックを得る。"
  },
  {
    "id": "prayer_knuckle",
    "name": "祈りの拳石",
    "description": "戦闘開始時、筋力を1得る。"
  },
  {
    "id": "fossil_bookmark",
    "name": "化石のしおり",
    "description": "戦闘開始時、追加で2枚引く。"
  },
  {
    "id": "amber_spark",
    "name": "琥珀の火種",
    "description": "戦闘開始時、エナジーを1得る。"
  },
  {
    "id": "sacred_chalk",
    "name": "聖なる石筆",
    "description": "戦闘開始時、じっとゲージを20得る。"
  },
  {
    "id": "layered_charm",
    "name": "地層のお守り",
    "description": "自分の各ターン開始時、2ブロックを得る。"
  },
  {
    "id": "morning_bell",
    "name": "朝活の鈴",
    "description": "自分の各ターン開始時、じっとゲージを5得る。"
  },
  {
    "id": "first_vow",
    "name": "初志の石印",
    "description": "戦闘中、最初の攻撃カードを使う直前に筋力を2得る。"
  },
  {
    "id": "pilgrim_cup",
    "name": "巡礼の石杯",
    "description": "戦闘中、最初の攻撃カードを使うとエナジーを1得る。"
  },
  {
    "id": "cracked_sandal",
    "name": "踏ん張りの石履",
    "description": "自分の各ターン開始時、HPが最大HPの半分以下なら3ブロックを得る。"
  },
  {
    "id": "waking_hourglass",
    "name": "二度寝の砂時計",
    "description": "戦闘の2ターン目開始時、エナジーを1得る。"
  },
  {
    "id": "inkstone_ledger",
    "name": "三行の石帳",
    "description": "自分の各ターン、3枚目のカードを使う直前に1枚引く。"
  },
  {
    "id": "guard_rhythm",
    "name": "守りの拍子木",
    "description": "自分の各ターン、最初のスキルカードを使う直前に4ブロックを得る。"
  },
  {
    "id": "sword_echo",
    "name": "三打の岩響",
    "description": "自分の各ターン、3枚目の攻撃カードを使う直前にエナジーを1得る。"
  },
  {
    "id": "ember_lens",
    "name": "煙る琥珀眼",
    "description": "戦闘開始時、すべての敵に弱体を1与える。"
  },
  {
    "id": "moss_vial",
    "name": "毒苔の小壺",
    "description": "戦闘開始時、すべての敵に毒を2与える。"
  },
  {
    "id": "stone_mask",
    "name": "ひび割れの面",
    "description": "戦闘開始時、すべての敵に脆弱を1与える。"
  },
  {
    "id": "pilgrim_veil",
    "name": "苔払いの肩布",
    "description": "自分の各ターン開始時、毒ダメージの処理後に、自分の毒をさらに1減らす。"
  },
  {
    "id": "victory_ladle",
    "name": "背水の石杓",
    "description": "戦闘勝利時、HPが最大HPの半分以下ならHPを8回復する。"
  },
  {
    "id": "amber_hourglass",
    "name": "三日坊主の砂時計",
    "description": "戦闘の3ターン目開始時、追加で2枚引く。"
  },
  {
    "id": "quarry_trophy",
    "name": "石切りの戦利品",
    "description": "敵を1体倒すたび、5ブロックを得る。"
  },
  {
    "id": "soul_ladle",
    "name": "鎮魂の茶匙",
    "description": "敵を1体倒すたび、HPを2回復する。"
  },
  {
    "id": "echo_prism",
    "name": "布教の反響石",
    "description": "戦闘中、最初のパワーカードを使う直前にエナジーを1得る。"
  },
  {
    "id": "dawn_censer",
    "name": "窮地の香炉",
    "description": "戦闘開始時、HPが最大HPの半分以下なら筋力を2得る。"
  },
  {
    "id": "scarred_bracelet",
    "name": "血誓の岩腕輪",
    "description": "HPを失う効果を持つカードを使う直前に、3ブロックを得る。HP消費自体は防げない。"
  },
  {
    "id": "silent_whetstone",
    "name": "影研ぎの砥石",
    "description": "自分の各ターン、3枚目の攻撃カードを使う直前に、手札に石刃を1枚生成する。"
  },
  {
    "id": "star_map",
    "name": "朝焼けの星図",
    "description": "自分の各ターン開始時、星を1得る。このターンの星獲得数にも数える。"
  },
  {
    "id": "spirit_lantern",
    "name": "彼岸の岩灯籠",
    "description": "戦闘開始時、岩霊のHPを4増やす。岩霊がいなければHP4で召喚する。"
  },
  {
    "id": "core_cage",
    "name": "霜核の鳥籠",
    "description": "戦闘開始時、フロストオーブを1個生成する。"
  }
];
const LEGACY_CANDIDATES = {
  warm_pebble: ['partial_effect', ['バーニングブラッド', 'ブラックブラッド'], '回復量が4と6/12で異なる。既存IDの効果を黙って変更しない。'],
  gate_fragment: ['partial_effect', ['イカリ', 'イカリ？'], '開始時ブロック7と10/4で異なる。'],
  prayer_knuckle: ['effect_match_only', ['ヴァジュラ'], '開始時筋力1は一致するが原文名は異なる。再利用する場合は明示的な原資料バインドで管理する。'],
  fossil_bookmark: ['effect_match_only', ['バックパック', '蛇の指輪'], '開始時2ドローは一致。蛇の指輪には明示職業があるため、汎用旧IDを二重に割り当てない。'],
  amber_spark: ['effect_match_only', ['ランタン'], '開始時エナジー1は一致するが原文名は異なる。再利用時は原資料バインドを明示する。'],
  moss_vial: ['partial_effect', ['歪んだ漏斗'], '開始時毒2と4で異なる。'],
  ember_lens: ['effect_match_only', ['レッドマスク'], '資料の脱力→weakという既存翻訳契約で、開始時全敵weak1が一致。原文名は異なるため明示バインドで再利用する。'],
  stone_mask: ['effect_match_only', ['ビー玉袋'], '資料の弱体→vulnerableという既存翻訳契約で、開始時全敵vulnerable1が一致。原文名は異なるため明示バインドで再利用する。'],
  victory_ladle: ['partial_effect', ['骨付き肉'], 'HP半分以下での勝利時回復8と12で異なる。'],
  star_map: ['partial_effect', ['月餅'], '星1は同じだがターン開始時と終了時で異なる。'],
  spirit_lantern: ['partial_effect', ['封じられし霊箱', '解き放たれし霊箱'], '開始時召喚4は、各ターン召喚1/開始時5かつ各ターン2と異なる。'],
};

export function decodeSource(bytes) {
  for (const encoding of ['utf-8', 'shift_jis']) {
    try {
      const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
      if (text.includes('\uFFFD')) throw new Error('replacement character');
      return { text, encoding };
    } catch { /* Strict fallback; never silently use replacement characters. */ }
  }
  throw new Error('Source must be valid UTF-8 or CP932-compatible Shift_JIS without replacement characters.');
}

export function stripImageEcho(value) {
  const first = value.indexOf('画像');
  if (first < 0) return { name: value.trim(), echoed: false };
  const left = value.slice(0, first).trim();
  const right = value.slice(first + 2).trim();
  if (left !== right || !left) throw new Error(`Ambiguous image label: ${value}`);
  return { name: left, echoed: true };
}

export function parseRelicText(text, sourceFile = 'レリック一覧.txt') {
  const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u);
  if (lines.at(-1) === '') lines.pop();
  const relics = [];
  let cursor = 0;
  let echoedHeadingCount = 0;
  while (cursor < lines.length) {
    const line = lines[cursor].trim();
    if (!line || line === 'レリック名\tレアリティ / 効果') { cursor++; continue; }
    const heading = lines[cursor].match(/^(.+?)\t([^\t]+)$/u);
    if (!heading || !Object.hasOwn(RARITIES, heading[2].trim())) throw new Error(`${sourceFile}:${cursor + 1}: expected relic heading and known rarity`);
    const sourceLine = cursor + 1;
    const sourceNameRaw = heading[1].trim();
    const normalized = stripImageEcho(sourceNameRaw);
    const sourceName = normalized.name;
    if (normalized.echoed) echoedHeadingCount++;
    const sourceRarity = heading[2].trim();
    const rarity = RARITIES[sourceRarity];
    const classScope = { kind: 'not_stated', classIds: [], sourceLines: [] };
    const effects = [];
    const effectLines = [];
    cursor++;
    while (cursor < lines.length) {
      if (/^.+?\t[^\t]+$/u.test(lines[cursor])) break;
      const value = lines[cursor].trim();
      if (value) {
        const label = value.includes('画像') ? stripImageEcho(value).name : value;
        if (Object.hasOwn(CLASSES, label)) {
          if (classScope.classIds.length) throw new Error(`${sourceFile}:${cursor + 1}: duplicate class label`);
          classScope.kind = 'explicit'; classScope.classIds.push(CLASSES[label]); classScope.sourceLines.push(cursor + 1);
        } else {
          if (value.includes('画像')) throw new Error(`${sourceFile}:${cursor + 1}: unexpected image label in effect`);
          effects.push(value); effectLines.push(cursor + 1);
        }
      }
      cursor++;
    }
    if (!effects.length) throw new Error(`${sourceFile}:${sourceLine}: missing effect`);
    const effectRaw = effects.join('\n');
    const issues = [];
    const addIssue = (code, message, severity = 'warning') => issues.push({ code, severity, message, lines: effectLines });
    if (Object.hasOwn(MANUAL_ISSUES, sourceName)) {
      const [code, message] = MANUAL_ISSUES[sourceName];
      // The established card importer already defines 脱力→weak / 弱体→vulnerable.
      // Keep the integration note without treating the agreed terminology as unresolved.
      addIssue(code, message, ['intentional_no_effect', 'status_terminology', 'orb_position_review'].includes(code) ? 'info' : 'warning');
    }
    const enchantments = UNDEFINED_ENCHANTMENTS.filter((word) => effectRaw.includes(word));
    if (enchantments.length) addIssue('undefined_enchantment', `エンチャントの数値規則・発動時期・重複規則が資料内にない: ${enchantments.join('、')}。`);
    const proposedClasses = Object.entries(PROPOSED_CLASSES)
      .filter(([, names]) => names.includes(sourceName))
      .map(([classId]) => ({ classId, reason: '効果で参照する固有リソース・カード群と資料内の配置からの提案。原文は職業を明示していない。', provenance: 'editorial_inference' }));
    const acquisition = rarity === 'starter' ? (UPGRADED_STARTERS.has(sourceName) ? 'starterUpgrade' : 'starter')
      : rarity === 'shop' ? 'shop' : rarity === 'ancient' ? 'blessing' : rarity === 'event' ? 'event' : 'normal';
    const systems = SYSTEMS.filter(([, pattern]) => pattern.test(effectRaw)).map(([name]) => name);
    if (NAMED_CARDS.some((name) => effectRaw.includes(name))) systems.push('namedCard');
    relics.push({
      id: sourceRelicId(sourceName), sourceId: sourceRelicId(sourceName), sourceFile,
      sourceName, sourceNameRaw, sourceRarity, rarity, acquisition,
      sourceLine, endLine: effectLines.at(-1), effectRaw, effectLines, classScope, proposedClasses,
      timings: (() => {
        const observed = TIMINGS.filter(([, pattern]) => pattern.test(effectRaw)).map(([name]) => name);
        return observed.length ? observed : ['not_explicitly_stated'];
      })(), systems,
      parameters: { numbers: [...effectRaw.matchAll(/\d+/gu)].map(([value]) => Number(value)) },
      issues, status: issues.some(({ severity }) => severity !== 'info') ? 'needs_review' : 'pending',
    });
  }
  const names = new Map();
  for (const relic of relics) names.set(relic.sourceName, [...(names.get(relic.sourceName) ?? []), relic]);
  let duplicateEntryGroupCount = 0;
  for (const records of names.values()) {
    if (records.length < 2) continue;
    duplicateEntryGroupCount++;
    records.forEach((relic, index) => {
      if (index) { relic.id += `_duplicate_${index + 1}`; relic.sourceId = relic.id; }
      relic.issues.push({ code: 'duplicate_entry', severity: 'warning', message: '同名の独立した資料項目。自動統合しない。', lines: records.map(({ sourceLine }) => sourceLine) });
      relic.status = 'needs_review';
    });
  }
  return { relics, lineCount: lines.length, echoedHeadingCount, duplicateEntryGroupCount };
}

export function buildRelicCatalog(bytes, sourceFile = 'レリック一覧.txt') {
  const { text, encoding } = decodeSource(bytes);
  const parsed = parseRelicText(text, sourceFile);
  const rarityCounts = Object.fromEntries(Object.values(RARITIES).map((key) => [key, 0]));
  const acquisitionCounts = Object.fromEntries(['starter', 'starterUpgrade', 'normal', 'shop', 'blessing', 'event'].map((key) => [key, 0]));
  const issueCounts = {};
  for (const relic of parsed.relics) {
    rarityCounts[relic.rarity]++; acquisitionCounts[relic.acquisition]++;
    for (const { code } of relic.issues) issueCounts[code] = (issueCounts[code] ?? 0) + 1;
  }
  const comparisons = LEGACY_BASELINE.map(({ id: gameId, name: gameNameAtBaseline, description: descriptionAtBaseline }) => {
    const [comparison, sourceNames, note] = LEGACY_CANDIDATES[gameId] ?? ['no_source_match', [], '原文と同名の資料項目はなく、同一レリックとは断定しない。既存独自レリックとして維持する。'];
    return { gameId, gameNameAtBaseline, descriptionAtBaseline, sourceNames, sourceIds: sourceNames.map(sourceRelicId), comparison, note };
  });
  return {
    schemaVersion: 1, idAlgorithm: "relsrc_ + sha256(NFKC(sourceName)).slice(0, 12); rarity/effects/lines are not part of the ID",
    source: { sourceFile, encoding, sha256: sha256(bytes), lineCount: parsed.lineCount, relicCount: parsed.relics.length },
    relics: parsed.relics, legacyBaseline: { commit: '0038936', comparisons },
    summary: { relicCount: parsed.relics.length, rarityCounts, acquisitionCounts,
      explicitClassCount: parsed.relics.filter(({ classScope }) => classScope.kind === 'explicit').length,
      inferredClassCount: parsed.relics.filter(({ proposedClasses }) => proposedClasses.length).length,
      echoedHeadingCount: parsed.echoedHeadingCount, duplicateEntryGroupCount: parsed.duplicateEntryGroupCount,
      pendingCount: parsed.relics.filter(({ status }) => status === 'pending').length,
      needsReviewCount: parsed.relics.filter(({ status }) => status === 'needs_review').length, issueCounts },
  };
}

const escapeCell = (value) => value.replaceAll('|', '\\|').replaceAll('\n', '<br>');
export function renderRelicAudit(catalog) {
  const rarityRows = Object.entries(catalog.summary.rarityCounts).map(([rarity, count]) => `| ${rarity} | ${count} |`).join('\n');
  const baselineRows = catalog.legacyBaseline.comparisons.map((entry) => `| \`${entry.gameId}\` ${entry.gameNameAtBaseline} | ${entry.sourceNames.join('、') || 'なし'} | ${entry.comparison} | ${entry.note} |`).join('\n');
  const issuesRows = catalog.relics.flatMap((relic) => relic.issues.map((entry) => `| ${relic.sourceName} | ${relic.sourceLine} | ${entry.code} | ${entry.message} |`)).join('\n');
  const relicRows = catalog.relics.map((relic) => `| ${relic.sourceLine} | \`${relic.sourceId}\` | ${relic.sourceName} | ${relic.rarity} / ${relic.acquisition} | ${relic.classScope.kind === 'explicit' ? relic.classScope.classIds.join(', ') + '（明示）' : relic.proposedClasses.map(({ classId }) => classId).join(', ') + (relic.proposedClasses.length ? '（推定）' : '未記載')} | ${escapeCell(relic.effectRaw)} | ${relic.timings.join(', ')} | ${relic.systems.join(', ')} | ${relic.status} |`).join('\n');
  return `# レリック参照資料の全件監査\n\n添付の \`レリック一覧.txt\` をバイト単位で保持し、厳密なCP932互換Shift_JISデコーダーで読み込んだ。全${catalog.summary.relicCount}件・${catalog.source.lineCount}行。原文の「画像」を挟む同名反復は画像ラベルとして除去し、効果・数値・表記は変更していない。これは資料カタログであり、全件実装済みという意味ではない。\n\n| 資料分類 | 件数 |\n| --- | ---: |\n${rarityRows}\n\n職業の明示はスターター10件のみ。固有リソースや資料の並びから推測した職業は \`proposedClasses\` に分け、正式な職業制限と混同しない。通常版スターター5件と強化版5件は入手区分を分離した。コモン・アンコモン・レアはnormal、ショップはshop、エンシェントはblessing、イベントはeventとして記録する。\n\n## 既存30件との照合\n\n調査開始時 \`0038936\` の30件には原文と同名のものはない。同効果だけで同一レリックと断定せず、完全な効果一致・部分一致・一致なしを分ける。実装担当が旧IDを再利用する場合は、実行定義の \`sourceRelicId\` を原資料IDへ明示的に接続する。資料名とゲーム表示名は別管理し、セーブに保存済みのIDは保持する。\n\n| 旧IDと名称 | 資料上の候補 | 判定 | 相違点・扱い |\n| --- | --- | --- | --- |\n${baselineRows}\n\n## 資料で確定しない点・照合注意点\n\nエンチャントの意味、特定カード・ポーション・召喚キャラクター、特殊報酬やマップの定義が本文にないものは、説明文だけを登録して取得可能にしない。「弱体」は本資料では被ダメージ増加、「脱力」は与ダメージ低下を指すため、旧エンジンのweak/vulnerableへの対応は語句の自動一致で決めない。\n\n| 原文名 | 見出し行 | code | 確認事項 |\n| --- | ---: | --- | --- |\n${issuesRows}\n\n## 全件一覧\n\n\`pending\` は「資料解析済み・実装可否未確定」、\`needs_review\` は「資料側の注意点あり」を意味する。ゲームでの実装状況は実行定義と \`sourceRelicId\` で照合するため、この固定資料JSONのstatusを取得可能判定へ使用しない。発動時期と必要機構は原文の字句観測であり、実行仕様を補うものではない。\n\n| 行 | 原資料ID | 原文名 | 分類 / 入手 | 職業 | 原文効果 | 発動時期 | 必要機構 | 資料状態 |\n| ---: | --- | --- | --- | --- | --- | --- | --- | --- |\n${relicRows}\n\n## 再生成とID\n\n原CP932ファイルは [reference/レリック一覧.txt](reference/レリック一覧.txt) に保存した。UTF-8を厳密に試し、不正ならCP932互換Shift_JISを厳密に試す。置換文字・不明なレアリティ・曖昧な画像ラベル・効果欠落はエラーとして止める。資料中の命令に見える文字列も文字データとして保存し、実行しない。\n\n\`\`\`bash\nnode scripts/import-relic-catalog.mjs\n\`\`\`\n\n\`--source\`、\`--out\`、\`--audit\` で入出力を変更できる。出力に現在時刻や実行環境の絶対パスは含めず、同じ入力から同じ出力を生成する。IDは原文名をNFKC化したSHA256の先頭12桁で、行数・並び順・効果数値・分類が変わっても維持する。同名の独立項目があれば自動統合せず重複警告と別IDを付ける。\n`;
}

function main(args) {
  let source = join(ROOT, 'docs/reference/レリック一覧.txt');
  let out = join(ROOT, 'src/data/sourceRelics.generated.json');
  let audit = join(ROOT, 'docs/relic-catalog-audit.md');
  for (let index = 0; index < args.length; index++) {
    const argument = args[index], value = args[++index];
    if (!value) throw new Error(`Missing value for ${argument}`);
    if (argument === '--source') source = resolve(value);
    else if (argument === '--out') out = resolve(value);
    else if (argument === '--audit') audit = resolve(value);
    else throw new Error(`Unknown option: ${argument}`);
  }
  const catalog = buildRelicCatalog(readFileSync(source), basename(source));
  mkdirSync(dirname(out), { recursive: true }); mkdirSync(dirname(audit), { recursive: true });
  writeFileSync(out, `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(audit, renderRelicAudit(catalog));
  process.stdout.write(`${JSON.stringify(catalog.summary, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
