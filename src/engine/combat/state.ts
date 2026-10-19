import type { BattleLog, CombatEvent, CombatState, EnemyState, Target } from '../../types/game';
import { findEnemy, getEnemies, getEnemyKey, normalizeInto } from './targets';
import { emitCombatCue, traceCombatDeaths } from '../../presentation/trace';

/** Internal helpers deliberately mutate a reducer-owned clone, never live UI state. */
export function appendLog(
  state: CombatState,
  text: string,
  kind: BattleLog['kind'] = 'info',
): void {
  state.log.push({ id: state.nextId++, turn: state.turn, text, kind });
  // Keep save files bounded during an unusually long battle.
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

export function emitEvent(
  state: CombatState,
  target: Target,
  kind: CombatEvent['kind'],
  amount: number,
  enemy?: EnemyState,
): void {
  if (amount > 0 || (kind === 'gauge' && amount < 0)) {
    const event: CombatEvent = { id: state.nextId++, target, kind, amount };
    if (enemy?.instanceId) event.enemyId = getEnemyKey(enemy);
    state.events.push(event);
  }
}

export function finishIfNeeded(state: CombatState): boolean {
  if (state.phase !== 'player') {
    traceCombatDeaths(state);
    return true;
  }
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.phase = 'defeat';
    appendLog(state, '岩尊けいとは静かに横たわった。「8時か、ねんねやな」', 'result');
    traceCombatDeaths(state);
    return true;
  }
  if (getEnemies(state).every((enemy) => enemy.hp <= 0)) {
    getEnemies(state).forEach((enemy) => {
      enemy.hp = 0;
    });
    state.phase = 'victory';
    appendLog(state, `ほいっと〜！ 敵をすべて鎮めた。じっと教の勝利！`, 'result');
    traceCombatDeaths(state);
    return true;
  }
  traceCombatDeaths(state);
  return false;
}

export function gainBlock(
  state: CombatState,
  target: Target,
  amount: number,
  enemy?: EnemyState,
): void {
  const gained = Math.max(0, Math.floor(amount));
  if (gained === 0) return;
  const actor = target === 'player' ? state.player : (enemy ?? findEnemy(state));
  if (!actor || actor.hp <= 0) return;
  actor.block += gained;
  emitEvent(state, target, 'block', gained, enemy);
  appendLog(state, `${actor.name}は${gained}ブロックを得た。`, 'block');
  emitCombatCue(state, {
    kind: 'block',
    targetId: target === 'player' ? 'player' : getEnemyKey(actor as EnemyState),
    amount: gained,
  });
}

/** Returns actual HP damage; poison uses bypassBlock. */
export function dealDamage(
  state: CombatState,
  target: Target,
  amount: number,
  bypassBlock = false,
  enemy?: EnemyState,
): number {
  const actor = target === 'player' ? state.player : (enemy ?? findEnemy(state));
  if (!actor || actor.hp <= 0) return 0;
  const raw = Math.max(0, Math.floor(amount));
  const targetId = target === 'player' ? 'player' : getEnemyKey(actor as EnemyState);
  emitCombatCue(state, { kind: 'attack', targetId, amount: raw });
  const blocked = bypassBlock ? 0 : Math.min(actor.block, raw);
  actor.block -= blocked;
  let remaining = raw - blocked;
  let absorbedBySummon = 0;
  if (target === 'player' && !bypassBlock && state.classResources && state.classResources.ostyHp > 0) {
    const absorbed = Math.min(state.classResources.ostyHp, remaining);
    absorbedBySummon = absorbed;
    state.classResources.ostyHp -= absorbed;
    remaining -= absorbed;
    if (absorbed > 0) appendLog(state, `召喚体が${absorbed}ダメージを引き受けた。`);
    if (absorbed > 0)
      emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'ostyHp', amount: -absorbed });
  }
  const damage = Math.min(actor.hp, remaining);
  actor.hp -= damage;
  if (target === 'enemy') state.stats.damageDealt += damage;
  emitEvent(
    state,
    target,
    'damage',
    damage,
    target === 'enemy' ? (actor as EnemyState) : undefined,
  );
  appendLog(
    state,
    `${actor.name}に${damage}ダメージ${blocked > 0 ? `（${blocked}ブロック）` : ''}。`,
    'damage',
  );
  normalizeInto(state);
  emitCombatCue(state, { kind: 'impact', targetId, amount: damage, blocked,
    ...(absorbedBySummon > 0 ? { absorbed: absorbedBySummon } : {}) });
  finishIfNeeded(state);
  return damage;
}

export function healPlayer(state: CombatState, amount: number): void {
  const healed = Math.max(0, Math.min(state.player.maxHp - state.player.hp, amount));
  state.player.hp += healed;
  emitEvent(state, 'player', 'heal', healed);
  if (healed > 0) appendLog(state, `${healed}HP回復。`);
  if (healed > 0) emitCombatCue(state, { kind: 'heal', targetId: 'player', amount: healed });
}

export function applyGauge(state: CombatState, delta: number): void {
  const old = state.jitto;
  state.jitto = Math.max(0, Math.min(100, state.jitto + Math.trunc(delta)));
  const difference = state.jitto - old;
  if (difference === 0) return;
  emitEvent(state, 'player', 'gauge', difference);
  appendLog(state, `じっと ${difference > 0 ? '+' : ''}${difference}。`, 'gauge');
  if (old < 100 && state.jitto === 100)
    appendLog(state, '神格化！ 岩尊神拳に神の力が宿った。', 'gauge');
  if (old === 100 && state.jitto < 100)
    appendLog(state, '神格化が解けた。再びじっとを積み重ねよう。', 'gauge');
  emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'jitto', amount: difference });
}
