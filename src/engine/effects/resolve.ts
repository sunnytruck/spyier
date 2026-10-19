import { CARD_DEFINITIONS } from '../../data/cards';
import type { Actor, CardDefinition, CardInstance, CombatState, Effect } from '../../types/game';
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
import { channelOrbs, evokeOrb, fetchGeneratedCard, generateCards, resources, summonAttack } from '../combat/resources';

export interface EffectContext {
  targetId?: string;
  all?: boolean;
  source?: 'card' | 'potion';
  sourceCard?: CardInstance;
  xEnergy?: number;
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
      (effect.fromForge ? resources(state).forge : 0) +
      (context.sourceCard && CARD_DEFINITIONS[context.sourceCard.cardId]?.tags?.includes('knife') ? state.powerStacks?.knifeDamage ?? 0 : 0) +
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
        const damage = dealDamage(state, 'enemy', calculateDamage(base, attacker, enemy), false, enemy);
        if (effect.doomFromDamage && enemy.hp > 0) enemy.doom = (enemy.doom ?? 0) + damage;
      }
    }
  },
  block: (state, effect, card) => {
    gainBlock(state, 'player', effect.amount + (card.defense && state.jitto >= 50 ? 2 : 0));
  },
  gauge: (state, effect) => applyGauge(state, effect.amount),
  draw: (state, effect) => drawInto(state, effect.amount * (effect.perOrbType ? new Set(state.classResources?.orbs ?? []).size : 1)),
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
      knifeDamage: '影刃の研磨',
      knivesOnTurn: '無尽の影刃',
      focusOnTurn: '集中回路',
    };
    appendLog(state, `${labels[effect.power]} +${effect.amount}。戦闘中持続。`);
  },
  multiplyPoison: (state, effect, _card, context) => {
    const enemy = findEnemy(state, context.targetId);
    if (!enemy) return;
    enemy.poison = Math.max(0, Math.floor(enemy.poison * effect.amount));
    appendLog(state, `${enemy.name}の毒が${effect.amount}倍。毒${enemy.poison}。`);
  },
  loseHp: (state, effect) => dealDamage(state, 'player', effect.amount, true),
  // Interactive effects are suspended by resolveEffects, not resolved here.
  discard: () => {},
  exhaustChoice: () => {},
  generate: (state, effect) => generateCards(state, effect.cardId, effect.amount, effect.destination, effect.upgraded),
  copySelf: (state, effect, _card, context) => {
    if (context.sourceCard) generateCards(state, context.sourceCard.cardId, 1, effect.destination, context.sourceCard.upgraded);
  },
  fetchGenerated: (state, effect) => fetchGeneratedCard(state, effect.cardId),
  gainStars: (state, effect) => {
    const current = resources(state);
    current.stars = Math.max(0, current.stars + effect.amount);
    current.starsGainedThisTurn += Math.max(0, effect.amount);
    appendLog(state, `星 ✦ +${effect.amount}。`);
  },
  starBurst: (state, effect, _card, context) => {
    const gained = resources(state).starsGainedThisTurn;
    if (gained <= 0) return;
    const amount = gained * effect.amount;
    const enemies = effect.all ? getEnemies(state).filter((enemy) => enemy.hp > 0) : [findEnemy(state, context.targetId)].filter((enemy) => enemy !== undefined);
    for (const enemy of enemies) {
      if (state.phase !== 'player') break;
      dealDamage(state, 'enemy', calculateDamage(amount, state.player, enemy), false, enemy);
    }
  },
  forge: (state, effect) => {
    resources(state).forge += effect.amount;
    appendLog(state, `鍛造 +${effect.amount}。鍛造剣の威力が上がる。`);
  },
  summon: (state, effect) => {
    resources(state).ostyHp += effect.amount;
    appendLog(state, `召喚体のHP +${effect.amount}。`);
  },
  summonDamage: (state, effect, _card, context) => summonAttack(state, effect.amount, effect.plusSummonHp ?? false, context.targetId),
  doom: (state, effect, _card, context) => {
    const enemies = effect.all ? getEnemies(state).filter((enemy) => enemy.hp > 0) : [findEnemy(state, context.targetId)].filter((enemy) => enemy !== undefined);
    for (const enemy of enemies) {
      enemy.doom = (enemy.doom ?? 0) + effect.amount;
      appendLog(state, `${enemy.name}に破滅 +${effect.amount}。`);
    }
  },
  soul: (state, effect) => generateCards(state, 'token_soul', effect.amount, effect.destination ?? 'drawPile', effect.upgraded),
  channel: (state, effect) => channelOrbs(state, effect.orb, effect.amount),
  evoke: (state, effect) => evokeOrb(state, effect.times),
  focus: (state, effect) => {
    const current = resources(state);
    current.focus += effect.amount;
    if (effect.temporary) current.temporaryFocus += effect.amount;
    appendLog(state, `集中力 +${effect.amount}${effect.temporary ? '（このターン）' : ''}。`);
  },
  nextTurnEnergy: (state, effect) => {
    resources(state).nextTurnEnergy += effect.amount;
    appendLog(state, `次のターンのエナジー +${effect.amount}。`);
  },
  xChannel: (state, effect, _card, context) => channelOrbs(state, effect.orb, (context.xEnergy ?? 0) + effect.bonus),
};

export function resolveEffects(
  state: CombatState,
  effects: Effect[],
  card: Pick<CardDefinition, 'defense'> = { defense: false },
  context: EffectContext = {},
): void {
  for (const [index, effect] of effects.entries()) {
    if (state.phase !== 'player') break;
    if ((effect.type === 'discard' || effect.type === 'exhaustChoice') && state.hand.length > 0) {
      const amount = Math.min(state.hand.length, Math.max(0, Math.floor(effect.amount)));
      if (amount === 0) continue;
      if (amount === state.hand.length) {
        state[effect.type === 'discard' ? 'discardPile' : 'exhaustPile'].push(...state.hand);
        state.hand = [];
        continue;
      }
      if (!context.sourceCard) continue;
      state.pendingChoice = {
        mode: effect.type === 'discard' ? 'discard' : 'exhaust',
        amount,
        resume: {
          effects: structuredClone(effects.slice(index + 1)),
          defense: card.defense,
          ...(context.targetId ? { targetId: context.targetId } : {}),
          sourceCard: { ...context.sourceCard },
          ...(context.xEnergy !== undefined ? { xEnergy: context.xEnergy } : {}),
        },
      };
      appendLog(state, `手札から${amount}枚を${effect.type === 'discard' ? '捨てる' : '廃棄する'}。カードを選んでください。`);
      break;
    }
    const resolve = resolvers[effect.type] as (
      state: CombatState,
      effect: Effect,
      card: Pick<CardDefinition, 'defense'>,
      context: EffectContext,
    ) => void;
    resolve(state, effect, card, context);
  }
}
