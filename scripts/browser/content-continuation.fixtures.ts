/** Isolated browser fixtures, never shipped in the application bundle.
 * npx esbuild scripts/browser/content-continuation.fixtures.ts --bundle --platform=node --format=esm --outfile=/tmp/spyier-content-fixtures.mjs
 * node /tmp/spyier-content-fixtures.mjs /tmp/spyier-content-fixtures.json
 */
import { writeFileSync } from 'node:fs';
import { CARD_DEFINITIONS } from '../../src/data/cards';
import { CLASS_DEFINITIONS, CLASS_IDS } from '../../src/data/classes';
import { RELIC_DEFINITIONS } from '../../src/data/relics';
import { getEnemies, getEnemyKey } from '../../src/engine';
import { createBlessedRun, getAvailableNodes, reduceRun } from '../../src/engine/run';
import { deserializeRun, serializeRun } from '../../src/engine/runPersistence';
import { getCardPresentation } from '../../src/presentation/cardUpgrade';
import { createRoguelikeDriver } from '../../src/tests/helpers/roguelikeDriver';
import type { CardInstance, ClassId, CombatAction } from '../../src/types/game';
import type { RunState } from '../../src/types/run';

const playable: Record<ClassId, string[]> = {
  berserker: ['berserker_stone_armor', 'berserker_uppercut', 'berserker_disarm_strike'],
  assassin: ['assassin_anticipation', 'assassin_footwork', 'assassin_leg_sweep'],
  oracle: ['oracle_buckler_deploy', 'oracle_terraform', 'oracle_embodied_authority'],
  necromancer: ['necromancer_friendship', 'necromancer_no_escape', 'necromancer_spirit_extraction'],
  machinist: ['machinist_capacitor', 'machinist_biased_cognition', 'machinist_lightning_rod'],
};

function save(state: RunState): string {
  const value = serializeRun(state);
  if (!deserializeRun(value)) throw new Error(`Invalid browser fixture ${state.classId}`);
  return value;
}

const fixtures = CLASS_IDS.map((classId) => {
  let run = createBlessedRun(`content-continuation-browser-${classId}`, classId);
  const decide = createRoguelikeDriver('safe', run.seed);
  for (let step = 0; run.screen !== 'map' && step < 30; step++) run = reduceRun(run, decide(run));
  if (run.screen !== 'map') throw new Error('Failed to finish real blessing actions');
  // Fixture setup deliberately supplies new content to every class. It verifies
  // rendering/actions and exact saves; it does not simulate acquisition odds.
  const firstId = playable[classId][0];
  run.deck = [...playable[classId], firstId, `${classId}_strike`, `${classId}_guard`]
    .map((cardId, index): CardInstance => ({ uid: `content-${index + 1}`, cardId, upgraded: index === 1 || index === 3 }));
  run.nextCardId = 100;
  run.relicIds = [CLASS_DEFINITIONS[classId].starterRelicId, 'ref_pen_nib', 'ref_resonant_triangle'];
  run.potions = ['shale_tonic', 'magma_flask', 'muscle_brew'];
  run = reduceRun(run, { type: 'chooseNode', nodeId: getAvailableNodes(run).find((node) => node.type === 'battle')!.id });
  const combat = run.combat!;
  const inventory = [...combat.hand, ...combat.drawPile];
  combat.hand = run.deck.map((card) => inventory.splice(inventory.findIndex((held) => held.uid === card.uid), 1)[0]);
  combat.drawPile = inventory;
  combat.energy = 20;
  combat.player.hp = run.hp = Math.min(60, run.maxHp);
  for (const enemy of getEnemies(combat)) { enemy.hp = enemy.maxHp = 500; enemy.block = 0; }
  combat.selectedEnemyId = getEnemyKey(getEnemies(combat)[0]);
  if (classId === 'oracle') Object.assign(combat.classResources!, { stars: 7, starsGainedThisTurn: 3, forge: 9 });
  if (classId === 'necromancer') combat.classResources!.ostyHp = 8;
  if (classId === 'machinist') Object.assign(combat.classResources!, { orbs: ['lightning', 'frost'], focus: 1 });
  if (classId === 'assassin') combat.powerStacks = { knifeDamage: 2 };

  const initial = save(run);
  const steps = [];
  let current = run;
  for (const card of combat.hand.slice(0, 3)) {
    const action: CombatAction = { type: 'playCard', cardId: card.uid };
    current = reduceRun(current, { type: 'combat', action });
    if (current === run) throw new Error(`Card did not play: ${card.cardId}`);
    steps.push({ action, save: save(current) });
  }
  const action: CombatAction = { type: 'endTurn' };
  current = reduceRun(current, { type: 'combat', action });
  steps.push({ action, save: save(current) });
  const normalCard = { ...run.deck[0], upgraded: false };
  const upgradedCard = { ...normalCard, upgraded: true };
  const definition = CARD_DEFINITIONS[firstId];
  return {
    classId, name: `new-content-${classId}`, save: initial, steps,
    normal: { ...getCardPresentation(normalCard), cost: definition.cost },
    upgraded: { ...getCardPresentation(upgradedCard), cost: definition.upgradedCost ?? definition.cost },
    primaryCardId: firstId,
    relics: run.relicIds.map((id) => ({ id, name: RELIC_DEFINITIONS[id].name, description: RELIC_DEFINITIONS[id].description })),
  };
});
const stressFixtures = [9, 27].map((capacity) => {
  const run = deserializeRun(fixtures.find((fixture) => fixture.classId === 'machinist')!.save)!;
  run.combat!.orbSlotBonus = capacity - 3;
  run.combat!.classResources!.orbs = Array.from({ length: capacity }, (_, index) => index % 2 ? 'frost' : 'lightning');
  return { classId: 'machinist', name: `machinist-${capacity}-slots`, mode: 'orbs', capacity, save: save(run) };
});
writeFileSync(process.argv[2] ?? '/tmp/spyier-content-fixtures.json', JSON.stringify({ fixtures, stressFixtures }, null, 2));
console.log(JSON.stringify({ fixtures: fixtures.length, stressFixtures: stressFixtures.length, actions: fixtures.reduce((sum, item) => sum + item.steps.length, 0) }));
