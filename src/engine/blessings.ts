import { BLESSING_CHARACTERS, BLESSING_TEMPLATES } from '../data/blessings';
import { CARD_DEFINITIONS } from '../data/cards';
import { eligibleRelicIds, RELIC_DEFINITIONS } from '../data/relics';
import type { CardInstance, ClassId, Effect } from '../types/game';
import type { BlessingAction, BlessingBasis, BlessingCharacterId, BlessingEncounter, BlessingOption, BlessingReceipt, BlessingRecord, BlessingReward, BlessingRun, BlessingTemplate } from '../types/blessing';
import { getBlessingCardPool, getCardPool } from './cardPools';
import { nextRandom, seedToState } from './random';

const int = (value: unknown, min = 0, max = 1_000_000): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((entry, index) => same(entry, b[index]));
  if (!object(a) || !object(b)) return false;
  const keys = Object.keys(a).sort();
  return same(keys, Object.keys(b).sort()) && keys.every((key) => same(a[key], b[key]));
}
function randomFor(seed: string): () => number {
  let state = seedToState(seed);
  return () => { const next = nextRandom(state); state = next.state; return next.value; };
}
function pick<T>(values: T[], random: () => number): T | undefined { return values[Math.floor(random() * values.length)]; }
function basisOf(state: BlessingRun): BlessingBasis {
  return { hp: state.hp, maxHp: state.maxHp, gold: state.gold, deck: structuredClone(state.deck), relicIds: [...state.relicIds], nextCardId: state.nextCardId };
}
function validBasis(value: unknown, classId?: ClassId): value is BlessingBasis {
  if (!object(value) || !int(value.hp, 1) || !int(value.maxHp, 1) || value.hp > value.maxHp || !int(value.gold) || !int(value.nextCardId, 1)) return false;
  if (!Array.isArray(value.deck) || value.deck.length < 1 || value.deck.length > 1000 || !value.deck.every((card) => object(card) && typeof card.uid === 'string' && card.uid.length > 0 && card.uid.length <= 100 && typeof card.cardId === 'string' && Object.hasOwn(CARD_DEFINITIONS, card.cardId) && typeof card.upgraded === 'boolean')) return false;
  if (new Set(value.deck.map((card) => card.uid)).size !== value.deck.length) return false;
  return Array.isArray(value.relicIds) && value.relicIds.every((id) => typeof id === 'string' && eligibleRelicIds(classId).includes(id)) && new Set(value.relicIds).size === value.relicIds.length;
}
function flattenEffects(effects: Effect[]): Effect[] {
  return effects.flatMap((effect) => effect.type === 'conditional' || effect.type === 'nextTurn' ? [effect, ...flattenEffects(effect.effects)] : [effect]);
}
const synergyTypes: Record<ClassId, string[]> = {
  berserker: ['loseHp', 'status', 'power'], assassin: ['status', 'generate', 'multiplyPoison', 'discard', 'draw'],
  oracle: ['gainStars', 'starBurst', 'forge', 'fetchGenerated'], necromancer: ['summon', 'summonDamage', 'doom', 'soul'],
  machinist: ['channel', 'evoke', 'focus', 'xChannel'],
};
function cardPool(classId: ClassId | undefined, category: 'class' | 'rare' | 'synergy' | 'exclusive', characterId?: BlessingCharacterId): string[] {
  if (category === 'exclusive') return getBlessingCardPool(classId, characterId ? BLESSING_CHARACTERS[characterId].blessingCardIds : undefined);
  const own = getCardPool(classId, 'combat').filter((id) => !CARD_DEFINITIONS[id].unplayable && !CARD_DEFINITIONS[id].curse);
  if (category === 'rare') return own.filter((id) => CARD_DEFINITIONS[id].rarity === 'rare');
  if (category === 'synergy' && classId) {
    const matching = own.filter((id) => flattenEffects(CARD_DEFINITIONS[id].effects).some((effect) => synergyTypes[classId].includes(effect.type)));
    return matching.length >= 2 ? matching : own;
  }
  return own;
}
function encounterId(seed: string, act: number): string { return `blessing-${seedToState(seed).toString(36)}-${act}`; }

function buildOption(seed: string, classId: ClassId | undefined, basis: BlessingBasis, act: number, template: BlessingTemplate, frozen?: BlessingOption, characterId?: BlessingCharacterId): BlessingOption | null {
  const random = randomFor(`${seed}:blessing:${act}:option:${template.id}`);
  const costs = template.costs.map((cost) => cost.kind === 'curse'
    ? { kind: 'curse' as const, amount: cost.base + (act - 1) * (cost.perAct ?? 0), cardId: cost.cardId! }
    : { kind: cost.kind, amount: cost.base + (act - 1) * (cost.perAct ?? 0) });
  const rewards: BlessingReward[] = [];
  let target: BlessingOption['target'] = null;
  for (const [index, reward] of template.rewards.entries()) {
    const stored = frozen?.rewards[index];
    if (reward.kind === 'cards') {
      const pool = cardPool(classId, reward.pool, characterId);
      const cardIds = stored?.kind === 'cards' ? [...stored.cardIds] : [];
      if (stored?.kind !== 'cards') {
        const remaining = [...pool];
        for (let card = 0; card < reward.amount; card++) { const id = pick(remaining, random); if (!id) return null; cardIds.push(id); remaining.splice(remaining.indexOf(id), 1); }
      }
      if (cardIds.length !== reward.amount || new Set(cardIds).size !== cardIds.length || cardIds.some((id) => !pool.includes(id))) return null;
      rewards.push({ kind: 'cards', cardIds });
    } else if (reward.kind === 'relic') {
      const pool = eligibleRelicIds(classId).filter((id) => !basis.relicIds.includes(id));
      const relicId = stored?.kind === 'relic' ? stored.relicId : pick(pool, random);
      if (!relicId || !pool.includes(relicId)) return null;
      rewards.push({ kind: 'relic', relicId });
    } else if (reward.kind === 'remove' || reward.kind === 'upgrade' || reward.kind === 'transform') {
      const count = act >= 3 ? reward.atAct3 ?? reward.amount : reward.amount;
      const transformPool = cardPool(classId, 'class');
      const candidates = basis.deck.filter((card) => reward.kind !== 'upgrade' || (!card.upgraded && !CARD_DEFINITIONS[card.cardId].unupgradable))
        .filter((card) => reward.kind !== 'transform' || transformPool.some((id) => id !== card.cardId));
      if (candidates.length < count || (reward.kind === 'remove' && basis.deck.length <= count)) return null;
      target = { kind: reward.kind, count, eligibleCardUids: candidates.map((card) => card.uid) };
      if (reward.kind === 'transform') {
        target.replacements = {};
        for (const card of candidates) {
          const pool = transformPool.filter((id) => id !== card.cardId);
          const id = frozen?.target?.replacements?.[card.uid] ?? pick(pool, random);
          if (!id || !pool.includes(id)) return null;
          target.replacements[card.uid] = id;
        }
      }
      rewards.push({ kind: reward.kind, amount: count });
    } else if ('base' in reward) {
      const raw = reward.base + (act - 1) * (reward.perAct ?? 0);
      const amount = reward.percent ? Math.floor(basis.maxHp * raw / 100) : raw;
      if (reward.kind === 'heal' && basis.hp >= basis.maxHp) return null;
      rewards.push({ kind: reward.kind, amount });
    }
  }
  const option: BlessingOption = { id: `${encounterId(seed, act)}:${template.id}`, templateId: template.id, title: template.title, description: '', risk: template.risk, costs, rewards, target };
  const costText = costs.map((cost) => cost.kind === 'curse' ? `「${CARD_DEFINITIONS[cost.cardId].name}」${cost.amount}枚を受け取る` : `${cost.kind === 'hp' ? 'HP' : cost.kind === 'maxHp' ? '最大HP' : 'ゴールド'}を${cost.amount}失う`);
  const rewardText = rewards.map((reward) => reward.kind === 'cards' ? reward.cardIds.map((id) => `「${CARD_DEFINITIONS[id].name}」`).join('・') + 'を獲得'
    : reward.kind === 'relic' ? `「${RELIC_DEFINITIONS[reward.relicId].name}」を獲得`
      : reward.kind === 'maxHp' ? `最大HP＋${reward.amount}（現在HPも同量増加）`
        : reward.kind === 'heal' ? `HPを${reward.amount}回復`
          : reward.kind === 'gold' ? `ゴールド＋${reward.amount}`
            : `${reward.amount}枚を選んで${reward.kind === 'remove' ? '削除' : reward.kind === 'upgrade' ? '強化' : '変化（強化状態は解除）'}`);
  option.description = `${template.flavor} ${[...costText, ...rewardText].join('。')}。`;
  return canApply(basis, option) ? option : null;
}

function canApply(basis: BlessingBasis, option: BlessingOption): boolean {
  for (const cost of option.costs) {
    if (cost.kind === 'hp' && basis.hp <= cost.amount) return false;
    if (cost.kind === 'maxHp' && basis.maxHp <= cost.amount) return false;
    if (cost.kind === 'gold' && basis.gold < cost.amount) return false;
  }
  const added = option.costs.reduce((sum, cost) => sum + (cost.kind === 'curse' ? cost.amount : 0), 0) + option.rewards.reduce((sum, reward) => sum + (reward.kind === 'cards' ? reward.cardIds.length : 0), 0);
  const removed = option.target?.kind === 'remove' ? option.target.count : 0;
  return basis.deck.length + added - removed <= 1000 && basis.gold + option.rewards.reduce((sum, reward) => sum + (reward.kind === 'gold' ? reward.amount : 0), 0) <= 1_000_000
    && basis.maxHp + option.rewards.reduce((sum, reward) => sum + (reward.kind === 'maxHp' ? reward.amount : 0), 0) <= 1_000_000;
}

export function createBlessingEncounter(state: BlessingRun, act = state.act ?? 1): BlessingEncounter {
  if (state.blessing?.act === act) return structuredClone(state.blessing);
  if (!int(act, 1, 3) || state.blessingHistory?.some((record) => record.act === act)) throw new RangeError('この階層の祝福は既に受領済みです。');
  const basis = basisOf(state);
  if (!validBasis(basis, state.classId)) throw new RangeError('祝福を開始できない探索状態です。');
  const random = randomFor(`${state.seed}:blessing:${act}:character`);
  const previous = state.blessingHistory?.at(-1)?.characterId;
  const characters = Object.values(BLESSING_CHARACTERS).filter((character) => character.availableActs.includes(act) && character.id !== previous);
  let roll = random() * characters.reduce((sum, character) => sum + character.weight, 0);
  const characterId: BlessingCharacterId = act === 1 ? 'jitto_god' : characters.find((character) => (roll -= character.weight) < 0)?.id ?? characters[characters.length - 1].id;
  const character = BLESSING_CHARACTERS[characterId];
  const candidates = Object.values(BLESSING_TEMPLATES).map((template) => buildOption(state.seed, state.classId, basis, act, template, undefined, characterId)).filter((option): option is BlessingOption => option !== null);
  const optionRandom = randomFor(`${state.seed}:blessing:${act}:offers`);
  const options: BlessingOption[] = [];
  function take(risk?: BlessingOption['risk']) {
    const available = candidates.filter((option) => !options.some((taken) => taken.id === option.id || same(taken.rewards, option.rewards)) && (!risk || option.risk === risk));
    const weighted = available.flatMap((option) => Array.from({ length: character.optionTemplateIds.includes(option.templateId) ? 4 : 1 }, () => option));
    const next = pick(weighted, optionRandom);
    if (next) options.push(next);
  }
  take('safe'); take('risky'); take(); take();
  if (options.length !== 4) throw new RangeError('有効な祝福を4つ用意できませんでした。');
  const dialogueIndex = Math.floor(randomFor(`${state.seed}:blessing:${act}:dialogue:${characterId}`)() * character.dialogues.length);
  return { version: 1, id: encounterId(state.seed, act), act, characterId, dialogueIndex, stage: 'offer', options, selectedOptionId: null, selectedCardUids: [], receipt: null, basis };
}

export function getBlessingOptionDisabledReason(state: BlessingRun, option: BlessingOption): string | null {
  const encounter = state.blessing;
  if (!encounter || state.screen !== 'blessing' || encounter.stage === 'result') return 'この祝福は選択できません。';
  if (state.blessingHistory?.some((record) => record.act === encounter.act)) return 'この階層の祝福は受領済みです。';
  if (!same(basisOf(state), encounter.basis)) return '探索状態が変わったため確定できません。';
  if (!encounter.options.some((candidate) => same(candidate, option))) return '存在しない選択肢です。';
  if (!validOption(state.seed, state.classId, encounter.basis, encounter.act, option, encounter.characterId)) return '祝福の定義と一致しない選択肢です。';
  if (!canApply(encounter.basis, option)) return '代償または報酬の条件を満たしていません。';
  return null;
}
export function isBlessingOptionAvailable(state: BlessingRun, option: BlessingOption): boolean { return getBlessingOptionDisabledReason(state, option) === null; }
export function getBlessingTargetCards(state: BlessingRun): CardInstance[] {
  const option = state.blessing?.options.find((entry) => entry.id === state.blessing?.selectedOptionId);
  return state.deck.filter((card) => option?.target?.eligibleCardUids.includes(card.uid)).map((card) => ({ ...card }));
}

function applyOption(basis: BlessingBasis, option: BlessingOption, uids: string[], encounter: Pick<BlessingEncounter, 'id' | 'act' | 'characterId'>): { after: BlessingBasis; receipt: BlessingReceipt } {
  const after = structuredClone(basis);
  const receipt: BlessingReceipt = { encounterId: encounter.id, act: encounter.act, characterId: encounter.characterId, optionId: option.id, title: option.title, description: '', hpChange: 0, maxHpChange: 0, goldChange: 0, removedCards: [], upgradedCards: [], transformedCards: [], addedCards: [], relicIds: [] };
  function add(cardId: string) {
    let uid = `card-${after.nextCardId++}`;
    while (after.deck.some((card) => card.uid === uid)) uid = `card-${after.nextCardId++}`;
    const card = { uid, cardId, upgraded: false };
    after.deck.push(card); receipt.addedCards.push({ ...card });
  }
  for (const cost of option.costs) {
    if (cost.kind === 'hp') after.hp -= cost.amount;
    else if (cost.kind === 'maxHp') { after.maxHp -= cost.amount; after.hp = Math.min(after.hp, after.maxHp); }
    else if (cost.kind === 'gold') after.gold -= cost.amount;
    else if (cost.kind === 'curse') for (let count = 0; count < cost.amount; count++) add(cost.cardId);
  }
  for (const reward of option.rewards) {
    if (reward.kind === 'gold') after.gold += reward.amount;
    else if (reward.kind === 'maxHp') { after.maxHp += reward.amount; after.hp += reward.amount; }
    else if (reward.kind === 'heal') after.hp = Math.min(after.maxHp, after.hp + reward.amount);
    else if (reward.kind === 'cards') reward.cardIds.forEach(add);
    else if (reward.kind === 'relic') { after.relicIds.push(reward.relicId); receipt.relicIds.push(reward.relicId); }
    else for (const uid of uids) {
      const card = after.deck.find((entry) => entry.uid === uid)!;
      if (reward.kind === 'remove') { receipt.removedCards.push({ ...card }); after.deck = after.deck.filter((entry) => entry.uid !== uid); }
      else if (reward.kind === 'upgrade') { card.upgraded = true; receipt.upgradedCards.push({ ...card }); }
      else { const before = { ...card }; card.cardId = option.target!.replacements![uid]; card.upgraded = false; receipt.transformedCards.push({ before, after: { ...card } }); }
    }
  }
  receipt.hpChange = after.hp - basis.hp; receipt.maxHpChange = after.maxHp - basis.maxHp; receipt.goldChange = after.gold - basis.gold;
  receipt.description = [receipt.hpChange ? `HP ${receipt.hpChange > 0 ? '+' : ''}${receipt.hpChange}` : '', receipt.maxHpChange ? `最大HP ${receipt.maxHpChange > 0 ? '+' : ''}${receipt.maxHpChange}` : '', receipt.goldChange ? `ゴールド ${receipt.goldChange > 0 ? '+' : ''}${receipt.goldChange}` : '', ...receipt.addedCards.map((card) => `「${CARD_DEFINITIONS[card.cardId].name}」獲得`), ...receipt.removedCards.map((card) => `「${CARD_DEFINITIONS[card.cardId].name}」削除`), ...receipt.upgradedCards.map((card) => `「${CARD_DEFINITIONS[card.cardId].name}＋」に強化`), ...receipt.transformedCards.map(({ before, after: card }) => `「${CARD_DEFINITIONS[before.cardId].name}」→「${CARD_DEFINITIONS[card.cardId].name}」`), ...receipt.relicIds.map((id) => `「${RELIC_DEFINITIONS[id].name}」獲得`)].filter(Boolean).join(' ／ ');
  return { after, receipt };
}

export function reduceBlessing<T extends BlessingRun>(state: T, action: BlessingAction): T {
  const encounter = state.blessing;
  if (state.screen !== 'blessing' || !encounter) return state;
  if (action.type === 'continueBlessing') {
    if (encounter.stage !== 'result' || !encounter.receipt || !state.blessingHistory?.some((record) => record.encounterId === encounter.id && same(record.receipt, encounter.receipt))) return state;
    const next = structuredClone(state); next.blessing = null; next.screen = 'map'; return next;
  }
  if (encounter.stage === 'result' || state.blessingHistory?.some((record) => record.act === encounter.act)) return state;
  if (action.type === 'chooseBlessing') {
    const option = encounter.options.find((entry) => entry.id === action.optionId);
    if (!option || !isBlessingOptionAvailable(state, option)) return state;
    const next = structuredClone(state);
    next.blessing!.selectedOptionId = option.id; next.blessing!.selectedCardUids = [];
    next.blessing!.stage = option.target ? 'targets' : 'confirm'; return next;
  }
  const option = encounter.options.find((entry) => entry.id === encounter.selectedOptionId);
  if (!option || !isBlessingOptionAvailable(state, option)) return state;
  if (action.type === 'selectBlessingTargets') {
    if (!option.target || !Array.isArray(action.cardUids) || action.cardUids.length > option.target.count || new Set(action.cardUids).size !== action.cardUids.length || action.cardUids.some((uid) => !option.target!.eligibleCardUids.includes(uid))) return state;
    const next = structuredClone(state); next.blessing!.selectedCardUids = [...action.cardUids];
    next.blessing!.stage = action.cardUids.length === option.target.count ? 'confirm' : 'targets'; return next;
  }
  if (action.type !== 'confirmBlessing' || encounter.stage !== 'confirm' || !validSelection(option, encounter.selectedCardUids, true)) return state;
  const result = applyOption(encounter.basis, option, encounter.selectedCardUids, encounter);
  const next = structuredClone(state);
  Object.assign(next, result.after);
  next.stats.cardsAdded += result.receipt.addedCards.length;
  next.blessing!.receipt = result.receipt; next.blessing!.stage = 'result';
  const record: BlessingRecord = { act: encounter.act, encounterId: encounter.id, characterId: encounter.characterId, optionId: option.id, selectedCardUids: [...encounter.selectedCardUids], basis: structuredClone(encounter.basis), option: structuredClone(option), receipt: structuredClone(result.receipt) };
  next.blessingHistory = [...(next.blessingHistory ?? []), record];
  next.log.push(`${BLESSING_CHARACTERS[encounter.characterId].name}の祝福「${option.title}」：${result.receipt.description}`);
  if (next.log.length > 80) next.log.splice(0, next.log.length - 80);
  return next;
}

function validSelection(option: BlessingOption, uids: unknown, complete: boolean): uids is string[] {
  if (!Array.isArray(uids) || uids.some((uid) => typeof uid !== 'string') || new Set(uids).size !== uids.length) return false;
  if (!option.target) return uids.length === 0;
  return uids.length <= option.target.count && (!complete || uids.length === option.target.count) && uids.every((uid) => option.target!.eligibleCardUids.includes(uid));
}
function validOption(seed: string, classId: ClassId | undefined, basis: BlessingBasis, act: number, option: unknown, characterId: BlessingCharacterId): option is BlessingOption {
  try {
    if (!object(option) || typeof option.templateId !== 'string' || !Object.hasOwn(BLESSING_TEMPLATES, option.templateId) || !Array.isArray(option.rewards)) return false;
    const expected = buildOption(seed, classId, basis, act, BLESSING_TEMPLATES[option.templateId], option as unknown as BlessingOption, characterId);
    return expected !== null && same(expected, option);
  } catch { return false; }
}

/** Validate generated effects against authored templates; never regenerate a saved encounter. */
export function isValidBlessingState(state: BlessingRun): boolean {
  try {
    const history = state.blessingHistory;
    if (state.act === undefined) return !state.blessing && (history === undefined || history.length === 0) && state.screen !== 'blessing';
    if (!int(state.act, 1, 3) || !int(state.maxActs, state.act, 3) || !Array.isArray(history) || history.length > 3) return false;
    let previousAct = 0;
    let previousCharacter: string | undefined;
    for (const record of history) {
      if (!object(record) || !int(record.act, 1, state.act) || record.act !== previousAct + 1 || typeof record.characterId !== 'string' || !Object.hasOwn(BLESSING_CHARACTERS, record.characterId) || (record.act === 1 && record.characterId !== 'jitto_god') || record.characterId === previousCharacter || record.encounterId !== encounterId(state.seed, record.act) || !validBasis(record.basis, state.classId) || !validOption(state.seed, state.classId, record.basis, record.act, record.option, record.characterId) || record.optionId !== record.option.id || !validSelection(record.option, record.selectedCardUids, true)) return false;
      if (!BLESSING_CHARACTERS[record.characterId].availableActs.includes(record.act)) return false;
      const expected = applyOption(record.basis, record.option, record.selectedCardUids, { id: record.encounterId, act: record.act, characterId: record.characterId });
      if (!same(expected.receipt, record.receipt)) return false;
      previousAct = record.act; previousCharacter = record.characterId;
    }
    const encounter = state.blessing;
    if (!encounter) return state.screen !== 'blessing' && history.length === state.act;
    if (state.screen !== 'blessing' || encounter.version !== 1 || encounter.act !== state.act || encounter.id !== encounterId(state.seed, state.act) || !Object.hasOwn(BLESSING_CHARACTERS, encounter.characterId) || (encounter.act === 1 && encounter.characterId !== 'jitto_god') || !['offer', 'targets', 'confirm', 'result'].includes(encounter.stage) || !validBasis(encounter.basis, state.classId) || !Array.isArray(encounter.options) || encounter.options.length !== 4 || new Set(encounter.options.map((option) => option.id)).size !== 4 || !encounter.options.some((option) => option.risk === 'safe') || !encounter.options.some((option) => option.risk === 'risky') || !encounter.options.every((option) => validOption(state.seed, state.classId, encounter.basis, encounter.act, option, encounter.characterId))) return false;
    const character = BLESSING_CHARACTERS[encounter.characterId];
    if (!character.availableActs.includes(encounter.act) || !int(encounter.dialogueIndex, 0, character.dialogues.length - 1)) return false;
    const completed = history.find((record) => record.act === encounter.act);
    const preceding = history.filter((record) => record.act < encounter.act).at(-1);
    if (preceding?.characterId === encounter.characterId) return false;
    if (encounter.stage === 'offer') return !completed && history.length === state.act - 1 && encounter.selectedOptionId === null && encounter.selectedCardUids.length === 0 && encounter.receipt === null && same(basisOf(state), encounter.basis);
    const option = encounter.options.find((entry) => entry.id === encounter.selectedOptionId);
    if (!option || !validSelection(option, encounter.selectedCardUids, encounter.stage !== 'targets')) return false;
    if (encounter.stage === 'targets' && (!option.target || encounter.selectedCardUids.length >= option.target.count)) return false;
    if (encounter.stage !== 'result') return !completed && history.length === state.act - 1 && encounter.receipt === null && same(basisOf(state), encounter.basis);
    if (!completed || completed.optionId !== option.id || !same(completed.selectedCardUids, encounter.selectedCardUids) || !same(completed.basis, encounter.basis)) return false;
    const expected = applyOption(encounter.basis, option, encounter.selectedCardUids, encounter);
    return history.length === state.act && same(expected.receipt, encounter.receipt) && same(completed.receipt, encounter.receipt) && same(expected.after, basisOf(state));
  } catch { return false; }
}
