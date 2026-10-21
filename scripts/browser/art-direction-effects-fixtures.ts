/** Real reducer outcomes and cue metadata for the Phase 5 browser FX checks.
 * npx esbuild scripts/browser/art-direction-effects-fixtures.ts --bundle --platform=node --format=esm --outfile=/tmp/spyier-art-effects-fixtures.mjs
 * node /tmp/spyier-art-effects-fixtures.mjs /tmp/spyier-art-current-fixtures.json /tmp/spyier-art-effects-fixtures.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { reduceRun } from '../../src/engine/run';
import { deserializeRun, serializeRun } from '../../src/engine/runPersistence';
import { captureCombatTransition } from '../../src/presentation/trace';
import type { CombatAction } from '../../src/types/game';

const source = JSON.parse(readFileSync(process.argv[2] ?? '/tmp/spyier-art-current-fixtures.json', 'utf8'));
const cases = [];
for (const [name, classId, action, shield] of [
  ['single-attack', 'berserker', { type: 'playCard', cardId: 'art-7' }],
  ['multi-attack', 'berserker', { type: 'playCard', cardId: 'art-4' }],
  ['defend', 'berserker', { type: 'playCard', cardId: 'art-6' }],
  ['shield-contact', 'berserker', { type: 'playCard', cardId: 'art-7' }, true],
  ['hp-sacrifice', 'berserker', { type: 'playCard', cardId: 'art-2' }],
  ['enemy-turn', 'berserker', { type: 'endTurn' }],
  ['guardian-turn', 'necromancer', { type: 'endTurn' }],
] as [string, string, CombatAction, boolean?][]) {
  const run = deserializeRun(source.fixtures.find((fixture: { name: string }) => fixture.name === `${classId}-large`).save)!;
  if (shield) run.combat!.enemies!.forEach((enemy) => enemy.block = 100);
  const before = serializeRun(run);
  const trace = captureCombatTransition(run.combat!, () => reduceRun(run, { type: 'combat', action }));
  const after = serializeRun(trace.result);
  if (after === before || !deserializeRun(before) || !deserializeRun(after)) throw new Error(`Invalid FX case: ${name}`);
  cases.push({ name, save: before, action, expectedSave: after,
    cues: trace.cues.map(({ kind, sourceId, targetId, effect, amount, blocked, absorbed }) => ({ kind, sourceId, targetId, effect, amount, blocked, absorbed })),
  });
}
writeFileSync(process.argv[3] ?? '/tmp/spyier-art-effects-fixtures.json', JSON.stringify({ cases }, null, 2));
console.log(JSON.stringify({ cases: cases.length }));
