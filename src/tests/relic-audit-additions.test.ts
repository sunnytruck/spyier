import { describe, expect, it } from 'vitest';
import { createCombat, getEnemies, reduceCombat } from '../engine';
import { drawCards } from '../engine/actions/draw';
import { deserializeGame, serializeGame } from '../engine/persistence';
import type { CombatState } from '../types/game';

function play(state: CombatState, cardId: string): CombatState {
  const card = state.hand.find((candidate) => candidate.cardId === cardId);
  expect(card, `${cardId} must be in hand`).toBeDefined();
  const next = reduceCombat(state, { type: 'playCard', cardId: card!.uid });
  expect(next).not.toBe(state);
  return next;
}

describe('additional source relics resolve complete effects through actual combat', () => {
  it('gorget grants plate 4 once, blocks before enemy hits, loses one only on unblocked attack damage, and survives saving', () => {
    let state = createCombat('source-gorget', 'grit_scout', { relicIds: ['ref_gorget'] });
    expect(state.plate).toBe(4);
    expect(state.player.block).toBe(0);
    state = reduceCombat(state, { type: 'endTurn' });
    // End-of-turn plate blocks 4 of the announced 5 damage.
    expect(state.player.hp).toBe(79);
    expect(state.plate).toBe(3);
    const restored = deserializeGame(serializeGame(state));
    expect(restored).toEqual(state);
    state = reduceCombat(restored!, { type: 'endTurn' });
    // The scout's next action is defensive: no plate is lost and no restart grants 4 again.
    expect(state.player.hp).toBe(79);
    expect(state.plate).toBe(3);
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.player.hp).toBe(74); // 8 damage - 3 plate block.
    expect(state.plate).toBe(2);
  });

  it('gorget does not lose plate on HP payments, poison, or a completely blocked enemy hit', () => {
    let state = createCombat('source-gorget-cost', 'grit_scout', {
      classId: 'berserker', relicIds: ['ref_gorget'],
      deck: ['berserker_bloodletting', 'berserker_guard'].map((cardId, index) => ({ uid: `plate-${index}`, cardId, upgraded: false })),
    });
    state = play(state, 'berserker_bloodletting');
    expect(state.player.hp).toBe(77);
    expect(state.plate).toBe(4);
    state = play(state, 'berserker_guard');
    state.player.poison = 3;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.player.hp).toBe(74); // Fully blocked 5-damage attack, then poison 3.
    expect(state.plate).toBe(4);
  });

  it('kusarigama adds 6 random-enemy damage on each third attack, excludes skills, and resumes the counter exactly after load', () => {
    let state = createCombat('source-kusarigama', ['grit_scout', 'candle_moth'], {
      classId: 'berserker', relicIds: ['ref_kusarigama'],
      deck: [...Array<string>(6).fill('berserker_anger'), 'berserker_guard'].map((cardId, index) => ({ uid: `chain-${index}`, cardId, upgraded: false })),
    });
    for (const enemy of getEnemies(state)) { enemy.hp = 1000; enemy.maxHp = 1000; }
    state = drawCards(state, 7);
    state = play(state, 'berserker_guard');
    for (let count = 1; count <= 6; count++) {
      state = play(state, 'berserker_anger');
      const lost = 2000 - getEnemies(state).reduce((total, enemy) => total + enemy.hp, 0);
      expect(lost).toBe(count * 6 + Math.floor(count / 3) * 6);
      if (count === 2) {
        const restored = deserializeGame(serializeGame(state));
        expect(restored).toEqual(state);
        state = restored!;
      }
    }
  });

  it('kusarigama counts from zero in a new turn while retaining its actual random state', () => {
    let state = createCombat('source-kusarigama-turn', ['grit_scout', 'candle_moth'], {
      classId: 'berserker', relicIds: ['ref_kusarigama'],
      deck: Array.from({ length: 6 }, (_, index) => ({ uid: `reset-${index}`, cardId: 'berserker_anger', upgraded: false })),
    });
    for (const enemy of getEnemies(state)) { enemy.hp = 1000; enemy.maxHp = 1000; }
    state = play(play(state, 'berserker_anger'), 'berserker_anger');
    state = reduceCombat(state, { type: 'endTurn' });
    const before = getEnemies(state).reduce((total, enemy) => total + enemy.hp, 0);
    for (let count = 1; count <= 3; count++) {
      state = play(state, 'berserker_anger');
      const after = getEnemies(state).reduce((total, enemy) => total + enemy.hp, 0);
      expect(before - after).toBe(count * 6 + (count === 3 ? 6 : 0));
    }
  });
});
