import type { Actor, CardDefinition, CardInstance, CombatState, Effect, EnemyState } from '../../types/game';
import { CARD_DEFINITIONS } from '../../data/cards';
import { drawInto } from '../actions/draw';
import { calculateDamage } from '../combat/damage';
import {
  appendLog,
  applyGauge,
  dealDamage,
  emitEvent,
  gainBlock,
  healPlayer,
  finishIfNeeded,
} from '../combat/state';
import { findEnemy, getEnemies, getEnemyKey } from '../combat/targets';
import { attackCardBase, attackHitCount, channelOrbs, evokeOrb, fetchGeneratedCard, generateCards, resources, summonAttack } from '../combat/resources';
import { meetsEffectCondition, scaledEffectAmount } from '../combat/values';
import { nextRandom } from '../random';
import { emitCombatCue, withCombatTraceContext } from '../../presentation/trace';

export interface EffectContext {
  targetId?: string;
  all?: boolean;
  source?: 'card' | 'potion';
  sourceCard?: CardInstance;
  xEnergy?: number;
  /** Presentation/log attribution only; never persisted as an executable modifier. */
  temporary?: boolean;
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
    if (effect.fromForge) resources(state);
    if (effect.randomTarget) {
      const hits = attackHitCount(state, effect, context.xEnergy);
      for (let hit = 0; hit < hits && state.phase === 'player'; hit++) {
        const enemies = getEnemies(state).filter((enemy) => enemy.hp > 0);
        if (!enemies.length) break;
        const random = nextRandom(state.rngState);
        state.rngState = random.state;
        const enemy = enemies[Math.floor(random.value * enemies.length)];
        const base = attackCardBase(state, effect, context.sourceCard, enemy);
        dealDamage(state, 'enemy', calculateDamage(base, state.player, enemy), false, enemy);
      }
      return;
    }
    const targets =
      effect.all || context.all
        ? getEnemies(state).filter((enemy) => enemy.hp > 0)
        : [findEnemy(state, context.targetId)].filter((enemy) => enemy !== undefined);
    const attacker =
      context.source === 'potion' ? { ...state.player, strength: 0, weak: 0 } : state.player;
    for (const enemy of targets) {
      const base = attackCardBase(state, effect, context.sourceCard, enemy);
      const hits = attackHitCount(state, effect, context.xEnergy, enemy);
      for (
        let hit = 0;
        hit < hits && state.phase === 'player' && enemy.hp > 0;
        hit += 1
      ) {
        const damage = dealDamage(state, 'enemy', calculateDamage(base, attacker, enemy), false, enemy);
        if (effect.doomFromDamage && enemy.hp > 0) {
          enemy.doom = (enemy.doom ?? 0) + damage;
          emitCombatCue(state, { kind: 'status', targetId: getEnemyKey(enemy), status: 'doom', amount: damage });
        }
      }
    }
  },
  block: (state, effect, card) => {
    gainBlock(state, 'player', scaledEffectAmount(state, effect) + (card.defense && state.jitto >= 50 ? 2 : 0));
  },
  gauge: (state, effect) => applyGauge(state, effect.amount),
  draw: (state, effect) => drawInto(state, effect.amount * (effect.perOrbType ? new Set(state.classResources?.orbs ?? []).size : 1)),
  energy: (state, effect) => {
    const previous = state.energy;
    state.energy = Math.max(0, state.energy + effect.amount);
    appendLog(state, `エナジー ${effect.amount >= 0 ? '+' : ''}${effect.amount}。`);
    emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'energy', amount: state.energy - previous });
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
      const previous = actor[effect.status];
      actor[effect.status] = effect.allowNegative && effect.status === 'strength'
        ? actor[effect.status] + effect.amount : Math.max(0, actor[effect.status] + effect.amount);
      appendLog(
        state,
        `${actor.name}に${labels[effect.status]} ${effect.amount > 0 ? '+' : ''}${effect.amount}。`,
      );
      emitCombatCue(state, { kind: 'status', targetId: actor === state.player ? 'player' : getEnemyKey(actor as EnemyState), status: effect.status, amount: actor[effect.status] - previous, label: labels[effect.status] });
    }
  },
  power: (state, effect, _card, context) => {
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
      energyOnTurn: '不滅の火種',
    };
    appendLog(state, `${labels[effect.power]} +${effect.amount}。${context.temporary ? '次の自分のターンまで。' : '戦闘中持続。'}`);
    emitCombatCue(state, { kind: 'power', targetId: 'player', status: effect.power, amount: effect.amount, label: `${labels[effect.power]}${context.temporary ? '・一時' : ''}` });
  },
  multiplyPoison: (state, effect, _card, context) => {
    const enemy = findEnemy(state, context.targetId);
    if (!enemy) return;
    const previous = enemy.poison;
    enemy.poison = Math.max(0, Math.floor(enemy.poison * effect.amount));
    appendLog(state, `${enemy.name}の毒が${effect.amount}倍。毒${enemy.poison}。`);
    emitCombatCue(state, { kind: 'status', targetId: getEnemyKey(enemy), status: 'poison', amount: enemy.poison - previous });
  },
  loseHp: (state, effect) => dealDamage(state, 'player', effect.amount, true),
  // Interactive effects are suspended by resolveEffects, not resolved here.
  discard: () => {},
  exhaustChoice: () => {},
  moveChoice: () => {},
  moveRandom: (state, effect) => {
    const moved: CardInstance[] = [];
    for (let count = 0; count < Math.max(0, Math.floor(effect.amount)) && state[effect.from].length > 0 && state.hand.length < 50; count++) {
      const random = nextRandom(state.rngState);
      state.rngState = random.state;
      const [card] = state[effect.from].splice(Math.floor(random.value * state[effect.from].length), 1);
      state.hand.push(card);
      moved.push(card);
    }
    if (moved.length) emitCombatCue(state, { kind: 'draw', cards: moved, card: moved[0], fromZone: effect.from, toZone: 'hand', amount: moved.length, label: 'ランダム回収' });
  },
  cardDamageBonus: (state, effect, _card, context) => {
    if (!context.sourceCard) return;
    const id = context.sourceCard.cardId;
    state.cardDamageBonuses ??= {};
    state.cardDamageBonuses[id] = (state.cardDamageBonuses[id] ?? 0) + effect.amount;
    emitCombatCue(state, { kind: 'power', targetId: 'player', resource: 'cardDamageBonus', amount: effect.amount, label: '同名カードの威力上昇' });
  },
  loseMaxHp: (state, effect) => {
    const lost = Math.min(state.player.maxHp, Math.max(0, Math.floor(effect.amount)));
    state.player.maxHp -= lost;
    state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    appendLog(state, `最大HPを${lost}失った。最大HP ${state.player.maxHp}。`);
    emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'maxHp', amount: -lost, label: '最大HPの支払い' });
    finishIfNeeded(state);
  },
  upgradeAll: (state, _effect, _card, context) => {
    const cards = [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhaustPile, ...state.powers, ...state.deck, ...(state.generatedCards ?? []), ...(context.sourceCard ? [context.sourceCard] : [])];
    const upgraded = new Set<string>();
    for (const card of cards) {
      if (card.upgraded || !CARD_DEFINITIONS[card.cardId] || CARD_DEFINITIONS[card.cardId].unupgradable) continue;
      card.upgraded = true;
      upgraded.add(card.uid);
    }
    if (upgraded.size) {
      state.temporaryUpgrades = [...new Set([...(state.temporaryUpgrades ?? []), ...upgraded])];
      appendLog(state, `${upgraded.size}枚をこの戦闘中だけ強化した。`);
      emitCombatCue(state, { kind: 'power', targetId: 'player', resource: 'temporaryUpgrades', amount: upgraded.size, label: '全札・戦闘中強化' });
    }
  },
  stun: (state, effect, _card, context) => {
    const enemy = findEnemy(state, context.targetId);
    if (!enemy) return;
    const amount = Math.max(0, Math.floor(effect.amount));
    if (amount === 0) return;
    enemy.stun = (enemy.stun ?? 0) + amount;
    emitCombatCue(state, { kind: 'status', targetId: getEnemyKey(enemy), status: 'stun', amount, label: 'スタン' });
  },
  intangible: (state, effect) => {
    const amount = Math.max(0, Math.floor(effect.amount));
    if (amount === 0) return;
    state.intangible = (state.intangible ?? 0) + amount;
    emitCombatCue(state, { kind: 'status', targetId: 'player', status: 'intangible', amount, label: '霊体' });
  },
  exhaustRandom: (state, effect) => {
    const moved: CardInstance[] = [];
    for (let index = 0; index < effect.amount && state.hand.length > 0; index++) {
      const random = nextRandom(state.rngState);
      state.rngState = random.state;
      const [card] = state.hand.splice(Math.floor(random.value * state.hand.length), 1);
      state.exhaustPile.push(card);
      moved.push(card);
    }
    if (moved.length) emitCombatCue(state, { kind: 'exhaust', sourceId: 'player', cards: moved, fromZone: 'hand', toZone: 'exhaustPile' });
  },
  drawTo: (state, effect) => drawInto(state, Math.max(0, effect.amount - state.hand.length)),
  redraw: (state) => {
    const moved = [...state.hand];
    state.discardPile.push(...moved);
    state.hand = [];
    if (moved.length) emitCombatCue(state, { kind: 'discard', sourceId: 'player', cards: moved, fromZone: 'hand', toZone: 'discardPile' });
    drawInto(state, moved.length);
  },
  multiply: (state, effect) => {
    const before = effect.resource === 'energy' ? state.energy : state.player.block;
    const after = Math.min(1_000_000, Math.max(0, Math.floor(before * effect.amount)));
    if (effect.resource === 'block') gainBlock(state, 'player', Math.max(0, after - before));
    else {
      state.energy = after;
      emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'energy', amount: after - before });
    }
  },
  conditional: () => {},
  nextTurn: (state, effect, _card, context) => {
    state.scheduledEffects ??= [];
    state.scheduledEffects.push({ effects: structuredClone(effect.effects), ...(context.sourceCard ? { sourceCard: { ...context.sourceCard } } : {}) });
    appendLog(state, '次のターンの効果を予約した。');
  },
  temporaryStatus: (state, effect, card, context) => {
    const targets = effect.target === 'player' ? [state.player]
      : effect.target === 'allEnemies' ? getEnemies(state).filter((enemy) => enemy.hp > 0)
        : [findEnemy(state, context.targetId)].filter((enemy) => enemy !== undefined);
    const previous = targets.map((actor) => actor[effect.status]);
    resolvers.status(state, { ...effect, type: 'status' }, card, context);
    targets.forEach((actor, index) => {
      const amount = actor[effect.status] - previous[index];
      if (!amount) return;
      state.turnModifiers ??= [];
      state.turnModifiers.push({ kind: 'status', targetId: actor === state.player ? 'player' : getEnemyKey(actor as EnemyState), status: effect.status, amount });
    });
  },
  temporaryPower: (state, effect, card, context) => {
    resolvers.power(state, { ...effect, type: 'power' }, card, { ...context, temporary: true });
    state.turnModifiers ??= [];
    state.turnModifiers.push({ kind: 'power', power: effect.power, amount: effect.amount });
  },
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
    emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'stars', amount: effect.amount, resourceAction: 'gain' });
  },
  starBurst: (state, effect, _card, context) => {
    const gained = resources(state).starsGainedThisTurn;
    emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'stars', amount: 0, resourceAction: 'reference', label: `当ターンの星${gained}を参照` });
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
    emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'forge', amount: effect.amount, resourceAction: 'forge' });
  },
  summon: (state, effect) => {
    const wasActive = (state.classResources?.ostyHp ?? 0) > 0;
    resources(state).ostyHp += effect.amount;
    appendLog(state, `召喚体のHP +${effect.amount}。`);
    emitCombatCue(state, { kind: 'resource', targetId: 'osty', resource: 'ostyHp', amount: effect.amount, resourceAction: wasActive ? 'grow' : 'summon' });
  },
  summonDamage: (state, effect, _card, context) => summonAttack(state, effect.amount, effect.plusSummonHp ?? false, context.targetId),
  doom: (state, effect, _card, context) => {
    const enemies = effect.all ? getEnemies(state).filter((enemy) => enemy.hp > 0) : [findEnemy(state, context.targetId)].filter((enemy) => enemy !== undefined);
    for (const enemy of enemies) {
      const amount = Math.max(0, Math.floor(scaledEffectAmount(state, effect, enemy)));
      enemy.doom = (enemy.doom ?? 0) + amount;
      appendLog(state, `${enemy.name}に破滅 +${amount}。`);
      emitCombatCue(state, { kind: 'status', targetId: getEnemyKey(enemy), status: 'doom', amount });
    }
  },
  soul: (state, effect) => generateCards(state, 'token_soul', effect.amount, effect.destination ?? 'drawPile', effect.upgraded),
  channel: (state, effect) => channelOrbs(state, effect.orb, scaledEffectAmount(state, effect)),
  evoke: (state, effect, _card, context) => {
    const count = effect.all ? state.classResources?.orbs.length ?? 0 : 1;
    for (let index = 0; index < count && state.phase === 'player'; index++) evokeOrb(state, effect.times + (effect.fromEnergy ? context.xEnergy ?? 0 : 0));
  },
  focus: (state, effect) => {
    const current = resources(state);
    const amount = Math.floor(scaledEffectAmount(state, effect));
    current.focus += amount;
    if (effect.temporary) current.temporaryFocus += amount;
    appendLog(state, `集中力 +${amount}${effect.temporary ? '（このターン）' : ''}。`);
    emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'focus', amount });
  },
  nextTurnEnergy: (state, effect) => {
    resources(state).nextTurnEnergy += effect.amount;
    appendLog(state, `次のターンのエナジー +${effect.amount}。`);
    emitCombatCue(state, { kind: 'resource', targetId: 'player', resource: 'nextTurnEnergy', amount: effect.amount });
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
    if (effect.type === 'conditional') {
      // Flatten the chosen continuation so a nested interactive effect resumes
      // the whole card once, including the effects after its conditional branch.
      const remaining = effects.slice(index + 1);
      resolveEffects(state, meetsEffectCondition(state, effect.condition, findEnemy(state, context.targetId)) ? [...effect.effects, ...remaining] : remaining, card, context);
      return;
    }
    if (effect.type === 'discard' || effect.type === 'exhaustChoice' || effect.type === 'moveChoice') {
      const sourceZone = effect.type === 'moveChoice' ? effect.from : 'hand';
      const mode = effect.type === 'moveChoice' ? effect.to === 'hand' ? 'retrieve' : 'topdeck' : effect.type === 'discard' ? 'discard' : 'exhaust';
      const toZone = mode === 'retrieve' ? 'hand' : mode === 'topdeck' ? 'drawPile' : mode === 'discard' ? 'discardPile' : 'exhaustPile';
      if (sourceZone === toZone) continue;
      const amount = Math.min(state[sourceZone].length, Math.max(0, Math.floor(effect.amount)), mode === 'retrieve' ? Math.max(0, 50 - state.hand.length) : Infinity);
      if (amount === 0) continue;
      if (amount === state[sourceZone].length) {
        const moved = [...state[sourceZone]];
        state[toZone].push(...moved);
        state[sourceZone] = [];
        emitCombatCue(state, { kind: mode === 'retrieve' ? 'draw' : mode === 'exhaust' ? 'exhaust' : 'discard', sourceId: 'player', card: context.sourceCard, cards: moved, fromZone: sourceZone, toZone });
        continue;
      }
      if (!context.sourceCard) continue;
      state.pendingChoice = {
        mode,
        ...(sourceZone !== 'hand' ? { sourceZone } : {}),
        amount,
        resume: {
          effects: structuredClone(effects.slice(index + 1)),
          defense: card.defense,
          ...(context.targetId ? { targetId: context.targetId } : {}),
          sourceCard: { ...context.sourceCard },
          ...(context.xEnergy !== undefined ? { xEnergy: context.xEnergy } : {}),
        },
      };
      appendLog(state, `${sourceZone === 'hand' ? '手札' : sourceZone === 'drawPile' ? '山札' : '捨て札'}から${amount}枚を${mode === 'retrieve' ? '手札に戻す' : mode === 'topdeck' ? '山札の一番上に置く' : mode === 'discard' ? '捨てる' : '廃棄する'}。カードを選んでください。`);
      break;
    }
    const resolve = resolvers[effect.type] as (
      state: CombatState,
      effect: Effect,
      card: Pick<CardDefinition, 'defense'>,
      context: EffectContext,
    ) => void;
    withCombatTraceContext(state, { sourceId: 'player', card: context.sourceCard, effect: effect.type }, () => resolve(state, effect, card, context));
  }
}
