import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'sword'
  | 'shield'
  | 'sun'
  | 'cards'
  | 'discard'
  | 'flame'
  | 'gear'
  | 'arrow'
  | 'close'
  | 'book'
  | 'chevron'
  | 'heart'
  | 'repeat'
  | 'help'
  | 'mountain'
  | 'bolt';

const paths: Record<IconName, ReactNode> = {
  sword: (
    <>
      <path d="m5 3 4 1 10 10-5 5L4 9Z" />
      <path d="m12 17 5-5M15 20l5-5M19 19l3 3M5 3l3 5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 3.5 5.5v6c0 5 4 8.5 8.5 11 4.5-2.5 8.5-6 8.5-11v-6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M20 4l-2 2M6 18l-2 2" />
    </>
  ),
  cards: (
    <>
      <rect x="8" y="3" width="12" height="17" rx="2" />
      <path d="m5 6-2 1 3 16 11-2M12 8h4m-4 4h4" />
    </>
  ),
  discard: (
    <>
      <path d="m3 8 9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5M3 18l9 5 9-5" />
    </>
  ),
  flame: (
    <path d="M13 2c2 7-5 6-2 12 1-2 3-2 4-5 4 4 7 8 2 12-3 2-8 2-11-1-4-5 0-9 3-13 0 3 1 4 2 5-1-5 2-5 2-10Z" />
  ),
  gear: (
    <>
      <path
        d="m9 3 1-2h4l1 2 2 1 3-1 2 3-2 2v3l2 2-2 4-3-1-2 1-1 3h-4l-1-3-2-1-3 1-2-4 2-2V8L2 6l2-3 3 1Z"
        transform="translate(0 1)"
      />
      <circle cx="12" cy="11" r="3" />
    </>
  ),
  arrow: (
    <>
      <path d="M3 12h17m-6-6 6 6-6 6" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  book: (
    <>
      <path d="M12 5C9 2 5 2 2 4v16c3-2 7-2 10 1 3-3 7-3 10-1V4c-3-2-7-2-10 1Zm0 0v16" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  heart: <path d="M12 21C-4 12 2-3 12 5 22-3 28 12 12 21Z" />,
  repeat: (
    <>
      <path d="M19 8a8 8 0 1 0 1 9M19 3v6h-6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v1" />
    </>
  ),
  mountain: (
    <>
      <path d="m2 21 6-16 4 7 4-10 6 19ZM8 5l3 10 5-13M5 14l4 2 3-4 4 5 4-2" />
    </>
  ),
  bolt: <path d="m14 1-9 13h7l-2 9 10-14h-7Z" />,
};

export function Icon({
  name,
  size = 20,
  className = '',
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
