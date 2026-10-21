import type { CardDefinition, Effect } from '../types/game';
import { createReferenceCard as card } from './referenceCard';

const damage = (amount: number, extra: Partial<Extract<Effect, { type: 'damage' }>> = {}): Effect => ({ type: 'damage', amount, ...extra });
const block = (amount: number): Effect => ({ type: 'block', amount });

/** Fifteen previously unimplemented source cards. Display names are IWASON's own;
 * costs and source IDs come from the original reference, never from a guessed upgrade. */
export const ART_EXPANSION_PHASE3_CARDS: CardDefinition[] = [
  card({ id: 'berserker_molten_fist', sourceName: '溶岩の拳', classId: 'berserker', name: '灼岩のひび返し', type: 'attack', glyph: '灼', rarity: 'common',
    description: '10ダメージ。対象の脆弱を2倍にする。廃棄。',
    upgradedDescription: '14ダメージ。対象の脆弱を2倍にする。廃棄。',
    effects: [damage(10), { type: 'multiplyStatus', status: 'vulnerable', amount: 2 }],
    upgradedEffects: [damage(14), { type: 'multiplyStatus', status: 'vulnerable', amount: 2 }], options: { exhaust: true } }),
  card({ id: 'berserker_intimidation', sourceName: '威圧', classId: 'berserker', name: '睨みの石位', type: 'skill', glyph: '睨', rarity: 'uncommon',
    description: '脆弱1を付与。その後、対象の脆弱と同じ数の筋力を得る。廃棄。',
    upgradedDescription: '脆弱2を付与。その後、対象の脆弱と同じ数の筋力を得る。廃棄。',
    effects: [{ type: 'status', target: 'enemy', status: 'vulnerable', amount: 1 }, { type: 'status', target: 'player', status: 'strength', amount: 0, bonusPer: { value: 'enemyVulnerable', multiplier: 1 } }],
    upgradedEffects: [{ type: 'status', target: 'enemy', status: 'vulnerable', amount: 2 }, { type: 'status', target: 'player', status: 'strength', amount: 0, bonusPer: { value: 'enemyVulnerable', multiplier: 1 } }], options: { exhaust: true } }),
  card({ id: 'berserker_barricade', sourceName: 'バリケード', classId: 'berserker', name: '動かぬ大祭壁', type: 'power', glyph: '城', rarity: 'rare',
    description: 'この戦闘中、ターン開始時にブロックを失わない。', upgradedDescription: 'この戦闘中、ターン開始時にブロックを失わない。',
    effects: [{ type: 'power', power: 'retainBlock', amount: 1 }], upgradedEffects: [{ type: 'power', power: 'retainBlock', amount: 1 }] }),

  card({ id: 'assassin_flechettes', sourceName: 'フレシェット', classId: 'assassin', name: '教本つぶて', type: 'attack', glyph: '撒', rarity: 'uncommon',
    description: '他の手札のスキル1枚につき、5ダメージを1回与える。',
    upgradedDescription: '他の手札のスキル1枚につき、7ダメージを1回与える。',
    effects: [damage(5, { hitsPer: 'handSkillCount' })], upgradedEffects: [damage(7, { hitsPer: 'handSkillCount' })] }),
  card({ id: 'assassin_follow_up', sourceName: '追打ち', classId: 'assassin', name: '置き去りの二礼', type: 'attack', glyph: '礼', rarity: 'common',
    description: '敵全体に7ダメージ。使用後に他の手札が5枚以上なら、もう1回攻撃する。',
    upgradedDescription: '敵全体に9ダメージ。使用後に他の手札が5枚以上なら、もう1回攻撃する。',
    effects: [damage(7, { all: true, hitsIf: { condition: { type: 'handSizeAtLeast', amount: 5 }, extra: 1 } })],
    upgradedEffects: [damage(9, { all: true, hitsIf: { condition: { type: 'handSizeAtLeast', amount: 5 }, extra: 1 } })] }),
  card({ id: 'assassin_blur', sourceName: 'ブラー', classId: 'assassin', name: '影壁の余韻', type: 'skill', glyph: '霞', rarity: 'uncommon',
    description: '5ブロック。次のターン開始時にブロックを失わない。',
    upgradedDescription: '8ブロック。次のターン開始時にブロックを失わない。',
    effects: [block(5), { type: 'power', power: 'retainBlockNextTurn', amount: 1 }],
    upgradedEffects: [block(8), { type: 'power', power: 'retainBlockNextTurn', amount: 1 }] }),

  card({ id: 'oracle_moonlight_wave', sourceName: '月光波', classId: 'oracle', name: '月下の追講', type: 'attack', glyph: '月', rarity: 'common',
    description: 'このターンに使用済みのスキル1枚につき、基礎ダメージ4。',
    upgradedDescription: 'このターンに使用済みのスキル1枚につき、基礎ダメージ5。',
    effects: [damage(0, { bonusPer: { value: 'skillsPlayedThisTurn', multiplier: 4 } })],
    upgradedEffects: [damage(0, { bonusPer: { value: 'skillsPlayedThisTurn', multiplier: 5 } })] }),
  card({ id: 'oracle_supermassive', sourceName: '超巨大', classId: 'oracle', name: '創世の岩塊', type: 'attack', glyph: '塊', rarity: 'uncommon',
    description: '5ダメージ。この戦闘で生成したカード1枚につき威力＋3。',
    upgradedDescription: '5ダメージ。この戦闘で生成したカード1枚につき威力＋4。',
    effects: [damage(5, { bonusPer: { value: 'generatedCardCount', multiplier: 3 } })],
    upgradedEffects: [damage(5, { bonusPer: { value: 'generatedCardCount', multiplier: 4 } })] }),
  card({ id: 'oracle_knockout', sourceName: 'ノックアウト', classId: 'oracle', name: '五つ星の送別', type: 'attack', glyph: '送', rarity: 'rare',
    description: '30ダメージ。この攻撃で敵を倒すと星5を得る。',
    upgradedDescription: '38ダメージ。この攻撃で敵を倒すと星5を得る。',
    effects: [damage(30, { onKill: { stars: 5 } })], upgradedEffects: [damage(38, { onKill: { stars: 5 } })] }),

  card({ id: 'necromancer_countdown', sourceName: 'カウントダウン', classId: 'necromancer', name: '黄泉の砂時計', type: 'power', glyph: '刻', rarity: 'uncommon',
    description: '毎ターン開始時、ランダムな敵1体に破滅6。',
    upgradedDescription: '毎ターン開始時、ランダムな敵1体に破滅9。',
    effects: [{ type: 'power', power: 'doomRandomOnTurn', amount: 6 }], upgradedEffects: [{ type: 'power', power: 'doomRandomOnTurn', amount: 9 }] }),
  card({ id: 'necromancer_bone_upgrade', sourceName: '骨強化', classId: 'necromancer', name: '岩霊の骨仕立て', type: 'power', glyph: '骨', rarity: 'uncommon',
    description: 'この戦闘中、岩霊の攻撃ダメージ＋4。', upgradedDescription: 'この戦闘中、岩霊の攻撃ダメージ＋6。',
    effects: [{ type: 'power', power: 'summonDamage', amount: 4 }], upgradedEffects: [{ type: 'power', power: 'summonDamage', amount: 6 }] }),
  card({ id: 'necromancer_soul_storm', sourceName: 'ソウルストーム', classId: 'necromancer', name: '魂札の大合唱', type: 'attack', glyph: '唱', rarity: 'common',
    description: '9ダメージ。廃棄札の魂札1枚につき威力＋2。',
    upgradedDescription: '9ダメージ。廃棄札の魂札1枚につき威力＋3。',
    effects: [damage(9, { bonusPer: { value: 'exhaustSoulCount', multiplier: 2 } })],
    upgradedEffects: [damage(9, { bonusPer: { value: 'exhaustSoulCount', multiplier: 3 } })] }),

  card({ id: 'machinist_subroutine', sourceName: 'サブルーティン', classId: 'machinist', name: '祈祷の回生配線', type: 'power', glyph: '巡', rarity: 'uncommon',
    description: 'パワーを使うたび、エナジー1を得る。', upgradedDescription: 'パワーを使うたび、エナジー1を得る。',
    effects: [{ type: 'power', power: 'energyOnPower', amount: 1 }], upgradedEffects: [{ type: 'power', power: 'energyOnPower', amount: 1 }] }),
  card({ id: 'machinist_storm', sourceName: 'ストーム', classId: 'machinist', name: '祈祷の雷雲', type: 'power', glyph: '雲', rarity: 'rare',
    description: 'パワーを使うたび、雷オーブを1個生成。', upgradedDescription: 'パワーを使うたび、雷オーブを2個生成。',
    effects: [{ type: 'power', power: 'lightningOnPower', amount: 1 }], upgradedEffects: [{ type: 'power', power: 'lightningOnPower', amount: 2 }] }),
  card({ id: 'machinist_loop', sourceName: 'ループ', classId: 'machinist', name: '右端の残響', type: 'power', glyph: '響', rarity: 'uncommon',
    description: '毎ターン開始時、右端の保持オーブの自動効果を1回発動する。',
    upgradedDescription: '毎ターン開始時、右端の保持オーブの自動効果を2回発動する。',
    effects: [{ type: 'power', power: 'orbPassiveOnTurn', amount: 1 }], upgradedEffects: [{ type: 'power', power: 'orbPassiveOnTurn', amount: 2 }] }),
];

export const ART_EXPANSION_PHASE3_CARD_IDS = ART_EXPANSION_PHASE3_CARDS.map((definition) => definition.id);
