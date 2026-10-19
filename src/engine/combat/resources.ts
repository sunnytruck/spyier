import { CARD_DEFINITIONS } from '../../data/cards';
import type {
  CardDestination,
  CardInstance,
  ClassResources,
  CombatState,
  Effect,
  OrbType,
} from '../../types/game';
import { nextRandom } from '../random';
import { appendLog, dealDamage, gainBlock } from './state';
import { findEnemy, getEnemies } from './targets';
import { emitCombatCue, withCombatTraceContext } from '../../presentation/trace';

/** Kept in one place so provisional keyword tuning does not change card data. */
export const CLASS_RULES = {
  orbSlots: 3,
  lightningPassive: 3,
  lightningEvoke: 8,
  frostPassive: 2,
  frostEvoke: 5,
} as const;

/** The battle engine and its read-only HUD share these existing orb rules. */
export function orbSlotCount(): number {
  return CLASS_RULES.orbSlots;
}

export function nextOrbEvokeIndex(orbs: readonly OrbType[]): number | null {
  return orbs.length ? orbs.length - 1 : null;
}

export function orbEffectValue(orb: OrbType, mode: 'passive' | 'evoke', focus: number): number {
  const base = orb === 'frost'
    ? mode === 'evoke' ? CLASS_RULES.frostEvoke : CLASS_RULES.frostPassive
    : mode === 'evoke' ? CLASS_RULES.lightningEvoke : CLASS_RULES.lightningPassive;
  return Math.max(0, Math.floor(base + focus));
}

/** Raw card attack value, before the shared strength/weak/vulnerable calculation. */
export function attackCardBase(
  state: CombatState,
  effect: Extract<Effect, { type: 'damage' }>,
  sourceCard?: CardInstance,
): number {
  return effect.amount +
    (effect.fromBlock ? state.player.block : 0) +
    (effect.fromForge ? state.classResources?.forge ?? 0 : 0) +
    (sourceCard && CARD_DEFINITIONS[sourceCard.cardId]?.tags?.includes('knife')
      ? state.powerStacks?.knifeDamage ?? 0 : 0) +
    (state.jitto >= 100 ? effect.divineBonus ?? 0 : 0);
}

export function createClassResources(): ClassResources {
  return {
    stars: 0,
    starsGainedThisTurn: 0,
    forge: 0,
    ostyHp: 0,
    focus: 0,
    temporaryFocus: 0,
    orbs: [],
    nextTurnEnergy: 0,
  };
}

export function resources(state: CombatState): ClassResources {
  state.classResources ??= createClassResources();
  return state.classResources;
}

export function generateCards(
  state: CombatState,
  cardId: string,
  amount: number,
  destination: CardDestination,
  upgraded = false,
): CardInstance[] {
  if (!Object.hasOwn(CARD_DEFINITIONS, cardId)) return [];
  const generated: CardInstance[] = [];
  for (let count = 0; count < Math.max(0, Math.floor(amount)); count += 1) {
    const card = { uid: `generated-${state.nextId++}`, cardId, upgraded };
    state.generatedCards ??= [];
    state.generatedCards.push({ ...card });
    if (destination === 'drawPile') {
      const random = nextRandom(state.rngState);
      state.rngState = random.state;
      state.drawPile.splice(Math.floor(random.value * (state.drawPile.length + 1)), 0, card);
    } else if (destination === 'hand' && state.hand.length >= 50) state.discardPile.push(card);
    else state[destination].push(card);
    generated.push(card);
  }
  if (generated.length)
    appendLog(state, `「${CARD_DEFINITIONS[cardId].name}」を${generated.length}枚生成。`);
  if (generated.length) {
    const toHand = generated.filter((card) => state.hand.some((held) => held.uid === card.uid));
    const elsewhere = generated.filter((card) => !toHand.some((held) => held.uid === card.uid));
    if (toHand.length) emitCombatCue(state, { kind: 'generate', card: toHand[0], cards: toHand, toZone: 'hand', amount: toHand.length });
    if (elsewhere.length) emitCombatCue(state, { kind: 'generate', card: elsewhere[0], cards: elsewhere, toZone: destination === 'hand' ? 'discardPile' : destination, amount: elsewhere.length });
  }
  return generated;
}

/** Fetch existing blade without duplicating it; first use generates its instance. */
export function fetchGeneratedCard(state: CombatState, cardId: string): void {
  if (state.hand.some((card) => card.cardId === cardId)) return;
  if (state.hand.length >= 50) {
    appendLog(state, '手札の上限50枚のため、呼び戻しは行わない。');
    return;
  }
  for (const zoneName of ['drawPile', 'discardPile', 'exhaustPile'] as const) {
    const zone = state[zoneName];
    const index = zone.findIndex((card) => card.cardId === cardId);
    if (index < 0) continue;
    const fetched = zone.splice(index, 1);
    state.hand.push(...fetched);
    emitCombatCue(state, { kind: 'draw', card: fetched[0], cards: fetched, fromZone: zoneName, toZone: 'hand', label: '呼び戻し' });
    return;
  }
  generateCards(state, cardId, 1, 'hand');
}

function triggerOrb(state: CombatState, orb: OrbType, evoke: boolean, index: number): void {
  const amount = orbEffectValue(orb, evoke ? 'evoke' : 'passive', resources(state).focus);
  const context = {
    sourceId: `orb-${index}`,
    effect: orb === 'frost' ? 'orbFrost' : 'orbLightning',
    orbIndex: index,
    orbMode: evoke ? 'evoke' as const : 'passive' as const,
    resourceAction: 'activate',
  };
  const emitActivation = () => emitCombatCue(state, {
    kind: 'resource', ...context, targetId: `orb-${index}`, resource: orb,
    amount: 0, label: evoke ? '解放発動' : '自動発動',
  });
  if (orb === 'frost') {
    emitActivation();
    withCombatTraceContext(state, context, () => gainBlock(state, 'player', amount));
    return;
  }
  const enemies = getEnemies(state).filter((enemy) => enemy.hp > 0);
  if (enemies.length === 0) return;
  const random = nextRandom(state.rngState);
  state.rngState = random.state;
  const enemy = enemies[Math.floor(random.value * enemies.length)];
  emitActivation();
  withCombatTraceContext(state, context, () => dealDamage(state, 'enemy', amount, false, enemy));
}

/** Repeating an evoke repeats the same rightmost orb, then removes it once. */
export function evokeOrb(state: CombatState, times: number): void {
  const index = nextOrbEvokeIndex(resources(state).orbs);
  const orb = resources(state).orbs.pop();
  if (!orb || index === null) return;
  emitCombatCue(state, { kind: 'resource', sourceId: 'player', targetId: `orb-${index}`, resource: orb, amount: -1, label: '解放', orbIndex: index, orbMode: 'evoke', resourceAction: 'remove' });
  for (let hit = 0; hit < Math.max(0, times) && state.phase === 'player'; hit += 1)
    triggerOrb(state, orb, true, index);
  appendLog(state, `${orb === 'lightning' ? '雷' : '氷'}オーブを${times}回解放。`);
}

export function channelOrbs(state: CombatState, orb: OrbType, amount: number): void {
  const current = resources(state);
  for (
    let count = 0;
    count < Math.max(0, Math.floor(amount)) && state.phase === 'player';
    count += 1
  ) {
    if (current.orbs.length >= orbSlotCount()) evokeOrb(state, 1);
    if (state.phase === 'player') {
      current.orbs.push(orb);
      const index = current.orbs.length - 1;
      emitCombatCue(state, { kind: 'resource', sourceId: 'player', targetId: `orb-${index}`, resource: orb, amount: 1, label: '生成', orbIndex: index, orbMode: 'channel', resourceAction: 'channel' });
    }
  }
  appendLog(state, `${orb === 'lightning' ? '雷' : '氷'}オーブを${amount}個生成。`);
}

export function triggerPassiveOrbs(state: CombatState): void {
  for (const [index, orb] of (state.classResources?.orbs ?? []).entries()) {
    if (state.phase !== 'player') break;
    triggerOrb(state, orb, false, index);
  }
}

/** Summons use the separate-unit damage rule, independent of player attack modifiers. */
export function summonAttack(
  state: CombatState,
  amount: number,
  plusSummonHp: boolean,
  targetId?: string,
): void {
  const current = resources(state);
  const enemy = findEnemy(state, targetId);
  if (current.ostyHp <= 0 || !enemy) {
    appendLog(state, '召喚体がいないため、召喚攻撃は発動しない。');
    return;
  }
  withCombatTraceContext(state, { sourceId: 'osty', effect: 'summonDamage' }, () => dealDamage(state, 'enemy', amount + (plusSummonHp ? current.ostyHp : 0), false, enemy));
}
