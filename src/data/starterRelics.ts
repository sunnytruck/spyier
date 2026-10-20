import type { ClassId } from '../types/game';
import type { RelicDefinition } from './relics';

export const STARTER_RELIC_IDS: Record<ClassId, string> = {
  berserker: 'starter_burning_blood', assassin: 'starter_snake_ring', oracle: 'starter_divine_right',
  necromancer: 'starter_bound_phylactery', machinist: 'starter_cracked_core',
};
export const STARTER_UPGRADE_IDS: Record<ClassId, string> = {
  berserker: 'starter_black_blood', assassin: 'starter_drake_ring', oracle: 'starter_divine_fate',
  necromancer: 'starter_unbound_phylactery', machinist: 'starter_infused_core',
};
export const STARTER_RELIC_DEFINITIONS: Record<string, RelicDefinition> = {
  starter_burning_blood: {
    id: 'starter_burning_blood', name: 'バーニングブラッド', sourceRelicId: 'relsrc_707367f80e0e', sourceRelicName: 'バーニングブラッド', glyph: '血', classId: 'berserker',
    rarity: 'starter', acquisition: 'starter', upgradeTo: 'starter_black_blood',
    description: '戦闘終了時、HPを6回復する。', effect: { trigger: 'victory', kind: 'heal', amount: 6 },
  },
  starter_black_blood: {
    id: 'starter_black_blood', name: 'ブラックブラッド', sourceRelicId: 'relsrc_a0839a979413', sourceRelicName: 'ブラックブラッド', glyph: '黒', classId: 'berserker',
    rarity: 'starter', acquisition: 'starter', upgradeFrom: 'starter_burning_blood',
    description: '戦闘終了時、HPを12回復する。', effect: { trigger: 'victory', kind: 'heal', amount: 12 },
  },
  starter_snake_ring: {
    id: 'starter_snake_ring', name: '蛇の指輪', sourceRelicId: 'relsrc_d6ca8699742d', sourceRelicName: '蛇の指輪', glyph: '蛇', classId: 'assassin',
    rarity: 'starter', acquisition: 'starter', upgradeTo: 'starter_drake_ring',
    description: '戦闘開始時、追加でカードを2枚引く。', effect: { trigger: 'combatStart', kind: 'draw', amount: 2 },
  },
  starter_drake_ring: {
    id: 'starter_drake_ring', name: 'ドレイクの指輪', sourceRelicId: 'relsrc_ee811290c826', sourceRelicName: 'ドレイクの指輪', glyph: '竜', classId: 'assassin',
    rarity: 'starter', acquisition: 'starter', upgradeFrom: 'starter_snake_ring',
    description: '最初の3ターンの開始時、追加でカードを2枚引く。', effect: { trigger: 'turnStart', kind: 'draw', amount: 2, maxTurn: 3 },
  },
  starter_divine_right: {
    id: 'starter_divine_right', name: '神授王権', sourceRelicId: 'relsrc_8e2a931f58fe', sourceRelicName: '神授王権', glyph: '王', classId: 'oracle',
    rarity: 'starter', acquisition: 'starter', upgradeTo: 'starter_divine_fate',
    description: '戦闘開始時、スター3を得る。', effect: { trigger: 'combatStart', kind: 'stars', amount: 3 },
  },
  starter_divine_fate: {
    id: 'starter_divine_fate', name: '神授天命', sourceRelicId: 'relsrc_483a10fe5f8e', sourceRelicName: '神授天命', glyph: '命', classId: 'oracle',
    rarity: 'starter', acquisition: 'starter', upgradeFrom: 'starter_divine_right',
    description: '戦闘開始時、スター6を得る。', effect: { trigger: 'combatStart', kind: 'stars', amount: 6 },
  },
  starter_bound_phylactery: {
    id: 'starter_bound_phylactery', name: '封じられし霊箱', sourceRelicId: 'relsrc_29cb8891c2ba', sourceRelicName: '封じられし霊箱', glyph: '霊', classId: 'necromancer',
    rarity: 'starter', acquisition: 'starter', upgradeTo: 'starter_unbound_phylactery',
    description: 'ターン開始時、召喚1。', effect: { trigger: 'turnStart', kind: 'summon', amount: 1 },
  },
  starter_unbound_phylactery: {
    id: 'starter_unbound_phylactery', name: '解き放たれし霊箱', sourceRelicId: 'relsrc_1b9ca9420f81', sourceRelicName: '解き放たれし霊箱', glyph: '解', classId: 'necromancer',
    rarity: 'starter', acquisition: 'starter', upgradeFrom: 'starter_bound_phylactery',
    description: '戦闘開始時、召喚5。ターン開始時、召喚2。',
    effect: { trigger: 'combatStart', kind: 'summon', amount: 5 },
    effects: [{ trigger: 'combatStart', kind: 'summon', amount: 5 }, { trigger: 'turnStart', kind: 'summon', amount: 2 }],
  },
  starter_cracked_core: {
    id: 'starter_cracked_core', name: 'ひび割れたコア', sourceRelicId: 'relsrc_168c538bc564', sourceRelicName: 'ひび割れたコア', glyph: '雷', classId: 'machinist',
    rarity: 'starter', acquisition: 'starter', upgradeTo: 'starter_infused_core',
    description: '戦闘開始時、ライトニング1を生成する。', effect: { trigger: 'combatStart', kind: 'lightning', amount: 1 },
  },
  starter_infused_core: {
    id: 'starter_infused_core', name: 'インフューズドコア', sourceRelicId: 'relsrc_fff9512092d4', sourceRelicName: 'インフューズドコア', glyph: '三', classId: 'machinist',
    rarity: 'starter', acquisition: 'starter', upgradeFrom: 'starter_cracked_core',
    description: '戦闘開始時、ライトニング3を生成する。', effect: { trigger: 'combatStart', kind: 'lightning', amount: 3 },
  },
};
