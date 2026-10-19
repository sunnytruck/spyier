import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { BLESSING_CARD_DEFINITIONS } from '../data/blessingCards';
import sourceCatalog from '../data/sourceCards.generated.json';
import { createCombat, getCardCost, getEnemies, predictEnemyDamage, reduceCombat } from '../engine';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { resolveEffects } from '../engine/effects/resolve';
import { getPendingChoiceCards, getPendingChoiceLabel } from '../engine/actions/choices';
import { attackCardBase } from '../engine/combat/resources';
import { getDisplayedEnemyIntent } from '../engine/combat/enemyAI';
import { meetsEffectCondition } from '../engine/combat/values';
import { captureCombatTransition } from '../presentation/trace';
import type { CardInstance, CombatState } from '../types/game';

function fixture(cardId: string, upgraded = false, enemyIds: string | string[] = 'grit_scout'): CombatState {
  const source = { uid: 'source', cardId, upgraded };
  const fillers: CardInstance[] = Array.from({ length: 20 }, (_, index) => ({ uid: `filler-${index}`, cardId: 'stone_strike', upgraded: false }));
  const state = createCombat('limited-card-behavior', enemyIds, { deck: [source, ...fillers], classId: 'berserker' });
  state.hand = [source, ...fillers.slice(0, 3)];
  state.drawPile = fillers.slice(3, 13);
  state.discardPile = fillers.slice(13);
  state.exhaustPile = []; state.powers = [];
  state.energy = 10;
  state.player.block = 0;
  for (const enemy of getEnemies(state)) {
    enemy.hp = enemy.maxHp = 1000; enemy.block = 0;
    enemy.intent = { kind: 'attack', label: '空振り', description: '0ダメージ。', damage: 0 };
  }
  return state;
}
const play = (state: CombatState) => reduceCombat(state, { type: 'playCard', cardId: 'source' });

describe('source-backed blessing-only cards execute every nonambiguous clause', () => {
  it.each(Object.values(BLESSING_CARD_DEFINITIONS))('$id preserves the source identity and both exact costs', (card) => {
    const source = sourceCatalog.cards.find((entry) => entry.sourceId === card.sourceCardId)!;
    expect(source).toBeDefined();
    expect(source.sourceClass).toBe('colorless');
    expect(card.acquisition).toBe('blessingOnly');
    expect(card.cost).toBe(Number(source.normal.costRaw));
    expect(card.upgradedCost).toBe(Number(source.upgraded.costRaw));
    expect(card.effects.length).toBeGreaterThan(0);
    expect(card.upgradedEffects.length).toBeGreaterThan(0);
  });

  it.each([false, true])('ancestral wrath upgraded=%s hits before retrieving two distinct seeded discards', (upgraded) => {
    const state = fixture('blessing_ancestral_wrath', upgraded);
    const before = serializeGame(state);
    const captured = captureCombatTransition(state, () => play(state));
    const next = captured.result;
    expect(next.enemy.hp).toBe(upgraded ? 986 : 990);
    expect(next.energy).toBe(9);
    const recovered = next.hand.filter((card) => state.discardPile.some((candidate) => candidate.uid === card.uid));
    expect(recovered).toHaveLength(2);
    expect(new Set(recovered.map((card) => card.uid)).size).toBe(2);
    expect(next.exhaustPile.some((card) => card.uid === 'source')).toBe(true);
    expect(play(state)).toEqual(next);
    expect(serializeGame(state)).toBe(before);
    const kinds = captured.cues.filter((cue) => ['impact', 'draw'].includes(cue.kind)).map((cue) => cue.kind);
    expect(kinds).toEqual(['impact', 'draw']);
    expect(deserializeGame(serializeGame(next))).toEqual(next);
  });

  it('random recovery handles empty piles and a full hand without spending RNG', () => {
    const state = fixture('blessing_ancestral_wrath');
    state.drawPile.push(...state.discardPile); state.discardPile = [];
    const rng = state.rngState;
    expect(play(state).rngState).toBe(rng);
    const full = fixture('blessing_ancestral_wrath');
    while (full.hand.length < 50) full.hand.push({ uid: `extra-${full.hand.length}`, cardId: 'stone_strike', upgraded: false });
    const original = full.discardPile.length;
    const next = play(full); // source leaves one free hand slot
    expect(next.hand).toHaveLength(50);
    expect(next.discardPile).toHaveLength(original - 1);
  });

  it.each([false, true])('rending upgraded=%s applies its ramp after both hits and shares it across copies', (upgraded) => {
    const state = fixture('blessing_rending', upgraded);
    const next = play(state);
    expect(next.enemy.hp).toBe(upgraded ? 988 : 990);
    expect(next.cardDamageBonuses).toEqual({ blessing_rending: upgraded ? 2 : 1 });
    const effect = CARD_DEFINITIONS.blessing_rending.effects[0];
    if (effect.type !== 'damage') throw new Error('expected attack');
    expect(attackCardBase(next, effect, { uid: 'copy', cardId: 'blessing_rending', upgraded: false })).toBe(upgraded ? 7 : 6);
    const loaded = deserializeGame(serializeGame(next))!;
    expect(loaded).toEqual(next);
    loaded.hand.push(loaded.discardPile.pop()!);
    const twice = play(loaded);
    expect(twice.enemy.hp).toBe(upgraded ? 972 : 978);
    expect(twice.cardDamageBonuses?.blessing_rending).toBe(upgraded ? 4 : 2);
    expect(fixture('blessing_rending').cardDamageBonuses).toBeUndefined();
  });

  it.each([false, true])('wish upgraded=%s selects any draw-pile card, resumes after reload and exhausts once', (upgraded) => {
    const state = fixture('blessing_wish', upgraded);
    const active = play(state);
    expect(active.pendingChoice).toMatchObject({ mode: 'retrieve', sourceZone: 'drawPile', amount: 1 });
    expect(getPendingChoiceCards(active)).toEqual(state.drawPile);
    expect(getPendingChoiceLabel(active)).toContain('山札');
    expect(active.rngState).toBe(state.rngState);
    const selected = state.drawPile[0];
    const loaded = deserializeGame(serializeGame(active))!;
    expect(loaded).toEqual(active);
    const next = reduceCombat(loaded, { type: 'chooseCards', cardIds: [selected.uid] });
    expect(next.hand.some((card) => card.uid === selected.uid)).toBe(true);
    expect(next.exhaustPile.filter((card) => card.uid === 'source')).toHaveLength(1);
    expect(reduceCombat(next, { type: 'chooseCards', cardIds: [selected.uid] })).toBe(next);
    expect(getCardCost(state.hand[0], state)).toBe(0);
  });

  it.each([false, true])('aurora upgraded=%s grants energy and draw, then permanently loses maximum HP', (upgraded) => {
    const state = fixture('blessing_aurora', upgraded);
    const next = play(state);
    expect(next.energy).toBe(upgraded ? 13 : 12);
    expect(next.hand).toHaveLength(upgraded ? 6 : 5);
    expect(next.player.maxHp).toBe(79);
    expect(next.player.hp).toBe(79);
    expect(next.discardPile.some((card) => card.uid === 'source')).toBe(true);
    expect(next.exhaustPile).toHaveLength(0);
    expect(deserializeGame(serializeGame(next))).toEqual(next);
  });

  it('maximum HP loss at one is lethal and bypasses a positive intangible count', () => {
    const state = fixture('blessing_aurora');
    state.player.maxHp = state.player.hp = 1;
    state.intangible = 1;
    const next = play(state);
    expect(next.player.maxHp).toBe(0);
    expect(next.player.hp).toBe(0);
    expect(next.phase).toBe('defeat');
    expect(deserializeGame(serializeGame(next))).toEqual(next);
  });

  it.each([false, true])('apotheosis upgraded=%s upgrades every current zone and leaves the original input immutable', (upgraded) => {
    const state = fixture('blessing_apotheosis', upgraded);
    const before = serializeGame(state);
    const next = play(state);
    expect(next.energy).toBe(upgraded ? 9 : 8);
    expect(next.deck.every((card) => card.upgraded)).toBe(true);
    expect([...next.hand, ...next.drawPile, ...next.discardPile, ...next.exhaustPile].every((card) => card.upgraded)).toBe(true);
    expect(next.exhaustPile.some((card) => card.uid === 'source')).toBe(true);
    expect(new Set(next.temporaryUpgrades).size).toBe(upgraded ? state.deck.length - 1 : state.deck.length);
    expect(serializeGame(state)).toBe(before);
    expect(deserializeGame(serializeGame(next))).toEqual(next);
  });

  it('combat upgrading does not change an already scheduled source version or its original promise', () => {
    const state = fixture('blessing_relaxation');
    const active = play(state);
    resolveEffects(active, [{ type: 'upgradeAll' }]);
    expect(active.scheduledEffects?.[0].sourceCard?.upgraded).toBe(false);
    expect(active.deck.find((card) => card.uid === 'source')?.upgraded).toBe(true);
    const loaded = deserializeGame(serializeGame(active))!;
    expect(loaded).toEqual(active);
    const next = reduceCombat(loaded, { type: 'endTurn' });
    expect(next.energy).toBe(5);
    expect(next.hand).toHaveLength(7);
    expect(next.scheduledEffects).toBeUndefined();
  });

  it('combat upgrading covers generated cards, powers and exhaust, while preserving prior upgrades and curses', () => {
    const state = fixture('blessing_apotheosis');
    const power = { uid: 'old-power', cardId: 'stone_rhythm', upgraded: false };
    const curse = { uid: 'old-curse', cardId: 'stone_doubt', upgraded: false };
    state.deck.push({ ...power }, { ...curse });
    state.powers.push({ ...power });
    state.discardPile.push({ ...curse });
    const generated = { uid: `generated-${state.nextId++}`, cardId: 'token_knife', upgraded: false };
    state.generatedCards = [{ ...generated }];
    state.hand.push({ ...generated });
    state.exhaustPile.push(state.drawPile.pop()!);
    state.hand[1].upgraded = true;
    state.deck.find((card) => card.uid === state.hand[1].uid)!.upgraded = true;
    const next = play(state);
    expect(next.powers[0].upgraded).toBe(true);
    expect(next.exhaustPile.every((card) => card.upgraded)).toBe(true);
    expect(next.generatedCards?.[0].upgraded).toBe(true);
    expect(next.hand.find((card) => card.uid === generated.uid)?.upgraded).toBe(true);
    expect(next.deck.find((card) => card.uid === curse.uid)?.upgraded).toBe(false);
    expect(next.temporaryUpgrades).not.toContain(curse.uid);
    expect(next.temporaryUpgrades).not.toContain(state.hand[1].uid);
    expect(deserializeGame(serializeGame(next))).toEqual(next);
  });

  it('a copy generated after rending was played receives the same card-ID damage bonus', () => {
    const active = play(fixture('blessing_rending'));
    const source = active.discardPile.find((card) => card.uid === 'source')!;
    resolveEffects(active, [{ type: 'copySelf', destination: 'hand' }], { defense: false }, { sourceCard: source });
    const copy = active.hand.find((card) => card.uid.startsWith('generated-'))!;
    expect(copy.cardId).toBe('blessing_rending');
    const next = reduceCombat(active, { type: 'playCard', cardId: copy.uid });
    expect(next.enemy.hp).toBe(978);
    expect(next.cardDamageBonuses?.blessing_rending).toBe(2);
    expect(deserializeGame(serializeGame(next))).toEqual(next);
  });

  it.each([false, true])('relaxation upgraded=%s gives block now, then draw before next-turn energy exactly once', (upgraded) => {
    const state = fixture('blessing_relaxation', upgraded);
    const active = play(state);
    expect(active.player.block).toBe(upgraded ? 17 : 15);
    expect(active.energy).toBe(7);
    const captured = captureCombatTransition(active, () => reduceCombat(active, { type: 'endTurn' }));
    const next = captured.result;
    expect(next.hand).toHaveLength(upgraded ? 8 : 7);
    expect(next.energy).toBe(upgraded ? 6 : 5);
    expect(next.scheduledEffects).toBeUndefined();
    const scheduledCues = captured.cues.filter((cue) => (cue.kind === 'draw' && cue.effect === 'draw') || (cue.kind === 'resource' && cue.effect === 'energy'));
    expect(scheduledCues.slice(0, 2).map((cue) => cue.kind)).toEqual(['draw', 'resource']);
    const reloaded = deserializeGame(serializeGame(next))!;
    expect(reloaded).toEqual(next);
  });

  it.each([false, true])('whistle upgraded=%s stuns exactly the announced action after poison and advances once', (upgraded) => {
    const state = fixture('blessing_whistle', upgraded);
    state.enemy.poison = 3;
    state.enemy.intent = { kind: 'attack', label: '危険な連打', description: '2回攻撃と強化。', damage: 7, hits: 2, strength: 4, weak: 2 };
    const active = play(state);
    expect(active.enemy.hp).toBe(upgraded ? 956 : 967);
    expect(active.enemy.stun).toBe(1);
    expect(active.energy).toBe(7);
    expect(active.exhaustPile.some((card) => card.uid === 'source')).toBe(true);
    expect(predictEnemyDamage(active)).toBe(0);
    expect(getDisplayedEnemyIntent(active.enemy).damage).toBeUndefined();
    expect(getDisplayedEnemyIntent(active.enemy).description).toContain('毒・破滅');
    expect(meetsEffectCondition(active, { type: 'targetAttacking' })).toBe(false);
    const next = reduceCombat(deserializeGame(serializeGame(active))!, { type: 'endTurn' });
    expect(next.enemy.hp).toBe(upgraded ? 953 : 964);
    expect(next.enemy.poison).toBe(2);
    expect(next.enemy.strength).toBe(0);
    expect(next.player.hp).toBe(80);
    expect(next.player.weak).toBe(0);
    expect(next.enemy.intentIndex).toBe(1);
    expect(next.enemy.stun).toBeUndefined();
  });

  it('stun never prevents poison or doom from killing an enemy before their action', () => {
    const state = fixture('blessing_whistle');
    state.enemy.hp = 34;
    state.enemy.poison = 1;
    const active = play(state);
    expect(active.enemy.hp).toBe(1);
    const next = reduceCombat(active, { type: 'endTurn' });
    expect(next.phase).toBe('victory');
    expect(next.enemy.hp).toBe(0);
    expect(next.player.hp).toBe(80);
  });

  it('a stunned support enemy neither buffs allies nor modifies the next attack forecast', () => {
    const state = fixture('blessing_whistle', false, ['grit_scout', 'candle_moth']);
    getEnemies(state)[0].intent = { kind: 'buff', label: '支援', description: '強力な支援。', alliesStrength: 20, vulnerable: 3 };
    getEnemies(state)[1].intent = { kind: 'attack', label: '攻撃', description: '4ダメージ。', damage: 4 };
    const active = play(state);
    expect(predictEnemyDamage(active, getEnemies(active)[1].instanceId)).toBe(4);
    const next = reduceCombat(active, { type: 'endTurn' });
    expect(next.player.hp).toBe(76);
    expect(getEnemies(next)[1].strength).toBe(0);
  });

  it.each([false, true])('apparition upgraded=%s caps each enemy attack hit and expires after the enemy round', (upgraded) => {
    const state = fixture('blessing_apparition', upgraded);
    state.enemy.intent = { kind: 'attack', label: '三連打', description: '8×3。', damage: 8, hits: 3 };
    const active = play(state);
    expect(active.intangible).toBe(1);
    expect(active.energy).toBe(9);
    expect(active.exhaustPile.some((card) => card.uid === 'source')).toBe(true);
    expect(predictEnemyDamage(active)).toBe(1);
    const next = reduceCombat(deserializeGame(serializeGame(active))!, { type: 'endTurn' });
    expect(next.player.hp).toBe(77);
    expect(next.intangible).toBeUndefined();
  });

  it('intangible caps an enemy hit before block and normal summon protection', () => {
    const state = fixture('blessing_apparition');
    state.enemy.intent = { kind: 'attack', label: '三連打', description: '8×3。', damage: 8, hits: 3 };
    let active = play(state);
    active.player.block = 2;
    expect(reduceCombat(active, { type: 'endTurn' }).player.hp).toBe(79);
    active = play(state);
    active.classResources!.ostyHp = 2;
    const guarded = reduceCombat(active, { type: 'endTurn' });
    expect(guarded.classResources!.ostyHp).toBe(0);
    expect(guarded.player.hp).toBe(79);
  });

  it('a field-wide attack independently hits the summon at full damage while intangible protects the player', () => {
    const state = fixture('blessing_apparition');
    state.enemy.intent = { kind: 'attack', label: '全体攻撃', description: '本体と召喚に8。', damage: 8, allTargets: true };
    const active = play(state);
    active.classResources!.ostyHp = 20;
    const next = reduceCombat(active, { type: 'endTurn' });
    expect(next.player.hp).toBe(79);
    expect(next.classResources!.ostyHp).toBe(12);
  });

  it('intangible does not reduce poison, card HP payments, or maximum HP loss', () => {
    const active = play(fixture('blessing_apparition'));
    active.player.poison = 4;
    resolveEffects(active, [{ type: 'loseHp', amount: 6 }, { type: 'loseMaxHp', amount: 1 }]);
    expect(active.player.hp).toBe(74);
    expect(active.player.maxHp).toBe(79);
    const next = reduceCombat(active, { type: 'endTurn' });
    expect(next.player.hp).toBe(70);
    expect(next.player.poison).toBe(3);
  });

  it('upgraded apparition removes ethereal, while upgraded wish retains without being played', () => {
    const normal = reduceCombat(fixture('blessing_apparition'), { type: 'endTurn' });
    expect(normal.exhaustPile.some((card) => card.uid === 'source')).toBe(true);
    const upgraded = reduceCombat(fixture('blessing_apparition', true), { type: 'endTurn' });
    expect(upgraded.exhaustPile.some((card) => card.uid === 'source')).toBe(false);
    expect(upgraded.discardPile.some((card) => card.uid === 'source')).toBe(true);
    const retained = reduceCombat(fixture('blessing_wish', true), { type: 'endTurn' });
    expect(retained.hand.some((card) => card.uid === 'source')).toBe(true);
  });
});
