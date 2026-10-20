import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REFERENCE_RELIC_DEFINITIONS, REFERENCE_RELIC_IDS } from '../data/referenceRelics';
import { RELIC_DEFINITIONS, type RelicDefinition, type RelicEffect } from '../data/relics';
import { CARD_DEFINITIONS } from '../data/cards';
import { BOSS_ENEMY_IDS, ELITE_ENEMY_IDS } from '../data/enemies';
import { createCombat, getEnemies, reduceCombat } from '../engine';
import { triggerRelics } from '../engine/combat/relics';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { getRelicAwareHpLoss, loseRelicAwareHp } from '../engine/relicAcquisition';
import type { CardInstance, ClassId, CombatState } from '../types/game';

const source = new TextDecoder('shift-jis').decode(readFileSync(new URL('../../docs/reference/レリック一覧.txt', import.meta.url)));
const sourceLines = source.split(/\r?\n/);
const sourceByName = new Map<string, { description: string; rarity: string }>();
for (let index = 0; index < sourceLines.length; index++) {
  const header = sourceLines[index].match(/^(.+?)画像\1\t(スターター|コモン|アンコモン|レア|ショップ|エンシェント|イベント)$/);
  if (!header) continue;
  let end = index + 1;
  while (end < sourceLines.length && !sourceLines[end].includes('\t')) end++;
  sourceByName.set(header[1], { description: sourceLines.slice(index + 1, end).join('\n').trim(), rarity: header[2] });
}
const rarityLabels = { common: 'コモン', uncommon: 'アンコモン', rare: 'レア', shop: 'ショップ', event: 'イベント' } as const;

describe('source relic definitions preserve complete source records', () => {
  it('registers 77 different references with stable IDs and no image labels', () => {
    expect(REFERENCE_RELIC_IDS).toHaveLength(77);
    expect(new Set(REFERENCE_RELIC_IDS).size).toBe(77);
    expect(new Set(Object.values(REFERENCE_RELIC_DEFINITIONS).map((relic) => relic.sourceRelicId)).size).toBe(77);
  });

  it.each(REFERENCE_RELIC_IDS)('%s matches its CP932 source effect and rarity without inventing a number', (id) => {
    const relic = REFERENCE_RELIC_DEFINITIONS[id];
    const record = sourceByName.get(relic.name);
    expect(record).toBeDefined();
    expect(relic.description).toBe(record!.description);
    expect(relic.sourceRelicId).toBe(`relsrc_${createHash('sha256').update(relic.name.normalize('NFKC')).digest('hex').slice(0, 12)}`);
    expect(relic.rarity && rarityLabels[relic.rarity as keyof typeof rarityLabels]).toBe(record!.rarity);
    expect(relic.acquisition).toBe(relic.rarity === 'shop' || relic.rarity === 'event' ? relic.rarity : 'normal');
    expect(relic.name).not.toContain('画像');
    expect(RELIC_DEFINITIONS[id]).toEqual(relic);
    const hooks = relic.effects ?? [relic.effect];
    expect(hooks[0]).toEqual(relic.effect);
    expect(hooks.some((hook) => hook.kind !== 'run') || Object.keys(relic.passive ?? {}).length > 0).toBe(true);
  });

  it('preserves every weaker event imitation as a distinct source rather than an alias of its original', () => {
    for (const [imitation, original] of [
      ['ref_anchor_imitation', 'ref_anchor'], ['ref_orichalcum_imitation', 'ref_orichalcum'],
      ['ref_happy_flower_imitation', 'ref_happy_flower'], ['ref_blood_vial_imitation', 'ref_blood_vial'],
    ]) {
      expect(REFERENCE_RELIC_DEFINITIONS[imitation].sourceRelicId).not.toBe(REFERENCE_RELIC_DEFINITIONS[original].sourceRelicId);
      expect(REFERENCE_RELIC_DEFINITIONS[imitation].name).toContain('？');
      expect(REFERENCE_RELIC_DEFINITIONS[imitation].acquisition).toBe('event');
    }
  });
});

function hookFixture(relic: RelicDefinition, effect: RelicEffect): { state: CombatState; card: CardInstance } {
  const candidate = Object.values(CARD_DEFINITIONS).find((definition) => !definition.unplayable &&
    (!effect.cardType || definition.type === effect.cardType) &&
    (!effect.cardCostAtLeast || !definition.xCost && definition.cost >= effect.cardCostAtLeast));
  if (!candidate) throw new Error(`No fixture card for ${relic.id}`);
  const state = createCombat(`reference-${relic.id}`, effect.bossOnly ? BOSS_ENEMY_IDS[0] : effect.eliteOnly ? ELITE_ENEMY_IDS[0] : ['grit_scout', 'candle_moth'], {
    classId: relic.classId,
    hp: 40, maxHp: 80,
    deck: Array.from({ length: 30 }, (_, index) => ({ uid: `reference-${index}`, cardId: candidate.id, upgraded: false })),
  });
  state.relicIds = [relic.id];
  state.relicCounters = {};
  state.relicState = {};
  state.turn = effect.turn ?? effect.minTurn ?? 1;
  state.player.block = effect.blockAtLeast ?? 0;
  for (const enemy of getEnemies(state)) { enemy.hp = 10000; enemy.maxHp = 10000; enemy.block = 0; }
  if (effect.trigger === 'enemyKilled') getEnemies(state)[0].hp = 0;
  if (effect.handEmpty) state.hand = [];
  const card = state.deck[0];
  return { state, card };
}

function observable(state: CombatState) {
  return {
    block: state.player.block, strength: state.player.strength, dexterity: state.dexterity ?? 0,
    energy: state.energy, hp: state.player.hp, hand: state.hand.length,
    enemyHp: getEnemies(state).map((enemy) => enemy.hp), enemyStrength: getEnemies(state).map((enemy) => enemy.strength),
    poison: getEnemies(state).map((enemy) => enemy.poison),
    forge: state.classResources?.forge ?? 0, focus: state.classResources?.focus ?? 0,
    stars: state.classResources?.stars ?? 0,
    thorns: state.powerStacks?.thorns ?? 0, vigor: state.vigor ?? 0, plate: state.plate ?? 0,
    slots: state.orbSlotBonus ?? 0, generated: state.generatedCards?.length ?? 0,
    upgrades: state.temporaryUpgrades?.length ?? 0,
    nextTurnBlock: state.relicCounters?.nextTurnBlock ?? 0,
    nextTurnEnergy: state.classResources?.nextTurnEnergy ?? 0,
  };
}

const hookCases = Object.values(REFERENCE_RELIC_DEFINITIONS).flatMap((relic) =>
  (relic.effects ?? [relic.effect]).filter((effect) => effect.kind !== 'run').map((effect) => ({ relic, effect, label: `${relic.id}/${effect.kind}` })));

describe('every registered source hook resolves its entire authored numerical effect', () => {
  it.each(hookCases)('$label', ({ relic, effect }) => {
    const { state, card } = hookFixture(relic, effect);
    const before = observable(state);
    const repeats = effect.every ?? 1;
    for (let count = 1; count <= repeats; count++) {
      state.stats.cardsPlayed = count;
      if (effect.every && (effect.trigger === 'turnStart' || effect.trigger === 'turnEnd')) state.turn = count;
      triggerRelics(state, effect.trigger, { card, enemyId: getEnemies(state)[0].instanceId ?? getEnemies(state)[0].id });
    }
    const after = observable(state);
    const amount = effect.amount;
    switch (effect.kind) {
      case 'block': expect(after.block - before.block).toBe(amount); break;
      case 'strength': expect(after.strength - before.strength).toBe(amount); break;
      case 'dexterity': expect(after.dexterity - before.dexterity).toBe(amount); break;
      case 'energy': expect(after.energy - before.energy).toBe(amount); break;
      case 'heal': expect(after.hp - before.hp).toBe(amount); break;
      case 'draw': expect(after.hand - before.hand).toBe(amount); break;
      case 'enemyStrength': expect(after.enemyStrength.map((value, index) => value - before.enemyStrength[index])).toEqual(before.enemyStrength.map(() => amount)); break;
      case 'enemyPoison': expect(after.poison.map((value, index) => value - before.poison[index])).toEqual(before.poison.map(() => amount)); break;
      case 'damageAll': expect(before.enemyHp.map((value, index) => value - after.enemyHp[index])).toEqual(before.enemyHp.map(() => amount)); break;
      case 'damageAllTurn': expect(before.enemyHp.map((value, index) => value - after.enemyHp[index])).toEqual(before.enemyHp.map(() => state.turn)); break;
      case 'damageRandom': expect(before.enemyHp.reduce((sum, value, index) => sum + value - after.enemyHp[index], 0)).toBe(amount); break;
      case 'thorns': expect(after.thorns - before.thorns).toBe(amount); break;
      case 'plate': expect(after.plate - before.plate).toBe(amount); break;
      case 'forge': expect(after.forge - before.forge).toBe(amount); break;
      case 'focus': expect(after.focus - before.focus).toBe(amount); break;
      case 'stars': expect(after.stars - before.stars).toBe(amount); break;
      case 'soul': case 'knife': expect(after.generated - before.generated).toBe(amount); break;
      case 'upgradeHand': expect(after.upgrades - before.upgrades).toBe(state.hand.length); break;
      case 'upgradeDrawPile': expect(after.upgrades - before.upgrades).toBe(amount); break;
      case 'vigor': expect(after.vigor - before.vigor).toBe(amount); break;
      case 'orbSlots': expect(after.slots - before.slots).toBe(amount); break;
      case 'loseHp': expect(before.hp - after.hp).toBe(amount); break;
      case 'nextTurnBlock': expect(after.nextTurnBlock - before.nextTurnBlock).toBe(amount); break;
      case 'nextTurnEnergy': expect(after.nextTurnEnergy - before.nextTurnEnergy).toBe(amount); break;
      case 'blockPerHand': expect(after.block - before.block).toBe(before.hand * amount); break;
      default: throw new Error(`Missing effect assertion: ${effect.kind}`);
    }
  });
});

function playable(relicIds: string[], cards: string[], classId: ClassId = 'berserker', upgraded = false): CombatState {
  const state = createCombat('reference-passive', 'restless_guardian', {
    classId, relicIds,
    deck: cards.map((cardId, index) => ({ uid: `passive-${index}`, cardId, upgraded })),
  });
  for (const enemy of getEnemies(state)) { enemy.hp = 10000; enemy.maxHp = 10000; }
  return state;
}
function play(state: CombatState, cardId: string): CombatState {
  const card = state.hand.find((card) => card.cardId === cardId);
  expect(card).toBeDefined();
  const next = reduceCombat(state, { type: 'playCard', cardId: card!.uid });
  expect(next).not.toBe(state);
  return next;
}

describe('source relic passives affect real card and turn resolution', () => {
  it('strike dummy follows the reference strike name despite IWASON display names', () => {
    for (const cardId of ['berserker_strike', 'berserker_pommel', 'berserker_twin']) {
      const plain = play(playable([], [cardId]), cardId);
      const relic = play(playable(['ref_strike_dummy'], [cardId]), cardId);
      expect(relic.stats.damageDealt - plain.stats.damageDealt).toBe(cardId === 'berserker_twin' ? 6 : 3);
    }
    const plain = play(playable([], ['berserker_anger']), 'berserker_anger');
    const relic = play(playable(['ref_strike_dummy'], ['berserker_anger']), 'berserker_anger');
    expect(relic.stats.damageDealt).toBe(plain.stats.damageDealt);
  });

  it('mini cannon adds three damage per hit only to upgraded attacks', () => {
    for (const upgraded of [false, true]) {
      const plain = play(playable([], ['berserker_twin'], 'berserker', upgraded), 'berserker_twin');
      const relic = play(playable(['ref_mini_cannon'], ['berserker_twin'], 'berserker', upgraded), 'berserker_twin');
      expect(relic.stats.damageDealt - plain.stats.damageDealt).toBe(upgraded ? 6 : 0);
    }
  });

  it('snake skull adds exactly one to each separate poison application', () => {
    let state = playable(['ref_snecko_skull', 'ref_twisted_funnel'], ['assassin_poison_sting', 'assassin_poison_sting'], 'assassin');
    expect(state.enemy.poison).toBe(5);
    state = play(state, 'assassin_poison_sting');
    expect(state.enemy.poison).toBe(9);
    state = play(state, 'assassin_poison_sting');
    expect(state.enemy.poison).toBe(13);
  });

  it('snake skull also amplifies poison applied by a persistent card power each turn', () => {
    let state = playable(['ref_snecko_skull'], ['assassin_fumes'], 'assassin');
    state = play(state, 'assassin_fumes');
    state.enemy.stun = 1;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.enemy.poison).toBe(3);
    state.enemy.stun = 1;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.enemy.poison).toBe(5);
  });

  it('upgraded star-burst attacks receive the same attack bonuses as direct damage attacks', () => {
    function starAttack(relicIds: string[]): number {
      let state = playable(relicIds, ['oracle_awe', 'oracle_star_burst'], 'oracle', true);
      state = play(state, 'oracle_awe');
      state = play(state, 'oracle_star_burst');
      return state.stats.damageDealt;
    }
    const ordinary = starAttack([]);
    expect(starAttack(['ref_mini_cannon']) - ordinary).toBe(3);
    expect(starAttack(['ref_akabeko']) - ordinary).toBe(8);
    expect(starAttack(['ref_mini_cannon', 'ref_akabeko']) - ordinary).toBe(11);
  });

  it('vambrace doubles only the first card block after dexterity without consuming on non-card block', () => {
    let state = playable(['ref_vambrace', 'ref_anchor', 'ref_smooth_stone'], ['berserker_guard', 'berserker_guard']);
    expect(state.player.block).toBe(10);
    state = play(state, 'berserker_guard');
    expect(state.player.block).toBe(22);
    state = play(state, 'berserker_guard');
    expect(state.player.block).toBe(28);
  });

  it('ice cream preserves unused energy and calipers retains at most ten surviving block', () => {
    let state = playable(['ref_ice_cream', 'ref_calipers'], ['berserker_strike']);
    state = play(state, 'berserker_strike');
    expect(state.energy).toBe(2);
    state.player.block = 28;
    state.enemy.stun = 1;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.energy).toBe(5);
    expect(state.player.block).toBe(10);
    state.player.block = 4;
    state.enemy.stun = 1;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.player.block).toBe(4);
    expect(state.energy).toBe(8);
  });

  it('gold-plated cables repeat only the rightmost orb without changing the existing orb order', () => {
    let state = playable(['ref_gold_plated_cables'], ['machinist_zap', 'machinist_cold_wave'], 'machinist');
    state = play(state, 'machinist_cold_wave');
    state = play(state, 'machinist_zap');
    expect(state.classResources?.orbs).toEqual(['frost', 'lightning']);
    const damage = state.stats.damageDealt;
    state.enemy.stun = 1;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.stats.damageDealt - damage).toBe(6);
    expect(state.classResources?.orbs).toEqual(['frost', 'lightning']);
    expect(state.relicCounters?.ref_gold_plated_cables).toBeUndefined();
  });

  it('tungsten reduces HP payments and poison, while maximum HP loss remains unchanged', () => {
    let state = playable(['ref_tungsten_rod'], ['berserker_bloodletting', 'blessing_aurora']);
    state.player.block = 30;
    state = play(state, 'berserker_bloodletting');
    expect(state.player.hp).toBe(78);
    state = play(state, 'blessing_aurora');
    expect(state.player.maxHp).toBe(79);
    expect(state.player.hp).toBe(78);
    state.player.poison = 3;
    state.enemy.stun = 1;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.player.hp).toBe(76);
    const outside = { relicIds: ['ref_tungsten_rod'], hp: 20 };
    expect(getRelicAwareHpLoss(outside, 5)).toBe(4);
    expect(loseRelicAwareHp(outside, 5)).toBe(4);
    expect(outside.hp).toBe(16);
  });

  it('lizard tail revives at half max HP once in the run, and persists its spent counter', () => {
    const options = { relicIds: ['ref_lizard_tail'], hp: 1, maxHp: 80 };
    let state = reduceCombat(createCombat('lizard-first', 'grit_scout', options), { type: 'endTurn' });
    expect(state.phase).toBe('player');
    expect(state.player.hp).toBe(40);
    expect(state.relicState?.['used:ref_lizard_tail']).toBe(1);
    const restored = deserializeGame(serializeGame(state));
    expect(restored).toEqual(state);
    state = createCombat('lizard-next', 'grit_scout', { ...options, relicState: restored!.relicState });
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.phase).toBe('defeat');
    expect(state.player.hp).toBe(0);
  });
});
