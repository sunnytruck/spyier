import type { Actor, EnemyDefinition, EnemyIntent } from '../types/game';

export const DEFAULT_ENEMY_ID = 'restless_guardian';

export const ENEMY_DEFINITION: Actor = {
  id: DEFAULT_ENEMY_ID,
  name: 'そわそわの番人',
  hp: 86,
  maxHp: 86,
  block: 0,
  strength: 0,
  weak: 0,
  vulnerable: 0,
  poison: 0,
};

/** Intent damage is a base per hit: the shared damage calculator adds statuses. */
export const ENEMY_INTENTS: EnemyIntent[] = [
  {
    kind: 'attack',
    label: 'そわそわパンチ',
    description: '基礎12ダメージの攻撃。筋力・弱体で変化する。',
    damage: 12,
    hits: 1,
  },
  {
    kind: 'attack',
    label: 'うきき連打',
    description: '基礎6ダメージを2回与える。筋力・弱体で変化する。',
    damage: 6,
    hits: 2,
  },
  {
    kind: 'buff',
    label: '落ち着かない瞑想',
    description: '8ブロックを得て、筋力を2増やす。',
    block: 8,
    strength: 2,
  },
];

function enemy(id: string, name: string, hp: number, intents: EnemyIntent[]): EnemyDefinition {
  return {
    id,
    name,
    hp,
    maxHp: hp,
    block: 0,
    strength: 0,
    weak: 0,
    vulnerable: 0,
    poison: 0,
    intents,
  };
}

/** Add enemies as data here; IDs remain stable because saves reference them. */
export const ENEMY_DEFINITIONS: Record<string, EnemyDefinition> = {
  [DEFAULT_ENEMY_ID]: { ...ENEMY_DEFINITION, intents: ENEMY_INTENTS },
  grit_scout: enemy('grit_scout', '砂利の見張り', 28, [
    { kind: 'attack', label: '小石投げ', description: '基礎5ダメージ。', damage: 5, hits: 1 },
    { kind: 'defend', label: '砂袋を積む', description: '7ブロックを得る。', block: 7 },
    { kind: 'attack', label: '砂利崩し', description: '基礎8ダメージ。', damage: 8, hits: 1 },
  ]),
  candle_moth: enemy('candle_moth', '灯籠の石蛾', 24, [
    { kind: 'attack', label: '灯火の体当たり', description: '基礎4ダメージ。', damage: 4, hits: 1 },
    { kind: 'debuff', label: '眠りの粉', description: 'プレイヤーに弱体1。', weak: 1 },
    { kind: 'attack', label: '羽音二連', description: '基礎3ダメージを2回。', damage: 3, hits: 2 },
  ]),
  quarry_crab: enemy('quarry_crab', '採石ガニ', 38, [
    { kind: 'attack', label: '石ばさみ', description: '基礎9ダメージ。', damage: 9, hits: 1 },
    { kind: 'defend', label: '甲羅磨き', description: '10ブロックを得る。', block: 10 },
    { kind: 'attack', label: '両ばさみ', description: '基礎5ダメージを2回。', damage: 5, hits: 2 },
  ]),
  sleepless_monk: enemy('sleepless_monk', '夜更かし石僧', 42, [
    { kind: 'attack', label: '寝ぼけの掌', description: '基礎10ダメージ。', damage: 10, hits: 1 },
    {
      kind: 'buff',
      label: '夜食の祈り',
      description: '5ブロックと筋力1を得る。',
      block: 5,
      strength: 1,
    },
    {
      kind: 'attack',
      label: '朝まで説法',
      description: '基礎6ダメージを2回。',
      damage: 6,
      hits: 2,
    },
  ]),
  lost_bell: enemy('lost_bell', '迷子の岩鐘', 32, [
    { kind: 'attack', label: '小さな鐘打ち', description: '基礎5ダメージ。', damage: 5, hits: 1 },
    {
      kind: 'debuff',
      label: '耳に残る音',
      description: 'プレイヤーに弱体1。自分に4ブロック。',
      weak: 1,
      block: 4,
    },
    {
      kind: 'attack',
      label: '二度鳴らし',
      description: '基礎4ダメージを2回。',
      damage: 4,
      hits: 2,
    },
  ]),
  debt_collector: enemy('debt_collector', '献金取り立て岩', 88, [
    { kind: 'attack', label: '帳簿の角', description: '基礎16ダメージ。', damage: 16, hits: 1 },
    {
      kind: 'buff',
      label: '利息を積む',
      description: '12ブロックと筋力2を得る。',
      block: 12,
      strength: 2,
    },
    { kind: 'attack', label: '分割請求', description: '基礎7ダメージを2回。', damage: 7, hits: 2 },
  ]),
  twin_pillars: enemy('twin_pillars', '三拍子の双石柱', 96, [
    {
      kind: 'attack',
      label: '柱の三拍子',
      description: '基礎6ダメージを3回。',
      damage: 6,
      hits: 3,
    },
    { kind: 'defend', label: '梁を支える', description: '16ブロックを得る。', block: 16 },
    {
      kind: 'debuff',
      label: '重たい説教',
      description: '基礎12ダメージ。プレイヤーに弱体1。',
      damage: 12,
      hits: 1,
      weak: 1,
    },
  ]),
  tower_abbot: enemy('tower_abbot', '塔主・ねんね大岩', 220, [
    {
      kind: 'attack',
      label: 'おやすみの一撃',
      description: '基礎22ダメージ。',
      damage: 22,
      hits: 1,
    },
    { kind: 'attack', label: '八時の鐘', description: '基礎7ダメージを4回。', damage: 7, hits: 4 },
    {
      kind: 'buff',
      label: '布団の結界',
      description: '16ブロックと筋力3を得る。',
      block: 16,
      strength: 3,
    },
    {
      kind: 'debuff',
      label: 'ねんねの誘い',
      description: '基礎24ダメージ。プレイヤーに弱体2。',
      damage: 24,
      hits: 1,
      weak: 2,
    },
  ]),
};

/** The original 86 HP guardian remains available for the combat practice room. */
export const NORMAL_ENEMY_IDS = [
  DEFAULT_ENEMY_ID,
  'grit_scout',
  'candle_moth',
  'quarry_crab',
  'sleepless_monk',
  'lost_bell',
];
export const ELITE_ENEMY_IDS = ['debt_collector', 'twin_pillars'];
export const BOSS_ENEMY_ID = 'tower_abbot';

/** Ordinary tower encounters keep their combined opening attack at 14 or less. */
export const ENCOUNTER_GROUPS: string[][] = [
  ['grit_scout'],
  ['quarry_crab'],
  ['sleepless_monk'],
  ['grit_scout', 'candle_moth'],
  ['lost_bell', 'candle_moth'],
  ['grit_scout', 'lost_bell'],
  ['grit_scout', 'candle_moth', 'lost_bell'],
];

/** Unknown IDs never silently select a different enemy. */
export function getEnemyDefinition(id: string): EnemyDefinition | undefined {
  return Object.hasOwn(ENEMY_DEFINITIONS, id) ? ENEMY_DEFINITIONS[id] : undefined;
}
