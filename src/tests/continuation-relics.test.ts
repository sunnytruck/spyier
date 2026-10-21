import { describe, expect, it } from 'vitest';
import source from '../data/sourceRelics.generated.json';
import { CARD_DEFINITIONS } from '../data/cards';
import { CONTINUATION_RELIC_DEFINITIONS } from '../data/continuationRelics';
import { CLASS_IDS } from '../data/classes';
import { RELIC_EVENT_DEFINITIONS } from '../data/relicEvents';
import { getRelicPool, RELIC_DEFINITIONS } from '../data/relics';
import { canPlayCard, createCombat, reduceCombat } from '../engine';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { beforeCardRelics, effectivePlayerStrength, triggerRelics } from '../engine/combat/relics';
import { getRelicCardDamageMultiplier } from '../engine/combat/relicModifiers';
import { calculateEnemyAttackDamage, calculatePlayerAttackDamage } from '../engine/combat/damage';
import { attackCardBase } from '../engine/combat/resources';
import { resolveEffects } from '../engine/effects/resolve';
import { captureCombatTransition } from '../presentation/trace';
import type { CardInstance, ClassId, CombatState } from '../types/game';

const deck = (): CardInstance[] => Array.from({ length: 40 }, (_, index) => ({ uid: `continuation-${index}`, cardId: 'stone_strike', upgraded: false }));
const card = (cardId = 'stone_strike', uid = 'played-card'): CardInstance => ({ uid, cardId, upgraded: false });
function battle(id: string, options: { classId?: ClassId; encounterType?: 'normal' | 'elite' | 'boss' } = {}): CombatState {
  return createCombat('continuation-relic-contract', 'tower_abbot', { relicIds: [id], deck: deck(), hp: 80, maxHp: 80, ...options });
}
function play(state: CombatState, instance: CardInstance): CombatState {
  state.hand = [instance];
  state.energy = 30;
  state.enemy.hp = state.enemy.maxHp = 1000;
  state.enemy.block = 0;
  return reduceCombat(state, { type: 'playCard', cardId: instance.uid });
}

describe('continuation relic source identities and acquisition', () => {
  it('implements sixteen distinct source relics with the complete original description', () => {
    const definitions = Object.values(CONTINUATION_RELIC_DEFINITIONS);
    expect(definitions).toHaveLength(16);
    for (const relic of definitions) {
      const reference = source.relics.find((entry) => entry.sourceId === relic.sourceRelicId)!;
      expect(reference).toBeDefined();
      expect(relic.name).toBe(reference.sourceName);
      expect(relic.description).toBe(reference.effectRaw);
      expect(relic.rarity).toBe(reference.rarity);
      expect(Object.values(RELIC_DEFINITIONS).filter((entry) => entry.sourceRelicId === relic.sourceRelicId)).toHaveLength(1);
    }
  });
  it.each(CLASS_IDS)('%s preserves normal, shop, ancient and event-only boundaries', (classId) => {
    for (const relic of Object.values(CONTINUATION_RELIC_DEFINITIONS)) {
      for (const route of ['normal', 'shop', 'ancient', 'event'] as const) {
        expect(getRelicPool(classId, route).includes(relic.id), `${relic.id}:${route}`).toBe(route === relic.acquisition);
        expect(getRelicPool(classId, route, [relic.id])).not.toContain(relic.id);
      }
    }
  });
  it('gates the event-only dummy behind the paid counterfeit-stall choice', () => {
    const choice = RELIC_EVENT_DEFINITIONS.relic_counterfeit_stall.choices.find((entry) => entry.effects.some((effect) => effect.type === 'relic' && effect.relicId === 'ref_strike_dummy_imitation'))!;
    expect(choice.goldCost).toBe(35);
  });
});

describe('continuation relic combat contracts', () => {
  it('red skull changes effective strength immediately at 50%, without modifying permanent strength', () => {
    const state = battle('ref_red_skull');
    state.player.strength = 2;
    state.player.hp = 41; expect(effectivePlayerStrength(state)).toBe(2);
    state.player.hp = 40; expect(effectivePlayerStrength(state)).toBe(5);
    state.player.hp = 39; expect(calculatePlayerAttackDamage(state, 6, state.enemy)).toBe(11);
    state.player.hp = 41; expect(calculatePlayerAttackDamage(state, 6, state.enemy)).toBe(8);
    expect(state.player.strength).toBe(2);
  });
  it('pen nib counts attacks across battles, excludes skills and snapshots all hits of only the tenth attack', () => {
    const state = battle('ref_pen_nib');
    for (let serial = 1; serial <= 9; serial++) {
      state.stats.cardsPlayed = serial;
      beforeCardRelics(state, card());
      beforeCardRelics(state, card());
    }
    state.stats.cardsPlayed = 10;
    beforeCardRelics(state, card('still_guard'));
    expect(state.relicState?.['attacks:ref_pen_nib']).toBe(9);
    const next = createCombat('pen-carry', 'tower_abbot', { relicIds: ['ref_pen_nib'], relicState: state.relicState });
    const result = play(next, card('berserker_twin'));
    expect(1000 - result.enemy.hp).toBe(20); // 5 x 2 hits x 2, not just one hit.
    expect(result.relicState?.['attacks:ref_pen_nib']).toBe(10);
    expect(getRelicCardDamageMultiplier(result, card('berserker_twin'))).toBe(1);
    const normal = play(result, card('berserker_twin', 'eleventh'));
    expect(1000 - normal.enemy.hp).toBe(10);
  });
  it('reptile trinket grants temporary strength for each consumed potion, then expires it once', () => {
    const state = battle('ref_reptile_trinket');
    state.potions = ['shale_tonic', 'shale_tonic', null];
    let next = reduceCombat(state, { type: 'usePotion', slot: 0 });
    expect(next.player.strength).toBe(3);
    expect(reduceCombat(next, { type: 'usePotion', slot: 0 })).toBe(next);
    next = reduceCombat(next, { type: 'usePotion', slot: 1 });
    expect(next.player.strength).toBe(6);
    expect(deserializeGame(serializeGame(next))?.player.strength).toBe(6);
    next = reduceCombat(next, { type: 'endTurn' });
    expect(next.player.strength).toBe(0);
    expect(next.turnModifiers).toBeUndefined();
  });
  it('reptile strength is already gone in enemy-attack frames, while other temporary effects keep their existing lifetime', () => {
    const state = battle('ref_reptile_trinket');
    state.potions = ['shale_tonic', null, null];
    const used = reduceCombat(state, { type: 'usePotion', slot: 0 });
    expect(used.turnModifiers).toContainEqual({ kind: 'status', targetId: 'player', status: 'strength', amount: 3, expireAt: 'playerEnd' });
    const captured = captureCombatTransition(used, () => reduceCombat(used, { type: 'endTurn' }));
    const attackIndex = captured.cues.findIndex((cue) => cue.kind === 'attack' && cue.targetId === 'player');
    const expiryIndex = captured.cues.findIndex((cue) => cue.kind === 'status' && cue.status === 'strength' && cue.amount === -3);
    expect(attackIndex).toBeGreaterThanOrEqual(0);
    expect(expiryIndex).toBeGreaterThanOrEqual(0);
    expect(expiryIndex).toBeLessThan(attackIndex);
    expect(captured.cues[attackIndex].frame.player.strength).toBe(0);
  });
  it('a tenth-attack headbutt saves its pending choice and resumes without doubling its persistent count', () => {
    const initialDeck = deck();
    const headbutt: CardInstance = { uid: 'pen-headbutt', cardId: 'berserker_headbutt', upgraded: false };
    initialDeck[0] = headbutt;
    const state = createCombat('pen-choice-save', 'tower_abbot', { deck: initialDeck, relicIds: ['ref_pen_nib'], relicState: { 'attacks:ref_pen_nib': 9 } });
    state.drawPile = state.drawPile.filter((entry) => entry.uid !== headbutt.uid);
    if (!state.hand.some((entry) => entry.uid === headbutt.uid)) state.hand.push({ ...headbutt });
    state.discardPile.push(...state.drawPile.splice(0, 2));
    const played = reduceCombat(state, { type: 'playCard', cardId: headbutt.uid });
    expect(state.enemy.hp - played.enemy.hp).toBe(18);
    expect(played.pendingChoice?.sourceZone).toBe('discardPile');
    expect(played.relicState?.['attacks:ref_pen_nib']).toBe(10);
    expect(getRelicCardDamageMultiplier(played, headbutt)).toBe(2);
    const restored = deserializeGame(serializeGame(played))!;
    expect(restored).toEqual(played);
    const action = { type: 'chooseCards' as const, cardIds: [restored.discardPile[0].uid] };
    const resumed = reduceCombat(restored, action);
    expect(resumed.pendingChoice).toBeUndefined();
    expect(resumed.relicState?.['attacks:ref_pen_nib']).toBe(10);
    expect(resumed.enemy.hp).toBe(played.enemy.hp);
    expect(getRelicCardDamageMultiplier(resumed, headbutt)).toBe(1);
    expect(reduceCombat(resumed, action)).toBe(resumed);
    expect(deserializeGame(serializeGame(resumed))).toEqual(resumed);
  });
  it('paper frog and crane apply exact multipliers with one final rounding', () => {
    const frog = battle('ref_paper_frog');
    frog.enemy.vulnerable = 1;
    frog.player.weak = 1;
    expect(calculatePlayerAttackDamage(frog, 7, frog.enemy)).toBe(9); // floor(7 x .75 x 1.75)
    frog.enemy.vulnerable = 0;
    expect(calculatePlayerAttackDamage(frog, 7, frog.enemy)).toBe(5);
    const crane = battle('ref_paper_crane');
    crane.enemy.weak = 1;
    crane.player.vulnerable = 1;
    expect(calculateEnemyAttackDamage(crane, 7, crane.enemy)).toBe(6); // floor(7 x .6 x 1.5)
    crane.enemy.weak = 0;
    expect(calculateEnemyAttackDamage(crane, 7, crane.enemy)).toBe(10);
  });
  it.each([0, 3, 4])('pocket watch checks the previous turn (%d cards), not initial-hand draws', (count) => {
    const state = battle('ref_pocket_watch');
    expect(state.hand).toHaveLength(5);
    state.cardsPlayedThisTurn = count;
    const next = reduceCombat(state, { type: 'endTurn' });
    expect(next.hand).toHaveLength(count <= 3 ? 8 : 5);
    const before = next.hand.length;
    triggerRelics(next, 'turnStart');
    expect(next.hand).toHaveLength(before);
  });
  it.each([0, 1, 3])('chemical X increases X hits at payment %d and consumes only the actual payment', (energy) => {
    const state = battle('ref_chemical_x');
    const instance = card('colorless_barrage');
    state.hand = [instance]; state.energy = energy; state.enemy.hp = state.enemy.maxHp = 1000;
    const next = reduceCombat(state, { type: 'playCard', cardId: instance.uid });
    expect(next.energy).toBe(0);
    expect(1000 - next.enemy.hp).toBe(10 * (energy + 2));
  });
  it('chemical X also increases generated orbs, without granting energy or modifying non-X cards', () => {
    const state = battle('ref_chemical_x', { classId: 'machinist' });
    const instance = card('machinist_tempest'); state.hand = [instance]; state.energy = 0;
    const next = reduceCombat(state, { type: 'playCard', cardId: instance.uid });
    expect(next.energy).toBe(0); expect(next.classResources?.orbs).toEqual(['lightning', 'lightning']);
    const normal = play(next, card('berserker_twin')); expect(1000 - normal.enemy.hp).toBe(10);
  });
  it('triangle retains only the first-turn hand, while pyramid retains every turn and neither prevents ethereal exhaust', () => {
    for (const id of ['ref_resonant_triangle', 'ref_runic_pyramid']) {
      let state = battle(id);
      const initial = state.hand.map((entry) => entry.uid);
      state.hand.push(card('necromancer_desecrate', 'ethereal'));
      state = reduceCombat(state, { type: 'endTurn' });
      expect(initial.every((uid) => state.hand.some((entry) => entry.uid === uid))).toBe(true);
      expect(state.exhaustPile.some((entry) => entry.uid === 'ethereal')).toBe(true);
      const second = state.hand.map((entry) => entry.uid);
      state = reduceCombat(state, { type: 'endTurn' });
      expect(second.every((uid) => state.hand.some((entry) => entry.uid === uid))).toBe(id === 'ref_runic_pyramid');
    }
  });
  it('roaring conch adds two only against elites, once at combat start', () => {
    expect(battle('ref_roaring_conch', { encounterType: 'normal' }).hand).toHaveLength(5);
    expect(battle('ref_roaring_conch', { encounterType: 'boss' }).hand).toHaveLength(5);
    const elite = battle('ref_roaring_conch', { encounterType: 'elite' });
    expect(elite.hand).toHaveLength(7);
    triggerRelics(elite, 'combatStart'); expect(elite.hand).toHaveLength(7);
  });
  it('glowing pearl creates the existing playable glow in the hand, never the permanent deck', () => {
    const state = battle('ref_glowing_pearl');
    const glow = state.hand.find((entry) => entry.cardId === 'colorless_glow')!;
    expect(glow).toBeDefined();
    expect(state.hand).toHaveLength(6);
    expect(state.generatedCards).toHaveLength(1);
    expect(state.deck.some((entry) => entry.cardId === glow.cardId)).toBe(false);
    const before = state.energy;
    const next = reduceCombat(state, { type: 'playCard', cardId: glow.uid });
    expect(next.energy).toBe(before + 2);
    expect(next.exhaustPile.some((entry) => entry.uid === glow.uid)).toBe(true);
  });
  it.each([0, 1, 2])('Pael tears require exactly one energy remaining, not at least one (%d)', (energy) => {
    const state = battle('ref_pael_tears'); state.energy = energy;
    const next = reduceCombat(state, { type: 'endTurn' });
    expect(next.energy).toBe(energy === 1 ? 5 : 3);
  });
  it('warm gloves exhaust the true top card and activate exhaust relics before drawing, once per turn', () => {
    const state = battle('ref_warm_gloves');
    expect(state.exhaustPile).toHaveLength(1); expect(state.player.strength).toBe(1);
    state.relicIds!.push('ref_forgotten_soul');
    const top = state.drawPile.at(-1)!; const hp = state.enemy.hp;
    state.turn = 2; triggerRelics(state, 'turnStart'); triggerRelics(state, 'turnStart');
    expect(state.exhaustPile.at(-1)?.uid).toBe(top.uid);
    expect(state.player.strength).toBe(2); expect(state.enemy.hp).toBe(hp - 1);
    state.drawPile = []; state.turn = 3; triggerRelics(state, 'turnStart');
    expect(state.player.strength).toBe(3); expect(state.drawPile).toHaveLength(0);
  });
  it('diamond tiara halves enemy attack damage up to two cards, without reducing poison or HP costs', () => {
    const state = battle('ref_diamond_tiara');
    state.cardsPlayedThisTurn = 2;
    expect(calculateEnemyAttackDamage(state, 9, state.enemy)).toBe(4);
    state.cardsPlayedThisTurn = 3;
    expect(calculateEnemyAttackDamage(state, 9, state.enemy)).toBe(9);
    state.cardsPlayedThisTurn = 0;
    resolveEffects(state, [{ type: 'loseHp', amount: 9 }]);
    expect(state.player.hp).toBe(71);
  });
  it('velvet choker grants one energy each turn and rejects the seventh play through both UI and reducer', () => {
    const state = battle('ref_velvet_choker');
    expect(state.energy).toBe(4);
    const instance = card('still_guard'); state.hand = [instance]; state.cardsPlayedThisTurn = 5;
    expect(canPlayCard(state, instance.uid)).toBe(true);
    state.cardsPlayedThisTurn = 6;
    expect(canPlayCard(state, instance.uid)).toBe(false);
    expect(reduceCombat(state, { type: 'playCard', cardId: instance.uid })).toBe(state);
    const next = reduceCombat(state, { type: 'endTurn' });
    expect(next.energy).toBe(4); expect(next.cardsPlayedThisTurn).toBe(0);
  });
  it('imitation strike dummy adds one to genuine strike metadata, not arbitrary attacks', () => {
    const state = battle('ref_strike_dummy_imitation');
    const strikeId = Object.values(CARD_DEFINITIONS).find((entry) => entry.name === '巡礼の一打')!.id;
    const strike = card(strikeId);
    const effect = CARD_DEFINITIONS[strikeId].effects.find((entry) => entry.type === 'damage')!;
    expect(attackCardBase(state, effect, strike)).toBe(effect.amount + 1);
    expect(attackCardBase(state, { type: 'damage', amount: 5 }, card('berserker_twin'))).toBe(6); // source is ツインストライク
    expect(attackCardBase(state, { type: 'damage', amount: 6 }, card('oracle_sky_force'))).toBe(6);
  });
  it('counter, generation and turn-state saves restore without re-firing opening effects', () => {
    for (const id of Object.keys(CONTINUATION_RELIC_DEFINITIONS)) {
      const state = battle(id);
      const restored = deserializeGame(serializeGame(state));
      expect(restored, id).not.toBeNull();
      expect(restored).toEqual(state);
      expect(reduceCombat(restored!, { type: 'endTurn' })).toEqual(reduceCombat(state, { type: 'endTurn' }));
    }
  });
});
