export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  glyph: string;
  effect: {
    trigger: 'combatStart' | 'turnStart' | 'firstAttack' | 'victory';
    kind: 'block' | 'strength' | 'draw' | 'energy' | 'heal' | 'gauge';
    amount: number;
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
};

export const RELIC_IDS = Object.keys(RELIC_DEFINITIONS);
