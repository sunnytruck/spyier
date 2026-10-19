import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { canPlayCard, createCombat, reduceCombat, upgradeCard } from '../engine';
import { getCardPool } from '../engine/cardPools';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { canUpgradeCard, getCardPresentation } from '../presentation/cardUpgrade';
import { CLASS_IDS } from '../data/classes';

describe('event curse is a real, removable draw burden', () => {
  const curse = { uid: 'curse-1', cardId: 'stone_doubt', upgraded: false };

  it('occupies a drawn slot but cannot spend energy, trigger relics or be upgraded', () => {
    const state = createCombat('curse-draw', 'grit_scout', { deck: [curse], relicIds: ['guard_rhythm'] });
    expect(state.hand).toEqual([curse]);
    expect(canPlayCard(state, curse.uid)).toBe(false);
    expect(reduceCombat(state, { type: 'playCard', cardId: curse.uid })).toBe(state);
    expect(canUpgradeCard(curse)).toBe(false);
    expect(upgradeCard(curse)).toEqual(curse);
    expect(getCardPresentation(curse)!.keywords).toEqual(['呪い', '使用不可']);
    expect(CARD_DEFINITIONS[curse.cardId].description).toContain('使用・強化できない');
  });

  it('moves into discard at turn end, preserves its identity and survives save/load', () => {
    const filler = Array.from({ length: 9 }, (_, index) => ({ uid: `filler-${index}`, cardId: 'stone_strike', upgraded: false }));
    const state = createCombat('curse-discard', 'grit_scout', { deck: [curse, ...filler] });
    state.hand = [curse];
    state.drawPile = filler;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.discardPile).toContainEqual(curse);
    expect(after.hand).not.toContainEqual(curse);
    expect(deserializeGame(serializeGame(after))).toEqual(after);
  });

  it('never appears in ordinary card pools for any class or legacy run', () => {
    for (const classId of [undefined, ...CLASS_IDS])
      for (const source of ['combat', 'shop', 'event'] as const)
        expect(getCardPool(classId, source)).not.toContain(curse.cardId);
  });
});
