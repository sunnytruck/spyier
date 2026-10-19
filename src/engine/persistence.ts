import { CARD_DEFINITIONS } from '../data/cards';
import { getEnemyDefinition } from '../data/enemies';
import { RELIC_DEFINITIONS } from '../data/relics';
import { POTION_DEFINITIONS } from '../data/potions';
import type { CombatState, Effect, GameSettings } from '../types/game';
import { normalizeCombatState } from './index';

export const SAVE_KEY = 'iwason-spire:save:v1';
export const SETTINGS_KEY = 'iwason-spire:settings:v1';
const DEFAULT_SETTINGS: GameSettings = { speed: 'normal', reducedMotion: false };
let saveWarning: string | null = null;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = 1_000_000): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value: unknown, max = 500): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;
const oneOf = (value: unknown, options: readonly string[]): value is string =>
  typeof value === 'string' && options.includes(value);

function actor(value: unknown): boolean {
  if (!record(value) || !text(value.id) || !text(value.name) || !integer(value.maxHp))
    return false;
  return (
    integer(value.hp, 0, value.maxHp) &&
    integer(value.strength, -1_000_000) &&
    ['block', 'weak', 'vulnerable', 'poison'].every((key) => integer(value[key]))
  );
}

function card(value: unknown): value is CombatState['hand'][number] {
  return (
    record(value) &&
    text(value.uid, 100) &&
    text(value.cardId, 100) &&
    Object.hasOwn(CARD_DEFINITIONS, value.cardId) &&
    typeof value.upgraded === 'boolean'
  );
}

function enemy(value: unknown): boolean {
  if (!actor(value) || !record(value)) return false;
  if (!integer(value.maxHp, 1) || (value.stun !== undefined && !integer(value.stun))) return false;
  const definition = getEnemyDefinition(value.id as string);
  if (value.intentPhase !== undefined &&
      (!integer(value.intentPhase, 0) || !definition?.phases?.[value.intentPhase]?.intents.length)) return false;
  const pattern = value.intentPhase === undefined ? definition?.intents : definition?.phases?.[value.intentPhase as number]?.intents;
  if (
    !definition ||
    !pattern ||
    !integer(value.intentIndex, 0, pattern.length - 1) ||
    !record(value.intent) ||
    (value.instanceId !== undefined && !text(value.instanceId, 100)) ||
    (value.doom !== undefined && !integer(value.doom))
  )
    return false;
  const intent = value.intent;
  if (
    !oneOf(intent.kind, ['attack', 'defend', 'buff', 'debuff']) ||
    !text(intent.label) ||
    !text(intent.description)
  )
    return false;
  for (const key of ['damage', 'block', 'strength', 'weak', 'vulnerable', 'poison', 'alliesBlock', 'alliesStrength']) {
    if (intent[key] !== undefined && !integer(intent[key], 0, 10_000)) return false;
  }
  return (
    (intent.allTargets === undefined || typeof intent.allTargets === 'boolean') &&
    (intent.hits === undefined || integer(intent.hits, 1, 20)) &&
    (intent.kind !== 'attack' || integer(intent.damage))
  );
}

const CLASS_IDS = ['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'] as const;
const POWER_KEYS = ['stillness', 'thorns', 'strengthOnTurn', 'poisonAura', 'drawOnTurn',
  'blockOnAttack', 'knifeDamage', 'knivesOnTurn', 'focusOnTurn', 'energyOnTurn'];

/** Only authored effect lists can be restored; saved JSON cannot inject new opcodes. */
function authoredLists(effects: Effect[]): Effect[][] {
  return [effects, ...effects.flatMap((effect) =>
    effect.type === 'conditional' || effect.type === 'nextTurn' ? authoredLists(effect.effects) : [],
  )];
}

function temporaryMechanics(value: Record<string, unknown>, enemyKeys: string[]): boolean {
  if (value.scheduledEffects !== undefined) {
    if (!Array.isArray(value.scheduledEffects) || value.scheduledEffects.length > 1000) return false;
    if (!value.scheduledEffects.every((entry) => {
      if (!record(entry) || !card(entry.sourceCard) || !Array.isArray(entry.effects)) return false;
      const definition = CARD_DEFINITIONS[entry.sourceCard.cardId];
      const effects = entry.sourceCard.upgraded ? definition.upgradedEffects : definition.effects;
      return authoredLists(effects).some((list) => list.some((effect) =>
        effect.type === 'nextTurn' && JSON.stringify(effect.effects) === JSON.stringify(entry.effects),
      ));
    })) return false;
  }
  if (value.turnModifiers !== undefined) {
    if (!Array.isArray(value.turnModifiers) || value.turnModifiers.length > 1000) return false;
    if (!value.turnModifiers.every((entry) => record(entry) && integer(entry.amount, -1_000_000) && (
      entry.kind === 'power' ? oneOf(entry.power, POWER_KEYS)
        : entry.kind === 'status' && oneOf(entry.status, ['strength', 'weak', 'vulnerable', 'poison']) &&
          (entry.targetId === 'player' || enemyKeys.includes(String(entry.targetId)))
    ))) return false;
  }
  return true;
}

function classState(value: Record<string, unknown>): boolean {
  if (value.classId !== undefined && !oneOf(value.classId, CLASS_IDS)) return false;
  if (value.classId !== undefined && value.classResources === undefined) return false;
  if (value.classResources !== undefined) {
    const resources = value.classResources;
    if (
      !record(resources) ||
      !['stars', 'starsGainedThisTurn', 'forge', 'ostyHp', 'nextTurnEnergy'].every((key) =>
        integer(resources[key]),
      ) ||
      !integer(resources.focus, -1_000_000) ||
      !integer(resources.temporaryFocus, -1_000_000) ||
      !Array.isArray(resources.orbs) ||
      resources.orbs.length > 3 ||
      !resources.orbs.every((orb) => oneOf(orb, ['lightning', 'frost']))
    )
      return false;
  }
  return true;
}

/** A suspended effect queue must be a suffix of the card's real definition. */
function pendingChoice(value: Record<string, unknown>, enemyKeys: string[]): boolean {
  if (value.pendingChoice === undefined) return true;
  const pending = value.pendingChoice;
  const sourceZone = record(pending) ? pending.sourceZone ?? 'hand' : 'hand';
  const candidates = typeof sourceZone === 'string' ? value[sourceZone] : undefined;
  if (
    !record(pending) ||
    value.phase !== 'player' ||
    !oneOf(pending.mode, ['discard', 'exhaust', 'topdeck', 'retrieve']) ||
    !oneOf(sourceZone, ['hand', 'discardPile', 'drawPile']) ||
    !Array.isArray(candidates) ||
    !integer(pending.amount, 1, candidates.length) ||
    !record(pending.resume) ||
    !card(pending.resume.sourceCard) ||
    typeof pending.resume.defense !== 'boolean' ||
    !Array.isArray(pending.resume.effects) ||
    (pending.resume.xEnergy !== undefined && !integer(pending.resume.xEnergy)) ||
    (pending.resume.targetId !== undefined &&
      (!text(pending.resume.targetId, 100) || !enemyKeys.includes(pending.resume.targetId)))
  )
    return false;
  const source = pending.resume.sourceCard;
  const definition = CARD_DEFINITIONS[source.cardId];
  const effects = source.upgraded ? definition.upgradedEffects : definition.effects;
  if (pending.resume.defense !== definition.defense) return false;
  const amount = pending.amount;
  const remaining = JSON.stringify(pending.resume.effects);
  // The preceding opcode created this exact choice; arbitrary saved effect payloads are rejected.
  return authoredLists(effects).some((list) => list.some((effect, index) => {
    const mode = effect.type === 'discard' ? 'discard' : effect.type === 'exhaustChoice' ? 'exhaust'
      : effect.type === 'moveChoice' ? effect.to === 'hand' ? 'retrieve' : 'topdeck' : null;
    const zone = effect.type === 'moveChoice' ? effect.from : 'hand';
    return (
      mode === pending.mode && zone === sourceZone &&
      'amount' in effect &&
      amount === Math.min(effect.amount, candidates.length,
        mode === 'retrieve' && Array.isArray(value.hand) ? Math.max(0, 50 - value.hand.length) : Infinity) &&
      JSON.stringify(list.slice(index + 1)) === remaining
    );
  }));
}

/** Validate before exposing a local save to the reducer or UI. No partial state is restored. */
export function isValidCombatState(value: unknown): value is CombatState {
  if (
    !record(value) ||
    value.version !== 1 ||
    !text(value.seed, 256) ||
    !integer(value.rngState, 0, 0xffffffff) ||
    !integer(value.turn, 1) ||
    !oneOf(value.phase, ['player', 'victory', 'defeat']) ||
    !actor(value.player) ||
    !actor(value.enemy) ||
    !record(value.enemy) ||
    !record(value.player) ||
    !integer(value.energy) ||
    !integer(value.maxEnergy, 1, 999) ||
    !integer(value.jitto, 0, 100) ||
    !integer(value.stillness) ||
    !integer(value.cardsPlayedThisTurn) ||
    !integer(value.nextId, 1) ||
    !record(value.stats) ||
    !integer(value.stats.cardsPlayed) ||
    !integer(value.stats.damageDealt)
  )
    return false;

  if (!enemy(value.enemy) || !classState(value)) return false;
  if (value.player.maxHp === 0 && value.phase !== 'defeat') return false;
  if (value.intangible !== undefined && !integer(value.intangible)) return false;
  if (value.cardDamageBonuses !== undefined && (!record(value.cardDamageBonuses) ||
    !Object.entries(value.cardDamageBonuses).every(([id, amount]) => Object.hasOwn(CARD_DEFINITIONS, id) && integer(amount)))) return false;
  const enemies = value.enemies === undefined ? [value.enemy] : value.enemies;
  if (!Array.isArray(enemies) || enemies.length < 1 || enemies.length > 3 || !enemies.every(enemy))
    return false;
  const enemyKeys = enemies.map((entry) => String(entry.instanceId ?? entry.id));
  if (new Set(enemyKeys).size !== enemyKeys.length) return false;
  if (!pendingChoice(value, enemyKeys) || !temporaryMechanics(value, enemyKeys)) return false;
  if (
    value.selectedEnemyId !== undefined &&
    (!text(value.selectedEnemyId, 100) || !enemyKeys.includes(value.selectedEnemyId))
  )
    return false;
  if (
    value.relicIds !== undefined &&
    (!Array.isArray(value.relicIds) ||
      new Set(value.relicIds).size !== value.relicIds.length ||
      !value.relicIds.every((id) => typeof id === 'string' && Object.hasOwn(RELIC_DEFINITIONS, id)))
  )
    return false;
  if (
    value.potions !== undefined &&
    (!Array.isArray(value.potions) ||
      value.potions.length !== 3 ||
      !value.potions.every(
        (id) => id === null || (typeof id === 'string' && Object.hasOwn(POTION_DEFINITIONS, id)),
      ))
  )
    return false;
  if (
    value.powerStacks !== undefined &&
    (!record(value.powerStacks) ||
      !Object.entries(value.powerStacks).every(
        ([key, amount]) =>
          oneOf(key, POWER_KEYS) && integer(amount),
      ))
  )
    return false;
  if (
    value.relicCounters !== undefined &&
    (!record(value.relicCounters) ||
      !Object.entries(value.relicCounters).every(
        ([key, amount]) => text(key, 100) && integer(amount),
      ))
  )
    return false;

  const zoneKeys = ['hand', 'drawPile', 'discardPile', 'exhaustPile', 'powers'] as const;
  if (
    !Array.isArray(value.deck) ||
    value.deck.length === 0 ||
    value.deck.length > 1000 ||
    !value.deck.every(card)
  )
    return false;
  const generated = value.generatedCards ?? [];
  if (!Array.isArray(generated) || generated.length > 1000 || !generated.every(card)) return false;
  if (generated.some((instance) => {
    const match = /^generated-(\d+)$/.exec(instance.uid);
    return !match || Number(match[1]) >= (value.nextId as number);
  })) return false;
  const inventory = [...value.deck, ...generated];
  const knownCards = new Map(inventory.map((instance) => [instance.uid, instance]));
  if (knownCards.size !== inventory.length) return false;
  const temporaryUpgrades = value.temporaryUpgrades ?? [];
  if (!Array.isArray(temporaryUpgrades) || temporaryUpgrades.length > 1000 ||
    new Set(temporaryUpgrades).size !== temporaryUpgrades.length ||
    !temporaryUpgrades.every((uid) => typeof uid === 'string' && knownCards.get(uid)?.upgraded)) return false;
  const sameUpgrade = (saved: CombatState['hand'][number], original: CombatState['hand'][number]) =>
    saved.upgraded === original.upgraded || (original.upgraded && !saved.upgraded && temporaryUpgrades.includes(saved.uid));
  if (Array.isArray(value.scheduledEffects) && value.scheduledEffects.some((entry) => {
    if (!record(entry) || !card(entry.sourceCard)) return true;
    const original = knownCards.get(entry.sourceCard.uid);
    return !original || original.cardId !== entry.sourceCard.cardId || !sameUpgrade(entry.sourceCard, original);
  })) return false;
  const seen = new Set<string>();
  if (record(value.pendingChoice) && record(value.pendingChoice.resume)) {
    const source = value.pendingChoice.resume.sourceCard;
    if (!card(source)) return false;
    const original = knownCards.get(source.uid);
    if (!original || original.cardId !== source.cardId || !sameUpgrade(source, original))
      return false;
    seen.add(source.uid);
  }
  for (const key of zoneKeys) {
    const zone = value[key];
    if (!Array.isArray(zone) || zone.length > 1000 || !zone.every(card)) return false;
    for (const instance of zone) {
      const original = knownCards.get(instance.uid);
      if (
        !original ||
        seen.has(instance.uid) ||
        original.cardId !== instance.cardId ||
        original.upgraded !== instance.upgraded ||
        (key === 'powers' && CARD_DEFINITIONS[instance.cardId].type !== 'power')
      )
        return false;
      seen.add(instance.uid);
    }
  }
  if (seen.size !== knownCards.size) return false;

  if (
    !Array.isArray(value.log) ||
    value.log.length > 2000 ||
    !value.log.every(
      (entry) =>
        record(entry) &&
        integer(entry.id) &&
        integer(entry.turn, 1) &&
        text(entry.text, 2000) &&
        oneOf(entry.kind, ['info', 'damage', 'block', 'gauge', 'result']),
    )
  )
    return false;
  if (
    !Array.isArray(value.events) ||
    value.events.length > 2000 ||
    !value.events.every(
      (event) =>
        record(event) &&
        integer(event.id) &&
        oneOf(event.target, ['player', 'enemy']) &&
        oneOf(event.kind, ['damage', 'block', 'heal', 'gauge', 'power']) &&
        integer(event.amount, event.kind === 'gauge' ? -100 : 0) &&
        (event.enemyId === undefined ||
          (text(event.enemyId, 100) && enemyKeys.includes(event.enemyId))),
    )
  )
    return false;
  const allDead = enemies.every((entry) => entry.hp === 0);
  if (value.phase === 'player' && (value.player.hp === 0 || allDead)) return false;
  if (value.phase === 'victory' && (!allDead || value.player.hp === 0)) return false;
  if (value.phase === 'defeat' && value.player.hp !== 0) return false;
  return true;
}

export function serializeGame(state: CombatState): string {
  if (!isValidCombatState(state)) throw new Error('保存できない戦闘状態です。');
  return JSON.stringify({ version: 1, combat: state });
}

export function deserializeGame(raw: string): CombatState | null {
  try {
    if (raw.length > 2_000_000) return null;
    const saved: unknown = JSON.parse(raw);
    return record(saved) && saved.version === 1 && isValidCombatState(saved.combat)
      ? normalizeCombatState(saved.combat)
      : null;
  } catch {
    return null;
  }
}

export function loadGame(): CombatState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const state = deserializeGame(raw);
    if (!state) {
      saveWarning = 'セーブデータを読み込めませんでした。「新しく始める」で安全に再開できます。';
      return null;
    }
    return state;
  } catch {
    saveWarning = 'このブラウザでは自動保存を利用できません。このタブではそのまま遊べます。';
    return null;
  }
}

export function saveGame(state: CombatState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, serializeGame(state));
    saveWarning = null;
    return true;
  } catch {
    saveWarning = '自動保存に失敗しました。このタブではそのまま遊べます。';
    return false;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    saveWarning = null;
  } catch {
    saveWarning = 'セーブデータの削除に失敗しました。';
  }
}

export function getSaveWarning(): string | null {
  return saveWarning;
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const settings: unknown = JSON.parse(raw);
    if (
      record(settings) &&
      oneOf(settings.speed, ['normal', 'fast', 'instant']) &&
      typeof settings.reducedMotion === 'boolean'
    )
      return {
        speed: settings.speed as GameSettings['speed'],
        reducedMotion: settings.reducedMotion,
        ...(oneOf(settings.effectsQuality, ['auto', 'full', 'low'])
          ? { effectsQuality: settings.effectsQuality as GameSettings['effectsQuality'] }
          : {}),
      };
  } catch {
    /* Settings failures never prevent playing. */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: GameSettings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
