import type { EventCardPoolPolicy } from '../engine/cardPools';

export type EventEffect =
  | { type: 'heal'; amount: number }
  | { type: 'gold'; amount: number }
  | {
      type: 'card';
      /** Pre-class saves keep this original reward. */
      cardId: string;
      /** Class runs use this explicit pool instead of the legacy card. */
      pool?: EventCardPoolPolicy;
    }
  | { type: 'upgrade' }
  | { type: 'relic' };

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
};

export const EVENT_IDS = Object.keys(EVENT_DEFINITIONS);
