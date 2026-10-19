import type { Actor, CardDefinition, CombatState, Effect } from '../../types/game';
import { drawInto } from '../actions/draw';
import { calculateDamage } from '../combat/damage';
import {
  appendLog,
  applyGauge,
  dealDamage,
  emitEvent,
  gainBlock,
  healPlayer,
} from '../combat/state';
import { findEnemy, getEnemies } from '../combat/targets';

export interface EffectContext {
  targetId?: string;
  all?: boolean;
  source?: 'card' | 'potion';
}

type Resolver<T extends Effect['type']> = (
  state: CombatState,
  effect: Extract<Effect, { type: T }>,
  card: Pick<CardDefinition, 'defense'>,
  context: EffectContext,
) => void;

/** Composable effect handlers know effect types, never card IDs. */
const resolvers: { [Type in Effect['type']]: Resolver<Type> } = {
  damage: (state, effect, _card, context) => {
    const base =
      effect.amount +
      (effect.fromBlock ? state.player.block : 0) +
      (state.jitto >= 100 ? (effect.divineBonus ?? 0) : 0);
    const targets =
      effect.all || context.all
        ? getEnemies(state).filter((enemy) => enemy.hp > 0)
        : [findEnemy(state, context.targetId)].filter((enemy) => enemy !== undefined);
    const attacker =
      context.source === 'potion' ? { ...state.player, strength: 0, weak: 0 } : state.player;
    for (const enemy of targets) {
      for (
        let hit = 0;
        hit < (effect.hits ?? 1) && state.phase === 'player' && enemy.hp > 0;
        hit += 1
      ) {
        dealDamage(state, 'enemy', calculateDamage(base, attacker, enemy), false, enemy);
      }
    }
  },
  block: (state, effect, card) => {
    gainBlock(state, 'player', effect.amount + (card.defense && state.jitto >= 50 ? 2 : 0));
  },
  gauge: (state, effect) => applyGauge(state, effect.amount),
  draw: (state, effect) => drawInto(state, effect.amount),
  energy: (state, effect) => {
    state.energy = Math.max(0, state.energy + effect.amount);
    appendLog(state, `エナジー ${effect.amount >= 0 ? '+' : ''}${effect.amount}。`);
  },
  heal: (state, effect) => healPlayer(state, effect.amount),
  status: (state, effect, _card, context) => {
    const targets: Actor[] =
      effect.target === 'player'
        ? [state.player]
        : effect.target === 'allEnemies' || context.all
          ? getEnemies(state).filter((enemy) => enemy.hp > 0)
          : [findEnemy(state, context.targetId)].filter((enemy) => enemy !== undefined);
    const labels = { strength: '筋力', weak: '弱体', vulnerable: '脆弱', poison: '毒' };
    for (const actor of targets) {
      actor[effect.status] = Math.max(0, actor[effect.status] + effect.amount);
      appendLog(
        state,
        `${actor.name}に${labels[effect.status]} ${effect.amount > 0 ? '+' : ''}${effect.amount}。`,
      );
    }
  },
  power: (state, effect) => {
    state.powerStacks ??= {};
    state.powerStacks[effect.power] = (state.powerStacks[effect.power] ?? 0) + effect.amount;
    if (effect.power === 'stillness') state.stillness += effect.amount;
    emitEvent(state, 'player', 'power', effect.amount);
    const labels = {
      stillness: '不動',
      thorns: '岩棘',
      strengthOnTurn: '岩の成長',
      poisonAura: '毒苔の教壇',
      drawOnTurn: '経典の知恵',
      blockOnAttack: '金剛の構え',
    };
    appendLog(state, `${labels[effect.power]} +${effect.amount}。戦闘中持続。`);
  },
  multiplyPoison: (state, effect, _card, context) => {
    const enemy = findEnemy(state, context.targetId);
    if (!enemy) return;
    enemy.poison = Math.max(0, Math.floor(enemy.poison * effect.amount));
    appendLog(state, `${enemy.name}の毒が${effect.amount}倍。毒${enemy.poison}。`);
  },
};

export function resolveEffects(
  state: CombatState,
  effects: Effect[],
  card: Pick<CardDefinition, 'defense'> = { defense: false },
  context: EffectContext = {},
): void {
  for (const effect of effects) {
    if (state.phase !== 'player') break;
    const resolve = resolvers[effect.type] as (
      state: CombatState,
      effect: Effect,
      card: Pick<CardDefinition, 'defense'>,
      context: EffectContext,
    ) => void;
    resolve(state, effect, card, context);
  }
}
