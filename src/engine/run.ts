import { CARD_DEFINITIONS, STARTER_DECK } from '../data/cards';
import { CLASS_DEFINITIONS } from '../data/classes';
import { BOSS_ENEMY_ID, ELITE_ENEMY_IDS, ENCOUNTER_GROUPS } from '../data/enemies';
import { EVENT_DEFINITIONS, EVENT_IDS } from '../data/events';
import { POTION_IDS } from '../data/potions';
import { RELIC_IDS } from '../data/relics';
import type { ClassId, CombatAction } from '../types/game';
import type { MapNode, RunAction, RunReward, RunState } from '../types/run';
import { createCombat, reduceCombat } from './index';
import { getCardPool } from './cardPools';
import type { CardAcquisitionSource } from './cardPools';
import { generateMap } from './map';
import { nextRandom, seedToState, shuffle } from './random';

export const SHOP_PRICES = { card: 55, relic: 120, potion: 35, remove: 60 } as const;

function log(state: RunState, message: string): void {
  state.log.push(message);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

function random(state: RunState): number {
  const result = nextRandom(state.rngState);
  state.rngState = result.state;
  return result.value;
}

function pick<T>(state: RunState, values: readonly T[]): T | undefined {
  if (values.length === 0) return undefined;
  return values[Math.floor(random(state) * values.length)];
}

function cardChoices(state: RunState, source: CardAcquisitionSource): string[] {
  // Preserve the existing seeded, uniform draw without replacement; rarity was display metadata.
  const result = shuffle(getCardPool(state.classId, source), state.rngState);
  state.rngState = result.rngState;
  const choices = result.values.slice(0, 3);
  // Offer both permitted groups in a new-class shop, rather than occasionally hiding one.
  if (state.classId && source === 'shop' && choices.length >= 2) {
    for (const owner of [state.classId, 'colorless']) {
      if (choices.some((id) => CARD_DEFINITIONS[id].classId === owner)) continue;
      const replacement = result.values.find((id) => CARD_DEFINITIONS[id].classId === owner);
      if (replacement) choices[owner === 'colorless' ? choices.length - 1 : 0] = replacement;
    }
  }
  return choices;
}

function availableRelic(state: RunState): string | null {
  return (
    pick(
      state,
      RELIC_IDS.filter((id) => !state.relicIds.includes(id)),
    ) ?? null
  );
}

function addCard(state: RunState, cardId: string): void {
  state.deck.push({ uid: `card-${state.nextCardId++}`, cardId, upgraded: false });
  state.stats.cardsAdded += 1;
  log(state, `「${CARD_DEFINITIONS[cardId].name}」をデッキに加えた。ほいっと〜。`);
}

function returnToMap(state: RunState): void {
  state.screen = 'map';
  state.combat = null;
  state.reward = null;
  state.shop = null;
  state.eventId = null;
}

function finishReward(state: RunState): void {
  if (state.reward?.completesRun) {
    state.screen = 'victory';
    state.reward = null;
    log(state, '第一階層を突破！ 塔主を鎮め、じっと教の教えは次の階層へ。「ほいっと〜！」');
  } else returnToMap(state);
}

/** The exploration state owns persistent resources; combat owns temporary statuses. */
export function createRun(seed = 'IWASON-SPIRE', classId?: ClassId): RunState {
  const normalizedSeed = seed.slice(0, 256).trim() || 'IWASON-SPIRE';
  const profession =
    classId && Object.hasOwn(CLASS_DEFINITIONS, classId) ? CLASS_DEFINITIONS[classId] : undefined;
  const starterDeck = profession?.starterDeck ?? STARTER_DECK;
  const maxHp = profession?.maxHp ?? 80;
  return {
    version: 2,
    seed: normalizedSeed,
    ...(profession ? { classId: profession.id } : {}),
    rngState: seedToState(`${normalizedSeed}:run`),
    screen: 'map',
    floor: 0,
    currentNodeId: null,
    map: generateMap(normalizedSeed),
    visited: [],
    hp: maxHp,
    maxHp,
    gold: 90,
    deck: starterDeck.map((cardId, index) => ({
      uid: `card-${index + 1}`,
      cardId,
      upgraded: false,
    })),
    relicIds: [profession?.starterRelicId ?? 'warm_pebble'],
    potions: ['spring_water', null, null],
    combat: null,
    reward: null,
    shop: null,
    eventId: null,
    nextCardId: starterDeck.length + 1,
    stats: { battlesWon: 0, elitesDefeated: 0, cardsAdded: 0 },
    log: ['岩尊けいと、第一階層へ。「ほいっと〜」。予告と手札を見て、進む道を選ぼう。'],
  };
}

/** Only connected rooms on the next floor can be entered, and only from the map. */
export function getAvailableNodes(state: RunState): MapNode[] {
  if (state.screen !== 'map') return [];
  if (state.currentNodeId === null)
    return state.map.nodes.filter((node) => node.floor === 1 && !state.visited.includes(node.id));
  const current = state.map.nodes.find((node) => node.id === state.currentNodeId);
  if (!current) return [];
  return state.map.nodes.filter(
    (node) => current.connections.includes(node.id) && !state.visited.includes(node.id),
  );
}

export function canChooseEvent(state: RunState, index: number): boolean {
  if (state.screen !== 'event' || !state.eventId || !Number.isInteger(index)) return false;
  const choice = EVENT_DEFINITIONS[state.eventId]?.choices[index];
  if (!choice || state.gold < (choice.goldCost ?? 0) || state.hp <= (choice.hpCost ?? 0))
    return false;
  if (
    choice.effects.some((effect) => effect.type === 'upgrade') &&
    !state.deck.some((card) => !card.upgraded)
  )
    return false;
  if (
    choice.effects.some((effect) => effect.type === 'relic') &&
    RELIC_IDS.every((id) => state.relicIds.includes(id))
  )
    return false;
  if (
    state.classId &&
    choice.effects.some(
      (effect) =>
        effect.type === 'card' && getCardPool(state.classId, 'event', effect.pool).length === 0,
    )
  )
    return false;
  return true;
}

function enterNode(state: RunState, node: MapNode): void {
  state.floor = node.floor;
  state.currentNodeId = node.id;
  state.visited.push(node.id);
  state.combat = null;
  state.reward = null;
  state.shop = null;
  state.eventId = null;
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    let enemyIds: string[];
    if (node.type === 'boss') enemyIds = [BOSS_ENEMY_ID];
    else if (node.type === 'elite') enemyIds = [pick(state, ELITE_ENEMY_IDS)!];
    else {
      const candidates = ENCOUNTER_GROUPS.filter((group) =>
        node.floor === 1
          ? group.length === 1
          : group.length === 2 || (node.floor >= 8 && group.length === 3),
      );
      enemyIds = [...pick(state, candidates)!];
    }
    // Keep the encounter suffix inside the combat seed limit even for a 256-character run seed.
    const battleSeed = `${seedToState(state.seed).toString(36)}:${node.id}:${Math.floor(random(state) * 0x100000000)}`;
    state.combat = createCombat(battleSeed, enemyIds, {
      deck: state.deck,
      hp: state.hp,
      maxHp: state.maxHp,
      relicIds: state.relicIds,
      potions: state.potions,
      ...(state.classId ? { classId: state.classId } : {}),
    });
    state.screen = 'combat';
    log(
      state,
      `${node.floor}階：${node.type === 'boss' ? '塔主' : node.type === 'elite' ? 'エリート' : '敵'}との戦闘。`,
    );
    return;
  }
  if (node.type === 'treasure') {
    const relicId = availableRelic(state);
    state.reward = { cardIds: [], gold: 0, relicId, potionId: null };
    if (relicId) state.screen = 'relic';
    else {
      state.gold += 45;
      log(state, '宝箱から45ゴールドを得た。レリックはすべて持っている。');
      returnToMap(state);
    }
    return;
  }
  if (node.type === 'shop') {
    state.shop = {
      cardIds: cardChoices(state, 'shop'),
      relicId: availableRelic(state),
      potionId: pick(state, POTION_IDS) ?? null,
      purchased: [],
      removed: false,
    };
    state.screen = 'shop';
    return;
  }
  if (node.type === 'event') {
    state.eventId = pick(state, EVENT_IDS)!;
    state.screen = 'event';
    return;
  }
  state.screen = 'rest';
}

function finishCombat(state: RunState): void {
  const combat = state.combat!;
  state.hp = combat.player.hp;
  state.potions = [...(combat.potions ?? state.potions)];
  state.rngState = combat.rngState;
  if (combat.phase === 'player') return;
  if (combat.phase === 'defeat') {
    state.screen = 'defeat';
    log(state, `${state.floor}階で倒れた。「8時か、ねんねやな」。もう一度、違う道を試そう。`);
    return;
  }
  const node = state.map.nodes.find((candidate) => candidate.id === state.currentNodeId)!;
  state.stats.battlesWon += 1;
  if (node.type === 'elite') state.stats.elitesDefeated += 1;
  if (node.type === 'boss' && !state.classId) {
    state.screen = 'victory';
    log(state, '第一階層を突破！ 塔主を鎮め、じっと教の教えは次の階層へ。「ほいっと〜！」');
    return;
  }
  const gold =
    node.type === 'boss'
      ? 75
      : node.type === 'elite'
        ? 40 + Math.floor(random(state) * 16)
        : 18 + Math.floor(random(state) * 13);
  state.gold += gold;
  const reward: RunReward = {
    gold,
    cardIds: cardChoices(state, 'combat'),
    relicId: node.type === 'elite' ? availableRelic(state) : null,
    potionId: null,
    ...(node.type === 'boss' ? { completesRun: true as const } : {}),
  };
  // A bottle is credited at the same atomic transition as gold, never when clicking a reward.
  const potionRoll = random(state);
  const slot = state.potions.indexOf(null);
  if (potionRoll < 0.45 && slot !== -1) {
    reward.potionId = pick(state, POTION_IDS) ?? null;
    state.potions[slot] = reward.potionId;
  }
  state.reward = reward;
  state.screen = 'reward';
  log(state, `戦闘に勝利。${gold}ゴールドを得た。カードを1枚選ぶか、見送ろう。`);
}

function combatAction(state: RunState, action: CombatAction): RunState {
  if (state.screen !== 'combat' || !state.combat || state.combat.phase !== 'player') return state;
  const combat = reduceCombat(state.combat, action);
  if (combat === state.combat) return state;
  const next = structuredClone(state);
  next.combat = combat;
  finishCombat(next);
  return next;
}

/** One immutable action boundary for exploration, combat, rewards, and purchases. */
export function reduceRun(state: RunState, action: RunAction): RunState {
  if (state.screen === 'victory' || state.screen === 'defeat') return state;
  if (action.type === 'combat') return combatAction(state, action.action);
  if (action.type === 'usePotion')
    return combatAction(state, { type: 'usePotion', slot: action.slot, targetId: action.targetId });
  if (action.type === 'chooseNode') {
    const node = getAvailableNodes(state).find((candidate) => candidate.id === action.nodeId);
    if (!node) return state;
    const next = structuredClone(state);
    enterNode(next, node);
    return next;
  }
  if (action.type === 'takeCard') {
    if (
      state.screen !== 'reward' ||
      !state.reward ||
      (action.cardId !== null && !state.reward.cardIds.includes(action.cardId))
    )
      return state;
    const next = structuredClone(state);
    if (action.cardId !== null) addCard(next, action.cardId);
    if (next.reward!.relicId) next.screen = 'relic';
    else finishReward(next);
    return next;
  }
  if (action.type === 'takeRelic') {
    if (
      state.screen !== 'relic' ||
      !state.reward?.relicId ||
      state.relicIds.includes(state.reward.relicId)
    )
      return state;
    const next = structuredClone(state);
    const relicId = next.reward!.relicId!;
    next.relicIds.push(relicId);
    log(next, `新たなレリックを獲得。石に刻まれた力が味方する。`);
    finishReward(next);
    return next;
  }
  if (action.type === 'buyCard') {
    if (
      state.screen !== 'shop' ||
      !state.shop ||
      !state.shop.cardIds.includes(action.cardId) ||
      state.shop.purchased.includes(`card:${action.cardId}`) ||
      state.gold < SHOP_PRICES.card
    )
      return state;
    const next = structuredClone(state);
    next.gold -= SHOP_PRICES.card;
    next.shop!.purchased.push(`card:${action.cardId}`);
    addCard(next, action.cardId);
    return next;
  }
  if (action.type === 'buyRelic') {
    if (
      state.screen !== 'shop' ||
      !state.shop?.relicId ||
      state.shop.purchased.includes('relic') ||
      state.relicIds.includes(state.shop.relicId) ||
      state.gold < SHOP_PRICES.relic
    )
      return state;
    const next = structuredClone(state);
    next.gold -= SHOP_PRICES.relic;
    next.relicIds.push(next.shop!.relicId!);
    next.shop!.purchased.push('relic');
    return next;
  }
  if (action.type === 'buyPotion') {
    if (
      state.screen !== 'shop' ||
      !state.shop?.potionId ||
      state.shop.purchased.includes('potion') ||
      state.gold < SHOP_PRICES.potion ||
      !state.potions.includes(null)
    )
      return state;
    const next = structuredClone(state);
    next.gold -= SHOP_PRICES.potion;
    next.potions[next.potions.indexOf(null)] = next.shop!.potionId;
    next.shop!.purchased.push('potion');
    return next;
  }
  if (action.type === 'removeCard') {
    if (
      state.screen !== 'shop' ||
      !state.shop ||
      state.shop.removed ||
      state.gold < SHOP_PRICES.remove ||
      state.deck.length <= 5 ||
      !state.deck.some((card) => card.uid === action.cardUid)
    )
      return state;
    const next = structuredClone(state);
    next.gold -= SHOP_PRICES.remove;
    next.deck = next.deck.filter((card) => card.uid !== action.cardUid);
    next.shop!.removed = true;
    next.shop!.purchased.push('remove');
    log(next, '石札を1枚手放した。必要な教えが、早く手元に届く。');
    return next;
  }
  if (action.type === 'rest') {
    if (state.screen !== 'rest' || !['heal', 'upgrade'].includes(action.choice)) return state;
    if (action.choice === 'upgrade' && !state.deck.some((card) => !card.upgraded)) return state;
    const next = structuredClone(state);
    if (action.choice === 'upgrade') next.screen = 'upgrade';
    else {
      const healed = Math.min(next.maxHp - next.hp, Math.ceil(next.maxHp * 0.3));
      next.hp += healed;
      log(next, `休憩してHPを${healed}回復。「朝活しよ」。`);
      returnToMap(next);
    }
    return next;
  }
  if (action.type === 'upgradeCard') {
    if (
      state.screen !== 'upgrade' ||
      !state.deck.some((card) => card.uid === action.cardUid && !card.upgraded)
    )
      return state;
    const next = structuredClone(state);
    const card = next.deck.find((candidate) => candidate.uid === action.cardUid)!;
    card.upgraded = true;
    log(next, `「${CARD_DEFINITIONS[card.cardId].name}」を強化した。`);
    returnToMap(next);
    return next;
  }
  if (action.type === 'eventChoice') {
    if (!canChooseEvent(state, action.index)) return state;
    const next = structuredClone(state);
    const event = EVENT_DEFINITIONS[next.eventId!];
    const choice = event.choices[action.index];
    next.hp -= choice.hpCost ?? 0;
    next.gold -= choice.goldCost ?? 0;
    for (const effect of choice.effects) {
      if (effect.type === 'heal') next.hp = Math.min(next.maxHp, next.hp + effect.amount);
      else if (effect.type === 'gold') next.gold += effect.amount;
      else if (effect.type === 'card') {
        const cardId = next.classId
          ? pick(next, getCardPool(next.classId, 'event', effect.pool))
          : effect.cardId;
        if (cardId) addCard(next, cardId);
      } else if (effect.type === 'upgrade') {
        const card = pick(
          next,
          next.deck.filter((candidate) => !candidate.upgraded),
        );
        if (card) card.upgraded = true;
      } else if (effect.type === 'relic') {
        const relicId = availableRelic(next);
        if (relicId) next.relicIds.push(relicId);
      }
    }
    const description = next.classId
      ? (choice.classDescription ?? choice.description)
      : choice.description;
    log(next, `${event.title}：${choice.label}。${description}`);
    returnToMap(next);
    return next;
  }
  if (action.type === 'leaveNode') {
    if (state.screen !== 'shop' && state.screen !== 'upgrade') return state;
    const next = structuredClone(state);
    if (next.screen === 'upgrade') next.screen = 'rest';
    else returnToMap(next);
    return next;
  }
  return state;
}
