import type { SourceClassId } from '../types/catalog';

/** Immutable IDs live in saves; display names can be changed without a migration. */
export type ClassId = Exclude<SourceClassId, 'colorless'>;
export const CLASS_IDS: ClassId[] = ['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'];

export interface ClassDefinition {
  id: ClassId;
  displayName: string;
  description: string;
  maxHp: number;
  starterDeck: string[];
  starterRelicId: string;
  resourceSummary: string;
  glyph: string;
}

/** HP, decks and relic assignments are IWASON balance choices, not facts supplied by the TXT. */
export const CLASS_DEFINITIONS: Record<ClassId, ClassDefinition> = {
  berserker: {
    id: 'berserker', displayName: '岩砕の拳僧', glyph: '拳', maxHp: 80,
    description: '修行の成果は上腕に出る。筋力と連撃を重ね、HPを力に換えて押し切る。',
    starterDeck: ['berserker_strike', 'berserker_strike', 'berserker_strike', 'berserker_strike', 'berserker_guard', 'berserker_guard', 'berserker_guard', 'berserker_anger', 'berserker_iron_wave', 'berserker_inflame'],
    starterRelicId: 'warm_pebble', resourceSummary: '筋力 × 多段攻撃／HP消費／ブロック攻撃',
  },
  assassin: {
    id: 'assassin', displayName: '静刃の影師', glyph: '刃', maxHp: 72,
    description: 'じっとした影から小さく刺す。毒を育て、生成した石刃と手札交換で隙を突く。',
    starterDeck: ['assassin_strike', 'assassin_strike', 'assassin_strike', 'assassin_guard', 'assassin_guard', 'assassin_guard', 'assassin_survivor', 'assassin_leading_strike', 'assassin_poison_sting', 'assassin_preparation'],
    starterRelicId: 'fossil_bookmark', resourceSummary: '毒／石刃の生成／ドローと捨て札選択',
  },
  oracle: {
    id: 'oracle', displayName: '星詠みの法王', glyph: '星', maxHp: 76,
    description: '石板よりも星空を読む派。星を集める順番と、鍛え続ける聖剣が勝負を決める。',
    starterDeck: ['oracle_strike', 'oracle_strike', 'oracle_strike', 'oracle_guard', 'oracle_guard', 'oracle_guard', 'oracle_awe', 'oracle_solar_strike', 'oracle_manifest', 'oracle_star_burst'],
    starterRelicId: 'amber_spark', resourceSummary: '✦獲得数を使う連携／鍛造／保留する聖剣',
  },
  necromancer: {
    id: 'necromancer', displayName: '黄泉渡りの霊僧', glyph: '霊', maxHp: 74,
    description: '朝活の集合場所が彼岸。召喚した岩霊に守られながら、破滅と魂札で敵を追い込む。',
    starterDeck: ['necromancer_strike', 'necromancer_strike', 'necromancer_strike', 'necromancer_guard', 'necromancer_guard', 'necromancer_guard', 'necromancer_bodyguard', 'necromancer_unleash', 'necromancer_soul_strike', 'necromancer_doom_draw'],
    starterRelicId: 'gate_fragment', resourceSummary: '岩霊のHPと攻撃／破滅／魂札／エセリアル',
  },
  machinist: {
    id: 'machinist', displayName: '岩核の機巧師', glyph: '核', maxHp: 72,
    description: '祈る前に配線を確認する。雷と霜のオーブを並べ、集中力と解放で戦場を制御する。',
    starterDeck: ['machinist_strike', 'machinist_strike', 'machinist_strike', 'machinist_guard', 'machinist_guard', 'machinist_guard', 'machinist_zap', 'machinist_dual_cast', 'machinist_ball_lightning', 'machinist_cold_wave'],
    starterRelicId: 'layered_charm', resourceSummary: '雷・霜オーブ／集中力／解放／Xコスト',
  },
};

export function isClassId(value: unknown): value is ClassId {
  return typeof value === 'string' && CLASS_IDS.includes(value as ClassId);
}
