import { CARD_DEFINITIONS } from '../../data/cards';
import type { CardInstance, CombatState } from '../../types/game';
import { emitCombatCue, withCombatTraceContext } from '../../presentation/trace';
import { nextRandom } from '../random';
import { resolveEffects } from '../effects/resolve';
import { channelOrbs, triggerPassiveOrbs } from './resources';
import { getEnemies, getEnemyKey } from './targets';

/** Existing stacks react before the new card's effects; a power never triggers itself. */
export function triggerCardPowers(state: CombatState, card: CardInstance): void {
  if (state.phase !== 'player') return;
  const stacks = state.powerStacks ?? {};
  if (stacks.strengthOnCardTemporary) {
    const amount = stacks.strengthOnCardTemporary;
    state.player.strength += amount;
    (state.turnModifiers ??= []).push({ kind: 'status', targetId: 'player', status: 'strength', amount, expireAt: 'playerEnd' });
    emitCombatCue(state, { kind: 'status', sourceId: 'player', targetId: 'player', status: 'strength', amount, label: 'このターンの説法' });
  }
  if (CARD_DEFINITIONS[card.cardId]?.type !== 'power') return;
  if (stacks.energyOnPower) {
    state.energy += stacks.energyOnPower;
    emitCombatCue(state, { kind: 'resource', sourceId: 'player', targetId: 'player', resource: 'energy', amount: stacks.energyOnPower, label: 'パワー回路' });
  }
  if (stacks.lightningOnPower) channelOrbs(state, 'lightning', stacks.lightningOnPower);
}

/** Turn powers share the normal effect engine, ordered before the five-card draw. */
export function triggerTurnPowers(state: CombatState): void {
  const stacks = state.powerStacks ?? {};
  if (stacks.doomRandomOnTurn) {
    const enemies = getEnemies(state).filter((enemy) => enemy.hp > 0);
    if (enemies.length) {
      const random = nextRandom(state.rngState); state.rngState = random.state;
      const enemy = enemies[Math.floor(random.value * enemies.length)];
      withCombatTraceContext(state, { sourceId: 'player', effect: 'doom' }, () => resolveEffects(state,
        [{ type: 'doom', amount: stacks.doomRandomOnTurn! }], { defense: false }, { targetId: getEnemyKey(enemy) }));
    }
  }
  for (let count = 0; count < (stacks.orbPassiveOnTurn ?? 0) && state.phase === 'player'; count++) {
    const last = (state.classResources?.orbs.length ?? 0) - 1;
    if (last >= 0) triggerPassiveOrbs(state, { index: last });
  }
  if (stacks.colorlessOnTurn) resolveEffects(state,
    [{ type: 'generateRandom', pool: 'colorless', amount: stacks.colorlessOnTurn, destination: 'hand' }]);
}
