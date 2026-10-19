import { useId } from 'react';
import { RockDeity } from './CharacterArt';
import '../styles/blessing-character-art.css';

export type BlessingCharacterArtId = 'jitto_god' | 'yomi_guide' | 'stone_merchant' | 'star_miko' | 'oblivion_priest' | 'chaos_traveler';

interface BlessingArtProps {
  characterId: string;
  reducedMotion?: boolean;
}

const THEMES: Record<BlessingCharacterArtId, { title: string; description: string; light: string; dark: string; accent: string }> = {
  jitto_god: { title: 'じっと神', description: '黄金に光る目と、肩のじ・と、胸のじっと教。古代神殿の祭壇に鎮座する巨大な岩の神', light: '#c7bc92', dark: '#485344', accent: '#e6c77f' },
  yomi_guide: { title: '黄泉案内人', description: '笠と長衣をまとい、魂の灯を掲げて青紫の霧の道に立つ岩の案内人', light: '#b5b7d0', dark: '#4c536f', accent: '#aeb9f3' },
  stone_merchant: { title: '岩商人', description: '荷物を山積みに背負い、金貨の盆を差し出す丸く大きな岩の商人。市場の天幕と石の看板', light: '#c6b38b', dark: '#66543d', accent: '#edc46d' },
  star_miko: { title: '星巫女', description: '白金の祭服と星冠、長い石の髪、星の杖を持つ巫女。星座と天球儀の輪に囲まれている', light: '#d5d1b5', dark: '#626b65', accent: '#f0dcaa' },
  oblivion_priest: { title: '忘却司祭', description: '顔を覆う仮面とほつれた灰色の祭服。消えかけた石板と文字のかけらを手にする司祭', light: '#b8bcb3', dark: '#515e5b', accent: '#c9d8c5' },
  chaos_traveler: { title: '混沌旅人', description: 'つばの曲がった旅帽と色の違う外套、長いマフラー。虹色の道しるべが漂う岩の旅人', light: '#bbb5aa', dark: '#505461', accent: '#c3b2e3' },
};

function JittoGod({ id }: { id: string }) {
  return <>
    <g className="blessing-temple" fill={`url(#${id}-stone)`} stroke="#766d4e" strokeWidth="2">
      <path d="M79 127h54l9 285H69zM506 127h54l10 285h-75z" />
      <path d="M68 115h77v20H68zM495 115h77v20h-77zM64 409h85v18H64zM491 409h85v18h-85z" fill="#8f8d70" />
      <path d="M88 146v239M104 146v239M121 146v239M514 146v239M531 146v239M548 146v239" stroke="#b6a36c" opacity=".35" />
      <path d="M53 109l60-37 67 28 139-42 140 42 67-28 61 37-53 6-75-4-140-32-139 32-73 4z" fill="#5f6954" />
      <path d="M105 85l215-54 213 54M147 81l172-42 172 42" fill="none" stroke="#b9a16d" strokeWidth="3" />
    </g>
    <g className="blessing-ambient blessing-ambient--orbit" fill="none" stroke="#d5b76b" opacity=".62">
      <circle cx="320" cy="209" r="166" strokeWidth="1" />
      <circle cx="320" cy="209" r="177" strokeWidth="2" strokeDasharray="2 24" />
      <path d="M320 21v21M320 376v21M132 209h21M487 209h21" strokeWidth="3" />
    </g>
    <svg x="130" y="46" width="380" height="410" viewBox="0 0 400 430" className="blessing-familiar-deity" aria-hidden="true"><RockDeity deified /></svg>
    <g className="blessing-stone-altar" stroke="#3c4939" strokeWidth="3" strokeLinejoin="round">
      <path d="M112 437l52-16 315 1 48 18-17 27-382-1z" fill="#7d8368" />
      <path d="M128 465l190 9 192-7-11 27-371-1z" fill="#4e5c45" />
      <path d="M111 494l207 6 194-7 20 13H98z" fill="#657359" />
      <path d="M174 436l126 7M345 443l121-6M315 453l8-5 8 5-8 7z" stroke="#c6ab65" fill="none" strokeWidth="2" />
    </g>
  </>;
}

function YomiGuide({ id }: { id: string }) {
  return <>
    <g fill="none" stroke="#737e9b" strokeWidth="9" opacity=".45"><path d="M149 431V130l37-27h262l35 27v301M135 129h363M167 105l-9-18h315l-8 18" /><path d="M181 105v47M449 105v47" stroke="#b0b5d1" strokeWidth="3" /></g>
    <g className="blessing-fog blessing-ambient" fill={`url(#${id}-mist)`}><ellipse cx="230" cy="401" rx="197" ry="53" /><ellipse cx="453" cy="352" rx="124" ry="38" /></g>
    <path d="M213 466l99-21 91 14-59 26-154-5z" fill="#4b596a" opacity=".7" />
    <g className="blessing-figure" stroke="#384458" strokeWidth="3" strokeLinejoin="round">
      <path d="M273 252l-37 155-18 39 44 15 50-16 49 12 39-16-20-41-33-151z" fill="#585a79" />
      <path d="M267 275l-4 147-23 18M349 276l13 143 19 18" fill="none" stroke="#82839f" strokeWidth="9" />
      <path d="M286 267l26 13 25-12 13 183-37-6-36 9z" fill="#8a8ba5" />
      <path d="M274 205l-34 24-45 78 35 24 51-53M348 205l33 20 24 54-26 25-41-43" fill="#646580" />
      <path d="M196 304l20-9 22 12-8 22-24 6-15-16zM383 276l19-5 16 17-6 20-20 1-17-18z" fill={`url(#${id}-stone)`} />
      <path d="M271 201l18-15 42-2 22 20 3 69-42 24-47-22z" fill="#797c94" />
      <path d="M283 203l30 25 28-27M313 228v69" fill="none" stroke="#c1b6cc" strokeWidth="3" />
      <path d="M276 135l18-19 37 1 19 21 2 35-17 28-28 7-28-21-10-30z" fill={`url(#${id}-stone)`} />
      <path d="M282 147l20 6M320 154l20-6" stroke="#d0d8fa" strokeWidth="4" strokeLinecap="round" />
      <path d="M310 150l-5 22 10 2M293 186l18-3 18 1" stroke="#4e5671" fill="none" />
      <path d="M229 139l79-60 89 60-52 12-36-16-36 16z" fill="#888b9d" />
      <path d="M241 136l67-46 74 46M265 132l43-40 48 41" fill="none" stroke="#c6c0d4" strokeWidth="2" />
      <path d="M391 152l8 285-6 17-6-17-5-285" fill="#6c7391" />
      <path d="M383 161l-21-32 13-32 27-3 19 29-17 37z" fill="#7d839f" />
      <path d="M387 106l17 16-5 22-17 2-9-21z" fill="#c8d0f5" strokeWidth="2" />
      <path d="M390 112l6 15-7 12-5-13z" fill="#f0edff" stroke="none" />
      <path d="M287 323l26 16 24-16M286 368l26 13 26-13" fill="none" stroke="#adb0cc" strokeWidth="2" opacity=".7" />
    </g>
    <g className="blessing-souls blessing-ambient" fill="#bac2ed"><path d="M160 287q-13-20 6-32l13 10-3 19-12 16 4-19zM466 223q-15-21 1-36l16 8-1 18-12 23 2-20zM452 414q-13-20 3-29l13 10-4 20-10 13 3-17z" opacity=".67" /></g>
  </>;
}

function StoneMerchant({ id }: { id: string }) {
  return <>
    <g stroke="#7d6745" strokeWidth="3" strokeLinejoin="round">
      <path d="M115 130l42-54h310l54 54-13 29H128z" fill="#a38b5a" opacity=".7" />
      <path d="M158 78l-13 54 2 24h45l-2-24 7-54M250 78l-2 54 3 24h45l-3-24V78M344 78l8 54v24h44l-3-24-12-54M438 78l21 54v24h44l-5-24-25-54" fill="#596950" />
      <path d="M126 158v263M508 158v263" strokeWidth="9" />
      <path d="M123 164h-29v56h60v-56z" fill="#676e55" /><path d="M101 179h44M102 201h39" stroke="#cfbb7a" strokeWidth="2" />
      <path d="M475 176l34 1 11 23-11 24-34-1-10-23z" fill="#d7b269" /><path d="M493 186v28M482 199h22" stroke="#f2d697" strokeWidth="2" />
    </g>
    <g className="blessing-figure" stroke="#4a4c37" strokeWidth="3" strokeLinejoin="round">
      <path d="M206 173l-43 28-5 151 51 17 43-28-5-145z" fill="#6f7252" />
      <path d="M176 216l61 17M173 258l67 15M174 302l66 12M204 176l-6 184" fill="none" stroke="#b49a63" strokeWidth="7" />
      <path d="M170 178l18-37 38 3 13 39-20 15zM159 168l-21-22 4-22 32-8 16 28z" fill="#999879" />
      <path d="M265 375l-35 51 10 25 62-5 19-34M353 374l35 52-10 25-62-5-17-34" fill={`url(#${id}-stone)`} />
      <path d="M230 431l28 8 36-5-4 22-58 4-13-14M388 431l-28 8-36-5 4 22 58 4 13-14" fill="#a3a084" />
      <path d="M245 236l31-25 70-1 41 32 18 89-26 66-63 25-70-29-25-60z" fill="#9a8864" />
      <path d="M244 248l37-22 24 43-2 114-51-11-19-44z" fill="#b4a379" /><path d="M347 225l39 25 9 78-19 45-45 13-4-117z" fill="#7b7456" />
      <path d="M247 296l71 11 77-12-2 21-76 14-72-15z" fill="#5b654a" />
      <path d="M307 301l16 1 8 12-15 16-14-16z" fill="#e2bb6a" />
      <path d="M237 250l-30 25-12 47 26 25 30-13 22-50M380 251l30 19 27 42-20 26-29-12-30-49" fill={`url(#${id}-stone)`} />
      <path d="M268 130l31-20 40 5 25 25 7 44-20 35-40 11-36-20-15-38z" fill={`url(#${id}-stone)`} />
      <path d="M272 141l29-19 35 4-3 23-41 8z" fill="#c4b38d" stroke="none" />
      <path d="M282 167l18 1M325 168l20-2" stroke="#e9c778" strokeWidth="5" strokeLinecap="round" />
      <path d="M313 162l-8 24 14 3M289 201l23 8 29-11" stroke="#5c6047" fill="none" />
      <path d="M269 143l12-28 31-13 29 10 23 30-33-9-29 2z" fill="#617052" />
      <path d="M309 108l11 14-11 14-10-14z" fill="#dfbf75" stroke="#a88c51" strokeWidth="2" />
      <path d="M213 320l207-1 24 12-14 21H207l-14-19z" fill="#b5a26e" />
      <path d="M218 329h202" stroke="#e1c887" strokeWidth="3" />
    </g>
    <g className="blessing-gold" fill="#dfb864" stroke="#a08446" strokeWidth="2">
      <ellipse cx="261" cy="312" rx="23" ry="7" /><path d="M238 299v13q23 14 46 0v-13" /><ellipse cx="261" cy="299" rx="23" ry="7" />
      <ellipse cx="315" cy="310" rx="22" ry="7" /><path d="M293 285v25q22 14 44 0v-25" /><ellipse cx="315" cy="285" rx="22" ry="7" />
      <ellipse cx="369" cy="313" rx="23" ry="7" /><path d="M346 300v13q23 14 46 0v-13" /><ellipse cx="369" cy="300" rx="23" ry="7" />
      <path d="M250 297h20M305 283h20M359 298h20" stroke="#ffe1a0" />
    </g>
    <path className="blessing-spark blessing-ambient" d="M438 240l4 12 12 4-12 4-4 12-4-12-12-4 12-4zM191 382l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#efcf83" />
  </>;
}

function StarMiko({ id }: { id: string }) {
  return <>
    <g className="blessing-sky-wheel blessing-ambient--orbit blessing-ambient" fill="none" stroke="#d7c89b" opacity=".56"><circle cx="320" cy="242" r="163" strokeWidth="2" /><ellipse cx="320" cy="242" rx="163" ry="65" transform="rotate(-29 320 242)" /><ellipse cx="320" cy="242" rx="70" ry="163" transform="rotate(-29 320 242)" /><path d="M320 66v24M320 393v24M145 242h26M469 242h26" strokeWidth="3" /></g>
    <g fill="#e0d6ac" stroke="#a89b75" strokeWidth="2"><path d="M178 113l4 14 14 4-14 4-4 14-4-14-14-4 14-4zM471 315l4 13 13 4-13 4-4 13-4-13-13-4 13-4z" /><circle cx="427" cy="116" r="4" /><circle cx="149" cy="308" r="3" /><path d="M178 131l56 29M427 116l37 78-21 40" fill="none" opacity=".45" /></g>
    <g className="blessing-figure" stroke="#5b6658" strokeWidth="3" strokeLinejoin="round">
      <path d="M270 138l14-30 34-17 33 17 14 32 7 146-35 24-64-16-15-52z" fill="#657a76" />
      <path d="M278 157l-10 94 23 46-14-120M351 155l13 96-18 46 7-118" fill="none" stroke="#9da795" strokeWidth="5" />
      <path d="M278 263l-28 161-28 33 96-10 97 10-28-33-29-161z" fill="#dedcc4" />
      <path d="M281 282l-14 147-27 18M354 282l14 148 28 17" fill="none" stroke="#b8a46e" strokeWidth="4" />
      <path d="M301 295l18 13 18-13 10 153-29-1-28 1z" fill="#ab9470" />
      <path d="M278 220l-31 1-51 75 18 42 70-40M358 220l31 1 51 75-18 42-70-40" fill="#e4dfc8" />
      <path d="M199 301l17 22 55-34M437 301l-17 22-55-34" stroke="#c1a870" fill="none" strokeWidth="5" />
      <path d="M274 216l17-17 50 1 22 19-13 70-30 24-36-23z" fill="#c8c9ae" />
      <path d="M285 214l34 35 31-34M319 249v60" fill="none" stroke="#a28a56" strokeWidth="4" />
      <path d="M284 139l12-18 30-5 24 18 3 33-18 31-20 7-23-15-12-28z" fill={`url(#${id}-stone)`} />
      <path d="M291 147l13-3M328 144l15 3" stroke="#485c55" strokeWidth="4" strokeLinecap="round" />
      <path d="M294 153l8 2M331 155l8-2" stroke="#eadeae" strokeWidth="3" />
      <path d="M317 150l-5 21 9 2M306 186l12-2 13 1" fill="none" stroke="#667669" strokeWidth="2" />
      <path d="M279 144l19-35 27-12 23 16 11 30-26-18-17 7-17-6z" fill="#85968a" />
      <path d="M284 126l-1-22 19 10 17-25 17 25 20-11-5 23-30-9z" fill="#d8c58f" stroke="#ab965d" strokeWidth="2" />
      <path d="M319 89l3 9 10 3-10 3-3 10-3-10-10-3 10-3z" fill="#fff0b5" stroke="none" />
      <path d="M418 164v251" stroke="#c3ad76" strokeWidth="7" />
      <path d="M418 120l10 20 23 3-17 16 4 23-20-11-21 11 4-23-17-16 24-3z" fill="#e4d4a0" stroke="#ac965e" />
      <path d="M408 272l17-3 12 15-9 16-18-3-7-13zM240 283l16-9 15 13-6 18-18 1-13-12z" fill={`url(#${id}-stone)`} />
      <path d="M296 327l23 11 22-11M294 381l25 10 24-10" stroke="#e9dcba" strokeWidth="2" fill="none" />
    </g>
    <ellipse cx="320" cy="462" rx="117" ry="13" fill="#aaa884" opacity=".2" />
  </>;
}

function OblivionPriest({ id }: { id: string }) {
  return <>
    <g className="blessing-forgotten-tablets" stroke="#66746c" strokeWidth="3" fill="#4a5c52" opacity=".48"><path d="M149 137l44-14 37 20-8 93-36 20-42-22zM425 169l29-18 35 9 15 89-38 26-39-20z" /><path d="M161 161h46M168 179h32M172 198h24M444 187h32M446 207h36M451 228h24" stroke="#aebca5" strokeWidth="2" /></g>
    <g className="blessing-glyphs blessing-ambient" fill="none" stroke="#b0bfae" strokeWidth="3" opacity=".6"><path d="M191 96v27M181 102h20M183 117l9 7 9-7M439 113h27v11h-13v15M145 320h27v16h-14v14M462 329v28M450 342h25" /></g>
    <g className="blessing-figure" stroke="#3e514a" strokeWidth="3" strokeLinejoin="round">
      <path d="M273 236l-22 121-25 68 35 14-1 24 34-20 23 13 20-18 32 15-4-22 36-15-23-66-17-114z" fill="#66756c" />
      <path d="M281 267l-14 109-20 49M349 266l8 111 23 40" stroke="#9da99a" strokeWidth="7" fill="none" opacity=".65" />
      <path d="M290 296l26 12 27-13-12 143-17 16-20-13z" fill="#8f9a8c" />
      <path d="M276 209l-30 13-39 76 27 30 50-52M351 209l28 11 44 74-26 27-50-45" fill="#929e8c" />
      <path d="M273 212l14-19 52-1 19 21-12 74-31 29-36-28z" fill="#77877b" />
      <path d="M287 208l28 29 29-29M315 237v75" stroke="#b4bca5" strokeWidth="4" fill="none" />
      <path d="M273 151l11-40 28-24 36 22 18 45-14 48-72 4z" fill="#566960" />
      <path d="M290 134l24-11 24 13 9 33-16 31-21 7-21-17-7-30z" fill={`url(#${id}-stone)`} />
      <path d="M284 150l30-14 29 15-6 30-23 22-24-23z" fill="#b4beb0" stroke="#6e7f72" strokeWidth="2" />
      <path d="M302 158l10-2M322 156l9 2M314 163v14M307 187h15" stroke="#5f7467" strokeWidth="3" fill="none" />
      <path d="M273 151l18-22 24-22 28 23 20 25-12-41-36-27-30 23z" fill="#8a9889" />
      <path d="M210 289l19-2 13 16-6 21-23-5-12-16M399 286l19 1 12 20-12 16-23-7-6-17" fill={`url(#${id}-stone)`} />
      <path d="M249 277l18-12 24 12-5 43-30 7-20-23z" fill="#a1ad9a" />
      <path d="M247 287h28M249 301h19M255 316h9" stroke="#5c7464" strokeWidth="3" />
      <path d="M341 274l25-9 22 17-4 36-28 10-15-24z" fill="#8d9d8a" />
      <path d="M352 284l18-3M351 298h21M359 313h9" stroke="#c2cbb3" strokeWidth="2" />
    </g>
    <g className="blessing-vanishing-fragments blessing-ambient" fill="#9faf9c" stroke="#536c5c" strokeWidth="2"><path d="M383 370l13-5 10 14-12 12-12-8zM408 406l13-1 4 13-17 6zM220 394l-11-7-12 9 3 17 16-2zM232 445l-12-1-4 14 14 6z" /><path d="M430 388l9-4 7 9-6 9-11-3zM187 430l-10-4-6 10 8 8z" opacity=".4" /></g>
    <ellipse cx="315" cy="463" rx="118" ry="12" fill="#acb9a4" opacity=".12" />
  </>;
}

function ChaosTraveler({ id }: { id: string }) {
  return <>
    <g className="blessing-chaos-signs blessing-ambient" fill="none" strokeWidth="3" opacity=".66">
      <path d="M141 154l32-21 25 31-29 23zM460 300l26-13 23 18-18 23-25-6z" stroke="#a8d0ba" />
      <path d="M455 135l6-19 17 17-11 21zM159 334l-12 18 12 17 15-17z" stroke="#d2bbdf" />
      <circle cx="437" cy="212" r="15" stroke="#dac78f" /><path d="M193 238l10-11 16 12-9 18z" stroke="#acb9df" />
      <path d="M234 92l19 8-7 17-19-7zM443 397l19-6 9 16-21 10z" stroke="#d6b9a0" />
    </g>
    <g className="blessing-figure" stroke="#444b50" strokeWidth="3" strokeLinejoin="round">
      <path d="M277 277l-24 124-37 38 21 20 49-23 34-96M328 282l26 65 21 91 31 10 8-22-21-106-31-49" fill={`url(#${id}-stone)`} />
      <path d="M220 433l19 9 25-11-1 25-37 15-23-19M375 425l22 5 17-8 16 28-17 14-43-16z" fill="#9aa49b" />
      <path d="M275 192l-30 25-32 101 65-25 34 27 24-30 67 15-35-97-37-22z" fill="#77718c" />
      <path d="M245 219l-18 77 50-24 34 29-6-92z" fill="#7b9c90" />
      <path d="M314 208l23 78 48 7-26-77-27-17z" fill="#ab9376" />
      <path d="M268 200l32 30-14 25 29 13 16-32-10-33" fill="#adb5a0" />
      <path d="M245 233l-31 8-28 56 17 20 28-12 32-40M366 229l30 16 24 40-24 20-26-33-16-22" fill={`url(#${id}-stone)`} />
      <path d="M192 296l18-5 16 15-4 18-22 3-14-16M399 283l18-2 13 15-7 19-21-4-13-13" fill="#aeb1a1" />
      <path d="M276 122l27-18 32 8 20 27-3 35-21 28-30 4-28-22-7-32z" fill={`url(#${id}-stone)`} />
      <path d="M278 131l24-15 28 8-8 18-34 3z" fill="#c6bdab" stroke="none" />
      <path d="M281 156l17 2M321 158l16-4" stroke="#d9c9e6" strokeWidth="4" strokeLinecap="round" />
      <path d="M310 151l-8 25 11 2M290 188l22 5 20-10" fill="none" stroke="#596566" />
      <path d="M245 132l32-17 9-47 37-15 35 66 38 20-43 7-53-13-30 9z" fill="#77738b" />
      <path d="M278 115l22-9 40 7 10 19-51-13-24 8z" fill="#b5a47d" />
      <path d="M302 81l12 12 11-6-3-12z" fill="#c6c5a6" strokeWidth="2" />
      <path d="M279 190l32 16 30-17-3 20-27 17-35-13z" fill="#8d719d" />
      <path className="blessing-scarf" d="M335 200l45 9 57-21-20 29 21 4-66 12-44-20z" fill="#a48baf" />
      <path d="M406 166l5 266" stroke="#8d998a" strokeWidth="8" />
      <path d="M405 138l21 14-10 27-23-8z" fill="#b0c4b1" /><path d="M405 146l10 10-7 13-9-8z" fill="#e1ceb0" strokeWidth="2" />
      <path d="M289 268l21 13 24-9M237 306l16-2M370 304l13 4" stroke="#d2bb9e" strokeWidth="2" fill="none" />
    </g>
    <g fill="#bfb4ce" opacity=".38"><ellipse cx="273" cy="465" rx="112" ry="13" /><path d="M185 448l20-15 10 19-22 7zM433 446l19-9 14 18-26 5z" /></g>
  </>;
}

const FIGURES = { jitto_god: JittoGod, yomi_guide: YomiGuide, stone_merchant: StoneMerchant, star_miko: StarMiko, oblivion_priest: OblivionPriest, chaos_traveler: ChaosTraveler };

/** Replaceable art boundary: no choices, RNG, rewards or save state live in this component. */
export function BlessingCharacterArt({ characterId, reducedMotion = false }: BlessingArtProps) {
  const resolvedId: BlessingCharacterArtId = Object.hasOwn(FIGURES, characterId) ? characterId as BlessingCharacterArtId : 'jitto_god';
  const theme = THEMES[resolvedId];
  const Figure = FIGURES[resolvedId];
  const id = `blessing-${useId().replace(/:/g, '')}`;
  return <svg className={`blessing-character-art blessing-character-art--${resolvedId}${reducedMotion ? ' is-still' : ''}`}
    data-character-id={resolvedId} data-art-id={resolvedId} viewBox="0 0 640 520" role="img"
    aria-label={`${theme.title}。${theme.description}。`} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={`${id}-stone`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={theme.light} /><stop offset="1" stopColor={theme.dark} /></linearGradient>
      <radialGradient id={`${id}-aura`}><stop stopColor={theme.accent} stopOpacity=".18" /><stop offset="1" stopColor={theme.accent} stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}-mist`}><stop stopColor={theme.accent} stopOpacity=".23" /><stop offset="1" stopColor={theme.accent} stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse className="blessing-scene-aura" cx="320" cy="267" rx="285" ry="242" fill={`url(#${id}-aura)`} />
    <ellipse cx="320" cy="472" rx="205" ry="24" fill="#12221b" opacity=".28" />
    <Figure id={id} />
  </svg>;
}
