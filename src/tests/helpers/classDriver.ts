import { CARD_DEFINITIONS } from '../../data/cards';
import { POTION_DEFINITIONS } from '../../data/potions';
import { canPlayCard, getEnemies, getEnemyKey, predictEnemyDamage, reduceCombat } from '../../engine';
import { SHOP_PRICES } from '../../engine/run';
import type { CardInstance, CombatAction, CombatState } from '../../types/game';
import type { RunAction, RunState } from '../../types/run';
import { chooseRunAction } from './runDriver';

function cardValue(id: string, upgraded = false): number {
  const card = CARD_DEFINITIONS[id];
  const effects = upgraded ? card.upgradedEffects : card.effects;
  let value = 0;
  for (const effect of effects) {
    switch (effect.type) {
      case 'damage': value += effect.amount * (effect.hits ?? 1) * (effect.all ? 1.6 : 1); break;
      case 'block': value += effect.amount; break;
      case 'status': value += effect.amount * (effect.status === 'strength' ? 7 : effect.status === 'poison' ? 3 : 4); break;
      case 'draw': value += effect.amount * 7; break;
      case 'energy': value += effect.amount * 9; break;
      case 'power': value += effect.amount * 12; break;
      case 'channel': value += effect.amount * 13; break;
      case 'evoke': value += effect.times * 5; break;
      case 'focus': value += effect.amount * (effect.temporary ? 4 : 13); break;
      case 'forge': value += effect.amount * 2; break;
      case 'gainStars': value += effect.amount * 4; break;
      case 'starBurst': value += effect.amount * 6; break;
      case 'summon': value += effect.amount * 2; break;
      case 'summonDamage': value += effect.amount + (effect.plusSummonHp ? 6 : 0); break;
      case 'doom': value += effect.amount * 0.9; break;
      case 'soul': value += effect.amount * 7; break;
      case 'generate': value += effect.amount * 5; break;
      case 'heal': value += effect.amount * 2; break;
      case 'loseHp': value -= effect.amount * 2; break;
      case 'discard': value -= effect.amount * 2; break;
      case 'exhaustChoice': value += effect.amount * 3; break;
      case 'nextTurnEnergy': value += effect.amount * 6; break;
      case 'xChannel': value += 27; break;
      case 'fetchGenerated': value += 5; break;
      case 'copySelf': value -= 2; break;
      case 'gauge': value += effect.amount * 0.2; break;
      case 'multiplyPoison': value += effect.amount * 7; break;
    }
  }
  return value - (upgraded ? card.upgradedCost ?? card.cost : card.cost) * 4;
}

function incoming(state: CombatState): number {
  return getEnemies(state).filter((enemy) => enemy.hp > 0).reduce(
    (sum, enemy) => sum + predictEnemyDamage(state, getEnemyKey(enemy)) * (enemy.intent.hits ?? 1), 0,
  );
}

function choiceValue(card: CardInstance, state: CombatState): number {
  const definition = CARD_DEFINITIONS[card.cardId];
  const cost = card.upgraded ? definition.upgradedCost ?? definition.cost : definition.cost;
  return cardValue(card.cardId, card.upgraded) - (cost > state.energy ? 20 : 0);
}

/** A test/browser controller using public actions, with no fixture HP or inventory changes. */
export function chooseClassCombatAction(state: CombatState): CombatAction {
  if (state.pendingChoice) {
    const choices = [...state.hand].sort((a, b) => choiceValue(a, state) - choiceValue(b, state));
    return { type: 'chooseCards', cardIds: choices.slice(0, state.pendingChoice.amount).map((card) => card.uid) };
  }
  const living = getEnemies(state).filter((enemy) => enemy.hp > 0);
  const targetId = getEnemyKey([...living].sort((a, b) => a.hp - b.hp)[0]);
  for (let slot = 0; slot < (state.potions?.length ?? 0); slot++) {
    const id = state.potions![slot];
    if (!id) continue;
    const effects = POTION_DEFINITIONS[id].effects;
    if (effects.some((effect) => effect.type === 'heal') && state.player.maxHp - state.player.hp < 15) continue;
    if (effects.some((effect) => effect.type === 'block') && incoming(state) <= state.player.block) continue;
    return { type: 'usePotion', slot, targetId };
  }
  const threat = Math.max(0, incoming(state) - state.player.block - (state.classResources?.ostyHp ?? 0));
  const options = state.hand.filter((card) => canPlayCard(state, card.uid, targetId)).map((card) => {
    const after = reduceCombat(state, { type: 'playCard', cardId: card.uid, targetId });
    const beforeEnemies = getEnemies(state);
    const afterEnemies = getEnemies(after);
    const damage = beforeEnemies.reduce((sum, enemy, index) => sum + enemy.hp - afterEnemies[index].hp, 0);
    const killed = living.length - afterEnemies.filter((enemy) => enemy.hp > 0).length;
    const remainingThreat = Math.max(0, incoming(after) - after.player.block - (after.classResources?.ostyHp ?? 0));
    let score = damage * 1.4 + killed * 70 + (threat - remainingThreat) * 2.5;
    score -= (state.player.hp - after.player.hp) * 4;
    score += (after.player.strength - state.player.strength) * (state.turn < 5 ? 10 : 5);
    score += (after.hand.length - state.hand.length + 1) * (after.energy > 0 ? 9 : 2);
    score += (after.energy - state.energy) * 10;
    score += (after.jitto - state.jitto) * 0.12;
    for (let index = 0; index < beforeEnemies.length; index++) {
      score += Math.min(afterEnemies[index].poison - beforeEnemies[index].poison, Math.ceil(afterEnemies[index].hp / 2)) * 3;
      score += Math.min((afterEnemies[index].doom ?? 0) - (beforeEnemies[index].doom ?? 0), afterEnemies[index].hp) * 1.5;
    }
    const beforeResources = state.classResources;
    const afterResources = after.classResources;
    if (afterResources) {
      score += (afterResources.orbs.length - (beforeResources?.orbs.length ?? 0)) * 15;
      score += (afterResources.focus - (beforeResources?.focus ?? 0)) * 15;
      score += (afterResources.forge - (beforeResources?.forge ?? 0)) * 2;
      score += (afterResources.ostyHp - (beforeResources?.ostyHp ?? 0)) * 0.7;
      score += (afterResources.stars - (beforeResources?.stars ?? 0)) * 4;
      score += (afterResources.nextTurnEnergy - (beforeResources?.nextTurnEnergy ?? 0)) * 5;
    }
    if (CARD_DEFINITIONS[card.cardId].type === 'power') score += state.turn < 5 ? 28 : 8;
    if (after.pendingChoice) score += 3;
    if (after.phase === 'victory') score += 1000;
    if (after.phase === 'defeat') score -= 10000;
    return { card, score };
  }).sort((a, b) => b.score - a.score);
  return options.length ? { type: 'playCard', cardId: options[0].card.uid, targetId } : { type: 'endTurn' };
}

export function chooseClassRunAction(state: RunState): RunAction {
  if (state.screen === 'combat') return { type: 'combat', action: chooseClassCombatAction(state.combat!) };
  if (state.screen === 'reward') {
    const best = [...state.reward!.cardIds].sort((a, b) => cardValue(b) - cardValue(a))[0];
    return { type: 'takeCard', cardId: state.deck.length < 18 && cardValue(best) >= 8 ? best : null };
  }
  if (state.screen === 'upgrade') {
    const choices = state.deck.filter((card) => !card.upgraded).sort((a, b) =>
      (cardValue(b.cardId, true) - cardValue(b.cardId)) - (cardValue(a.cardId, true) - cardValue(a.cardId)),
    );
    return choices[0] ? { type: 'upgradeCard', cardUid: choices[0].uid } : { type: 'leaveNode' };
  }
  if (state.screen === 'shop') {
    const shop = state.shop!;
    const best = [...shop.cardIds].filter((id) => !shop.purchased.includes(`card:${id}`)).sort((a, b) => cardValue(b) - cardValue(a))[0];
    if (shop.relicId && !shop.purchased.includes('relic') && state.gold >= SHOP_PRICES.relic) return { type: 'buyRelic' };
    if (best && cardValue(best) >= 20 && state.deck.length < 18 && state.gold >= SHOP_PRICES.card) return { type: 'buyCard', cardId: best };
    if (shop.potionId && !shop.purchased.includes('potion') && state.gold >= SHOP_PRICES.potion && state.potions.includes(null)) return { type: 'buyPotion' };
    return { type: 'leaveNode' };
  }
  return chooseRunAction(state);
}
