import { RELIC_DEFINITIONS } from '../../data/relics';
import type { CombatState } from '../../types/game';
import { drawInto } from '../actions/draw';
import { appendLog, applyGauge, gainBlock, healPlayer } from './state';
import { emitCombatCue } from '../../presentation/trace';

type RelicTrigger = 'combatStart' | 'turnStart' | 'firstAttack' | 'victory';

/** Counters belong to this battle, preventing repeated first-attack/victory rewards. */
export function triggerRelics(state: CombatState, trigger: RelicTrigger): void {
  for (const id of new Set(state.relicIds ?? [])) {
    const relic = RELIC_DEFINITIONS[id];
    if (!relic || relic.effect.trigger !== trigger) continue;
    state.relicCounters ??= {};
    if (trigger === 'turnStart') {
      if (state.relicCounters[`turn:${id}`] === state.turn) continue;
      state.relicCounters[`turn:${id}`] = state.turn;
    } else if ((state.relicCounters[id] ?? 0) > 0) continue;
    state.relicCounters[id] = (state.relicCounters[id] ?? 0) + 1;
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
    }
  }
}
