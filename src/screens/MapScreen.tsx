import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FloorMap, MapNode, NodeType, RunAction, RunState } from '../types/run';
import { getAvailableNodes } from '../engine/run';
import { getActDefinition } from '../data/acts';
import { Icon } from '../components/Icon';
import { MapNodeIcon } from '../components/MapNodeIcon';
import { WorldScene } from '../components/world/WorldScene';
import '../styles/map-expansion.css';

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
  const nextFloor = available[0]?.floor ?? Math.min(state.floor + 1, state.map.floors);
  const focusId = hoveredId ?? state.currentNodeId;
  const route = useMemo(() => focusId ? mapDescendants(state.map, focusId) : new Set(state.map.nodes.map((node) => node.id)), [state.map, focusId]);
  const reachableIds = useMemo(() => state.currentNodeId ? mapDescendants(state.map, state.currentNodeId) : new Set(state.map.nodes.map((node) => node.id)), [state.map, state.currentNodeId]);
  const inspected = byId.get(hoveredId ?? inspectedId ?? '');
  const activeTarget = state.map.nodes.find((node) => node.floor === nextFloor);
  const centerMap = useCallback(() => {
    if (!scroller.current || !activeTarget) return;
    // Reserve room below the next row for the current node and its two labels.
    scroller.current.scrollTop = Math.max(0, layout.point(activeTarget).y - scroller.current.clientHeight * .58);
  }, [activeTarget, layout]);
  useEffect(centerMap, [centerMap]);
  const chooseNode = (nodeId: string) => {
    if (availableIds.has(nodeId)) onAction({ type: 'chooseNode', nodeId });
  };

  return <div className="run-map-screen atlas-map">
    <WorldScene variant="map" act={state.act ?? 1} />
    <header className="run-screen-heading">
      <div><p className="eyebrow"><span className="gold-line" />{state.act ? `ACT ${act.id} · ${act.subtitle}` : 'ACT I · 岩の目覚め'}</p><h1>{state.act ? act.name : 'じっと教の塔'}</h1></div>
      <span className="run-seed"><Icon name="mountain" size={14} /> SEED <b>{state.seed}</b></span>
    </header>
    <div className="run-map-layout">
      <aside className="run-map-sidebar">
        <div className="run-map-chapter"><span>{state.act ? `第${act.id}層 / 全${state.maxActs}層` : '第一層'}</span><h2>{state.act ? act.name : '不動の回廊'}</h2><details className="atlas-chapter-description"><summary>この階層のこと</summary><p>{state.act ? act.description : '上へ、上へ。道を選ぶたび、教えは変わる。'}</p></details><div className="run-floor-progress"><span style={{ width: `${Math.min(100, state.visited.length / state.map.floors * 100)}%` }} /></div><small>{state.visited.length} / {state.map.floors} フロア踏破</small></div>
        <div className="run-map-next"><p className="section-kicker">NEXT DESTINATION</p><h3>次の目的地</h3><p>第 {nextFloor} フロア · {available.length}つの道</p><div>
          {available.map((node) => <button key={node.id} data-next-node-id={node.id} className="run-next-choice" onMouseEnter={() => setHoveredId(node.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(node.id)} onBlur={() => setHoveredId(null)} onClick={() => chooseNode(node.id)}>
            <MapNodeIcon type={node.type} size={20} /><span>{nodeLabels[node.type].name}<small>{laneName(node, state.map)} · {node.connections.length > 1 ? `${node.connections.length}方向へ分岐` : node.connections.length ? '次の道へ続く' : '最後の試練'}</small></span><Icon name="chevron" size={14} />
          </button>)}
        </div></div>
        <details className="atlas-map-legend"><summary><Icon name="help" size={17} />地図を読む</summary><div className="run-map-legend" aria-label="地点の種類">{(Object.keys(nodeLabels) as NodeType[]).map((type) => <div key={type} title={nodeLabels[type].description}><MapNodeIcon type={type} size={19} /><span>{nodeLabels[type].name}</span></div>)}</div><p className="run-map-blessing-note"><MapNodeIcon type="blessing" size={21} /><span>Actのはじまりには、岩の祝福が道を照らします。</span></p><p className="run-map-note">光る地点だけに進めます。明るい線は次の道、金の実線は歩いた道です。</p></details>
      </aside>
      <div className="run-map-panel">
        <div className="run-map-toolbar"><span><b>分岐マップ</b><small>上が頂 · 全{state.map.floors}フロア</small></span><div className="run-map-zoom" role="group" aria-label="マップの表示倍率">{ZOOMS.map((option) => <button key={option.value} type="button" onClick={() => setZoom(option.value)} aria-pressed={zoom === option.value}>{option.name}</button>)}</div><button type="button" className="run-map-center" onClick={centerMap}><span aria-hidden="true">⌾</span> 現在地へ</button></div>
        <div className="run-map-inspection" role="status" aria-live="polite">{inspected ? <><MapNodeIcon type={inspected.type} size={22} /><span><b>第{inspected.floor}フロア · {nodeLabels[inspected.type].name}</b><small>{nodeLabels[inspected.type].description} {availableIds.has(inspected.id) ? 'ここへ進めます。' : inspected.id === state.currentNodeId ? '現在地です。' : visitedIds.has(inspected.id) ? '踏破済みです。' : reachableIds.has(inspected.id) ? '接続する道を進むと到達できます。' : 'このルートからは移動できません。'}</small></span></> : <><MapNodeIcon type="blessing" size={22} /><span><b>岩に刻まれた道を選ぶ</b><small>地点に重ねるかタップすると、種類と状態を確認できます。</small></span></>}</div>
        <div className="run-map-scroll" ref={scroller} tabIndex={0} role="region" aria-label={`${state.map.floors}フロアの分岐マップ。上下にスクロールしてすべての経路を確認できます。`}>
          <div className="run-map-graph" style={{ height: layout.height }}>
            <svg className="run-map-lines" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" aria-hidden="true">
              <defs><pattern id={patternId} width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#d5b575" opacity=".08" /></pattern></defs><rect width={layout.width} height={layout.height} fill={`url(#${patternId})`} />
              {state.map.nodes.flatMap((node) => node.connections.map((id) => {
                const target = byId.get(id); if (!target) return null;
                const from = layout.point(node); const to = layout.point(target);
                const traversed = visitedIds.has(node.id) && visitedIds.has(id);
                const upcoming = node.id === state.currentNodeId && availableIds.has(id);
                const highlighted = !!hoveredId && route.has(node.id) && route.has(id);
                const skipped = !!state.currentNodeId && !route.has(node.id) && !traversed;
                return <path key={`${node.id}-${id}`} data-map-from={node.id} data-map-to={id} d={`M${from.x} ${from.y} C${from.x} ${from.y - 36} ${to.x} ${to.y + 36} ${to.x} ${to.y}`} className={`run-map-connection${traversed ? ' is-traversed' : ''}${upcoming ? ' is-upcoming' : ''}${highlighted ? ' is-highlighted' : ''}${skipped ? ' is-skipped' : ''}`} />;
              }))}
              {Array.from({ length: state.map.floors }, (_, index) => { const floor = index + 1; const y = layout.point({ floor, lane: 0 }).y; return <g key={floor}><text x="22" y={y + 4} className="run-map-floor-number">{String(floor).padStart(2, '0')}F</text><path d={`M58 ${y}h18M564 ${y}h18`} stroke="#a18b564a" /></g>; })}
            </svg>
            {state.map.nodes.map((node) => {
              const point = layout.point(node); const selectable = availableIds.has(node.id); const visited = visitedIds.has(node.id); const current = state.currentNodeId === node.id;
              const reachable = reachableIds.has(node.id);
              const status = current ? '現在地' : selectable ? '選択可能' : visited ? '踏破済み' : reachable ? '未到達' : '移動不可能';
              return <div key={node.id} className={`run-map-node-wrap${selectable ? ' is-available' : ''}${visited ? ' is-visited' : ''}${current ? ' is-current' : ''}${node.type === 'boss' ? ' is-boss' : ''}${!selectable && !visited && !current ? reachable ? ' is-unreached' : ' is-locked' : ''}${hoveredId && route.has(node.id) ? ' is-route-highlighted' : ''}`} data-map-state={current ? 'current' : selectable ? 'available' : visited ? 'visited' : reachable ? 'unreached' : 'locked'} data-node-status={current ? 'current' : selectable ? 'available' : visited ? 'visited' : reachable ? 'unreached' : 'blocked'} data-node-type={node.type} style={{ left: `${point.x / layout.width * 100}%`, top: point.y }} onMouseEnter={() => setHoveredId(node.id)} onMouseLeave={() => setHoveredId(null)} onPointerDownCapture={() => setInspectedId(node.id)}>
                <button type="button" data-node-id={node.id} className="run-map-node" disabled={!selectable} onClick={() => chooseNode(node.id)} onFocus={() => setHoveredId(node.id)} onBlur={() => setHoveredId(null)} aria-current={current ? 'step' : undefined} aria-label={`第${node.floor}フロア ${laneName(node, state.map)} ${nodeLabels[node.type].name}。${status}${node.connections.length > 1 ? `。この先は${node.connections.length}方向に分岐` : ''}`} title={`${nodeLabels[node.type].description} ${status}`}>
                  <MapNodeIcon type={node.type} size={node.type === 'boss' ? 28 : 23} />{visited && <span className="run-node-check">✓</span>}{!selectable && !visited && !current && !reachable && <span className="run-node-locked" aria-hidden="true"><LockIcon /></span>}{node.connections.length > 1 && <span className="run-node-fork" aria-hidden="true">↟{node.connections.length}</span>}
                </button>
                <span className="run-node-label">{nodeLabels[node.type].name}{(selectable || current) && <small>{current ? '⌾ 現在地' : '● 選択可能'}</small>}</span>
              </div>;
            })}
            <span className="run-map-start">旅のはじまり</span>
          </div>
        </div>
        <div className="run-map-panel-foot" aria-label="地点の状態"><span><i /> 選択可能</span><span>⌾ 現在地</span><span>✓ 踏破済み</span><span><i className="state-unreached" /> 未到達</span><span><LockIcon /> 移動不可能</span></div>
      </div>
      <details className="run-map-mobile-legend"><summary>地点の種類とマップの読み方</summary><div>{(Object.keys(nodeLabels) as NodeType[]).map((type) => <p key={type}><MapNodeIcon type={type} size={18} /><span><b>{nodeLabels[type].name}</b><small>{nodeLabels[type].description}</small></span></p>)}</div><p>接続された地点だけに進めます。選択しなかった道へは戻れません。</p></details>
    </div>
  </div>;
}

