import type { CardType, ClassId, Effect } from '../types/game';

export type RelicTrigger = 'combatStart' | 'turnStart' | 'firstAttack' | 'cardPlayed' | 'enemyKilled' | 'victory';
export type RelicEffectKind =
  | 'block' | 'strength' | 'draw' | 'energy' | 'heal' | 'gauge'
  | 'enemyWeak' | 'enemyVulnerable' | 'enemyPoison' | 'cleansePoison'
  | 'knife' | 'stars' | 'summon' | 'frost';

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  glyph: string;
  /** Missing means every class, including saves created before class selection. */
  classId?: ClassId;
  effect: {
    trigger: RelicTrigger;
    kind: RelicEffectKind;
    amount: number;
    /** Card triggers can count matching cards per turn or across this battle. */
    scope?: 'card' | 'turn' | 'battle';
    cardType?: CardType;
    cardEffect?: Effect['type'];
    atCard?: number;
    turn?: number;
    hpAtMostPercent?: number;
  };
}

/** A relic trigger is resolved by the engine, never directly by a screen. */
export const RELIC_DEFINITIONS: Record<string, RelicDefinition> = {
  warm_pebble: {
    id: 'warm_pebble',
    name: '温石',
    glyph: '温',
    description: '戦闘勝利時、HPを4回復する。',
    effect: { trigger: 'victory', kind: 'heal', amount: 4 },
  },
  gate_fragment: {
    id: 'gate_fragment',
    name: '門のかけら',
    glyph: '門',
    description: '戦闘開始時、7ブロックを得る。',
    effect: { trigger: 'combatStart', kind: 'block', amount: 7 },
  },
  prayer_knuckle: {
    id: 'prayer_knuckle',
    name: '祈りの拳石',
    glyph: '拳',
    description: '戦闘開始時、筋力を1得る。',
    effect: { trigger: 'combatStart', kind: 'strength', amount: 1 },
  },
  fossil_bookmark: {
    id: 'fossil_bookmark',
    name: '化石のしおり',
    glyph: '頁',
    description: '戦闘開始時、追加で2枚引く。',
    effect: { trigger: 'combatStart', kind: 'draw', amount: 2 },
  },
  amber_spark: {
    id: 'amber_spark',
    name: '琥珀の火種',
    glyph: '灯',
    description: '戦闘開始時、エナジーを1得る。',
    effect: { trigger: 'combatStart', kind: 'energy', amount: 1 },
  },
  sacred_chalk: {
    id: 'sacred_chalk',
    name: '聖なる石筆',
    glyph: '筆',
    description: '戦闘開始時、じっとゲージを20得る。',
    effect: { trigger: 'combatStart', kind: 'gauge', amount: 20 },
  },
  layered_charm: {
    id: 'layered_charm',
    name: '地層のお守り',
    glyph: '層',
    description: '自分の各ターン開始時、2ブロックを得る。',
    effect: { trigger: 'turnStart', kind: 'block', amount: 2 },
  },
  morning_bell: {
    id: 'morning_bell',
    name: '朝活の鈴',
    glyph: '鈴',
    description: '自分の各ターン開始時、じっとゲージを5得る。',
    effect: { trigger: 'turnStart', kind: 'gauge', amount: 5 },
  },
  first_vow: {
    id: 'first_vow',
    name: '初志の石印',
    glyph: '印',
    description: '戦闘中、最初の攻撃カードを使う直前に筋力を2得る。',
    effect: { trigger: 'firstAttack', kind: 'strength', amount: 2 },
  },
  pilgrim_cup: {
    id: 'pilgrim_cup',
    name: '巡礼の石杯',
    glyph: '杯',
    description: '戦闘中、最初の攻撃カードを使うとエナジーを1得る。',
    effect: { trigger: 'firstAttack', kind: 'energy', amount: 1 },
  },
  cracked_sandal: {
    id: 'cracked_sandal', name: '踏ん張りの石履', glyph: '履',
    description: '自分の各ターン開始時、HPが最大HPの半分以下なら3ブロックを得る。',
    effect: { trigger: 'turnStart', kind: 'block', amount: 3, hpAtMostPercent: 50 },
  },
  waking_hourglass: {
    id: 'waking_hourglass', name: '二度寝の砂時計', glyph: '砂',
    description: '戦闘の2ターン目開始時、エナジーを1得る。',
    effect: { trigger: 'turnStart', kind: 'energy', amount: 1, turn: 2 },
  },
  inkstone_ledger: {
    id: 'inkstone_ledger', name: '三行の石帳', glyph: '帳',
    description: '自分の各ターン、3枚目のカードを使う直前に1枚引く。',
    effect: { trigger: 'cardPlayed', kind: 'draw', amount: 1, scope: 'turn', atCard: 3 },
  },
  guard_rhythm: {
    id: 'guard_rhythm', name: '守りの拍子木', glyph: '拍',
    description: '自分の各ターン、最初のスキルカードを使う直前に4ブロックを得る。',
    effect: { trigger: 'cardPlayed', kind: 'block', amount: 4, scope: 'turn', cardType: 'skill' },
  },
  sword_echo: {
    id: 'sword_echo', name: '三打の岩響', glyph: '響',
    description: '自分の各ターン、3枚目の攻撃カードを使う直前にエナジーを1得る。',
    effect: { trigger: 'cardPlayed', kind: 'energy', amount: 1, scope: 'turn', cardType: 'attack', atCard: 3 },
  },
  ember_lens: {
    id: 'ember_lens', name: '煙る琥珀眼', glyph: '眼',
    description: '戦闘開始時、すべての敵に弱体を1与える。',
    effect: { trigger: 'combatStart', kind: 'enemyWeak', amount: 1 },
  },
  moss_vial: {
    id: 'moss_vial', name: '毒苔の小壺', glyph: '壺',
    description: '戦闘開始時、すべての敵に毒を2与える。',
    effect: { trigger: 'combatStart', kind: 'enemyPoison', amount: 2 },
  },
  stone_mask: {
    id: 'stone_mask', name: 'ひび割れの面', glyph: '面',
    description: '戦闘開始時、すべての敵に脆弱を1与える。',
    effect: { trigger: 'combatStart', kind: 'enemyVulnerable', amount: 1 },
  },
  pilgrim_veil: {
    id: 'pilgrim_veil', name: '苔払いの肩布', glyph: '布',
    description: '自分の各ターン開始時、毒ダメージの処理後に、自分の毒をさらに1減らす。',
    effect: { trigger: 'turnStart', kind: 'cleansePoison', amount: 1 },
  },
  victory_ladle: {
    id: 'victory_ladle', name: '背水の石杓', glyph: '杓',
    description: '戦闘勝利時、HPが最大HPの半分以下ならHPを8回復する。',
    effect: { trigger: 'victory', kind: 'heal', amount: 8, hpAtMostPercent: 50 },
  },
  amber_hourglass: {
    id: 'amber_hourglass', name: '三日坊主の砂時計', glyph: '刻',
    description: '戦闘の3ターン目開始時、追加で2枚引く。',
    effect: { trigger: 'turnStart', kind: 'draw', amount: 2, turn: 3 },
  },
  quarry_trophy: {
    id: 'quarry_trophy', name: '石切りの戦利品', glyph: '切',
    description: '敵を1体倒すたび、5ブロックを得る。',
    effect: { trigger: 'enemyKilled', kind: 'block', amount: 5 },
  },
  soul_ladle: {
    id: 'soul_ladle', name: '鎮魂の茶匙', glyph: '匙',
    description: '敵を1体倒すたび、HPを2回復する。',
    effect: { trigger: 'enemyKilled', kind: 'heal', amount: 2 },
  },
  echo_prism: {
    id: 'echo_prism', name: '布教の反響石', glyph: '布',
    description: '戦闘中、最初のパワーカードを使う直前にエナジーを1得る。',
    effect: { trigger: 'cardPlayed', kind: 'energy', amount: 1, scope: 'battle', cardType: 'power' },
  },
  dawn_censer: {
    id: 'dawn_censer', name: '窮地の香炉', glyph: '香',
    description: '戦闘開始時、HPが最大HPの半分以下なら筋力を2得る。',
    effect: { trigger: 'combatStart', kind: 'strength', amount: 2, hpAtMostPercent: 50 },
  },
  scarred_bracelet: {
    id: 'scarred_bracelet', name: '血誓の岩腕輪', glyph: '誓', classId: 'berserker',
    description: 'HPを失う効果を持つカードを使う直前に、3ブロックを得る。HP消費自体は防げない。',
    effect: { trigger: 'cardPlayed', kind: 'block', amount: 3, scope: 'card', cardEffect: 'loseHp' },
  },
  silent_whetstone: {
    id: 'silent_whetstone', name: '影研ぎの砥石', glyph: '研', classId: 'assassin',
    description: '自分の各ターン、3枚目の攻撃カードを使う直前に、手札に石刃を1枚生成する。',
    effect: { trigger: 'cardPlayed', kind: 'knife', amount: 1, scope: 'turn', cardType: 'attack', atCard: 3 },
  },
  star_map: {
    id: 'star_map', name: '朝焼けの星図', glyph: '図', classId: 'oracle',
    description: '自分の各ターン開始時、星を1得る。このターンの星獲得数にも数える。',
    effect: { trigger: 'turnStart', kind: 'stars', amount: 1 },
  },
  spirit_lantern: {
    id: 'spirit_lantern', name: '彼岸の岩灯籠', glyph: '籠', classId: 'necromancer',
    description: '戦闘開始時、岩霊のHPを4増やす。岩霊がいなければHP4で召喚する。',
    effect: { trigger: 'combatStart', kind: 'summon', amount: 4 },
  },
  core_cage: {
    id: 'core_cage', name: '霜核の鳥籠', glyph: '霜', classId: 'machinist',
    description: '戦闘開始時、フロストオーブを1個生成する。',
    effect: { trigger: 'combatStart', kind: 'frost', amount: 1 },
  },
};

export const RELIC_IDS = Object.keys(RELIC_DEFINITIONS);
/** Original IDs remain addressable; count checks must not freeze the expanded catalog. */
export const LEGACY_RELIC_IDS = [
  'warm_pebble', 'gate_fragment', 'prayer_knuckle', 'fossil_bookmark', 'amber_spark',
  'sacred_chalk', 'layered_charm', 'morning_bell', 'first_vow', 'pilgrim_cup',
];
export const EXPANSION_RELIC_IDS = RELIC_IDS.filter((id) => !LEGACY_RELIC_IDS.includes(id));

export function isRelicEligible(id: string, classId?: ClassId): boolean {
  const relic = Object.hasOwn(RELIC_DEFINITIONS, id) ? RELIC_DEFINITIONS[id] : undefined;
  return Boolean(relic && (!relic.classId || relic.classId === classId));
}

/** Legacy runs without a class receive neutral relics only. */
export function eligibleRelicIds(classId?: ClassId): string[] {
  return RELIC_IDS.filter((id) => isRelicEligible(id, classId));
}
