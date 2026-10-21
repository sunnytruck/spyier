import { useCallback, useEffect, useRef, useState } from 'react';
import type { CombatState } from '../../types/game';
import { getOrbView } from '../../engine/combat/resourceView';
import { ResourceDetails } from './ResourceDetails';

/** Array indexes and the rightmost release marker follow the engine's slot order. */
export function OrbSlots({ state }: { state: CombatState }) {
  const view = getOrbView(state);
  const extended = view.capacity > 6;
  const strip = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const slot = selected === null ? null : view.slots[selected];
  useEffect(() => {
    if (!extended || !strip.current || view.nextEvokeIndex === null) return;
    const container = strip.current;
    const marker = container.querySelector<HTMLElement>('[data-next-evoke="true"]');
    if (!marker) return;
    // Move only this strip, never the page, to keep the next release visible.
    const left = marker.offsetLeft;
    const right = left + marker.offsetWidth;
    if (left < container.scrollLeft || right > container.scrollLeft + container.clientWidth)
      container.scrollLeft = Math.max(0, right - container.clientWidth + 8);
  }, [extended, view.nextEvokeIndex, view.capacity]);
  return <>
    <div ref={strip} className={`class-orb-slots${extended ? ' class-orb-slots--extended' : ''}`} data-orb-capacity={view.capacity}
      role="group" tabIndex={extended ? 0 : undefined} aria-label={`オーブ ${view.count}/${view.capacity}、右端から解放${extended ? '。左右にスクロールして全スロットを確認' : ''}`}>
      {view.slots.map((orb) => {
        const name = orb.type === 'lightning' ? '雷' : orb.type === 'frost' ? '霜' : '空き';
        const detail = orb.type ? `自動${orb.passive}、解放${orb.evoke}。${orb.isNextEvoke ? '次に解放。' : ''}` : 'オーブ生成時に埋まります。';
        return <button type="button" className={`class-orb-slot ${orb.type ? `orb-slot--${orb.type}` : 'orb-slot--empty'} ${orb.isNextEvoke ? 'orb-slot--next' : ''}`} key={orb.index}
          data-battle-actor={`orb-${orb.index}`} data-orb-type={orb.type ?? 'empty'} data-orb-index={orb.index}
          data-next-evoke={orb.isNextEvoke || undefined}
          title={`スロット${orb.index + 1}：${name}。${detail}`}
          aria-label={`スロット${orb.index + 1} ${name}。${detail} 詳細を表示`}
          onClick={() => setSelected(orb.index)}>
          <span className="resource-motion"><span className="orb-slot-symbol" aria-hidden="true">{orb.type === 'lightning' ? 'ϟ' : orb.type === 'frost' ? '❄' : '·'}</span></span>
          <span className="orb-slot-name">{orb.index + 1} · {name}</span>
          {orb.isNextEvoke && <span className="orb-next-label">次に解放</span>}
        </button>;
      })}
    </div>
    {slot && <ResourceDetails title={`スロット${slot.index + 1} · ${slot.type === 'lightning' ? '雷のオーブ' : slot.type === 'frost' ? '霜のオーブ' : '空きスロット'}`} onClose={close}>
      <p>保持数 <strong>{view.count} / {view.capacity}</strong> · 集中力 <strong>{view.focus}</strong>{view.temporaryFocus !== 0 && `（うち一時集中力 ${view.temporaryFocus}）`}</p>
      {slot.type ? <dl><div><dt>ターン終了時</dt><dd>{slot.type === 'lightning' ? `ランダムな敵1体に${slot.passive}ダメージ` : `${slot.passive}ブロックを獲得`}</dd></div><div><dt>解放時</dt><dd>{slot.type === 'lightning' ? `ランダムな敵1体に${slot.evoke}ダメージ` : `${slot.evoke}ブロックを獲得`}</dd></div></dl> : <p>このスロットは空です。生成したオーブが順に入ります。</p>}
      <p>次に解放されるのは<strong>右端の保持オーブ</strong>です。満杯で生成すると、右端を1回解放してから新しいオーブが入ります。</p>
      <p>表示値は現在の集中力を反映しています。雷はブロックで軽減され、筋力・弱体・脆弱の影響を受けません。</p>
    </ResourceDetails>}
  </>;
}
