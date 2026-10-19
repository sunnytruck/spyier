import type { Actor, EnemyDefinition, EnemyIntent } from '../types/game';

export const DEFAULT_ENEMY_ID = 'restless_guardian';

export const ENEMY_DEFINITION: Actor = {
  id: DEFAULT_ENEMY_ID,
  name: 'そわそわの番人',
  hp: 86,
  maxHp: 86,
  block: 0,
  strength: 0,
  weak: 0,
  vulnerable: 0,
  poison: 0,
};

/** Intent damage is a base per hit: the shared damage calculator adds statuses. */
export const ENEMY_INTENTS: EnemyIntent[] = [
  {
    kind: 'attack',
    label: 'そわそわパンチ',
    description: '基礎12ダメージの攻撃。筋力・弱体で変化する。',
    damage: 12,
    hits: 1,
  },
  {
    kind: 'attack',
    label: 'うきき連打',
    description: '基礎6ダメージを2回与える。筋力・弱体で変化する。',
    damage: 6,
    hits: 2,
  },
  {
    kind: 'buff',
    label: '落ち着かない瞑想',
    description: '8ブロックを得て、筋力を2増やす。',
    block: 8,
    strength: 2,
  },
];

function enemy(id: string, name: string, hp: number, intents: EnemyIntent[]): EnemyDefinition {
  return {
    id,
    name,
    hp,
    maxHp: hp,
    block: 0,
    strength: 0,
    weak: 0,
    vulnerable: 0,
    poison: 0,
    intents,
  };
}

/** Add enemies as data here; IDs remain stable because saves reference them. */
export const ENEMY_DEFINITIONS: Record<string, EnemyDefinition> = {
  [DEFAULT_ENEMY_ID]: { ...ENEMY_DEFINITION, intents: ENEMY_INTENTS },
  grit_scout: enemy('grit_scout', '砂利の見張り', 28, [
    { kind: 'attack', label: '小石投げ', description: '基礎5ダメージ。', damage: 5, hits: 1 },
    { kind: 'defend', label: '砂袋を積む', description: '7ブロックを得る。', block: 7 },
    { kind: 'attack', label: '砂利崩し', description: '基礎8ダメージ。', damage: 8, hits: 1 },
  ]),
  candle_moth: enemy('candle_moth', '灯籠の石蛾', 24, [
    { kind: 'attack', label: '灯火の体当たり', description: '基礎4ダメージ。', damage: 4, hits: 1 },
    { kind: 'debuff', label: '眠りの粉', description: 'プレイヤーに弱体1。', weak: 1 },
    { kind: 'attack', label: '羽音二連', description: '基礎3ダメージを2回。', damage: 3, hits: 2 },
  ]),
  quarry_crab: enemy('quarry_crab', '採石ガニ', 38, [
    { kind: 'attack', label: '石ばさみ', description: '基礎9ダメージ。', damage: 9, hits: 1 },
    { kind: 'defend', label: '甲羅磨き', description: '10ブロックを得る。', block: 10 },
    { kind: 'attack', label: '両ばさみ', description: '基礎5ダメージを2回。', damage: 5, hits: 2 },
  ]),
  sleepless_monk: enemy('sleepless_monk', '夜更かし石僧', 42, [
    { kind: 'attack', label: '寝ぼけの掌', description: '基礎10ダメージ。', damage: 10, hits: 1 },
    {
      kind: 'buff',
      label: '夜食の祈り',
      description: '5ブロックと筋力1を得る。',
      block: 5,
      strength: 1,
    },
    {
      kind: 'attack',
      label: '朝まで説法',
      description: '基礎6ダメージを2回。',
      damage: 6,
      hits: 2,
    },
  ]),
  lost_bell: enemy('lost_bell', '迷子の岩鐘', 32, [
    { kind: 'attack', label: '小さな鐘打ち', description: '基礎5ダメージ。', damage: 5, hits: 1 },
    {
      kind: 'debuff',
      label: '耳に残る音',
      description: 'プレイヤーに弱体1。自分に4ブロック。',
      weak: 1,
      block: 4,
    },
    {
      kind: 'attack',
      label: '二度鳴らし',
      description: '基礎4ダメージを2回。',
      damage: 4,
      hits: 2,
    },
  ]),
  debt_collector: enemy('debt_collector', '献金取り立て岩', 88, [
    { kind: 'attack', label: '帳簿の角', description: '基礎16ダメージ。', damage: 16, hits: 1 },
    {
      kind: 'buff',
      label: '利息を積む',
      description: '12ブロックと筋力2を得る。',
      block: 12,
      strength: 2,
    },
    { kind: 'attack', label: '分割請求', description: '基礎7ダメージを2回。', damage: 7, hits: 2 },
  ]),
  twin_pillars: enemy('twin_pillars', '三拍子の双石柱', 96, [
    {
      kind: 'attack',
      label: '柱の三拍子',
      description: '基礎6ダメージを3回。',
      damage: 6,
      hits: 3,
    },
    { kind: 'defend', label: '梁を支える', description: '16ブロックを得る。', block: 16 },
    {
      kind: 'debuff',
      label: '重たい説教',
      description: '基礎12ダメージ。プレイヤーに弱体1。',
      damage: 12,
      hits: 1,
      weak: 1,
    },
  ]),
  tower_abbot: enemy('tower_abbot', '塔主・ねんね大岩', 220, [
    {
      kind: 'attack',
      label: 'おやすみの一撃',
      description: '基礎18ダメージ。',
      damage: 18,
      hits: 1,
    },
    { kind: 'attack', label: '八時の鐘', description: '基礎6ダメージを4回。', damage: 6, hits: 4 },
    {
      kind: 'buff',
      label: '布団の結界',
      description: '16ブロックと筋力2を得る。',
      block: 16,
      strength: 2,
    },
    {
      kind: 'debuff',
      label: 'ねんねの誘い',
      description: '基礎20ダメージ。プレイヤーに弱体2。',
      damage: 20,
      hits: 1,
      weak: 2,
    },
  ]),
  moss_toad: {
    ...enemy('moss_toad', '苔毒の石蛙', 34, [
      { kind: 'debuff', label: '苔の吐息', description: 'プレイヤーに毒2。次のプレイヤーターン開始時に毒が発動する。', poison: 2 },
      { kind: 'attack', label: 'ぺたり石舌', description: '基礎7ダメージ。', damage: 7, hits: 1 },
      { kind: 'debuff', label: '滑る苔蹴り', description: '基礎4ダメージを与え、その後プレイヤーに弱体1。', damage: 4, hits: 1, weak: 1 },
    ]),
    description: 'じっとしすぎて苔むした石蛙。朝活より毒の散歩が好き。',
    gimmick: '最初は攻撃せず毒を付与。長引くほどブロックを無視する毒が蓄積する。',
  },
  shield_acolyte: {
    ...enemy('shield_acolyte', '石盾の見習い', 36, [
      { kind: 'defend', label: '習いたての岩壁', description: '12ブロックを得る。', block: 12 },
      { kind: 'attack', label: '盾の角でほいっと', description: '基礎8ダメージ。', damage: 8, hits: 1 },
      { kind: 'attack', label: '教則どおりの二拍', description: '基礎4ダメージを2回。', damage: 4, hits: 2 },
    ]),
    description: '盾の裏に「攻める前にじっと」と書き込んだ新米の信徒。',
    gimmick: '防御するターンと攻めるターンが分かれる。毒や強化の準備をする隙がある。',
  },
  bell_herald: {
    ...enemy('bell_herald', '朝鐘の先導師', 27, [
      { kind: 'defend', label: '仲間を起こす鐘', description: '自分以外の生存している敵すべてに5ブロック。', alliesBlock: 5 },
      { kind: 'buff', label: 'うききの指揮', description: '自分に4ブロック、自分以外の生存している敵すべてに筋力1。', block: 4, alliesStrength: 1 },
      { kind: 'attack', label: '小鐘の一振り', description: '基礎5ダメージ。', damage: 5, hits: 1 },
    ]),
    description: '朝活の集合時刻を三時間も早く伝える迷惑な鐘持ち。',
    gimmick: '仲間の防御と筋力を支援する。先に倒すと敵集団の成長を止められる。',
  },
  echo_scribe: {
    ...enemy('echo_scribe', '反響の写経岩', 40, [
      { kind: 'attack', label: '写し取る石筆', description: '基礎6ダメージ。', damage: 6, hits: 1 },
      { kind: 'defend', label: '余白の結界', description: '8ブロックを得る。', block: 8 },
      { kind: 'attack', label: '三行の説教', description: '基礎10ダメージ。', damage: 10, hits: 1 },
    ]),
    description: '敵の教えも防御術も、許可なく全部書き留める岩の書記。',
    gimmick: 'プレイヤーがスキルカードを1枚使うたび、この敵が3ブロックを得る。',
    reaction: { cardType: 'skill', block: 3 },
  },
  ember_idol: {
    ...enemy('ember_idol', '熾火の奉納像', 45, [
      { kind: 'buff', label: '熱い朝活', description: '4ブロックと筋力2を得る。', block: 4, strength: 2 },
      { kind: 'attack', label: '火の粉の拍手', description: '基礎3ダメージを2回。', damage: 3, hits: 2 },
      { kind: 'attack', label: '奉納の頭突き', description: '基礎8ダメージ。', damage: 8, hits: 1 },
    ]),
    description: 'お布施の代わりに薪を欲しがる、燃え尽き知らずの奉納像。',
    gimmick: '三ターンごとに筋力が上昇。多段攻撃が育つ前に決着をつけよう。',
  },
  seam_serpent: {
    ...enemy('seam_serpent', '岩継ぎの裂蛇', 46, [
      { kind: 'debuff', label: '割れ目の牙', description: '基礎4ダメージを与え、その後プレイヤーに脆弱2。', damage: 4, hits: 1, vulnerable: 2 },
      { kind: 'attack', label: '継ぎ目崩し', description: '基礎11ダメージ。残っている脆弱で増加する。', damage: 11, hits: 1 },
      { kind: 'debuff', label: '石粉の脱皮', description: 'プレイヤーに弱体1。自分に6ブロック。', weak: 1, block: 6 },
    ]),
    description: '石壁の継ぎ目を寝床にし、信徒の防具の継ぎ目を狙う蛇。',
    gimmick: '脆弱を付けた次のターンに大きく攻める。予告に合わせて防御を残そう。',
  },
  quarry_drummers: {
    ...enemy('quarry_drummers', '採石太鼓の連打僧', 50, [
      { kind: 'attack', label: '石鼓三拍子', description: '基礎2ダメージを3回。', damage: 2, hits: 3 },
      { kind: 'buff', label: '太鼓を張り直す', description: '8ブロックと筋力1を得る。', block: 8, strength: 1 },
      { kind: 'attack', label: '朝活四拍子', description: '基礎4ダメージを4回。', damage: 4, hits: 4 },
    ]),
    description: 'じっと教の静かな礼拝を、毎回太鼓の独奏会に変える石僧。',
    gimmick: '小さな多段攻撃が中心。筋力上昇後の四連打を見逃さないこと。',
  },
  resonance_sentinel: {
    ...enemy('resonance_sentinel', '共鳴禁書の守衛', 104, [
      { kind: 'attack', label: '禁書の背表紙', description: '基礎10ダメージ。', damage: 10, hits: 1 },
      { kind: 'debuff', label: '静粛の封印', description: '14ブロックを得て、プレイヤーに弱体1。', block: 14, weak: 1 },
      { kind: 'attack', label: '禁句三連', description: '基礎6ダメージを3回。', damage: 6, hits: 3 },
    ]),
    description: '「画面共有して」が禁句として保存された禁書庫を守る岩。',
    gimmick: 'プレイヤーがパワーカードを1枚使うたび、この敵の筋力が2増える。',
    reaction: { cardType: 'power', strength: 2 },
  },
  idol_conductor: {
    ...enemy('idol_conductor', '三石合唱の指揮尊', 86, [
      { kind: 'buff', label: '朝活の斉唱', description: '自分に6ブロック、自分以外の生存している敵すべてに筋力1。', block: 6, alliesStrength: 1 },
      { kind: 'debuff', label: '静かな伴奏', description: '自分以外の生存している敵すべてに8ブロック。プレイヤーに弱体1。', alliesBlock: 8, weak: 1 },
      { kind: 'attack', label: '指揮棒は石柱', description: '基礎14ダメージ。', damage: 14, hits: 1 },
    ]),
    description: '一人も音程が合わなくても、全員に自信だけを与える石の指揮者。',
    gimmick: '取り巻きに筋力とブロックを配る。指揮者か取り巻きか、倒す順番で被害が変わる。',
  },
  sundial_champion: {
    ...enemy('sundial_champion', '日輪割りの修験岩', 112, [
      { kind: 'attack', label: '日の出の掌', description: '基礎14ダメージ。', damage: 14, hits: 1 },
      { kind: 'defend', label: '時を待つ岩座', description: '12ブロックを得る。', block: 12 },
      { kind: 'attack', label: '朝の三礼', description: '基礎4ダメージを3回。', damage: 4, hits: 3 },
    ]),
    description: '「八時はねんね」を認めず、日時計そのものを殴って直す修験者。',
    gimmick: '第4ターンの予告から日中の型へ移行し、攻撃が激化する。現在の予告は変わらない。',
    phases: [{ trigger: { type: 'turn', at: 4 }, intents: [
      { kind: 'attack', label: '日輪二つ割り', description: '基礎10ダメージを2回。', damage: 10, hits: 2 },
      { kind: 'debuff', label: '真昼のまぶしさ', description: '8ブロックを得て、プレイヤーに脆弱2。', block: 8, vulnerable: 2 },
      { kind: 'attack', label: '時刻表を砕く', description: '基礎26ダメージ。', damage: 26, hits: 1 },
    ] }],
  },
  eclipse_archon: {
    ...enemy('eclipse_archon', '星蝕の石法王', 210, [
      { kind: 'attack', label: '星図の石槌', description: '基礎14ダメージ。', damage: 14, hits: 1 },
      { kind: 'debuff', label: '星のない祈り', description: '14ブロックを得て、プレイヤーに弱体1。', block: 14, weak: 1 },
      { kind: 'debuff', label: '星屑の三連', description: '基礎5ダメージを3回。その後プレイヤーに脆弱1。', damage: 5, hits: 3, vulnerable: 1 },
    ]),
    description: '星を布団で隠し、宇宙にも定時就寝を命じる法王。',
    gimmick: 'HPが半分以下になった後の予告から星蝕の型へ。全体波動は召喚体とプレイヤーの両方を攻撃する。',
    phases: [{ trigger: { type: 'hpBelow', ratio: 0.5 }, intents: [
      { kind: 'attack', label: '星蝕の三連', description: '基礎7ダメージを3回。', damage: 7, hits: 3 },
      { kind: 'attack', label: '皆既じっと波', description: '全体攻撃：プレイヤーと召喚体のそれぞれに基礎17ダメージ。プレイヤーのブロックは有効。', damage: 17, hits: 1, allTargets: true },
      { kind: 'buff', label: '消えない星核', description: '12ブロックと筋力2を得る。', block: 12, strength: 2 },
    ] }],
  },
  hollow_mountain: {
    ...enemy('hollow_mountain', '空洞山のねんね尊', 238, [
      { kind: 'defend', label: '山ごと布団', description: '18ブロックを得る。', block: 18 },
      { kind: 'attack', label: '寝返りの地響き', description: '全体攻撃：プレイヤーと召喚体のそれぞれに基礎14ダメージ。プレイヤーのブロックは有効。', damage: 14, hits: 1, allTargets: true },
      { kind: 'debuff', label: '洞窟の寝息', description: 'プレイヤーに毒3と弱体1。', poison: 3, weak: 1 },
      { kind: 'attack', label: 'おやすみの山掌', description: '基礎20ダメージ。', damage: 20, hits: 1 },
    ]),
    description: '中身が空洞なので、いびきだけで塔全体を揺らす山の化身。',
    gimmick: '第5ターンの予告から起床の型へ。全体攻撃は召喚体だけでは受け止められない。',
    phases: [{ trigger: { type: 'turn', at: 5 }, intents: [
      { kind: 'attack', label: '起き抜け四股', description: '基礎6ダメージを4回。', damage: 6, hits: 4 },
      { kind: 'buff', label: '二度寝の決意', description: '20ブロックと筋力2を得る。', block: 20, strength: 2 },
      { kind: 'debuff', label: '山頂の大あくび', description: '全体攻撃：プレイヤーと召喚体のそれぞれに基礎18ダメージ。その後プレイヤーに脆弱1。プレイヤーのブロックは有効。', damage: 18, hits: 1, allTargets: true, vulnerable: 1 },
    ] }],
  },
};

/** The original 86 HP guardian remains available for the combat practice room. */
export const NORMAL_ENEMY_IDS = [
  DEFAULT_ENEMY_ID,
  'grit_scout',
  'candle_moth',
  'quarry_crab',
  'sleepless_monk',
  'lost_bell',
  'moss_toad',
  'shield_acolyte',
  'bell_herald',
  'echo_scribe',
  'ember_idol',
  'seam_serpent',
  'quarry_drummers',
];
export const ELITE_ENEMY_IDS = ['debt_collector', 'twin_pillars', 'resonance_sentinel', 'idol_conductor', 'sundial_champion'];
export const BOSS_ENEMY_ID = 'tower_abbot';
export const BOSS_ENEMY_IDS = [BOSS_ENEMY_ID, 'eclipse_archon', 'hollow_mountain'];

export const EXPANSION_ENEMY_IDS = [
  'moss_toad', 'shield_acolyte', 'bell_herald', 'echo_scribe', 'ember_idol', 'seam_serpent',
  'quarry_drummers', 'resonance_sentinel', 'idol_conductor', 'sundial_champion',
  'eclipse_archon', 'hollow_mountain',
];

/** Ordinary tower encounters keep their combined opening attack at 14 or less. */
export const ENCOUNTER_GROUPS: string[][] = [
  ['grit_scout'],
  ['quarry_crab'],
  ['sleepless_monk'],
  ['grit_scout', 'candle_moth'],
  ['lost_bell', 'candle_moth'],
  ['grit_scout', 'lost_bell'],
  ['grit_scout', 'candle_moth', 'lost_bell'],
];

/** Pools are floor-banded, not rolled here: callers retain their saved seeded RNG. */
export function getEncounterGroupsForFloor(floor: number, kind: 'combat' | 'elite' | 'boss'): string[][] {
  if (kind === 'boss') return BOSS_ENEMY_IDS.map((id) => [id]);
  if (kind === 'elite') return floor < 7
    ? [['debt_collector'], ['twin_pillars'], ['resonance_sentinel']]
    : [['debt_collector'], ['twin_pillars'], ['resonance_sentinel'], ['idol_conductor', 'grit_scout', 'candle_moth'], ['sundial_champion']];
  if (floor <= 3) return [
    ['grit_scout'], ['quarry_crab'], ['shield_acolyte'], ['moss_toad'], ['grit_scout', 'candle_moth'],
  ];
  if (floor <= 6) return [
    ['sleepless_monk'], ['echo_scribe'], ['ember_idol'], ['seam_serpent'],
    ['bell_herald', 'grit_scout'], ['lost_bell', 'candle_moth'], ['moss_toad', 'candle_moth'],
  ];
  return [
    ['quarry_drummers'], ['seam_serpent', 'candle_moth'], ['echo_scribe', 'grit_scout'],
    ['ember_idol', 'lost_bell'], ['bell_herald', 'grit_scout', 'candle_moth'],
    ['grit_scout', 'candle_moth', 'lost_bell'], ['shield_acolyte', 'moss_toad'],
  ];
}

/** Unknown IDs never silently select a different enemy. */
export function getEnemyDefinition(id: string): EnemyDefinition | undefined {
  return Object.hasOwn(ENEMY_DEFINITIONS, id) ? ENEMY_DEFINITIONS[id] : undefined;
}
