import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MapNode, NodeType, RunAction, RunState } from '../types/run';
import type { CardInstance } from '../types/game';
import { CARD_DEFINITIONS } from '../data/cards';
import { RELIC_DEFINITIONS } from '../data/relics';
import { POTION_DEFINITIONS } from '../data/potions';
import { EVENT_DEFINITIONS } from '../data/events';
import { canChooseEvent, getAvailableNodes, SHOP_PRICES } from '../engine/run';
import { CardView } from '../components/CardView';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { RockDeity } from '../components/CharacterArt';
import '../styles/run.css';

interface RunScreensProps {
  state: RunState;
  onAction: (action: RunAction) => void;
  onNewRun: () => void;
  onReplay: () => void;
  onTitle: () => void;
}

const nodeLabels: Record<NodeType, { name: string; description: string }> = {
  battle: { name: '通常戦闘', description: '敵を倒して、カードとゴールドを獲得。' },
  elite: { name: 'エリート', description: '手強い敵。その先には貴重なレリックが。' },
  event: { name: '出来事', description: '奇妙な出会い。選択が旅を変える。' },
  shop: { name: '商人', description: 'カード・レリックの購入とデッキの整理。' },
  rest: { name: '休憩所', description: 'HPを回復するか、カードを1枚強化。' },
  treasure: { name: '宝箱', description: '古代の祝福、レリックを1つ獲得。' },
  boss: { name: '階層ボス', description: '第一層の最後の試練。準備はよろしいですか。' },
};

function NodeIcon({ type, size = 24 }: { type: NodeType; size?: number }) {
  if (type === 'battle') return <Icon name="sword" size={size} />;
  if (type === 'rest') return <Icon name="flame" size={size} />;
  if (type === 'event') return <Icon name="help" size={size} />;
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === 'shop' && (
        <>
          <path d="M3 10h18L18 4H6Zm1 0v11h16V10M9 21v-7h6v7" />
          <path d="M3 10c0 4 4 4 5 0 0 4 7 4 8 0 0 4 5 4 5 0M9 4l-1 6m7-6 1 6" />
        </>
      )}
      {type === 'treasure' && (
        <>
          <path d="M3 11V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4M3 11h18v9H3Z" />
          <path d="M10 10h4v5h-4ZM7 4v7m10-7v7" />
        </>
      )}
      {type === 'elite' && (
        <>
          <path d="m4 5 4 4 4-6 4 6 4-4-2 10H6ZM7 19h10M9 15l-1 4m7-4 1 4" />
          <path d="m10 10 2 3 2-3" />
        </>
      )}
      {type === 'boss' && (
        <>
          <path d="m3 20 3-9 3 2 3-9 3 9 3-2 3 9ZM6 20h12M10 17h4M12 1v1" />
          <path d="m3 3 2 2m16-2-2 2" />
        </>
      )}
    </svg>
  );
}

function Gold({ amount }: { amount: number }) {
  return (
    <span className="run-gold">
      <span aria-hidden="true">◎</span> {amount}
      <small>G</small>
    </span>
  );
}

function ScreenHeading({
  kicker,
  title,
  text,
  children,
}: {
  kicker: string;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <header className="run-screen-heading">
      <div>
        <p className="eyebrow">
          <span className="gold-line" />
          {kicker}
        </p>
        <h1>{title}</h1>
        {text && <p className="run-heading-description">{text}</p>}
      </div>
      {children}
    </header>
  );
}

function RelicBadge({ id, small = false }: { id: string; small?: boolean }) {
  const definition = RELIC_DEFINITIONS[id];
  if (!definition) return null;
  return (
    <span
      className={`run-relic-badge${small ? ' is-small' : ''}`}
      title={`${definition.name}：${definition.description}`}
      tabIndex={0}
    >
      <span aria-hidden="true">{definition.glyph}</span>
      {!small && <b>{definition.name}</b>}
      <span className="run-item-tooltip">
        <b>{definition.name}</b>
        {definition.description}
      </span>
    </span>
  );
}

function RunStatus({ state, onDeck }: { state: RunState; onDeck: () => void }) {
  return (
    <div className="run-status-strip">
      <div className="run-status-hero">
        <span className="run-status-seal">岩</span>
        <div>
          <small>じっと教 教祖</small>
          <b>岩尊けいと</b>
        </div>
      </div>
      <div className="run-hp-stat">
        <Icon name="heart" size={15} />
        <b>
          {state.hp}
          <small> / {state.maxHp}</small>
        </b>
        <span className="run-mini-hp">
          <i style={{ width: `${(state.hp / state.maxHp) * 100}%` }} />
        </span>
      </div>
      <Gold amount={state.gold} />
      <button className="run-deck-stat" onClick={onDeck} title="現在のデッキを見る">
        <Icon name="cards" size={17} />
        <span>
          デッキ <b>{state.deck.length}</b>
        </span>
      </button>
      <div className="run-status-relics" aria-label="所持レリック">
        {state.relicIds.map((id) => (
          <RelicBadge key={id} id={id} small />
        ))}
      </div>
      <span className="run-status-floor">
        第1層 <b>{Math.min(state.floor, state.map.floors)}</b>
        <small> / {state.map.floors}</small>
      </span>
    </div>
  );
}

function SceneArt({ kind }: { kind: 'rest' | 'shop' | 'event' | 'relic' }) {
  return (
    <div className={`run-scene-art run-scene-art--${kind}`} aria-hidden="true">
      <div className="run-scene-orbit" />
      <svg viewBox="0 0 380 250" fill="none">
        <ellipse cx="190" cy="223" rx="142" ry="13" fill="#090d08" opacity=".6" />
        <path d="M35 226h310M49 233h282" stroke="#b7985b" opacity=".25" />
        {kind === 'rest' ? (
          <>
            <path d="m105 210 58-24 92 24-14 15-79-13-43 10Z" fill="#6b6146" stroke="#9d8557" />
            <path d="m122 224 37-37 92 18-3 13-81-14-30 28Z" fill="#4c533f" stroke="#8e825a" />
            <path
              d="M188 77c21 56-48 54-21 99-3-28 27-30 28-58 48 38 59 72 21 89-46 19-85-11-68-44 10-20 9-46 40-86Z"
              fill="#bc873b"
              opacity=".75"
            />
            <path
              d="M191 140c14 21-18 29-9 47 4-8 12-9 15-19 17 24 12 40-7 42-26-4-32-27-15-44Z"
              fill="#efc77a"
            />
            <path
              d="M163 82v-8m53 20 3-8m-19-28v-7M139 134l-3-7m94 32 3-8"
              stroke="#d8ad61"
              strokeWidth="2"
            />
            <path
              d="m70 202 14-17 23 10-4 23H79ZM271 207l15-14 20 12-5 16h-31Z"
              fill="#4b5b42"
              stroke="#788263"
            />
          </>
        ) : kind === 'shop' ? (
          <>
            <path d="M81 105h220l-27-65H109Z" fill="#605b3e" stroke="#b59b62" />
            <path
              d="M109 40h165M109 40l-10 65m47-65-4 65m41-65 2 65m34-65 8 65m20-65 18 65"
              stroke="#b5995c"
              strokeWidth="3"
              opacity=".5"
            />
            <path d="M91 112v111m200-111v111M80 224h222" stroke="#8c8058" strokeWidth="7" />
            <path
              d="M81 105c0 24 35 25 43 0 0 24 39 25 45 0 0 24 39 25 45 0 0 24 39 25 44 0 0 24 43 25 43 0"
              fill="#827047"
              stroke="#b59b62"
            />
            <path d="m158 160 8-26 28-10 29 16 8 29-13 22h-49Z" fill="#768068" stroke="#a4a481" />
            <path d="m170 151 12 2m19 0 11-2" stroke="#e3bf75" strokeWidth="3" />
            <path d="M139 215v-26l28-14h53l25 15v25" fill="#4b6048" stroke="#8b9471" />
            <path d="M110 192h162v30H110Z" fill="#5e5a3f" stroke="#a08a57" />
            <path d="M121 196h140M121 215h140" stroke="#948052" />
            <path d="m123 181 3-19h17l4 19ZM239 182l3-15h15l4 15Z" fill="#ab9458" />
            <path d="M131 165v-7m119 13v-9" stroke="#d4b777" />
          </>
        ) : kind === 'relic' ? (
          <>
            <path d="m111 211 23-24h112l24 24v14H111Z" fill="#535b41" stroke="#a79962" />
            <path d="M142 187v-21h96v21M154 166v-23h72v23" fill="#6c7050" stroke="#b2a06a" />
            <path d="m189 53 34 46-34 44-34-44Z" fill="#766844" stroke="#dfc17d" strokeWidth="2" />
            <path d="m189 70 21 29-21 27-20-27Z" fill="#ceb172" />
            <path d="m189 70-1 55m-19-26h40" stroke="#f3d69a" opacity=".5" />
            <path
              d="M189 22v13m0 116v10M120 96h13m112 0h13M140 47l10 11m77 76 10 10M139 144l11-10m77-76 10-11"
              stroke="#c4a66b"
              opacity=".6"
            />
            <circle cx="189" cy="98" r="64" stroke="#b4975b" opacity=".25" />
            <circle cx="189" cy="98" r="78" stroke="#b4975b" strokeDasharray="2 12" opacity=".2" />
          </>
        ) : (
          <>
            <path
              d="m126 221-9-105 18-49 38-18 49 7 33 37 13 128Z"
              fill="#54634b"
              stroke="#9b9b73"
              strokeWidth="2"
            />
            <path d="m135 67 38-18 49 7-14 22-43 4-29 25Z" fill="#8b9170" />
            <path d="m208 78 14-22 33 37 13 128h-30l-9-102Z" fill="#40573e" />
            <path
              d="M158 115h43m-38 17h47m-48 20h24m-20 19h43m-41 21h29"
              stroke="#c3b77f"
              strokeWidth="3"
              strokeLinecap="round"
              opacity=".7"
            />
            <path d="m121 113 11 11-5 22m109 32-10 16 7 26" stroke="#2b472e" strokeWidth="3" />
            <path d="m98 219 8-22 22 1 5 23m108 0 5-18 25-4 10 22" fill="#667f4f" />
            <path d="m132 67 4-10 17-4 9 9-4 16-21 8-10-8Z" fill="#758c51" />
            <path d="m145 58 9 7-5 10-15 4" stroke="#9cab6e" strokeWidth="3" />
          </>
        )}
      </svg>
      <span className="run-scene-caption">
        {kind === 'rest'
          ? '石にも、ひと休み。'
          : kind === 'shop'
            ? '品揃え、かためです。'
            : kind === 'relic'
              ? '古い岩には、力が宿る。'
              : '塔は、じっとあなたを見ている。'}
      </span>
    </div>
  );
}

const mapHeight = 1170;
function mapPoint(node: MapNode, floors: number) {
  return {
    x: 140 + node.lane * 180,
    y: 70 + (floors - node.floor) * ((mapHeight - 140) / Math.max(1, floors - 1)),
  };
}

function MapScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const scroller = useRef<HTMLDivElement>(null);
  const available = getAvailableNodes(state);
  const availableIds = new Set(available.map((node) => node.id));
  const visitedIds = new Set(state.visited);
  const byId = new Map(state.map.nodes.map((node) => [node.id, node]));
  const nextFloor = available[0]?.floor ?? Math.min(state.floor + 1, state.map.floors);
  useEffect(() => {
    const target = state.map.nodes.find((node) => node.floor === nextFloor);
    if (scroller.current && target)
      scroller.current.scrollTop = Math.max(
        0,
        mapPoint(target, state.map.floors).y - scroller.current.clientHeight * 0.67,
      );
  }, [nextFloor, state.map]);
  return (
    <>
      <ScreenHeading
        kicker="ACT I · 岩の目覚め"
        title="じっと教の塔"
        text="道を選び、岩の頂へ。光る地点へ進むことができます。"
      >
        <span className="run-seed">
          <Icon name="mountain" size={14} /> SEED <b>{state.seed}</b>
        </span>
      </ScreenHeading>
      <div className="run-map-layout">
        <aside className="run-map-sidebar">
          <div className="run-map-chapter">
            <span>第一層</span>
            <h2>不動の回廊</h2>
            <p>
              上へ、上へ。
              <br />
              じっとしてても、冒険は進む。
            </p>
            <div className="run-floor-progress">
              <span style={{ width: `${(state.visited.length / state.map.floors) * 100}%` }} />
            </div>
            <small>
              {state.visited.length} / {state.map.floors} フロア踏破
            </small>
          </div>
          <div className="run-map-next">
            <p className="section-kicker">NEXT DESTINATION</p>
            <h3>次の目的地</h3>
            <p>第 {nextFloor} フロア</p>
            <div>
              {available.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onAction({ type: 'chooseNode', nodeId: node.id })}
                  className="run-next-choice"
                >
                  <NodeIcon type={node.type} size={20} />
                  <span>
                    {nodeLabels[node.type].name}
                    <small>
                      {node.lane === 0 ? '左の道' : node.lane === 1 ? '中央の道' : '右の道'}
                    </small>
                  </span>
                  <Icon name="chevron" size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="run-map-legend">
            {(Object.keys(nodeLabels) as NodeType[]).map((type) => (
              <div key={type} title={nodeLabels[type].description}>
                <NodeIcon type={type} size={15} />
                <span>{nodeLabels[type].name}</span>
              </div>
            ))}
          </div>
          <p className="run-map-note">
            <Icon name="help" size={13} /> 接続された地点だけに進めます。
            <br />
            HP・デッキ・ゴールドは持ち越されます。
          </p>
        </aside>
        <div className="run-map-panel">
          <div className="run-map-scroll-hint">
            <span>頂をめざして、上へ</span>
            <span>⌃</span>
          </div>
          <div
            className="run-map-scroll"
            ref={scroller}
            tabIndex={0}
            aria-label="12フロアの分岐マップ。スクロールして全体を確認できます。"
          >
            <div className="run-map-graph" style={{ height: mapHeight }}>
              <svg
                className="run-map-lines"
                viewBox={`0 0 640 ${mapHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <pattern id="run-map-dots" width="32" height="32" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r=".7" fill="#d5b575" opacity=".08" />
                  </pattern>
                </defs>
                <rect width="640" height={mapHeight} fill="url(#run-map-dots)" />
                {state.map.nodes.flatMap((node) =>
                  node.connections.map((connection) => {
                    const next = byId.get(connection);
                    if (!next) return null;
                    const from = mapPoint(node, state.map.floors);
                    const to = mapPoint(next, state.map.floors);
                    const traversed = visitedIds.has(node.id) && visitedIds.has(next.id);
                    const upcoming = node.id === state.currentNodeId && availableIds.has(next.id);
                    return (
                      <path
                        key={`${node.id}-${connection}`}
                        d={`M${from.x} ${from.y} C${from.x} ${from.y - 45} ${to.x} ${to.y + 45} ${to.x} ${to.y}`}
                        className={`run-map-connection${traversed ? ' is-traversed' : ''}${upcoming ? ' is-upcoming' : ''}`}
                      />
                    );
                  }),
                )}
                {Array.from({ length: state.map.floors }, (_, index) => {
                  const floor = index + 1;
                  const point = mapPoint({ floor, lane: 0 } as MapNode, state.map.floors);
                  return (
                    <g key={floor}>
                      <text x="25" y={point.y + 4} className="run-map-floor-number">
                        {String(floor).padStart(2, '0')}
                      </text>
                      <path d={`M49 ${point.y}h21M570 ${point.y}h20`} stroke="#a18b5626" />
                    </g>
                  );
                })}
              </svg>
              {state.map.nodes.map((node) => {
                const point = mapPoint(node, state.map.floors);
                const available = availableIds.has(node.id);
                const visited = visitedIds.has(node.id);
                const current = state.currentNodeId === node.id;
                return (
                  <div
                    key={node.id}
                    className={`run-map-node-wrap${available ? ' is-available' : ''}${visited ? ' is-visited' : ''}${current ? ' is-current' : ''}${node.type === 'boss' ? ' is-boss' : ''}`}
                    style={{ left: `${(point.x / 640) * 100}%`, top: point.y }}
                  >
                    <button
                      data-node-id={node.id}
                      className="run-map-node"
                      disabled={!available}
                      onClick={() => onAction({ type: 'chooseNode', nodeId: node.id })}
                      aria-label={`第${node.floor}フロア ${nodeLabels[node.type].name}${available ? '。選択できます' : current ? '。現在地' : visited ? '。踏破済み' : '。未到達'}`}
                      title={nodeLabels[node.type].description}
                    >
                      <NodeIcon type={node.type} size={node.type === 'boss' ? 29 : 23} />
                      {visited && <span className="run-node-check">✓</span>}
                    </button>
                    {(available || node.type === 'boss' || current) && (
                      <span className="run-node-label">
                        {current ? '現在地' : nodeLabels[node.type].name}
                      </span>
                    )}
                  </div>
                );
              })}
              <span className="run-map-start">旅のはじまり</span>
            </div>
          </div>
          <div className="run-map-panel-foot">
            <span>
              <i /> 選択可能
            </span>
            <span>✓ 踏破済み</span>
            <span>第一層 · 全12フロア</span>
          </div>
        </div>
      </div>
    </>
  );
}

function RewardScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const reward = state.reward;
  return (
    <div className="run-centered-screen">
      <ScreenHeading
        kicker="BATTLE REWARD"
        title="新たな教えを、その手に。"
        text="カードを1枚選び、デッキに加えましょう。受け取らずに進むこともできます。"
      />
      <div className="run-reward-summary">
        <span className="run-victory-word">
          <Icon name="sun" size={18} /> 戦闘勝利
        </span>
        <span>
          獲得済み <Gold amount={reward?.gold ?? 0} />
        </span>
        {reward?.potionId && (
          <span className="run-reward-potion">
            {POTION_DEFINITIONS[reward.potionId]?.name ?? 'ポーション'}を獲得
          </span>
        )}
      </div>
      <div className="run-reward-cards">
        {reward?.cardIds.map((cardId) => (
          <div key={cardId} className="run-card-choice">
            <CardView card={{ uid: `reward-${cardId}`, cardId, upgraded: false }} inspect />
            <span className="run-card-rarity">
              {CARD_DEFINITIONS[cardId]?.rarity === 'rare'
                ? '希少な教え'
                : CARD_DEFINITIONS[cardId]?.rarity === 'uncommon'
                  ? '特別な教え'
                  : '新たな教え'}
            </span>
            <button
              className="secondary-button"
              onClick={() => onAction({ type: 'takeCard', cardId })}
            >
              このカードを受け取る
              <Icon name="arrow" size={15} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="run-skip-button text-button"
        onClick={() => onAction({ type: 'takeCard', cardId: null })}
      >
        カードを受け取らずに進む <Icon name="arrow" size={15} />
      </button>
      <p className="run-small-note">小さなデッキも、立派な戦略です。</p>
    </div>
  );
}

function RelicScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const relicId = state.reward?.relicId;
  const relic = relicId ? RELIC_DEFINITIONS[relicId] : null;
  return (
    <div className="run-facility-screen">
      <ScreenHeading
        kicker="ANCIENT BLESSING"
        title="岩に刻まれた、古代の祝福。"
        text="レリックは所持しているだけで、これからの戦闘を助けてくれます。"
      />
      <div className="run-facility-grid">
        <SceneArt kind="relic" />
        <div className="run-facility-content">
          <p className="section-kicker">RELIC DISCOVERED</p>
          <div className="run-discovered-relic">
            <span className="run-large-glyph">{relic?.glyph ?? '◆'}</span>
            <div>
              <small>レリック</small>
              <h2>{relic?.name ?? '古代の祝福'}</h2>
            </div>
          </div>
          <p className="run-facility-description">
            {relic?.description ?? '古代の力を受け取り、先へ進みましょう。'}
          </p>
          <p className="run-flavor">「ほいっと〜。これは、いい岩。」</p>
          <button className="primary-button" onClick={() => onAction({ type: 'takeRelic' })}>
            祝福を受け取る <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EventScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const event = state.eventId ? EVENT_DEFINITIONS[state.eventId] : null;
  return (
    <div className="run-facility-screen">
      <ScreenHeading
        kicker="A STRANGE ENCOUNTER"
        title={event?.title ?? '塔の出来事'}
        text="この出会いが、どんな教えになるでしょう。"
      />
      <div className="run-facility-grid">
        <SceneArt kind="event" />
        <div className="run-facility-content">
          <p className="section-kicker">EVENT</p>
          <p className="run-event-story">{event?.description}</p>
          <div className="run-event-choices">
            {event?.choices.map((choice, index) => {
              const allowed = canChooseEvent(state, index);
              return (
                <button
                  key={index}
                  className="run-event-choice"
                  disabled={!allowed}
                  onClick={() => onAction({ type: 'eventChoice', index })}
                >
                  <span className="run-choice-number">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <b>{choice.label}</b>
                    <small>{choice.description}</small>
                    {!allowed && <em>必要なHPまたはゴールドが足りません</em>}
                  </span>
                  <Icon name="arrow" size={17} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShopScreen({
  state,
  onAction,
  onRemove,
}: Pick<RunScreensProps, 'state' | 'onAction'> & { onRemove: () => void }) {
  const shop = state.shop;
  const relic = shop?.relicId ? RELIC_DEFINITIONS[shop.relicId] : null;
  const potion = shop?.potionId ? POTION_DEFINITIONS[shop.potionId] : null;
  const purchased = new Set(shop?.purchased ?? []);
  const isPurchased = (kind: string, id: string) =>
    purchased.has(id) || purchased.has(`${kind}:${id}`) || purchased.has(kind);
  return (
    <>
      <ScreenHeading
        kicker="THE STONE MERCHANT"
        title="岩商人の小さな露店"
        text="「お代も、意志も、かたくお願いします。」"
      >
        <button className="secondary-button" onClick={() => onAction({ type: 'leaveNode' })}>
          買い物を終える <Icon name="arrow" size={15} />
        </button>
      </ScreenHeading>
      <div className="run-shop">
        <div className="run-shop-cards">
          {shop?.cardIds.map((cardId) => {
            const bought = isPurchased('card', cardId);
            return (
              <div className={`run-card-choice${bought ? ' is-bought' : ''}`} key={cardId}>
                <CardView card={{ uid: `shop-${cardId}`, cardId, upgraded: false }} inspect />
                <button
                  className="secondary-button"
                  disabled={bought || state.gold < SHOP_PRICES.card}
                  onClick={() => onAction({ type: 'buyCard', cardId })}
                >
                  {bought ? (
                    '購入済み'
                  ) : (
                    <>
                      <span>購入する</span>
                      <Gold amount={SHOP_PRICES.card} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div className="run-shop-supplies">
          {relic && shop?.relicId && (
            <article className="run-shop-item">
              <span className="run-supply-glyph">{relic.glyph}</span>
              <div>
                <small>レリック</small>
                <h3>{relic.name}</h3>
                <p>{relic.description}</p>
              </div>
              <button
                className="secondary-button"
                disabled={isPurchased('relic', shop.relicId) || state.gold < SHOP_PRICES.relic}
                onClick={() => onAction({ type: 'buyRelic' })}
              >
                {isPurchased('relic', shop.relicId) ? (
                  '購入済み'
                ) : (
                  <Gold amount={SHOP_PRICES.relic} />
                )}
              </button>
            </article>
          )}
          {potion && shop?.potionId && (
            <article className="run-shop-item">
              <span className="run-supply-glyph">{potion.glyph}</span>
              <div>
                <small>ポーション</small>
                <h3>{potion.name}</h3>
                <p>{potion.description}</p>
                {!state.potions.includes(null) && <em>ポーションの所持枠がいっぱいです</em>}
              </div>
              <button
                className="secondary-button"
                disabled={
                  isPurchased('potion', shop.potionId) ||
                  state.gold < SHOP_PRICES.potion ||
                  !state.potions.includes(null)
                }
                onClick={() => onAction({ type: 'buyPotion' })}
              >
                {isPurchased('potion', shop.potionId) ? (
                  '購入済み'
                ) : (
                  <Gold amount={SHOP_PRICES.potion} />
                )}
              </button>
            </article>
          )}
          <article className="run-shop-item">
            <span className="run-supply-glyph">
              <Icon name="discard" size={31} />
            </span>
            <div>
              <small>デッキ整理 · 1度限り</small>
              <h3>教えを、ひとつ手放す</h3>
              <p>デッキから選んだカード1枚を取り除きます。</p>
            </div>
            <button
              className="secondary-button"
              disabled={
                !!shop?.removed || state.gold < SHOP_PRICES.remove || state.deck.length <= 1
              }
              onClick={onRemove}
            >
              {shop?.removed ? '利用済み' : <Gold amount={SHOP_PRICES.remove} />}
            </button>
          </article>
        </div>
      </div>
      <p className="run-small-note run-shop-note">
        購入したカードはすぐにデッキに加わります。所持金が足りない品は購入できません。
      </p>
    </>
  );
}

function RestScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const heal = Math.ceil(state.maxHp * 0.3);
  const canUpgrade = state.deck.some((card) => !card.upgraded);
  return (
    <div className="run-facility-screen">
      <ScreenHeading
        kicker="A MOMENT OF STILLNESS"
        title="焚き火のそばで、じっと。"
        text="回復するか、教えを磨くか。どちらかひとつを選べます。"
      />
      <div className="run-facility-grid">
        <SceneArt kind="rest" />
        <div className="run-facility-content">
          <p className="section-kicker">REST SITE</p>
          <p className="run-rest-quote">「8時か、ねんねやな」</p>
          <p className="run-facility-description">
            長い石段の先で、暖かな火を見つけた。
            <br />
            岩の身体にも、休息は必要らしい。
          </p>
          <div className="run-rest-choices">
            <button
              className="run-event-choice"
              onClick={() => onAction({ type: 'rest', choice: 'heal' })}
            >
              <Icon name="heart" size={23} />
              <span>
                <b>ひと休みする</b>
                <small>
                  最大HPの30%（{heal}）を回復。現在 {state.hp} / {state.maxHp}
                </small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
            <button
              className="run-event-choice"
              disabled={!canUpgrade}
              onClick={() => onAction({ type: 'rest', choice: 'upgrade' })}
            >
              <Icon name="flame" size={23} />
              <span>
                <b>教えを磨く</b>
                <small>
                  {canUpgrade
                    ? 'デッキのカード1枚を、1段階強化します。'
                    : 'すべてのカードが強化済みです。'}
                </small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          </div>
          <p className="run-small-note">選択すると休憩所を離れ、マップへ進みます。</p>
        </div>
      </div>
    </div>
  );
}

function UpgradeScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const cards = state.deck.filter((card) => !card.upgraded);
  return (
    <>
      <ScreenHeading
        kicker="REFINE YOUR TEACHING"
        title="ひとつの教えを、さらに深く。"
        text="強化後の効果を確認し、カードを1枚選んでください。強化は1段階までです。"
      >
        <button className="secondary-button" onClick={() => onAction({ type: 'leaveNode' })}>
          休憩所に戻る
        </button>
      </ScreenHeading>
      <div className="run-upgrade-grid">
        {cards.map((card) => (
          <div key={card.uid} className="run-card-choice">
            <CardView card={{ ...card, upgraded: true }} inspect />
            <p className="run-upgrade-before">
              <b>強化前</b>
              {CARD_DEFINITIONS[card.cardId]?.description}
            </p>
            <button
              className="secondary-button"
              onClick={() => onAction({ type: 'upgradeCard', cardUid: card.uid })}
            >
              <Icon name="flame" size={14} />
              このカードを強化
            </button>
          </div>
        ))}
      </div>
      {cards.length === 0 && (
        <p className="run-empty-message">すべての教えが磨き上げられています。</p>
      )}
    </>
  );
}

function ResultScreen({
  state,
  onNewRun,
  onReplay,
  onTitle,
}: Pick<RunScreensProps, 'state' | 'onNewRun' | 'onReplay' | 'onTitle'>) {
  const won = state.screen === 'victory';
  return (
    <div className={`run-result-screen${won ? ' is-victory' : ''}`}>
      <div className="run-result-art">
        <div className="run-result-halo" />
        <RockDeity deified={won} />
      </div>
      <div className="run-result-content">
        <p className="eyebrow">
          <span className="gold-line" />
          {won ? 'ACT I · CONQUERED' : 'THE JOURNEY ENDS'}
        </p>
        <h1>{won ? '岩の頂に、辿り着いた。' : '今日は、ここまで。'}</h1>
        <p className="run-result-subtitle">{won ? '第一層 クリア' : 'GAME OVER'}</p>
        <p className="run-result-description">
          {won
            ? '不動の回廊の主は倒れた。塔に響くのは、いつものひと言。'
            : '岩尊けいとは静かに腰を下ろした。教えは次の旅に引き継がれる。'}
        </p>
        <p className="run-result-quote">
          {won ? '「ほいっと〜。朝活、完了やな。」' : '「8時か、ねんねやな」'}
        </p>
        <div className="run-result-stats">
          <div>
            <b>
              {state.floor}
              <small> / 12</small>
            </b>
            <span>到達フロア</span>
          </div>
          <div>
            <b>{state.stats.battlesWon}</b>
            <span>戦闘勝利</span>
          </div>
          <div>
            <b>{state.stats.elitesDefeated}</b>
            <span>エリート撃破</span>
          </div>
          <div>
            <b>{state.deck.length}</b>
            <span>デッキ枚数</span>
          </div>
        </div>
        <div className="run-result-relics">
          <span>旅で得た祝福</span>
          {state.relicIds.length ? (
            state.relicIds.map((id) => <RelicBadge key={id} id={id} small />)
          ) : (
            <small>レリックなし</small>
          )}
        </div>
        <button className="primary-button" onClick={onNewRun}>
          新たな冒険を始める <Icon name="arrow" size={18} />
        </button>
        <div className="run-result-secondary">
          <button className="text-button" onClick={onReplay}>
            <Icon name="repeat" size={14} /> 同じシードで再挑戦
          </button>
          <button className="text-button" onClick={onTitle}>
            タイトルへ戻る <Icon name="chevron" size={13} />
          </button>
        </div>
        {won && (
          <button disabled className="run-future-act">
            第二層 · 今後のアップデートで開放
          </button>
        )}
        <p className="run-result-seed">
          SEED <span>{state.seed}</span>
        </p>
      </div>
    </div>
  );
}

export function RunScreens({ state, onAction, onNewRun, onReplay, onTitle }: RunScreensProps) {
  const [deckOpen, setDeckOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    setRemoving(false);
    setDeckOpen(false);
  }, [state.screen]);
  function remove(card: CardInstance) {
    onAction({ type: 'removeCard', cardUid: card.uid });
    setRemoving(false);
  }
  let screen: ReactNode;
  switch (state.screen) {
    case 'map':
      screen = <MapScreen state={state} onAction={onAction} />;
      break;
    case 'reward':
      screen = <RewardScreen state={state} onAction={onAction} />;
      break;
    case 'relic':
      screen = <RelicScreen state={state} onAction={onAction} />;
      break;
    case 'event':
      screen = <EventScreen state={state} onAction={onAction} />;
      break;
    case 'shop':
      screen = <ShopScreen state={state} onAction={onAction} onRemove={() => setRemoving(true)} />;
      break;
    case 'rest':
      screen = <RestScreen state={state} onAction={onAction} />;
      break;
    case 'upgrade':
      screen = <UpgradeScreen state={state} onAction={onAction} />;
      break;
    case 'victory':
    case 'defeat':
      screen = (
        <ResultScreen state={state} onNewRun={onNewRun} onReplay={onReplay} onTitle={onTitle} />
      );
      break;
    case 'combat':
      return null;
  }
  return (
    <main className={`run-screen run-screen--${state.screen}`}>
      <RunStatus state={state} onDeck={() => setDeckOpen(true)} />
      {screen}
      {(deckOpen || removing) && (
        <Modal
          title={removing ? '手放す教えを選ぶ' : `現在のデッキ · ${state.deck.length}枚`}
          subtitle={removing ? `REMOVE A CARD · ${SHOP_PRICES.remove} GOLD` : 'YOUR TEACHINGS'}
          onClose={() => {
            setDeckOpen(false);
            setRemoving(false);
          }}
          wide
        >
          <p className="modal-intro">
            {removing
              ? '選んだカード1枚をデッキから取り除きます。この操作には60ゴールドを消費します。'
              : 'これまでの旅で身につけた教え。強化済みのカードには「＋」が付きます。'}
          </p>
          <div className="run-deck-grid">
            {state.deck.map((card) => (
              <div className="run-card-choice" key={card.uid}>
                <CardView card={card} inspect />
                {removing && (
                  <button className="secondary-button danger-text" onClick={() => remove(card)}>
                    このカードを取り除く
                  </button>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </main>
  );
}
