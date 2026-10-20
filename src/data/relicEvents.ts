import type { EventDefinition } from './events';

/** Prices/trades are IWASON event balance; relic effects remain the reference TXT verbatim. */
export const RELIC_EVENT_DEFINITIONS: Record<string, EventDefinition> = {
  relic_counterfeit_stall: {
    id: 'relic_counterfeit_stall', title: 'じっと印の模造露店',
    description: '「画像は本物、現物はだいたい本物」。商人は小さな石の道具を並べた。効果の小ささまで正直なのが、じっと教の商売だ。',
    choices: [
      { label: '小さなイカリを買う', description: '30ゴールドを払い「イカリ？」を得る。戦闘開始時、4ブロック。', goldCost: 30, effects: [{ type: 'relic', relicId: 'ref_anchor_imitation' }] },
      { label: '薄い金属板を買う', description: '35ゴールドを払い「オリハルコン？」を得る。ブロックなしでターン終了時、3ブロック。', goldCost: 35, effects: [{ type: 'relic', relicId: 'ref_orichalcum_imitation' }] },
      { label: '遅咲きの花を買う', description: '40ゴールドを払い「ハッピーフラワー？」を得る。5ターンごとにエナジー1。', goldCost: 40, effects: [{ type: 'relic', relicId: 'ref_happy_flower_imitation' }] },
      { label: '見るだけにする', description: '何も買わずに先へ進む。', effects: [] },
    ],
  },
  relic_rock_garden: {
    id: 'relic_rock_garden', title: '小さな実りの石庭',
    description: '庭師は言う。「大きさを疑う前に、効果を読め」。小さな果物と、かじられたワッフルが祭壇にある。',
    choices: [
      { label: '小さなマンゴーを育てる', description: '20ゴールドを払い「マンゴー？」を得る。取得時、最大HPが3増加する。', goldCost: 20, effects: [{ type: 'relic', relicId: 'ref_mango_imitation' }] },
      { label: '残ったワッフルを食べる', description: '10ゴールドを払い「リーのワッフル？」を得る。取得時、最大HPの10%を回復する。', goldCost: 10, effects: [{ type: 'relic', relicId: 'ref_waffle_imitation' }] },
      { label: '匂いだけ嗅いで帰る', description: '何も受け取らずに先へ進む。', effects: [] },
    ],
  },
  relic_mushroom_kitchen: {
    id: 'relic_mushroom_kitchen', title: '岩陰のキノコ厨房',
    description: '料理僧は胸を張る。「うきき、味見は命懸けや」。何を食べるか、説明札を読んで決めよう。',
    choices: [
      { label: '芳醇なキノコを食べる', description: '「芳醇なキノコ」を得る。取得時、HPを15失い、ランダムなカード3枚をアップグレードする。', effects: [{ type: 'relic', relicId: 'ref_fragrant_mushroom' }] },
      { label: '大きなキノコを買う', description: '55ゴールドを払い「大きなキノコ」を得る。最大HPが20増加するが、戦闘開始時のドローが2枚減る。', goldCost: 55, effects: [{ type: 'relic', relicId: 'ref_big_mushroom' }] },
      { label: '熟成チーズを買う', description: '70ゴールドを払い「選ばれしチーズ」を得る。戦闘終了時、最大HPが1増加する。', goldCost: 70, effects: [{ type: 'relic', relicId: 'ref_chosen_cheese' }] },
      { label: '腹八分で立ち去る', description: '何も食べずに先へ進む。', effects: [] },
    ],
  },
  relic_spirit_market: {
    id: 'relic_spirit_market', title: '忘れ物たちの黄泉市',
    description: '光る魂が手招きする。「持ち主を探している。ついでに財布も開けて」。',
    choices: [
      { label: '忘れ去られし魂を迎える', description: '45ゴールドを払い「忘れ去られし魂」を得る。カード廃棄時、ランダムな敵に1ダメージ。', goldCost: 45, effects: [{ type: 'relic', relicId: 'ref_forgotten_soul' }] },
      { label: '迷子のウィスプを迎える', description: '70ゴールドを払い「迷子のウィスプ」を得る。パワー使用時、すべての敵に8ダメージ。', goldCost: 70, effects: [{ type: 'relic', relicId: 'ref_lost_wisp' }] },
      { label: '闇石の護符を引き取る', description: 'HPを8支払い「闇石の護符」を得る。呪い獲得時、最大HPが6増加する。', hpCost: 8, effects: [{ type: 'relic', relicId: 'ref_darkstone_amulet' }] },
      { label: '毒の運搬を引き受ける', description: '95ゴールドと「ロイヤルな毒」を得る。代償として以後の戦闘開始時にHPを4失う。', effects: [{ type: 'gold', amount: 95 }, { type: 'relic', relicId: 'ref_royal_poison' }] },
      { label: '道だけ聞く', description: '何も受け取らずに先へ進む。', effects: [] },
    ],
  },
  relic_wind_shrine: {
    id: 'relic_wind_shrine', title: '風鳴りの鍛錬社',
    description: '岩の風鈴が「朝活しよ」と鳴った。稽古代は安くないが、道具の力は本物だ。',
    choices: [
      { label: '風の乙女と稽古する', description: 'HPを7支払い「風の乙女」を得る。アタック使用時、1ブロック。', hpCost: 7, effects: [{ type: 'relic', relicId: 'ref_wind_maiden' }] },
      { label: '翡翠の剣を買う', description: '95ゴールドを払い「翡翠の剣」を得る。戦闘開始時、筋力3。', goldCost: 95, effects: [{ type: 'relic', relicId: 'ref_jade_sword' }] },
      { label: '花粉の核を拾う', description: 'HPを5支払い「花粉の核」を得る。4ターンごとに、追加でカードを2枚引く。', hpCost: 5, effects: [{ type: 'relic', relicId: 'ref_pollen_core' }] },
      { label: 'お参りだけする', description: '何も受け取らずに先へ進む。', effects: [] },
    ],
  },
  relic_struggle_puppet: {
    id: 'relic_struggle_puppet', title: '耐え忍ぶ石人形',
    description: '石人形は名前だけ名乗った。「ミスター・ストラグル」。時間をかける戦いの味方らしい。',
    choices: [
      { label: '連れていく', description: 'HPを10支払い「ミスター・ストラグル」を得る。ターン開始時、すべての敵に現在のターン数に等しいダメージ。', hpCost: 10, effects: [{ type: 'relic', relicId: 'ref_mr_struggle' }] },
      { label: '赤い瓶をもらう', description: '15ゴールドを払い「血のガラス瓶？」を得る。戦闘開始時、HPを1回復。', goldCost: 15, effects: [{ type: 'relic', relicId: 'ref_blood_vial_imitation' }] },
      { label: '茶をいれて休む', description: '20ゴールドを払い「古びたティーセット？」を得る。休憩所を訪れるたび、次の戦闘開始時に追加エナジー1。', goldCost: 20, effects: [{ type: 'relic', relicId: 'ref_tea_set_imitation' }] },
      { label: '挨拶して別れる', description: '何も受け取らずに先へ進む。', effects: [] },
    ],
  },
  relic_mirror_twins: {
    id: 'relic_mirror_twins', title: 'ビン・ボンの複写堂',
    description: '二つの石の声が交互に響く。「一枚加える」「もう一枚加える」。今のデッキを増やすのではなく、これから得るカードを写すという。',
    choices: [
      { label: '複写の契約を結ぶ', description: 'HPを12支払い「ビン・ボン」を得る。今後カードをデッキに加えるたび、そのコピーも1枚追加する。', hpCost: 12, effects: [{ type: 'relic', relicId: 'ref_bin_bon' }] },
      { label: '枚数は今のままでいい', description: '何も受け取らずに先へ進む。', effects: [] },
    ],
  },
};
