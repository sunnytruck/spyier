import { CARD_DEFINITIONS, STARTER_DECK } from '../data/cards';
import { DEFAULT_ENEMY_ID, getEnemyDefinition } from '../data/enemies';
import { POTION_DEFINITIONS } from '../data/potions';
import type { CardInstance, CombatAction, CombatOptions, CombatState } from '../types/game';
import { drawInto } from './actions/draw';
import { appendLog, applyGauge, gainBlock } from './combat/state';
import { resolveEndTurn } from './combat/turn';
import { findEnemy, getEnemies, getEnemyKey, normalizeInto } from './combat/targets';
import { triggerRelics } from './combat/relics';
import { resolveEffects } from './effects/resolve';
import { seedToState, shuffle } from './random';

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
    const { intents, ...actor } = definition;
    return {
      ...actor,
      intentIndex: 0,
      intent: { ...intents[0] },
      ...(ids.length > 1 ? { instanceId: `${id}-${index}` } : {}),
    };
  });
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
  const state: CombatState = {
    version: 1,
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
    energy: 3,
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
    ...(options.relicIds ? { relicIds: [...new Set(options.relicIds)], relicCounters: {} } : {}),
    ...(options.potions
      ? { potions: [...options.potions.slice(0, 3), null, null, null].slice(0, 3) }
      : {}),
  };
  appendLog(
    state,
    `岩尊けいと、入塔。「ほいっと〜」 ${enemies.map((enemy) => enemy.name).join('・')}が立ちはだかる。`,
  );
  triggerRelics(state, 'combatStart');
  triggerRelics(state, 'turnStart');
  drawInto(state, 5);
  return state;
}

export function getCardCost(card: CardInstance): number {
  const definition = CARD_DEFINITIONS[card.cardId];
  return definition
    ? card.upgraded
      ? (definition.upgradedCost ?? definition.cost)
      : definition.cost
    : Infinity;
}

/** All state changes pass through reduceCombat; the supplied state is never mutated. */
export function canPlayCard(state: CombatState, cardUid: string, targetId?: string): boolean {
  if (state.phase !== 'player' || (targetId !== undefined && !findEnemy(state, targetId)))
    return false;
  const card = state.hand.find((instance) => instance.uid === cardUid);
  if (!card || !Object.hasOwn(CARD_DEFINITIONS, card.cardId)) return false;
  return state.energy >= getCardCost(card);
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
  if (!['playCard', 'endTurn', 'selectEnemy', 'usePotion'].includes(action.type)) return state;
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
  normalizeInto(next);
  next.events = [];
  if (action.type === 'selectEnemy') {
    next.selectedEnemyId = action.targetId;
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
      { targetId, all: definition.target === 'allEnemies' },
    );
    if (before === potionRelevantState(next)) return state;
    next.potions![action.slot] = null;
    appendLog(next, `ポーション「${definition.name}」を使用。`);
    if (next.phase === 'victory') triggerRelics(next, 'victory');
    normalizeInto(next);
    return next;
  }

  // action.cardId is the unique card instance UID, not a catalog content ID.
  const index = next.hand.findIndex((card) => card.uid === action.cardId);
  const [card] = next.hand.splice(index, 1);
  const definition = CARD_DEFINITIONS[card.cardId];
  next.energy -= getCardCost(card);
  next.cardsPlayedThisTurn += 1;
  next.stats.cardsPlayed += 1;
  appendLog(next, `「${definition.name}${card.upgraded ? '+' : ''}」を使用。`);
  if (definition.type === 'attack') {
    triggerRelics(next, 'firstAttack');
    if (next.powerStacks?.blockOnAttack) gainBlock(next, 'player', next.powerStacks.blockOnAttack);
  }
  resolveEffects(
    next,
    card.upgraded ? definition.upgradedEffects : definition.effects,
    definition,
    { targetId },
  );
  if (definition.type === 'power') next.powers.push(card);
  else if (definition.exhaust) next.exhaustPile.push(card);
  else next.discardPile.push(card);
  if (next.phase === 'victory') triggerRelics(next, 'victory');
  normalizeInto(next);
  return next;
}

/** Public utility is immutable, like the reducer. This never grants passive gauge. */
export function changeGauge(state: CombatState, delta: number): CombatState {
  const next = structuredClone(state);
  normalizeInto(next);
  applyGauge(next, delta);
  return next;
}

export function isDeified(state: CombatState): boolean {
  return state.jitto === 100;
}
export function upgradeCard(card: CardInstance): CardInstance {
  return { ...card, upgraded: true };
}
