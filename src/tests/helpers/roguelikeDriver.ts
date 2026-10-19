import { getAvailableNodes } from '../../engine/run';
import { nextRandom, seedToState } from '../../engine/random';
import type { MapNode, NodeType, RunAction, RunState } from '../../types/run';
import { chooseClassRunAction } from './classDriver';

export type RoutePolicy = 'safe' | 'elite' | 'varied';

/**
 * A reproducible test player, not an estimate of human skill. Combat uses the
 * existing one-action lookahead. This policy changes only legal route choices.
 * Its separate RNG never advances the saved game's RNG.
 */
export function createRoguelikeDriver(policy: RoutePolicy, seed: string): (state: RunState) => RunAction {
  let policyRng = seedToState(`${seed}:qa-route:${policy}`);
  return (state) => {
    if (state.screen !== 'map') return chooseClassRunAction(state, { deckAware: true });
    const available = getAvailableNodes(state);
    if (available.length === 0) throw new Error(`No continuation at floor ${state.floor}`);
    if (policy === 'varied') {
      const roll = nextRandom(policyRng);
      policyRng = roll.state;
      return { type: 'chooseNode', nodeId: available[Math.floor(roll.value * available.length)].id };
    }
    const weights: Record<NodeType, number> = policy === 'elite' ? {
      battle: 20, elite: 110, event: 10, shop: 20, rest: 25, treasure: 60, boss: 0,
    } : {
      battle: 10, elite: -90, event: 45, shop: state.gold >= 120 ? 60 : 5,
      rest: state.hp / state.maxHp < 0.65 ? 80 : 35, treasure: 75, boss: 0,
    };
    const byId = new Map(state.map.nodes.map((node) => [node.id, node]));
    const scores = new Map<string, number>();
    const score = (node: MapNode): number => {
      const cached = scores.get(node.id);
      if (cached !== undefined) return cached;
      const children = node.connections.map((id) => byId.get(id)).filter((child) => child !== undefined);
      const value = weights[node.type] + (children.length ? Math.max(...children.map(score)) : 0);
      scores.set(node.id, value);
      return value;
    };
    const ranked = [...available].sort((left, right) => score(right) - score(left) || left.lane - right.lane);
    return { type: 'chooseNode', nodeId: ranked[0].id };
  };
}
