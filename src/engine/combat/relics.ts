import { CARD_DEFINITIONS } from '../../data/cards';
import { BOSS_ENEMY_IDS, ELITE_ENEMY_IDS } from '../../data/enemies';
import { activeRelicIds, isRelicEligible, RELIC_DEFINITIONS, type RelicDefinition, type RelicEffect, type RelicPassives, type RelicTrigger } from '../../data/relics';
import type { CardInstance, CombatState } from '../../types/game';
import { drawInto } from '../actions/draw';
import { appendLog, applyGauge, dealDamage, gainBlock, healPlayer } from './state';
import { emitCombatCue, withCombatTraceContext } from '../../presentation/trace';
import { channelOrbs, generateCards, resources } from './resources';
import { getEnemies, getEnemyKey } from './targets';
import { nextRandom } from '../random';

export interface RelicContext { card?: CardInstance; enemyId?: string; amount?: number }

export function getActiveRelics(state: CombatState): RelicDefinition[] {
  return activeRelicIds(state.relicIds ?? []).filter((id) => isRelicEligible(id, state.classId)).map((id) => RELIC_DEFINITIONS[id]);
}
export function relicPassiveAmount(state: CombatState, key: keyof RelicPassives): number {
  return getActiveRelics(state).reduce((sum, relic) => sum + (typeof relic.passive?.[key] === 'number' ? relic.passive[key] as number : 0), 0);
}
export function hasRelicPassive(state: CombatState, key: keyof RelicPassives): boolean {
  return getActiveRelics(state).some((relic) => Boolean(relic.passive?.[key]));
}
/** Read-time HP bonuses disappear as soon as HP rises above the threshold. */
export function effectivePlayerStrength(state: CombatState): number {
  return state.player.strength + getActiveRelics(state).reduce((sum, relic) => {
    const threshold = relic.passive?.hpThresholdStrength;
    return sum + (threshold && state.player.hp * 100 <= state.player.maxHp * threshold.percent ? threshold.amount : 0);
  }, 0);
}

/** Call once after a legal card play is committed, before any of its hits resolve. */
export function beforeCardRelics(state: CombatState, card: CardInstance): void {
  if (CARD_DEFINITIONS[card.cardId]?.type !== 'attack') return;
  if (!getActiveRelics(state).some((relic) => relic.passive?.attackEveryMultiplier)) return;
  const counters = state.relicCounters ??= {};
  const run = state.relicState ??= {};
  let multiplier = 1;
  for (const relic of getActiveRelics(state)) {
    const passive = relic.passive?.attackEveryMultiplier;
    if (!passive) continue;
    const serialKey = `attack-serial:${relic.id}`;
    // Re-entering the same committed play cannot advance a persistent counter twice.
    if (counters[serialKey] === state.stats.cardsPlayed) continue;
    counters[serialKey] = state.stats.cardsPlayed;
    const countKey = `attacks:${relic.id}`;
    run[countKey] = (run[countKey] ?? 0) + 1;
    if (run[countKey] % passive.every === 0) {
      multiplier *= passive.multiplier;
      emitRelicActivation(state, relic);
    }
  }
  if (multiplier !== 1) counters[`attack-multiplier:${card.uid}`] = multiplier;
}
/** Shared by runtime previews and the resolver; only committed resolution consumes the first-block bonus. */
export function cardBlockWithRelics(state: CombatState, base: number, consume = false, includeDexterity = true): number {
  let amount = Math.max(0, Math.floor(base + (includeDexterity ? state.dexterity ?? 0 : 0)));
  if (!amount) return 0;
  for (const relic of getActiveRelics(state)) {
    if (!relic.passive?.firstCardBlockMultiplier || state.relicCounters?.[`card-block:${relic.id}`]) continue;
    amount *= relic.passive.firstCardBlockMultiplier;
    if (consume) { state.relicCounters ??= {}; state.relicCounters[`card-block:${relic.id}`] = 1; emitRelicActivation(state, relic); }
  }
  return amount;
}
export function emitRelicActivation(state: CombatState, relic: RelicDefinition): void {
  appendLog(state, `レリック「${relic.name}」が発動。`);
  emitCombatCue(state, { kind: 'resource', sourceId: 'player', targetId: 'player', resource: `relic:${relic.id}`, resourceAction: 'activate', amount: 1, label: relic.name });
}
function matchesCondition(state: CombatState, effect: RelicEffect, context: RelicContext): boolean {
  if (effect.turn !== undefined && effect.turn !== state.turn) return false;
  if (effect.minTurn !== undefined && state.turn < effect.minTurn) return false;
  if (effect.maxTurn !== undefined && state.turn > effect.maxTurn) return false;
  if (effect.hpAtMostPercent !== undefined && state.player.hp * 100 > state.player.maxHp * effect.hpAtMostPercent) return false;
  if (effect.noBlock && state.player.block !== 0) return false;
  if (effect.blockAtLeast !== undefined && state.player.block < effect.blockAtLeast) return false;
  if (effect.noAttack && (state.relicCounters?.[`attacks-turn:${state.turn}`] ?? 0) > 0) return false;
  if (effect.handEmpty && state.hand.length > 0) return false;
  if (effect.energyAtLeast !== undefined && state.energy < effect.energyAtLeast) return false;
  if (effect.energyExactly !== undefined && state.energy !== effect.energyExactly) return false;
  if (effect.previousTurnCardsAtMost !== undefined && (state.relicCounters?.['previous-turn-cards'] ?? Infinity) > effect.previousTurnCardsAtMost) return false;
  const baseIds = getEnemies(state).map((enemy) => enemy.id.replace(/^act[23]_/, ''));
  if (effect.bossOnly && !(state.encounterType ? state.encounterType === 'boss' : baseIds.some((id) => BOSS_ENEMY_IDS.includes(id)))) return false;
  if (effect.eliteOnly && !(state.encounterType ? state.encounterType === 'elite' : baseIds.some((id) => ELITE_ENEMY_IDS.includes(id)))) return false;
  if (['cardPlayed', 'cardExhausted', 'cardDiscarded', 'cardGenerated'].includes(effect.trigger)) {
    const card = context.card;
    const definition = card && CARD_DEFINITIONS[card.cardId];
    if (!card || !definition) return false;
    if (effect.trigger === 'cardPlayed' && state.stats.cardsPlayed < 1) return false;
    if (effect.cardType && definition.type !== effect.cardType) return false;
    if (effect.cardUpgraded !== undefined && card.upgraded !== effect.cardUpgraded) return false;
    const cost = card.upgraded ? definition.upgradedCost ?? definition.cost : definition.cost;
    if (effect.cardCostAtLeast !== undefined && (definition.xCost ? (context.amount ?? state.energy) : cost) < effect.cardCostAtLeast) return false;
    if (effect.cardEffect && !(card.upgraded ? definition.upgradedEffects : definition.effects).some((part) => part.type === effect.cardEffect)) return false;
  }
  return effect.trigger !== 'enemyKilled' || getEnemies(state).some((enemy) => getEnemyKey(enemy) === context.enemyId && enemy.hp <= 0);
}

/** Per-hook counters persist across interrupted effects; run-scoped counters cross battles. */
function shouldFire(state: CombatState, effect: RelicEffect, key: string, context: RelicContext): boolean {
  const counters = state.relicCounters ??= {};
  if (effect.trigger === 'enemyKilled') {
    const killed = `kill:${key}:${context.enemyId}`;
    if (counters[killed]) return false;
    counters[killed] = 1;
  } else if (effect.trigger === 'cardPlayed') {
    const serial = state.stats.cardsPlayed;
    if ((counters[`card:${key}`] ?? 0) >= serial) return false;
    counters[`card:${key}`] = serial;
  } else if (effect.trigger === 'turnStart' || effect.trigger === 'turnEnd') {
    const turnKey = `${effect.trigger === 'turnStart' ? 'turn' : 'end'}:${key}`;
    if (counters[turnKey] === state.turn) return false;
    counters[turnKey] = state.turn;
  }
  if (effect.scope === 'run') {
    const run = state.relicState ??= {};
    run[key] = (run[key] ?? 0) + 1;
    return effect.every ? run[key] % effect.every === 0 : true;
  }
  if (effect.scope === 'turn') {
    if (counters[`seen-turn:${key}`] !== state.turn) {
      counters[`seen-turn:${key}`] = state.turn;
      counters[`seen:${key}`] = 0;
    }
    counters[`seen:${key}`] = (counters[`seen:${key}`] ?? 0) + 1;
    return effect.every ? counters[`seen:${key}`] % effect.every === 0 : counters[`seen:${key}`] === (effect.atCard ?? 1);
  }
  if (effect.every) {
    counters[`seen:${key}`] = (counters[`seen:${key}`] ?? 0) + 1;
    return counters[`seen:${key}`] % effect.every === 0;
  }
  if (effect.scope === 'battle' || ['combatStart', 'firstHand', 'firstAttack', 'victory'].includes(effect.trigger)) return (counters[key] ?? 0) === 0;
  return true;
}

/** Temporarily upgrade actual inventory instances, never the permanent run deck. */
export function temporarilyUpgradeCards(state: CombatState, selected: readonly CardInstance[]): void {
  const uids = new Set(selected.filter((card) => !card.upgraded && !CARD_DEFINITIONS[card.cardId]?.unupgradable).map((card) => card.uid));
  if (!uids.size) return;
  for (const card of [...state.deck, ...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhaustPile, ...state.powers, ...(state.generatedCards ?? [])]) if (uids.has(card.uid)) card.upgraded = true;
  state.temporaryUpgrades = [...new Set([...(state.temporaryUpgrades ?? []), ...uids])];
  emitCombatCue(state, { kind: 'power', targetId: 'player', resource: 'temporaryUpgrades', amount: uids.size, label: '戦闘中の強化' });
}

function resolveRelicEffect(state: CombatState, effect: RelicEffect): void {
  const { kind, amount } = effect;
  switch (kind) {
    case 'block': gainBlock(state, 'player', amount); break;
    case 'strength': state.player.strength += amount; emitCombatCue(state, { kind: 'status', targetId: 'player', status: 'strength', amount }); break;
    case 'temporaryStrength':
      state.player.strength += amount;
      (state.turnModifiers ??= []).push({ kind: 'status', targetId: 'player', status: 'strength', amount, expireAt: 'playerEnd' });
      emitCombatCue(state, { kind: 'status', targetId: 'player', status: 'strength', amount });
      break;
    case 'dexterity': state.dexterity = (state.dexterity ?? 0) + amount; emitCombatCue(state, { kind: 'status', targetId: 'player', status: 'dexterity', amount }); break;
    case 'draw': drawInto(state, amount); break;
    case 'energy': { const before = state.energy; state.energy = Math.max(0, state.energy + amount); emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'energy', amount: state.energy - before }); break; }
    case 'heal': healPlayer(state, amount); break;
    case 'gauge': applyGauge(state, amount); break;
    case 'enemyWeak': case 'enemyVulnerable': case 'enemyPoison': case 'enemyStrength': {
      const status = kind === 'enemyWeak' ? 'weak' : kind === 'enemyVulnerable' ? 'vulnerable' : kind === 'enemyPoison' ? 'poison' : 'strength';
      for (const enemy of getEnemies(state).filter((enemy) => enemy.hp > 0)) {
        enemy[status] += amount + (status === 'poison' ? relicPassiveAmount(state, 'poisonBonus') : 0);
        emitCombatCue(state, { kind: 'status', targetId: getEnemyKey(enemy), status, amount });
      }
      break;
    }
    case 'cleansePoison': { const removed = Math.min(state.player.poison, amount); state.player.poison -= removed; if (removed) emitCombatCue(state, { kind: 'status', targetId: 'player', status: 'poison', amount: -removed }); break; }
    case 'knife': generateCards(state, 'token_knife', amount, 'hand'); break;
    case 'soul': generateCards(state, 'token_soul', amount, 'drawPile'); break;
    case 'generateCard': if (effect.generatedCardId && CARD_DEFINITIONS[effect.generatedCardId]) generateCards(state, effect.generatedCardId, amount, 'hand'); break;
    case 'exhaustDrawTop': {
      const cards = state.drawPile.splice(Math.max(0, state.drawPile.length - Math.max(0, Math.floor(amount)))).reverse();
      state.exhaustPile.push(...cards);
      if (cards.length) {
        emitCombatCue(state, { kind: 'exhaust', sourceId: 'player', cards, fromZone: 'drawPile', toZone: 'exhaustPile' });
        for (const card of cards) triggerRelics(state, 'cardExhausted', { card });
      }
      break;
    }
    case 'stars': { const current = resources(state); current.stars += amount; current.starsGainedThisTurn += amount; emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'stars', amount, resourceAction: 'gain' }); break; }
    case 'summon': { const wasActive = (state.classResources?.ostyHp ?? 0) > 0; resources(state).ostyHp += amount; emitCombatCue(state, { kind: 'resource', targetId: 'osty', resource: 'ostyHp', amount, resourceAction: wasActive ? 'grow' : 'summon' }); break; }
    case 'frost': case 'lightning': channelOrbs(state, kind, amount); break;
    case 'forge': resources(state).forge += amount; emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'forge', amount, resourceAction: 'forge' }); break;
    case 'focus': resources(state).focus += amount; emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'focus', amount }); break;
    case 'damageAll': case 'damageAllTurn': for (const enemy of getEnemies(state).filter((enemy) => enemy.hp > 0)) dealDamage(state, 'enemy', kind === 'damageAllTurn' ? state.turn : amount, false, enemy); break;
    case 'damageRandom': {
      const enemies = getEnemies(state).filter((enemy) => enemy.hp > 0); if (!enemies.length) break;
      const random = nextRandom(state.rngState); state.rngState = random.state;
      dealDamage(state, 'enemy', amount, false, enemies[Math.floor(random.value * enemies.length)]); break;
    }
    case 'thorns': state.powerStacks ??= {}; state.powerStacks.thorns = (state.powerStacks.thorns ?? 0) + amount; emitCombatCue(state, { kind: 'power', targetId: 'player', status: 'thorns', amount }); break;
    case 'plate': state.plate = (state.plate ?? 0) + amount; break;
    case 'upgradeHand': temporarilyUpgradeCards(state, state.hand); break;
    case 'upgradeDrawPile': {
      const eligible = state.drawPile.filter((card) => !card.upgraded && !CARD_DEFINITIONS[card.cardId].unupgradable); const selected: CardInstance[] = [];
      for (let index = 0; index < amount && eligible.length; index++) { const random = nextRandom(state.rngState); state.rngState = random.state; selected.push(...eligible.splice(Math.floor(random.value * eligible.length), 1)); }
      temporarilyUpgradeCards(state, selected); break;
    }
    case 'nextTurnBlock': state.relicCounters ??= {}; state.relicCounters['nextTurnBlock'] = (state.relicCounters.nextTurnBlock ?? 0) + amount; break;
    case 'nextTurnEnergy': resources(state).nextTurnEnergy += amount; break;
    case 'blockPerHand': gainBlock(state, 'player', state.hand.length * amount); break;
    case 'energyDraw': state.energy += amount; drawInto(state, amount); break;
    case 'loseHp': dealDamage(state, 'player', amount, true); break;
    case 'vigor': state.vigor = (state.vigor ?? 0) + amount; emitCombatCue(state, { kind: 'status', targetId: 'player', status: 'vigor', amount }); break;
    case 'orbSlots': state.orbSlotBonus = (state.orbSlotBonus ?? 0) + amount; emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'orbSlots', amount }); break;
    case 'run': break;
  }
}

export function triggerRelics(state: CombatState, trigger: RelicTrigger, context: RelicContext = {}): void {
  const relics = getActiveRelics(state);
  // Slot capacity must exist before any combat-start channel, regardless of inventory order.
  if (trigger === 'combatStart') relics.sort((a, b) => Number((b.effects ?? [b.effect]).some((effect) => effect.kind === 'orbSlots')) - Number((a.effects ?? [a.effect]).some((effect) => effect.kind === 'orbSlots')));
  for (const relic of relics) {
    const effects = relic.effects ?? [relic.effect];
    for (const [index, effect] of effects.entries()) {
      if (effect.trigger !== trigger || !matchesCondition(state, effect, context)) continue;
      const key = index ? `${relic.id}:${index}` : relic.id;
      if (!shouldFire(state, effect, key, context)) continue;
      state.relicCounters![key] = (state.relicCounters![key] ?? 0) + 1;
      emitRelicActivation(state, relic);
      withCombatTraceContext(state, { sourceId: 'player', card: context.card, effect: 'relic', label: relic.name, orbIndex: undefined, orbMode: undefined, resourceAction: 'relic' }, () => resolveRelicEffect(state, effect));
    }
  }
}
