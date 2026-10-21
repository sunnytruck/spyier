import { useId } from 'react';
import type { CardDefinition, Effect } from '../types/game';

type Motif = 'fist' | 'blade' | 'ward' | 'star' | 'soul' | 'orbit' | 'venom' | 'offering' | 'script';

/** Illustrations are a replaceable presentation layer, never a second effect model. */
export function cardEtchingMotif(definition: CardDefinition): Motif {
  const flatten = (effects: Effect[]): Effect[] => effects.flatMap((effect) => effect.type === 'conditional' || effect.type === 'nextTurn' ? [effect, ...flatten(effect.effects)] : [effect]);
  const effects = flatten(definition.effects);
  if (effects.some((effect) => effect.type === 'loseHp' || effect.type === 'loseMaxHp')) return 'offering';
  if (effects.some((effect) => effect.type === 'status' && effect.status === 'poison' || effect.type === 'multiplyPoison')) return 'venom';
  if (definition.classId === 'machinist' && effects.some((effect) => ['channel', 'evoke', 'focus', 'orbSlots', 'passiveOrbs', 'xChannel'].includes(effect.type))) return 'orbit';
  if (definition.classId === 'necromancer' && effects.some((effect) => ['summon', 'summonDamage', 'soul', 'doom', 'loseEnemyHp'].includes(effect.type))) return 'soul';
  if (definition.classId === 'oracle' && effects.some((effect) => ['gainStars', 'starBurst', 'forge', 'fetchGenerated'].includes(effect.type))) return 'star';
  if (definition.type === 'attack') return definition.classId === 'assassin' || definition.tags?.includes('knife') ? 'blade' : 'fist';
  if (definition.defense || effects.some((effect) => ['block', 'plate', 'dexterity'].includes(effect.type))) return 'ward';
  return definition.type === 'power' ? 'star' : 'script';
}

/** Original cut-stone emblems: a large readable silhouette over incised landscape lines. */
export function CardEtching({ definition }: { definition: CardDefinition }) {
  const id = useId().replace(/:/g, '');
  const motif = cardEtchingMotif(definition);
  return <div className={`card-art card-art--${definition.type} card-art--${motif}`} data-card-illustration={motif} aria-hidden="true">
    <svg viewBox="0 0 240 120" className="card-etching stone-etching" role="presentation">
      <defs>
        <linearGradient id={`ink-${id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--etch-light, #d9d5b2)" /><stop offset="1" stopColor="var(--etch-dark, #434e45)" /></linearGradient>
        <radialGradient id={`glow-${id}`}><stop stopColor="var(--etch-glow, #c4a46b)" stopOpacity=".45" /><stop offset="1" stopColor="var(--etch-glow, #c4a46b)" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="120" cy="61" rx="87" ry="66" fill={`url(#glow-${id})`} />
      <path d="M0 108 31 84 53 94 75 67 96 84 129 55 162 87 191 68 222 100 240 91V120H0Z" fill="currentColor" opacity=".09" />
      <g stroke="currentColor" opacity=".18" fill="none" strokeWidth=".7"><path d="M0 111h240M19 98h44m116 5h38M26 88l25 9 20-25m109 13 9-11 22 22" /><circle cx="120" cy="62" r="47" strokeDasharray="2 10" /><path d="M120 8v13m0 86v9M56 62h15m98 0h15" /></g>
      <g fill={`url(#ink-${id})`} stroke="var(--etch-line, #f0deb1)" strokeWidth="1.2" strokeLinejoin="bevel">
        {motif === 'fist' && <><path d="m78 91-5-31 11-11 12 6 3-28 15-7 12 6 15-3 12 11 12 1 10 19-12 37-28 15-30-4Z" /><path d="m82 65 20 11 8 18m-10-64 2 38 15 7 6-49m3 48 16-8-1-39m8 13 5 23-18 31" fill="none" /><path d="m50 50 13 5-7 10-8-5Zm134 30 12-2 4 9-16 8ZM65 109l10-8 9 12Z" fill="currentColor" stroke="none" opacity=".7" /></>}
        {motif === 'blade' && <><path d="m78 103 10-29 49-59 20-7-4 21-52 59Z" /><path d="m93 78 48-56m-60 63 27 14m-24-6-9 12" fill="none" strokeWidth="2.8" /><path d="m139 93 4-22-42-50-14-6 1 18 40 47Z" opacity=".65" /><path d="m159 49 7 14 15 3-15 4-7 15-3-15-12-4 12-3Z" fill="var(--etch-line, #f0deb1)" stroke="none" /><path d="M54 69q49-36 128-23M58 78q57-26 133-24" fill="none" opacity=".4" /></>}
        {motif === 'ward' && <><path d="m120 16-40 12-8 29 13 28 35 23 34-24 14-29-9-27Z" /><path d="m120 28-27 9-6 20 10 20 23 17 23-17 10-21-7-19Z" fill="none" /><path d="m120 37-15 24 15 20 15-20Z" fill="var(--etch-dark, #434e45)" /><path d="M120 42v33m-7-15h14" fill="none" strokeWidth="2" /><path d="M63 37 50 55l8 31m118-48 12 18-8 30" fill="none" opacity=".7" /></>}
        {motif === 'star' && <><path d="m121 13 9 30 29 9-29 10-9 32-11-32-31-10 31-9Z" /><path d="m121 31 5 19 15 3-16 6-4 15-6-16-16-5 17-5Z" fill="var(--etch-dark, #434e45)" /><path d="m161 17 4 12 13 4-13 5-4 13-5-13-12-5 12-4ZM78 73l4 11 11 4-11 3-4 13-4-13-12-3 12-4Z" opacity=".8" /><path d="M67 62c-14 34 90 59 110 21M85 19c-8-8-27 11-31 32" fill="none" /><path d="m103 103 36-3 15 9-66 4Z" opacity=".6" /></>}
        {motif === 'soul' && <><path d="m95 106-11-18 6-25 16-9-8-17 7-18 23-7 17 12 4 18-9 14 16 13 3 23-18 16Z" /><path d="m104 34 10-6 14 2 8 10-10 18-16-7Z" fill="var(--etch-dark, #434e45)" /><path d="m106 39 8 2m11-1 8-3m-25 43 13-13 15 12-9 20Z" fill="none" strokeWidth="2.4" /><path d="M73 42c-28 13 17 29-4 48m103-68c-22 15 14 24 0 41M71 109c-14-19-23-21-25-35" fill="none" opacity=".6" /></>}
        {motif === 'orbit' && <><path d="m120 35 27 14v29l-27 14-25-15V49Z" /><path d="m120 45 17 11v15l-17 10-15-10V56Z" fill="var(--etch-dark, #434e45)" /><path d="m120 51-9 15h11l-6 13 14-19h-10Z" fill="var(--etch-line, #f0deb1)" stroke="none" /><ellipse cx="120" cy="64" rx="71" ry="25" transform="rotate(-24 120 64)" fill="none" /><circle cx="67" cy="86" r="12" /><path d="m64 78 7 2-6 8h7l-9 9 3-10h-5Z" fill="var(--etch-dark, #434e45)" stroke="none" /><path d="m170 27 11 5 4 11-10 9-11-6-4-11Z" /><path d="m174 30-1 17m-7-12 14 8m-13 2 13-10" fill="none" /><path d="M104 21h31m-24-5v10m16-10v10" fill="none" opacity=".7" /></>}
        {motif === 'venom' && <><path d="m101 39 8-15 27-4 12 13-2 18-13 10 10 25-9 17-29-2-13-17 10-22-10-13Z" /><path d="m106 38 8 8-8 8m29-18-8 9 9 5m-27 33 11 8 11-13" fill="none" strokeWidth="3" /><path d="M74 101c-36-13-12-37 8-23 8-24 27-15 28-5m45 21c38 6 47-21 18-23 9-21-12-23-20-7" fill="none" opacity=".65" /><path d="m68 40 4-13 6 14-6 8Zm109 10 5-16 7 16-6 10Z" fill="currentColor" stroke="none" opacity=".8" /></>}
        {motif === 'offering' && <><path d="m84 49 70-7-9 30-20 14 4 17 20 5-60 5 18-11 1-17-17-11Z" /><path d="m99 53 10 20 13 7 14-13 6-16m-22 37 1 15" fill="none" /><path d="m120 8-13 20 3 13 12 3 11-10-4-11Z" fill="var(--etch-line, #f0deb1)" /><path d="M75 58 58 44m107 3 17-18M86 91 62 99m99-16 22 8" fill="none" opacity=".7" /></>}
        {motif === 'script' && <><path d="m85 27 69-9-2 17-11 8 11 52-69 11-11-16 8-18-3-28Z" /><path d="m85 29-7 10 7 12 60-10m-61 45-4 12 8 8m62-87-5 14 9 2" fill="none" /><path d="m96 57 8-4 6 3 15-4m-27 12 30-5m-28 14 10-5 8 3 13-4m-27 14 28-5" fill="none" strokeWidth="2.5" /><path d="m57 48 4 8 9 2-9 4-4 9-3-10-9-3 9-3Zm114 31 4 9 10 2-10 3-4 11-3-11-10-3 10-2Z" opacity=".6" /></>}
      </g>
      <path d="m8 12 20-4m182 97 18-5M12 112l14-2m192-96 13-3" stroke="currentColor" opacity=".4" />
    </svg>
  </div>;
}
