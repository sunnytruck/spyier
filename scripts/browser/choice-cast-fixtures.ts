/** Focused selection / character-screen fixtures; never imported by the game.
 * npx esbuild scripts/browser/choice-cast-fixtures.ts --bundle --platform=node --format=esm --outfile=/tmp/choice-cast-fixtures.mjs
 * node /tmp/choice-cast-fixtures.mjs /tmp/spyier-choice-cast-fixtures.json
 * Combat factory decks are controlled UI arrangements, not acquisition/balance evidence.
 * Run selection states are reached through normal public campaign actions.
 */
import { writeFileSync } from 'node:fs';
import { CARD_DEFINITIONS } from '../../src/data/cards';
import { CLASS_DEFINITIONS, CLASS_IDS } from '../../src/data/classes';
import { createCombat, reduceCombat } from '../../src/engine';
import { getPendingChoiceCards } from '../../src/engine/actions/choices';
import { deserializeGame, serializeGame } from '../../src/engine/persistence';
import { createBlessedRun, getShopRelicPrice, getShopRemovePrice, reduceRun } from '../../src/engine/run';
import { deserializeRun, serializeRun } from '../../src/engine/runPersistence';
import { createRoguelikeDriver } from '../../src/tests/helpers/roguelikeDriver';
import { getCardPresentation } from '../../src/presentation/cardUpgrade';
import { RELIC_DEFINITIONS } from '../../src/data/relics';
import type { CardInstance, ClassId, CombatState } from '../../src/types/game';
import type { RunAction, RunState } from '../../src/types/run';

function saveCombat(state: CombatState): string { const raw = serializeGame(state); if (!deserializeGame(raw)) throw new Error('Invalid combat fixture'); return raw; }
function saveRun(state: RunState): string { const raw = serializeRun(state); if (!deserializeRun(raw)) throw new Error(`Invalid run fixture ${state.screen}/${state.seed}`); return raw; }
function apply(state: RunState, action: RunAction): RunState { const next = reduceRun(state, action); if (next === state) throw new Error(`Rejected ${action.type} at ${state.screen}`); saveRun(next); return next; }
function cardInfo(card: CardInstance) {
  const definition = CARD_DEFINITIONS[card.cardId];
  return { uid: card.uid, cardId: card.cardId, before: getCardPresentation(card), after: getCardPresentation({ ...card, upgraded: true }), cost: card.upgraded ? definition.upgradedCost ?? definition.cost : definition.cost, upgradedCost: definition.upgradedCost ?? definition.cost };
}

const combatCases = [
  { name: 'discard-one', classId: 'assassin', id: 'assassin_survivor' },
  { name: 'discard-two', classId: 'assassin', id: 'assassin_preparation', upgraded: true },
  { name: 'exhaust-one', classId: 'berserker', id: 'berserker_true_grit', upgraded: true },
  { name: 'retrieve-draw', classId: 'oracle', id: 'blessing_wish' },
  { name: 'topdeck-hand', classId: 'oracle', id: 'colorless_forethought' },
  { name: 'topdeck-discard', classId: 'berserker', id: 'berserker_headbutt', before: ['berserker_anger'] },
  { name: 'retrieve-discard', classId: 'machinist', id: 'machinist_hologram', before: ['machinist_claw', 'machinist_claw'] },
].map((spec) => {
  const classId = spec.classId as ClassId;
  const ids = [spec.id, ...(spec.before ?? []), ...Array.from({ length: 9 - (spec.before?.length ?? 0) }, () => `${classId}_guard`)];
  const deck = ids.map((cardId, index) => ({ uid: `choice-${index + 1}`, cardId, upgraded: index === 0 ? !!spec.upgraded : index === 7 }));
  let state: CombatState | undefined;
  for (let index = 0; index < 120 && !state; index++) {
    let candidate = createCombat(`choice-ui-${spec.name}-${index}`, 'grit_scout', { classId, deck });
    if (![spec.id, ...(spec.before ?? [])].every((id) => candidate.hand.some((card) => card.cardId === id))) continue;
    for (const id of spec.before ?? []) {
      const card = candidate.hand.find((card) => card.cardId === id)!;
      candidate = reduceCombat(candidate, { type: 'playCard', cardId: card.uid });
    }
    const trigger = candidate.hand.find((card) => card.cardId === spec.id)!;
    candidate = reduceCombat(candidate, { type: 'playCard', cardId: trigger.uid });
    if (candidate.pendingChoice) state = candidate;
  }
  if (!state?.pendingChoice) throw new Error(`No real pending choice ${spec.name}`);
  const candidates = getPendingChoiceCards(state);
  const selected = candidates.slice(-state.pendingChoice.amount).map((card) => card.uid);
  const result = reduceCombat(state, { type: 'chooseCards', cardIds: selected });
  if (result === state || result.pendingChoice) throw new Error('Choice did not settle');
  return { name: spec.name, save: saveCombat(state), candidates: candidates.map(cardInfo), amount: state.pendingChoice.amount, mode: state.pendingChoice.mode, selected, result: saveCombat(result) };
});

const runCases: any[] = [];
// Existing acquisition namespaces yield these choices without altering cards or relic state.
for (const [name, relicId, preferred] of [
  ['relic-remove', 'ref_dangerous_scissors', 23],
  ['relic-upgrade', 'ref_pomander', 94],
  ['relic-optional', 'ref_claw', 53],
  ['relic-offer', 'ref_lead_paperweight', 7],
] as const) {
  let found: RunState | undefined;
  const seeds = [preferred, ...Array.from({ length: 4000 }, (_, index) => index)];
  for (const index of seeds) {
    const state = createBlessedRun(`relic-acquisition-legal-${index}`, 'machinist');
    const option = state.blessing!.options.find((entry) => entry.rewards.some((reward) => reward.kind === 'relic' && reward.relicId === relicId));
    if (!option) continue;
    let next = apply(state, { type: 'chooseBlessing', optionId: option.id });
    next = apply(next, { type: 'confirmBlessing' }); next = apply(next, { type: 'continueBlessing' });
    if (next.screen === 'relicAcquisition' && next.relicAcquisition?.stage === 'select') { found = next; break; }
  }
  if (!found) throw new Error(`No real acquisition ${name}`);
  const acq = found.relicAcquisition!;
  const selected = acq.kind === 'chooseCard' ? acq.offeredCardIds.slice(-acq.count) : acq.eligibleCardUids.slice(-acq.count);
  const selection: RunAction = acq.kind === 'chooseCard' ? { type: 'selectRelicCards', cardIds: selected } : { type: 'selectRelicCards', cardUids: selected };
  const ready = apply(found, selection); const result = apply(ready, { type: 'confirmRelicAcquisition' });
  const optional = acq.minCount === 0 ? saveRun(apply(found, { type: 'confirmRelicAcquisition' })) : null;
  runCases.push({ name, save: saveRun(found), ready: saveRun(ready), result: saveRun(result), selected, min: acq.minCount, amount: acq.count, kind: acq.kind, optional, candidates: acq.kind === 'chooseCard' ? acq.offeredCardIds.map((cardId, i) => cardInfo({ uid: `relic-offer-${i}`, cardId, upgraded: false })) : found.deck.filter((card) => acq.eligibleCardUids.includes(card.uid)).map(cardInfo) });
}

let rest = false, shop = false, copy = false;
for (const index of [20, ...Array.from({ length: 80 }, (_, i) => i)]) {
  if (rest && shop && copy) break;
  let state = createBlessedRun(`relic-mirror-legal-${index}`, 'berserker');
  const driver = createRoguelikeDriver('safe', state.seed);
  for (let step = 0; step < 1400 && !['victory', 'defeat'].includes(state.screen); step++) {
    if (!rest && state.screen === 'rest' && state.deck.some((card) => !card.upgraded)) {
      const upgrade = apply(state, { type: 'rest', choice: 'upgrade' });
      const card = upgrade.deck.filter((card) => !card.upgraded).at(-1)!;
      runCases.push({ name: 'rest-upgrade', save: saveRun(upgrade), selected: [card.uid], result: saveRun(apply(upgrade, { type: 'upgradeCard', cardUid: card.uid })), candidates: upgrade.deck.filter((card) => !card.upgraded).map(cardInfo) }); rest = true;
    }
    if (!shop && state.screen === 'shop' && state.gold >= getShopRemovePrice(state) && state.deck.length > 5 && !state.shop?.removed) {
      const card = state.deck.at(-1)!;
      runCases.push({ name: 'shop-remove', save: saveRun(state), selected: [card.uid], result: saveRun(apply(state, { type: 'removeCard', cardUid: card.uid })), candidates: state.deck.map(cardInfo) }); shop = true;
    }
    if (!copy && state.screen === 'shop' && state.shop?.relicId === 'ref_dolly_mirror' && state.gold >= getShopRelicPrice(state)) {
      const acquired = apply(state, { type: 'buyRelic' }); const acq = acquired.relicAcquisition!;
      const selected = acq.eligibleCardUids.slice(-acq.count);
      const ready = apply(acquired, { type: 'selectRelicCards', cardUids: selected });
      runCases.push({ name: 'relic-copy', save: saveRun(acquired), ready: saveRun(ready), selected, result: saveRun(apply(ready, { type: 'confirmRelicAcquisition' })), kind: acq.kind, min: acq.minCount, amount: acq.count, candidates: acquired.deck.map(cardInfo) }); copy = true;
    }
    state = apply(state, driver(state));
    if (rest && shop && copy) break;
  }
}
if (!rest || !shop || !copy) throw new Error(`Missing campaign fixtures ${JSON.stringify({ rest, shop, copy })}`);

const classes = CLASS_IDS.map((id) => {
  const job = CLASS_DEFINITIONS[id]; const seed = `CHOICE-CAST-${id}`;
  return { id, seed, ...job, relic: RELIC_DEFINITIONS[job.starterRelicId], expected: saveRun(createBlessedRun(seed, id)), cards: [...new Set(job.starterDeck)].map((cardId) => ({ ...cardInfo({ uid: `starter-${cardId}`, cardId, upgraded: false }), count: job.starterDeck.filter((id) => id === cardId).length })) };
});
writeFileSync(process.argv[2] ?? '/tmp/spyier-choice-cast-fixtures.json', JSON.stringify({ combat: combatCases, run: runCases, classes }, null, 2));
console.log(JSON.stringify({ combat: combatCases.map((entry) => entry.name), run: runCases.map((entry) => entry.name), classes: classes.length }));
