/** Isolated UI arrangements and real public-action scene transitions.
 * npx esbuild scripts/browser/art-direction-fixtures.ts --bundle --platform=node --format=esm --outfile=/tmp/spyier-art-fixtures.mjs
 * node /tmp/spyier-art-fixtures.mjs /tmp/spyier-art-fixtures.json
 * Battle resources are explicit visual stress arrangements, not balance evidence.
 */
import { writeFileSync } from 'node:fs';
import { CARD_DEFINITIONS } from '../../src/data/cards';
import { CLASS_IDS } from '../../src/data/classes';
import { createCombat, getEnemies, getEnemyKey } from '../../src/engine';
import { createBlessedRun, getAvailableNodes, reduceRun } from '../../src/engine/run';
import { deserializeRun, serializeRun } from '../../src/engine/runPersistence';
import { createRoguelikeDriver } from '../../src/tests/helpers/roguelikeDriver';
import { getCardPresentation } from '../../src/presentation/cardUpgrade';
import type { CardInstance, ClassId, CombatAction } from '../../src/types/game';
import type { RunAction, RunState } from '../../src/types/run';

const cards: Record<ClassId, string[]> = {
  berserker: ['berserker_inflame', 'berserker_offering', 'berserker_body_slam', 'berserker_challenge', 'berserker_iron_wave'],
  assassin: ['assassin_blade_dance', 'assassin_accuracy', 'assassin_deadly_poison', 'assassin_preparation', 'assassin_survivor'],
  oracle: ['oracle_awe', 'oracle_manifest', 'oracle_star_burst', 'oracle_sword_grind', 'oracle_prophecy'],
  necromancer: ['necromancer_bodyguard', 'necromancer_unleash', 'necromancer_doom_draw', 'necromancer_soul_strike', 'necromancer_negative_wave'],
  machinist: ['machinist_zap', 'machinist_cold_wave', 'machinist_dual_cast', 'machinist_hotfix', 'machinist_defrag'],
};
function save(state: RunState): string {
  const raw = serializeRun(state);
  if (!deserializeRun(raw)) throw new Error(`Invalid visual fixture: ${state.classId}/${state.screen}`);
  return raw;
}
function apply(state: RunState, action: RunAction): RunState {
  const next = reduceRun(state, action);
  if (next === state) throw new Error(`Rejected fixture action ${action.type} @ ${state.screen}`);
  save(next);
  return next;
}

const seed = 'IWASON-ART-RITUAL';
let entrance = createBlessedRun(seed, 'berserker');
const option = entrance.blessing!.options.find((candidate) => !candidate.target && candidate.costs.length === 0 &&
  candidate.rewards.every((reward) => ['maxHp', 'heal', 'gold', 'cards'].includes(reward.kind)));
if (!option) throw new Error('No safe direct blessing for public scene flow');
const flow: { action: RunAction; save: string }[] = [];
for (const action of [
  { type: 'chooseBlessing', optionId: option.id },
  { type: 'confirmBlessing' }, { type: 'continueBlessing' },
] as RunAction[]) {
  entrance = apply(entrance, action);
  flow.push({ action, save: save(entrance) });
}
if (entrance.screen !== 'map') throw new Error('Initial blessing did not reach the map');
const firstBattle = getAvailableNodes(entrance).find((node) => node.type === 'battle')!;
const entered = apply(entrance, { type: 'chooseNode', nodeId: firstBattle.id });
flow.push({ action: { type: 'chooseNode', nodeId: firstBattle.id }, save: save(entered) });
const scenes = {
  blessing: save(createBlessedRun(seed, 'berserker')),
  map: save(entrance), battle: save(entered),
};

const fixtures = [];
for (const classId of CLASS_IDS) for (const variant of ['single', 'triple', 'large'] as const) {
  let run = createBlessedRun(`art-direction-${classId}`, classId);
  const decide = createRoguelikeDriver('safe', run.seed);
  for (let step = 0; run.screen !== 'map' && step < 30; step++) run = apply(run, decide(run));
  if (run.screen !== 'map') throw new Error(`Blessing did not finish ${classId}`);
  const selected = [...cards[classId], ...Array.from({ length: 10 }, (_, i) => `${classId}_${i % 2 ? 'strike' : 'guard'}`)];
  selected.forEach((id) => { if (!CARD_DEFINITIONS[id]) throw new Error(`Unknown card ${id}`); });
  run.deck = selected.map((cardId, index): CardInstance => ({ uid: `art-${index + 1}`, cardId, upgraded: index >= 5 && index % 2 === 0 }));
  run.nextCardId = 100;
  run = apply(run, { type: 'chooseNode', nodeId: getAvailableNodes(run).find((node) => node.type === 'battle')!.id });
  const combat = run.combat!;
  const inventory = [...combat.hand, ...combat.drawPile];
  combat.hand = run.deck.slice(0, variant === 'large' ? 15 : 5).map((card) => inventory.splice(inventory.findIndex((held) => held.uid === card.uid), 1)[0]);
  combat.drawPile = inventory;
  if (variant !== 'single') {
    const enemies = createCombat('art-enemy-arrangement', ['grit_scout', 'candle_moth', 'lost_bell']);
    combat.enemies = enemies.enemies;
    combat.enemy = getEnemies(enemies)[0];
    combat.selectedEnemyId = getEnemyKey(combat.enemy);
  }
  combat.energy = 20;
  combat.player.hp = run.hp = run.maxHp - 12;
  combat.player.block = 8;
  run.potions = ['shale_tonic', 'magma_flask', 'muscle_brew'];
  combat.potions = [...run.potions];
  for (const enemy of getEnemies(combat)) { enemy.hp = enemy.maxHp = 500; enemy.strength = 2; enemy.weak = 2; enemy.vulnerable = 2; enemy.block = 3; }
  if (classId === 'berserker') combat.player.strength = 4;
  if (classId === 'assassin') { combat.powerStacks = { knifeDamage: 4, knivesOnTurn: 1 }; getEnemies(combat).forEach((enemy) => enemy.poison = 6); }
  if (classId === 'oracle') Object.assign(combat.classResources!, { stars: 7, starsGainedThisTurn: 3, forge: 11 });
  if (classId === 'necromancer') { combat.classResources!.ostyHp = 9; getEnemies(combat).forEach((enemy) => enemy.doom = 12); }
  if (classId === 'machinist') {
    Object.assign(combat.classResources!, { orbs: variant === 'large' ? ['lightning', 'frost', 'lightning', 'frost', 'lightning', 'frost'] : ['lightning', 'frost'], focus: 2, temporaryFocus: 1 });
    if (variant === 'large') combat.orbSlotBonus = 3;
  }
  const raw = save(run);
  const steps = [];
  let current = run;
  for (const card of combat.hand.slice(0, 3)) {
    const action: CombatAction = { type: 'playCard', cardId: card.uid };
    current = apply(current, { type: 'combat', action });
    steps.push({ action, save: save(current) });
  }
  const action: CombatAction = { type: 'endTurn' };
  current = apply(current, { type: 'combat', action });
  steps.push({ action, save: save(current) });
  const primary = run.deck[0];
  const upgraded = run.deck.find((card) => card.upgraded)!;
  const presentation = (card: CardInstance) => ({ ...getCardPresentation(card), cost: card.upgraded ? CARD_DEFINITIONS[card.cardId].upgradedCost ?? CARD_DEFINITIONS[card.cardId].cost : CARD_DEFINITIONS[card.cardId].cost });
  fixtures.push({ name: `${classId}-${variant}`, classId, variant, save: raw, steps,
    preview: { cardId: primary.cardId, before: presentation(primary), after: presentation({ ...primary, upgraded: true }), upgradedId: upgraded.cardId, upgraded: presentation(upgraded) } });
}

const stress = [];
const statuses = deserializeRun(fixtures.find((fixture) => fixture.name === 'berserker-triple')!.save)!;
Object.assign(statuses.combat!.player, { weak: 2, vulnerable: 2, poison: 3 });
Object.assign(statuses.combat!, { dexterity: 2, vigor: 4, plate: 3, intangible: 1, stillness: 2 });
stress.push({ name: 'berserker-status-density', classId: 'berserker', mode: 'statuses', save: save(statuses) });
const fifty = deserializeRun(fixtures.find((fixture) => fixture.name === 'oracle-large')!.save)!;
for (let number = 16; number <= 50; number++) {
  const card = { ...fifty.deck[5], uid: `art-${number}` };
  fifty.deck.push(card); fifty.combat!.deck.push({ ...card }); fifty.combat!.hand.push({ ...card });
}
stress.push({ name: 'oracle-50-cards', classId: 'oracle', save: save(fifty) });
for (const capacity of [9, 27]) {
  const run = deserializeRun(fixtures.find((fixture) => fixture.name === 'machinist-large')!.save)!;
  run.combat!.orbSlotBonus = capacity - 3;
  run.combat!.classResources!.orbs = Array.from({ length: capacity }, (_, i) => i % 2 ? 'frost' : 'lightning');
  stress.push({ name: `machinist-${capacity}-orbs`, classId: 'machinist', capacity, save: save(run) });
}

writeFileSync(process.argv[2] ?? '/tmp/spyier-art-fixtures.json', JSON.stringify({ seed, optionId: option.id, flow, scenes, fixtures, stress }, null, 2));
console.log(JSON.stringify({ seed, fixtures: fixtures.length, stress: stress.length, flow: flow.length }));
