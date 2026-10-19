import type { CombatState, EnemyState } from '../../types/game';

export function getEnemyKey(enemy: EnemyState): string {
  return enemy.instanceId ?? enemy.id;
}

/** Singleton states deliberately honor state.enemy for legacy saves and fixtures. */
export function getEnemies(state: CombatState): EnemyState[] {
  return state.enemies && state.enemies.length > 1 ? state.enemies : [state.enemy];
}

export function findEnemy(state: CombatState, id?: string): EnemyState | undefined {
  const enemies = getEnemies(state);
  const selected = id ?? state.selectedEnemyId;
  if (selected) {
    const enemy = enemies.find(
      (candidate) => getEnemyKey(candidate) === selected && candidate.hp > 0,
    );
    if (enemy || id !== undefined) return enemy;
  }
  return enemies.find((enemy) => enemy.hp > 0);
}

/** Internal normalization restores the alias after JSON makes duplicate objects. */
export function normalizeInto(state: CombatState): void {
  if (state.enemies && state.enemies.length > 1) state.enemy = state.enemies[0];
  else if (state.enemies) state.enemies = [state.enemy];
  if (state.selectedEnemyId || getEnemies(state).length > 1) {
    const alive = getEnemies(state).filter((enemy) => enemy.hp > 0);
    const selected =
      alive.find((enemy) => getEnemyKey(enemy) === state.selectedEnemyId) ?? alive[0];
    state.selectedEnemyId = selected ? getEnemyKey(selected) : undefined;
  }
}

export function normalizeCombatState(state: CombatState): CombatState {
  const next = structuredClone(state);
  normalizeInto(next);
  return next;
}
