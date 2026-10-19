import { getEnemyDefinition } from '../../data/enemies';
import type { CardType, CombatState, EnemyIntent, EnemyState } from '../../types/game';
import { appendLog, gainBlock } from './state';
import { getEnemies, getEnemyKey } from './targets';
import { emitCombatCue } from '../../presentation/trace';

/** Reactions change visible stats, never the action which has already been announced. */
export function reactToPlayerCard(state: CombatState, cardType: CardType): void {
  for (const enemy of getEnemies(state)) {
    if (enemy.hp <= 0) continue;
    const reaction = getEnemyDefinition(enemy.id)?.reaction;
    if (!reaction || reaction.cardType !== cardType) continue;
    appendLog(state, `${enemy.name}が${cardType === 'skill' ? 'スキル' : cardType === 'power' ? 'パワー' : '攻撃'}に反応！`);
    if (reaction.block) gainBlock(state, 'enemy', reaction.block, enemy);
    if (reaction.strength) {
      enemy.strength += reaction.strength;
      appendLog(state, `${enemy.name}の筋力 +${reaction.strength}。`);
      emitCombatCue(state, { kind: 'status', sourceId: getEnemyKey(enemy), targetId: getEnemyKey(enemy), status: 'strength', amount: reaction.strength });
    }
  }
}

/** Phase checks occur only while announcing the NEXT action, after the saved one executes. */
export function advanceEnemyIntent(enemy: EnemyState, nextTurn: number): void {
  const definition = getEnemyDefinition(enemy.id);
  if (!definition?.intents.length) throw new RangeError(`敵「${enemy.id}」の行動パターンがありません。`);
  let phaseIndex: number | undefined;
  for (let index = 0; index < (definition.phases?.length ?? 0); index += 1) {
    const trigger = definition.phases![index].trigger;
    if (trigger.type === 'turn' ? nextTurn >= trigger.at : enemy.hp <= enemy.maxHp * trigger.ratio) phaseIndex = index;
  }
  // HP phases cannot revert due to later healing or data changes within a battle.
  if (enemy.intentPhase !== undefined && (phaseIndex === undefined || enemy.intentPhase > phaseIndex)) phaseIndex = enemy.intentPhase;
  const pattern = phaseIndex === undefined ? definition.intents : definition.phases?.[phaseIndex]?.intents;
  if (!pattern?.length) throw new RangeError(`敵「${enemy.id}」の段階別行動パターンがありません。`);
  enemy.intentIndex = phaseIndex !== enemy.intentPhase ? 0 : (enemy.intentIndex + 1) % pattern.length;
  if (phaseIndex === undefined) delete enemy.intentPhase;
  else enemy.intentPhase = phaseIndex;
  enemy.intent = { ...pattern[enemy.intentIndex] };
}

export function enemySurvivesTurnStart(enemy: EnemyState): boolean {
  const hpAfterPoison = enemy.hp - enemy.poison;
  return hpAfterPoison > 0 && (enemy.doom ?? 0) < hpAfterPoison;
}

/** The saved intent stays authoritative; a stun suppresses execution, not its pattern position. */
export function getDisplayedEnemyIntent(enemy: EnemyState): EnemyIntent {
  return (enemy.stun ?? 0) > 0
    ? { kind: 'defend', label: 'スタン・行動休止', description: '次の行動を1回休む。毒・破滅は処理し、その後は次の行動予告へ進む。' }
    : enemy.intent;
}

/** Earlier allies can grant strength or apply vulnerability before a later enemy attacks. */
export function predictedEnemyAttackContext(state: CombatState, target: EnemyState): {
  attacker: EnemyState;
  defender: CombatState['player'];
  intent: EnemyIntent;
} {
  let alliedStrength = 0;
  let vulnerability = Math.max(0, state.player.vulnerable - 1);
  for (const enemy of getEnemies(state)) {
    if (enemy === target) break;
    if (!enemySurvivesTurnStart(enemy) || (enemy.stun ?? 0) > 0) continue;
    alliedStrength += enemy.intent.alliesStrength ?? 0;
    vulnerability += enemy.intent.vulnerable ?? 0;
  }
  return {
    attacker: { ...target, strength: target.strength + alliedStrength + (target.intent.strength ?? 0) },
    defender: { ...state.player, vulnerable: vulnerability },
    intent: target.intent,
  };
}
