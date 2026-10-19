import { CARD_DEFINITIONS } from '../data/cards';
import { EVENT_DEFINITIONS } from '../data/events';
import { POTION_DEFINITIONS } from '../data/potions';
import { RELIC_DEFINITIONS } from '../data/relics';
import type { CombatState } from '../types/game';
import type { FloorMap, RunState } from '../types/run';
import { normalizeCombatState } from './index';
import { validateMap } from './map';
import { isValidCombatState } from './persistence';

export const RUN_SAVE_KEY = 'iwason-spire:run:v2';
let warning: string | null = null;
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, min = 0, max = 1_000_000): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const text = (v: unknown, max = 256): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const member = (v: unknown, values: readonly string[]): v is string =>
  typeof v === 'string' && values.includes(v);
const known = (v: unknown, definitions: object): v is string =>
  typeof v === 'string' && Object.hasOwn(definitions, v);
const unique = (v: unknown, check: (entry: unknown) => boolean, max = 1000): v is string[] =>
  Array.isArray(v) && v.length <= max && v.every(check) && new Set(v).size === v.length;

function mapShape(v: unknown): v is FloorMap {
  if (!record(v) || v.floors !== 12 || !Array.isArray(v.nodes) || v.nodes.length !== 34)
    return false;
  for (const node of v.nodes) {
    if (
      !record(node) ||
      !text(node.id, 100) ||
      !int(node.floor, 1, 12) ||
      !int(node.lane, 0, 2) ||
      !member(node.type, ['battle', 'elite', 'event', 'shop', 'rest', 'treasure', 'boss']) ||
      !unique(node.connections, (entry) => text(entry, 100), 3)
    )
      return false;
  }
  return validateMap(v as unknown as FloorMap);
}

/** Reject incompatible saves atomically. Restoration never regenerates rooms or rewards. */
export function isValidRunState(value: unknown): value is RunState {
  if (
    !record(value) ||
    value.version !== 2 ||
    !text(value.seed) ||
    !int(value.rngState, 0, 0xffffffff) ||
    !member(value.screen, [
      'map',
      'combat',
      'reward',
      'relic',
      'event',
      'shop',
      'rest',
      'upgrade',
      'victory',
      'defeat',
    ]) ||
    !int(value.floor, 0, 12) ||
    !int(value.maxHp, 1) ||
    !int(value.hp, 0, value.maxHp) ||
    !int(value.gold) ||
    !int(value.nextCardId, 1) ||
    !record(value.stats) ||
    !['battlesWon', 'elitesDefeated', 'cardsAdded'].every((key) =>
      int((value.stats as Record<string, unknown>)[key]),
    ) ||
    !Array.isArray(value.log) ||
    value.log.length > 1000 ||
    !value.log.every((entry) => text(entry, 2000)) ||
    !mapShape(value.map) ||
    !unique(value.visited, (entry) => text(entry, 100), 12)
  )
    return false;

  if (
    !Array.isArray(value.deck) ||
    value.deck.length < 1 ||
    value.deck.length > 1000 ||
    !value.deck.every(
      (card) =>
        record(card) &&
        text(card.uid, 100) &&
        known(card.cardId, CARD_DEFINITIONS) &&
        typeof card.upgraded === 'boolean',
    )
  )
    return false;
  if (new Set(value.deck.map((card) => card.uid)).size !== value.deck.length) return false;
  const nextCardId = value.nextCardId;
  if (
    value.deck.some((card) => {
      const match = /^card-(\d+)$/.exec(card.uid);
      return match !== null && Number(match[1]) >= nextCardId;
    })
  )
    return false;
  if (
    !unique(value.relicIds, (id) => known(id, RELIC_DEFINITIONS), 10) ||
    !Array.isArray(value.potions) ||
    value.potions.length !== 3 ||
    !value.potions.every((id) => id === null || known(id, POTION_DEFINITIONS))
  )
    return false;

  const byId = new Map(value.map.nodes.map((node) => [node.id, node]));
  if (value.floor !== value.visited.length) return false;
  for (let index = 0; index < value.visited.length; index++) {
    const node = byId.get(value.visited[index]);
    if (
      !node ||
      node.floor !== index + 1 ||
      (index > 0 && !byId.get(value.visited[index - 1])!.connections.includes(node.id))
    )
      return false;
  }
  if (value.floor === 0) {
    if (value.currentNodeId !== null || value.screen !== 'map') return false;
  } else if (value.currentNodeId !== value.visited[value.visited.length - 1]) return false;
  const current =
    typeof value.currentNodeId === 'string' ? byId.get(value.currentNodeId) : undefined;

  if (value.reward !== null) {
    if (
      !record(value.reward) ||
      !unique(value.reward.cardIds, (id) => known(id, CARD_DEFINITIONS), 3) ||
      !int(value.reward.gold) ||
      (value.reward.relicId !== null && !known(value.reward.relicId, RELIC_DEFINITIONS)) ||
      (value.reward.potionId !== null && !known(value.reward.potionId, POTION_DEFINITIONS))
    )
      return false;
  }
  if (value.shop !== null) {
    if (
      !record(value.shop) ||
      !unique(value.shop.cardIds, (id) => known(id, CARD_DEFINITIONS), 3) ||
      (value.shop.relicId !== null && !known(value.shop.relicId, RELIC_DEFINITIONS)) ||
      (value.shop.potionId !== null && !known(value.shop.potionId, POTION_DEFINITIONS)) ||
      typeof value.shop.removed !== 'boolean' ||
      !unique(value.shop.purchased, (id) => text(id, 150), 6)
    )
      return false;
    const allowedPurchases = [
      ...value.shop.cardIds.map((id) => `card:${id}`),
      'relic',
      'potion',
      'remove',
    ];
    if (!value.shop.purchased.every((id) => allowedPurchases.includes(id))) return false;
  }
  if (value.eventId !== null && !known(value.eventId, EVENT_DEFINITIONS)) return false;
  if (value.combat !== null) {
    if (
      !isValidCombatState(value.combat) ||
      value.combat.player.hp !== value.hp ||
      value.combat.player.maxHp !== value.maxHp
    )
      return false;
    // Rewards may already have added a card or potion after the terminal snapshot.
    // While fighting, both state layers must describe exactly the same inventory.
    if (value.screen === 'combat') {
      if (value.combat.deck.length !== value.deck.length) return false;
      const cards = new Map(value.deck.map((card) => [card.uid, card]));
      if (
        !value.combat.deck.every((card) => {
          const original = cards.get(card.uid);
          return original && original.cardId === card.cardId && original.upgraded === card.upgraded;
        })
      )
        return false;
      if (
        JSON.stringify(value.combat.relicIds ?? []) !== JSON.stringify(value.relicIds) ||
        JSON.stringify(value.combat.potions ?? [null, null, null]) !== JSON.stringify(value.potions)
      )
        return false;
    }
  }

  const battleNode = current && ['battle', 'elite', 'boss'].includes(current.type);
  if (
    value.screen === 'combat' &&
    (!battleNode || !value.combat || value.combat.phase !== 'player')
  )
    return false;
  if (
    value.screen === 'defeat' &&
    (!value.combat || value.combat.phase !== 'defeat' || value.hp !== 0)
  )
    return false;
  if (
    value.screen === 'victory' &&
    (current?.type !== 'boss' || !value.combat || value.combat.phase !== 'victory')
  )
    return false;
  if (
    value.screen === 'reward' &&
    (!battleNode ||
      !record(value.reward) ||
      !Array.isArray(value.reward.cardIds) ||
      value.reward.cardIds.length !== 3 ||
      !value.combat ||
      value.combat.phase !== 'victory')
  )
    return false;
  if (
    value.screen === 'relic' &&
    (!record(value.reward) ||
      value.reward.relicId === null ||
      (current?.type !== 'treasure' && current?.type !== 'elite'))
  )
    return false;
  if (value.screen === 'event' && (current?.type !== 'event' || value.eventId === null))
    return false;
  if (value.screen === 'shop' && (current?.type !== 'shop' || value.shop === null)) return false;
  if (['rest', 'upgrade'].includes(value.screen) && current?.type !== 'rest') return false;
  if (value.screen !== 'defeat' && value.hp === 0) return false;
  if (
    value.screen === 'map' &&
    (value.combat !== null ||
      value.reward !== null ||
      value.shop !== null ||
      value.eventId !== null)
  )
    return false;
  return true;
}

export function serializeRun(state: RunState): string {
  if (!isValidRunState(state)) throw new Error('保存できない探索状態です。');
  return JSON.stringify({ version: 2, run: state });
}

export function deserializeRun(raw: string): RunState | null {
  try {
    if (raw.length > 3_000_000) return null;
    const data: unknown = JSON.parse(raw);
    if (!record(data) || data.version !== 2 || !isValidRunState(data.run)) return null;
    const state = data.run;
    if (state.combat) state.combat = normalizeCombatState(state.combat as CombatState);
    return state;
  } catch {
    return null;
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_SAVE_KEY);
    if (!raw) return null;
    const state = deserializeRun(raw);
    if (!state) warning = '探索セーブを読み込めませんでした。新しい探索を開始できます。';
    return state;
  } catch {
    warning = '自動保存を利用できません。このタブでは探索を続けられます。';
    return null;
  }
}

export function saveRun(state: RunState): boolean {
  try {
    localStorage.setItem(RUN_SAVE_KEY, serializeRun(state));
    warning = null;
    return true;
  } catch {
    warning = '探索の自動保存に失敗しました。このタブでは引き続き遊べます。';
    return false;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(RUN_SAVE_KEY);
    warning = null;
  } catch {
    warning = '探索セーブの削除に失敗しました。';
  }
}

export function getRunSaveWarning(): string | null {
  return warning;
}
