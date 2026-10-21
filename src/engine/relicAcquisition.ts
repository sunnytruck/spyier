import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import { activeRelicIds, RELIC_DEFINITIONS, replaceStarterRelic } from '../data/relics';
import type { CardInstance } from '../types/game';
import type { RelicAcquireOperation, RelicAcquisitionAction, RelicAcquisitionReceipt, RelicAcquisitionRun, RelicAcquisitionState } from '../types/relics';
import { getCardPool } from './cardPools';
import { nextRandom, seedToState, shuffle } from './random';

const operations = (id: string): RelicAcquireOperation[] => RELIC_DEFINITIONS[id]?.runEffect?.acquire ?? [];
const upgradeable = (card: CardInstance): boolean => !card.upgraded && !CARD_DEFINITIONS[card.cardId]?.unupgradable;
const basicKind = (card: CardInstance, kind: 'strike' | 'guard'): boolean =>
  CLASS_IDS.some((id) => card.cardId === `${id}_${kind}`) || card.cardId === (kind === 'strike' ? 'stone_strike' : 'still_guard');
const counters = (state: RelicAcquisitionRun) => state.relicState ??= {};
const effects = (state: RelicAcquisitionRun) => state.relicIds.map((id) => [id, RELIC_DEFINITIONS[id]?.runEffect] as const).filter(([, effect]) => effect);
const note = (state: RelicAcquisitionRun, message: string): void => { state.log.push(message); if (state.log.length > 300) state.log.shift(); };

/** General events/blessings retain normal relic awards; their exclusive pools never leak outward. */
export function isRelicAcquisitionSourceAllowed(relicId: string, source: RelicAcquisitionState['source']): boolean {
  const acquisition = RELIC_DEFINITIONS[relicId]?.acquisition ?? 'normal';
  if (source === 'reward') return acquisition === 'normal';
  if (source === 'shop') return acquisition === 'shop';
  if (source === 'event') return acquisition === 'event' || acquisition === 'normal';
  return acquisition === 'ancient' || acquisition === 'normal';
}
function validReturnScreen(source: RelicAcquisitionState['source'], screen: string): boolean {
  if (source === 'shop') return screen === 'shop';
  if (source === 'event') return screen === 'map' || screen === 'eventResult';
  if (source === 'blessing') return screen === 'map';
  return ['map', 'victory', 'relic', 'reward'].includes(screen);
}

/** Pure payment preview: HP loss reduction applies outside combat; max-HP loss never does. */
export function getRelicAwareHpLoss(state: Pick<RelicAcquisitionRun, 'relicIds'>, amount: number): number {
  const reduction = activeRelicIds(state.relicIds).reduce((sum, id) => sum + (RELIC_DEFINITIONS[id]?.passive?.hpLossReduction ?? 0), 0);
  return Math.max(0, Math.floor(amount) - reduction);
}

/** Single HP payment boundary for events, blessings, and acquisition costs. */
export function loseRelicAwareHp(state: Pick<RelicAcquisitionRun, 'hp' | 'relicIds'>, amount: number): number {
  const loss = Math.min(state.hp, getRelicAwareHpLoss(state, amount));
  state.hp -= loss;
  return loss;
}

/** The caller supplies the undiscounted value. Applied once, including acquisition/event gold. */
export function gainRunGold(state: RelicAcquisitionRun, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0 || effects(state).some(([, effect]) => effect?.noGold)) return 0;
  const percent = effects(state).reduce((sum, [, effect]) => sum + (effect?.goldPercent ?? 0), 100);
  const gained = Math.floor(amount * percent / 100);
  state.gold += gained;
  if (gained > 0) state.maxHp += effects(state).reduce((sum, [, effect]) => sum + (effect?.goldMaxHp ?? 0), 0);
  return gained;
}

/** Adds exactly one award and, when owned, Bin Bon's one extra copy; copies do not recurse. */
export function addRelicAwareCard(state: RelicAcquisitionRun, cardId: string, upgraded = false): CardInstance[] {
  const definition = CARD_DEFINITIONS[cardId];
  if (!definition) return [];
  const copies = 1 + (effects(state).some(([, effect]) => effect?.addCardCopy) ? 1 : 0);
  const added: CardInstance[] = [];
  for (let copy = 0; copy < copies; copy++) {
    const card = { uid: `card-${state.nextCardId++}`, cardId, upgraded: upgraded || (!definition.unupgradable && effects(state).some(([, effect]) => effect?.addCardUpgradeTypes?.includes(definition.type))) };
    state.deck.push(card); state.stats.cardsAdded += 1; added.push(card);
    for (const [id, effect] of effects(state)) {
      if (effect?.addCardGold) gainRunGold(state, effect.addCardGold);
      if (effect?.curseMaxHp && definition.curse) state.maxHp += effect.curseMaxHp;
      if (effect?.addCardHealEvery) {
        const key = `${id}:cardsAdded`;
        const count = (counters(state)[key] ?? 0) + 1; counters(state)[key] = count;
        if (count % effect.addCardHealEvery.count === 0) state.hp = Math.min(state.maxHp, state.hp + effect.addCardHealEvery.heal);
      }
    }
  }
  return added;
}

export function getRelicShopPrice(state: RelicAcquisitionRun, basePrice: number): number {
  const discount = Math.max(0, ...effects(state).map(([, effect]) => effect?.shopDiscountPercent ?? 0));
  return Math.max(0, Math.floor(basePrice * (100 - discount) / 100));
}

/** Called once after committing entry into a node, never when rendering/restoring it. */
export function onRelicRoomEntered(state: RelicAcquisitionRun, type: string): void {
  for (const [id, effect] of effects(state)) {
    if ((type === 'shop' || type === 'event' || type === 'rest') && effect?.roomHeal?.[type])
      state.hp = Math.min(state.maxHp, state.hp + effect.roomHeal[type]!);
    if (type === 'rest' && effect?.restVisitDeckHeal)
      state.hp = Math.min(state.maxHp, state.hp + Math.floor(state.deck.length / effect.restVisitDeckHeal.every) * effect.restVisitDeckHeal.heal);
    if (type === 'rest' && effect?.restVisitEnergy) counters(state)[`${id}:nextBattleEnergy`] = effect.restVisitEnergy;
  }
}

/** Rest-only bonuses do not trigger on arrival, card upgrades, or loading a save. */
export function onRelicRest(state: RelicAcquisitionRun, baseHeal: number): number {
  const before = state.hp;
  for (const [, effect] of effects(state)) state.maxHp += effect?.restMaxHp ?? 0;
  state.hp = Math.min(state.maxHp, state.hp + baseHeal + effects(state).reduce((sum, [, effect]) => sum + (effect?.restHeal ?? 0), 0));
  return state.hp - before;
}

export function consumeRelicNextBattleEnergy(state: RelicAcquisitionRun): number {
  let energy = 0;
  for (const id of state.relicIds) {
    const key = `${id}:nextBattleEnergy`;
    energy += state.relicState?.[key] ?? 0;
    if (state.relicState && key in state.relicState) state.relicState[key] = 0;
  }
  return energy;
}

function randomUpgrade(state: RelicAcquisitionRun, operation: Extract<RelicAcquireOperation, { type: 'randomUpgrade' }>): void {
  const candidates = state.deck.filter((card) => upgradeable(card) && (!operation.cardType || CARD_DEFINITIONS[card.cardId].type === operation.cardType) && (!operation.basicKind || basicKind(card, operation.basicKind)));
  const rolled = shuffle(candidates, state.rngState); state.rngState = rolled.rngState;
  for (const card of rolled.values.slice(0, operation.count)) card.upgraded = true;
}

/** Called after a committed combat victory; counters survive combat and are saved on the run. */
export function onRelicVictory(state: RelicAcquisitionRun, kind: 'battle' | 'elite' | 'boss' | 'event'): void {
  for (const [id, effect] of effects(state)) {
    state.maxHp += effect?.victoryMaxHp ?? 0;
    if (kind === 'elite' && effect?.eliteUpgradeCount) randomUpgrade(state, { type: 'randomUpgrade', count: effect.eliteUpgradeCount });
    if (kind === 'battle' && effect?.normalBattleUpgradeEvery) {
      const key = `${id}:normalBattles`;
      counters(state)[key] = (counters(state)[key] ?? 0) + 1;
      if (counters(state)[key] % effect.normalBattleUpgradeEvery === 0) randomUpgrade(state, { type: 'randomUpgrade', count: 1 });
    }
  }
}

/** Pool availability includes payment/selection prerequisites, before a seeded option is authored. */
export function canAcquireRelic(state: RelicAcquisitionRun, relicId: string, allowOwned = false): boolean {
  const definition = RELIC_DEFINITIONS[relicId];
  if (!definition || (!allowOwned && state.relicIds.includes(relicId)) || (definition.classId && definition.classId !== state.classId) || state.relicState?.[`acquired:${relicId}`]) return false;
  let hp = state.hp; let maxHp = state.maxHp;
  for (const operation of operations(relicId)) {
    if (operation.type === 'gold' && effects(state).some(([, effect]) => effect?.noGold)) return false;
    if (operation.type === 'loseHp') hp -= getRelicAwareHpLoss(state, operation.amount);
    if (operation.type === 'loseMaxHp') { maxHp -= operation.amount; hp = Math.min(hp, maxHp); }
    if (hp <= 0 || maxHp <= 0) return false;
    if (operation.type === 'upgradeStarter' && (!state.classId || !replaceStarterRelic(state.relicIds, state.classId))) return false;
    if (operation.type === 'randomUpgrade' && !state.deck.some((card) => upgradeable(card) && (!operation.cardType || CARD_DEFINITIONS[card.cardId].type === operation.cardType) && (!operation.basicKind || basicKind(card, operation.basicKind)))) return false;
    if (operation.type === 'select') {
      const candidates = state.deck.filter((card) => operation.kind !== 'upgrade' || upgradeable(card));
      if (operation.kind !== 'chooseCard' && candidates.length < (operation.minCount ?? operation.count)) return false;
      if (operation.kind === 'remove' && state.deck.length <= (operation.minCount ?? operation.count)) return false;
      if (operation.kind === 'chooseCard' && !cardPoolForSelection(state, operation).length) return false;
    }
    if (operation.type === 'randomCards' && !getCardPool(state.classId, 'combat').some((id) => !operation.rarity || CARD_DEFINITIONS[id].rarity === operation.rarity)) return false;
    if (operation.type === 'addCards' && operation.cardIds.some((id) => !CARD_DEFINITIONS[id])) return false;
    if (operation.type === 'transformBasics' && !state.deck.some((card) => basicKind(card, 'strike') || basicKind(card, 'guard'))) return false;
  }
  return true;
}

function cardPoolForSelection(state: RelicAcquisitionRun, operation: Extract<RelicAcquireOperation, { type: 'select' }>): string[] {
  const pool = getCardPool(state.classId, operation.pool === 'colorless' ? 'event' : 'combat', { includeOwnClass: false, includeColorless: true });
  return operation.pool === 'colorless' ? pool.filter((id) => CARD_DEFINITIONS[id].classId === 'colorless') : pool;
}

function prepare(state: RelicAcquisitionRun, relicId: string, source: RelicAcquisitionState['source'], returnScreen: string, acquisitionKey: string): RelicAcquisitionState {
  const selection = operations(relicId).find((operation) => operation.type === 'select');
  const acquisition: RelicAcquisitionState = {
    version: 1, relicId, source, returnScreen, acquisitionKey,
    stage: selection ? 'select' : 'result', kind: selection?.kind,
    count: selection?.count ?? 0, minCount: selection?.minCount ?? selection?.count ?? 0,
    eligibleCardUids: state.deck.filter((card) => selection?.kind !== 'upgrade' || upgradeable(card)).map((card) => card.uid),
    offeredCardIds: [], replacements: {}, selectedCardUids: [], selectedCardIds: [], receipt: null,
    basis: { hp: state.hp, maxHp: state.maxHp, gold: state.gold, deck: structuredClone(state.deck), relicIds: [...state.relicIds], nextCardId: state.nextCardId, rngState: state.rngState, potions: [...state.potions], relicState: structuredClone(state.relicState ?? {}), statsCardsAdded: state.stats.cardsAdded },
  };
  // Acquisition results have their own seeded namespace; changing targets never advances combat RNG.
  const initial = seedToState(`${state.seed}:relic-acquisition:${acquisitionKey}:${relicId}`);
  if (selection?.kind === 'chooseCard') acquisition.offeredCardIds = shuffle(cardPoolForSelection(state, selection), initial).values.slice(0, selection.offerCount ?? 3);
  if (selection?.kind === 'transform' || operations(relicId).some((operation) => operation.type === 'transformBasics')) {
    const pool = getCardPool(state.classId, 'combat'); let rng = initial;
    for (const card of state.deck) {
      const candidates = pool.filter((id) => id !== card.cardId);
      const roll = nextRandom(rng); rng = roll.state;
      if (selection?.fixedCardId) acquisition.replacements[card.uid] = selection.fixedCardId;
      else if (candidates.length) acquisition.replacements[card.uid] = candidates[Math.floor(roll.value * candidates.length)];
    }
  }
  return acquisition;
}

function execute(state: RelicAcquisitionRun, legacyRandomCards?: Record<string, string[]>): void {
  const acquisition = state.relicAcquisition!;
  const basis = acquisition.basis;
  const selection = operations(acquisition.relicId).find((operation) => operation.type === 'select');
  // Acquisition, including ancient gifts, must not consume future encounter/combat seeds.
  // Victory hooks outside this transaction intentionally keep using the normal run stream.
  const runRngState = state.rngState;
  state.rngState = seedToState(`${state.seed}:relic-acquisition:${acquisition.acquisitionKey}:${acquisition.relicId}:effects`);
  for (const [operationIndex, operation] of operations(acquisition.relicId).entries()) {
    if (operation.type === 'maxHp') state.maxHp += operation.amount;
    else if (operation.type === 'gold') gainRunGold(state, operation.amount);
    else if (operation.type === 'loseHp') loseRelicAwareHp(state, operation.amount);
    else if (operation.type === 'loseMaxHp') { state.maxHp -= operation.amount; state.hp = Math.min(state.hp, state.maxHp); }
    else if (operation.type === 'heal') state.hp = operation.full ? state.maxHp : Math.min(state.maxHp, state.hp + (operation.amount ?? Math.floor(state.maxHp * (operation.percent ?? 0) / 100)));
    else if (operation.type === 'loseAllGold') state.gold = 0;
    else if (operation.type === 'potionSlots') state.potions.push(...Array<string | null>(operation.amount).fill(null));
    else if (operation.type === 'addCards') for (const id of operation.cardIds) addRelicAwareCard(state, id);
    else if (operation.type === 'randomUpgrade') randomUpgrade(state, operation);
    else if (operation.type === 'upgradeStarter' && state.classId) state.relicIds = replaceStarterRelic(state.relicIds, state.classId) ?? state.relicIds;
    else if (operation.type === 'randomCards') {
      const pool = getCardPool(state.classId, 'combat').filter((id) => !operation.rarity || CARD_DEFINITIONS[id].rarity === operation.rarity);
      const frozen = acquisition.randomCardPlans?.[operationIndex];
      let cardIds: string[];
      if (frozen) {
        cardIds = frozen.cardIds;
        state.rngState = frozen.rngStateAfter;
      } else {
        const rolled = shuffle(pool, state.rngState); state.rngState = rolled.rngState;
        cardIds = legacyRandomCards?.[operationIndex] ?? Array.from({ length: operation.count }, (_, index) => rolled.values[index % rolled.values.length]).filter(Boolean);
        // Legacy validation is observational: never rewrite an existing save to add a plan.
        if (!legacyRandomCards) (acquisition.randomCardPlans ??= {})[operationIndex] = { cardIds: [...cardIds], rngStateAfter: state.rngState };
      }
      for (const id of cardIds) addRelicAwareCard(state, id);
    } else if (operation.type === 'select') {
      if (operation.kind === 'chooseCard') for (const id of acquisition.selectedCardIds) addRelicAwareCard(state, id);
      else for (const uid of acquisition.selectedCardUids) {
        const card = state.deck.find((entry) => entry.uid === uid)!;
        if (operation.kind === 'upgrade') card.upgraded = true;
        else if (operation.kind === 'remove') state.deck = state.deck.filter((entry) => entry.uid !== uid);
        else if (operation.kind === 'copy') addRelicAwareCard(state, card.cardId, card.upgraded);
        else if (operation.kind === 'transform') { state.deck = state.deck.filter((entry) => entry.uid !== uid); addRelicAwareCard(state, acquisition.replacements[uid], operation.upgraded); }
      }
    } else if (operation.type === 'transformBasics') {
      for (const card of [...state.deck]) if ((basicKind(card, 'strike') || basicKind(card, 'guard')) && acquisition.replacements[card.uid]) {
        state.deck = state.deck.filter((entry) => entry.uid !== card.uid); addRelicAwareCard(state, acquisition.replacements[card.uid]);
      }
    }
  }
  state.rngState = runRngState;
  const receipt: RelicAcquisitionReceipt = {
    relicId: acquisition.relicId, hpChange: state.hp - basis.hp, maxHpChange: state.maxHp - basis.maxHp, goldChange: state.gold - basis.gold,
    addedCards: structuredClone(state.deck.filter((card) => !basis.deck.some((old) => old.uid === card.uid))),
    removedCards: structuredClone(basis.deck.filter((card) => !state.deck.some((after) => after.uid === card.uid))),
    upgradedCards: structuredClone(state.deck.filter((card) => card.upgraded && basis.deck.some((old) => old.uid === card.uid && !old.upgraded))),
    replacedRelicIds: basis.relicIds.filter((id) => !state.relicIds.includes(id)), description: '',
  };
  receipt.description = [receipt.hpChange ? `HP ${receipt.hpChange > 0 ? '+' : ''}${receipt.hpChange}` : '', receipt.maxHpChange ? `最大HP ${receipt.maxHpChange > 0 ? '+' : ''}${receipt.maxHpChange}` : '', receipt.goldChange ? `ゴールド ${receipt.goldChange > 0 ? '+' : ''}${receipt.goldChange}` : '', ...receipt.addedCards.map((card) => `「${CARD_DEFINITIONS[card.cardId].name}」獲得`), ...receipt.removedCards.map((card) => `「${CARD_DEFINITIONS[card.cardId].name}」削除`), ...receipt.upgradedCards.map((card) => `「${CARD_DEFINITIONS[card.cardId].name}＋」強化`), ...receipt.replacedRelicIds.map((id) => `「${RELIC_DEFINITIONS[id].name}」を強化版へ交換`)].filter(Boolean).join(' ／ ') || RELIC_DEFINITIONS[acquisition.relicId].description;
  acquisition.receipt = receipt; acquisition.stage = 'result';
  // Keep the authored selection kind in result saves so previews and audit information stay stable.
  acquisition.kind = selection?.kind;
  note(state, `${RELIC_DEFINITIONS[acquisition.relicId].name}：${receipt.description}`);
}

/** Explicit post-blessing hook. Existing owned relics are never automatically replayed on load. */
export function applyOwnedRelicAcquisition<T extends RelicAcquisitionRun>(state: T, relicId: string, source: RelicAcquisitionState['source'], returnScreen: string, acquisitionKey: string): T {
  if (state.relicAcquisition || !state.relicIds.includes(relicId) || !isRelicAcquisitionSourceAllowed(relicId, source) || !validReturnScreen(source, returnScreen) || !canAcquireRelic(state, relicId, true)) return state;
  const next = structuredClone(state);
  counters(next)[`acquired:${relicId}`] = 1;
  next.relicAcquisition = prepare(next, relicId, source, returnScreen, acquisitionKey);
  next.screen = 'relicAcquisition';
  if (next.relicAcquisition.stage === 'result') execute(next);
  return next;
}

export function acquireRelic<T extends RelicAcquisitionRun>(state: T, relicId: string, source: RelicAcquisitionState['source'], returnScreen: string, acquisitionKey = `${source}:${relicId}`): T {
  if (state.relicAcquisition || !isRelicAcquisitionSourceAllowed(relicId, source) || !validReturnScreen(source, returnScreen) || !canAcquireRelic(state, relicId)) return state;
  const next = structuredClone(state); next.relicIds.push(relicId);
  return applyOwnedRelicAcquisition(next, relicId, source, returnScreen, acquisitionKey);
}

export function reduceRelicAcquisition<T extends RelicAcquisitionRun>(state: T, action: RelicAcquisitionAction): T {
  const acquisition = state.relicAcquisition;
  if (state.screen !== 'relicAcquisition' || !acquisition) return state;
  if (action.type === 'continueRelicAcquisition') {
    if (acquisition.stage !== 'result' || !acquisition.receipt) return state;
    const next = structuredClone(state); next.screen = acquisition.returnScreen; next.relicAcquisition = null; return next;
  }
  if (acquisition.stage !== 'select') return state;
  if (action.type === 'selectRelicCards') {
    const uids = action.cardUids ?? []; const ids = action.cardIds ?? [];
    const count = acquisition.kind === 'chooseCard' ? ids.length : uids.length;
    if (count > acquisition.count || new Set(uids).size !== uids.length || new Set(ids).size !== ids.length || uids.some((uid) => !acquisition.eligibleCardUids.includes(uid)) || ids.some((id) => !acquisition.offeredCardIds.includes(id)) || (acquisition.kind === 'chooseCard' ? uids.length > 0 : ids.length > 0)) return state;
    const next = structuredClone(state); next.relicAcquisition!.selectedCardUids = [...uids]; next.relicAcquisition!.selectedCardIds = [...ids]; return next;
  }
  if (action.type === 'confirmRelicAcquisition') {
    const count = acquisition.kind === 'chooseCard' ? acquisition.selectedCardIds.length : acquisition.selectedCardUids.length;
    if (count < acquisition.minCount || count > acquisition.count) return state;
    const next = structuredClone(state); execute(next); return next;
  }
  return state;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

/** Validate stored offers as authored candidates, without repeating a now-expanded random roll. */
function validFrozenCandidates(state: RelicAcquisitionRun, acquisition: RelicAcquisitionState): boolean {
  const selection = operations(acquisition.relicId).find((operation) => operation.type === 'select');
  const basisRun = { ...state, ...acquisition.basis };
  const expectedEligible = acquisition.basis.deck.filter((card) => selection?.kind !== 'upgrade' || upgradeable(card)).map((card) => card.uid);
  if (acquisition.kind !== selection?.kind || acquisition.count !== (selection?.count ?? 0) || acquisition.minCount !== (selection?.minCount ?? selection?.count ?? 0) || !same(acquisition.eligibleCardUids, expectedEligible)) return false;
  if (!Array.isArray(acquisition.offeredCardIds) || new Set(acquisition.offeredCardIds).size !== acquisition.offeredCardIds.length || !record(acquisition.replacements)) return false;
  if (selection?.kind === 'chooseCard') {
    const pool = cardPoolForSelection(basisRun, selection);
    if (acquisition.offeredCardIds.length !== Math.min(selection.offerCount ?? 3, pool.length) || acquisition.offeredCardIds.some((id) => !pool.includes(id))) return false;
  } else if (acquisition.offeredCardIds.length) return false;
  const transforms = selection?.kind === 'transform' || operations(acquisition.relicId).some((operation) => operation.type === 'transformBasics');
  if (transforms) {
    const pool = getCardPool(state.classId, 'combat');
    if (Object.keys(acquisition.replacements).length !== acquisition.basis.deck.length) return false;
    for (const card of acquisition.basis.deck) {
      const replacement = acquisition.replacements[card.uid];
      if (typeof replacement !== 'string' || (selection?.fixedCardId ? replacement !== selection.fixedCardId : replacement === card.cardId || !pool.includes(replacement))) return false;
    }
  } else if (Object.keys(acquisition.replacements).length) return false;
  const plans = acquisition.randomCardPlans;
  if (plans !== undefined) {
    if (!record(plans)) return false;
    const randomOperations = operations(acquisition.relicId).map((operation, index) => ({ operation, index })).filter(({ operation }) => operation.type === 'randomCards');
    if (Object.keys(plans).length !== randomOperations.length) return false;
    for (const { operation, index } of randomOperations) {
      if (operation.type !== 'randomCards') return false;
      const plan = plans[index];
      if (!record(plan) || !Array.isArray(plan.cardIds) || plan.cardIds.length !== operation.count || !Number.isSafeInteger(plan.rngStateAfter) || plan.rngStateAfter < 0 || plan.rngStateAfter > 0xffffffff) return false;
      const pool = getCardPool(state.classId, 'combat').filter((id) => !operation.rarity || CARD_DEFINITIONS[id].rarity === operation.rarity);
      if (plan.cardIds.some((id) => typeof id !== 'string' || !pool.includes(id)) || (pool.length >= operation.count && new Set(plan.cardIds).size !== plan.cardIds.length)) return false;
    }
  }
  return true;
}

/** Old result receipts already contain committed rewards. Extract only normal,
 * class-correct, rarity-correct awards; the full execute replay still proves all
 * UIDs, copies, upgrades, payments and resulting inventory against that receipt. */
function legacyRandomCardPlan(state: RelicAcquisitionRun, acquisition: RelicAcquisitionState): Record<string, string[]> | null {
  const added = acquisition.receipt?.addedCards;
  if (!Array.isArray(added)) return null;
  const copies = 1 + (effects({ ...state, ...acquisition.basis }).some(([, effect]) => effect?.addCardCopy) ? 1 : 0);
  const plan: Record<string, string[]> = {};
  let cursor = 0;
  for (const [index, operation] of operations(acquisition.relicId).entries()) {
    if (operation.type === 'randomCards') {
      const pool = getCardPool(state.classId, 'combat').filter((id) => !operation.rarity || CARD_DEFINITIONS[id].rarity === operation.rarity);
      const ids = Array.from({ length: operation.count }, (_, count) => added[cursor + count * copies]?.cardId);
      if (ids.some((id) => typeof id !== 'string' || !pool.includes(id)) || (pool.length >= operation.count && new Set(ids).size !== ids.length)) return null;
      plan[index] = ids;
      cursor += operation.count * copies;
    } else if (operation.type === 'addCards') cursor += operation.cardIds.length * copies;
    else if (operation.type === 'select' && ['chooseCard', 'copy', 'transform'].includes(operation.kind)) cursor += (operation.kind === 'chooseCard' ? acquisition.selectedCardIds.length : acquisition.selectedCardUids.length) * copies;
    else if (operation.type === 'transformBasics') cursor += acquisition.basis.deck.filter((card) => basicKind(card, 'strike') || basicKind(card, 'guard')).length * copies;
  }
  return cursor === added.length ? plan : null;
}

/** Structural validation plus replay of frozen candidates; callers separately validate run cards. */
export function isValidRelicAcquisitionState(state: RelicAcquisitionRun): boolean {
  if (state.relicState !== undefined && (typeof state.relicState !== 'object' || state.relicState === null || Array.isArray(state.relicState) || Object.entries(state.relicState).some(([key, value]) => key.length > 200 || !Number.isSafeInteger(value) || value < 0))) return false;
  const acquisition = state.relicAcquisition;
  if (!acquisition) return state.screen !== 'relicAcquisition';
  if (state.screen !== 'relicAcquisition' || acquisition.version !== 1 || !RELIC_DEFINITIONS[acquisition.relicId] || !['reward', 'shop', 'event', 'blessing'].includes(acquisition.source) || !isRelicAcquisitionSourceAllowed(acquisition.relicId, acquisition.source) || !validReturnScreen(acquisition.source, acquisition.returnScreen) || typeof acquisition.acquisitionKey !== 'string' || !acquisition.acquisitionKey || acquisition.acquisitionKey.length > 500 || !['select', 'result'].includes(acquisition.stage) || !state.relicIds.includes(acquisition.relicId) || state.relicState?.[`acquired:${acquisition.relicId}`] !== 1) return false;
  const basis = acquisition.basis;
  if (!basis || !Array.isArray(basis.deck) || !Array.isArray(basis.relicIds) || !basis.relicIds.includes(acquisition.relicId) || !Array.isArray(basis.potions) || !basis.relicState || ![basis.hp, basis.maxHp, basis.gold, basis.nextCardId, basis.rngState, basis.statsCardsAdded].every((value) => Number.isSafeInteger(value) && value >= 0) || basis.hp <= 0 || basis.hp > basis.maxHp || basis.deck.some((card) => !card || !CARD_DEFINITIONS[card.cardId] || typeof card.uid !== 'string' || typeof card.upgraded !== 'boolean')) return false;
  if (new Set(basis.deck.map((card) => card.uid)).size !== basis.deck.length || RELIC_DEFINITIONS[acquisition.relicId].classId && RELIC_DEFINITIONS[acquisition.relicId].classId !== state.classId || !validFrozenCandidates(state, acquisition)) return false;
  if (!Array.isArray(acquisition.selectedCardUids) || !Array.isArray(acquisition.selectedCardIds) || new Set(acquisition.selectedCardUids).size !== acquisition.selectedCardUids.length || new Set(acquisition.selectedCardIds).size !== acquisition.selectedCardIds.length || acquisition.selectedCardUids.some((uid) => !acquisition.eligibleCardUids.includes(uid)) || acquisition.selectedCardIds.some((id) => !acquisition.offeredCardIds.includes(id))) return false;
  const count = acquisition.kind === 'chooseCard' ? acquisition.selectedCardIds.length : acquisition.selectedCardUids.length;
  if (count > acquisition.count || (acquisition.kind === 'chooseCard' ? acquisition.selectedCardUids.length > 0 : acquisition.selectedCardIds.length > 0)) return false;
  if (acquisition.stage === 'select') return acquisition.receipt === null && JSON.stringify(state.deck) === JSON.stringify(basis.deck) && state.hp === basis.hp && state.maxHp === basis.maxHp && state.gold === basis.gold && state.nextCardId === basis.nextCardId && state.rngState === basis.rngState && state.stats.cardsAdded === basis.statsCardsAdded && JSON.stringify(state.relicIds) === JSON.stringify(basis.relicIds) && JSON.stringify(state.potions) === JSON.stringify(basis.potions) && JSON.stringify(state.relicState) === JSON.stringify(basis.relicState);
  if (count < acquisition.minCount || !acquisition.receipt) return false;
  const replay: RelicAcquisitionRun = {
    ...structuredClone(state), ...structuredClone(basis),
    stats: { ...state.stats, cardsAdded: basis.statsCardsAdded },
    relicAcquisition: { ...structuredClone(acquisition), receipt: null },
  };
  const legacyCards = acquisition.randomCardPlans === undefined ? legacyRandomCardPlan(state, acquisition) : undefined;
  if (legacyCards === null) return false;
  try { execute(replay, legacyCards); } catch { return false; }
  return JSON.stringify(replay.relicAcquisition?.receipt) === JSON.stringify(acquisition.receipt) &&
    (['hp', 'maxHp', 'gold', 'nextCardId', 'rngState'] as const).every((key) => replay[key] === state[key]) &&
    (['deck', 'relicIds', 'potions', 'relicState'] as const).every((key) => JSON.stringify(replay[key]) === JSON.stringify(state[key])) &&
    replay.stats.cardsAdded === state.stats.cardsAdded;
}
