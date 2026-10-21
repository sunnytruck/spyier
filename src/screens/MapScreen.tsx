import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { FloorMap, MapNode, NodeType, RunAction, RunState } from '../types/run';
import { getAvailableNodes } from '../engine/run';
import { getActDefinition } from '../data/acts';
import { MapNodeIcon } from '../components/MapNodeIcon';
import { WorldScene } from '../components/world/WorldScene';
import '../styles/map-expansion.css';
import '../styles/map-sanctuary.css';

const nodeLabels: Record<NodeType, { name: string; description: string }> = {
  battle: { name: '通常戦闘', description: '敵を倒して、カードとゴールドを獲得。' },
  elite: { name: 'エリート', description: '手強い敵。その先には貴重なレリックが。' },
  event: { name: '出来事', description: '奇妙な出会い。選択が旅を変える。' },
  shop: { name: '商人', description: 'カード・レリックの購入とデッキの整理。' },
  rest: { name: '休憩所', description: 'HPを回復するか、カードを1枚強化。' },
  treasure: { name: '宝箱', description: '古代の祝福、レリックを1つ獲得。' },
  boss: { name: '階層ボス', description: 'このActの最後の試練。準備を整えて挑みましょう。' },
};

const GRAPH_WIDTH = 640;
const ZOOMS = [{ name: '縮小', value: .85 }, { name: '標準', value: 1 }, { name: '拡大', value: 1.2 }];

function LockIcon() {
  return <svg width="11" height="12" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="8" width="12" height="9" rx="2" /><path d="M4 8V5a4 4 0 0 1 8 0v3M8 11v3" /></svg>;
}

/** Project the saved graph as-is. Layout never generates or repairs game routes. */
export function projectMap(map: FloorMap, scale = 1) {
  const height = 1220 * scale;
  const maxLane = Math.max(2, ...map.nodes.map((node) => node.lane));
  const point = (node: Pick<MapNode, 'lane' | 'floor'>) => ({
    x: 100 + (node.lane / maxLane) * (GRAPH_WIDTH - 200),
    y: 70 + (map.floors - node.floor) * ((height - 140) / Math.max(1, map.floors - 1)),
  });
  return { width: GRAPH_WIDTH, height, point };
}

/** Used only to illuminate possible continuations; it does not select a node. */
export function mapDescendants(map: FloorMap, nodeId: string): Set<string> {
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const result = new Set<string>();
  const queue = [nodeId];
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    if (result.has(id) || !byId.has(id)) continue;
    result.add(id);
    queue.push(...byId.get(id)!.connections);
  }
  return result;
}

function laneName(node: MapNode, map: FloorMap) {
  const row = map.nodes.filter((candidate) => candidate.floor === node.floor).sort((left, right) => left.lane - right.lane);
  if (row.length === 1) return '頂の道';
  const index = row.findIndex((candidate) => candidate.id === node.id);
  return row.length === 3 ? ['左の道', '中央の道', '右の道'][index] : `${index + 1}番目の道`;
}

export function MapScreen({ state, onAction }: { state: RunState; onAction: (action: RunAction) => void }) {
  const act = getActDefinition(state.act ?? 1);
  const scroller = useRef<HTMLDivElement>(null);
  const patternId = `map-dots-${useId().replace(/:/g, '')}`;
  const [zoom, setZoom] = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const available = getAvailableNodes(state);
  const availableIds = new Set(available.map((node) => node.id));
  const visitedIds = new Set(state.visited);
  const byId = new Map(state.map.nodes.map((node) => [node.id, node]));
  const layout = useMemo(() => projectMap(state.map, zoom), [state.map, zoom]);
  const focusId = hoveredId ?? inspectedId ?? state.currentNodeId;
  const route = useMemo(() => focusId ? mapDescendants(state.map, focusId) : new Set(state.map.nodes.map((node) => node.id)), [state.map, focusId]);
  const reachableIds = useMemo(() => state.currentNodeId ? mapDescendants(state.map, state.currentNodeId) : new Set(state.map.nodes.map((node) => node.id)), [state.map, state.currentNodeId]);
  const inspected = byId.get(hoveredId ?? inspectedId ?? '');
  const activeTarget = byId.get(state.currentNodeId ?? '') ?? available[0];
  const centerMap = useCallback(() => {
    if (!scroller.current || !activeTarget) return;
    const point = layout.point(activeTarget);
    const graph = scroller.current.firstElementChild as HTMLElement | null;
    // Center the saved position with the next connected row visible above it.
    scroller.current.scrollTop = Math.max(0, point.y - scroller.current.clientHeight * .66);
    scroller.current.scrollLeft = Math.max(0, point.x / layout.width * (graph?.clientWidth ?? layout.width) - scroller.current.clientWidth / 2);
  }, [activeTarget, layout]);
  useEffect(() => {
    centerMap();
    const observer = new ResizeObserver(centerMap);
    if (scroller.current) observer.observe(scroller.current);
    return () => observer.disconnect();
  }, [centerMap]);
  const chooseNode = (nodeId: string) => {
    if (availableIds.has(nodeId)) onAction({ type: 'chooseNode', nodeId });
  };

  return <div className="run-map-screen atlas-map route-atlas" style={{ '--map-zoom': zoom } as CSSProperties}>
    <WorldScene variant="map" act={state.act ?? 1} />
    <header className="run-screen-heading route-atlas-heading">
      <div><p className="eyebrow">ACT {act.id} · 全{state.map.floors}フロア</p><h1 title={`シード：${state.seed}`}>{state.act ? act.name : 'じっと教の塔'}</h1></div>
      <div className="route-atlas-controls">
        <div className="run-map-zoom" role="group" aria-label="マップの表示倍率">{ZOOMS.map((option) => <button key={option.value} type="button" onClick={() => setZoom(option.value)} aria-pressed={zoom === option.value}>{option.name}</button>)}</div>
        <button type="button" className="run-map-center" onClick={centerMap}><span aria-hidden="true">⌾</span> 現在地へ</button>
      </div>
    </header>
    <div className="run-map-layout">
      <div className="run-map-panel">
        {inspected && <div className="run-map-inspection" role="status" aria-live="polite">
          <MapNodeIcon type={inspected.type} size={28} /><span><b>第{inspected.floor}フロア · {nodeLabels[inspected.type].name}</b><small>{nodeLabels[inspected.type].description}</small><em>{availableIds.has(inspected.id) ? 'ここへ進めます' : inspected.id === state.currentNodeId ? '現在地' : visitedIds.has(inspected.id) ? '踏破済み' : reachableIds.has(inspected.id) ? '接続する道の先にあります' : 'このルートからは移動できません'}</em></span>
          <button type="button" onClick={() => { setHoveredId(null); setInspectedId(null); }} aria-label="地点の詳細を閉じる">×</button>
        </div>}
        <div className="run-map-scroll" ref={scroller} tabIndex={0} role="region" aria-label={`${state.map.floors}フロアの分岐マップ。上下にスクロールしてすべての経路を確認できます。`}>
          <div className="run-map-graph" style={{ height: layout.height, width: `${zoom * 100}%` }}>
            <svg className="run-map-lines" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" aria-hidden="true">
              <defs><pattern id={patternId} width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#d5b575" opacity=".08" /></pattern></defs><rect width={layout.width} height={layout.height} fill={`url(#${patternId})`} />
              {state.map.nodes.flatMap((node) => node.connections.map((id) => {
                const target = byId.get(id); if (!target) return null;
                const from = layout.point(node); const to = layout.point(target);
                const traversed = visitedIds.has(node.id) && visitedIds.has(id);
                const upcoming = node.id === state.currentNodeId && availableIds.has(id);
                const highlighted = !!(hoveredId ?? inspectedId) && route.has(node.id) && route.has(id);
                const skipped = !!state.currentNodeId && !route.has(node.id) && !traversed;
                return <path key={`${node.id}-${id}`} data-map-from={node.id} data-map-to={id} d={`M${from.x} ${from.y} C${from.x} ${from.y - 36} ${to.x} ${to.y + 36} ${to.x} ${to.y}`} className={`run-map-connection${traversed ? ' is-traversed' : ''}${upcoming ? ' is-upcoming' : ''}${highlighted ? ' is-highlighted' : ''}${skipped ? ' is-skipped' : ''}`} />;
              }))}
              {Array.from({ length: state.map.floors }, (_, index) => { const floor = index + 1; const y = layout.point({ floor, lane: 0 }).y; return <path key={floor} d={`M58 ${y}h18M564 ${y}h18`} stroke="#a18b564a" />; })}
            </svg>
            {Array.from({ length: state.map.floors }, (_, index) => <span className="run-map-floor-number" key={index} style={{ top: layout.point({ floor: index + 1, lane: 0 }).y }} aria-hidden="true">{String(index + 1).padStart(2, '0')}F</span>)}
            {state.map.nodes.map((node) => {
              const point = layout.point(node); const selectable = availableIds.has(node.id); const visited = visitedIds.has(node.id); const current = state.currentNodeId === node.id;
              const reachable = reachableIds.has(node.id);
              const status = current ? '現在地' : selectable ? '選択可能' : visited ? '踏破済み' : reachable ? '未到達' : '移動不可能';
              return <div key={node.id} className={`run-map-node-wrap${selectable ? ' is-available' : ''}${visited ? ' is-visited' : ''}${current ? ' is-current' : ''}${node.type === 'boss' ? ' is-boss' : ''}${!selectable && !visited && !current ? reachable ? ' is-unreached' : ' is-locked' : ''}${focusId && route.has(node.id) ? ' is-route-highlighted' : ''}`} data-map-state={current ? 'current' : selectable ? 'available' : visited ? 'visited' : reachable ? 'unreached' : 'locked'} data-node-status={current ? 'current' : selectable ? 'available' : visited ? 'visited' : reachable ? 'unreached' : 'blocked'} data-node-type={node.type} style={{ left: `${point.x / layout.width * 100}%`, top: point.y }} onMouseEnter={() => setHoveredId(node.id)} onMouseLeave={() => setHoveredId(null)} onPointerDownCapture={() => setInspectedId(node.id)}>
                <button type="button" data-node-id={node.id} className="run-map-node" aria-disabled={!selectable} onClick={() => { setInspectedId(node.id); chooseNode(node.id); }} onFocus={() => setHoveredId(node.id)} onBlur={() => setHoveredId(null)} aria-current={current ? 'step' : undefined} aria-label={`第${node.floor}フロア ${laneName(node, state.map)} ${nodeLabels[node.type].name}。${status}${node.connections.length > 1 ? `。この先は${node.connections.length}方向に分岐` : ''}`} title={`${nodeLabels[node.type].description} ${status}`}>
                  <MapNodeIcon type={node.type} size={node.type === 'boss' ? 36 : 29} />{visited && <span className="run-node-check">✓</span>}{!selectable && !visited && !current && !reachable && <span className="run-node-locked" aria-hidden="true"><LockIcon /></span>}{node.connections.length > 1 && <span className="run-node-fork" aria-hidden="true">↟{node.connections.length}</span>}
                </button>
                <span className="run-node-label">{nodeLabels[node.type].name}{(selectable || current) && <small>{current ? '⌾ 現在地' : '● 選択可能'}</small>}</span>
              </div>;
            })}
            <span className="run-map-start">旅のはじまり</span>
          </div>
        </div>
        <div className="run-map-panel-foot" aria-label="地点の状態"><span><i /> 選択可能</span><span>⌾ 現在地</span><span>✓ 踏破済み</span><span><i className="state-unreached" /> 未到達</span><span><LockIcon /> 移動不可能</span></div>
      </div>

    </div>
  </div>;
}

