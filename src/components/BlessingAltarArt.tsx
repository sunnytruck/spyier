/** Original stone reliefs used only by the blessing confirmation ritual. */
export function BlessingAltarFace() {
  return <svg className="ritual-altar-face" viewBox="0 0 220 154" aria-hidden="true">
    <g className="ritual-altar-halo" fill="none" stroke="currentColor">
      <path d="M41 130a79 79 0 1 1 138 0" opacity=".35" />
      <path d="M29 123a90 90 0 1 1 162 0" strokeDasharray="2 12" opacity=".6" />
      <path d="M110 0v15M28 38l12 9M192 38l-12 9M12 93h16m164 0h16" strokeWidth="2" />
    </g>
    <path d="m71 38 32-16 40 8 27 35-9 51-36 30-40-13-26-36Z" fill="#343e34" stroke="#988b60" strokeWidth="2" />
    <path d="m72 39 30-12 40 7 22 32-12 45-29 26-35-11-24-32Z" fill="#a3a58a" />
    <path d="m102 27 4 32-29 14-13 21 7-55Zm40 7-20 27 26 19 16-14ZM88 126l23-24 41 9-29 26Z" fill="#69765f" />
    <path d="m106 59 16 2-8 20 10 13-24-1Z" fill="#c6c4a2" />
    <path d="m72 73 30-6-3 15-24 1Zm53-6 29 5-3 11-24-1Z" fill="#293c32" />
    <path className="ritual-altar-eyes" d="m78 75 18-3-1 5-17 1Zm52-3 18 3-1 3-17-1Z" fill="#f5e5a4" />
    <path d="m96 106 27-2 13 4M99 116h25" fill="none" stroke="#354735" strokeWidth="4" strokeLinecap="round" />
    <path d="m105 30-9 12 9 8-3 12m47 26-8 11 5 8M81 101l-5 9 9 12" fill="none" stroke="#626d50" strokeWidth="2" />
    <path d="m110 5 4 8-4 8-4-8Z" fill="currentColor" />
  </svg>;
}

export function BlessingAltarStone() {
  return <svg className="ritual-altar-slab" viewBox="0 0 1000 850" preserveAspectRatio="none" aria-hidden="true">
    <path d="m87 31 132 8 116-25 164 11 164-9 115 26 129-12 60 68-14 197 12 175-16 248-81 89-168-12-100 22-194-10-175 9-174-23-75-91 12-208-17-184Z" fill="#101b17" opacity=".98" />
    <path d="m87 31 132 8 116-25 164 11 164-9 115 26 129-12 60 68-20 9-50-58-122 11-112-24-162 8-166-11-115 25-126-8-51 70-18-14Z" fill="#74785b" opacity=".7" />
    <path d="m34 638 25 61 172 37 174-9 194 10 100-22 168 12 81-89 1 80-81 89-168-12-100 22-194-10-175 9-174-23-75-91Z" fill="#344033" />
    <path d="m74 710 164 31 169-8 190 11 110-24 153 13 65-62M107 53l113 8 115-25m328 2 113 26 118-11" fill="none" stroke="#c9ac65" strokeWidth="2" opacity=".5" />
    <path d="m87 32 39 53-20 44 25 19m777-118-32 47 8 23-24 33M952 471l-42 31 12 29-32 21M61 480l31 42-9 23 26 43M228 795l18-48-14-33m467 81-14-31 15-18" fill="none" stroke="#73734f" strokeWidth="2" opacity=".6" />
    <path d="m44 638 15 61 172 37 174-9 194 10 100-22 168 12 81-89" fill="none" stroke="#8b8c63" strokeWidth="2" opacity=".5" />
  </svg>;
}

export function BlessingAltarPedestal() {
  return <svg className="ritual-altar-pedestal" viewBox="0 0 760 110" preserveAspectRatio="none" aria-hidden="true">
    <path d="m45 12 117-9 210 10 224-9 119 8 37 32-32 49-136 5-202-8-207 9-136-10L8 43Z" fill="#4b5741" />
    <path d="m45 12 117-9 210 10 224-9 119 8 37 32-33 6-123-14-224 10-210-10L8 43Z" fill="#81886a" />
    <path d="m31 63 133 14 208-9 223 8 135-12M84 23l80 7m431-6 77 4" fill="none" stroke="#cbb675" strokeWidth="2" opacity=".7" />
    <path d="m164 4 13 27-15 14 17 23m418-63-20 22 11 15-8 31" fill="none" stroke="#374533" strokeWidth="3" />
  </svg>;
}
