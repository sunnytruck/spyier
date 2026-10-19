import { useId } from 'react';
import type { ClassId } from '../types/game';
import { CLASS_DEFINITIONS } from '../data/classes';
import '../styles/class-character-art.css';

// Original layered vector costumes. These are artwork only: resource orbs, companions,
// counters and their animations belong to the combat presentation, never this illustration.
const COSTUMES: Record<ClassId, { light: string; stone: string; shade: string; accent: string; description: string }> = {
  berserker: { light: '#bbad91', stone: '#7a7769', shade: '#403c35', accent: '#ef9653', description: '赤い鉢巻と道着、巨大な岩の拳で大地を踏みしめる姿' },
  assassin: { light: '#929a8d', stone: '#59685e', shade: '#273a33', accent: '#a6dc8b', description: '深いフードと紫の外套をまとい、両手に石刃を構える姿' },
  oracle: { light: '#c3bd9b', stone: '#8d8d73', shade: '#4b5747', accent: '#f1d58c', description: '星冠と白金の祭服をまとい、大きな聖剣を掲げる姿' },
  necromancer: { light: '#a4a7c2', stone: '#72768e', shade: '#3a405b', accent: '#bab7ff', description: '青紫の長衣と魂の杖を持つ、黄泉の教祖の姿' },
  machinist: { light: '#9aafb2', stone: '#617b80', shade: '#304a53', accent: '#99e8ec', description: '機械仕掛けの岩の装甲と発光するコイルを備えた姿' },
};

/** The same carved face and inscriptions identify Keito in every costume. */
function StoneFace({ body, light, accent }: { body: string; light: string; accent: string }) {
  return <g className="keito-face" stroke="#2b3834" strokeWidth="3" strokeLinejoin="round">
    <path d="M178 116v25l23 17 24-18-3-25" fill={body} />
    <path d="M162 67l18-22 43-1 22 18 9 37-16 34-35 14-33-15-16-35z" fill={body} />
    <path d="M162 67l18-22 43-1-2 25-34 8z" fill={light} stroke="none" />
    <path d="M162 67l25 10-8 25-18 8-7-13z" fill={light} opacity=".62" stroke="none" />
    <path d="M179 102l15-15 10 2 9-2 25 5 3 24-14 15-24 8-25-14z" fill={body} stroke="none" />
    <path d="M166 83l23 1 9 10-29-1zM207 94l10-11 25-4-5 14z" fill="#21362e" stroke="none" />
    <path d="M173 89l15 1M218 89l16-2" stroke={accent} strokeWidth="4" strokeLinecap="round" />
    <path d="M201 88l-7 20 12 3 6-5z" fill={light} stroke="none" />
    <path d="M185 120l15-3 18 1M191 126l21-1" fill="none" strokeLinecap="round" />
    <path d="M178 50l7 13-3 10M226 109l7 7-6 11" fill="none" strokeWidth="2" opacity=".65" />
    <path d="M185 49l17-9 20 5-6 9-17-3z" fill={light} stroke="none" />
  </g>;
}

function StoneChest({ body, light, accent }: { body: string; light: string; accent: string }) {
  return <g stroke="#293b33" strokeWidth="3" strokeLinejoin="round">
    <path d="M154 145l-46-16-34 20-18 42 13 38 42 7 43-39M249 145l45-16 35 20 18 42-13 38-42 7-43-39" fill={body} />
    <path d="M108 129l-34 20-14 27 44 12 46-19 4-24zM294 129l35 20 14 27-45 12-46-19-3-24z" fill={light} stroke="none" />
    <path d="M154 143l29-14 37-1 30 15 36 41-16 64-26 43-41 20-43-18-28-47-14-63z" fill={body} />
    <path d="M154 149l39 8 6 44-24 16-43-17 6-28zM246 149l-39 8-5 44 24 16 42-17-6-28z" fill={light} stroke="none" />
    <path d="M139 205l35 18 24-13v27l-24 9-28-15M263 205l-35 18-24-13v27l24 9 28-15" fill="#1c3029" opacity=".2" stroke="none" />
    <path d="M173 246l25-5v27l-22 7-20-18zM204 241l24 5 17 11-20 18-21-7zM178 279l21-6 1 23-14 6-15-12zM204 273l20 6 6 11-15 12-12-6z" fill={light} opacity=".7" stroke="none" />
    <path d="M200 158v38M200 215v18M200 247v19" fill="none" />
    <g className="keito-inscriptions" fill={accent} stroke="none" fontFamily="'Yu Gothic', 'Hiragino Kaku Gothic ProN', sans-serif" fontWeight="900" textAnchor="middle">
      <text x="102" y="176" fontSize="28" transform="rotate(-11 102 164)">じ</text>
      <text x="301" y="176" fontSize="28" transform="rotate(11 301 164)">と</text>
      <text x="201" y="196" fontSize="22" letterSpacing="1">じっと教</text>
    </g>
  </g>;
}

function BerserkerFigure({ id }: { id: string }) {
  const palette = COSTUMES.berserker;
  return <g className="keito-costume keito-costume--berserker">
    <path d="M164 68L99 74l40-21-9-22 49 23M237 64l46 29-24-40-31-8" fill="#a54f3c" stroke="#543d31" strokeWidth="3" />
    <g fill={`url(#${id}-stone)`} stroke="#403a2e" strokeWidth="3" strokeLinejoin="round">
      <path d="M166 271l-46-2-49 37-23 55 25 27 65 1 43-44 18-41zM231 271l47-2 46 37 26 55-25 27-65 1-43-44-18-41z" />
      <path d="M74 349l35 10 34-13-5 43-65 10-27-18 2-20zM325 349l-35 10-34-13 4 43 65 10 27-18-2-20z" fill={palette.light} />
    </g>
    <path d="M146 274l49 13 53-13 12 49-43 13-17-25-17 25-43-13z" fill="#9a4a34" stroke="#4e3930" strokeWidth="3" />
    <StoneChest body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
    <g className="keito-stone-fists" stroke="#43392e" strokeWidth="3" strokeLinejoin="round">
      <path d="M71 211l-25 27-12 42 22 37 48-10 20-34-15-52zM331 211l26 27 11 42-21 37-48-10-21-34 16-52z" fill={palette.stone} />
      <path d="M37 270l32-20 43 15 12 34-11 40-44 11-36-24-9-28zM365 270l-32-20-43 15-12 34 11 40 44 11 36-24 9-28z" fill={palette.light} />
      <path d="M32 296l45 15 42-16M45 308l-3 20M61 314l1 24M82 315l2 28M102 307l3 27M369 296l-45 15-42-16M356 308l3 20M340 314l-1 24M319 315l-2 28M299 307l-3 27" fill="none" />
      <path d="M42 258l58 12M38 268l66 13M359 258l-58 12M363 268l-66 13" stroke="#d98b53" strokeWidth="6" />
      <path d="M52 284l13 13-5 10M344 281l-12 17 6 11" stroke="#eaa36d" strokeWidth="2" fill="none" />
    </g>
    <path d="M141 276q58 26 117 0l-3 12q-55 20-112 0z" fill="#d8b76b" />
    <g fill="#5a3026" stroke="#e9bb7d" strokeWidth="2"><circle cx="181" cy="293" r="7" /><circle cx="201" cy="296" r="8" /><circle cx="222" cy="292" r="7" /></g>
    <StoneFace body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
    <path d="M163 68l20-5 39-2 24 6-1 12-27-5-31 2-25 4z" fill="#ba5e42" stroke="#704331" strokeWidth="2" />
    <path d="M188 68l10-1 6 8" stroke="#f6c18b" strokeWidth="2" fill="none" />
  </g>;
}

function AssassinFigure({ id }: { id: string }) {
  const palette = COSTUMES.assassin;
  return <g className="keito-costume keito-costume--assassin" transform="translate(3 3) scale(.94)">
    <path d="M143 110l-40 74-73 107 58-10-64 70 101-28 45-101 67-33-9-76z" fill="#3f354f" stroke="#292d30" strokeWidth="3" />
    <path d="M72 290l34-77 37-47-38 117-43 39" fill="#61566e" opacity=".7" />
    <g transform="translate(9 25) rotate(-7 200 215)">
      <g fill={palette.stone} stroke="#26372f" strokeWidth="3" strokeLinejoin="round">
        <path d="M166 275l-32-5-54 36-30 51 32 16 53-51 47-18zM230 275l40-3 28 43 45 34-5 28-57-20-46-43-30-8z" />
        <path d="M55 344l25 11 16-1-12 29-49 7 1-18zM314 348l25-1 16 23-5 16-60-17-8-17z" fill="#35483c" />
      </g>
      <StoneChest body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
      <path d="M156 270l43 15 48-14 12 44-39 18-21-25-24 20-34-16z" fill="#3c4b3c" stroke="#243a2c" strokeWidth="3" />
      <path d="M73 213l-21 43-9 37 27 18 29-13 15-36-8-38zM328 214l24-3 23 25-4 29-32 7-36-37z" fill={palette.stone} stroke="#263a30" strokeWidth="3" />
      <path d="M46 280l25-1 16 18-2 23-25 11-22-17zM346 240l23 1 14 16-14 18-24-4-11-16z" fill={palette.light} stroke="#263a30" strokeWidth="3" />
      <g className="keito-stone-blades" stroke="#395345" strokeWidth="3" strokeLinejoin="round">
        <path d="M55 315l-8 54 27-45zM366 243l-4-61 26 55z" fill="#d0d6b8" />
        <path d="M47 369l19-44M362 182l14 57" stroke="#8ed48b" strokeWidth="2" />
        <path d="M42 316l37 6M347 246l36-7" stroke="#a7a887" strokeWidth="6" />
      </g>
      <path d="M147 207l18 16 36 14 42-12 17-17-7 22-52 24-44-18z" fill="#6b577d" stroke="#3e354c" strokeWidth="2" />
      <path d="M183 253l17 11 20-12-6 35-13 10-15-13z" fill="#a1ae76" />
      <path d="M148 104l8-48 29-25 45-3 30 33 7 53-23 29-15-13-52 4-25 16-15-17z" fill="#35473d" stroke="#26352d" strokeWidth="3" />
      <StoneFace body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
      <path d="M151 100l16-31 35-20 36 19 16 36-7-48-18-19-40 1-30 24z" fill="#495448" stroke="#273a2f" strokeWidth="3" />
      <path d="M164 124l34 8 39-10-10 22-27 9-26-12z" fill="#526c4b" stroke="#293e31" strokeWidth="2" />
    </g>
  </g>;
}

function OracleFigure({ id }: { id: string }) {
  const palette = COSTUMES.oracle;
  return <g className="keito-costume keito-costume--oracle">
    <g className="keito-stellar-crown" fill="none" stroke="#d6bb72" opacity=".8">
      <circle cx="201" cy="99" r="87" strokeWidth="2" /><path d="M201 8l15 33 35-2-18 30 19 30-35-2-16 32-15-32-35 2 18-30-18-30 35 2z" strokeWidth="1" />
      <path d="M92 72h15M99 65v15M290 123h19M299 114v19M270 26h11M276 20v12" strokeWidth="2" />
    </g>
    <path d="M146 171l-27 55-35 151 51 20 68-12 67 12 49-20-39-151-26-55z" fill="#b7b9a1" stroke="#4c5744" strokeWidth="3" />
    <path d="M146 209l19 91-30 97-51-20 35-151zM254 209l-19 91 35 97 49-20-39-151z" fill="#e1ddc4" />
    <path d="M174 278l29 13 27-13 15 110-42-3-40 3z" fill="#8c957f" />
    <path d="M100 369l33 13 15-12M252 370l18 12 33-13M174 300l-15 66M231 300l15 66" fill="none" stroke="#c4ad6b" strokeWidth="4" />
    <StoneChest body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
    <path d="M145 139l10 14-20 38-7 62-30-12-20-16 7-27 23 12 15-59zM252 139l-10 14 20 38 7 62 30-12 20-16-7-27-23 12-15-59z" fill="#e7e1c6" stroke="#a9955c" strokeWidth="3" />
    <path d="M76 223l-11 33 20 31 31-8 11-29-12-15M301 222l18 13 24 11 6 24-23 15-27-19-14-17" fill={palette.stone} stroke="#44533e" strokeWidth="3" />
    <path d="M70 256l15 17 28-7M318 251l10 17 15-7" fill="none" stroke={palette.light} strokeWidth="5" />
    <g className="keito-sacred-sword" stroke="#a38b4f" strokeWidth="3" strokeLinejoin="round">
      <path d="M333 86l-16 43 8 111h16l9-111z" fill="#eae8ce" />
      <path d="M333 105v133" stroke="#f5d180" strokeWidth="3" />
      <path d="M305 240l28-8 29 8-10 11-19-6-18 6z" fill="#d6b96c" />
      <path d="M329 245v46l5 7 5-7v-46" fill="#7a7755" />
      <path d="M325 310l9-13 9 13-9 14z" fill="#efd798" />
    </g>
    <path d="M148 276l53 13 51-13-2 14-49 15-51-15z" fill="#dec789" stroke="#9e8750" strokeWidth="2" />
    <path d="M201 274l13 16-13 17-13-17z" fill="#eee7be" stroke="#b89b55" strokeWidth="2" />
    <StoneFace body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
    <path d="M164 65l-3-27 21 12 18-27 19 25 22-12-3 29-38-5z" fill="#cbb270" stroke="#8d7b49" strokeWidth="3" />
    <path d="M201 24l3 11 11 4-11 4-3 11-4-11-11-4 11-4z" fill="#fff1b0" />
  </g>;
}

function NecromancerFigure({ id }: { id: string }) {
  const palette = COSTUMES.necromancer;
  return <g className="keito-costume keito-costume--necromancer">
    <path d="M147 104l-29 83-31 78-22 116 52 9 27 14 53-16 62 16 52-18-17-108-17-81-30-98z" fill="#3c405e" stroke="#2a3048" strokeWidth="3" />
    <path d="M120 202l14 79-24 103M273 211l-24 83 31 90" fill="none" stroke="#626388" strokeWidth="14" opacity=".7" />
    <path d="M148 258l-12 132 61-4 65 12-25-140z" fill="#6d6b8e" stroke="#41455e" strokeWidth="3" />
    <path d="M173 305l-10 60M225 306l15 65" stroke="#9e9abb" strokeWidth="2" opacity=".55" />
    <StoneChest body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
    <path d="M151 142l-9 65-22 39-30-21 23-45 5-36zM252 142l9 65 22 39 30-21-23-45-5-36z" fill="#655b85" stroke="#373a57" strokeWidth="3" />
    <path d="M91 222l-21 10-17 30 13 26 26-7 21-31M307 222l22 16 8 37-24 18-24-12-11-31" fill={palette.stone} stroke="#343e55" strokeWidth="3" />
    <g className="keito-soul-staff" stroke="#66668a" strokeWidth="3" strokeLinejoin="round">
      <path d="M57 119l5 262-7 10-6-10 2-262" fill="#5c596d" />
      <path d="M55 130l-27-27 8-35 20-14 24 17 5 32-24 27z" fill="#777a96" />
      <path d="M56 71l15 16-3 17-13 12-14-15 1-18z" fill="#bfc5ef" />
      <path d="M55 78l4 13-6 16-5-14z" fill="#eef0ff" stroke="none" />
      <path d="M43 139l25 5M43 151l25 5M44 336l22 4M44 349l22 4" stroke="#a6a3c5" />
    </g>
    <path d="M300 270l20 1 14-13-5-17-22-4-16 15zM51 254l14-9 17 10-1 17-18 9-16-10z" fill={palette.light} stroke="#41445c" strokeWidth="3" />
    <path d="M142 276l58 14 53-14-4 15-49 14-55-14z" fill="#b2a48b" stroke="#5d5870" strokeWidth="2" />
    <g fill="#d4cae3" stroke="#56526f" strokeWidth="2"><path d="M181 291l8 10-9 13-7-9zM201 296l10 12-11 16-9-15zM222 291l8 12-9 12-7-13z" /></g>
    <path d="M149 111l3-57 19-25 32-8 33 14 19 28 8 51-22 25-65 4z" fill="#49455f" stroke="#30364e" strokeWidth="3" />
    <StoneFace body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
    <path d="M152 101l13-33 38-29 36 30 17 33-6-43-17-24-31-10-29 10-18 22z" fill="#726689" stroke="#4a4563" strokeWidth="3" />
    <path d="M203 30v16M195 39h16" stroke="#c1b4d4" strokeWidth="2" />
    <path d="M284 93q24 5 14 25l-13 15 5-16-9-9zM99 318q-18 6-9 22l10 14-1-17 7-10z" fill="#aaaee1" opacity=".56" />
  </g>;
}

function MachinistFigure({ id }: { id: string }) {
  const palette = COSTUMES.machinist;
  return <g className="keito-costume keito-costume--machinist">
    <g className="keito-back-coils" stroke="#354e54" strokeWidth="3" strokeLinejoin="round">
      <path d="M110 154L70 98 53 104l-8 43 27 45 38 11M291 154l40-56 17 6 8 43-27 45-38 11" fill="#627d80" />
      <path d="M53 107l24 8-25 8 28 10-24 8 31 11-18 10M347 107l-24 8 25 8-28 10 24 8-31 11 18 10" stroke="#9ce1df" fill="none" strokeWidth="5" />
      <path d="M49 98l6-20 20 13-4 13M351 98l-6-20-20 13 4 13" fill="#b2c1ba" />
    </g>
    <g fill={palette.stone} stroke="#2a4550" strokeWidth="3" strokeLinejoin="round">
      <path d="M157 274l-25 4-30 58 3 42 40 9 42-50 8-42zM241 274l25 4 30 58-3 42-40 9-42-50-8-42z" />
      <path d="M103 361l39 4 22 24-20 12-63-5-3-17zM295 361l-39 4-22 24 20 12 63-5 3-17z" fill="#7e9292" />
      <circle cx="139" cy="332" r="20" fill="#3b5d65" /><circle cx="260" cy="332" r="20" fill="#3b5d65" />
      <circle cx="139" cy="332" r="10" fill="#95d8db" /><circle cx="260" cy="332" r="10" fill="#95d8db" />
    </g>
    <StoneChest body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
    <g stroke="#2f4d57" strokeWidth="3" strokeLinejoin="round">
      <path d="M80 143l25-8 27 16-1 36-26 13-31-15zM320 143l-25-8-27 16 1 36 26 13 31-15z" fill="#5e7b83" />
      <path d="M79 149l23-7 22 13-2 25-22 11-22-12zM321 149l-23-7-22 13 2 25 22 11 22-12z" fill="#9aaead" />
      <path d="M62 213l-17 34 3 40 24 25 31-14 15-39-12-40M338 213l17 34-3 40-24 25-31-14-15-39 12-40" fill="#617f88" />
      <path d="M45 275l28-13 35 15 3 36-18 25-40-8-15-25zM355 275l-28-13-35 15-3 36 18 25 40-8 15-25z" fill="#8fa8a8" />
      <path d="M46 290l29 8 33-8M354 290l-29 8-33-8" stroke="#b3e5df" strokeWidth="4" fill="none" />
      <path d="M160 216l17 11 24-10 24 10 18-11-6 30-36 13-34-13z" fill="#3d626d" />
      <path d="M176 232l25 12 25-12M174 270l27 12 25-12" stroke="#a8e3e3" strokeWidth="3" fill="none" />
      <path d="M143 277l57 17 58-17-3 23-55 15-54-15z" fill="#385865" />
      <path d="M182 293l18-10 20 10-4 17-16 10-15-10z" fill="#adc4bb" />
      <path d="M200 290l-6 10h10l-6 12" stroke="#346a77" fill="none" />
    </g>
    <StoneFace body={`url(#${id}-stone)`} light={palette.light} accent={palette.accent} />
    <path d="M157 78l-7 14 6 28 13 5-1-29M245 78l7 14-6 28-13 5 1-29" fill="#587986" stroke="#34515c" strokeWidth="3" />
    <path d="M166 62l13-20 22-9 26 9 11 20-18-6-18 2-21-2z" fill="#92aaa9" stroke="#385863" strokeWidth="3" />
    <path d="M190 47h22M201 39v15M154 97l10 3M238 100l10-3" stroke="#a4eef0" strokeWidth="3" />
    <g fill={palette.accent} fontFamily="'Yu Gothic', sans-serif" fontWeight="900" textAnchor="middle"><text x="101" y="178" fontSize="27">じ</text><text x="299" y="178" fontSize="27">と</text></g>
  </g>;
}

const FIGURES = { berserker: BerserkerFigure, assassin: AssassinFigure, oracle: OracleFigure, necromancer: NecromancerFigure, machinist: MachinistFigure };

export function ClassCharacterArt({ classId, deified = false }: { classId: ClassId; deified?: boolean }) {
  const id = `keito-${useId().replace(/:/g, '')}`;
  const palette = COSTUMES[classId];
  const Figure = FIGURES[classId];
  return <svg className={`character-art rock-deity class-character-art class-character-art--${classId}${deified ? ' is-deified' : ''}`}
    data-character-class={classId} viewBox="0 0 400 430" role="img"
    aria-label={`岩尊けいと・${CLASS_DEFINITIONS[classId].displayName}。${palette.description}。肩にじ、と、胸にじっと教。`}
    xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={`${id}-stone`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={deified ? '#c6b27e' : palette.light} /><stop offset=".5" stopColor={palette.stone} /><stop offset="1" stopColor={palette.shade} /></linearGradient>
      <radialGradient id={`${id}-aura`}><stop stopColor={palette.accent} stopOpacity=".26" /><stop offset="1" stopColor={palette.accent} stopOpacity="0" /></radialGradient>
    </defs>
    {deified && <g className="deity-aura"><ellipse cx="200" cy="211" rx="190" ry="199" fill={`url(#${id}-aura)`} /><circle cx="201" cy="157" r="128" fill="none" stroke="#dfc47d" strokeWidth="2" strokeDasharray="2 22" opacity=".65" /></g>}
    <ellipse cx="201" cy="398" rx="151" ry="19" fill="#10201b" opacity=".32" />
    <path d="M60 391l34-17 77 5 44-7 88 9 36 13-18 14-110 8-130-10z" fill="#3f4c40" />
    <path d="M62 391l107-4 45-6 89 8 34 5-122 12-133-8z" fill="#75816a" opacity=".65" />
    <Figure id={id} />
  </svg>;
}

/** Independent companion artwork; the HUD owns the real HP, actions and lifecycle. */
export function OstyArt({ active = false, className = '' }: { active?: boolean; className?: string }) {
  const id = `osty-${useId().replace(/:/g, '')}`;
  return <svg className={`osty-art${active ? ' is-summoned' : ' is-dormant'} ${className}`}
    viewBox="0 0 200 245" role="img" aria-label={active ? '召喚された岩霊。浮かぶ岩の身体と、魂の灯を持つ護衛' : '未召喚の岩霊。魂の灯が消えた岩の輪郭'} xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id={`${id}-stone`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#afb1c7" /><stop offset=".5" stopColor="#777d9c" /><stop offset="1" stopColor="#454d71" /></linearGradient><radialGradient id={`${id}-soul`}><stop stopColor="#deeaff" /><stop offset=".4" stopColor="#9cb4ed" stopOpacity=".8" /><stop offset="1" stopColor="#8e9be0" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="100" cy="225" rx="66" ry="10" fill="#171d37" opacity=".3" />
    <g className="osty-vector-body" stroke="#404963" strokeWidth="3" strokeLinejoin="round">
      <path d="M57 154l-13 32 13 16 28-4 7-28M143 154l13 32-13 16-28-4-7-28" fill={`url(#${id}-stone)`} />
      <path d="M64 205l17-6 12 14-10 13-25-5zM123 200l18 4 3 18-25 6-11-15z" fill="#7883a4" />
      <path d="M55 95l-24 8-11 32 13 30 29-8 12-33zM145 95l24 8 11 32-13 30-29-8-12-33z" fill={`url(#${id}-stone)`} />
      <path d="M23 148l24-6 15 19-10 24-29-1-10-17zM177 148l-24-6-15 19 10 24 29-1 10-17z" fill="#8c94b0" />
      <path d="M61 91l37-14 39 13 16 45-18 38-33 13-37-15-18-39z" fill={`url(#${id}-stone)`} />
      <path d="M63 99l32 5 6 32-32 16-14-23z" fill="#abb3cb" stroke="none" />
      <path d="M104 104l28-5 13 29-12 24-29-16z" fill="#697798" stroke="none" />
      <path d="M82 143l19-11 21 11-5 23-17 9-16-11z" fill="#4f5c82" />
      <path d="M71 33l27-15 29 13 18 31-10 33-34 17-32-17-14-33z" fill={`url(#${id}-stone)`} />
      <path d="M71 33l27-15 29 13-21 13-39 8z" fill="#bdc0d2" stroke="none" />
      <path d="M70 59l20 7M111 65l19-8" stroke={active ? '#e4e5ff' : '#67728d'} strokeWidth="5" strokeLinecap="round" />
      <path d="M100 59l-6 18 9 4M87 89l14-2 13 1" stroke="#4a5474" fill="none" />
      <path d="M80 32l4 13-6 13M125 76l5 9-9 11M59 117l13 7M134 116l-12 9" fill="none" stroke="#576181" strokeWidth="2" />
    </g>
    {active && <g className="osty-soul-light"><ellipse cx="101" cy="145" rx="27" ry="31" fill={`url(#${id}-soul)`} /><path d="M101 128l9 14-10 20-7-17z" fill="#e3e9ff" /><path d="M20 75l-5-13 9-14 5 14zM173 202l-5-12 7-15 6 13z" fill="#bfc4ed" opacity=".6" /></g>}
  </svg>;
}
