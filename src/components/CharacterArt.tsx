import { useId } from 'react';

/** Original, self-contained vector artwork for the combat prototype. */
export function RockDeity({ deified = false }: { deified?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={`character-art rock-deity${deified ? ' is-deified' : ''}`}
      viewBox="0 0 400 430"
      role="img"
      aria-label="岩尊けいと。肩にじ、と、胸にじっと教と刻まれた筋肉質な岩の巨人"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={deified ? '#a7976b' : '#8a8980'} />
          <stop offset=".5" stopColor={deified ? '#696044' : '#5d625b'} />
          <stop offset="1" stopColor="#303a35" />
        </linearGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor={deified ? '#d6bf7b' : '#adb0a0'} />
          <stop offset="1" stopColor={deified ? '#8f7b4c' : '#757b70'} />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f2d98c" />
          <stop offset="1" stopColor="#ad7938" />
        </linearGradient>
        <radialGradient id={`${id}-aura`}>
          <stop stopColor="#eac564" stopOpacity=".3" />
          <stop offset="1" stopColor="#eac564" stopOpacity="0" />
        </radialGradient>
      </defs>

      {deified && (
        <g className="deity-aura">
          <ellipse cx="202" cy="211" rx="182" ry="187" fill={`url(#${id}-aura)`} />
          <circle
            cx="201"
            cy="157"
            r="119"
            fill="none"
            stroke="#dbb95f"
            strokeWidth="1"
            opacity=".55"
          />
          <circle
            cx="201"
            cy="157"
            r="128"
            fill="none"
            stroke="#dbb95f"
            strokeWidth="3"
            strokeDasharray="2 22"
            opacity=".65"
          />
          <path
            d="M201 15v27M201 272v27M59 157h28M315 157h28M101 57l19 19M283 239l20 20M100 257l20-20M284 75l19-19"
            stroke="#eac66b"
            strokeWidth="2"
          />
        </g>
      )}

      {/* Weight and chips on the plinth make the figure sit in the scene. */}
      <ellipse cx="202" cy="396" rx="154" ry="20" fill="#151e1a" opacity=".28" />
      <path d="M54 389l20-17 84-2 39 7 74-11 53 10 23 17-14 13H76z" fill="#343c35" />
      <path d="M54 389l95-8 50 7 83-12 65 17-116 8-118-1z" fill="#62675a" />
      <path d="M76 406l10-9 111 4 31-2 105-6-5 12-123 13z" fill="#272f29" />
      <path
        d="M32 378l17-9 12 13-12 7zM348 377l15-3 9 14-22 2zM81 416l18-5 12 10-26 2z"
        fill="#677063"
      />

      {/* Bent legs. */}
      <path
        d="M173 271l-47-4-54 37-21 47 17 32 73 10 46-44 23-49z"
        fill={`url(#${id}-body)`}
        stroke="#323d35"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M125 281l-47 30-14 39 43 8 48-32 28-38z" fill={`url(#${id}-light)`} />
      <path d="M78 311l22 5 29-20 25 5-45 40-45 9z" fill="#a0a48f" opacity=".45" />
      <path d="M105 358l36 35 46-44-9-40-23 17z" fill="#444e41" />
      <path
        d="M226 273l48-3 47 36 26 49-17 28-74 10-44-44-20-48z"
        fill={`url(#${id}-body)`}
        stroke="#323d35"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M274 283l42 29 17 40-44 7-45-34-27-35z" fill="#747d6b" />
      <path d="M290 359l-34 34-44-44 9-38 23 14z" fill="#3b473b" />
      <path
        d="M148 352l22-10 20 13-10 24-21 8-24-12z"
        fill="#878e79"
        stroke="#424e3f"
        strokeWidth="2"
      />
      <path
        d="M253 350l-20-9-21 13 9 25 21 8 24-12z"
        fill="#6f7b67"
        stroke="#354433"
        strokeWidth="2"
      />
      <path
        d="M141 371l14-5M151 381l14-6M261 371l-14-5M251 381l-14-6"
        stroke="#414d3e"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M128 298l-8 22 10 13M282 301l6 20-12 11M97 369l9 10 13-3"
        fill="none"
        stroke="#485644"
        strokeWidth="2"
      />

      {/* Shoulders and arms, built from separate angular stone slabs. */}
      <path
        d="M154 144l-46-15-35 20-20 42 15 40 41 5 48-38z"
        fill={`url(#${id}-body)`}
        stroke="#354137"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M108 129l-35 20-12 27 43 12 46-19 4-25z" fill={`url(#${id}-light)`} />
      <path d="M61 176l7 55 41 5 9-28-14-20z" fill="#4c594a" />
      <path
        d="M249 144l45-15 35 20 20 42-15 40-41 5-48-38z"
        fill={`url(#${id}-body)`}
        stroke="#354137"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M294 129l35 20 12 27-43 12-46-19-3-25z" fill="#858d78" />
      <path d="M341 176l-7 55-41 5-9-28 14-20z" fill="#3f4d3f" />
      <path
        d="M68 219l-15 18-11 51 17 27 38-5 21-34-9-46z"
        fill={`url(#${id}-body)`}
        stroke="#354137"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M53 237l-11 51 17 8 25-20 5-41z" fill="#8b927c" />
      <path
        d="M334 219l15 18 11 51-17 27-38-5-21-34 9-46z"
        fill={`url(#${id}-body)`}
        stroke="#354137"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M349 237l11 51-17 8-25-20-5-41z" fill="#687660" />
      <path
        d="M58 287l-11 18 1 27 20 13 43-11 3-21-19-20z"
        fill="#7e8870"
        stroke="#364733"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M344 287l11 18-1 27-20 13-43-11-3-21 19-20z"
        fill="#65765c"
        stroke="#364733"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M51 310l22 8 35-7M64 320l-2 14M78 322l-1 13M92 319l1 13M351 310l-22 8-35-7M338 320l2 14M324 322l1 13M310 319l-1 13"
        fill="none"
        stroke="#42543d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M59 272l10-23 6 7-3 12M329 252l7 12-3 13"
        fill="none"
        stroke="#d5b66d"
        strokeWidth="2"
        opacity=".55"
      />

      {/* Torso: broad chest tapering into stacked abdominal rocks. */}
      <path
        d="M154 142l29-13 37-1 30 15 36 41-16 65-26 44-41 18-43-18-28-46-14-64z"
        fill={`url(#${id}-body)`}
        stroke="#344335"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M154 148l39 8 6 45-24 16-43-17 6-28z" fill={`url(#${id}-light)`} />
      <path d="M246 148l-39 8-5 45 24 16 42-17-6-28z" fill="#828b74" />
      <path d="M154 148l-16 24 38-5 17-11z" fill="#b6b79c" opacity=".55" />
      <path d="M246 148l16 24-38-5-17-11z" fill="#9a9f81" opacity=".5" />
      <path d="M136 203l36 19 25-13-1 29-24 7-28-14z" fill="#505f4b" />
      <path d="M265 203l-36 19-25-13 1 29 24 7 28-14z" fill="#485843" />
      <path d="M174 245l24-4v28l-22 6-20-18zM204 241l23 4 18 12-20 18-21-6z" fill="#758169" />
      <path d="M178 279l21-6 1 23-14 6-15-12zM204 273l20 6 6 11-15 12-12-6z" fill="#64735b" />
      <path d="M200 158v39M199 216v18M200 247v19" stroke="#2e3e2f" strokeWidth="3" />
      <path
        d="M145 181l11 7-4 12M252 178l-8 10 3 10M173 246l10 5"
        fill="none"
        stroke="#c5a45b"
        strokeWidth="2"
        opacity=".7"
      />

      {/* Carved lettering, gold inlaid into the ancient stone. */}
      <g
        fill={`url(#${id}-gold)`}
        fontFamily="'Yu Mincho', 'Hiragino Mincho ProN', serif"
        fontWeight="900"
        textAnchor="middle"
      >
        <text x="102" y="176" fontSize="30" transform="rotate(-11 102 164)">
          じ
        </text>
        <text x="301" y="176" fontSize="30" transform="rotate(11 301 164)">
          と
        </text>
        <text x="201" y="196" fontSize="23" letterSpacing="1">
          じっと教
        </text>
      </g>

      {/* Neck, craggy face, and a deliberately solemn expression. */}
      <path d="M178 113l-1 27 23 17 24-18-2-27z" fill="#65725d" stroke="#344333" strokeWidth="3" />
      <path
        d="M162 68l18-22 43-2 22 18 9 37-16 34-35 14-33-15-16-35z"
        fill={`url(#${id}-body)`}
        stroke="#314131"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M162 68l18-22 43-2-2 25-34 8z" fill="#a7ab92" />
      <path d="M223 44l22 18 9 37-16-7-17-23z" fill="#6f7a62" />
      <path d="M162 68l25 9-8 25-18 8-7-13z" fill="#8d987d" />
      <path d="M179 102l15-15 10 2 9-2 25 5 3 24-14 15-24 8-25-14z" fill="#6c7b61" />
      <path d="M166 83l23 1 9 10-29-1zM207 94l10-11 25-4-5 14z" fill="#2c3e2d" />
      <path
        d="M172 89l16 1M218 89l17-2"
        stroke={deified ? '#fff1b5' : '#e8c16c'}
        strokeWidth={deified ? '5' : '3'}
        strokeLinecap="round"
      />
      <path d="M201 88l-7 20 12 3 6-5z" fill="#a0a38a" />
      <path
        d="M185 120l15-3 18 1M191 126l21-1"
        fill="none"
        stroke="#344734"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M178 50l7 13-3 10M226 109l7 7-6 11" fill="none" stroke="#485d43" strokeWidth="2" />
      <path d="M185 49l17-9 20 5-6 9-17-3z" fill="#bdc0a3" />
      <path d="M196 54l6 9-4 10" fill="none" stroke="#d6ba71" strokeWidth="2" />

      {/* A tiny sacred cord softens the imposing rock silhouette. */}
      <path
        d="M139 199l15 16 27 10 21 3 22-4 26-11 15-16"
        fill="none"
        stroke="#b19556"
        strokeWidth="3"
      />
      <path
        d="M190 226l12-8 12 8-3 16-9 8-10-8z"
        fill={`url(#${id}-gold)`}
        stroke="#685c39"
        strokeWidth="2"
      />
      <path d="M202 225v17M197 232h10" stroke="#6b633e" strokeWidth="2" />
    </svg>
  );
}

export function StoneSentinel({ hurt = false }: { hurt?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={`character-art stone-sentinel${hurt ? ' is-hurt' : ''}`}
      viewBox="0 0 400 430"
      role="img"
      aria-label="黄金のひとつ目を持ち、苔に覆われた古代の岩の番人"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}-stone`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#8e8b72" />
          <stop offset=".45" stopColor="#636f59" />
          <stop offset="1" stopColor="#384d3f" />
        </linearGradient>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="1" y2=".8">
          <stop stopColor="#a09c7d" />
          <stop offset="1" stopColor="#5d6b51" />
        </linearGradient>
        <linearGradient id={`${id}-eye`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff3b7" />
          <stop offset=".5" stopColor="#e6bb54" />
          <stop offset="1" stopColor="#9d6e2c" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor="#efd17c" stopOpacity=".6" />
          <stop offset="1" stopColor="#efd17c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="210" cy="397" rx="123" ry="17" fill="#13201a" opacity=".3" />
      <path
        d="M77 378l22-9 16 12-9 15-26-4zM317 379l19-8 12 12-8 12-25-5zM179 412l18-4 12 8-26 7z"
        fill="#526149"
      />
      <g className="sentinel-rubble">
        <path d="M60 199l14-12 14 7 2 22-18 7-13-10z" fill="#7c8268" />
        <path d="M66 199l10-7 12 2-13 10z" fill="#b3af87" />
        <path d="M327 139l12-10 19 12-2 16-18 6-13-10z" fill="#627454" />
        <path d="M327 139l12-10 19 12-21 5z" fill="#999d75" />
        <path d="M344 267l13-7 12 11-6 16-16-4zM57 301l13-5 8 13-9 12-14-8z" fill="#69795b" />
        <path d="M94 83l9-12 13 4 2 15-16 5z" fill="#859071" />
      </g>

      {/* Two monumental legs, uneven from centuries in the ruins. */}
      <path
        d="M150 274l47 5 4 53-10 40-7 21-42 4-19-19 8-51z"
        fill={`url(#${id}-stone)`}
        stroke="#344a38"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M150 284l23 9-3 40-28 9-11-15z" fill="#939778" />
      <path d="M142 342l29-9 20 8-7 43-42 13-19-19z" fill="#596e50" />
      <path
        d="M218 279l45-7 20 53-1 51-19 21-42-5-7-21-6-39z"
        fill={`url(#${id}-stone)`}
        stroke="#344a38"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M244 289l19-7 14 42-16 18-22-8z" fill="#7f8a68" />
      <path d="M221 343l18-9 22 8 21 34-19 21-42-5z" fill="#465f44" />
      <path
        d="M131 373l24 6 28-9 7 21-15 13-43-3-14-12z"
        fill="#798667"
        stroke="#354f37"
        strokeWidth="3"
      />
      <path
        d="M219 370l26 10 28-7 14 16-16 13-42 2-15-13z"
        fill="#607a57"
        stroke="#354f37"
        strokeWidth="3"
      />
      <path
        d="M137 389l4 12M151 390v11M252 392v11M267 389l-1 12"
        stroke="#3e563c"
        strokeWidth="3"
      />

      {/* Main body and the tall broken headstone silhouette. */}
      <path
        d="M135 149l40-17 63 2 43 24 10 74-28 58-57 20-56-22-28-61z"
        fill={`url(#${id}-stone)`}
        stroke="#344a38"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M140 158l36-15 26 20-5 111-38-11-27-41z" fill="#7e8869" />
      <path d="M207 165l29-20 38 21 6 57-24 40-48 16z" fill="#546b4f" />
      <path d="M162 266l37 11 11-1 44-13-6 21-42 14-38-16z" fill="#364e38" />
      <path
        d="M176 57l35-12 39 13 19 37-12 60-45 26-44-22-15-56z"
        fill={`url(#${id}-stone)`}
        stroke="#354b38"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M176 57l35-12 39 13-16 20-35 4-28-6z" fill="#b0ab86" />
      <path d="M171 76l28 6 7 43-17 35-21-1-15-56z" fill="#899474" />
      <path d="M234 78l16-20 19 37-12 60-24-8-13-25z" fill="#566e50" />
      <path
        d="M188 100l22-15 31 18 4 23-31 28-29-20z"
        fill="#293f30"
        stroke="#969c6e"
        strokeWidth="3"
      />
      <ellipse cx="215" cy="118" rx="43" ry="43" fill={`url(#${id}-glow)`} />
      <path d="M214 97l17 20-17 22-15-21z" fill={`url(#${id}-eye)`} />
      <path d="M214 104l5 14-5 14-4-14z" fill="#fff4c8" />
      <path d="M183 143l19 12M226 157l16-14" stroke="#bea761" strokeWidth="2" opacity=".65" />
      <path
        d="M208 50l-9 17 6 14M251 80l-11 13M169 117l8 9-4 15"
        fill="none"
        stroke="#455d3e"
        strokeWidth="3"
      />

      {/* Arm behind the shield, with a loose, suspended stone fist. */}
      <path
        d="M263 158l31-4 23 21 5 37-21 18-25-7-9-30z"
        fill={`url(#${id}-stone)`}
        stroke="#324c36"
        strokeWidth="3"
      />
      <path d="M294 154l23 21-17 15-29-13-8-19z" fill="#8b9773" />
      <path
        d="M300 231l23-9 17 18 4 36-16 18-29-7-12-26z"
        fill={`url(#${id}-stone)`}
        stroke="#324c36"
        strokeWidth="3"
      />
      <path d="M323 222l17 18-21 11-19-20z" fill="#9ba17a" />
      <path
        d="M308 294l24 3 15 18-6 25-22 11-24-9-8-26z"
        fill="#718764"
        stroke="#324c36"
        strokeWidth="3"
      />
      <path
        d="M294 315l24 6 27-7M307 323l-3 17M320 324l1 24M332 321l2 21"
        fill="none"
        stroke="#3d5c3e"
        strokeWidth="3"
      />

      {/* The worn shield is part of its arm, not equipped metal. */}
      <path
        d="M128 164l-27 1-25 25-4 53 18 23 37-12 26-55z"
        fill="#697c5c"
        stroke="#344d37"
        strokeWidth="3"
      />
      <path
        d="M115 177l38 8 23 62-13 68-46 31-43-39-6-66 21-55z"
        fill={`url(#${id}-plate)`}
        stroke="#344c36"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M115 177l-2 28-14 31-11 63-14 8-6-66 21-55z" fill="#b0ae86" />
      <path d="M115 177l38 8 23 62-20-7-22-35-21 0z" fill="#8e9872" />
      <path d="M88 299l29 26 27-17 12-68 20 7-13 68-46 31-43-39z" fill="#4a6648" />
      <path
        d="M115 210l27 10 14 29-11 52-28 24-28-26 8-57z"
        fill="none"
        stroke="#c2b47a"
        strokeWidth="2"
        opacity=".52"
      />
      <path d="M118 235l16 19-17 29-15-20z" fill="#3b583c" />
      <path d="M117 242l8 13-8 17-7-10z" fill="#b2a767" />
      <path d="M116 285v15M103 289l14 12 15-13" fill="none" stroke="#baa770" strokeWidth="3" />
      <path
        d="M141 193l-5 21 8 15M77 267l15 10-2 13M153 290l-12 6 3 12"
        fill="none"
        stroke="#455f3d"
        strokeWidth="3"
      />

      {/* Moss follows crevices instead of reading as flat green paint. */}
      <g fill="#688046">
        <path d="M177 56l8-7 10 2 4 9-12 6-15-1-7 11-7-3 7-14z" />
        <path d="M228 52l10-2 9 7 5 13-9 8-5-9-12-2z" />
        <path d="M266 155l17-6 15 5 6 12-11 4-8-5-11 3-7-5z" />
        <path d="M85 185l15-6 7 5-5 12-8 4-1 14-10 2-5-11z" />
        <path d="M147 274l15-4 11 8 12-1 5 10-14 7-11-5-12 5-8-10z" />
        <path d="M248 340l15-4 10 5 2 12-12 5-13-6-9 6-5-7z" />
      </g>
      <g fill="#91a268" opacity=".8">
        <path d="M177 56l9-3 8 4-9 5-10 1zM237 55l6 4 3 8-7 2-5-8zM276 155l11-2 8 6-9 3zM86 188l11-4 4 4-8 8-8 3zM151 278l9-3 11 7-13 3zM251 343l11-3 8 4-9 6z" />
      </g>
      {/* Etched glyphs and tiny rock fractures give scale. */}
      <g fill="none" stroke="#b5a975" strokeWidth="2" opacity=".55">
        <path d="M211 184v20M203 189h16M204 202l7 7 8-7M221 223l11-7 8 7-8 8zM217 238h16v11h-10v9" />
        <path d="M152 305l8 9-4 12M251 302v13h12M293 191l6 9-4 8" />
      </g>
      {hurt && (
        <g fill="none" stroke="#efc77a" strokeWidth="3" className="sentinel-cracks">
          <path d="M237 79l-10 18 8 12-9 15M231 185l-11 18 8 14-13 17M151 225l-12 17 4 15" />
        </g>
      )}
    </svg>
  );
}
