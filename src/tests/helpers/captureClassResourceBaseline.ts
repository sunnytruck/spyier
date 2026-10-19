/**
 * Run this file from an isolated checkout of 60fd02d, never from the changed
 * engine, to regenerate the pre-UI compatibility fixture. See the QA document.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createCombat, getEnemies, reduceCombat } from '../../engine';
import { deserializeGame, serializeGame } from '../../engine/persistence';
import type { ClassId, CombatAction, CombatState } from '../../types/game';

interface Scenario {
  name: string;
  classId: ClassId;
  initial: string;
  steps: { label: string; action: CombatAction; sha256: string; rngState: number }[];
}

const scenarios: Scenario[] = [];
const digest = (raw: string) => createHash('sha256').update(raw).digest('hex');

function battle(classId: ClassId, ids: string[], upgraded = false, multi = false): CombatState {
  const cards = [...ids, ...Array.from({ length: 10 }, () => `${classId}_guard`)];
  const deck = cards.map((cardId, index) => ({ uid: `baseline-${index}`, cardId, upgraded }));
  const state = createCombat(`pre-class-ui-${classId}`, multi ? ['grit_scout', 'candle_moth'] : 'grit_scout', { classId, deck });
  state.hand = deck.slice(0, ids.length);
  state.drawPile = deck.slice(ids.length);
  state.discardPile = [];
  state.exhaustPile = [];
  state.energy = 30;
  for (const enemy of getEnemies(state)) {
    enemy.hp = enemy.maxHp = 500;
    enemy.intent = { kind: 'attack', label: '検証用の二連撃', description: '10ダメージを2回。', damage: 10, hits: 2 };
  }
  return state;
}

function scenario(name: string, start: CombatState, actions: (play: (id: string, label?: string) => void, end: () => void) => void): void {
  let state = start;
  const entry: Scenario = { name, classId: state.classId!, initial: serializeGame(state), steps: [] };
  const step = (action: CombatAction, label: string) => {
    const next = reduceCombat(state, action);
    if (next === state) throw new Error(`${name}: invalid action ${label}`);
    const raw = serializeGame(next);
    if (!deserializeGame(raw)) throw new Error(`${name}: invalid saved result ${label}`);
    entry.steps.push({ label, action, sha256: digest(raw), rngState: next.rngState });
    state = next;
  };
  actions((id, label = id) => {
    const card = state.hand.find((candidate) => candidate.cardId === id);
    if (!card) throw new Error(`${name}: missing ${id}`);
    step({ type: 'playCard', cardId: card.uid }, label);
  }, () => step({ type: 'endTurn' }, 'endTurn'));
  scenarios.push(entry);
}

for (const upgraded of [false, true]) {
  const suffix = upgraded ? 'upgraded' : 'normal';
  const orb = battle('machinist', ['machinist_cold_wave', 'machinist_dual_cast', 'machinist_hotfix', 'machinist_glacier'], upgraded, true);
  orb.classResources!.orbs = ['lightning', 'frost', 'lightning'];
  orb.classResources!.focus = 2;
  scenario(`orbs-overflow-repeat-passive-${suffix}`, orb, (play, end) => {
    play('machinist_cold_wave'); // A full queue evokes its rightmost lightning, then appends frost.
    play('machinist_dual_cast'); // Repeats the same rightmost frost twice; removes it once.
    play('machinist_hotfix');
    play('machinist_glacier');
    end(); // Passives use temporary focus before it expires.
  });

  const negative = battle('machinist', ['machinist_dual_cast', 'machinist_zap', 'machinist_hotfix', 'machinist_cold_wave'], upgraded, true);
  negative.classResources!.orbs = ['frost', 'lightning'];
  negative.classResources!.focus = -6;
  scenario(`orbs-negative-focus-${suffix}`, negative, (play, end) => {
    play('machinist_dual_cast');
    play('machinist_zap');
    play('machinist_hotfix');
    play('machinist_cold_wave');
    end();
  });

  const stars = battle('oracle', ['oracle_awe', 'oracle_star_burst', 'oracle_manifest', 'oracle_sword_grind'], upgraded, true);
  stars.classResources!.stars = 7;
  stars.classResources!.forge = 3;
  scenario(`stars-reference-forge-reset-${suffix}`, stars, (play, end) => {
    play('oracle_awe');
    play('oracle_star_burst'); // Refers to gains this turn; does not spend the star bank.
    play('oracle_manifest');
    play('token_sword');
    play('oracle_sword_grind');
    end();
  });

  const summon = battle('necromancer', ['necromancer_bodyguard', 'necromancer_unleash', 'necromancer_afterlife'], upgraded);
  summon.player.strength = 30;
  summon.player.weak = 3;
  summon.player.block = 2;
  scenario(`summon-attack-block-guard-death-${suffix}`, summon, (play, end) => {
    play('necromancer_bodyguard');
    play('necromancer_unleash'); // Uses summon HP; ignores the summoner's strength and weak.
    play('necromancer_afterlife'); // Reinforcement increases the existing spirit's HP.
    end(); // Shared block first, spirit guard second, player HP last.
  });

  const sweep = battle('necromancer', ['necromancer_soul_strike'], upgraded);
  sweep.classResources!.ostyHp = 9;
  sweep.player.block = 3;
  sweep.enemy.intent = { kind: 'attack', label: '全体検証', description: 'プレイヤーと岩霊に10ダメージ。', damage: 10, allTargets: true };
  scenario(`summon-sweep-independent-hit-${suffix}`, sweep, (play, end) => {
    play('necromancer_soul_strike');
    end();
  });

  const fist = battle('berserker', ['berserker_inflame', 'berserker_offering', 'berserker_body_slam', 'berserker_challenge'], upgraded);
  fist.player.block = 13;
  scenario(`fist-hp-payment-strength-block-multihit-${suffix}`, fist, (play, end) => {
    play('berserker_inflame');
    play('berserker_offering'); // HP payment bypasses block; does not consume it.
    play('berserker_body_slam');
    play('berserker_challenge');
    end();
  });

  const knife = battle('assassin', ['assassin_accuracy', 'assassin_blade_dance', 'assassin_deadly_poison'], upgraded);
  knife.player.strength = 2;
  knife.enemy.block = 12;
  scenario(`knife-generation-bonus-poison-tick-${suffix}`, knife, (play, end) => {
    play('assassin_accuracy');
    play('assassin_blade_dance');
    play('token_knife');
    play('assassin_deadly_poison');
    end();
  });
}

const doom = battle('necromancer', ['necromancer_doom_draw']);
doom.enemy.hp = doom.enemy.maxHp = 13;
scenario('doom-hp-threshold-victory', doom, (play, end) => { play('necromancer_doom_draw'); end(); });
const noStars = battle('oracle', ['oracle_star_burst']);
noStars.classResources!.stars = 19;
scenario('star-bank-alone-does-not-enable-burst', noStars, (play, end) => { play('oracle_star_burst'); end(); });

writeFileSync(process.argv[2] ?? '/tmp/class-resources-before-ui.json', `${JSON.stringify({
  sourceCommit: '60fd02d060c0570850911fd0fc23e6f532a582ba',
  format: 'SHA-256 of complete serializeGame output after each public action',
  scenarios,
}, null, 2)}\n`);
console.log(`Captured ${scenarios.length} scenarios, ${scenarios.reduce((sum, entry) => sum + entry.steps.length, 0)} exact pre-UI outputs.`);
