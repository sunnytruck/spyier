/** Focused fixtures for map / blessing confirmation UI, using legal public actions.
 * npx esbuild scripts/browser/two-screens-fixtures.ts --bundle --platform=node --format=esm --outfile=/tmp/two-screens-fixtures.mjs
 * node /tmp/two-screens-fixtures.mjs /tmp/spyier-two-screens-fixtures.json
 */
import { writeFileSync } from 'node:fs';
import { CARD_DEFINITIONS } from '../../src/data/cards';
import { getBlessingTargetCards, isBlessingOptionAvailable } from '../../src/engine/blessings';
import { createBlessedRun, getAvailableNodes, reduceRun } from '../../src/engine/run';
import { deserializeRun, serializeRun } from '../../src/engine/runPersistence';
import { createRoguelikeDriver } from '../../src/tests/helpers/roguelikeDriver';
import type { BlessingOption } from '../../src/types/blessing';
import type { RunAction, RunState } from '../../src/types/run';

function saved(state: RunState): string {
  const raw = serializeRun(state);
  if (!deserializeRun(raw)) throw new Error(`Invalid fixture ${state.seed}/${state.screen}`);
  return raw;
}
function apply(state: RunState, action: RunAction): RunState {
  const next = reduceRun(state, action);
  if (next === state) throw new Error(`Invalid fixture action ${action.type}`);
  saved(next);
  return next;
}

const predicates: Record<string, (option: BlessingOption) => boolean> = {
  safe: (option) => !option.target && option.costs.length === 0 && option.rewards.every((reward) => ['heal', 'maxHp', 'gold', 'cards'].includes(reward.kind)),
  curse: (option) => !option.target && option.costs.some((cost) => cost.kind === 'curse'),
  upgrade: (option) => option.target?.kind === 'upgrade' && option.target.count === 2,
  remove: (option) => option.target?.kind === 'remove',
  transform: (option) => option.target?.kind === 'transform',
};

const cases = Object.entries(predicates).map(([name, predicate]) => {
  let found: { state: RunState; option: BlessingOption } | undefined;
  for (let index = 0; index < 400 && !found; index++) {
    const state = createBlessedRun(`two-screens-${name}-${index}`, 'oracle');
    const option = state.blessing!.options.find((entry) => predicate(entry) && isBlessingOptionAvailable(state, entry));
    if (option) found = { state, option };
  }
  if (!found) throw new Error(`No legal blessing fixture: ${name}`);
  const { state, option } = found;
  const selected = apply(state, { type: 'chooseBlessing', optionId: option.id });
  // Last-row cards stress the sticky altar footer instead of only the first row.
  const targets = option.target ? getBlessingTargetCards(selected).slice(-option.target.count) : [];
  const partial: string[] = [];
  let ready = selected;
  for (let index = 0; index < targets.length; index++) {
    ready = apply(ready, { type: 'selectBlessingTargets', cardUids: targets.slice(0, index + 1).map((card) => card.uid) });
    partial.push(saved(ready));
  }
  const result = apply(ready, { type: 'confirmBlessing' });
  const continued = apply(result, { type: 'continueBlessing' });
  return {
    name, seed: state.seed, option, offer: saved(state), selected: saved(selected), targets, partial,
    ready: saved(ready), result: saved(result), continued: saved(continued),
    curseCards: option.costs.flatMap((cost) => cost.kind === 'curse' ? [CARD_DEFINITIONS[cost.cardId]] : []),
  };
});

const entrance = deserializeRun(cases.find((entry) => entry.name === 'safe')!.continued)!;
if (entrance.screen !== 'map') throw new Error('Safe blessing did not reach map');
const driver = createRoguelikeDriver('safe', entrance.seed);
let progressed = entrance;
for (let step = 0; step < 500 && (progressed.screen !== 'map' || progressed.floor < 2); step++) progressed = apply(progressed, driver(progressed));
if (progressed.screen !== 'map' || progressed.floor < 2) throw new Error('Could not reach a legal progressed map');
const maps = [entrance, progressed].map((state, index) => {
  const action: RunAction = { type: 'chooseNode', nodeId: getAvailableNodes(state)[0].id };
  return {
    name: index ? 'progressed' : 'entrance', save: saved(state), action, result: saved(apply(state, action)),
    nodes: state.map.nodes, visited: state.visited, currentNodeId: state.currentNodeId,
    availableIds: getAvailableNodes(state).map((node) => node.id),
  };
});

writeFileSync(process.argv[2] ?? '/tmp/spyier-two-screens-fixtures.json', JSON.stringify({ cases, maps }, null, 2));
console.log(JSON.stringify({ maps: maps.length, blessings: cases.map((entry) => ({ name: entry.name, targets: entry.targets.length })) }));
