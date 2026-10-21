import { CARD_DEFINITIONS, STARTER_DECK } from '../data/cards';
import { DEFAULT_ENEMY_ID, getEnemyDefinition } from '../data/enemies';
import { POTION_DEFINITIONS } from '../data/potions';
import type { CardInstance, CombatAction, CombatOptions, CombatState } from '../types/game';
import { drawInto } from './actions/draw';
import { getPendingChoiceCards } from './actions/choices';
import { appendLog, applyGauge, gainBlock } from './combat/state';
import { resolveEndTurn } from './combat/turn';
import { findEnemy, getEnemies, getEnemyKey, normalizeInto } from './combat/targets';
import { beforeCardRelics, relicPassiveAmount, triggerRelics } from './combat/relics';
import { getRelicCardPlayLimit, getRelicXBonus } from './combat/relicModifiers';
import { recordCardPlay, recordDiscard } from './combat/cardMetrics';
import { meetsEffectCondition } from './combat/values';
import { triggerCardPowers } from './combat/cardPowers';
import { resolveEffects } from './effects/resolve';
import { createClassResources } from './combat/resources';
import { reactToPlayerCard } from './combat/enemyAI';
import { seedToState, shuffle } from './random';
import { emitCombatCue, inheritCombatTrace, withCombatTraceContext } from '../presentation/trace';

export { calculateDamage } from './combat/damage';
export { predictEnemyDamage } from './combat/turn';
export { drawCards } from './actions/draw';
export { getEnemies, getEnemyKey, normalizeCombatState } from './combat/targets';

/** Unknown enemies, empty patterns/groups, and invalid initial HP throw RangeError. */
export function createCombat(
  seed = 'IWASON-SPIRE',
  enemyId: string | string[] = DEFAULT_ENEMY_ID,
  options: CombatOptions = {},
): CombatState {
  const ids = typeof enemyId === 'string' ? [enemyId] : enemyId;
  if (ids.length < 1 || ids.length > 3) throw new RangeError('敵の数は1〜3体です。');
  const enemies = ids.map((id, index) => {
    const definition = getEnemyDefinition(id);
    if (!definition || definition.intents.length === 0)
      throw new RangeError(`敵「${id}」の定義または行動パターンがありません。`);
    const { id: actorId, name, hp, maxHp, block, strength, weak, vulnerable, poison } = definition;
    const actor = { id: actorId, name, hp, maxHp, block, strength, weak, vulnerable, poison };
    const { intents } = definition;
    return {
      ...actor,
      intentIndex: 0,
      intent: { ...intents[0] },
      ...(ids.length > 1 ? { instanceId: `${id}-${index}` } : {}),
    };
  });
  if (options.initialEnergyBonus !== undefined && (!Number.isSafeInteger(options.initialEnergyBonus) || options.initialEnergyBonus < 0)) throw new RangeError('開始エナジーの補正が不正です。');
  const maxHp = options.maxHp ?? 80;
  const hp = Math.min(maxHp, options.hp ?? maxHp);
  if (!Number.isSafeInteger(maxHp) || maxHp <= 0 || !Number.isSafeInteger(hp) || hp <= 0)
    throw new RangeError('開始HPが不正です。');
  const normalizedSeed = seed.slice(0, 256) || 'IWASON-SPIRE';
  const deck = options.deck
    ? options.deck.map((card) => ({ ...card }))
    : STARTER_DECK.map((cardId, index) => ({
        uid: `card-${index + 1}`,
        cardId,
        upgraded: false,
      }));
  const shuffled = shuffle(
    deck.map((card) => ({ ...card })),
    seedToState(normalizedSeed),
  );
  // Innate is a catalog flag, not a card-specific rule; drawPile draws from its end.
  shuffled.values.sort(
    (left, right) =>
      Number(Boolean(left.upgraded ? CARD_DEFINITIONS[left.cardId]?.upgradedInnate ?? CARD_DEFINITIONS[left.cardId]?.innate : CARD_DEFINITIONS[left.cardId]?.innate)) -
      Number(Boolean(right.upgraded ? CARD_DEFINITIONS[right.cardId]?.upgradedInnate ?? CARD_DEFINITIONS[right.cardId]?.innate : CARD_DEFINITIONS[right.cardId]?.innate)),
  );
  const state: CombatState = {
    version: 1,
    ...(options.encounterType ? { encounterType: options.encounterType } : {}),
    seed: normalizedSeed,
    rngState: shuffled.rngState,
    turn: 1,
    phase: 'player',
    player: {
      id: 'iwason_keito',
      name: '岩尊けいと',
      hp,
      maxHp,
      block: 0,
      strength: 0,
      weak: 0,
      vulnerable: 0,
      poison: 0,
    },
    enemy: enemies[0],
    ...(enemies.length > 1 ? { enemies, selectedEnemyId: getEnemyKey(enemies[0]) } : {}),
    energy: 3 + (options.initialEnergyBonus ?? 0),
    maxEnergy: 3,
    jitto: 0,
    deck,
    hand: [],
    drawPile: shuffled.values,
    discardPile: [],
    exhaustPile: [],
    powers: [],
    stillness: 0,
    cardsPlayedThisTurn: 0,
    stats: { cardsPlayed: 0, damageDealt: 0 },
    log: [],
    events: [],
    nextId: 1,
    ...(options.classId ? { classId: options.classId, classResources: createClassResources() } : {}),
    ...(options.relicState ? { relicState: { ...options.relicState } } : {}),
    ...(options.relicIds ? { relicIds: [...new Set(options.relicIds)], relicCounters: {} } : {}),
    ...(options.potions
      ? { potions: [...options.potions.slice(0, 20), null, null, null].slice(0, Math.min(20, Math.max(3, options.potions.length))) }
      : {}),
  };
  appendLog(
    state,
    `岩尊けいと、入塔。「ほいっと〜」 ${enemies.map((enemy) => enemy.name).join('・')}が立ちはだかる。`,
  );
  triggerRelics(state, 'combatStart');
  triggerRelics(state, 'turnStart');
  drawInto(state, Math.max(0, 5 + relicPassiveAmount(state, 'initialDrawAdjustment')));
  triggerRelics(state, 'firstHand');
  return state;
}

export function getCardCost(card: CardInstance, state?: CombatState): number {
  const definition = CARD_DEFINITIONS[card.cardId];
  if (definition?.unplayable) return Infinity;
  if (definition?.xCost) return state?.energy ?? 0;
  return definition
    ? card.upgraded
      ? (definition.upgradedCost ?? definition.cost)
      : definition.cost
    : Infinity;
}

/** All state changes pass through reduceCombat; the supplied state is never mutated. */
export function canPlayCard(state: CombatState, cardUid: string, targetId?: string): boolean {
  if (
    state.phase !== 'player' ||
    state.cardsPlayedThisTurn >= getRelicCardPlayLimit(state) ||
    state.pendingChoice ||
    (targetId !== undefined && !findEnemy(state, targetId))
  )
    return false;
  const card = state.hand.find((instance) => instance.uid === cardUid);
  if (!card || !Object.hasOwn(CARD_DEFINITIONS, card.cardId)) return false;
  const condition = CARD_DEFINITIONS[card.cardId].playCondition;
  if (condition && !meetsEffectCondition(state, condition, findEnemy(state, targetId))) return false;
  return state.energy >= getCardCost(card, state);
}

function settlePlayedCard(state: CombatState, card: CardInstance): void {
  if (state.relicCounters) delete state.relicCounters[`attack-multiplier:${card.uid}`];
  const definition = CARD_DEFINITIONS[card.cardId];
  if (definition.type === 'attack' && state.vigor) { state.vigor = 0; emitCombatCue(state, { kind: 'status', targetId: 'player', status: 'vigor', amount: 0, label: '活力を消費' }); }
  let toZone: 'powers' | 'exhaustPile' | 'discardPile' | 'drawPile';
  if (state.cardReturnTargets?.[card.uid] === 'drawPile') {
    state.drawPile.push(card); toZone = 'drawPile';
    delete state.cardReturnTargets[card.uid];
    if (!Object.keys(state.cardReturnTargets).length) delete state.cardReturnTargets;
  } else if (definition.type === 'power') {
    state.powers.push(card);
    toZone = 'powers';
  } else if (card.upgraded ? definition.upgradedExhaust ?? definition.exhaust : definition.exhaust) {
    state.exhaustPile.push(card);
    toZone = 'exhaustPile';
  } else {
    state.discardPile.push(card);
    toZone = 'discardPile';
  }
  emitCombatCue(state, { kind: toZone === 'exhaustPile' ? 'exhaust' : toZone === 'powers' ? 'power' : 'discard', sourceId: 'player', card, cards: [card], fromZone: 'played', toZone });
  if (toZone === 'exhaustPile') triggerRelics(state, 'cardExhausted', { card });
}

function potionRelevantState(state: CombatState): string {
  return JSON.stringify([
    state.player,
    getEnemies(state),
    state.energy,
    state.jitto,
    state.hand,
    state.drawPile,
    state.discardPile,
    state.stillness,
    state.powerStacks,
    state.rngState,
    state.phase,
  ]);
}

export function reduceCombat(state: CombatState, action: CombatAction): CombatState {
  if (state.phase !== 'player') return state;
  if (!['playCard', 'endTurn', 'selectEnemy', 'usePotion', 'chooseCards'].includes(action.type))
    return state;
  if (state.pendingChoice && action.type !== 'chooseCards' && action.type !== 'selectEnemy')
    return state;
  if (action.type === 'chooseCards') {
    const choice = state.pendingChoice;
    if (
      !choice ||
      !Array.isArray(action.cardIds) ||
      action.cardIds.length !== choice.amount ||
      new Set(action.cardIds).size !== choice.amount ||
      action.cardIds.some((uid) => !getPendingChoiceCards(state).some((card) => card.uid === uid))
    )
      return state;
  }
  if (action.type === 'playCard' && !canPlayCard(state, action.cardId, action.targetId))
    return state;
  if (action.type === 'selectEnemy' && !findEnemy(state, action.targetId)) return state;
  if (action.type === 'usePotion') {
    const id = state.potions?.[action.slot];
    if (
      !Number.isSafeInteger(action.slot) ||
      action.slot < 0 ||
      !id ||
      !Object.hasOwn(POTION_DEFINITIONS, id) ||
      (action.targetId !== undefined && !findEnemy(state, action.targetId))
    )
      return state;
  }

  const next = structuredClone(state);
  inheritCombatTrace(state, next);
  normalizeInto(next);
  next.events = [];
  if (action.type === 'selectEnemy') {
    next.selectedEnemyId = action.targetId;
    return next;
  }
  if (action.type === 'chooseCards') {
    const choice = next.pendingChoice!;
    const chosen = new Set(action.cardIds);
    const sourceZone = choice.sourceZone ?? 'hand';
    const chosenCards = next[sourceZone].filter((card) => chosen.has(card.uid));
    const toZone = choice.mode === 'topdeck' ? 'drawPile' : choice.mode === 'retrieve' ? 'hand' : choice.mode === 'discard' ? 'discardPile' : 'exhaustPile';
    next[sourceZone] = next[sourceZone].filter((card) => !chosen.has(card.uid));
    next[toZone].push(...chosenCards);
    delete next.pendingChoice;
    emitCombatCue(next, { kind: choice.mode === 'retrieve' ? 'draw' : choice.mode === 'exhaust' ? 'exhaust' : 'discard', sourceId: 'player', cards: chosenCards, fromZone: sourceZone, toZone });
    if (choice.mode === 'exhaust' || choice.mode === 'discard') for (const card of chosenCards) triggerRelics(next, choice.mode === 'exhaust' ? 'cardExhausted' : 'cardDiscarded', { card });
    if (choice.mode === 'discard') recordDiscard(next, chosenCards.length);
    appendLog(
      next,
      `${action.cardIds.length}枚を${choice.mode === 'topdeck' ? '山札の一番上に置いた' : choice.mode === 'retrieve' ? '手札に戻した' : choice.mode === 'discard' ? '捨て札にした' : '廃棄した'}。`,
    );
    resolveEffects(next, choice.resume.effects, { defense: choice.resume.defense }, choice.resume);
    if (!next.pendingChoice && choice.resume.sourceCard)
      settlePlayedCard(next, choice.resume.sourceCard);
    if (next.phase === 'victory') triggerRelics(next, 'victory');
    normalizeInto(next);
    return next;
  }
  if (action.type === 'endTurn') {
    resolveEndTurn(next);
    if (next.phase === 'victory') triggerRelics(next, 'victory');
    return next;
  }
  const targetId = action.targetId ?? (findEnemy(next) && getEnemyKey(findEnemy(next)!));
  if (targetId) next.selectedEnemyId = targetId;
  if (action.type === 'usePotion') {
    const definition = POTION_DEFINITIONS[next.potions![action.slot]!];
    if (
      definition.effects.length === 0 ||
      (definition.target !== 'player' && !findEnemy(next, targetId))
    )
      return state;
    const before = potionRelevantState(next);
    resolveEffects(
      next,
      definition.effects,
      { defense: false },
      { targetId, all: definition.target === 'allEnemies', source: 'potion' },
    );
    if (before === potionRelevantState(next)) return state;
    next.potions![action.slot] = null;
    triggerRelics(next, 'potionUsed');
    appendLog(next, `ポーション「${definition.name}」を使用。`);
    if (next.phase === 'victory') triggerRelics(next, 'victory');
    normalizeInto(next);
    return next;
  }

  // action.cardId is the unique card instance UID, not a catalog content ID.
  const index = next.hand.findIndex((card) => card.uid === action.cardId);
  const [card] = next.hand.splice(index, 1);
  const definition = CARD_DEFINITIONS[card.cardId];
  const paidEnergy = getCardCost(card, next);
  next.energy -= paidEnergy;
  next.cardsPlayedThisTurn += 1;
  next.stats.cardsPlayed += 1;
  recordCardPlay(next, card, paidEnergy);
  beforeCardRelics(next, card);
  appendLog(next, `「${definition.name}${card.upgraded ? '+' : ''}」を使用。`);
  emitCombatCue(next, { kind: 'cardPlay', sourceId: 'player', targetId, card, fromZone: 'hand', toZone: 'played', label: definition.name });
  withCombatTraceContext(next, { sourceId: 'player', card }, () => {
    reactToPlayerCard(next, definition.type);
    if (definition.type === 'attack' && next.relicIds?.length) { next.relicCounters ??= {}; const key = `attacks-turn:${next.turn}`; next.relicCounters[key] = (next.relicCounters[key] ?? 0) + 1; }
    triggerRelics(next, 'cardPlayed', { card, amount: paidEnergy });
    triggerCardPowers(next, card);
    if (definition.type === 'attack') {
      triggerRelics(next, 'firstAttack');
      if (next.powerStacks?.blockOnAttack) gainBlock(next, 'player', next.powerStacks.blockOnAttack);
    }
    resolveEffects(
      next,
      card.upgraded ? definition.upgradedEffects : definition.effects,
      definition,
      { targetId, sourceCard: card, xEnergy: paidEnergy + (definition.xCost ? getRelicXBonus(next) : 0) },
    );
  });
  if (!next.pendingChoice) settlePlayedCard(next, card);
  if (next.phase === 'victory') triggerRelics(next, 'victory');
  normalizeInto(next);
  return next;
}

/** Public utility is immutable, like the reducer. This never grants passive gauge. */
export function changeGauge(state: CombatState, delta: number): CombatState {
  const next = structuredClone(state);
  inheritCombatTrace(state, next);
  normalizeInto(next);
  applyGauge(next, delta);
  return next;
}

export function isDeified(state: CombatState): boolean {
  return state.jitto === 100;
}
export function upgradeCard(card: CardInstance): CardInstance {
  return { ...card, upgraded: !CARD_DEFINITIONS[card.cardId]?.unupgradable || card.upgraded };
}
