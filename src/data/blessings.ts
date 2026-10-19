import type { BlessingCharacter, BlessingCharacterId, BlessingTemplate } from '../types/blessing';

export const BLESSING_TEMPLATES: Record<string, BlessingTemplate> = Object.fromEntries(([
  { id: 'gentle_growth', title: '御神体にひと欠片', flavor: '小さな岩も、積もれば教祖。', risk: 'safe', costs: [], rewards: [{ kind: 'maxHp', base: 6, perAct: 2 }] },
  { id: 'pilgrim_purse', title: '朝活のおこづかい', flavor: '小銭も信仰も、持っていて困らない。', risk: 'safe', costs: [], rewards: [{ kind: 'gold', base: 70, perAct: 25 }] },
  { id: 'spring_water', title: '石肌の湯治', flavor: 'まずはひび割れをいたわろう。', risk: 'safe', costs: [], rewards: [{ kind: 'heal', base: 25, perAct: 5, percent: true }] },
  { id: 'polish_stone', title: '一札入魂', flavor: 'いつもの教えを、もう一段。', risk: 'safe', costs: [], rewards: [{ kind: 'upgrade', amount: 1, atAct3: 2 }] },
  { id: 'shed_weight', title: '置いていく教え', flavor: '軽い荷物で、塔へ向かう。', risk: 'safe', costs: [], rewards: [{ kind: 'remove', amount: 1 }] },
  { id: 'fresh_verse', title: '教義の衣替え', flavor: '同じ石から、違う一手。', risk: 'safe', costs: [], rewards: [{ kind: 'transform', amount: 1 }] },
  { id: 'class_lesson', title: '職業の一口説法', flavor: '今日の姿に合う教えを授けよう。', risk: 'safe', costs: [], rewards: [{ kind: 'cards', amount: 1, pool: 'class' }] },
  { id: 'rare_omen', title: '痛みを越えた啓示', flavor: 'ひとひびの先に、希少な一札。', risk: 'risky', costs: [{ kind: 'hp', base: 8, perAct: 3 }], rewards: [{ kind: 'cards', amount: 1, pool: 'rare' }] },
  { id: 'blood_tithe', title: '自腹の寄進', flavor: '身を削ると、財布が膨らむ。', risk: 'risky', costs: [{ kind: 'hp', base: 10, perAct: 5 }], rewards: [{ kind: 'gold', base: 120, perAct: 40 }] },
  { id: 'hollow_crown', title: '小さな器、大きな秘宝', flavor: '御神体を少し削って、願いを通す。', risk: 'risky', costs: [{ kind: 'maxHp', base: 5, perAct: 2 }], rewards: [{ kind: 'relic' }] },
  { id: 'merchant_contract', title: '旅支度の秘宝市', flavor: '勘定は先に。御利益はあとから。', risk: 'risky', costs: [{ kind: 'gold', base: 60, perAct: 20 }], rewards: [{ kind: 'relic' }] },
  { id: 'silent_forge', title: '二札の研磨料', flavor: '手入れに払う小銭は、未来の一撃。', risk: 'risky', costs: [{ kind: 'gold', base: 35, perAct: 15 }], rewards: [{ kind: 'upgrade', amount: 2 }] },
  { id: 'twin_rebirth', title: 'ふたつの新しい教え', flavor: '二札を置き、二つの道を開く。', risk: 'safe', costs: [], rewards: [{ kind: 'transform', amount: 2 }] },
  { id: 'burden_gold', title: '迷い石の報酬', flavor: '懐は暖かく、手札は少し重くなる。', risk: 'risky', costs: [{ kind: 'curse', base: 1, cardId: 'stone_doubt' }], rewards: [{ kind: 'gold', base: 140, perAct: 40 }] },
  { id: 'burden_relic', title: '秘宝に付いた迷い', flavor: '御利益には、ひとつだけ注意書き。', risk: 'risky', costs: [{ kind: 'curse', base: 1, cardId: 'stone_doubt' }], rewards: [{ kind: 'relic' }] },
  { id: 'sacred_trade', title: '古札と希少な一札', flavor: '教えをひとつ手放し、別の可能性へ。', risk: 'risky', costs: [], rewards: [{ kind: 'remove', amount: 1 }, { kind: 'cards', amount: 1, pool: 'rare' }] },
  { id: 'class_mastery', title: '職業の二重奏', flavor: '互いを支える二札を、修行の道へ。', risk: 'risky', costs: [{ kind: 'gold', base: 45, perAct: 15 }], rewards: [{ kind: 'cards', amount: 2, pool: 'synergy' }] },
  { id: 'exclusive_lesson', title: '出会いだけの教え', flavor: '特別な教えには、御神体の欠片をひとつ。', risk: 'risky', costs: [{ kind: 'maxHp', base: 5, perAct: 2 }], rewards: [{ kind: 'cards', amount: 1, pool: 'exclusive' }] },
] satisfies BlessingTemplate[]).map((template) => [template.id, template]));

const CHARACTER_PRESENTATION: Record<BlessingCharacterId, Pick<BlessingCharacter, 'artId' | 'backgroundTheme' | 'effectTheme' | 'availableActs' | 'dialogues'>> = {
  jitto_god: { artId: 'jitto_god', backgroundTheme: 'ancient_shrine', effectTheme: 'sacred_gold', availableActs: [1, 2, 3], dialogues: ['ほいっと〜。立ち上がる前に、ひとつ授けよう。', 'じっとしていても、選ぶときは選ぶのだ。', '塔へゆくなら、教えをひとつ持っていこう。'] },
  yomi_guide: { artId: 'yomi_guide', backgroundTheme: 'yomi_river', effectTheme: 'soul_lantern', availableActs: [2, 3], dialogues: ['まだお迎えではありません。旅支度の時間です。', '帰り道より、次の一歩を案内しましょう。', '彼岸の向こうでも、教えはあなたを支えます。'] },
  stone_merchant: { artId: 'stone_merchant', backgroundTheme: 'stone_market', effectTheme: 'amber_coins', availableActs: [2, 3], dialogues: ['画面共有して。お財布の中も、できれば。', '値札も御利益も、先に見せますよ。', 'その一札、次の階層で役立つかもしれません。'] },
  star_miko: { artId: 'star_miko', backgroundTheme: 'dawn_observatory', effectTheme: 'star_light', availableActs: [2, 3], dialogues: ['朝活しよ。星が見えているうちに。', '次の一手は、星より手札に聞いてみて。', '夜明けまでに、ひとつ教えを選びましょう。'] },
  oblivion_priest: { artId: 'oblivion_priest', backgroundTheme: 'forgotten_archive', effectTheme: 'fading_runes', availableActs: [2, 3], dialogues: ['忘れるのも修行。何を残すか、よく選びなさい。', '手放した教えの分だけ、道は軽くなります。', '記憶は薄れても、選んだ結果は消えません。'] },
  chaos_traveler: { artId: 'chaos_traveler', backgroundTheme: 'wandering_gate', effectTheme: 'shifting_shards', availableActs: [2, 3], dialogues: ['うきき。道は変わる。選んだ結果は変えない。', '曲がり角の先に、別の教えが待っている。', '八時か、ねんねやな。その前にひとつ選んで。'] },
};

export const BLESSING_CHARACTERS: Record<BlessingCharacterId, BlessingCharacter> = {
  jitto_god: { ...CHARACTER_PRESENTATION.jitto_god, id: 'jitto_god', name: 'じっと神', title: '動かぬはじまりの神', description: '塔の入口で岩尊けいとを迎える、座りっぱなしの守り神。', greeting: 'ほいっと〜。立ち上がる前に、ひとつ授けよう。', glyph: '尊', weight: 3, optionTemplateIds: ['gentle_growth', 'polish_stone', 'class_lesson', 'rare_omen', 'burden_gold', 'hollow_crown', 'exclusive_lesson'] },
  yomi_guide: { ...CHARACTER_PRESENTATION.yomi_guide, id: 'yomi_guide', name: '黄泉の道案内', title: '彼岸の道しるべ', description: '帰り道まで覚えている、親切な魂の案内人。', greeting: 'まだお迎えではありません。旅支度の時間です。', glyph: '灯', weight: 2, optionTemplateIds: ['spring_water', 'shed_weight', 'fresh_verse', 'rare_omen', 'blood_tithe', 'burden_relic'] },
  stone_merchant: { ...CHARACTER_PRESENTATION.stone_merchant, id: 'stone_merchant', name: '石ころ商人', title: '御利益の行商人', description: '価値の分かる石しか売らない。本人も石である。', greeting: '画面共有して。お財布の中も、できれば。', glyph: '商', weight: 2, optionTemplateIds: ['pilgrim_purse', 'class_lesson', 'gentle_growth', 'merchant_contract', 'silent_forge', 'class_mastery'] },
  star_miko: { ...CHARACTER_PRESENTATION.star_miko, id: 'star_miko', name: '星詠みの巫女', title: '明け方を読む者', description: '星空の隙間に、次の一手を見つける巫女。', greeting: '朝活しよ。星が見えているうちに。', glyph: '星', weight: 2, optionTemplateIds: ['class_lesson', 'polish_stone', 'gentle_growth', 'rare_omen', 'class_mastery', 'hollow_crown', 'exclusive_lesson'] },
  oblivion_priest: { ...CHARACTER_PRESENTATION.oblivion_priest, id: 'oblivion_priest', name: '忘却の司祭', title: '古い教えの番人', description: '大切なことは覚え、余計な教えは静かに忘れる。', greeting: '忘れるのも修行。何を残すか、よく選びなさい。', glyph: '忘', weight: 2, optionTemplateIds: ['shed_weight', 'polish_stone', 'fresh_verse', 'twin_rebirth', 'sacred_trade', 'burden_gold'] },
  chaos_traveler: { ...CHARACTER_PRESENTATION.chaos_traveler, id: 'chaos_traveler', name: '混沌の旅人', title: '石目の向こうの放浪者', description: '道順は気まぐれでも、約束した報酬は変えない旅人。', greeting: 'うきき。道は変わる。選んだ結果は変えない。', glyph: '旅', weight: 1, optionTemplateIds: ['fresh_verse', 'twin_rebirth', 'pilgrim_purse', 'class_lesson', 'burden_gold', 'burden_relic', 'sacred_trade', 'exclusive_lesson'] },
};
