import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createRun, getAvailableNodes } from '../engine/run';
import { MapScreen, mapDescendants, projectMap } from '../screens/MapScreen';

describe('saved map graph presentation', () => {
  it.each(['map-ui-a', 'map-ui-b', 'map-ui-c'])('renders each saved node and connection exactly once (%s)', (seed) => {
    const state = createRun(seed, 'berserker');
    const saved = JSON.stringify(state);
    const markup = renderToStaticMarkup(createElement(MapScreen, { state, onAction: () => {} }));
    expect(markup.match(/data-node-id=/g)).toHaveLength(state.map.nodes.length);
    expect(markup.match(/data-map-from=/g)).toHaveLength(state.map.nodes.reduce((sum, node) => sum + node.connections.length, 0));
    expect(markup.match(/data-map-state="available"/g)).toHaveLength(getAvailableNodes(state).length);
    for (const node of state.map.nodes) {
      expect(markup).toContain(`data-node-id="${node.id}"`);
      for (const target of node.connections) expect(markup).toContain(`data-map-from="${node.id}" data-map-to="${target}"`);
    }
    expect(JSON.stringify(state)).toBe(saved);
  });

  it('distinguishes current, visited, available and locked nodes on an existing saved path', () => {
    const state = createRun('map-ui-progress', 'assassin');
    const first = getAvailableNodes(state)[0];
    const second = state.map.nodes.find((node) => node.id === first.connections[0])!;
    state.visited = [first.id, second.id]; state.currentNodeId = second.id; state.floor = 2;
    const markup = renderToStaticMarkup(createElement(MapScreen, { state, onAction: () => {} }));
    expect(markup.match(/data-map-state="current"/g)).toHaveLength(1);
    expect(markup.match(/data-map-state="visited"/g)).toHaveLength(1);
    expect(markup.match(/data-map-state="available"/g)).toHaveLength(getAvailableNodes(state).length);
    expect(markup).toContain('data-map-state="locked"');
    expect(markup).toContain('aria-current="step"');
  });

  it('projects every node inside the canvas at each zoom with consistent ordering', () => {
    const { map } = createRun('map-ui-layout');
    for (const scale of [.85, 1, 1.2]) {
      const layout = projectMap(map, scale);
      for (const node of map.nodes) {
        const point = layout.point(node);
        expect(point.x).toBeGreaterThan(44);
        expect(point.x).toBeLessThan(layout.width - 44);
        expect(point.y).toBeGreaterThan(44);
        expect(point.y).toBeLessThan(layout.height - 44);
        for (const id of node.connections) expect(layout.point(map.nodes.find((next) => next.id === id)!).y).toBeLessThan(point.y);
      }
    }
  });

  it('highlights only actual descendants through splits and merges, without changing saved connections', () => {
    const { map } = createRun('map-ui-descendants');
    const source = map.nodes.find((node) => node.connections.length > 1)!;
    const before = JSON.stringify(map);
    const descendants = mapDescendants(map, source.id);
    expect(descendants.has(source.id)).toBe(true);
    for (const id of source.connections) expect(descendants.has(id)).toBe(true);
    expect([...descendants].every((id) => map.nodes.find((node) => node.id === id)!.floor >= source.floor)).toBe(true);
    expect([...descendants].some((id) => map.nodes.find((node) => node.id === id)!.type === 'boss')).toBe(true);
    expect(mapDescendants(map, 'unknown')).toEqual(new Set());
    expect(JSON.stringify(map)).toBe(before);
  });
});
