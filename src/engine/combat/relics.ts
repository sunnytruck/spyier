import { CARD_DEFINITIONS } from '../../data/cards';
import { isRelicEligible, RELIC_DEFINITIONS, type RelicDefinition, type RelicTrigger } from '../../data/relics';
import type { CardInstance, CombatState } from '../../types/game';
import { drawInto } from '../actions/draw';
import { appendLog, applyGauge, gainBlock, healPlayer } from './state';
import { emitCombatCue } from '../../presentation/trace';
import { channelOrbs, generateCards, resources } from './resources';
import { getEnemies, getEnemyKey } from './targets';

export interface RelicContext {
  card?: CardInstance;
  enemyId?: string;
}

function matchesCondition(state: CombatState, relic: RelicDefinition, context: RelicContext): boolean {
  const effect = relic.effect;
  if (effect.turn !== undefined && effect.turn !== state.turn) return false;
  if (effect.hpAtMostPercent !== undefined && state.player.hp * 100 > state.player.maxHp * effect.hpAtMostPercent)
    return false;
  if (effect.trigger === 'cardPlayed') {
    const card = context.card;
    const definition = card && CARD_DEFINITIONS[card.cardId];
    if (!card || !definition || state.stats.cardsPlayed < 1) return false;
    if (effect.cardType && definition.type !== effect.cardType) return false;
    if (effect.cardEffect && !(card.upgraded ? definition.upgradedEffects : definition.effects).some((part) => part.type === effect.cardEffect))
      return false;
  }
  if (effect.trigger === 'enemyKilled')
    return getEnemies(state).some((enemy) => getEnemyKey(enemy) === context.enemyId && enemy.hp <= 0);
  return true;
}

/** Persisted numeric counters keep hooks idempotent after cloning, save/load, and repeated callbacks. */
function shouldFire(state: CombatState, relic: RelicDefinition, context: RelicContext): boolean {
  const { id, effect } = relic;
  const counters = state.relicCounters ??= {};
  if (effect.trigger === 'enemyKilled') {
    const key = `kill:${id}:${context.enemyId}`;
    if (counters[key]) return false;
    counters[key] = 1;
    return true;
  }
  if (effect.trigger === 'cardPlayed') {
    const serial = state.stats.cardsPlayed;
    if ((counters[`card:${id}`] ?? 0) >= serial) return false;
    counters[`card:${id}`] = serial;
    if (effect.scope === 'battle' && (counters[id] ?? 0) > 0) return false;
    if (effect.scope === 'turn') {
      if (counters[`seen-turn:${id}`] !== state.turn) {
        counters[`seen-turn:${id}`] = state.turn;
        counters[`seen:${id}`] = 0;
      }
      counters[`seen:${id}`] = (counters[`seen:${id}`] ?? 0) + 1;
      return counters[`seen:${id}`] === (effect.atCard ?? 1);
    }
    return true;
  }
  if (effect.trigger === 'turnStart') {
    if (counters[`turn:${id}`] === state.turn) return false;
    counters[`turn:${id}`] = state.turn;
    return true;
  }
  return (counters[id] ?? 0) === 0;
}

/** Counters belong to this battle, preventing repeated first-attack/victory rewards. */
export function triggerRelics(state: CombatState, trigger: RelicTrigger, context: RelicContext = {}): void {
  for (const id of new Set(state.relicIds ?? [])) {
    const relic = RELIC_DEFINITIONS[id];
    if (!isRelicEligible(id, state.classId) || relic.effect.trigger !== trigger) continue;
    if (!matchesCondition(state, relic, context) || !shouldFire(state, relic, context)) continue;
    state.relicCounters![id] = (state.relicCounters![id] ?? 0) + 1;
    const { kind, amount } = relic.effect;
    appendLog(state, `レリック「${relic.name}」が発動。`);
    switch (kind) {
      case 'block':
        gainBlock(state, 'player', amount);
        break;
      case 'strength':
        state.player.strength += amount;
        emitCombatCue(state, { kind: 'status', sourceId: 'player', targetId: 'player', status: 'strength', amount, label: relic.name });
        break;
      case 'draw':
        drawInto(state, amount);
        break;
      case 'energy':
        state.energy += amount;
        emitCombatCue(state, { kind: 'resource', sourceId: 'player', targetId: 'player', resource: 'energy', amount, label: relic.name });
        break;
      case 'heal':
        healPlayer(state, amount);
        break;
      case 'gauge':
        applyGauge(state, amount);
        break;
      case 'enemyWeak':
      case 'enemyVulnerable':
      case 'enemyPoison': {
        const status = kind === 'enemyWeak' ? 'weak' : kind === 'enemyVulnerable' ? 'vulnerable' : 'poison';
        for (const enemy of getEnemies(state).filter((enemy) => enemy.hp > 0)) {
          enemy[status] += amount;
          emitCombatCue(state, { kind: 'status', sourceId: 'player', targetId: getEnemyKey(enemy), status, amount, label: relic.name });
        }
        break;
      }
      case 'cleansePoison': {
        const removed = Math.min(state.player.poison, amount);
        state.player.poison -= removed;
        if (removed) emitCombatCue(state, { kind: 'status', targetId: 'player', status: 'poison', amount: -removed, label: relic.name });
        break;
      }
      case 'knife':
        generateCards(state, 'token_knife', amount, 'hand');
        break;
      case 'stars': {
        const current = resources(state);
        current.stars += amount;
        current.starsGainedThisTurn += amount;
        emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'stars', amount, label: relic.name });
        break;
      }
      case 'summon':
        resources(state).ostyHp += amount;
        emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'ostyHp', amount, label: relic.name });
        break;
      case 'frost':
        channelOrbs(state, 'frost', amount);
        break;
    }
  }
}
