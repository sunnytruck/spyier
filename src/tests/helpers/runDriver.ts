import { CARD_DEFINITIONS } from '../../data/cards';
import { EVENT_DEFINITIONS } from '../../data/events';
import { POTION_DEFINITIONS } from '../../data/potions';
import { canUpgradeCard } from '../../presentation/cardUpgrade';
import {
  canPlayCard,
  getEnemies,
  getEnemyKey,
  predictEnemyDamage,
  reduceCombat,
} from '../../engine';
import {
  canChooseEvent,
  canAscendAct,
  createRun,
  getAvailableNodes,
  reduceRun,
  SHOP_PRICES,
} from '../../engine/run';
import type { CombatAction, CombatState } from '../../types/game';
import type { MapNode, RunAction, RunState } from '../../types/run';
import { chooseBlessingAction } from './blessingDriver';

function incoming(state: CombatState): number {
  return getEnemies(state)
    .filter((enemy) => enemy.hp > 0)
    .reduce(
      (sum, enemy) =>
        sum + predictEnemyDamage(state, getEnemyKey(enemy)) * (enemy.intent.hits ?? 1),
      0,
    );
}

export function chooseCombatAction(state: CombatState): CombatAction {
  const living = getEnemies(state).filter((enemy) => enemy.hp > 0);
  const target = [...living].sort((a, b) => a.hp - b.hp)[0];
  const targetId = getEnemyKey(target);
  // Every branch below still executes through the same public reducer as the UI.
  for (let slot = 0; slot < (state.potions?.length ?? 0); slot++) {
    const id = state.potions![slot];
    if (!id) continue;
    const potion = POTION_DEFINITIONS[id];
    if (
      potion.effects.some((effect) => effect.type === 'heal') &&
      state.player.maxHp - state.player.hp < 15
    )
      continue;
    if (
      potion.effects.some((effect) => effect.type === 'block') &&
      incoming(state) <= state.player.block
    )
      continue;
    return { type: 'usePotion', slot, targetId };
  }
  const beforeThreat = Math.max(0, incoming(state) - state.player.block);
  const options = state.hand.flatMap((card) => living
    .filter((enemy) => canPlayCard(state, card.uid, getEnemyKey(enemy)))
    .map((enemy) => {
      const targetId = getEnemyKey(enemy);
      const after = reduceCombat(state, { type: 'playCard', cardId: card.uid, targetId });
      const definition = CARD_DEFINITIONS[card.cardId];
      const damage = getEnemies(state).reduce(
        (sum, enemy, index) => sum + enemy.hp - getEnemies(after)[index].hp,
        0,
      );
      const killed = living.length - getEnemies(after).filter((enemy) => enemy.hp > 0).length;
      const threatReduction = beforeThreat - Math.max(0, incoming(after) - after.player.block);
      let score = damage * 1.3 + killed * 70 + threatReduction * 2.5;
      score += (after.player.strength - state.player.strength) * (state.turn < 4 ? 9 : 4);
      // Drawing into an already full hand is less useful than removing a real threat.
      score += (after.hand.length - state.hand.length + 1) *
        (after.energy > 0 ? Math.max(1, 12 - state.hand.length) : 1);
      score += (after.energy - state.energy) * 12;
      score += (after.jitto - state.jitto) * 0.12;
      score += getEnemies(after).reduce(
        (sum, enemy, index) =>
          sum +
          Math.min(enemy.poison - getEnemies(state)[index].poison, Math.ceil(enemy.hp / 2)) * 3,
        0,
      );
      if (definition.type === 'power') score += state.turn < 4 ? 45 : 12;
      if (card.cardId === 'battle_liturgy') score += 25;
      if (after.phase === 'victory') score += 1000;
      return { card, score, targetId };
    }));
  options.sort((left, right) => right.score - left.score);
  return options.length
    ? { type: 'playCard', cardId: options[0].card.uid, targetId: options[0].targetId }
    : { type: 'endTurn' };
}

function cardValue(id: string): number {
  return (
    (
      {
        battle_liturgy: 100,
        stone_training: 95,
        poison_rite: 90,
        moss_garden: 89,
        altar_reserve: 88,
        morning_chant: 85,
        granite_ward: 83,
        still_guard: 80,
        zealous_shell: 79,
        deep_breath: 78,
        read_strata: 76,
        bastion_ram: 75,
        spore_bloom: 74,
        cracked_oath: 72,
        bedrock_sweep: 71,
        stillness: 70,
        gravel_jabs: 69,
        stone_rhythm: 68,
        litany_barrage: 67,
        moss_fang: 66,
        poison_moss: 65,
        crystal_aegis: 64,
        wheel_strike: 63,
        thorn_shrine: 62,
      } as Record<string, number>
    )[id] ?? 40
  );
}

function strategicNode(state: RunState, nodes: MapNode[]): MapNode {
  const weights = {
    treasure: 90,
    rest: state.hp < 58 ? 100 : 60,
    event: 75,
    shop: state.gold >= 120 ? 72 : 20,
    battle: 10,
    elite: -20,
    boss: 0,
  };
  return [...nodes].sort((a, b) => weights[b.type] - weights[a.type])[0];
}

/** A deterministic controller; randomness belongs to the policy, never the game state. */
export function createRunDriver(strategic = true): (state: RunState) => RunAction {
  let policyRng = 123456789;
  const sample = <T>(values: T[]): T => {
    policyRng ^= policyRng << 13;
    policyRng ^= policyRng >>> 17;
    policyRng ^= policyRng << 5;
    return values[(policyRng >>> 0) % values.length];
  };
  return (state: RunState): RunAction => {
    if (state.screen === 'blessing') return chooseBlessingAction(state, reduceRun, (card) => cardValue(card.cardId));
    if (canAscendAct(state)) return { type: 'ascendAct' };
    let action: RunAction;
    if (state.screen === 'map') {
      const nodes = getAvailableNodes(state);
      action = {
        type: 'chooseNode',
        nodeId: (strategic ? strategicNode(state, nodes) : sample(nodes)).id,
      };
    } else if (state.screen === 'combat') {
      const combat = state.combat!;
      let combatAction: CombatAction;
      if (strategic) combatAction = chooseCombatAction(combat);
      else {
        const target = sample(getEnemies(combat).filter((enemy) => enemy.hp > 0));
        const targetId = getEnemyKey(target);
        const cards = combat.hand.filter((card) => canPlayCard(combat, card.uid, targetId));
        const potionSlots = (combat.potions ?? []).flatMap((id, slot) =>
          id && (id !== 'spring_water' || combat.player.hp <= 65) ? [slot] : [],
        );
        combatAction = potionSlots.length
          ? { type: 'usePotion', slot: sample(potionSlots), targetId }
          : cards.length
            ? { type: 'playCard', cardId: sample(cards).uid, targetId }
            : { type: 'endTurn' };
      }
      action = { type: 'combat', action: combatAction };
    } else if (state.screen === 'reward') {
      const choices = state.reward!.cardIds;
      const best = [...choices].sort((a, b) => cardValue(b) - cardValue(a))[0];
      action = {
        type: 'takeCard',
        cardId: strategic
          ? cardValue(best) >= 64 && state.deck.length < 16
            ? best
            : null
          : sample([...choices, null]),
      };
    } else if (state.screen === 'relic') action = { type: 'takeRelic' };
    else if (state.screen === 'rest')
      action = {
        type: 'rest',
        choice: strategic
          ? state.hp < 63 || !state.deck.some(canUpgradeCard)
            ? 'heal'
            : 'upgrade'
          : state.deck.some(canUpgradeCard) ? sample(['heal', 'upgrade'] as const) : 'heal',
      };
    else if (state.screen === 'upgrade') {
      const choices = state.deck.filter(canUpgradeCard);
      const card = strategic
        ? [...choices].sort((a, b) => cardValue(b.cardId) - cardValue(a.cardId))[0]
        : sample(choices);
      action = card ? { type: 'upgradeCard', cardUid: card.uid } : { type: 'leaveNode' };
    } else if (state.screen === 'event') {
      const event = EVENT_DEFINITIONS[state.eventId!];
      const choices = event.choices
        .map((choice, index) => ({ choice, index }))
        .filter(({ index }) => canChooseEvent(state, index));
      const value = (index: number): number =>
        event.choices[index].effects.reduce(
          (sum, effect) =>
            sum +
            (effect.type === 'heal'
              ? Math.min(effect.amount, state.maxHp - state.hp) * 3
              : effect.type === 'relic'
                ? 50
                : effect.type === 'upgrade'
                  ? 30
                  : effect.type === 'gold'
                    ? effect.amount * 0.7
                    : effect.type === 'card'
                      ? cardValue(effect.cardId) * 0.3
                      : 0),
          0,
        ) -
        (event.choices[index].hpCost ?? 0) * 3 -
        (event.choices[index].goldCost ?? 0) * 0.3;
      action = {
        type: 'eventChoice',
        index: strategic
          ? [...choices].sort((a, b) => value(b.index) - value(a.index))[0].index
          : sample(choices).index,
      };
    } else if (state.screen === 'eventResult') action = { type: 'continueEvent' };
    else if (state.screen === 'shop') {
      const shop = state.shop!;
      const best = [...shop.cardIds]
        .filter((id) => !shop.purchased.includes(`card:${id}`))
        .sort((a, b) => cardValue(b) - cardValue(a))[0];
      if (shop.relicId && !shop.purchased.includes('relic') && state.gold >= SHOP_PRICES.relic)
        action = { type: 'buyRelic' };
      else if (
        best &&
        cardValue(best) > 72 &&
        state.gold >= SHOP_PRICES.card &&
        state.deck.length < 16
      )
        action = { type: 'buyCard', cardId: best };
      else action = { type: 'leaveNode' };
    } else throw new Error(`Unhandled screen ${state.screen}`);
    return action;
  };
}

export const chooseRunAction = createRunDriver(true);

/** Simulate exclusively through public actions without changing resources or enemies. */
export function simulateRun(seed: string, strategic = true): RunState {
  let state = createRun(seed);
  const driver = createRunDriver(strategic);
  for (
    let step = 0;
    step < 2000 && state.screen !== 'victory' && state.screen !== 'defeat';
    step++
  ) {
    const action = driver(state);
    const next = reduceRun(state, action);
    if (next === state)
      throw new Error(
        `Policy produced invalid action ${JSON.stringify(action)} at ${state.screen}`,
      );
    state = next;
  }
  return state;
}
