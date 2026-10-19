import type { CardDefinition } from '../types/game';
import { createReferenceCard } from './referenceCard';

/** Source-linked, executable cards explicitly named in the user's limited-card list. */
const cards: CardDefinition[] = [
  createReferenceCard({ id: 'blessing_ancestral_wrath', classId: 'colorless', sourceName: 'ネオーの怒り', name: '祖岩の怒り', type: 'attack', glyph: '祖', rarity: 'rare',
    description: '10ダメージ。捨て札からランダムに2枚手札へ戻す。廃棄。', upgradedDescription: '14ダメージ。捨て札からランダムに2枚手札へ戻す。廃棄。',
    effects: [{ type: 'damage', amount: 10 }, { type: 'moveRandom', from: 'discardPile', to: 'hand', amount: 2 }],
    upgradedEffects: [{ type: 'damage', amount: 14 }, { type: 'moveRandom', from: 'discardPile', to: 'hand', amount: 2 }], options: { acquisition: 'blessingOnly', exhaust: true } }),
  createReferenceCard({ id: 'blessing_rending', classId: 'colorless', sourceName: '引き裂き', name: 'ひび割れの連礼', type: 'attack', glyph: '裂', rarity: 'rare',
    description: '5ダメージを2回。その後、この戦闘中すべての「ひび割れの連礼」の1ヒットごとの威力＋1。',
    upgradedDescription: '6ダメージを2回。その後、この戦闘中すべての「ひび割れの連礼」の1ヒットごとの威力＋2。',
    effects: [{ type: 'damage', amount: 5, hits: 2 }, { type: 'cardDamageBonus', amount: 1 }],
    upgradedEffects: [{ type: 'damage', amount: 6, hits: 2 }, { type: 'cardDamageBonus', amount: 2 }], options: { acquisition: 'blessingOnly' } }),
  createReferenceCard({ id: 'blessing_wish', classId: 'colorless', sourceName: '願い', name: 'じっとの願掛け', type: 'skill', glyph: '願', rarity: 'rare',
    description: '山札からカードを1枚選び、手札に加える。廃棄。', upgradedDescription: '保留。山札からカードを1枚選び、手札に加える。廃棄。',
    effects: [{ type: 'moveChoice', from: 'drawPile', to: 'hand', amount: 1 }], upgradedEffects: [{ type: 'moveChoice', from: 'drawPile', to: 'hand', amount: 1 }],
    options: { acquisition: 'blessingOnly', exhaust: true, upgradedRetain: true } }),
  createReferenceCard({ id: 'blessing_aurora', classId: 'colorless', sourceName: '極光の炎', name: '炎立つ御神体', type: 'skill', glyph: '極', rarity: 'rare',
    description: 'エナジー＋2。2枚引く。最大HPを1失う（冒険中も元に戻らない）。',
    upgradedDescription: 'エナジー＋3。3枚引く。最大HPを1失う（冒険中も元に戻らない）。',
    effects: [{ type: 'energy', amount: 2 }, { type: 'draw', amount: 2 }, { type: 'loseMaxHp', amount: 1 }],
    upgradedEffects: [{ type: 'energy', amount: 3 }, { type: 'draw', amount: 3 }, { type: 'loseMaxHp', amount: 1 }], options: { acquisition: 'blessingOnly' } }),
  createReferenceCard({ id: 'blessing_apotheosis', classId: 'colorless', sourceName: '神格化', name: '一日だけ岩尊神', type: 'skill', glyph: '尊', rarity: 'rare',
    description: '天賦。この戦闘中だけ、すべてのカードを1段階強化する。廃棄。', upgradedDescription: 'コスト1。天賦。この戦闘中だけ、すべてのカードを1段階強化する。廃棄。',
    effects: [{ type: 'upgradeAll' }], upgradedEffects: [{ type: 'upgradeAll' }], options: { acquisition: 'blessingOnly', innate: true, exhaust: true } }),
  createReferenceCard({ id: 'blessing_relaxation', classId: 'colorless', sourceName: 'リラックス', name: '八時の岩休み', type: 'skill', glyph: '休', rarity: 'rare',
    description: '15ブロック。次の自分のターン、2枚引いてからエナジー＋2。廃棄。',
    upgradedDescription: '17ブロック。次の自分のターン、3枚引いてからエナジー＋3。廃棄。',
    effects: [{ type: 'block', amount: 15 }, { type: 'nextTurn', effects: [{ type: 'draw', amount: 2 }, { type: 'energy', amount: 2 }] }],
    upgradedEffects: [{ type: 'block', amount: 17 }, { type: 'nextTurn', effects: [{ type: 'draw', amount: 3 }, { type: 'energy', amount: 3 }] }], options: { acquisition: 'blessingOnly', exhaust: true } }),
];

/** Keyword rules were explicitly confirmed: enemy attacks only; skip one announced action. */
const keywordCards: CardDefinition[] = [
  createReferenceCard({ id: 'blessing_whistle', classId: 'colorless', sourceName: 'ホイッスル', name: '動くな、朝礼だ', type: 'attack', glyph: '笛', rarity: 'rare',
    description: '33ダメージ。対象をスタン1（次の行動を1回休む）。廃棄。', upgradedDescription: '44ダメージ。対象をスタン1（次の行動を1回休む）。廃棄。',
    effects: [{ type: 'damage', amount: 33 }, { type: 'stun', amount: 1 }], upgradedEffects: [{ type: 'damage', amount: 44 }, { type: 'stun', amount: 1 }], options: { acquisition: 'blessingOnly', exhaust: true } }),
  createReferenceCard({ id: 'blessing_apparition', classId: 'colorless', sourceName: '幻姿', name: '彼岸の岩衣', type: 'skill', glyph: '幻', rarity: 'rare',
    description: 'エセリアル。霊体1。次の敵ターン終了まで、敵の攻撃を1ヒット最大1にする。毒・HP消費・最大HP減少は軽減しない。廃棄。',
    upgradedDescription: '霊体1。次の敵ターン終了まで、敵の攻撃を1ヒット最大1にする。毒・HP消費・最大HP減少は軽減しない。廃棄。',
    effects: [{ type: 'intangible', amount: 1 }], upgradedEffects: [{ type: 'intangible', amount: 1 }], options: { acquisition: 'blessingOnly', exhaust: true, ethereal: true, upgradedEthereal: false } }),
];

export const BLESSING_CARD_DEFINITIONS: Record<string, CardDefinition> = Object.fromEntries([...cards, ...keywordCards].map((card) => [card.id, card]));
