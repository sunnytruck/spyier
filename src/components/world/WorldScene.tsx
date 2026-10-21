import battleSanctuary from '../../assets/world/battle-sanctuary.svg';
import titlePilgrimage from '../../assets/world/title-pilgrimage.svg';
import ritualCircle from '../../assets/world/ritual-stone-circle.svg';
import carvedTablet from '../../assets/world/map-carved-tablet.svg';
import '../../styles/world-art.css';

export type WorldSceneVariant = 'battle' | 'title' | 'ritual' | 'map';

/** Stable artwork boundary: replace a source with a commissioned illustration,
 * keeping scenery, lighting and motion independent from all game calculations. */
export const WORLD_ART: Record<WorldSceneVariant, { src: string; focalPoint: string; credit: string }> = {
  battle: { src: battleSanctuary, focalPoint: '50% 58%', credit: 'IWASON SPIRE · 深緑の石殿' },
  title: { src: titlePilgrimage, focalPoint: '61% 49%', credit: 'IWASON SPIRE · 岩尊の門' },
  ritual: { src: ritualCircle, focalPoint: '50% 45%', credit: 'IWASON SPIRE · 神授の石輪' },
  map: { src: carvedTablet, focalPoint: '50% 50%', credit: 'IWASON SPIRE · 古岩の道標' },
};

/** Decoration only. Live actors, map connections and resource counters are
 * rendered by their existing components above this non-interactive scenery. */
export function WorldScene({ variant, className = '', act = 1 }: {
  variant: WorldSceneVariant;
  className?: string;
  act?: number;
}) {
  const art = WORLD_ART[variant];
  return <div className={`world-scene world-scene--${variant} ${className}`} data-world-scene={variant}
    data-world-act={act} aria-hidden="true">
    <img className="world-scene-illustration" src={art.src} alt="" draggable={false}
      decoding="async" fetchPriority={variant === 'title' ? 'high' : 'auto'}
      style={{ objectPosition: art.focalPoint }} />
    <div className="world-scene-atmosphere" />
    <div className="world-scene-mist world-scene-mist--far" />
    <div className="world-scene-mist world-scene-mist--near" />
    <div className="world-scene-motes"><i /><i /><i /><i /><i /><i /><i /><i /></div>
    <div className="world-scene-shade" />
  </div>;
}

/** A monolith and its three witnesses: original visual vocabulary, shared by
 * scene dividers and seals without becoming a fake interactive map node. */
export function TempleSeal({ className = '' }: { className?: string }) {
  return <svg className={`temple-seal ${className}`} viewBox="0 0 80 88" fill="none" aria-hidden="true">
    <path d="m40 13 16 13 5 31-9 17H28l-9-17 5-31z" stroke="currentColor" strokeWidth="1.6" />
    <path d="m40 13 1 40-13 21m13-21 11 21M24 26l17 8 15-8M28 57h24" stroke="currentColor" strokeWidth=".8" opacity=".6" />
    <path d="M40 1v7M11 17l7 6m51-6-7 6M5 51h9m52 0h9M15 76l7-5m43 5-7-5M35 84h10" stroke="currentColor" strokeWidth="2" />
    <path d="m32 41 8-3 8 3-8 6z" fill="currentColor" opacity=".45" />
  </svg>;
}
