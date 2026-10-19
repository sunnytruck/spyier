import type { FloorMap, MapNode, NodeType } from '../../types/run';
import { nextRandom, seedToState, shuffle } from '../random';

/** Three continuous lanes, with seeded optional crossings, keep every room reachable. */
export function generateMap(seed: string): FloorMap {
  let rngState = seedToState(`${seed}:map`);
  const rows: NodeType[][] = [
    ['battle', 'battle', 'battle'],
    ['battle', 'battle', 'battle'],
    ['event', 'battle', 'event'],
    ['shop', 'battle', 'rest'],
    ['elite', 'battle', 'event'],
    ['treasure', 'rest', 'treasure'],
    ['rest', 'event', 'shop'],
    ['elite', 'battle', 'event'],
    ['battle', 'shop', 'treasure'],
    ['battle', 'battle', 'battle'],
    ['rest', 'rest', 'rest'],
    ['boss'],
  ];
  const nodes: MapNode[] = [];
  for (let row = 0; row < rows.length; row += 1) {
    const mixed = shuffle(rows[row], rngState);
    rngState = mixed.rngState;
    mixed.values.forEach((type, lane) => {
      nodes.push({
        id: `floor-${row + 1}-${type === 'boss' ? 1 : lane}`,
        floor: row + 1,
        lane: type === 'boss' ? 1 : lane,
        type,
        connections: [],
      });
    });
  }
  for (const node of nodes) {
    if (node.floor === 12) continue;
    const nextRow = nodes.filter((candidate) => candidate.floor === node.floor + 1);
    // A lane always continues, so no optional crossing can strand a room.
    const straight = nextRow.find((candidate) => candidate.lane === node.lane) ?? nextRow[0];
    node.connections.push(straight.id);
    for (const candidate of nextRow) {
      if (candidate.id === straight.id || Math.abs(candidate.lane - node.lane) > 1) continue;
      const random = nextRandom(rngState);
      rngState = random.state;
      if (random.value < 0.66) node.connections.push(candidate.id);
    }
  }
  return { floors: 12, nodes };
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
