/** Generate real saved relic flows using public game actions only.
 * npx esbuild scripts/browser/relic-ui-fixtures.ts --bundle --platform=node --format=esm --outfile=/tmp/spyier-relic-ui-fixtures.mjs
 * node /tmp/spyier-relic-ui-fixtures.mjs /tmp/spyier-relic-ui-final-fixtures.json
 * No HP/deck/stock/outcome injections are used in these campaign snapshots.
 */
import {writeFileSync} from 'node:fs';
import {CLASS_IDS} from '../../src/data/classes';
import {CARD_DEFINITIONS} from '../../src/data/cards';
import {RELIC_DEFINITIONS} from '../../src/data/relics';
import {createBlessedRun,reduceRun,getAvailableNodes,canChooseEvent,canAscendAct,getShopRelicPrice,getShopCardPrice,getShopPotionPrice,getShopRemovePrice} from '../../src/engine/run';
import {serializeRun,deserializeRun} from '../../src/engine/runPersistence';
import {createRoguelikeDriver} from '../../src/tests/helpers/roguelikeDriver';
import {EVENT_DEFINITIONS} from '../../src/data/events';
import type {RunState,RunAction} from '../../src/types/run';
const fixtures:any[]=[];const facts:any={};
function apply(s:RunState,a:RunAction):RunState{const n=reduceRun(s,a);if(n===s)throw new Error(`Rejected ${a.type}@${s.screen}`);if(!deserializeRun(serializeRun(n)))throw new Error(`Invalid ${a.type}@${s.screen}:${s.seed}`);return n;}
function add(name:string,s:RunState,actions:RunAction[]){const save=serializeRun(s),steps:any[]=[];for(const a of actions){s=apply(s,a);steps.push({action:a,after:serializeRun(s)});}fixtures.push({name,classId:s.classId,save,steps});return s;}
function acqActions(s:RunState){const result:RunAction[]=[];if(s.screen!=='relicAcquisition')return result;const a=s.relicAcquisition!;if(a.stage==='select'){let selected:string[]=[];for(const id of (a.kind==='chooseCard'?a.offeredCardIds:a.eligibleCardUids).slice(0,a.count)){selected.push(id);result.push(a.kind==='chooseCard'?{type:'selectRelicCards',cardIds:[...selected]}:{type:'selectRelicCards',cardUids:[...selected]});}result.push({type:'confirmRelicAcquisition'});}result.push({type:'continueRelicAcquisition'});return result;}
const seen=new Set<string>();
for(let i=0;i<2500&&seen.size<5;i++){
 let s=createBlessedRun(`relic-acquisition-legal-${i}`,'machinist');
 for(const opt of s.blessing!.options){const r=opt.rewards.find(r=>r.kind==='relic');if(!r||r.kind!=='relic')continue;const d=RELIC_DEFINITIONS[r.relicId];if(d.acquisition!=='ancient')continue;const sel=d.runEffect?.acquire?.find(o=>o.type==='select');const k=sel?.type==='select'?sel.kind:d.runEffect?.acquire?.some(o=>o.type==='upgradeStarter')?'starterUpgrade':null;if(!k||seen.has(k))continue;
  let n=apply(s,{type:'chooseBlessing',optionId:opt.id});n=apply(n,{type:'confirmBlessing'});n=apply(n,{type:'continueBlessing'});if(n.screen!=='relicAcquisition')throw new Error('No acquisition '+k);
  const actions:RunAction[]=[{type:'chooseBlessing',optionId:opt.id},{type:'confirmBlessing'},{type:'continueBlessing'},...acqActions(n)];add(`ancient-${k}`,s,actions);seen.add(k);facts[k]={seed:s.seed,relic:d.name};
 }
}
if(!['remove','upgrade','transform','chooseCard','starterUpgrade'].every(k=>seen.has(k)))throw new Error(JSON.stringify([...seen]));
let bossCount=0,shop=false,copy=false,event=false,discount=false,act2=false;
for(const cls of CLASS_IDS){
 let reached=false;
 for(let attempt=0;attempt<12&&!reached;attempt++){
  const seed=`relic-boss-${cls}-${attempt}`;let s=createBlessedRun(seed,cls);const decide=createRoguelikeDriver('safe',seed);
  for(let step=0;step<1800&&!['victory','defeat'].includes(s.screen);step++){
   if(s.screen==='reward'&&s.reward?.completesRun){let end=add(`boss-${cls}`,s,[{type:'takeCard',cardId:s.reward.cardIds[0]}]);add(`boss-skip-${cls}`,s,[{type:'takeCard',cardId:null}]);if(!act2&&canAscendAct(end)){add('boss-to-next-act',end,[{type:'ascendAct'}]);act2=true;}bossCount++;reached=true;break;}
   if(s.screen==='event'&&s.eventId?.startsWith('relic_')&&!event){const idx=EVENT_DEFINITIONS[s.eventId].choices.findIndex((c,i)=>canChooseEvent(s,i)&&c.effects.some(e=>e.type==='relic'&&e.relicId));if(idx>=0){let n=apply(s,{type:'eventChoice',index:idx});n=apply(n,{type:'continueEvent'});if(n.screen==='relicAcquisition'){add('question-event-relic',s,[{type:'eventChoice',index:idx},{type:'continueEvent'},...acqActions(n)]);event=true;}}}
   if(s.screen==='shop'&&s.shop?.relicId&&!shop&&s.gold>=getShopRelicPrice(s)){let n=apply(s,{type:'buyRelic'});add('shop-purchase',s,[{type:'buyRelic'},...acqActions(n)]);shop=true;}
   s=apply(s,decide(s));
  }
 }
 if(!reached)throw new Error('No boss '+cls);
}
for(let i=0;i<160&&(!copy||!discount);i++){
 const seed=`relic-mirror-legal-${i}`;let s=createBlessedRun(seed,'berserker'),decide=createRoguelikeDriver('safe',seed);
 for(let step=0;step<1800&&!['victory','defeat'].includes(s.screen);step++){
  if(s.screen==='shop'&&s.shop?.relicId==='ref_dolly_mirror'&&s.gold>=getShopRelicPrice(s)&&!copy){const n=apply(s,{type:'buyRelic'});add('shop-copy',s,[{type:'buyRelic'},...acqActions(n)]);copy=true;}
  if(s.screen==='shop'&&s.shop?.relicId==='ref_membership_card'&&s.gold>=getShopRelicPrice(s)&&!discount){let n=apply(s,{type:'buyRelic'});n=apply(n,{type:'continueRelicAcquisition'});const prices={relic:getShopRelicPrice(n),potion:getShopPotionPrice(n),remove:getShopRemovePrice(n),cards:n.shop!.cardIds.map(id=>({id,price:getShopCardPrice(n,id)}))};add('shop-membership-discount',s,[{type:'buyRelic'},{type:'continueRelicAcquisition'}]);facts.discount=prices;discount=true;}
  s=apply(s,decide(s));
 }
}
if(!copy||!discount||!event||!shop||bossCount!==5||!act2)throw new Error(JSON.stringify({copy,discount,event,shop,bossCount,act2}));
writeFileSync(process.argv[2] ?? '/tmp/spyier-relic-ui-final-fixtures.json',JSON.stringify({fixtures,facts,relics:RELIC_DEFINITIONS,definitions:CARD_DEFINITIONS},null,2));console.log(JSON.stringify({fixtures:fixtures.length,facts}));
