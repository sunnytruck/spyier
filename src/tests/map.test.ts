import { describe, expect, it } from 'vitest';
import { generateMap, validateMap } from '../engine/map/generate';
import type { FloorMap, MapNode } from '../types/run';

function reachable(map: FloorMap, starts: MapNode[]): Set<string> {
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const reached = new Set<string>();
  const pending = starts.map((node) => node.id);
  while (pending.length) {
    const id = pending.pop()!;
    if (reached.has(id)) continue;
    reached.add(id);
    pending.push(...(byId.get(id)?.connections ?? []));
  }
  return reached;
}

describe('seeded twelve-floor branching maps', () => {
  it('recreates the same map from the same seed while allowing different routes between runs', () => {
    expect(generateMap('same-map')).toEqual(generateMap('same-map'));
    expect(generateMap('map-a')).not.toEqual(generateMap('map-b'));
  });

  it('has exactly twelve floors with three starting options and a single final boss', () => {
    const map = generateMap('twelve-floors');
    expect(map.floors).toBe(12);
    expect(new Set(map.nodes.map((node) => node.floor))).toEqual(
      new Set(Array.from({ length: 12 }, (_, index) => index + 1)),
    );
    expect(map.nodes.filter((node) => node.floor === 1)).toHaveLength(3);
    expect(
      map.nodes.filter((node) => node.floor === 1).every((node) => node.type === 'battle'),
    ).toBe(true);
    const finalFloor = map.nodes.filter((node) => node.floor === 12);
    expect(finalFloor).toHaveLength(1);
    expect(finalFloor[0].type).toBe('boss');
    expect(finalFloor[0].connections).toEqual([]);
    expect(
      map.nodes.filter((node) => node.floor === 11).every((node) => node.type === 'rest'),
    ).toBe(true);
  });

  it('has no unreachable nodes or dead ends across one hundred seeds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const map = generateMap(`map-invariants-${seed}`);
      const byId = new Map(map.nodes.map((node) => [node.id, node]));
      const boss = map.nodes.find((node) => node.type === 'boss')!;
      expect(validateMap(map), `seed ${seed}`).toBe(true);
      expect(byId.size, `unique node IDs, seed ${seed}`).toBe(map.nodes.length);
      expect(
        reachable(
          map,
          map.nodes.filter((node) => node.floor === 1),
        ).size,
        `all nodes reachable, seed ${seed}`,
      ).toBe(map.nodes.length);
      for (const node of map.nodes) {
        if (node.floor < 12)
          expect(node.connections.length, `${node.id} has a continuation`).toBeGreaterThan(0);
        expect(new Set(node.connections).size).toBe(node.connections.length);
        for (const id of node.connections) expect(byId.get(id)?.floor).toBe(node.floor + 1);
        expect(reachable(map, [node]).has(boss.id), `${node.id} reaches boss, seed ${seed}`).toBe(
          true,
        );
      }
    }
  });

  it('rejects disconnected branches and edges to unknown nodes', () => {
    const deadEnd = generateMap('broken-map');
    deadEnd.nodes.find((node) => node.floor === 5)!.connections = [];
    expect(validateMap(deadEnd)).toBe(false);

    const unknownNode = generateMap('broken-map');
    unknownNode.nodes[0].connections.push('missing-node');
    expect(validateMap(unknownNode)).toBe(false);
  });
});
