import { CARD_DEFINITIONS, STARTER_DECK } from '../data/cards';
import { CLASS_DEFINITIONS } from '../data/classes';
import { ENEMY_DEFINITIONS, getEncounterGroupsForFloor } from '../data/enemies';
import { EVENT_DEFINITIONS, EVENT_IDS } from '../data/events';
import { POTION_IDS } from '../data/potions';
import { eligibleRelicIds, RELIC_DEFINITIONS } from '../data/relics';
import type { CardInstance, ClassId, CombatAction } from '../types/game';
import type { EventResult, MapNode, RunAction, RunReward, RunState } from '../types/run';
import { createCombat, reduceCombat } from './index';
import { getCardPool } from './cardPools';
import type { CardAcquisitionSource } from './cardPools';
import { generateMap } from './map';
import { nextRandom, seedToState, shuffle } from './random';
import { newShopCardPrice, sampleCardRewards } from './rewards';

export const SHOP_PRICES = { card: 55, relic: 120, potion: 35, remove: 60 } as const;

export function getShopCardPrice(state: Pick<RunState, 'shop'>, cardId: string): number {
  return state.shop?.cardPrices?.[cardId] ?? SHOP_PRICES.card;
}

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
  if (state.rewardRules === 'rarity-v1' && state.classId) {
    const pool = getCardPool(state.classId, source);
    const nodeType = state.map.nodes.find((node) => node.id === state.currentNodeId)?.type;
    const tier = source === 'shop' ? 'shop' : nodeType === 'boss' ? 'boss' : nodeType === 'elite' ? 'elite' : 'battle';
    const ownPool = source === 'shop' ? pool.filter((id) => CARD_DEFINITIONS[id].classId === state.classId) : pool;
    const drawn = sampleCardRewards(ownPool, state.rngState, tier, source === 'shop' ? 2 : 3);
    state.rngState = drawn.rngState;
    if (source === 'shop') {
      const commonPool = pool.filter((id) => CARD_DEFINITIONS[id].classId === 'colorless');
      const colorless = sampleCardRewards(commonPool, state.rngState, 'shop', 1, drawn.cardIds);
      state.rngState = colorless.rngState;
      drawn.cardIds.push(...colorless.cardIds);
    }
    return drawn.cardIds;
  }
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
      eligibleRelicIds(state.classId).filter((id) => !state.relicIds.includes(id)),
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
  state.eventResult = null;
  state.eventCombat = null;
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
    ...(profession ? { classId: profession.id, rewardRules: 'rarity-v1' as const } : {}),
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
    eventHistory: [],
    eventResult: null,
    eventCombat: null,
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
  const event = EVENT_DEFINITIONS[state.eventId];
  if (event?.classIds && (!state.classId || !event.classIds.includes(state.classId))) return false;
  if (!choice || state.gold < (choice.goldCost ?? 0) || state.hp <= (choice.hpCost ?? 0))
    return false;
  if (
    choice.effects.some((effect) => effect.type === 'upgrade') &&
    !state.deck.some(canUpgradeRunCard)
  )
    return false;
  if (
    choice.effects.some((effect) => effect.type === 'relic') &&
    eligibleRelicIds(state.classId).every((id) => state.relicIds.includes(id))
  )
    return false;
  if (
    state.classId &&
    choice.effects.some(
      (effect) =>
        effect.type === 'card' && !effect.fixed && getCardPool(state.classId, 'event', effect.pool).length === 0,
    )
  )
    return false;
  if (choice.effects.some((effect) => effect.type === 'card' && effect.fixed && !CARD_DEFINITIONS[effect.cardId])) return false;
  const removals = choice.effects.reduce((count, effect) => count + (effect.type === 'remove' ? effect.amount : 0), 0);
  if (removals > 0 && state.deck.length - removals < 5) return false;
  if (choice.effects.some((effect) => effect.type === 'potion') && !state.potions.includes(null)) return false;
  if (choice.effects.some((effect) => effect.type === 'battle' && effect.enemyIds.some((id) => !ENEMY_DEFINITIONS[id]))) return false;
  return true;
}

function canUpgradeRunCard(card: CardInstance): boolean {
  const definition = CARD_DEFINITIONS[card.cardId];
  return !!definition && !card.upgraded && !definition.unupgradable;
}

/** Recent rooms are excluded, and class encounters cannot leak into another profession. */
export function eligibleEventIds(state: Pick<RunState, 'classId' | 'eventHistory'>): string[] {
  const eligible = EVENT_IDS.filter((id) => {
    const classes = EVENT_DEFINITIONS[id].classIds;
    return !classes || (state.classId !== undefined && classes.includes(state.classId));
  });
  const recent = new Set((state.eventHistory ?? []).slice(-3));
  const fresh = eligible.filter((id) => !recent.has(id));
  return fresh.length ? fresh : eligible;
}

export interface EventUpgradePreview {
  upgrades: { before: CardInstance; after: CardInstance }[];
}

/**
 * Pure diagnostic helper retained for existing integrations and tests. Gameplay
 * random upgrades commit immediately through eventChoice; the UI does not preview them.
 */
export function previewRunEventChoice(state: RunState, index: number): EventUpgradePreview | null {
  if (!canChooseEvent(state, index)) return null;
  const choice = EVENT_DEFINITIONS[state.eventId!].choices[index];
  if (!choice.effects.some((effect) => effect.type === 'upgrade')) return null;
  const result = reduceRun(state, { type: 'eventChoice', index });
  if (result === state) return null;
  const upgrades = state.deck.flatMap((before) => {
    const after = result.deck.find((card) => card.uid === before.uid);
    return !before.upgraded && after?.upgraded
      ? [{ before: { ...before }, after: { ...after } }]
      : [];
  });
  return upgrades.length ? { upgrades } : null;
}

function enterNode(state: RunState, node: MapNode): void {
  state.floor = node.floor;
  state.currentNodeId = node.id;
  state.visited.push(node.id);
  state.combat = null;
  state.reward = null;
  state.shop = null;
  state.eventId = null;
  state.eventResult = null;
  state.eventCombat = null;
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    const enemyIds = [...pick(state, getEncounterGroupsForFloor(node.floor, node.type === 'battle' ? 'combat' : node.type))!];
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
    const cardIds = cardChoices(state, 'shop');
    state.shop = {
      cardIds,
      ...(state.rewardRules === 'rarity-v1' ? { cardPrices: Object.fromEntries(cardIds.map((id) => [id, newShopCardPrice(id)])) } : {}),
      relicId: availableRelic(state),
      potionId: pick(state, POTION_IDS) ?? null,
      purchased: [],
      removed: false,
    };
    state.screen = 'shop';
    return;
  }
  if (node.type === 'event') {
    state.eventId = pick(state, eligibleEventIds(state))!;
    state.eventHistory = [...(state.eventHistory ?? []), state.eventId].slice(-12);
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
    (node.type === 'boss'
      ? 75
      : node.type === 'elite'
        ? 40 + Math.floor(random(state) * 16)
        : 18 + Math.floor(random(state) * 13)) + (state.eventCombat?.bonusGold ?? 0);
  state.gold += gold;
  const reward: RunReward = {
    gold,
    cardIds: cardChoices(state, 'combat'),
    relicId: node.type === 'elite' || state.eventCombat?.relicOnVictory ? availableRelic(state) : null,
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
      state.gold < getShopCardPrice(state, action.cardId)
    )
      return state;
    const next = structuredClone(state);
    next.gold -= getShopCardPrice(state, action.cardId);
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
    if (action.choice === 'upgrade' && !state.deck.some(canUpgradeRunCard)) return state;
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
      !state.deck.some((card) => card.uid === action.cardUid && canUpgradeRunCard(card))
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
        const cardId = next.classId && !effect.fixed
          ? pick(next, getCardPool(next.classId, 'event', effect.pool))
          : effect.cardId;
        if (cardId) addCard(next, cardId);
      } else if (effect.type === 'upgrade') {
        const card = pick(
          next,
          next.deck.filter(canUpgradeRunCard),
        );
        if (card) card.upgraded = true;
      } else if (effect.type === 'relic') {
        const relicId = availableRelic(next);
        if (relicId) next.relicIds.push(relicId);
      } else if (effect.type === 'remove') {
        for (let count = 0; count < effect.amount; count++) {
          const card = pick(next, next.deck)!;
          next.deck = next.deck.filter((candidate) => candidate.uid !== card.uid);
        }
      } else if (effect.type === 'maxHp') {
        next.maxHp += effect.amount;
      } else if (effect.type === 'potion') {
        next.potions[next.potions.indexOf(null)] = pick(next, POTION_IDS)!;
      }
    }
    const description = next.classId
      ? (choice.classDescription ?? choice.description)
      : choice.description;
    log(next, `${event.title}：${choice.label}。${description}`);
    const battle = choice.effects.find((effect) => effect.type === 'battle');
    const upgradedCards = next.deck.filter((card) => card.upgraded && state.deck.some((before) => before.uid === card.uid && !before.upgraded));
    const addedCards = next.deck.filter((card) => !state.deck.some((before) => before.uid === card.uid));
    const removedCards = state.deck.filter((card) => !next.deck.some((after) => after.uid === card.uid));
    const relicIds = next.relicIds.filter((id) => !state.relicIds.includes(id));
    const potionIds = next.potions.filter((id, index): id is string => id !== null && id !== state.potions[index]);
    const hpChange = next.hp - state.hp;
    const goldChange = next.gold - state.gold;
    const outcome = [
      ...(hpChange ? [`HP ${hpChange > 0 ? '+' : ''}${hpChange}。`] : []),
      ...(goldChange ? [`ゴールド ${goldChange > 0 ? '+' : ''}${goldChange}。`] : []),
      ...(next.maxHp !== state.maxHp ? [`最大HP +${next.maxHp - state.maxHp}。`] : []),
      ...upgradedCards.map((card) => `「${CARD_DEFINITIONS[card.cardId].name}＋」に強化した。`),
      ...addedCards.map((card) => `「${CARD_DEFINITIONS[card.cardId].name}」を得た。`),
      ...removedCards.map((card) => `「${CARD_DEFINITIONS[card.cardId].name}」を削除した。`),
      ...relicIds.map((id) => `「${RELIC_DEFINITIONS[id].name}」を得た。`),
      ...(potionIds.length ? ['ポーションを1個得た。'] : []),
      ...(battle ? [`${battle.enemyIds.map((id) => ENEMY_DEFINITIONS[id].name).join('・')}との戦闘に進む。勝利時の追加報酬：${battle.bonusGold}ゴールド${battle.relicOnVictory ? 'と未所持レリック1個（候補がある場合）' : ''}。`] : []),
    ];
    const result: EventResult = {
      eventId: event.id, choiceIndex: action.index, choiceLabel: choice.label,
      description: outcome.join('\n') || '何も受け取らず、先へ進むことにした。',
      hpChange, goldChange,
      upgradedCards: structuredClone(upgradedCards),
      addedCards: structuredClone(addedCards),
      removedCards: structuredClone(removedCards),
      relicIds, potionIds,
      ...(battle ? { combatEnemyIds: [...battle.enemyIds], combatReward: { gold: battle.bonusGold, relic: battle.relicOnVictory } } : {}),
    };
    next.eventResult = result;
    next.screen = 'eventResult';
    return next;
  }
  if (action.type === 'continueEvent') {
    if (state.screen !== 'eventResult' || !state.eventResult) return state;
    const next = structuredClone(state);
    const result = next.eventResult!;
    if (result.combatEnemyIds) {
      const battleSeed = `${seedToState(next.seed).toString(36)}:${next.currentNodeId}:event:${Math.floor(random(next) * 0x100000000)}`;
      next.eventCombat = {
        eventId: result.eventId,
        bonusGold: result.combatReward?.gold ?? 0,
        relicOnVictory: result.combatReward?.relic ?? false,
      };
      next.combat = createCombat(battleSeed, result.combatEnemyIds, {
        deck: next.deck, hp: next.hp, maxHp: next.maxHp, relicIds: next.relicIds, potions: next.potions,
        ...(next.classId ? { classId: next.classId } : {}),
      });
      next.eventResult = null;
      next.screen = 'combat';
      log(next, `${EVENT_DEFINITIONS[result.eventId].title}：試練の戦闘が始まった。`);
    } else returnToMap(next);
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
