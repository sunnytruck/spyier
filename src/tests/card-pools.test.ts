import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS, LEGACY_CARD_IDS } from '../data/cards';
import { getCardPool } from '../engine/cardPools';
import { createRun, getAvailableNodes, reduceRun } from '../engine/run';
import { getEnemies } from '../engine';
import type { ClassId } from '../types/game';
import type { NodeType, RunState } from '../types/run';

const classes: ClassId[] = ['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'];

function enterRoom(classId: ClassId, type: NodeType, seed = 'class-room'): RunState {
  const run = createRun(seed, classId);
  const node = getAvailableNodes(run)[0];
  node.type = type;
  return reduceRun(run, { type: 'chooseNode', nodeId: node.id });
}

function winRoom(run: RunState): RunState {
  for (const enemy of getEnemies(run.combat!)) {
    enemy.hp = 1;
    enemy.poison = 1;
  }
  return reduceRun(run, { type: 'combat', action: { type: 'endTurn' } });
}

describe('acquisition pools enforce class ownership', () => {
  it.each(classes)('%s combat rewards contain only implemented cards of that class', (classId) => {
    const pool = getCardPool(classId, 'combat');
    expect(pool.length).toBeGreaterThanOrEqual(3);
    expect(new Set(pool).size).toBe(pool.length);
    for (const id of pool) {
      const card = CARD_DEFINITIONS[id];
      expect(card.classId).toBe(classId);
      expect(card.tokenOnly).not.toBe(true);
      expect(card.rewardEligible).not.toBe(false);
      expect(card.effects.length).toBeGreaterThan(0);
      expect(card.upgradedEffects.length).toBeGreaterThan(0);
    }
  });

  it.each(classes)('%s shops and ordinary events include own cards and colorless cards', (classId) => {
    for (const context of ['shop', 'event'] as const) {
      const pool = getCardPool(classId, context);
      const owners = new Set(pool.map((id) => CARD_DEFINITIONS[id].classId));
      expect(owners).toEqual(new Set([classId, 'colorless']));
      for (const id of getCardPool(classId, 'combat')) expect(pool).toContain(id);
    }
  });

  it('keeps combat ownership strict even when an event-style override is passed', () => {
    const pool = getCardPool('assassin', 'combat', {
      includeColorless: true,
      allowOtherClasses: true,
      additionalClassIds: ['machinist'],
    });
    expect(pool.every((id) => CARD_DEFINITIONS[id].classId === 'assassin')).toBe(true);
  });

  it('requires an explicit opt-in before an event can grant another class card', () => {
    const ordinary = getCardPool('berserker', 'event', { additionalClassIds: ['oracle'] });
    expect(ordinary.some((id) => CARD_DEFINITIONS[id].classId === 'oracle')).toBe(false);
    const special = getCardPool('berserker', 'event', {
      includeOwnClass: false,
      includeColorless: false,
      additionalClassIds: ['oracle'],
      allowOtherClasses: true,
    });
    expect(special.length).toBeGreaterThan(0);
    expect(special.every((id) => CARD_DEFINITIONS[id].classId === 'oracle')).toBe(true);
  });

  it('treats a whitelist as a restriction and never as a way to bypass class ownership', () => {
    const own = getCardPool('berserker', 'combat')[0];
    const foreign = getCardPool('assassin', 'combat')[0];
    expect(getCardPool('berserker', 'event', {
      includeColorless: false,
      cardIds: [own, foreign, 'not-a-card'],
    })).toEqual([own]);
    expect(getCardPool('berserker', 'event', { cardIds: ['not-a-card'] })).toEqual([]);
  });

  it('preserves the exact original pool for classless legacy runs', () => {
    expect(LEGACY_CARD_IDS).toHaveLength(30);
    for (const context of ['combat', 'shop', 'event'] as const)
      expect(getCardPool(undefined, context)).toEqual(LEGACY_CARD_IDS);
    expect(LEGACY_CARD_IDS.every((id) => !CARD_DEFINITIONS[id].sourceCardId)).toBe(true);
  });
});

describe('real run rewards and inventory respect the selected class', () => {
  it.each(classes)('%s ordinary and elite victories offer three distinct own-class cards', (classId) => {
    for (const type of ['battle', 'elite'] as const) {
      const start = enterRoom(classId, type, `reward-${classId}-${type}`);
      const won = winRoom(start);
      expect(won.screen).toBe('reward');
      expect(won.reward!.cardIds).toHaveLength(3);
      expect(new Set(won.reward!.cardIds).size).toBe(3);
      expect(won.reward!.cardIds.every((id) => CARD_DEFINITIONS[id].classId === classId)).toBe(true);
      const selected = won.reward!.cardIds[0];
      const picked = reduceRun(won, { type: 'takeCard', cardId: selected });
      expect(picked.deck).toHaveLength(won.deck.length + 1);
      expect(picked.deck.at(-1)!.cardId).toBe(selected);
      expect(reduceRun(picked, { type: 'takeCard', cardId: selected })).toBe(picked);
    }
  });

  it.each(classes)('%s boss victory can resolve an own-class reward before finishing', (classId) => {
    const won = winRoom(enterRoom(classId, 'boss', `boss-${classId}`));
    expect(won.screen).toBe('reward');
    expect(won.reward!.cardIds).toHaveLength(3);
    expect(won.reward!.cardIds.every((id) => CARD_DEFINITIONS[id].classId === classId)).toBe(true);
    expect(reduceRun(won, { type: 'takeCard', cardId: null }).screen).toBe('victory');
    expect(reduceRun(won, { type: 'takeCard', cardId: won.reward!.cardIds[0] }).screen).toBe('victory');
  });

  it.each(classes)('%s shops always offer a colorless card and an own-class card', (classId) => {
    for (let index = 0; index < 12; index++) {
      const shop = enterRoom(classId, 'shop', `shop-${classId}-${index}`);
      const owners = new Set(shop.shop!.cardIds.map((id) => CARD_DEFINITIONS[id].classId));
      expect(owners).toEqual(new Set([classId, 'colorless']));
      expect(shop).toEqual(enterRoom(classId, 'shop', `shop-${classId}-${index}`));
    }
  });

  it.each(classes)('%s existing card-granting events no longer inject a legacy/foreign card', (classId) => {
    for (const eventId of ['moss_garden', 'morning_circle']) {
      const event = enterRoom(classId, 'event', `event-${classId}`);
      event.eventId = eventId;
      const index = eventId === 'moss_garden' ? 0 : 1;
      const after = reduceRun(event, { type: 'eventChoice', index });
      expect(after.deck).toHaveLength(event.deck.length + 1);
      expect([classId, 'colorless']).toContain(CARD_DEFINITIONS[after.deck.at(-1)!.cardId].classId);
      expect(reduceRun(event, { type: 'eventChoice', index })).toEqual(after);
    }
  });
});
