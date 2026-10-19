import type { Effect } from '../types/game';

export interface PotionDefinition {
  id: string;
  name: string;
  description: string;
  glyph: string;
  target: 'player' | 'enemy' | 'allEnemies';
  effects: Effect[];
}

/** Potions cost no energy, consume one bottle, and use the shared effect resolver. */
export const POTION_DEFINITIONS: Record<string, PotionDefinition> = {
  magma_flask: {
    id: 'magma_flask',
    name: '溶岩の小瓶',
    description: '選んだ敵に基礎20ダメージ。対象の脆弱で増加し、筋力・弱体の影響は受けない。',
    glyph: '炎',
    target: 'enemy',
    effects: [{ type: 'damage', amount: 20 }],
  },
  shale_tonic: {
    id: 'shale_tonic',
    name: '頁岩のしずく',
    description: '12ブロックを得る。',
    glyph: '盾',
    target: 'player',
    effects: [{ type: 'block', amount: 12 }],
  },
  spring_water: {
    id: 'spring_water',
    name: '岩清水',
    description: 'HPを15回復する。',
    glyph: '泉',
    target: 'player',
    effects: [{ type: 'heal', amount: 15 }],
  },
  muscle_brew: {
    id: 'muscle_brew',
    name: '筋岩ドリンク',
    description: '戦闘中、筋力を3得る。',
    glyph: '筋',
    target: 'player',
    effects: [{ type: 'status', target: 'player', status: 'strength', amount: 3 }],
  },
  moss_mist: {
    id: 'moss_mist',
    name: '苔霧の小瓶',
    description: '敵全体に毒4を付与する。',
    glyph: '霧',
    target: 'allEnemies',
    effects: [{ type: 'status', target: 'allEnemies', status: 'poison', amount: 4 }],
  },
};

export const POTION_IDS = Object.keys(POTION_DEFINITIONS);
