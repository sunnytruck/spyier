import type { EventCardPoolPolicy } from '../engine/cardPools';
import type { ClassId } from '../types/game';

export type EventEffect =
  | { type: 'heal'; amount: number }
  | { type: 'gold'; amount: number }
  | {
      type: 'card';
      /** Pre-class saves keep this original reward. */
      cardId: string;
      /** Explicit fixed rewards (including curses) do not enter random card pools. */
      fixed?: boolean;
      /** Class runs use this explicit pool instead of the legacy card. */
      pool?: EventCardPoolPolicy;
    }
  | { type: 'upgrade' }
  | { type: 'relic' }
  | { type: 'remove'; amount: number }
  | { type: 'maxHp'; amount: number }
  | { type: 'potion' }
  | { type: 'battle'; enemyIds: string[]; bonusGold: number; relicOnVictory: boolean };

export interface EventChoice {
  label: string;
  description: string;
  classDescription?: string;
  goldCost?: number;
  hpCost?: number;
  effects: EventEffect[];
}

export interface EventDefinition {
  id: string;
  title: string;
  description: string;
  classIds?: readonly ClassId[];
  choices: EventChoice[];
}

/** Original encounters: rewards use the run's saved RNG, never render-time randomness. */
export const EVENT_DEFINITIONS: Record<string, EventDefinition> = {
  sun_clock: {
    id: 'sun_clock',
    title: '八時を指す日時計',
    description:
      '地下なのに、日時計は八時を指している。「8時か、ねんねやな」と、どこかで声がした。',
    choices: [
      {
        label: '少しねんねする',
        description: 'HPを14回復する。',
        effects: [{ type: 'heal', amount: 14 }],
      },
      {
        label: '朝活の手伝いをする',
        description: '35ゴールドを得る。',
        effects: [{ type: 'gold', amount: 35 }],
      },
    ],
  },
  shared_altar: {
    id: 'shared_altar',
    title: '画面共有の祭壇',
    description:
      '石板が光り、祭司が頼んできた。「画面共有して」。接続には、少しの生命力が必要らしい。',
    choices: [
      {
        label: '生命力で接続する',
        description: 'HPを10失い、未所持のレリックを1個得る。',
        hpCost: 10,
        effects: [{ type: 'relic' }],
      },
      {
        label: '石板を磨いて帰る',
        description: '20ゴールドを得る。',
        effects: [{ type: 'gold', amount: 20 }],
      },
    ],
  },
  moss_garden: {
    id: 'moss_garden',
    title: '石の薬草園',
    description:
      '鮮やかな苔が壁を覆う。庭師の岩は「食べるか、投げるか。それが問題や」とうなずいた。',
    choices: [
      {
        label: '毒苔を分けてもらう',
        description: '「毒苔の布教」をデッキに加える。',
        classDescription: '選択した職業か無色のカードをランダムに1枚、デッキに加える。',
        effects: [
          {
            type: 'card',
            cardId: 'poison_moss',
            pool: { includeOwnClass: true, includeColorless: true },
          },
        ],
      },
      {
        label: '薬湯を注文する',
        description: '20ゴールドを払い、HPを24回復する。',
        goldCost: 20,
        effects: [{ type: 'heal', amount: 24 }],
      },
      { label: '庭師にお辞儀する', description: '何も受け取らず先へ進む。', effects: [] },
    ],
  },
  morning_circle: {
    id: 'morning_circle',
    title: '朝活の輪',
    description: '弟子たちが円になり「朝活しよ」と筋トレしている。岩尊けいとの出番だ。',
    choices: [
      {
        label: '特別稽古を受ける',
        description: '35ゴールドを払い、ランダムな未強化カード1枚を強化する。',
        goldCost: 35,
        effects: [{ type: 'upgrade' }],
      },
      {
        label: '掛け声を覚える',
        description: '「朝活しよ」をデッキに加える。',
        classDescription: '選択した職業のカードをランダムに1枚、デッキに加える。',
        effects: [
          {
            type: 'card',
            cardId: 'morning_chant',
            pool: { includeOwnClass: true, includeColorless: false },
          },
        ],
      },
      { label: '見守って帰る', description: '何も受け取らず先へ進む。', effects: [] },
    ],
  },
  restless_mirror: {
    id: 'restless_mirror',
    title: 'そわそわする鏡',
    description: '鏡の中の岩尊が、やたらと手招きしている。「うきき。今なら伸びしろ、あるで」。',
    choices: [
      {
        label: '鏡の自分と組み手',
        description: 'HPを6失い、ランダムな未強化カード1枚を強化する。',
        hpCost: 6,
        effects: [{ type: 'upgrade' }],
      },
      {
        label: 'ポケットの小銭を拾う',
        description: '25ゴールドを得る。',
        effects: [{ type: 'gold', amount: 25 }],
      },
    ],
  },
  blood_quarry: {
    id: 'blood_quarry', title: '自腹の採石場',
    description: '採石親方が教祖の腕を見て拍手する。「岩代は結構。体力で払ってな」。',
    choices: [
      { label: '素手で大岩を運ぶ', description: 'HPを11失い、65ゴールドを得る。', hpCost: 11, effects: [{ type: 'gold', amount: 65 }] },
      { label: '休憩番を引き受ける', description: 'HPを8回復する。', effects: [{ type: 'heal', amount: 8 }] },
    ],
  },
  stone_eraser: {
    id: 'stone_eraser', title: '忘却の石消し屋',
    description: '「教えにも整理整頓が必要や」。店主は、どの石札を消すかをくじで決めるらしい。',
    choices: [
      { label: '忘却くじを引く', description: '45ゴールドを払い、デッキからランダムなカード1枚を削除する。デッキには最低5枚残す。', goldCost: 45, effects: [{ type: 'remove', amount: 1 }] },
      { label: '磨きくじを引く', description: '30ゴールドを払い、ランダムな未強化カード1枚を強化する。', goldCost: 30, effects: [{ type: 'upgrade' }] },
      { label: '今の教えを大切にする', description: '何もせず先へ進む。', effects: [] },
    ],
  },
  sealed_mine: {
    id: 'sealed_mine', title: '封印されたへそくり',
    description: '黄金の壺には「開けると少し気まずくなる」と刻まれている。中からうきき、と聞こえた。',
    choices: [
      { label: '気まずさごと持ち帰る', description: '未所持レリックを1個得る。使用不能の呪い「石心の迷い」1枚をデッキに加える。', effects: [{ type: 'relic' }, { type: 'card', cardId: 'stone_doubt', fixed: true }] },
      { label: '壺の外側の小銭だけ拾う', description: '20ゴールドを得る。', effects: [{ type: 'gold', amount: 20 }] },
    ],
  },
  resonance_gate: {
    id: 'resonance_gate', title: '禁書庫の入館試験',
    description: '共鳴禁書の守衛が道を塞ぐ。「パワーを使うたび、こちらも鍛えられる」。勝てば蔵書庫の宝を譲るという。',
    choices: [
      { label: '守衛の試験に挑む', description: '危険な守衛1体と戦闘する。勝利時、通常報酬に加えて35ゴールドと未所持レリック1個を得る。', effects: [{ type: 'battle', enemyIds: ['resonance_sentinel'], bonusGold: 35, relicOnVictory: true }] },
      { label: '入口の清掃を手伝う', description: '15ゴールドを得て立ち去る。', effects: [{ type: 'gold', amount: 15 }] },
    ],
  },
  restoration_spring: {
    id: 'restoration_spring', title: '伸びしろの湧き水',
    description: '泉の岩は断言する。「飲めば器が大きくなる。コップやなくて、君のな」。',
    choices: [
      { label: '神聖な大ジョッキを頼む', description: '35ゴールドを払い、最大HPを5増やし、HPを10回復する。', goldCost: 35, effects: [{ type: 'maxHp', amount: 5 }, { type: 'heal', amount: 10 }] },
      { label: '手を合わせて一口だけ', description: 'HPを6回復する。', effects: [{ type: 'heal', amount: 6 }] },
    ],
  },
  echo_library: {
    id: 'echo_library', title: '返事が早い石図書館',
    description: '「画面共有して」と石司書。まだ何も話していないのに、必要そうな教本を出してきた。',
    choices: [
      { label: '自分の流派の教本を買う', description: '40ゴールドを払い、「不動の教え」1枚を得る。', classDescription: '40ゴールドを払い、自分の職業の修行用カード1枚を得る。候補は上腕の開眼・石刃の研修・法王の金床・岩霊の再出勤・教義の再配線のうち、自分の職業の1枚。', goldCost: 40, effects: [{ type: 'card', cardId: 'stillness', pool: { includeOwnClass: true, includeColorless: false, cardIds: ['berserker_inflame', 'assassin_accuracy', 'oracle_smith', 'necromancer_afterlife', 'machinist_defrag'] } }] },
      { label: '通りすがりの知恵を買う', description: '25ゴールドを払い、カードを1枚得る。', classDescription: '25ゴールドを払い、無色カードをランダムに1枚得る。', goldCost: 25, effects: [{ type: 'card', cardId: 'shared_screen', pool: { includeOwnClass: false, includeColorless: true } }] },
      { label: '静かに退出する', description: '何もせず先へ進む。', effects: [] },
    ],
  },
  stone_contract: {
    id: 'stone_contract', title: '読まずに押す石印',
    description: '契約書は一行だけ。「明日の自分がなんとかする」。石印はやけに押しやすい。',
    choices: [
      { label: '明日の自分を信じる', description: '90ゴールドを得る。使用不能の呪い「石心の迷い」1枚をデッキに加える。', effects: [{ type: 'gold', amount: 90 }, { type: 'card', cardId: 'stone_doubt', fixed: true }] },
      { label: '契約書を返して帰る', description: '何もせず先へ進む。', effects: [] },
    ],
  },
  amber_exchange: {
    id: 'amber_exchange', title: '琥珀瓶の交換所',
    description: '「飲む前にラベル見てな」。瓶職人が色とりどりのポーションを揺らしている。',
    choices: [
      { label: 'おまかせ瓶を買う', description: '20ゴールドを払い、ランダムなポーション1個を空きスロットに得る。', goldCost: 20, effects: [{ type: 'potion' }] },
      { label: '空き瓶を片付ける', description: '18ゴールドを得る。', effects: [{ type: 'gold', amount: 18 }] },
    ],
  },
  fist_trial: {
    id: 'fist_trial', title: '拳僧の割り勘修行', classIds: ['berserker'],
    description: '拳僧の先輩が岩を差し出す。「痛みは割り勘。鍛えた腕は全部君のものや」。',
    choices: [
      { label: '岩割り修行に加わる', description: 'HPを7失い、「上腕の開眼」1枚を得る。', hpCost: 7, effects: [{ type: 'card', cardId: 'berserker_inflame', fixed: true }] },
      { label: '拳を冷やして見学する', description: 'HPを9回復する。', effects: [{ type: 'heal', amount: 9 }] },
    ],
  },
  silent_orchard: {
    id: 'silent_orchard', title: '影師の無言直売所', classIds: ['assassin'],
    description: '音を立てずに並ぶ毒苔。値札だけが雄弁に語る。「じわじわ、効きます」。',
    choices: [
      { label: 'よく育った毒苔を買う', description: '25ゴールドを払い、「じわじわ布教」1枚を得る。', goldCost: 25, effects: [{ type: 'card', cardId: 'assassin_deadly_poison', fixed: true }] },
      { label: '影から見守る', description: '20ゴールドを得る。', effects: [{ type: 'gold', amount: 20 }] },
    ],
  },
  starlight_anvil: {
    id: 'starlight_anvil', title: '星詠みの流星金床', classIds: ['oracle'],
    description: '空のない塔に流れ星が落ちてきた。「祈るより、まず鍛えるのもありやで」。',
    choices: [
      { label: '星屑で剣を磨く', description: '30ゴールドを払い、「聖剣の朝磨き」1枚を得る。', goldCost: 30, effects: [{ type: 'card', cardId: 'oracle_sword_grind', fixed: true }] },
      { label: '星屑を両替する', description: '25ゴールドを得る。', effects: [{ type: 'gold', amount: 25 }] },
    ],
  },
  spirit_teatime: {
    id: 'spirit_teatime', title: '霊僧と彼岸の茶会', classIds: ['necromancer'],
    description: '岩霊が空席を示す。「帰りの足は任せてな」。お茶代は少しの生命力だ。',
    choices: [
      { label: '岩霊と盃を交わす', description: 'HPを6失い、「岩霊の再出勤」1枚を得る。', hpCost: 6, effects: [{ type: 'card', cardId: 'necromancer_afterlife', fixed: true }] },
      { label: '温かい茶だけいただく', description: 'HPを10回復する。', effects: [{ type: 'heal', amount: 10 }] },
    ],
  },
  core_workshop: {
    id: 'core_workshop', title: '機巧師の朝いち工房', classIds: ['machinist'],
    description: '配線が五色に絡まっている。「動いているうちに直す。朝活の基本や」。',
    choices: [
      { label: '教義の配線を整理する', description: '30ゴールドを払い、「教義の再配線」1枚を得る。', goldCost: 30, effects: [{ type: 'card', cardId: 'machinist_defrag', fixed: true }] },
      { label: '余った部品を売る', description: '25ゴールドを得る。', effects: [{ type: 'gold', amount: 25 }] },
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENT_DEFINITIONS);
