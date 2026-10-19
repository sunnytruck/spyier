import { CARD_DEFINITIONS } from '../../data/cards';
import type { CardInstance, CombatState, Effect, EnemyState, OrbType } from '../../types/game';
import { calculateDamage } from './damage';
import { attackCardBase, nextOrbEvokeIndex, orbEffectValue, orbSlotCount } from './resources';
import { findEnemy } from './targets';

/** Read-only projections: none of these selectors initialise resources, advance RNG, or play cards. */
export interface OrbSlotView {
  index: number;
  type: OrbType | null;
  passive: number;
  evoke: number;
  isNextEvoke: boolean;
}

export function getOrbView(state: CombatState) {
  const orbs = state.classResources?.orbs ?? [];
  const focus = state.classResources?.focus ?? 0;
  const nextEvokeIndex = nextOrbEvokeIndex(orbs);
  return {
    count: orbs.length,
    capacity: orbSlotCount(),
    focus,
    temporaryFocus: state.classResources?.temporaryFocus ?? 0,
    nextEvokeIndex,
    slots: Array.from({ length: orbSlotCount() }, (_, index): OrbSlotView => {
      const type = orbs[index] ?? null;
      return {
        index, type,
        passive: type ? orbEffectValue(type, 'passive', focus) : 0,
        evoke: type ? orbEffectValue(type, 'evoke', focus) : 0,
        isNextEvoke: index === nextEvokeIndex,
      };
    }),
  };
}

function cardEffects(card: CardInstance): Effect[] {
  const definition = CARD_DEFINITIONS[card.cardId];
  return definition ? card.upgraded ? definition.upgradedEffects : definition.effects : [];
}

function cardName(card: CardInstance): string {
  return `${CARD_DEFINITIONS[card.cardId]?.name ?? card.cardId}${card.upgraded ? '＋' : ''}`;
}

function attackDamage(state: CombatState, base: number): number {
  const enemy = findEnemy(state);
  // With no target, show the player's damage modifiers against a neutral defender.
  return calculateDamage(base, state.player, enemy ?? { ...state.player, vulnerable: 0 });
}

export function getSummonView(state: CombatState) {
  const hp = state.classResources?.ostyHp ?? 0;
  return {
    hp,
    active: hp > 0,
    automaticAttack: false as const,
    guardRule: '通常攻撃はブロックで防いだ残りを岩霊のHPで肩代わり。全体攻撃は本体と岩霊に個別命中。毒・HP消費は肩代わりしない。',
    attackRule: '命令カード使用時だけ攻撃。筋力・弱体・脆弱の影響を受けず、敵のブロックは有効。自動攻撃はしない。',
    commands: state.hand.flatMap((card) => cardEffects(card).flatMap((effect) => {
      if (effect.type !== 'summonDamage') return [];
      return [{
        cardUid: card.uid,
        cardId: card.cardId,
        name: cardName(card),
        amount: hp > 0 ? Math.max(0, Math.floor(effect.amount + (effect.plusSummonHp ? hp : 0))) : 0,
        baseAmount: effect.amount,
        plusSummonHp: effect.plusSummonHp ?? false,
      }];
    })),
  };
}

export function getStarView(state: CombatState) {
  const stars = state.classResources?.stars ?? 0;
  const gainedThisTurn = state.classResources?.starsGainedThisTurn ?? 0;
  const forge = state.classResources?.forge ?? 0;
  // During the played-card animation the instance is briefly outside the piles.
  // Its deck/generated record keeps the HUD stable until it settles in discard.
  const swordInstance = [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhaustPile, ...state.powers, ...state.deck, ...(state.generatedCards ?? [])]
    .find((card) => card.cardId === 'token_sword');
  const swordCard = swordInstance ?? { uid: 'resource-sword-preview', cardId: 'token_sword', upgraded: false };
  const swordDefinition = CARD_DEFINITIONS[swordCard.cardId];
  const swordEffect = cardEffects(swordCard).find((effect): effect is Extract<Effect, { type: 'damage' }> => effect.type === 'damage');
  const baseDamage = swordEffect?.amount ?? 0;
  const forgedBaseDamage = swordEffect ? attackCardBase(state, swordEffect, swordCard) : 0;
  return {
    stars,
    gainedThisTurn,
    forge,
    consumesStars: false as const,
    sword: {
      cardId: swordCard.cardId,
      card: { ...swordCard },
      generated: !!swordInstance,
      name: cardName(swordCard),
      cost: swordCard.upgraded ? swordDefinition.upgradedCost ?? swordDefinition.cost : swordDefinition.cost,
      baseDamage,
      forgedBaseDamage,
      damagePerHit: attackDamage(state, forgedBaseDamage),
    },
    burstCards: state.hand.flatMap((card) => cardEffects(card).flatMap((effect) => {
      if (effect.type !== 'starBurst') return [];
      const base = gainedThisTurn * effect.amount;
      return [{
        cardUid: card.uid, name: cardName(card), factor: effect.amount,
        baseDamage: base,
        // A zero-gain burst is skipped entirely, including strength modifiers.
        damagePerHit: gainedThisTurn > 0 ? attackDamage(state, base) : 0,
      }];
    })),
  };
}

/** Next enemy-turn poison happens before the existing doom threshold check. */
export function getEnemyResourceView(enemy: EnemyState) {
  const poison = enemy.poison;
  const poisonDamage = enemy.hp > 0 ? Math.min(enemy.hp, Math.max(0, Math.floor(poison))) : 0;
  const hpAfterPoison = Math.max(0, enemy.hp - poisonDamage);
  const doom = enemy.doom ?? 0;
  const doomTriggers = hpAfterPoison > 0 && doom >= hpAfterPoison;
  return {
    poison,
    poisonDamage,
    poisonAfterTick: enemy.hp > 0 && poison > 0 ? Math.max(0, poison - 1) : poison,
    hpAfterPoison,
    doom,
    doomTriggers,
    willAct: hpAfterPoison > 0 && !doomTriggers,
  };
}

export function getKnifeView(state: CombatState) {
  const knife = { uid: 'resource-knife-preview', cardId: 'token_knife', upgraded: false };
  const effect = cardEffects(knife).find((item): item is Extract<Effect, { type: 'damage' }> => item.type === 'damage');
  const baseDamage = effect ? attackCardBase(state, effect, knife) : 0;
  return {
    bonusDamage: state.powerStacks?.knifeDamage ?? 0,
    cardsInHand: state.hand.filter((card) => CARD_DEFINITIONS[card.cardId]?.tags?.includes('knife')).length,
    baseDamage,
    damagePerHit: attackDamage(state, baseDamage),
  };
}

export function getHealthSpendView(state: CombatState, card: CardInstance) {
  const amount = cardEffects(card).reduce((sum, effect) => sum + (effect.type === 'loseHp' ? Math.max(0, Math.floor(effect.amount)) : 0), 0);
  return { amount, lethal: amount > 0 && state.player.hp <= amount };
}
