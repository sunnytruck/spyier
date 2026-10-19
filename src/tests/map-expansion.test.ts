import { describe, expect, it } from 'vitest';
import { createCombat } from '../engine';
import { generateMap, validateMap } from '../engine/map';
import { seedToState } from '../engine/random';
import { createRun } from '../engine/run';
import { deserializeRun, serializeRun } from '../engine/runPersistence';
import type { FloorMap, MapNode, NodeType } from '../types/run';

interface RouteTotals { battles: number; elites: number; shops: number; rests: number }

function routeTotals(map: FloorMap): RouteTotals[] {
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const routes: RouteTotals[] = [];
  function walk(node: MapNode, previous: RouteTotals) {
    const next = {
      battles: previous.battles + (node.type === 'battle' || node.type === 'elite' ? 1 : 0),
      elites: previous.elites + (node.type === 'elite' ? 1 : 0),
      shops: previous.shops + (node.type === 'shop' ? 1 : 0),
      rests: previous.rests + (node.type === 'rest' ? 1 : 0),
    };
    if (node.type === 'boss') routes.push(next);
    else node.connections.forEach((id) => walk(byId.get(id)!, next));
  }
  map.nodes.filter((node) => node.floor === 1).forEach((node) => walk(node, { battles: 0, elites: 0, shops: 0, rests: 0 }));
  return routes;
}

function legacyMap(): FloorMap {
  // A valid old-format layout deliberately includes adjacent rests and fixed lanes.
  const rows: NodeType[][] = [
    ['battle', 'battle', 'battle'], ['battle', 'battle', 'battle'],
    ['event', 'battle', 'event'], ['shop', 'battle', 'rest'],
    ['elite', 'battle', 'event'], ['treasure', 'rest', 'treasure'],
    ['rest', 'event', 'shop'], ['elite', 'battle', 'event'],
    ['battle', 'shop', 'treasure'], ['battle', 'battle', 'battle'],
    ['rest', 'rest', 'rest'], ['boss'],
  ];
  const nodes = rows.flatMap((types, index) => types.map((type, lane): MapNode => ({
    id: `floor-${index + 1}-${type === 'boss' ? 1 : lane}`,
    floor: index + 1, lane: type === 'boss' ? 1 : lane, type,
    connections: index === 11 ? [] : [`floor-${index + 2}-${index === 10 ? 1 : lane}`],
  })));
  nodes.find((node) => node.id === 'floor-6-1')!.connections.push('floor-7-0');
  return { floors: 12, nodes };
}

describe('randomized map topology and weighted room placement', () => {
  it('reproduces topology and rooms exactly without sharing mutable generated nodes', () => {
    const first = generateMap('seeded-routes-じっと');
    const expected = structuredClone(first);
    expect(generateMap('seeded-routes-じっと')).toEqual(expected);
    first.nodes[0].connections.length = 0;
    first.nodes[3].type = 'boss';
    expect(generateMap('seeded-routes-じっと')).toEqual(expected);
  });

  it('changes the graph itself and the floor type mixtures rather than shuffling a fixed room schedule', () => {
    const topology = new Set<string>();
    const placement = new Set<string>();
    const roomBudgets = new Set<string>();
    const floorMixtures = new Map<number, Set<string>>();
    for (let index = 0; index < 256; index += 1) {
      const map = generateMap(`topology-diversity-${index}`);
      topology.add(JSON.stringify(map.nodes.map((node) => node.connections)));
      placement.add(JSON.stringify(map.nodes.map((node) => node.type)));
      roomBudgets.add(JSON.stringify(['battle', 'elite', 'event', 'shop', 'rest', 'treasure'].map((type) => map.nodes.filter((node) => node.type === type).length)));
      for (let floor = 3; floor <= 10; floor += 1) {
        const mixtures = floorMixtures.get(floor) ?? new Set<string>();
        mixtures.add(map.nodes.filter((node) => node.floor === floor).map((node) => node.type).sort().join(','));
        floorMixtures.set(floor, mixtures);
      }
    }
    expect(topology.size).toBeGreaterThan(200);
    expect(placement.size).toBeGreaterThan(200);
    expect(roomBudgets.size).toBeGreaterThan(10);
    for (const mixtures of floorMixtures.values()) expect(mixtures.size).toBeGreaterThan(3);
  });

  it('has only noncrossing split/merge edges and removes at least one old straight middle-lane continuation', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const map = generateMap(`edge-covers-${seed}`);
      const byId = new Map(map.nodes.map((node) => [node.id, node]));
      expect(validateMap(map)).toBe(true);
      expect(map.nodes.some((node) => node.lane === 1 && node.floor < 11 && !node.connections.includes(`floor-${node.floor + 1}-1`))).toBe(true);
      for (let floor = 1; floor <= 10; floor += 1) {
        const row = map.nodes.filter((node) => node.floor === floor);
        const nextRow = map.nodes.filter((node) => node.floor === floor + 1);
        const edges = row.flatMap((node) => node.connections.map((id) => [node.lane, byId.get(id)!.lane]));
        for (const node of row) {
          expect(node.connections.length).toBeGreaterThanOrEqual(1);
          expect(node.connections.length).toBeLessThanOrEqual(2);
        }
        for (const node of nextRow) {
          const incoming = row.filter((parent) => parent.connections.includes(node.id)).length;
          expect(incoming).toBeGreaterThanOrEqual(1);
          expect(incoming).toBeLessThanOrEqual(2);
        }
        expect(edges.some(([a, b]) => edges.some(([c, d]) => a < c && b > d))).toBe(false);
      }
    }
  });

  it('keeps safe opening, late recovery, budgets, and no repeated adjacent special rooms across 300 seeds', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const map = generateMap(`room-constraints-${seed}`);
      const byId = new Map(map.nodes.map((node) => [node.id, node]));
      const count = (type: NodeType) => map.nodes.filter((node) => node.type === type).length;
      expect(map.nodes).toHaveLength(34);
      expect(map.nodes.filter((node) => node.floor <= 2).every((node) => node.type === 'battle')).toBe(true);
      expect(map.nodes.filter((node) => node.floor === 11).every((node) => node.type === 'rest')).toBe(true);
      expect(count('boss')).toBe(1);
      expect(count('elite')).toBeGreaterThanOrEqual(3);
      expect(count('elite')).toBeLessThanOrEqual(4);
      expect(count('shop')).toBeGreaterThanOrEqual(2);
      expect(count('shop')).toBeLessThanOrEqual(3);
      expect(count('rest')).toBeGreaterThanOrEqual(4);
      expect(count('rest')).toBeLessThanOrEqual(5);
      expect(count('event')).toBeGreaterThanOrEqual(5);
      expect(count('event')).toBeLessThanOrEqual(6);
      expect(count('treasure')).toBeGreaterThanOrEqual(1);
      expect(count('treasure')).toBeLessThanOrEqual(2);
      expect(count('battle')).toBeGreaterThanOrEqual(13);
      expect(count('battle')).toBeLessThanOrEqual(18);
      for (const node of map.nodes) {
        if (node.type === 'elite') expect([5, 6, 8, 9]).toContain(node.floor);
        if (node.type !== 'battle')
          for (const id of node.connections) expect(byId.get(id)!.type).not.toBe(node.type);
      }
    }
  });

  it('offers a zero-elite route and a two-elite route while every possible route gets enough combat and limited shops/rests', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const routes = routeTotals(generateMap(`route-balance-${seed}`));
      expect(routes.length).toBeGreaterThan(3);
      expect(Math.min(...routes.map((route) => route.elites))).toBe(0);
      expect(Math.max(...routes.map((route) => route.elites))).toBe(2);
      for (const route of routes) {
        expect(route.battles).toBeGreaterThanOrEqual(4);
        expect(route.shops).toBeLessThanOrEqual(2);
        expect(route.rests).toBeGreaterThanOrEqual(1);
        expect(route.rests).toBeLessThanOrEqual(3);
      }
    }
  });

  it('does not consume or change run or combat random state', () => {
    const run = createRun('independent-map-stream', 'machinist');
    const combat = createCombat('independent-map-stream');
    const beforeRun = serializeRun(run);
    const beforeCombat = JSON.stringify(combat);
    for (let index = 0; index < 10; index += 1) generateMap(`other-map-${index}`);
    expect(run.rngState).toBe(seedToState('independent-map-stream:run'));
    expect(serializeRun(run)).toBe(beforeRun);
    expect(JSON.stringify(combat)).toBe(beforeCombat);
    expect(createCombat('independent-map-stream')).toEqual(combat);
  });

  it('accepts and restores old saved fixed-lane maps without applying new placement rules or rerolling them', () => {
    const map = legacyMap();
    expect(validateMap(map)).toBe(true);
    const run = createRun('old-map-must-survive', 'assassin');
    run.map = map;
    const saved = serializeRun(run);
    const restored = deserializeRun(saved)!;
    expect(restored).not.toBeNull();
    expect(restored.map).toEqual(map);
    expect(serializeRun(restored)).toBe(saved);
    expect(restored.map).not.toEqual(generateMap(run.seed));
  });

  it('still rejects corrupted saved edges rather than silently repairing or regenerating them', () => {
    const map = legacyMap();
    map.nodes[0].connections.push('floor-12-1');
    expect(validateMap(map)).toBe(false);
    const run = createRun('broken-legacy-map');
    run.map = map;
    expect(() => serializeRun(run)).toThrow('保存できない探索状態');
    expect(deserializeRun(JSON.stringify({ version: 2, run }))).toBeNull();
  });
});
