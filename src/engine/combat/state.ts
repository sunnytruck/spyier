import type { BattleLog, CombatEvent, CombatState, EnemyState, Target } from '../../types/game';
import { findEnemy, getEnemies, getEnemyKey, normalizeInto } from './targets';

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
  if (state.phase !== 'player') return true;
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.phase = 'defeat';
    appendLog(state, '岩尊けいとは静かに横たわった。「8時か、ねんねやな」', 'result');
    return true;
  }
  if (getEnemies(state).every((enemy) => enemy.hp <= 0)) {
    getEnemies(state).forEach((enemy) => {
      enemy.hp = 0;
    });
    state.phase = 'victory';
    appendLog(state, `ほいっと〜！ 敵をすべて鎮めた。じっと教の勝利！`, 'result');
    return true;
  }
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
  const blocked = bypassBlock ? 0 : Math.min(actor.block, raw);
  actor.block -= blocked;
  let remaining = raw - blocked;
  if (target === 'player' && !bypassBlock && state.classResources && state.classResources.ostyHp > 0) {
    const absorbed = Math.min(state.classResources.ostyHp, remaining);
    state.classResources.ostyHp -= absorbed;
    remaining -= absorbed;
    if (absorbed > 0) appendLog(state, `召喚体が${absorbed}ダメージを引き受けた。`);
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
  finishIfNeeded(state);
  return damage;
}

export function healPlayer(state: CombatState, amount: number): void {
  const healed = Math.max(0, Math.min(state.player.maxHp - state.player.hp, amount));
  state.player.hp += healed;
  emitEvent(state, 'player', 'heal', healed);
  if (healed > 0) appendLog(state, `${healed}HP回復。`);
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
}
