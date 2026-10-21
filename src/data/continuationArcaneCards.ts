import type { CardDefinition, Effect } from '../types/game';
import { createReferenceCard as card } from './referenceCard';

const damage = (amount: number, extra: Partial<Extract<Effect, { type: 'damage' }>> = {}): Effect => ({ type: 'damage', amount, ...extra });
const block = (amount: number): Effect => ({ type: 'block', amount });
const next = (effects: Effect[]): Effect => ({ type: 'nextTurn', effects });
const lightning = (): Effect => ({ type: 'channel', orb: 'lightning', amount: 1 });

/** Source costs and both printed effects are preserved; absent type/rarity are provisional. */
const machinistCards: CardDefinition[] = [
  card({
    id: 'machinist_claw', classId: 'machinist', sourceName: '爪', name: '岩爪の反復研磨', type: 'attack', glyph: '爪',
    description: '3ダメージ。この戦闘中、すべての「岩爪の反復研磨」のダメージ +2。',
    upgradedDescription: '4ダメージ。この戦闘中、すべての「岩爪の反復研磨」のダメージ +3。',
    effects: [damage(3), { type: 'cardDamageBonus', amount: 2 }],
    upgradedEffects: [damage(4), { type: 'cardDamageBonus', amount: 3 }],
  }),
  card({
    id: 'machinist_lightning_rod', classId: 'machinist', sourceName: '避雷針', name: '二朝の避雷塔', type: 'skill', glyph: '塔',
    description: '4ブロック。次の2ターンの開始時、それぞれ雷オーブを1個生成。',
    upgradedDescription: '7ブロック。次の2ターンの開始時、それぞれ雷オーブを1個生成。',
    effects: [block(4), next([lightning(), next([lightning()])])],
    upgradedEffects: [block(7), next([lightning(), next([lightning()])])],
  }),
  card({
    id: 'machinist_biased_cognition', classId: 'machinist', sourceName: '認知偏向', name: '明日のことは明日の回路', type: 'power', glyph: '偏', rarity: 'rare',
    description: '集中力 +4。毎ターン開始時、集中力 −1。',
    upgradedDescription: '集中力 +5。毎ターン開始時、集中力 −1。',
    effects: [{ type: 'focus', amount: 4 }, { type: 'power', power: 'focusOnTurn', amount: -1 }],
    upgradedEffects: [{ type: 'focus', amount: 5 }, { type: 'power', power: 'focusOnTurn', amount: -1 }],
  }),
  card({
    id: 'machinist_capacitor', classId: 'machinist', sourceName: 'コンデンサ', name: '岩核の増設架台', type: 'power', glyph: '架', rarity: 'uncommon',
    description: 'オーブスロット +2。', upgradedDescription: 'オーブスロット +3。',
    effects: [{ type: 'orbSlots', amount: 2 }], upgradedEffects: [{ type: 'orbSlots', amount: 3 }],
  }),
  card({
    id: 'machinist_tesla_coil', classId: 'machinist', sourceName: 'テスラコイル', name: '岩核の雷束ね', type: 'attack', glyph: '雷', rarity: 'uncommon',
    description: '3ダメージ。保持中のすべての雷オーブの自動効果を、対象の敵に発動する。オーブは消費しない。',
    upgradedDescription: '6ダメージ。保持中のすべての雷オーブの自動効果を、対象の敵に発動する。オーブは消費しない。',
    effects: [damage(3), { type: 'passiveOrbs', orb: 'lightning', target: 'selected' }],
    upgradedEffects: [damage(6), { type: 'passiveOrbs', orb: 'lightning', target: 'selected' }],
  }),
  card({
    id: 'machinist_coolant', classId: 'machinist', sourceName: '冷却材', name: '多相の冷却祈祷', type: 'power', glyph: '涼', rarity: 'uncommon',
    description: '毎ターン開始時、保持中のオーブ1種類につき2ブロック。',
    upgradedDescription: '毎ターン開始時、保持中のオーブ1種類につき3ブロック。',
    effects: [{ type: 'power', power: 'blockPerOrbTypeOnTurn', amount: 2 }],
    upgradedEffects: [{ type: 'power', power: 'blockPerOrbTypeOnTurn', amount: 3 }],
  }),
];

/** Colorless cards retain the existing shop/event acquisition policy, never combat rewards. */
const colorlessCards: CardDefinition[] = [
  card({
    id: 'colorless_barrage', classId: 'colorless', sourceName: '連射', name: '石つぶての乱射', type: 'attack', glyph: '乱', rarity: 'uncommon',
    description: '残りエナジーをすべて使い、ランダムな敵に10ダメージをその回数与える。',
    upgradedDescription: '残りエナジーをすべて使い、ランダムな敵に14ダメージをその回数与える。',
    effects: [damage(10, { randomTarget: true, xHits: true })], upgradedEffects: [damage(14, { randomTarget: true, xHits: true })],
  }),
  card({
    id: 'colorless_dark_shackles', classId: 'colorless', sourceName: '闇の足枷', name: '岩影の足枷', type: 'skill', glyph: '枷', rarity: 'uncommon',
    description: '敵1体の筋力 −9。次の自分のターン開始時にこの減少分を戻す。廃棄。',
    upgradedDescription: '敵1体の筋力 −15。次の自分のターン開始時にこの減少分を戻す。廃棄。',
    effects: [{ type: 'temporaryStatus', target: 'enemy', status: 'strength', amount: -9, allowNegative: true }],
    upgradedEffects: [{ type: 'temporaryStatus', target: 'enemy', status: 'strength', amount: -15, allowNegative: true }],
    options: { exhaust: true },
  }),
  card({
    id: 'colorless_forethought', classId: 'colorless', sourceName: '先読み(無色)', name: '石板の先読み', type: 'skill', glyph: '読',
    description: '2枚引く。手札から1枚選び、山札の一番上に置く。廃棄。',
    upgradedDescription: '2枚引く。手札から1枚選び、山札の一番上に置く。',
    effects: [{ type: 'draw', amount: 2 }, { type: 'moveChoice', from: 'hand', to: 'drawPile', amount: 1 }],
    upgradedEffects: [{ type: 'draw', amount: 2 }, { type: 'moveChoice', from: 'hand', to: 'drawPile', amount: 1 }],
    options: { exhaust: true, upgradedExhaust: false },
  }),
  card({
    id: 'colorless_lacerate', classId: 'colorless', sourceName: '裂傷', name: '弱点へ刻む石傷', type: 'attack', glyph: '傷', rarity: 'uncommon',
    description: '15ダメージ。対象のデバフ1種類につきダメージ +5。',
    upgradedDescription: '18ダメージ。対象のデバフ1種類につきダメージ +8。',
    effects: [damage(15, { bonusPer: { value: 'enemyDebuffs', multiplier: 5 } })],
    upgradedEffects: [damage(18, { bonusPer: { value: 'enemyDebuffs', multiplier: 8 } })],
  }),
  card({
    id: 'colorless_scrawl', classId: 'colorless', sourceName: '走り書き', name: '教祖の全力速記', type: 'skill', glyph: '記', rarity: 'rare',
    description: '手札がいっぱいになるまで引く（現在の上限50枚）。廃棄。',
    upgradedDescription: '保留。手札がいっぱいになるまで引く（現在の上限50枚）。廃棄。',
    effects: [{ type: 'drawTo', amount: 50 }], upgradedEffects: [{ type: 'drawTo', amount: 50 }],
    options: { exhaust: true, upgradedRetain: true },
  }),
  card({
    id: 'colorless_frenzy', classId: 'colorless', sourceName: '狂奔', name: 'うききの跳弾', type: 'attack', glyph: '跳',
    description: 'ランダムな敵に7ダメージを2回。', upgradedDescription: 'ランダムな敵に9ダメージを2回。',
    effects: [damage(7, { randomTarget: true, hits: 2 })], upgradedEffects: [damage(9, { randomTarget: true, hits: 2 })],
  }),
  card({
    id: 'colorless_food_fight', classId: 'colorless', sourceName: 'フードファイト', name: '朝飯前の怪力', type: 'skill', glyph: '飯',
    description: 'このターン、筋力 +5。', upgradedDescription: 'このターン、筋力 +7。',
    effects: [{ type: 'temporaryStatus', target: 'player', status: 'strength', amount: 5 }],
    upgradedEffects: [{ type: 'temporaryStatus', target: 'player', status: 'strength', amount: 7 }],
  }),
  card({
    id: 'colorless_circular_barrier', classId: 'colorless', sourceName: '円環の障壁', name: '三朝の岩環', type: 'skill', glyph: '環', rarity: 'uncommon',
    description: '5ブロック。次の2ターンの開始時、それぞれ5ブロック。',
    upgradedDescription: '7ブロック。次の2ターンの開始時、それぞれ7ブロック。',
    effects: [block(5), next([block(5), next([block(5)])])],
    upgradedEffects: [block(7), next([block(7), next([block(7)])])],
  }),
  card({
    id: 'colorless_valor', classId: 'colorless', sourceName: '武勇', name: '岩尊の文武両道', type: 'skill', glyph: '勇', rarity: 'uncommon',
    description: '筋力 +1。敏捷性 +1。', upgradedDescription: '筋力 +2。敏捷性 +2。',
    effects: [{ type: 'status', target: 'player', status: 'strength', amount: 1 }, { type: 'dexterity', amount: 1 }],
    upgradedEffects: [{ type: 'status', target: 'player', status: 'strength', amount: 2 }, { type: 'dexterity', amount: 2 }],
  }),
  card({
    id: 'colorless_immortal_armor', classId: 'colorless', sourceName: '不滅の鎧', name: '幾重の不動岩鎧', type: 'skill', glyph: '鎧', rarity: 'rare',
    description: 'プレートアーマー7を得る。ターン終了時、残りのプレートアーマーと同じブロック。敵の攻撃でHPを失うたび1減る。',
    upgradedDescription: 'プレートアーマー9を得る。ターン終了時、残りのプレートアーマーと同じブロック。敵の攻撃でHPを失うたび1減る。',
    effects: [{ type: 'plate', amount: 7 }], upgradedEffects: [{ type: 'plate', amount: 9 }],
  }),
];

export const CONTINUATION_ARCANE_CARDS: CardDefinition[] = [...machinistCards, ...colorlessCards];
