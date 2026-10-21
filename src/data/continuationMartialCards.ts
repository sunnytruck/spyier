import type { CardDefinition, Effect } from '../types/game';
import { createReferenceCard } from './referenceCard';

type MartialClass = 'berserker' | 'assassin';
type Version = [description: string, effects: Effect[]];
const damage = (amount: number): Effect => ({ type: 'damage', amount });
const block = (amount: number): Effect => ({ type: 'block', amount });
const status = (target: 'player' | 'enemy', kind: 'strength' | 'weak' | 'vulnerable', amount: number): Effect =>
  ({ type: 'status', target, status: kind, amount });
const knives = (upgraded: boolean): Effect => ({ type: 'generate', cardId: 'token_knife', amount: 2, destination: 'hand', upgraded });

function define(
  id: string, classId: MartialClass, sourceName: string, name: string,
  type: CardDefinition['type'], glyph: string, normal: Version, upgraded: Version,
  options: Partial<CardDefinition> = {}, rarity: CardDefinition['rarity'] = 'common',
): CardDefinition {
  return createReferenceCard({ id, classId, sourceName, name, type, glyph,
    description: normal[0], effects: normal[1], upgradedDescription: upgraded[0], upgradedEffects: upgraded[1], options, rarity });
}

/** Source effects are explicit. Source 弱体 = vulnerable; source 脱力 = weak. */
export const CONTINUATION_MARTIAL_CARDS: CardDefinition[] = [
  define('berserker_headbutt', 'berserker', 'ヘッドバット', '石頭の再提出', 'attack', '頭',
    ['9ダメージ。捨て札から1枚選び、山札の一番上に置く。', [damage(9), { type: 'moveChoice', from: 'discardPile', to: 'drawPile', amount: 1 }]],
    ['12ダメージ。捨て札から1枚選び、山札の一番上に置く。', [damage(12), { type: 'moveChoice', from: 'discardPile', to: 'drawPile', amount: 1 }]]),
  define('berserker_true_grit', 'berserker', '不屈の闘志', '捨て身の石選び', 'skill', '選',
    ['7ブロック。手札からランダムに1枚廃棄する。', [block(7), { type: 'exhaustRandom', amount: 1 }]],
    ['9ブロック。手札から1枚選んで廃棄する。', [block(9), { type: 'exhaustChoice', amount: 1 }]]),
  define('berserker_uppercut', 'berserker', 'アッパーカット', '天井までほいっと', 'attack', '天',
    ['13ダメージ。弱体1・脆弱1。', [damage(13), status('enemy', 'weak', 1), status('enemy', 'vulnerable', 1)]],
    ['13ダメージ。弱体2・脆弱2。', [damage(13), status('enemy', 'weak', 2), status('enemy', 'vulnerable', 2)]], {}, 'uncommon'),
  define('berserker_disarm_strike', 'berserker', '切り刻み', '今夜は腕を休めよ', 'attack', '休',
    ['15ダメージ。このターン、対象の筋力−10。', [damage(15), { type: 'temporaryStatus', target: 'enemy', status: 'strength', amount: -10, allowNegative: true }]],
    ['20ダメージ。このターン、対象の筋力−15。', [damage(20), { type: 'temporaryStatus', target: 'enemy', status: 'strength', amount: -15, allowNegative: true }]], {}, 'rare'),
  define('berserker_brand', 'berserker', '焼印', '血判の入信届', 'skill', '印',
    ['HPを1消費。手札から1枚選んで廃棄。その後、筋力＋1。', [{ type: 'loseHp', amount: 1 }, { type: 'exhaustChoice', amount: 1 }, status('player', 'strength', 1)]],
    ['HPを1消費。手札から1枚選んで廃棄。その後、筋力＋2。', [{ type: 'loseHp', amount: 1 }, { type: 'exhaustChoice', amount: 1 }, status('player', 'strength', 2)]], {}, 'uncommon'),
  define('berserker_stone_armor', 'berserker', 'ストーンアーマー', '着る石垣', 'skill', '垣',
    ['プレート4を得る。ターン終了時に同量のブロックを得る。敵の攻撃でHPを失うたび、プレートが1減る。', [{ type: 'plate', amount: 4 }]],
    ['プレート6を得る。ターン終了時に同量のブロックを得る。敵の攻撃でHPを失うたび、プレートが1減る。', [{ type: 'plate', amount: 6 }]], {}, 'uncommon'),

  define('assassin_piercing_wail', 'assassin', '金切り声', '静かにしてくだ砕', 'skill', '黙',
    ['このターン、敵全体の筋力−6。廃棄。', [{ type: 'temporaryStatus', target: 'allEnemies', status: 'strength', amount: -6, allowNegative: true }]],
    ['このターン、敵全体の筋力−8。廃棄。', [{ type: 'temporaryStatus', target: 'allEnemies', status: 'strength', amount: -8, allowNegative: true }]], { exhaust: true }, 'uncommon'),
  define('assassin_predator', 'assassin', '略奪', '明朝の手札を拝借', 'attack', '借',
    ['15ダメージ。次のターン、追加で2枚引く。', [damage(15), { type: 'nextTurn', effects: [{ type: 'draw', amount: 2 }] }]],
    ['20ダメージ。次のターン、追加で2枚引く。', [damage(20), { type: 'nextTurn', effects: [{ type: 'draw', amount: 2 }] }]], {}, 'uncommon'),
  define('assassin_hidden_arsenal', 'assassin', '暗器', '袖の中の石庫', 'skill', '袖',
    ['手札から2枚選んで捨て、その後、石刃を2枚手札に生成する。', [{ type: 'discard', amount: 2 }, knives(false)]],
    ['手札から2枚選んで捨て、その後、強化済み石刃を2枚手札に生成する。', [{ type: 'discard', amount: 2 }, knives(true)]], {}, 'uncommon'),
  define('assassin_leg_sweep', 'assassin', '足払い', '足元からじっと', 'skill', '足',
    ['弱体2。その後、11ブロック。', [status('enemy', 'weak', 2), block(11)]],
    ['弱体3。その後、14ブロック。', [status('enemy', 'weak', 3), block(14)]], {}, 'uncommon'),
  define('assassin_infinite_blades', 'assassin', '無限の刃', '毎朝届く石刃便', 'power', '便',
    ['次の自分のターンから、開始時に石刃を1枚手札に生成する。', [{ type: 'power', power: 'knivesOnTurn', amount: 1 }]],
    ['天賦。次の自分のターンから、開始時に石刃を1枚手札に生成する。', [{ type: 'power', power: 'knivesOnTurn', amount: 1 }]], { upgradedInnate: true }, 'rare'),
  define('assassin_assassinate', 'assassin', '暗殺', '夜明け前の石仕事', 'attack', '暁',
    ['天賦。10ダメージ。脆弱1。廃棄。', [damage(10), status('enemy', 'vulnerable', 1)]],
    ['天賦。13ダメージ。脆弱2。廃棄。', [damage(13), status('enemy', 'vulnerable', 2)]], { innate: true, exhaust: true }, 'rare'),
  define('assassin_anticipation', 'assassin', '機先', '一足お先にじっと', 'skill', '先',
    ['このターン、敏捷＋2。カードで得るブロックを2増やす。', [{ type: 'dexterity', amount: 2, temporary: true }]],
    ['このターン、敏捷＋3。カードで得るブロックを3増やす。', [{ type: 'dexterity', amount: 3, temporary: true }]]),
  define('assassin_footwork', 'assassin', 'フットワーク', '小刻みな無動', 'power', '歩',
    ['この戦闘中、敏捷＋2。カードで得るブロックを2増やす。', [{ type: 'dexterity', amount: 2 }]],
    ['この戦闘中、敏捷＋3。カードで得るブロックを3増やす。', [{ type: 'dexterity', amount: 3 }]], {}, 'uncommon'),
];

export const CONTINUATION_MARTIAL_IDS = CONTINUATION_MARTIAL_CARDS.map((card) => card.id);
