import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MapNodeIcon, MAP_ICON_LABELS, type MapIconType } from '../components/MapNodeIcon';
import { RelicIcon } from '../components/RelicIcon';
import { getActivatedRelicId, RunHud } from '../components/RunHud';
import { RELIC_DEFINITIONS, STARTER_RELIC_IDS } from '../data/relics';
import { createCombat } from '../engine';
import { createRun, getAvailableNodes } from '../engine/run';
import { acquireRelic, reduceRelicAcquisition } from '../engine/relicAcquisition';
import { MapScreen, mapDescendants } from '../screens/MapScreen';
import { RelicAcquisitionScreen } from '../screens/RelicAcquisitionScreen';
import type { CombatCue } from '../presentation/types';
import type { RunState } from '../types/run';

const markup = (component: Parameters<typeof createElement>[0], props: object) => renderToStaticMarkup(createElement(component, props));

describe('original map and relic SVGs', () => {
  it('gives all eight node types different geometry with optional accessible names', () => {
    const outlines = new Set<string>();
    for (const type of Object.keys(MAP_ICON_LABELS) as MapIconType[]) {
      const svg = markup(MapNodeIcon, { type, label: MAP_ICON_LABELS[type] });
      expect(svg).toContain(`data-map-icon="${type}"`);
      expect(svg).toContain(`aria-label="${MAP_ICON_LABELS[type]}"`);
      expect(svg).not.toContain('<text');
      outlines.add([...svg.matchAll(/ d="([^"]+)"/g)].map((part) => part[1]).join('|'));
      expect(markup(MapNodeIcon, { type })).toContain('aria-hidden="true"');
    }
    expect(outlines.size).toBe(8);
  });

  it('renders every playable relic with stable individual carvings and correct metadata', () => {
    const carvings = new Set<string>();
    for (const relic of Object.values(RELIC_DEFINITIONS)) {
      const svg = markup(RelicIcon, { id: relic.id, label: relic.name });
      expect(svg).toContain(`data-relic-id="${relic.id}"`);
      expect(svg).toContain(`data-relic-class="${relic.classId ?? 'all'}"`);
      expect(svg).toContain(`data-relic-rarity="${relic.rarity ?? 'common'}"`);
      expect(svg).toContain(`data-relic-acquisition="${relic.acquisition ?? 'normal'}"`);
      expect(svg).not.toContain('<text');
      expect(svg).not.toContain('<image');
      const rune = [...svg.matchAll(/class="relic-id-rune" d="([^"]+)"/g)].map((part) => part[1]).join('|');
      expect(rune).not.toBe('');
      carvings.add(rune + [...svg.matchAll(/<g transform="translate\(4 4\)"[^>]*>(.*?)<\/g>/g)].map((part) => part[1]).join(''));
    }
    expect(carvings.size).toBe(Object.keys(RELIC_DEFINITIONS).length);
    expect(markup(RelicIcon, { id: 'unknown-relic' })).toBe('');
  });

  it('shows five map states from saved reachability without modifying connections', () => {
    const state = createRun('map-ui-progress', 'assassin');
    const first = getAvailableNodes(state)[0];
    const second = state.map.nodes.find((node) => node.id === first.connections[0])!;
    state.visited = [first.id, second.id]; state.currentNodeId = second.id; state.floor = 2;
    const saved = JSON.stringify(state);
    const svg = markup(MapScreen, { state, onAction: () => {} });
    for (const kind of ['current', 'available', 'visited', 'unreached', 'blocked']) expect(svg).toContain(`data-node-status="${kind}"`);
    const reachable = mapDescendants(state.map, second.id);
    for (const node of state.map.nodes) {
      const status = node.id === second.id ? 'current' : getAvailableNodes(state).some((next) => next.id === node.id) ? 'available' : state.visited.includes(node.id) ? 'visited' : reachable.has(node.id) ? 'unreached' : 'blocked';
      expect(svg).toMatch(new RegExp(`data-node-status="${status}" data-node-type="${node.type}"[^>]*>[\\s\\S]*?data-node-id="${node.id}"`));
    }
    expect(JSON.stringify(state)).toBe(saved);
  });
});

describe('relic presentation observation', () => {
  it('uses a stable trigger ID and keeps unrelated resources out of the relic HUD', () => {
    const frame = createCombat('relic-ui-cue');
    const cue: CombatCue = { kind: 'resource', resource: 'relic:prayer_knuckle', resourceAction: 'activate', frame };
    expect(getActivatedRelicId(cue)).toBe('prayer_knuckle');
    expect(getActivatedRelicId({ ...cue, resource: 'relic:unknown' })).toBeNull();
    expect(getActivatedRelicId({ ...cue, resource: 'stars' })).toBeNull();
    expect(getActivatedRelicId({ ...cue, resource: undefined, effect: 'relic', label: RELIC_DEFINITIONS.prayer_knuckle.name })).toBe('prayer_knuckle');
    const state = createRun('relic-ui-trigger', 'berserker'); state.relicIds.push('prayer_knuckle');
    const saved = JSON.stringify(state);
    const rendered = markup(RunHud, { state, cue, sequence: 7, onDeck: () => {}, onRelics: () => {}, onPotion: () => {} });
    expect(rendered).toContain('is-active');
    expect(rendered).toContain('祈りの拳石 が発動');
    const instant = markup(RunHud, { state, cue, sequence: 7, settings: { speed: 'instant', reducedMotion: false }, onDeck: () => {}, onRelics: () => {}, onPotion: () => {} });
    expect(instant).not.toContain('is-active');
    expect(instant).not.toContain('relic-activation-caption');
    expect(JSON.stringify(state)).toBe(saved);
  });
});

describe('saved relic acquisition screens', () => {
  const kinds = ['remove', 'upgrade', 'transform', 'copy', 'chooseCard'] as const;
  it.each(kinds)('previews and confirms the actual %s transaction without changing the viewed state', (kind) => {
    const relic = Object.values(RELIC_DEFINITIONS).find((entry) => entry.runEffect?.acquire?.some((operation) => operation.type === 'select' && operation.kind === kind))!;
    expect(relic).toBeDefined();
    let state = createRun(`relic-ui-${kind}`, 'berserker'); state.relicIds = [STARTER_RELIC_IDS.berserker];
    state = acquireRelic(state, relic.id, relic.acquisition === 'shop' ? 'shop' : relic.acquisition === 'event' ? 'event' : relic.acquisition === 'ancient' ? 'blessing' : 'reward', relic.acquisition === 'shop' ? 'shop' : 'map');
    const saved = JSON.stringify(state);
    const initial = markup(RelicAcquisitionScreen, { state, onAction: () => {} });
    expect(initial).toContain(`data-relic-acquisition-kind="${kind}"`);
    expect(initial).toContain('選択 0 /');
    expect(initial).toContain('disabled=""');
    expect(JSON.stringify(state)).toBe(saved);
    const acquisition = state.relicAcquisition!;
    state = reduceRelicAcquisition(state, kind === 'chooseCard' ? { type: 'selectRelicCards', cardIds: acquisition.offeredCardIds.slice(0, acquisition.count) }
      : { type: 'selectRelicCards', cardUids: acquisition.eligibleCardUids.slice(0, acquisition.count) });
    const selectedSaved = JSON.stringify(state);
    const selected = markup(RelicAcquisitionScreen, { state, onAction: () => {} });
    expect(selected).toContain('aria-pressed="true"');
    if (kind === 'upgrade') expect(selected).toContain('カードの強化プレビュー');
    if (kind === 'transform') expect(selected).toContain('変化後');
    expect(JSON.stringify(state)).toBe(selectedSaved);
    const committed = reduceRelicAcquisition(state, { type: 'confirmRelicAcquisition' });
    const receipt = committed.relicAcquisition!.receipt!;
    const result = markup(RelicAcquisitionScreen, { state: committed, onAction: () => {} });
    expect(result).toContain('data-relic-acquisition-stage="result"');
    expect(result).toContain('受け取った力とともに進む');
    for (const card of [...receipt.addedCards, ...receipt.upgradedCards, ...receipt.removedCards]) expect(result).toContain(`data-card-id="${card.cardId}"`);
    expect(reduceRelicAcquisition(committed, { type: 'confirmRelicAcquisition' })).toBe(committed);
  });

  it('shows exact permanent HP and gold changes and the replaced starter from the receipt', () => {
    const original = createRun('relic-ui-actual-deltas', 'berserker'); original.relicIds = [STARTER_RELIC_IDS.berserker]; original.hp = 40;
    for (const id of ['ref_noble_cape', 'ref_old_coin', 'ref_lee_waffle', 'ref_orobas_fingertip']) {
      expect(RELIC_DEFINITIONS[id], `receipt fixture relic ${id}`).toBeDefined();
      const source = RELIC_DEFINITIONS[id].acquisition;
      const state: RunState = acquireRelic(original, id, source === 'shop' ? 'shop' : source === 'event' ? 'event' : source === 'ancient' ? 'blessing' : 'reward', source === 'shop' ? 'shop' : 'map');
      const receipt = state.relicAcquisition!.receipt!;
      const result = markup(RelicAcquisitionScreen, { state, onAction: () => {} });
      expect(result).toContain(RELIC_DEFINITIONS[id].name);
      if (receipt.maxHpChange) expect(result).toContain(`最大HP ${receipt.maxHpChange > 0 ? '+' : ''}${receipt.maxHpChange}`);
      if (receipt.goldChange) expect(result).toContain(`ゴールド ${receipt.goldChange > 0 ? '+' : ''}${receipt.goldChange}`);
      for (const old of receipt.replacedRelicIds) expect(result).toContain(RELIC_DEFINITIONS[old].name);
    }
  });

  it('previews automatic egg upgrades on offered cards using the actual immutable acquisition reducer', () => {
    const relic = Object.values(RELIC_DEFINITIONS).find((entry) => entry.runEffect?.acquire?.some((operation) => operation.type === 'select' && operation.kind === 'chooseCard'))!;
    const original = createRun('relic-ui-egg-preview', 'berserker');
    original.relicIds = [STARTER_RELIC_IDS.berserker, 'ref_frozen_egg', 'ref_toxic_egg', 'ref_molten_egg'];
    const state = acquireRelic(original, relic.id, 'blessing', 'map');
    const saved = JSON.stringify(state);
    const view = markup(RelicAcquisitionScreen, { state, onAction: () => {} });
    for (const cardId of state.relicAcquisition!.offeredCardIds) expect(view).toContain(`data-card-id="${cardId}" data-upgraded="true"`);
    expect(JSON.stringify(state)).toBe(saved);
    expect(state.relicAcquisition!.selectedCardIds).toEqual([]);
  });
});
