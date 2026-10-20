import type { CSSProperties, ReactNode } from 'react';
import { RELIC_DEFINITIONS, type RelicDefinition } from '../data/relics';
import '../styles/relic-icons.css';

export type RelicMotif = 'blood' | 'ring' | 'crown' | 'soul' | 'core' | 'flame' | 'shield'
  | 'fist' | 'book' | 'bell' | 'hourglass' | 'mask' | 'cup' | 'eye' | 'vial' | 'knife'
  | 'star' | 'lantern' | 'cage' | 'coin' | 'feather' | 'sword' | 'scroll' | 'fruit'
  | 'anchor' | 'pearl' | 'dice' | 'wing' | 'stone' | 'flower' | 'disc' | 'horn'
  | 'nunchaku' | 'cannon' | 'bull' | 'icecream' | 'candle' | 'cape' | 'clamp'
  | 'tile' | 'tail' | 'bread' | 'ticket' | 'pillow' | 'fish' | 'hat' | 'egg'
  | 'mirror' | 'waffle' | 'scissors' | 'steam' | 'box' | 'claw' | 'whistle'
  | 'hammer' | 'mushroom' | 'cheese' | 'amulet' | 'rod' | 'twins' | 'skull'
  | 'gorget' | 'kusarigama';

const MOTIFS: Record<RelicMotif, ReactNode> = {
  blood: <><path d="M24 9c-2 8-11 12-11 20a11 11 0 0 0 22 0c0-8-9-12-11-20Z" /><path d="M19 27c-2 5 1 8 5 8m-8-17-4-3m20 3 4-3" /></>,
  ring: <><ellipse cx="24" cy="28" rx="13" ry="10" /><ellipse cx="24" cy="28" rx="8" ry="6" /><path d="m17 16 7-8 7 8-7 6Z" /><path d="m17 16 7 1 7-1M24 8v14" /></>,
  crown: <><path d="m10 16 8 5 6-12 6 12 8-5-4 20H14Z" /><path d="M14 31h20m-16-4h1m10 0h1" /><circle cx="24" cy="25" r="2" /></>,
  soul: <><path d="m14 18 10-7 10 7-3 20H17Z" /><path d="M12 19h24M19 24l5-2 5 2-2 8h-6Z" /><path d="M24 22c-9-7 4-11 0-18 10 10-1 12 0 18Z" /></>,
  core: <><path d="m24 8 14 8v16l-14 8-14-8V16Z" /><path d="m24 14 9 5v10l-9 5-9-5V19Z" /><path d="m24 17-4 9h6l-2 6 7-11h-6l1-4M10 16l5 3m18 10 5 3" /></>,
  flame: <><path d="M25 8c3 11-9 12-5 21 1-4 5-5 6-8 12 10 11 20-2 20-12 0-17-12-11-20 0 7 4 5 4 2-2-8 5-10 8-15Z" /><path d="M24 29c-6 5-4 9 0 9 5 0 5-5 0-9Z" /></>,
  shield: <><path d="m24 8 14 6-2 15c-2 5-7 9-12 12-5-3-10-7-12-12l-2-15Z" /><path d="m24 14 8 4-1 10-7 7-7-7-1-10Z" /><path d="m20 24 3 3 6-7" /></>,
  fist: <><path d="m12 28-1-9 5-3 3 6V11h6v11-12h6v13-9h5v15l-7 10H17l-5-8Z" /><path d="m14 27 9-2 4 5-6 4m4-12h11M18 38v-5" /></>,
  book: <><path d="M10 13c6-3 10-3 14 0 4-3 8-3 14 0v23c-6-3-10-3-14 0-4-3-8-3-14 0Z" /><path d="M24 13v23M14 18l6 1m-6 4 6 1m-6 4 6 1m8-10 6-1m-6 6 6-1m-6 6 6-1" /></>,
  bell: <><path d="M13 32c4-5 0-17 11-17s7 12 11 17ZM10 33h28M20 37c2 3 6 3 8 0M20 13a4 4 0 0 1 8 0" /><path d="m8 20-3 3m35-3 3 3M16 25v4" /></>,
  hourglass: <><path d="M13 10h22M13 38h22M16 11c0 10 4 9 8 13-4 4-8 3-8 13m16-26c0 10-4 9-8 13 4 4 8 3 8 13" /><path d="m18 15 6 8 6-8ZM18 35l6-8 6 8Z" /></>,
  mask: <><path d="m24 8 14 8-4 19-10 6-10-6-4-19Z" /><path d="m15 21 6 2-2 4-5-2Zm18 0-6 2 2 4 5-2ZM21 34h6M24 13l-2 5 5 12-3 5" /></>,
  cup: <><path d="M13 11h22v14c0 7-22 7-22 0ZM35 15h5v8l-5 4M24 31v7M17 39h14M13 16h22" /><path d="M19 5v3m10-3v3M17 23l14-3" /></>,
  eye: <><path d="M6 24c11-18 25-18 36 0-11 18-25 18-36 0Z" /><circle cx="24" cy="24" r="8" /><path d="m24 18 3 6-3 6-3-6ZM24 7V3M11 12l-3-3m29 3 3-3" /></>,
  vial: <><path d="M19 9h10v9l8 14c4 12-30 12-26 0l8-14ZM17 9h14M17 27h14" /><path d="m15 32 18-1m-16 5 13-1M21 4h6" /><circle cx="24" cy="23" r="1" /></>,
  knife: <><path d="m32 7 3 14-14 14-8-8ZM12 24l12 12M11 30l-5 5 7 7 5-5M20 27l12-13" /><path d="m9 12 5-2m-2 6-6 1m28 14 5-1" /></>,
  star: <><path d="m24 7 5 11 12 1-9 9 3 12-11-6-11 6 3-12-9-9 12-1Z" /><path d="m24 16 3 8-3 6-3-6ZM8 7l2 3m28-3-2 3" /></>,
  lantern: <><path d="m17 13 7-6 7 6M12 15h24M15 16l-2 18 11 7 11-7-2-18M13 34h22M24 17v18" /><path d="m24 23-5 7 5 5 5-5Z" /></>,
  cage: <><path d="M12 35V23c0-19 24-19 24 0v12ZM9 39h30M10 35h28M24 6V2M18 35V23c0-16 12-16 12 0v12M24 13v22" /><path d="M12 24h24" /></>,
  coin: <><ellipse cx="24" cy="24" rx="15" ry="16" /><ellipse cx="24" cy="24" rx="11" ry="12" /><path d="m24 15 6 9-6 9-6-9ZM35 9l4 5m-4 25 4-5" /></>,
  feather: <><path d="M35 7C15 5 9 17 14 30c13 5 25-1 21-23ZM10 39l20-25M15 32l-1-9m5 4 9-2m-4-4v-7" /></>,
  sword: <><path d="m24 5 6 8-2 19h-8l-2-19ZM14 31h20M21 32v8h6v-8M24 10v18M18 44h12" /></>,
  scroll: <><path d="M13 12h20v23H15V13c0-7-10-7-10 0v4h8m20 7h8v9c0 7-12 7-12 0" /><path d="M19 16h9m-9 6h9m-9 6h6" /></>,
  fruit: <><path d="M24 17C8 7 4 30 18 39c4 3 6-1 9 0 14 3 20-29 3-24Z" /><path d="M24 18c-2-11 5-12 9-12-1 7-6 9-9 8m0 3-5-9M15 23c-2 6 0 8 2 10" /></>,
  anchor: <><circle cx="24" cy="11" r="5" /><path d="M24 16v25M16 23h16M6 29c1 15 35 15 36 0M5 29l8 1-7 5m37-6-8 1 7 5" /></>,
  pearl: <><path d="M8 30c3-10 29-10 32 0l-7 10H15Z" /><circle cx="24" cy="23" r="10" /><path d="M18 20c0-3 3-5 6-5M13 35l8-3m14 3-8-3M24 5v3m-11 3 2 2m20-2-2 2" /></>,
  dice: <><path d="m24 7 15 9v17l-15 9-15-9V16ZM9 16l15 8 15-8M24 24v18" /><circle cx="24" cy="16" r="1.5" /><path d="m15 24 2 1m-2 5 2 1m14-2 2-1m-2 6 2-1" /></>,
  wing: <><path d="M24 36C8 38 6 25 8 9l12 9 4 13 4-13 12-9c2 16 0 29-16 27Z" /><path d="m11 16 6 8-6-2 8 8-5-1 7 5m16-18-6 8 6-2-8 8 5-1-7 5M24 31v10" /></>,
  stone: <><path d="m17 10 15 3 7 17-11 10-17-5-4-15Z" /><path d="m17 10 3 13-9 12m9-12 12-10m-12 10 8 17m-8-17 19 7" /><path d="m14 19 3 1m10 10 4 2" /></>,
  flower: <><path d="M24 26v14m0-6-8-4-3 4 11 5m0-10 8-5 4 4-12 8" /><path d="M24 11c-7-12-17 3-8 7-14 1-6 16 2 10 0 14 16 10 13 0 11 5 15-10 5-12 5-10-10-15-12-5Z" /><circle cx="24" cy="21" r="5" /></>,
  disc: <><circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="5" /><circle cx="24" cy="24" r="1" /><path d="m15 13 5 6m8 10 5 6m-21-8 6-1m12-5 6-1M24 8v4m0 24v4" /></>,
  horn: <><path d="M11 34C10 21 19 7 38 8c-12 4-14 13-11 20l-6 10Z" /><path d="m13 25 11 6M18 17l8 5M25 12l4 3m-18 19 10 4" /></>,
  nunchaku: <><path d="m9 25 7 1-2 17-7-1Zm23-20 7 2-4 17-7-2Z" /><path d="M13 25v-6c-1-7 14-13 20-4m-5-5-2 5m-6-2-1 5M9 31l6 1m16-18 6 2" /></>,
  cannon: <><path d="m10 20 25-9 5 15-26 8ZM34 11l6 15m-28-1 24-7M15 35h19" /><circle cx="17" cy="37" r="4" /><circle cx="33" cy="37" r="4" /><path d="m12 21-2-5 3-2M40 9l4-3m-3 10 5-1" /></>,
  bull: <><path d="m11 21 8-4h15l6 7-2 10H14l-3-9-6-1 1-8 7-1 4 6m-1 13v6m18-6v6" /><path d="M6 16 4 10l7 3m21 5 3-4 5 7M20 22v7h9v-7Z" /><circle cx="10" cy="20" r=".7" /></>,
  icecream: <><path d="m15 23 18 0-9 20ZM13 23c-8-8 5-10 7-13 5-9 8 1 8 3 10-2 15 8 7 10Z" /><path d="m17 28 11 6m-6-11 7 5m-13 5 12-7m-9 13 9-8M21 7l2-3" /></>,
  candle: <><path d="M20 18h8v21h-8ZM13 39h22M24 17c-8-3-4-9 0-13 4 7 6 10 0 13ZM20 23l4 3 4-3M11 28v6m26-6v6M9 25c0-6 4-8 4-1ZM35 25c0-6 4-8 4-1Z" /><path d="M11 34h9m8 0h9" /></>,
  cape: <><path d="m17 9 7 3 7-3 9 29-13-3-3 6-3-6-13 3Z" /><path d="M17 9c0 12 14 12 14 0M17 20l-4 12m18-12 4 12M24 15v15" /><circle cx="24" cy="18" r="2" /></>,
  clamp: <><path d="M12 11h21v8H20v15h13v7H12Z" /><path d="M31 23v14M26 23h12M26 38h12M8 15h4m-4 6h4m-4 6h4m-4 6h4" /></>,
  tile: <><path d="M12 7h24v34H12ZM16 11h16v26H16Z" /><path d="M20 16h8m-8 5h8m-8 5h8M20 31h2m4 0h2M12 7l4 4m20 30-4-4" /></>,
  tail: <><path d="M37 11c-21-3-32 19-18 27 13 7 27-11 15-17-8-4-16 7-7 9-1-5 3-6 5-3 4 7-8 11-14 4-5-9 5-17 19-20Z" /><path d="m14 22 5 3m8 12-1-5M22 17l2 4" /></>,
  bread: <><path d="M11 34C1 17 17 6 23 12c9-7 26 7 13 22v6H11Z" /><path d="M12 34h24M18 19l-3 9m10-11-3 11m10-8-3 9" /></>,
  ticket: <><path d="M8 13h32v8c-8 0-8 8 0 8v7H8v-7c8 0 8-8 0-8Z" /><path d="M17 17v3m0 4v3m0 4v1M23 19h11m-11 6h7m-7 6h11" /></>,
  pillow: <><path d="M10 10c9 4 19 4 28 0-3 9-3 19 0 28-9-4-19-4-28 0 3-9 3-19 0-28Z" /><path d="m14 17 3-2m14 1 3 3m-20 12 3 2m14 0 3-3M20 21l4-2 4 2v6l-4 2-4-2Z" /></>,
  fish: <><path d="M12 24c10-19 22-15 29 0-7 15-19 19-29 0ZM12 24l-7-9v18Z" /><path d="M24 14c8 8 8 12 0 20M20 24h4m-9-4 4 2m-4 6 4-2" /><circle cx="34" cy="22" r="1.3" /></>,
  hat: <><path d="m14 32 2-22h16l2 22M6 35c0-8 36-8 36 0s-36 8-36 0Z" /><path d="M15 25h18M20 14h2" /></>,
  egg: <><path d="M24 8c-7 0-16 16-14 23 3 13 25 13 28 0C40 24 31 8 24 8Z" /><path d="m13 27 6-5 5 5 5-4 8 5M21 12l-4 6m13 15 3-3" /></>,
  mirror: <><ellipse cx="24" cy="21" rx="12" ry="15" /><ellipse cx="24" cy="21" rx="8" ry="11" /><path d="M21 36v7h6v-7m-8-21 6-3m-7 9 10-6M17 43h14" /></>,
  waffle: <><path d="M12 10h24v29H12ZM17 10v29m7-29v29m7-29v29M12 16h24m-24 8h24m-24 8h24" /><path d="m21 18 7 5-5 5-6-4Z" /></>,
  scissors: <><circle cx="13" cy="35" r="6" /><circle cx="32" cy="35" r="6" /><path d="m17 30 17-23c3 15-9 22-12 24m6-1L12 7c-3 15 8 22 11 24" /><circle cx="23" cy="25" r="1" /></>,
  steam: <><path d="M12 25h24v14H12ZM16 25v-5h16v5M12 34h24M20 16c-6-4 6-7 0-12m9 12c-6-4 6-7 0-12" /><circle cx="24" cy="30" r="2" /></>,
  box: <><path d="m24 8 16 9-16 9-16-9Zm-16 9v17l16 9 16-9V17M24 26v17" /><path d="m16 13 16 9v15M15 27l4 2m10 4 6-3" /></>,
  claw: <><path d="M13 38c-8-11-8-20 1-31-2 11-1 18 5 24l2-23 6-2 1 24c6-5 8-13 7-22 8 15 5 25-6 32Z" /><path d="m13 37 3-9m13 11-1-9" /></>,
  whistle: <><path d="M9 15h29v8H27c7 17-18 23-20 8-1-5 4-8 6-8H9Z" /><circle cx="17" cy="29" r="5" /><path d="M29 15v8M11 39l-5 4m35-32 4-3m-3 11h5" /></>,
  hammer: <><path d="m9 10 5-4 24 11-5 10-24-10Zm14 11-10 20 5 3 11-21M11 8l-3 9m24-3-4 10" /></>,
  mushroom: <><path d="M5 25C8 4 40 4 43 25ZM20 25l-3 15c4 3 10 3 14 0l-3-15" /><circle cx="15" cy="19" r="2" /><circle cx="25" cy="13" r="2" /><circle cx="34" cy="20" r="2" /></>,
  cheese: <><path d="m8 28 26-17 7 25-33 4ZM8 28l33 8M34 11l-2 19" /><circle cx="24" cy="26" r="3" /><path d="m14 28 3-2m14 9v3M36 21l-2 2" /></>,
  amulet: <><path d="M12 6c-3 11 1 13 12 16C35 19 39 17 36 6M24 22l10 9-10 13-10-13Z" /><path d="m24 26 5 5-5 7-5-7ZM15 14l3-5m12 0 3 5" /></>,
  rod: <><path d="M11 43 31 9l3 2-20 34M31 9c9-5 11 5 9 11l-3 13m-3 0c-4 7 5 10 5 3" /><path d="m14 36 4 2m-7 3 4 2M26 17l7-5" /></>,
  twins: <><path d="m6 16 8-7 9 7-2 17-7 5-7-5Zm19-4 9-7 9 7-2 17-7 5-7-5Z" /><path d="m10 21 3 2m5-2-3 2m14-6 3 2m7-2-3 2M10 29l4 3 4-3m12-4 4 3 4-3" /></>,
  skull: <><path d="M24 7C6 7 5 29 14 31v9h20v-9C43 29 42 7 24 7Z" /><path d="m13 21 7 2-2 6-5-2Zm22 0-7 2 2 6 5-2ZM24 26l-3 7h6M20 40v-5m8 5v-5" /></>,
  gorget: <><path d="M15 9c1 10 17 10 18 0l4 15 6 4-5 11-14 4-14-4-5-11 6-4Z" /><path d="M15 9c4-4 14-4 18 0M12 24c5 12 19 12 24 0M10 30l8 5m20-5-8 5M20 20v9m8-9v9" /><circle cx="24" cy="35" r="2" /></>,
  kusarigama: <><path d="M29 8c12-3 15 10 9 17-1-7-5-8-11-6M29 8l-9 26 5 2 7-22M17 33l11 4" /><path d="M22 37c0 5-5 7-8 4" /><ellipse cx="12" cy="38" rx="3" ry="5" transform="rotate(-28 12 38)" /><ellipse cx="8" cy="30" rx="3" ry="5" transform="rotate(-28 8 30)" /><path d="m5 22 4-4 6 4-4 5Z" /></>,
};

const motifRules: [RegExp, RelicMotif][] = [
  [/ゴルゲット|gorget/i, 'gorget'], [/鎖鎌|kusarigama/i, 'kusarigama'],
  [/霊箱|phylactery/i, 'soul'],
  [/クラッカー|cracker|bread|パン$|肉|flesh|cookie|クッキー/i, 'bread'], [/ダミー|dummy|struggle/i, 'fist'],
  [/フラワー|flower|若葉|sapling/i, 'flower'], [/ウロコ|scales|ヴァンプレイス|vambrace/i, 'shield'],
  [/スカル|skull/i, 'skull'], [/ディスク|disk|capacitor|コンデンサ/i, 'disc'], [/角|horn/i, 'horn'],
  [/ヌンチャク|nunchaku/i, 'nunchaku'], [/大砲|cannon/i, 'cannon'], [/赤べこ|akabeko/i, 'bull'],
  [/ティンシャ|tingsha/i, 'bell'], [/アイスクリーム|ice_cream/i, 'icecream'], [/クナイ|kunai/i, 'knife'],
  [/シャンデリア|chandelier/i, 'candle'], [/マント|ケープ|肩布|cloak|cape|veil/i, 'cape'],
  [/クランプ|clamp|calipers/i, 'clamp'], [/兵法|art_of_war/i, 'book'], [/暦|牌|calendar|tile/i, 'tile'],
  [/遺灰|ashes|フラゴン|flask/i, 'vial'], [/タングステン|tungsten/i, 'hammer'], [/しっぽ|tail/i, 'tail'],
  [/イチゴ|strawberry|ポマンダー|pomander/i, 'fruit'], [/お食事券|ticket/i, 'ticket'], [/ティーセット|tea_set/i, 'cup'],
  [/枕|pillow/i, 'pillow'], [/化粧|paint/i, 'mask'], [/魚|fish/i, 'fish'], [/山高帽|hat/i, 'hat'],
  [/卵|egg/i, 'egg'], [/鏡|mirror/i, 'mirror'], [/ワッフル|waffle/i, 'waffle'], [/苦悶|lament|wisp|ウィスプ|ectoplasm|エクトプラズム/i, 'soul'],
  [/カキ|oyster/i, 'pearl'], [/鋏|ハサミ|scissors/i, 'scissors'], [/加湿|humidifier/i, 'steam'], [/城|castle/i, 'crown'],
  [/箱|box/i, 'box'], [/かぎ爪|claw/i, 'claw'], [/ホイッスル|whistle/i, 'whistle'], [/アストロラーベ|astrolabe/i, 'star'],
  [/タリスマン|talisman|護符|amulet/i, 'amulet'], [/釣り竿|fishing_rod/i, 'rod'], [/ウォーハンマー|warhammer/i, 'hammer'],
  [/キノコ|mushroom/i, 'mushroom'], [/チーズ|cheese/i, 'cheese'], [/ビン・ボン|bin_bon/i, 'twins'],
  [/ブラッド|血|blood/i, 'blood'], [/指輪|リング|指先|ring|finger/i, 'ring'],
  [/王権|天命|王冠|crown|royal/i, 'crown'], [/霊箱|魂|soul|phylactery/i, 'soul'],
  [/コア|核|core/i, 'core'], [/火|炎|灯火|燭|flame|ember|spark|torch/i, 'flame'],
  [/盾|門|守|ブロック|shield|gate|guard/i, 'shield'], [/拳|腕|筋|knuckle|bracelet|fist/i, 'fist'],
  [/書|帳|しおり|book|ledger|bookmark/i, 'book'], [/鈴|鐘|bell/i, 'bell'],
  [/砂時計|刻|hourglass|clock/i, 'hourglass'], [/面|仮面|mask/i, 'mask'],
  [/杯|椀|茶|杓|匙|cup|ladle|spoon/i, 'cup'], [/目|眼|レンズ|eye|lens/i, 'eye'],
  [/瓶|壺|薬|vial|bottle|potion/i, 'vial'], [/刃|砥石|研|knife|blade|whetstone/i, 'knife'],
  [/星|天体|star|prism/i, 'star'], [/灯籠|ランタン|lantern/i, 'lantern'], [/籠|cage/i, 'cage'],
  [/金|貨|銭|coin|gold|purse/i, 'coin'], [/羽|ペン|feather|pen|quill/i, 'feather'],
  [/剣|刀|sword/i, 'sword'], [/巻|筆|scroll|chalk/i, 'scroll'], [/果|梨|桃|マンゴー|fruit|pear|mango/i, 'fruit'],
  [/錨|anchor/i, 'anchor'], [/真珠|貝|pearl|shell/i, 'pearl'], [/賽|サイコロ|dice/i, 'dice'],
  [/翼|wing/i, 'wing'],
];

function idHash(id: string) {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function getRelicMotif(relic: RelicDefinition): RelicMotif {
  const iconKey = (relic as RelicDefinition & { iconKey?: string }).iconKey;
  if (iconKey && Object.hasOwn(MOTIFS, iconKey)) return iconKey as RelicMotif;
  const matched = motifRules.find(([pattern]) => pattern.test(`${relic.name} ${relic.id}`));
  if (matched) return matched[1];
  const kind = relic.effect?.kind;
  return kind === 'heal' ? 'blood' : kind === 'strength' ? 'fist' : kind === 'draw' ? 'book'
    : kind === 'block' ? 'shield' : kind === 'stars' ? 'star' : kind === 'summon' ? 'soul'
      : kind === 'knife' ? 'knife' : kind === 'frost' ? 'core' : kind === 'enemyPoison' ? 'vial' : 'stone';
}

/** Motifs follow names/effects; each stable ID also receives its own carved border rune. */
export function RelicIcon({ id, size = 36, decorated = true, active = false, acquired = false, label, className = '' }: {
  id: string;
  size?: number;
  decorated?: boolean;
  active?: boolean;
  acquired?: boolean;
  label?: string;
  className?: string;
}) {
  const relic = RELIC_DEFINITIONS[id];
  if (!relic) return null;
  const metadata = relic as RelicDefinition & { rarity?: string; acquisition?: string };
  const rarity = metadata.rarity ?? 'common';
  const acquisition = metadata.acquisition ?? 'normal';
  const motif = getRelicMotif(relic);
  const rune = idHash(id);
  return <span className={`relic-emblem${decorated ? ' is-decorated' : ''}${active ? ' is-active' : ''}${acquired ? ' is-acquired' : ''} ${className}`.trim()}
    data-relic-id={id} data-relic-rarity={rarity} data-relic-acquisition={acquisition} data-relic-class={relic.classId ?? 'all'} data-relic-upgraded={relic.upgradeFrom ? 'true' : undefined}
    style={{ '--relic-size': `${size}px` } as CSSProperties} role={label ? 'img' : undefined}
    aria-label={label} aria-hidden={label ? undefined : true}>
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" data-relic-motif={motif}>
      {decorated && <><path className="relic-emblem-frame" d="m14 3 28 0 11 11v28L42 53H14L3 42V14Z" /><path className="relic-emblem-inset" d="M15 6h26l9 9v26l-9 9H15l-9-9V15Z" />
        {Array.from({ length: 16 }, (_, bit) => <path className="relic-id-rune" key={bit} d={['M25 4h3', 'M25 3v3m3-3v1', 'M25 3v1m3-1v3', 'M25 3v3m3-3v3'][(rune >>> (bit * 2)) & 3]} transform={`rotate(${bit * 22.5} 28 28)`} />)}</>}
      <g transform="translate(4 4)" className="relic-emblem-art">{MOTIFS[motif]}</g>
      {relic.classId && <path className="relic-class-mark" d="m28 46 3 4-3 4-3-4Z" />}
      {relic.upgradeFrom && <path className="relic-upgrade-mark" d="m17 7 3-3 3 3m10 0 3-3 3 3M12 46h4m24 0h4" />}
      {(acquisition === 'ancient' || rarity === 'ancient') && <path className="relic-ancient-mark" d="M20 2h16M28 0v4m-8 50h16M28 52v4" />}
      {(acquisition === 'event' || rarity === 'event') && <path className="relic-event-mark" d="m2 23 3 5-3 5m52-10-3 5 3 5" />}
    </svg>
  </span>;
}

export function RelicBadge({ id, small = false, active = false, acquired = false }: {
  id: string; small?: boolean; active?: boolean; acquired?: boolean;
}) {
  const relic = RELIC_DEFINITIONS[id];
  if (!relic) return null;
  return <span className={`run-relic-badge relic-badge${small ? ' is-small' : ''}`} title={`${relic.name}：${relic.description}`} tabIndex={0}>
    <RelicIcon id={id} size={small ? 29 : 38} active={active} acquired={acquired} />
    {!small && <b>{relic.name}</b>}
    <span className="run-item-tooltip"><b>{relic.name}</b>{relic.description}</span>
  </span>;
}
