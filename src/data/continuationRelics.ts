import type { RelicDefinition, RelicEffect, RelicPassives, RelicRarity } from './relics';

/** Complete effects transcribed from the supplied relic TXT; source identity is never regenerated. */
function relic(id: string, sourceRelicId: string, name: string, glyph: string, rarity: RelicRarity,
  description: string, effects: RelicEffect[] = [], passive?: RelicPassives): RelicDefinition {
  const hooks = effects.length ? effects : [{ trigger: 'acquire', kind: 'run', amount: 0 } satisfies RelicEffect];
  const acquisition = rarity === 'shop' || rarity === 'event' || rarity === 'ancient' ? rarity : 'normal';
  return { id, sourceRelicId, sourceRelicName: name, name, glyph, rarity, acquisition, description,
    effect: hooks[0], ...(hooks.length > 1 ? { effects: hooks } : {}), ...(passive ? { passive } : {}) };
}

const definitions: RelicDefinition[] = [
  relic('ref_red_skull', 'relsrc_a7734dd2f559', '赤い頭蓋骨', '髑', 'common',
    'HPが50%以下の間、追加で筋力3を得る。', [], { hpThresholdStrength: { percent: 50, amount: 3 } }),
  relic('ref_pen_nib', 'relsrc_d0f23e349cd2', 'ペン先', '筆', 'uncommon',
    'アタックを10回プレイするたび、そのダメージが2倍になる。', [], { attackEveryMultiplier: { every: 10, multiplier: 2 } }),
  relic('ref_reptile_trinket', 'relsrc_4f7c59c27e66', '爬虫類のトリンケット', '鱗', 'uncommon',
    'ポーションを使用するたび、ターン終了時まで筋力3を得る。', [{ trigger: 'potionUsed', kind: 'temporaryStrength', amount: 3 }]),
  relic('ref_paper_frog', 'relsrc_9fe2a7e062a6', '折りキャエル', '蛙', 'uncommon',
    '弱体状態の敵に与えるダメージが50%増加から75%増加になる。', [], { vulnerableEnemyMultiplier: 1.75 }),
  relic('ref_pocket_watch', 'relsrc_790927503ff9', '懐中時計', '時', 'rare',
    '自身のターン中にプレイしたカードが3枚以下の場合、次のターン開始時に追加でカードを3枚引く。',
    [{ trigger: 'turnStart', kind: 'draw', amount: 3, minTurn: 2, previousTurnCardsAtMost: 3 }]),
  relic('ref_paper_crane', 'relsrc_c2e3b60efcd8', '折りズル', '鶴', 'rare',
    '脱力状態の敵から受けるダメージが25%減少から40%減少になる。', [], { weakEnemyMultiplier: 0.6 }),
  relic('ref_chemical_x', 'relsrc_dfd2fe69860e', 'ケミカルX', '液', 'shop',
    'コストXのカードの効果が2増加する。', [], { xEffectBonus: 2 }),
  relic('ref_resonant_triangle', 'relsrc_c6acd5f197bc', '共鳴するトライアングル', '響', 'shop',
    '戦闘時、最初のターンに手札をすべて保留する。', [], { retainHandThroughTurn: 1 }),
  relic('ref_roaring_conch', 'relsrc_503ad20dfc76', '轟音のほら貝', '貝', 'ancient',
    'エリートとの戦闘開始時、追加でカードを2枚引く。', [{ trigger: 'combatStart', kind: 'draw', amount: 2, eliteOnly: true }]),
  relic('ref_glowing_pearl', 'relsrc_d33ccab2f4c9', '光り輝く真珠', '珠', 'ancient',
    '戦闘開始時、発光を1枚手札に加える。', [{ trigger: 'combatStart', kind: 'generateCard', amount: 1, generatedCardId: 'colorless_glow' }]),
  relic('ref_pael_tears', 'relsrc_438afba85335', 'パエルの涙', '涙', 'ancient',
    'エナジー1を残してターンを終了した場合、次のターン、追加でエナジー2を得る。',
    [{ trigger: 'turnEnd', kind: 'nextTurnEnergy', amount: 2, energyExactly: 1 }]),
  relic('ref_warm_gloves', 'relsrc_a0a79b25f60a', 'あったか手袋', '掌', 'ancient',
    'ターン開始時、山札の一番上のカードを廃棄し、筋力1を得る。',
    [{ trigger: 'turnStart', kind: 'exhaustDrawTop', amount: 1 }, { trigger: 'turnStart', kind: 'strength', amount: 1 }]),
  relic('ref_diamond_tiara', 'relsrc_f10ccf82990b', 'ダイヤのティアラ', '冠', 'ancient',
    '1ターンの間にプレイしたカードが2枚以下の場合、敵から受けるダメージが半分になる。',
    [], { enemyDamageMultiplierWhenCardsAtMost: { cards: 2, multiplier: 0.5 } }),
  relic('ref_velvet_choker', 'relsrc_e57fb2648286', 'ベルベットチョーカー', '頸', 'ancient',
    'ターン開始時、エナジー1を得る。1ターンに6枚までしかカードをプレイできない。',
    [{ trigger: 'turnStart', kind: 'energy', amount: 1 }], { cardsPerTurnLimit: 6 }),
  relic('ref_runic_pyramid', 'relsrc_abde914319d7', 'ルーンのピラミッド', '塔', 'ancient',
    'ターン終了時、手札を捨てなくなる。', [], { retainHand: true }),
  relic('ref_strike_dummy_imitation', 'relsrc_bbdd546516f4', 'ストライクダミー？', '杭', 'event',
    '名前に「ストライク」を含むカードは追加で1ダメージを与える。', [], { strikeBonus: 1 }),
];

export const CONTINUATION_RELIC_DEFINITIONS: Record<string, RelicDefinition> = Object.fromEntries(definitions.map((definition) => [definition.id, definition]));
