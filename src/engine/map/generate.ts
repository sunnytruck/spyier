import type { FloorMap, MapNode, NodeType } from '../../types/run';
import { nextRandom, seedToState } from '../random';

type Edge = readonly [number, number];

function seededRandom(seed: string): () => number {
  let state = seedToState(seed);
  return () => {
    const random = nextRandom(state);
    state = random.state;
    return random.value;
  };
}

/** Local noncrossing edge covers allow splits/merges without requiring a middle lane. */
const EDGE_COVERS: Edge[][] = (() => {
  const allowed: Edge[] = [];
  for (let from = 0; from < 3; from += 1)
    for (let to = 0; to < 3; to += 1)
      if (Math.abs(from - to) <= 1) allowed.push([from, to]);
  const covers: Edge[][] = [];
  for (let mask = 0; mask < 2 ** allowed.length; mask += 1) {
    const edges = allowed.filter((_, index) => (mask & 2 ** index) !== 0);
    if (!Array.from({ length: 3 }, (_, lane) => lane).every((lane) => {
      const outgoing = edges.filter(([from]) => from === lane).length;
      const incoming = edges.filter(([, to]) => to === lane).length;
      return outgoing >= 1 && outgoing <= 2 && incoming >= 1 && incoming <= 2;
    })) continue;
    if (edges.some(([a, b]) => edges.some(([c, d]) => a < c && b > d))) continue;
    covers.push(edges);
  }
  return covers;
})();

function weightedChoice<T>(values: T[], weight: (value: T) => number, random: () => number): T {
  let point = random() * values.reduce((sum, value) => sum + weight(value), 0);
  for (const value of values) {
    point -= weight(value);
    if (point < 0) return value;
  }
  return values[values.length - 1];
}

function createTopology(seed: string): FloorMap {
  const random = seededRandom(`${seed}:map:topology-v2`);
  const nodes: MapNode[] = Array.from({ length: 11 }, (_, row) =>
    Array.from({ length: 3 }, (_, lane): MapNode => ({
      id: `floor-${row + 1}-${lane}`, floor: row + 1, lane,
      type: row < 2 ? 'battle' : row === 10 ? 'rest' : 'battle', connections: [],
    }))).flat();
  nodes.push({ id: 'floor-12-1', floor: 12, lane: 1, type: 'boss', connections: [] });
  const shiftFloor = 2 + Math.floor(random() * 8);
  for (let floor = 1; floor < 11; floor += 1) {
    const candidates = floor === shiftFloor
      ? EDGE_COVERS.filter((cover) => !cover.some(([from, to]) => from === 1 && to === 1))
      : EDGE_COVERS;
    const cover = weightedChoice(candidates, (edges) => edges.length === 3 ? 1 : 2, random);
    for (const [from, to] of cover)
      nodes[(floor - 1) * 3 + from].connections.push(`floor-${floor + 1}-${to}`);
  }
  for (const node of nodes.filter((candidate) => candidate.floor === 11))
    node.connections.push('floor-12-1');
  return { floors: 12, nodes };
}

interface PathCounts { combats: number; shops: number; rests: number }
const ROOM_TYPES: NodeType[] = ['battle', 'event', 'shop', 'rest', 'treasure'];

function assignRooms(map: FloorMap, seed: string): boolean {
  const random = seededRandom(`${seed}:map:rooms-v2`);
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const parents = new Map(map.nodes.map((node) => [node.id, map.nodes.filter((other) => other.connections.includes(node.id))]));
  const safeLane = random() < 0.5 ? 0 : 2;
  const riskyLane = 2 - safeLane;
  const eliteFloors = [5 + Math.floor(random() * 2), 8 + Math.floor(random() * 2)];
  const extraEliteFloor = Math.floor(random() * 2);
  const fourElites = random() < 0.5;
  for (const [index, floor] of eliteFloors.entries()) {
    byId.get(`floor-${floor}-${riskyLane}`)!.type = 'elite';
    if (fourElites || index === extraEliteFloor) byId.get(`floor-${floor}-1`)!.type = 'elite';
  }
  const eliteCount = fourElites ? 4 : 3;
  const shopCount = random() < 0.5 ? 2 : 3;
  const restCount = random() < 0.5 ? 1 : 2;
  const treasureCount = random() < 0.5 ? 1 : 2;
  const eventCount = random() < 0.5 ? 5 : 6;
  const remaining: Record<NodeType, number> = {
    battle: 24 - eliteCount - shopCount - restCount - treasureCount - eventCount,
    event: eventCount, shop: shopCount, rest: restCount, treasure: treasureCount, elite: 0, boss: 0,
  };
  const pathCounts = new Map<string, PathCounts>();
  for (const node of map.nodes.filter((candidate) => candidate.floor <= 2))
    pathCounts.set(node.id, { combats: node.floor, shops: 0, rests: 0 });
  const rooms = map.nodes.filter((node) => node.floor >= 3 && node.floor <= 10);
  let remainingSearch = 50_000;
  function place(index: number): boolean {
    if (index === rooms.length) return true;
    if (--remainingSearch <= 0) return false;
    const node = rooms[index];
    const previous = parents.get(node.id)!;
    const forcedElite = node.type === 'elite';
    const candidates: NodeType[] = forcedElite ? ['elite'] : ROOM_TYPES.filter((type) => remaining[type] > 0);
    const ordered: NodeType[] = [];
    while (candidates.length) {
      const next = weightedChoice(candidates, (type) => {
        const floorWeight = type === 'battle' ? node.floor >= 9 ? 5 : 4
          : type === 'event' ? node.floor <= 4 ? 4 : 3
          : type === 'rest' ? node.floor >= 6 ? 2 : 1
          : type === 'shop' ? node.floor >= 4 && node.floor <= 8 ? 2 : 1
          : 1;
        return forcedElite ? 1 : remaining[type] * floorWeight;
      }, random);
      ordered.push(next);
      candidates.splice(candidates.indexOf(next), 1);
    }
    for (const type of ordered) {
      if (type !== 'battle' && previous.some((parent) => parent.type === type)) continue;
      if (type === 'rest' && node.floor === 10) continue;
      const counts: PathCounts = {
        combats: Math.min(...previous.map((parent) => pathCounts.get(parent.id)!.combats)) + (type === 'battle' || type === 'elite' ? 1 : 0),
        shops: Math.max(...previous.map((parent) => pathCounts.get(parent.id)!.shops)) + (type === 'shop' ? 1 : 0),
        rests: Math.max(...previous.map((parent) => pathCounts.get(parent.id)!.rests)) + (type === 'rest' ? 1 : 0),
      };
      if (counts.shops > 2 || counts.rests > 2 || counts.combats + (10 - node.floor) < 4) continue;
      node.type = type;
      pathCounts.set(node.id, counts);
      if (!forcedElite) remaining[type] -= 1;
      if (place(index + 1)) return true;
      if (!forcedElite) remaining[type] += 1;
    }
    if (!forcedElite) node.type = 'battle';
    pathCounts.delete(node.id);
    return false;
  }
  return place(0);
}

/** Independent seeded topology and weighted rooms; saved maps are never regenerated. */
export function generateMap(seed: string): FloorMap {
  // Each attempt is deterministic and bounded; room constraints do not touch run/combat RNG.
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const mapSeed = `${seed}:layout-${attempt}`;
    const map = createTopology(mapSeed);
    if (assignRooms(map, mapSeed)) return map;
  }
  throw new RangeError('接続と部屋の配置条件を満たすマップを生成できませんでした。');
}

/** Used by loading and tests; rejects broken routes rather than repairing a saved map. */
export function validateMap(map: FloorMap): boolean {
  if (map.floors !== 12 || map.nodes.length !== 34) return false;
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  if (byId.size !== map.nodes.length) return false;
  const allowed: NodeType[] = ['battle', 'elite', 'event', 'shop', 'rest', 'treasure', 'boss'];
  for (let floor = 1; floor <= 12; floor += 1) {
    const row = map.nodes.filter((node) => node.floor === floor);
    if (row.length !== (floor === 12 ? 1 : 3)) return false;
    if (new Set(row.map((node) => node.lane)).size !== row.length) return false;
  }
  const boss = map.nodes.find((node) => node.floor === 12);
  if (boss?.type !== 'boss') return false;
  for (const node of map.nodes) {
    if (
      !allowed.includes(node.type) ||
      !Number.isInteger(node.lane) ||
      node.lane < 0 ||
      node.lane > 2
    )
      return false;
    if (node.floor !== 12 && (node.type === 'boss' || node.connections.length === 0)) return false;
    if (node.floor === 12 && node.connections.length !== 0) return false;
    if (new Set(node.connections).size !== node.connections.length) return false;
    for (const id of node.connections) {
      const target = byId.get(id);
      if (!target || target.floor !== node.floor + 1 || Math.abs(target.lane - node.lane) > 1)
        return false;
    }
  }
  const reachable = new Set(map.nodes.filter((node) => node.floor === 1).map((node) => node.id));
  for (let floor = 1; floor < 12; floor += 1)
    for (const node of map.nodes.filter((candidate) => candidate.floor === floor))
      if (reachable.has(node.id)) node.connections.forEach((id) => reachable.add(id));
  return reachable.size === map.nodes.length;
}
