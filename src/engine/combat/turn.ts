import type { Actor, CombatState, EnemyState } from '../../types/game';
import { getEnemyDefinition } from '../../data/enemies';
import { drawInto } from '../actions/draw';
import { calculateDamage } from './damage';
import { appendLog, dealDamage, finishIfNeeded, gainBlock } from './state';
import { findEnemy, getEnemies, getEnemyKey } from './targets';
import { triggerRelics } from './relics';
import { generateCards, resources, triggerPassiveOrbs } from './resources';
import { CARD_DEFINITIONS } from '../../data/cards';
import { emitCombatCue, withCombatTraceContext } from '../../presentation/trace';
import { advanceEnemyIntent, enemySurvivesTurnStart, predictedEnemyAttackContext } from './enemyAI';

function expireStatuses(actor: Actor): void {
  actor.weak = Math.max(0, actor.weak - 1);
  actor.vulnerable = Math.max(0, actor.vulnerable - 1);
}

function tickPoison(state: CombatState, target: 'player' | 'enemy', enemy?: EnemyState): void {
  const actor = target === 'player' ? state.player : enemy!;
  if (actor.poison <= 0 || actor.hp <= 0) return;
  appendLog(state, `${actor.name}の毒が${actor.poison}ダメージ。ブロックを無視。`);
  withCombatTraceContext(state, { sourceId: undefined, card: undefined, effect: 'poison' }, () => dealDamage(state, target, actor.poison, true, enemy));
  actor.poison = Math.max(0, actor.poison - 1);
}

function startPlayerPowers(state: CombatState): void {
  if (state.stillness > 0) gainBlock(state, 'player', state.stillness);
  const stacks = state.powerStacks ?? {};
  if (stacks.strengthOnTurn) {
    state.player.strength += stacks.strengthOnTurn;
    appendLog(state, `岩の成長：筋力 +${stacks.strengthOnTurn}。`);
    emitCombatCue(state, { kind: 'status', sourceId: 'player', targetId: 'player', status: 'strength', amount: stacks.strengthOnTurn });
  }
  if (stacks.poisonAura) {
    for (const enemy of getEnemies(state).filter((enemy) => enemy.hp > 0)) {
      enemy.poison += stacks.poisonAura;
      emitCombatCue(state, { kind: 'status', sourceId: 'player', targetId: getEnemyKey(enemy), status: 'poison', amount: stacks.poisonAura });
    }
    appendLog(state, `毒苔の教壇：すべての敵に毒 +${stacks.poisonAura}。`);
  }
  if (stacks.knivesOnTurn) generateCards(state, 'token_knife', stacks.knivesOnTurn, 'hand');
  if (stacks.focusOnTurn) {
    resources(state).focus += stacks.focusOnTurn;
    emitCombatCue(state, { kind: 'resource', sourceId: 'player', targetId: 'player', resource: 'focus', amount: stacks.focusOnTurn });
  }
}

/** Internal atomic turn resolution. Each living enemy owns its turn and statuses. */
export function resolveEndTurn(state: CombatState): void {
  for (const enemy of getEnemies(state).filter((enemy) => enemy.hp > 0)) {
    if (!getEnemyDefinition(enemy.id)?.intents.length)
      throw new RangeError(`敵「${enemy.id}」の行動パターンがありません。`);
  }
  appendLog(state, `ターン${state.turn}を終了。`);
  emitCombatCue(state, { kind: 'turn', label: '敵のターン', sourceId: 'player' });
  const retained = [];
  const discarded = [];
  const exhausted = [];
  for (const card of state.hand) {
    const definition = CARD_DEFINITIONS[card.cardId];
    if (definition?.ethereal) {
      state.exhaustPile.push(card);
      exhausted.push(card);
    }
    else if (card.upgraded ? definition?.upgradedRetain ?? definition?.retain : definition?.retain) retained.push(card);
    else {
      state.discardPile.push(card);
      discarded.push(card);
    }
  }
  state.hand = retained;
  if (discarded.length) emitCombatCue(state, { kind: 'discard', sourceId: 'player', cards: discarded, fromZone: 'hand', toZone: 'discardPile' });
  if (exhausted.length) emitCombatCue(state, { kind: 'exhaust', sourceId: 'player', cards: exhausted, fromZone: 'hand', toZone: 'exhaustPile' });
  triggerPassiveOrbs(state);
  if (finishIfNeeded(state)) return;
  if (state.classResources) {
    const expiredFocus = state.classResources.temporaryFocus;
    state.classResources.focus -= state.classResources.temporaryFocus;
    state.classResources.temporaryFocus = 0;
    if (expiredFocus) emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'focus', amount: -expiredFocus });
  }
  expireStatuses(state.player);

  // Clear last round's block together, so support received this round survives the ally's action.
  for (const enemy of getEnemies(state)) if (enemy.hp > 0) enemy.block = 0;

  for (const enemy of getEnemies(state)) {
    if (enemy.hp <= 0) continue;
    tickPoison(state, 'enemy', enemy);
    if (finishIfNeeded(state)) return;
    if (enemy.hp <= 0) continue;
    if ((enemy.doom ?? 0) >= enemy.hp) {
      appendLog(state, `${enemy.name}の破滅がHPに達した。`);
      withCombatTraceContext(state, { sourceId: 'player', effect: 'doom' }, () => dealDamage(state, 'enemy', enemy.hp, true, enemy));
      if (finishIfNeeded(state)) return;
      continue;
    }

    const intent = enemy.intent;
    appendLog(state, `${enemy.name}の「${intent.label}」！`);
    withCombatTraceContext(state, { sourceId: getEnemyKey(enemy), effect: 'enemyIntent', label: intent.label }, () => {
      emitCombatCue(state, { kind: 'turn', sourceId: getEnemyKey(enemy), targetId: 'player', label: intent.label });
      if (intent.block) gainBlock(state, 'enemy', intent.block, enemy);
      if (intent.strength) {
        enemy.strength += intent.strength;
        appendLog(state, `${enemy.name}の筋力 +${intent.strength}。`);
        emitCombatCue(state, { kind: 'status', targetId: getEnemyKey(enemy), status: 'strength', amount: intent.strength });
      }
      for (const ally of getEnemies(state).filter((ally) => ally !== enemy && ally.hp > 0)) {
        if (intent.alliesBlock) gainBlock(state, 'enemy', intent.alliesBlock, ally);
        if (intent.alliesStrength) {
          ally.strength += intent.alliesStrength;
          appendLog(state, `${enemy.name}の支援で${ally.name}の筋力 +${intent.alliesStrength}。`);
          emitCombatCue(state, { kind: 'status', sourceId: getEnemyKey(enemy), targetId: getEnemyKey(ally), status: 'strength', amount: intent.alliesStrength });
        }
      }
      if (intent.damage !== undefined) {
        for (
          let hit = 0;
          hit < (intent.hits ?? 1) && state.phase === 'player' && enemy.hp > 0;
          hit += 1
        ) {
          const damage = calculateDamage(intent.damage, enemy, state.player);
          if (intent.allTargets && (state.classResources?.ostyHp ?? 0) > 0) {
            const summonDamage = Math.min(state.classResources!.ostyHp, damage);
            state.classResources!.ostyHp -= summonDamage;
            appendLog(state, `全体攻撃が召喚体にも${summonDamage}ダメージ。`);
            emitCombatCue(state, { kind: 'resource', sourceId: getEnemyKey(enemy), targetId: 'player', resource: 'ostyHp', amount: -summonDamage });
          }
          dealDamage(state, 'player', damage, false, undefined, { bypassSummon: intent.allTargets });
          if (state.phase === 'player' && (state.powerStacks?.thorns ?? 0) > 0) {
            withCombatTraceContext(state, { sourceId: 'player', effect: 'thorns' }, () => dealDamage(state, 'enemy', state.powerStacks!.thorns!, false, enemy));
          }
        }
      }
    });
    if (finishIfNeeded(state)) return;
    if (enemy.hp <= 0) continue;
    if (intent.weak) {
      state.player.weak += intent.weak;
      appendLog(state, `岩尊けいとに弱体 +${intent.weak}。`);
      emitCombatCue(state, { kind: 'status', sourceId: getEnemyKey(enemy), targetId: 'player', status: 'weak', amount: intent.weak });
    }
    for (const status of ['vulnerable', 'poison'] as const) {
      const amount = intent[status];
      if (!amount) continue;
      state.player[status] += amount;
      appendLog(state, `岩尊けいとに${status === 'poison' ? '毒' : '脆弱'} +${amount}。`);
      emitCombatCue(state, { kind: 'status', sourceId: getEnemyKey(enemy), targetId: 'player', status, amount });
    }
    expireStatuses(enemy);
    advanceEnemyIntent(enemy, state.turn + 1);
  }

  state.turn += 1;
  state.player.block = 0;
  tickPoison(state, 'player');
  if (finishIfNeeded(state)) return;
  state.energy = state.maxEnergy + (state.classResources?.nextTurnEnergy ?? 0);
  if (state.classResources) {
    state.classResources.nextTurnEnergy = 0;
    state.classResources.starsGainedThisTurn = 0;
  }
  state.cardsPlayedThisTurn = 0;
  appendLog(state, `ターン${state.turn}。朝活しよ。エナジーを回復し、5枚引く。`);
  emitCombatCue(state, { kind: 'turn', sourceId: 'player', targetId: 'player', amount: state.turn, label: 'あなたのターン' });
  startPlayerPowers(state);
  triggerRelics(state, 'turnStart');
  drawInto(state, 5 + (state.powerStacks?.drawOnTurn ?? 0));
}

/** Incoming per-hit attack after player status expiry, before shared block. */
export function predictEnemyDamage(state: CombatState, enemyId?: string): number {
  const enemy = findEnemy(state, enemyId);
  if (!enemy) return 0;
  const intent = enemy.intent;
  if (intent.damage === undefined || !enemySurvivesTurnStart(enemy)) return 0;
  const { attacker, defender } = predictedEnemyAttackContext(state, enemy);
  return calculateDamage(intent.damage, attacker, defender);
}
