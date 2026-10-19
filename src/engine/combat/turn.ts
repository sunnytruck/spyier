import type { Actor, CombatState, EnemyState } from '../../types/game';
import { getEnemyDefinition } from '../../data/enemies';
import { drawInto } from '../actions/draw';
import { calculateDamage } from './damage';
import { appendLog, capEnemyAttackDamage, dealDamage, finishIfNeeded, gainBlock } from './state';
import { findEnemy, getEnemies, getEnemyKey } from './targets';
import { triggerRelics } from './relics';
import { generateCards, resources, triggerPassiveOrbs } from './resources';
import { CARD_DEFINITIONS } from '../../data/cards';
import { emitCombatCue, withCombatTraceContext } from '../../presentation/trace';
import { advanceEnemyIntent, enemySurvivesTurnStart, predictedEnemyAttackContext } from './enemyAI';
import { resolveEffects } from '../effects/resolve';

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
  if (stacks.energyOnTurn) {
    state.energy += stacks.energyOnTurn;
    emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'energy', amount: stacks.energyOnTurn, label: '不滅の火種' });
  }
}

function expireTurnModifiers(state: CombatState): void {
  const modifiers = state.turnModifiers;
  if (!modifiers) return;
  delete state.turnModifiers;
  for (const modifier of modifiers) {
    if (modifier.kind === 'power') {
      if (state.powerStacks) state.powerStacks[modifier.power] = Math.max(0, (state.powerStacks[modifier.power] ?? 0) - modifier.amount);
      if (modifier.power === 'stillness') state.stillness = Math.max(0, state.stillness - modifier.amount);
      emitCombatCue(state, { kind: 'power', targetId: 'player', status: modifier.power, amount: -modifier.amount, label: '一時効果が終了' });
    } else {
      const actor = modifier.targetId === 'player' ? state.player : getEnemies(state).find((enemy) => getEnemyKey(enemy) === modifier.targetId);
      if (!actor) continue;
      actor[modifier.status] = modifier.status === 'strength' ? actor[modifier.status] - modifier.amount : Math.max(0, actor[modifier.status] - modifier.amount);
      emitCombatCue(state, { kind: 'status', targetId: modifier.targetId, status: modifier.status, amount: -modifier.amount, label: '一時効果が終了' });
    }
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
    if (card.upgraded ? definition?.upgradedEthereal ?? definition?.ethereal : definition?.ethereal) {
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

    if ((enemy.stun ?? 0) > 0) {
      appendLog(state, `${enemy.name}はスタンで行動を休んだ。`);
      emitCombatCue(state, { kind: 'turn', sourceId: getEnemyKey(enemy), targetId: getEnemyKey(enemy), label: 'スタン・行動休止' });
      enemy.stun! -= 1;
      if (enemy.stun === 0) delete enemy.stun;
      expireStatuses(enemy);
      advanceEnemyIntent(enemy, state.turn + 1);
      emitCombatCue(state, { kind: 'status', sourceId: getEnemyKey(enemy), targetId: getEnemyKey(enemy), status: 'stun', amount: -1, label: 'スタンを1回消費' });
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
            emitCombatCue(state, { kind: 'resource', sourceId: getEnemyKey(enemy), targetId: 'osty', resource: 'ostyHp', amount: -summonDamage, resourceAction: 'sweep', label: '全体攻撃で岩霊も被弾' });
            if (state.classResources!.ostyHp === 0)
              emitCombatCue(state, { kind: 'resource', sourceId: getEnemyKey(enemy), targetId: 'osty', resource: 'ostyHp', amount: 0, resourceAction: 'vanish', label: '岩霊の消滅' });
          }
          dealDamage(state, 'player', damage, false, undefined, { bypassSummon: intent.allTargets, enemyAttack: true });
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

  if ((state.intangible ?? 0) > 0) {
    state.intangible! -= 1;
    if (state.intangible === 0) delete state.intangible;
    emitCombatCue(state, { kind: 'status', targetId: 'player', status: 'intangible', amount: -1, label: '霊体の残りターン' });
  }
  expireTurnModifiers(state);
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
  const scheduled = state.scheduledEffects;
  if (scheduled) {
    // Remove the persisted queue before executing it. New schedules target the
    // following turn, and a reload cannot replay effects that already fired.
    delete state.scheduledEffects;
    for (const entry of scheduled) {
      if (state.phase !== 'player') break;
      const definition = entry.sourceCard ? CARD_DEFINITIONS[entry.sourceCard.cardId] : undefined;
      resolveEffects(state, entry.effects, { defense: definition?.defense ?? false }, { sourceCard: entry.sourceCard });
    }
  }
  drawInto(state, 5 + (state.powerStacks?.drawOnTurn ?? 0));
}

/** Incoming per-hit attack after player status expiry, before shared block. */
export function predictEnemyDamage(state: CombatState, enemyId?: string): number {
  const enemy = findEnemy(state, enemyId);
  if (!enemy) return 0;
  const intent = enemy.intent;
  if (intent.damage === undefined || !enemySurvivesTurnStart(enemy) || (enemy.stun ?? 0) > 0) return 0;
  const { attacker, defender } = predictedEnemyAttackContext(state, enemy);
  return capEnemyAttackDamage(state, calculateDamage(intent.damage, attacker, defender));
}
