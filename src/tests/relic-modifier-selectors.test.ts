import { afterEach, describe, expect, it } from 'vitest';
import { RELIC_DEFINITIONS, type RelicDefinition, type RelicPassives } from '../data/relics';
import { createCombat } from '../engine';
import {
  getRelicCardDamageMultiplier, getRelicCardPlayLimit, getRelicEnemyAttackMultiplier,
  getRelicEnemyWeakMultiplier, getRelicStrengthBonus, getRelicVulnerableMultiplier,
  getRelicXBonus, shouldRelicRetainHand,
} from '../engine/combat/relicModifiers';
import type { CardInstance } from '../types/game';

const originals = new Map<string, RelicDefinition | undefined>();

function fixture(id: string, passive: RelicPassives, options: Partial<RelicDefinition> = {}): string {
  const key = `selector-fixture:${id}`;
  if (!originals.has(key)) originals.set(key, RELIC_DEFINITIONS[key]);
  RELIC_DEFINITIONS[key] = {
    id: key, name: key, description: 'Selector contract fixture', glyph: '試',
    effect: { trigger: 'acquire', kind: 'run', amount: 0 }, passive, ...options,
  };
  return key;
}

function state() {
  return createCombat('pure-relic-modifiers', 'grit_scout', { classId: 'berserker', relicIds: [], maxHp: 80 });
}

afterEach(() => {
  for (const [id, original] of originals) {
    if (original) RELIC_DEFINITIONS[id] = original;
    else delete RELIC_DEFINITIONS[id];
  }
  originals.clear();
});

describe('pure relic modifier selectors', () => {
  it('uses the base combat rules without modifier relics', () => {
    const combat = state();
    expect(getRelicStrengthBonus(combat)).toBe(0);
    expect(getRelicXBonus(combat)).toBe(0);
    expect(getRelicVulnerableMultiplier(combat)).toBe(1.5);
    expect(getRelicEnemyWeakMultiplier(combat)).toBe(0.75);
    expect(getRelicEnemyAttackMultiplier(combat)).toBe(1);
    expect(getRelicCardPlayLimit(combat)).toBe(Infinity);
    expect(shouldRelicRetainHand(combat)).toBe(false);
    expect(getRelicCardDamageMultiplier(combat)).toBe(1);
  });

  it('recomputes strength at inclusive HP boundaries and adds independent bonuses', () => {
    const combat = state();
    combat.relicIds = [
      fixture('half-hp', { hpThresholdStrength: { percent: 50, amount: 3 } }),
      fixture('quarter-hp', { hpThresholdStrength: { percent: 25, amount: 2 } }),
    ];
    combat.player.hp = 41;
    expect(getRelicStrengthBonus(combat)).toBe(0);
    combat.player.hp = 40;
    expect(getRelicStrengthBonus(combat)).toBe(3);
    combat.player.hp = 20;
    expect(getRelicStrengthBonus(combat)).toBe(5);
    combat.player.hp = 41;
    expect(getRelicStrengthBonus(combat)).toBe(0);
    expect(combat.player.strength).toBe(0);
    combat.player.maxHp = 81;
    combat.player.hp = 41;
    expect(getRelicStrengthBonus(combat)).toBe(0);
    combat.player.hp = 40;
    expect(getRelicStrengthBonus(combat)).toBe(3);
  });

  it('adds X bonuses without changing the energy payment or counters', () => {
    const combat = state();
    combat.relicIds = [fixture('x-two', { xEffectBonus: 2 }), fixture('x-one', { xEffectBonus: 1 })];
    combat.energy = 0;
    const before = JSON.stringify(combat);
    expect(getRelicXBonus(combat)).toBe(3);
    expect(JSON.stringify(combat)).toBe(before);
  });

  it('uses the strongest vulnerable and weak adjustments without weakening base statuses', () => {
    const combat = state();
    combat.relicIds = [fixture('less-effective', { vulnerableEnemyMultiplier: 1.4, weakEnemyMultiplier: 0.9 })];
    expect(getRelicVulnerableMultiplier(combat)).toBe(1.5);
    expect(getRelicEnemyWeakMultiplier(combat)).toBe(0.75);
    combat.relicIds.push(fixture('stronger', { vulnerableEnemyMultiplier: 1.75, weakEnemyMultiplier: 0.6 }));
    expect(getRelicVulnerableMultiplier(combat)).toBe(1.75);
    expect(getRelicEnemyWeakMultiplier(combat)).toBe(0.6);
    combat.relicIds.push(fixture('strongest', { vulnerableEnemyMultiplier: 2, weakEnemyMultiplier: 0.5 }));
    expect(getRelicVulnerableMultiplier(combat)).toBe(2);
    expect(getRelicEnemyWeakMultiplier(combat)).toBe(0.5);
  });

  it('multiplies only card-count protections whose inclusive conditions are met', () => {
    const combat = state();
    combat.relicIds = [
      fixture('three-cards', { enemyDamageMultiplierWhenCardsAtMost: { cards: 3, multiplier: 0.5 } }),
      fixture('one-card', { enemyDamageMultiplierWhenCardsAtMost: { cards: 1, multiplier: 0.8 } }),
    ];
    combat.cardsPlayedThisTurn = 1;
    expect(getRelicEnemyAttackMultiplier(combat)).toBe(0.4);
    combat.cardsPlayedThisTurn = 3;
    expect(getRelicEnemyAttackMultiplier(combat)).toBe(0.5);
    combat.cardsPlayedThisTurn = 4;
    expect(getRelicEnemyAttackMultiplier(combat)).toBe(1);
  });

  it('takes the lowest active play limit, including a limit of zero', () => {
    const combat = state();
    combat.relicIds = [fixture('limit-six', { cardsPerTurnLimit: 6 }), fixture('limit-three', { cardsPerTurnLimit: 3 })];
    expect(getRelicCardPlayLimit(combat)).toBe(3);
    combat.relicIds.push(fixture('limit-zero', { cardsPerTurnLimit: 0 }));
    expect(getRelicCardPlayLimit(combat)).toBe(0);
  });

  it('retains through the configured last turn or for all turns with permanent retention', () => {
    const combat = state();
    combat.relicIds = [fixture('first-turn', { retainHandThroughTurn: 1 }), fixture('three-turns', { retainHandThroughTurn: 3 })];
    combat.turn = 1;
    expect(shouldRelicRetainHand(combat)).toBe(true);
    combat.turn = 3;
    expect(shouldRelicRetainHand(combat)).toBe(true);
    combat.turn = 4;
    expect(shouldRelicRetainHand(combat)).toBe(false);
    combat.relicIds.push(fixture('permanent-retention', { retainHand: true }));
    combat.turn = 100;
    expect(shouldRelicRetainHand(combat)).toBe(true);
  });

  it('ignores wrong-class, unknown, superseded and duplicate relic entries', () => {
    const combat = state();
    const inactive = fixture('old-starter', { xEffectBonus: 100 });
    const active = fixture('upgraded-starter', { xEffectBonus: 4 }, { upgradeFrom: inactive });
    const wrongClass = fixture('wrong-class', {
      hpThresholdStrength: { percent: 100, amount: 50 }, xEffectBonus: 50,
      vulnerableEnemyMultiplier: 50, weakEnemyMultiplier: 0.01,
      enemyDamageMultiplierWhenCardsAtMost: { cards: 100, multiplier: 0.01 },
      cardsPerTurnLimit: 0, retainHand: true, retainHandThroughTurn: 100,
    }, { classId: 'oracle' });
    combat.relicIds = [inactive, active, active, wrongClass, 'selector-fixture:unknown'];
    expect(getRelicXBonus(combat)).toBe(4);
    expect(getRelicStrengthBonus(combat)).toBe(0);
    expect(getRelicVulnerableMultiplier(combat)).toBe(1.5);
    expect(getRelicEnemyWeakMultiplier(combat)).toBe(0.75);
    expect(getRelicEnemyAttackMultiplier(combat)).toBe(1);
    expect(getRelicCardPlayLimit(combat)).toBe(Infinity);
    expect(shouldRelicRetainHand(combat)).toBe(false);
  });

  it('keeps an attack multiplier snapshot for every hit without consuming it during reads', () => {
    const combat = state();
    const attack: CardInstance = { uid: 'attack-10', cardId: 'rock_strike', upgraded: false };
    const other: CardInstance = { ...attack, uid: 'attack-11' };
    combat.relicCounters = { [`attack-multiplier:${attack.uid}`]: 2 };
    const before = JSON.stringify(combat);
    expect(getRelicCardDamageMultiplier(combat, attack)).toBe(2);
    expect(getRelicCardDamageMultiplier(combat, attack)).toBe(2);
    expect(getRelicCardDamageMultiplier(combat, other)).toBe(1);
    expect(getRelicCardDamageMultiplier(combat)).toBe(1);
    expect(JSON.stringify(combat)).toBe(before);
  });

  it('never mutates state or advances random draws when all modifiers are previewed', () => {
    const combat = state();
    combat.relicIds = [fixture('all-modifiers', {
      hpThresholdStrength: { percent: 100, amount: 3 }, xEffectBonus: 2,
      vulnerableEnemyMultiplier: 1.75, weakEnemyMultiplier: 0.6,
      enemyDamageMultiplierWhenCardsAtMost: { cards: 3, multiplier: 0.5 },
      cardsPerTurnLimit: 6, retainHandThroughTurn: 3,
    })];
    const before = JSON.stringify(combat);
    for (let index = 0; index < 3; index++) {
      getRelicStrengthBonus(combat);
      getRelicXBonus(combat);
      getRelicVulnerableMultiplier(combat);
      getRelicEnemyWeakMultiplier(combat);
      getRelicEnemyAttackMultiplier(combat);
      getRelicCardPlayLimit(combat);
      shouldRelicRetainHand(combat);
      getRelicCardDamageMultiplier(combat, combat.hand[0]);
    }
    expect(JSON.stringify(combat)).toBe(before);
  });
});
