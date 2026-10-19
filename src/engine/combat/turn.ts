import type { Actor, CombatState, EnemyState } from '../../types/game';
import { getEnemyDefinition } from '../../data/enemies';
import { drawInto } from '../actions/draw';
import { calculateDamage } from './damage';
import { appendLog, dealDamage, finishIfNeeded, gainBlock } from './state';
import { findEnemy, getEnemies } from './targets';
import { triggerRelics } from './relics';

function expireStatuses(actor: Actor): void {
  actor.weak = Math.max(0, actor.weak - 1);
  actor.vulnerable = Math.max(0, actor.vulnerable - 1);
}

function tickPoison(state: CombatState, target: 'player' | 'enemy', enemy?: EnemyState): void {
  const actor = target === 'player' ? state.player : enemy!;
  if (actor.poison <= 0 || actor.hp <= 0) return;
  appendLog(state, `${actor.name}の毒が${actor.poison}ダメージ。ブロックを無視。`);
  dealDamage(state, target, actor.poison, true, enemy);
  actor.poison = Math.max(0, actor.poison - 1);
}

function startPlayerPowers(state: CombatState): void {
  if (state.stillness > 0) gainBlock(state, 'player', state.stillness);
  const stacks = state.powerStacks ?? {};
  if (stacks.strengthOnTurn) {
    state.player.strength += stacks.strengthOnTurn;
    appendLog(state, `岩の成長：筋力 +${stacks.strengthOnTurn}。`);
  }
  if (stacks.poisonAura) {
    for (const enemy of getEnemies(state).filter((enemy) => enemy.hp > 0))
      enemy.poison += stacks.poisonAura;
    appendLog(state, `毒苔の教壇：すべての敵に毒 +${stacks.poisonAura}。`);
  }
}

/** Internal atomic turn resolution. Each living enemy owns its turn and statuses. */
export function resolveEndTurn(state: CombatState): void {
  for (const enemy of getEnemies(state).filter((enemy) => enemy.hp > 0)) {
    if (!getEnemyDefinition(enemy.id)?.intents.length)
      throw new RangeError(`敵「${enemy.id}」の行動パターンがありません。`);
  }
  appendLog(state, `ターン${state.turn}を終了。`);
  state.discardPile.push(...state.hand);
  state.hand = [];
  expireStatuses(state.player);

  for (const enemy of getEnemies(state)) {
    if (enemy.hp <= 0) continue;
    enemy.block = 0;
    tickPoison(state, 'enemy', enemy);
    if (finishIfNeeded(state)) return;
    if (enemy.hp <= 0) continue;

    const intent = enemy.intent;
    appendLog(state, `${enemy.name}の「${intent.label}」！`);
    if (intent.block) gainBlock(state, 'enemy', intent.block, enemy);
    if (intent.strength) {
      enemy.strength += intent.strength;
      appendLog(state, `${enemy.name}の筋力 +${intent.strength}。`);
    }
    if (intent.damage !== undefined) {
      for (
        let hit = 0;
        hit < (intent.hits ?? 1) && state.phase === 'player' && enemy.hp > 0;
        hit += 1
      ) {
        dealDamage(state, 'player', calculateDamage(intent.damage, enemy, state.player));
        if (state.phase === 'player' && (state.powerStacks?.thorns ?? 0) > 0) {
          dealDamage(state, 'enemy', state.powerStacks!.thorns!, false, enemy);
        }
      }
    }
    if (finishIfNeeded(state)) return;
    if (enemy.hp <= 0) continue;
    if (intent.weak) {
      state.player.weak += intent.weak;
      appendLog(state, `岩尊けいとに弱体 +${intent.weak}。`);
    }
    expireStatuses(enemy);
    const definition = getEnemyDefinition(enemy.id)!;
    enemy.intentIndex = (enemy.intentIndex + 1) % definition.intents.length;
    enemy.intent = { ...definition.intents[enemy.intentIndex] };
  }

  state.turn += 1;
  state.player.block = 0;
  tickPoison(state, 'player');
  if (finishIfNeeded(state)) return;
  state.energy = state.maxEnergy;
  state.cardsPlayedThisTurn = 0;
  appendLog(state, `ターン${state.turn}。朝活しよ。エナジーを回復し、5枚引く。`);
  startPlayerPowers(state);
  triggerRelics(state, 'turnStart');
  drawInto(state, 5 + (state.powerStacks?.drawOnTurn ?? 0));
}

/** Incoming per-hit attack after player status expiry, before shared block. */
export function predictEnemyDamage(state: CombatState, enemyId?: string): number {
  const enemy = findEnemy(state, enemyId);
  if (!enemy) return 0;
  const intent = enemy.intent;
  if (intent.damage === undefined || enemy.hp <= enemy.poison) return 0;
  const attacker = { ...enemy, strength: enemy.strength + (intent.strength ?? 0) };
  const defender = { ...state.player, vulnerable: Math.max(0, state.player.vulnerable - 1) };
  return calculateDamage(intent.damage, attacker, defender);
}
