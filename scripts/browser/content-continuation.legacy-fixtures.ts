/** Extend the authentic old boss save using only current public actions. */
import { writeFileSync } from 'node:fs';
import legacy from '../../src/tests/fixtures/pre-content-boss-reward.json';
import { reduceRun } from '../../src/engine/run';
import { deserializeRun, serializeRun } from '../../src/engine/runPersistence';
import type { RunAction } from '../../src/types/run';

const save = JSON.stringify(legacy.save);
const fixtures = [false, true].map((skip) => {
  let state = deserializeRun(save);
  if (!state || state.reward?.cardIds.join(',') !== 'assassin_oppress,assassin_oppress,assassin_oppress')
    throw new Error('The authentic old three-slot reward failed restoration');
  const steps = [];
  for (const action of [{ type: 'takeCard', cardId: skip ? null : 'assassin_oppress' }, { type: 'ascendAct' }] satisfies RunAction[]) {
    const before = state;
    state = reduceRun(state, action);
    if (state === before) throw new Error(`Legacy public action did not advance: ${action.type}`);
    const raw = serializeRun(state);
    if (!deserializeRun(raw)) throw new Error('Legacy continuation did not round-trip');
    if (action.type === 'takeCard' && reduceRun(state, action) !== state) throw new Error('Duplicate reward accepted');
    steps.push({ action, save: raw });
  }
  if (state.act !== 2 || state.screen !== 'blessing' || state.blessing?.options.length !== 4)
    throw new Error('Legacy save did not reach four-choice Act 2 blessing');
  return { name: `legacy-assassin-boss-${skip ? 'skip' : 'take'}`, width: skip ? 390 : 1366, height: skip ? 844 : 768, sourceCommit: legacy.sourceCommit, save, steps };
});
writeFileSync(process.argv[2] ?? '/tmp/spyier-content-legacy-fixtures.json', JSON.stringify({ fixtures }, null, 2));
console.log(JSON.stringify({ fixtures: fixtures.length, sourceCommit: legacy.sourceCommit }));
