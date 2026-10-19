import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { createCombat, getEnemies, getEnemyKey, reduceCombat } from '../engine';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { nextRandom } from '../engine/random';
import { createRun, getAvailableNodes, reduceRun } from '../engine/run';
import { serializeRun } from '../engine/runPersistence';
import { captureCombatTransition } from '../presentation/trace';
import type { CombatCue } from '../presentation/types';
import type { CardInstance, ClassId, CombatState } from '../types/game';

function fixture(cardId = 'stone_strike', upgraded = false, multi = false): CombatState {
  const definition = CARD_DEFINITIONS[cardId];
  const classId: ClassId = definition.classId && definition.classId !== 'colorless' ? definition.classId : 'berserker';
  const deck: CardInstance[] = [
    { uid: 'played', cardId, upgraded },
    ...Array.from({ length: 12 }, (_, index) => ({ uid: `filler-${index}`, cardId: 'still_guard', upgraded: false })),
  ];
  const state = createCombat('presentation-trace-fixture', multi ? ['grit_scout', 'candle_moth', 'lost_bell'] : 'grit_scout', { deck, classId });
  state.hand = deck.slice(0, 4);
  state.drawPile = deck.slice(4);
  state.discardPile = [];
  state.energy = 100;
  for (const enemy of getEnemies(state)) {
    enemy.hp = enemy.maxHp = 500;
    enemy.block = 0;
  }
  return state;
}

function play(state: CombatState) {
  return captureCombatTransition(state, () => reduceCombat(state, { type: 'playCard', cardId: 'played' }));
}

function impacts(cues: CombatCue[], targetId?: string): CombatCue[] {
  return cues.filter((cue) => cue.kind === 'impact' && (targetId === undefined || cue.targetId === targetId));
}

describe('presentation observes combat without changing any engine or saved result', () => {
  const variants = Object.values(CARD_DEFINITIONS).flatMap((card) => [false, true].map((upgraded) => ({ id: card.id, upgraded })));
  it.each(variants)('$id (upgraded=$upgraded) has identical state, RNG and save bytes with tracing enabled', ({ id, upgraded }) => {
    const state = fixture(id, upgraded, true);
    state.classResources!.stars = 7;
    state.classResources!.starsGainedThisTurn = 2;
    state.classResources!.forge = 3;
    state.classResources!.ostyHp = 5;
    state.classResources!.orbs = ['lightning', 'frost'];
    const before = JSON.stringify(state);
    const plain = reduceCombat(state, { type: 'playCard', cardId: 'played' });
    const captured = play(state);
    expect(JSON.stringify(captured.result)).toBe(JSON.stringify(plain));
    expect(captured.result.rngState).toBe(plain.rngState);
    expect(serializeGame(captured.result)).toBe(serializeGame(plain));
    expect(JSON.stringify(state)).toBe(before);
    if (CARD_DEFINITIONS[id].unplayable) {
      expect(captured.result).toBe(state);
      expect(captured.cues).toEqual([]);
      return;
    }
    expect(captured.cues[0]).toMatchObject({ kind: 'cardPlay', sourceId: 'player', card: { uid: 'played' } });
    expect(captured.cues[0].frame.hand.some((card) => card.uid === 'played')).toBe(false);
  });

  it('captures the existing run reducer boundary without changing its persisted result', () => {
    const run = createRun('traced-campaign', 'oracle');
    const battle = reduceRun(run, { type: 'chooseNode', nodeId: getAvailableNodes(run)[0].id });
    const action = { type: 'combat' as const, action: { type: 'endTurn' as const } };
    const captured = captureCombatTransition(battle.combat!, () => reduceRun(battle, action));
    expect(serializeRun(captured.result)).toBe(serializeRun(reduceRun(battle, action)));
    expect(captured.cues.some((cue) => cue.kind === 'attack' && cue.targetId === 'player')).toBe(true);
    expect(JSON.stringify(captured.result)).not.toContain('"cues"');
  });

  it('snapshots are independent of each other, the input and the final state', () => {
    const state = fixture();
    const captured = play(state);
    const attack = captured.cues.find((cue) => cue.kind === 'attack')!;
    const impact = impacts(captured.cues)[0];
    expect(attack.frame.enemy.hp).toBe(500);
    expect(impact.frame.enemy.hp).toBe(493);
    attack.frame.enemy.hp = 1;
    expect(impact.frame.enemy.hp).toBe(493);
    expect(state.enemy.hp).toBe(500);
    expect(captured.result.enemy.hp).toBe(493);
  });

  it('invalid actions emit no events and do not leave an observer attached to later actions', () => {
    const state = fixture();
    const invalid = captureCombatTransition(state, () => reduceCombat(state, { type: 'playCard', cardId: 'missing' }));
    expect(invalid.result).toBe(state);
    expect(invalid.cues).toEqual([]);
    reduceCombat(state, { type: 'playCard', cardId: 'played' });
    expect(invalid.cues).toEqual([]);
    const captured = play(state);
    const count = captured.cues.length;
    reduceCombat(state, { type: 'endTurn' });
    expect(captured.cues).toHaveLength(count);
  });
});

describe('hit-by-hit presentation accurately describes damage, targets and deaths', () => {
  it('emits a shield impact with zero HP damage for a fully blocked hit', () => {
    const state = fixture();
    state.enemy.block = 20;
    const captured = play(state);
    expect(impacts(captured.cues)).toHaveLength(1);
    expect(impacts(captured.cues)[0]).toMatchObject({ sourceId: 'player', targetId: 'grit_scout', amount: 0, blocked: 7 });
    expect(captured.result.enemy.hp).toBe(500);
    expect(captured.result.enemy.block).toBe(13);
  });

  it('orders attack and impact per hit, caps overkill and stops a multiattack immediately on death', () => {
    const state = fixture('pebble_rain');
    state.enemy.hp = 4;
    const captured = play(state);
    const damageCues = captured.cues.filter((cue) => ['attack', 'impact', 'death'].includes(cue.kind));
    expect(damageCues.map((cue) => cue.kind)).toEqual(['attack', 'impact', 'attack', 'impact', 'death']);
    expect(impacts(captured.cues).map((cue) => cue.amount)).toEqual([3, 1]);
    expect(impacts(captured.cues).map((cue) => cue.frame.enemy.hp)).toEqual([1, 0]);
    expect(captured.cues.filter((cue) => cue.kind === 'death')).toHaveLength(1);
    expect(captured.result.phase).toBe('victory');
  });

  it('keeps separate targets and death cues for area attacks without replaying an old death', () => {
    const state = fixture('bedrock_sweep', false, true);
    getEnemies(state)[0].hp = 1;
    const first = play(state);
    expect(impacts(first.cues).map((cue) => [cue.targetId, cue.amount])).toEqual([
      ['grit_scout-0', 1], ['candle_moth-1', 6], ['lost_bell-2', 6],
    ]);
    expect(first.cues.filter((cue) => cue.kind === 'death').map((cue) => cue.targetId)).toEqual(['grit_scout-0']);
    const next = captureCombatTransition(first.result, () => reduceCombat(first.result, { type: 'endTurn' }));
    expect(next.cues.filter((cue) => cue.kind === 'death')).toEqual([]);
    expect(next.cues.filter((cue) => cue.kind === 'attack' && cue.targetId === 'player').map((cue) => cue.sourceId)).toEqual(['candle_moth-1', 'lost_bell-2']);
  });

  it('attributes every enemy hit to its exact instance, including repeated enemy IDs', () => {
    const state = createCombat('enemy-attribution', ['grit_scout', 'grit_scout']);
    getEnemies(state)[1].intent = { kind: 'attack', label: '連打', description: '2回攻撃。', damage: 2, hits: 2 };
    const captured = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    expect(impacts(captured.cues, 'player').map((cue) => [cue.sourceId, cue.amount])).toEqual([
      ['grit_scout-0', 5], ['grit_scout-1', 2], ['grit_scout-1', 2],
    ]);
  });

  it('poison kills before an enemy can attack and uses a poison visual rather than an enemy lunge', () => {
    const state = fixture();
    state.enemy.hp = state.enemy.poison = 3;
    const captured = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    expect(impacts(captured.cues)).toEqual([expect.objectContaining({ targetId: 'grit_scout', amount: 3, effect: 'poison' })]);
    expect(impacts(captured.cues, 'player')).toEqual([]);
    expect(captured.cues.filter((cue) => cue.kind === 'death')).toHaveLength(1);
    expect(captured.result.phase).toBe('victory');
  });

  it('a lethal thorns counter interrupts later enemy hits and attributes the counter to the player', () => {
    const state = fixture();
    state.enemy.hp = 3;
    state.enemy.intent = { kind: 'attack', label: '三連打', description: '3回攻撃。', damage: 2, hits: 3 };
    state.powerStacks = { thorns: 3 };
    const captured = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    expect(impacts(captured.cues).map((cue) => [cue.sourceId, cue.targetId, cue.amount])).toEqual([
      ['grit_scout', 'player', 2], ['player', 'grit_scout', 3],
    ]);
    expect(impacts(captured.cues)[1].effect).toBe('thorns');
    expect(captured.result.player.hp).toBe(state.player.hp - 2);
  });

  it('summon interception reports actual HP damage rather than displaying a fake player damage amount', () => {
    const state = fixture('necromancer_bodyguard');
    state.classResources!.ostyHp = 10;
    state.player.block = 2;
    state.enemy.intent = { kind: 'attack', label: '攻撃', description: '8ダメージ。', damage: 8 };
    const captured = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    expect(impacts(captured.cues, 'player')).toEqual([expect.objectContaining({ amount: 0, blocked: 2, absorbed: 6 })]);
    expect(captured.cues).toContainEqual(expect.objectContaining({ kind: 'resource', resource: 'ostyHp', amount: -6 }));
    expect(captured.result.player.hp).toBe(state.player.hp);
    expect(captured.result.classResources!.ostyHp).toBe(4);
  });

  it('lightning cues point at the seeded target actually hit rather than the selected opponent', () => {
    const state = fixture('machinist_dual_cast', false, true);
    state.classResources!.orbs = ['lightning'];
    let rng = state.rngState;
    const expectedTargets = Array.from({ length: 2 }, () => {
      const random = nextRandom(rng);
      rng = random.state;
      return getEnemyKey(getEnemies(state)[Math.floor(random.value * 3)]);
    });
    const captured = play(state);
    expect(impacts(captured.cues).map((cue) => cue.targetId)).toEqual(expectedTargets);
    expect(impacts(captured.cues).every((cue) => cue.effect === 'orbLightning')).toBe(true);
    expect(captured.result.rngState).toBe(rng);
    expect(impacts(captured.cues).map((cue) => cue.amount)).toEqual([8, 8]);
  });
});

describe('card movements and interactive effect continuations', () => {
  it('draws the actual reshuffled cards in engine order and records every moved identity', () => {
    const state = fixture('deep_breath');
    state.discardPile = state.drawPile;
    state.drawPile = [];
    const captured = play(state);
    const drawn = captured.cues.filter((cue) => cue.kind === 'draw').flatMap((cue) => cue.cards ?? (cue.card ? [cue.card] : []));
    expect(drawn.map((card) => card.uid)).toEqual(captured.result.hand.slice(state.hand.length - 1).map((card) => card.uid));
    expect(drawn).toHaveLength(2);
    expect(captured.result.rngState).not.toBe(state.rngState);
  });

  it('generated stone blades use their new identities, then exhaust after being played', () => {
    const generated = play(fixture('assassin_blade_dance'));
    const generatedCues = generated.cues.filter((cue) => cue.kind === 'generate').flatMap((cue) => cue.cards ?? (cue.card ? [cue.card] : []));
    expect(generatedCues.map((card) => card.uid)).toEqual(generated.result.generatedCards!.map((card) => card.uid));
    expect(generatedCues).toHaveLength(3);
    expect(generated.cues).toContainEqual(expect.objectContaining({ kind: 'exhaust', fromZone: 'played', toZone: 'exhaustPile', card: { uid: 'played', cardId: 'assassin_blade_dance', upgraded: false } }));
    const knife = generatedCues[0];
    const used = captureCombatTransition(generated.result, () => reduceCombat(generated.result, { type: 'playCard', cardId: knife.uid }));
    expect(used.cues).toContainEqual(expect.objectContaining({ kind: 'exhaust', card: knife }));
  });

  it('a suspended exhaust selection can be saved and resumed without replaying the card or losing subsequent draws', () => {
    const first = play(fixture('berserker_burning_pact'));
    expect(first.result.pendingChoice).toBeDefined();
    expect(first.cues.filter((cue) => cue.kind === 'draw' || cue.kind === 'exhaust')).toEqual([]);
    const restored = deserializeGame(serializeGame(first.result))!;
    const selected = restored.hand[1];
    const continued = captureCombatTransition(restored, () => reduceCombat(restored, { type: 'chooseCards', cardIds: [selected.uid] }));
    expect(continued.cues.filter((cue) => cue.kind === 'cardPlay')).toEqual([]);
    expect(continued.cues).toContainEqual(expect.objectContaining({ kind: 'exhaust', fromZone: 'hand', cards: [selected] }));
    expect(continued.cues.filter((cue) => cue.kind === 'draw').flatMap((cue) => cue.cards ?? [])).toHaveLength(2);
    expect(continued.result.pendingChoice).toBeUndefined();
    expect(serializeGame(continued.result)).toBe(serializeGame(reduceCombat(first.result, { type: 'chooseCards', cardIds: [selected.uid] })));
  });
});

describe('distinct effect cues for class resources, buffs and recovery', () => {
  it.each([
    ['oracle_awe', 'stars', 2, 'player'],
    ['oracle_manifest', 'forge', 8, 'player'],
    ['necromancer_bodyguard', 'ostyHp', 5, 'osty'],
    ['machinist_zap', 'lightning', 1, 'orb-0'],
    ['machinist_hotfix', 'focus', 2, 'player'],
  ] as const)('%s records the exact gained %s resource separately from damage', (cardId, resource, amount, targetId) => {
    const captured = play(fixture(cardId));
    expect(captured.cues).toContainEqual(expect.objectContaining({ kind: 'resource', sourceId: 'player', targetId, resource, amount }));
    expect(impacts(captured.cues)).toEqual([]);
  });

  it('poison, strength and power acquisition remain distinct from hit and block effects', () => {
    const poison = play(fixture('poison_moss'));
    expect(poison.cues).toContainEqual(expect.objectContaining({ kind: 'status', targetId: 'grit_scout', status: 'poison', amount: 5 }));
    expect(impacts(poison.cues)).toEqual([]);
    const strength = play(fixture('berserker_inflame'));
    expect(strength.cues).toContainEqual(expect.objectContaining({ kind: 'status', targetId: 'player', status: 'strength', amount: 2 }));
    expect(strength.cues).toContainEqual(expect.objectContaining({ kind: 'power', fromZone: 'played', toZone: 'powers' }));
    const power = play(fixture('thorn_shrine'));
    expect(power.cues).toContainEqual(expect.objectContaining({ kind: 'power', targetId: 'player', status: 'thorns', amount: 3 }));
  });

  it('healing uses actual recovered HP, including a partially wasted potion', () => {
    const state = fixture();
    state.player.hp = state.player.maxHp - 4;
    state.potions = ['spring_water', null, null];
    const captured = captureCombatTransition(state, () => reduceCombat(state, { type: 'usePotion', slot: 0 }));
    expect(captured.cues.filter((cue) => cue.kind === 'heal')).toEqual([expect.objectContaining({ targetId: 'player', amount: 4 })]);
    expect(captured.result.player.hp).toBe(state.player.maxHp);
    expect(captured.result.potions![0]).toBeNull();
    expect(captured.cues.some((cue) => cue.kind === 'cardPlay')).toBe(false);
  });

  it('summon damage has a summon attribution and doom death suppresses the threatened enemy attack', () => {
    const state = fixture('necromancer_unleash');
    state.classResources!.ostyHp = 5;
    const summoned = play(state);
    expect(impacts(summoned.cues)).toEqual([expect.objectContaining({ sourceId: 'osty', effect: 'summonDamage', amount: 11 })]);
    const doomed = fixture('necromancer_doom_draw');
    doomed.enemy.hp = 10;
    const applied = play(doomed);
    expect(applied.cues).toContainEqual(expect.objectContaining({ kind: 'status', status: 'doom', targetId: 'grit_scout', amount: 13 }));
    const ended = captureCombatTransition(applied.result, () => reduceCombat(applied.result, { type: 'endTurn' }));
    expect(impacts(ended.cues)).toEqual([expect.objectContaining({ targetId: 'grit_scout', effect: 'doom', amount: 10 })]);
    expect(ended.cues.filter((cue) => cue.kind === 'death')).toHaveLength(1);
    expect(ended.result.player.hp).toBe(doomed.player.hp);
  });

  it('frost has its own block effect and carries the exact focus-adjusted amount', () => {
    const state = fixture('machinist_dual_cast');
    state.classResources!.orbs = ['frost'];
    state.classResources!.focus = 2;
    const captured = play(state);
    expect(captured.cues.filter((cue) => cue.kind === 'block').map((cue) => [cue.effect, cue.amount])).toEqual([
      ['orbFrost', 7], ['orbFrost', 7],
    ]);
    expect(captured.result.player.block).toBe(14);
  });

  it('end-turn movements distinguish retained, ethereal and ordinary hand cards', () => {
    const deck = [
      { uid: 'retain', cardId: 'necromancer_sow', upgraded: false },
      { uid: 'ethereal', cardId: 'necromancer_desecrate', upgraded: false },
      { uid: 'ordinary', cardId: 'stone_strike', upgraded: false },
    ];
    const state = createCombat('movement-zones', 'grit_scout', { classId: 'necromancer', deck });
    const captured = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    const handToDiscard = captured.cues.filter((cue) => cue.kind === 'discard' && cue.fromZone === 'hand');
    const handToExhaust = captured.cues.filter((cue) => cue.kind === 'exhaust' && cue.fromZone === 'hand');
    expect(handToDiscard.flatMap((cue) => cue.cards ?? []).map((card) => card.uid)).toEqual(['ordinary']);
    expect(handToExhaust.flatMap((cue) => cue.cards ?? []).map((card) => card.uid)).toEqual(['ethereal']);
    expect(handToDiscard[0].frame.hand.map((card) => card.uid)).toEqual(['retain']);
    expect(handToExhaust[0].frame.exhaustPile.map((card) => card.uid)).toEqual(['ethereal']);
  });
});
