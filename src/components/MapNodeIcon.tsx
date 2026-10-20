import type { NodeType } from '../types/run';

export type MapIconType = NodeType | 'blessing';

export const MAP_ICON_LABELS: Record<MapIconType, string> = {
  battle: '通常戦闘', elite: 'エリート', event: '出来事', shop: '商人',
  rest: '休憩所', treasure: '宝箱', boss: '階層ボス', blessing: '祝福',
};

/** Original carved emblems. No map generation, selection, or random state lives here. */
export function MapNodeIcon({ type, size = 28, label, className = '' }: {
  type: MapIconType;
  size?: number;
  /** Omit on icons next to visible text to avoid duplicate announcements. */
  label?: string;
  className?: string;
}) {
  return <svg className={`icon map-node-icon map-node-icon--${type} ${className}`.trim()}
    data-map-icon={type} width={size} height={size} viewBox="0 0 40 40" fill="none"
    stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {type === 'battle' && <>
      <path d="m8 5 6 3 17 23-4 4L9 12Zm24 0-6 3L9 31l4 4 18-23Z" fill="currentColor" fillOpacity=".13" />
      <path d="m7 24 9 9m8-26 7 5M5 35l6-6M35 35l-6-6M24 33l9-9M9 8l5 3m17-3-5 3" />
      <path d="m17 17 3 4 3-4-3 1Z" fill="currentColor" strokeWidth=".8" />
    </>}
    {type === 'elite' && <>
      <path d="m11 16-6-4-2-8 8 5 5 7m13 0 6-4 2-8-8 5-5 7" fill="currentColor" fillOpacity=".17" />
      <path d="m20 8 11 8 2 14-13 7L7 30l2-14Z" fill="currentColor" fillOpacity=".14" />
      <path d="M20 9v18m-8-7 6 3m10-3-6 3M14 28l6 4 6-4M20 1v4m-4-2 4 2 4-2" />
    </>}
    {type === 'event' && <>
      <path d="m20 2 14 10v16L20 38 6 28V12Z" strokeOpacity=".5" />
      <path d="M14 13c0-8 15-8 14 0 0 5-8 5-8 11v1" strokeWidth="3" />
      <path d="m20 30 2 2-2 2-2-2Z" fill="currentColor" />
      <path d="M3 20h3m28 0h3M12 5l2 2m12 26 2 2" strokeOpacity=".65" />
    </>}
    {type === 'shop' && <>
      <path d="m14 5 6 3 6-3-2 8c9 6 12 18 5 22H11c-7-4-4-16 5-22Z" fill="currentColor" fillOpacity=".14" />
      <path d="M14 13h12m-12 3h12M20 6V2m-3 0h6" />
      <circle cx="20" cy="25" r="6" /><path d="m20 21 3 4-3 4-3-4Z" fill="currentColor" fillOpacity=".22" />
      <path d="m7 25-2 3m28-3 2 3" />
    </>}
    {type === 'rest' && <>
      <path d="M21 3c3 8-6 10-3 17 2-1 3-5 5-6 9 7 10 17 2 20-9 4-18-4-14-12 1 6 4 4 4 2-3-8 3-13 6-21Z" fill="currentColor" fillOpacity=".2" />
      <path d="M20 22c-1 4-5 5-2 9 4 3 8-3 2-9ZM8 34l24 4M8 38l24-4M10 9l1 3m20 1-2 3M29 4l-1 3" />
    </>}
    {type === 'treasure' && <>
      <path d="M5 19V13c0-6 30-6 30 0v6m-30 0h30v16H5Z" fill="currentColor" fillOpacity=".14" />
      <path d="M11 9v10m18-10v10M9 22v9h22v-9m-17-3v7h12v-7" />
      <path d="m20 19 3 3-3 4-3-4Z" fill="currentColor" fillOpacity=".3" />
      <path d="M20 1v3m-9-1 2 3m16-3-2 3" strokeOpacity=".7" />
    </>}
    {type === 'boss' && <>
      <path d="m8 12-3-8 9 5 6-7 6 7 9-5-3 8Z" fill="currentColor" fillOpacity=".23" />
      <path d="M20 13c-9 0-15 7-13 14l5 3v6h16v-6l5-3c2-7-4-14-13-14Z" fill="currentColor" fillOpacity=".11" />
      <path d="m12 22 5 2-1 4-4-1Zm16 0-5 2 1 4 4-1ZM20 26l-2 5h4ZM17 36v-3m6 3v-3M9 15l-2 1m24-1 2 1" />
    </>}
    {type === 'blessing' && <>
      <path d="m20 7 9 5 5 16-7 8H13l-7-8 5-16Z" fill="currentColor" fillOpacity=".17" />
      <path d="m11 20 6 1m12-1-6 1M14 28l6 3 6-3M20 13v3M3 16l3 1m28 0 3-1M20 1v3M7 6l3 3m23-3-3 3" />
      <path d="m20 19 2 4-2 3-2-3Z" fill="currentColor" fillOpacity=".35" />
      <path d="M9 36h22M4 25l-2 3m36-3 2 3" strokeOpacity=".6" />
    </>}
  </svg>;
}
