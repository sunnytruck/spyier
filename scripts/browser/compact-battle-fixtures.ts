/** Browser-only deterministic stress saves. These snapshots are never distributed with the game.
 * npx esbuild scripts/browser/compact-battle-fixtures.ts --bundle --platform=node --format=esm --outfile=/tmp/spyier-compact-fixtures.mjs
 * node /tmp/spyier-compact-fixtures.mjs /tmp/spyier-compact-fixtures.json
 */
import { writeFileSync } from 'node:fs';
import { CARD_DEFINITIONS } from '../../src/data/cards';
import { CLASS_IDS } from '../../src/data/classes';
import { createCombat, getEnemies, getEnemyKey } from '../../src/engine';
import { createBlessedRun, getAvailableNodes, reduceRun } from '../../src/engine/run';
import { deserializeRun, serializeRun } from '../../src/engine/runPersistence';
import { createRoguelikeDriver } from '../../src/tests/helpers/roguelikeDriver';
import type { ClassId, CombatAction } from '../../src/types/game';
import type { RunState } from '../../src/types/run';
const cards:Record<ClassId,string[]>={
 berserker:['berserker_inflame','berserker_offering','berserker_body_slam','berserker_challenge','berserker_iron_wave'],
 assassin:['assassin_blade_dance','assassin_accuracy','assassin_deadly_poison','assassin_preparation','assassin_survivor'],
 oracle:['oracle_awe','oracle_manifest','oracle_star_burst','oracle_sword_grind','oracle_prophecy'],
 necromancer:['necromancer_bodyguard','necromancer_unleash','necromancer_doom_draw','necromancer_soul_strike','necromancer_negative_wave'],
 machinist:['machinist_zap','machinist_cold_wave','machinist_dual_cast','machinist_hotfix','machinist_defrag'],
};
const save=(state:RunState)=>{
 const value=serializeRun(state);
 if(!deserializeRun(value))throw new Error(`Invalid fixture save: ${state.classId} / ${state.screen}`);
 return value;
};
const fixtures=[];
for(const classId of CLASS_IDS)for(const variant of ['single','triple','large'] as const){
 let run=createBlessedRun(`compact-battle-${classId}`,classId);
 const decide=createRoguelikeDriver('safe',run.seed);
 for(let i=0;run.screen!=='map'&&i<30;i++)run=reduceRun(run,decide(run));
 if(run.screen!=='map')throw new Error('Initial blessing incomplete');
 const selected=[...cards[classId],...Array.from({length:10},(_,i)=>`${classId}_${i%2?'strike':'guard'}`)];
 for(const id of selected)if(!CARD_DEFINITIONS[id])throw new Error(`Unknown card: ${id}`);
 run.deck=selected.map((cardId,index)=>({uid:`compact-${index+1}`,cardId,upgraded:index>=5&&index%2===0}));
 run.nextCardId=100;
 run=reduceRun(run,{type:'chooseNode',nodeId:getAvailableNodes(run).find(node=>node.type==='battle')!.id});
 const combat=run.combat!;
 const all=[...combat.hand,...combat.drawPile];
 combat.hand=run.deck.slice(0,variant==='large'?15:5).map(card=>all.splice(all.findIndex(candidate=>candidate.uid===card.uid),1)[0]);
 combat.drawPile=all;
 if(variant!=='single'){
  const extra=createCombat(`compact-enemies-${classId}`,variant==='large'?['idol_conductor','bell_herald','seam_serpent']:['grit_scout','candle_moth','lost_bell']);
  combat.enemies=extra.enemies;combat.enemy=getEnemies(extra)[0];combat.selectedEnemyId=getEnemyKey(combat.enemy);
 }
 if(variant==='large'){combat.dexterity=2;combat.vigor=4;combat.plate=3;}
 combat.energy=20;run.hp=run.maxHp-12;combat.player.hp=run.hp;combat.player.block=8;
 run.potions=['shale_tonic','magma_flask','muscle_brew'];combat.potions=[...run.potions];
 for(const enemy of getEnemies(combat)){enemy.hp=enemy.maxHp=500;enemy.strength=2;enemy.weak=2;enemy.vulnerable=2;enemy.block=3;}
 if(classId==='berserker')combat.player.strength=4;
 if(classId==='assassin'){combat.powerStacks={knifeDamage:4,knivesOnTurn:1};for(const enemy of getEnemies(combat))enemy.poison=6;}
 if(classId==='oracle')Object.assign(combat.classResources!,{stars:7,starsGainedThisTurn:3,forge:11});
 if(classId==='necromancer'){combat.classResources!.ostyHp=9;for(const enemy of getEnemies(combat))enemy.doom=12;}
 if(classId==='machinist'){
  Object.assign(combat.classResources!,{orbs:variant==='large'?['lightning','frost','lightning','frost','lightning','frost']:['lightning','frost'],focus:2,temporaryFocus:1});
  if(variant==='large')combat.orbSlotBonus=3;
 }
 const raw=save(run);
 const steps=[];
 let after=run;
 for(const card of combat.hand.slice(0,3)){
  const action:CombatAction={type:'playCard',cardId:card.uid};
  after=reduceRun(after,{type:'combat',action});
  steps.push({action,save:save(after)});
 }
 const action:CombatAction={type:'endTurn'};after=reduceRun(after,{type:'combat',action});steps.push({action,save:save(after)});
 fixtures.push({name:`${classId}-${variant}`,classId,variant,save:raw,steps,cardIds:combat.hand.map(card=>card.uid)});
}
// Validate stress saves in Node so browser checks can also run against the
// production bundle, without importing development-only TypeScript URLs.
const detailFixtures: { name: string; save: string }[] = [];
const largeOracle = deserializeRun(fixtures.find((entry) => entry.name === 'oracle-large')!.save)!;
for (let number = 16; number <= 50; number++) {
 const card = { ...largeOracle.deck[5], uid: `compact-${number}` };
 largeOracle.deck.push(card);
 largeOracle.combat!.deck.push({ ...card });
 largeOracle.combat!.hand.push({ ...card });
}
detailFixtures.push({ name: '50-card-last-detail', save: save(largeOracle) });
const disabledMachinist = deserializeRun(fixtures.find((entry) => entry.name === 'machinist-large')!.save)!;
disabledMachinist.combat!.energy = 0;
detailFixtures.push({ name: 'disabled-card-details-no-play', save: save(disabledMachinist) });
writeFileSync(process.argv[2]??'/tmp/spyier-compact-fixtures.json',JSON.stringify({fixtures,detailFixtures},null,2));
console.log(JSON.stringify({fixtures:fixtures.length,detailFixtures:detailFixtures.length,classes:CLASS_IDS}));
