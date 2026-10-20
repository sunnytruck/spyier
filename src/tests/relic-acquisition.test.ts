import { describe, expect, it } from 'vitest';
import { ACQUISITION_RELIC_DEFINITIONS } from '../data/acquisitionRelics';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import { RELIC_DEFINITIONS, STARTER_RELIC_IDS, STARTER_UPGRADE_IDS } from '../data/relics';
import { RELIC_EVENT_DEFINITIONS } from '../data/relicEvents';
import { createRun } from '../engine/run';
import { acquireRelic, addRelicAwareCard, applyOwnedRelicAcquisition, canAcquireRelic, consumeRelicNextBattleEnergy, gainRunGold, getRelicAwareHpLoss, getRelicShopPrice, isValidRelicAcquisitionState, loseRelicAwareHp, onRelicRest, onRelicRoomEntered, onRelicVictory, reduceRelicAcquisition } from '../engine/relicAcquisition';
import type { RunState } from '../types/run';

function run(): RunState {
  const state = createRun('relic-acquisition-proof', 'berserker');
  state.relicIds = [STARTER_RELIC_IDS.berserker];
  state.hp = 40;
  // Four skills and six attacks are sufficient for every exact-count selection.
  return state;
}
function selectAndConfirm(state: RunState): RunState {
  const pending = state.relicAcquisition!;
  if (pending.stage === 'result') return state;
  const selected = pending.kind === 'chooseCard'
    ? { cardIds: pending.offeredCardIds.slice(0, pending.minCount) }
    : { cardUids: pending.eligibleCardUids.slice(0, Math.max(pending.minCount, pending.count > 0 ? 1 : 0)) };
  return reduceRelicAcquisition(reduceRelicAcquisition(state, { type: 'selectRelicCards', ...selected }), { type: 'confirmRelicAcquisition' });
}

describe('reference acquisition definitions execute through saved transactions', () => {
  it.each(Object.values(ACQUISITION_RELIC_DEFINITIONS).map((definition) => [definition.id, definition.name]))('%s (%s) acquires and round-trips without duplicate claims', (id) => {
    const original = run();
    expect(canAcquireRelic(original, id)).toBe(true);
    const category = RELIC_DEFINITIONS[id].acquisition;
    const source = category === 'ancient' ? 'blessing' : category === 'shop' ? 'shop' : category === 'event' ? 'event' : 'reward';
    const acquired = acquireRelic(original, id, source, source === 'shop' ? 'shop' : 'map');
    expect(original.relicIds).not.toContain(id);
    expect(acquired.screen).toBe('relicAcquisition');
    expect(isValidRelicAcquisitionState(JSON.parse(JSON.stringify(acquired)))).toBe(true);
    const committed = selectAndConfirm(acquired);
    expect(committed.relicAcquisition!.stage).toBe('result');
    expect(committed.rngState).toBe(original.rngState);
    expect(isValidRelicAcquisitionState(JSON.parse(JSON.stringify(committed)))).toBe(true);
    expect(reduceRelicAcquisition(committed, { type: 'confirmRelicAcquisition' })).toBe(committed);
    const resumed = reduceRelicAcquisition(committed, { type: 'continueRelicAcquisition' });
    expect(resumed.screen).toBe(source === 'shop' ? 'shop' : 'map');
    expect(acquireRelic(resumed, id, 'reward', 'map')).toBe(resumed);
    expect(applyOwnedRelicAcquisition(resumed, id, 'blessing', 'map', 'forged-repeat')).toBe(resumed);
  });

  it.each([['ref_strawberry', 7], ['ref_pear', 10], ['ref_mango', 14], ['ref_nutritious_oyster', 11], ['ref_giant_fruit', 31], ['ref_mango_imitation', 3]] as const)('%s raises max HP by %d without inventing healing', (id, amount) => {
    const state = run(); const next = acquireRelic(state, id, RELIC_DEFINITIONS[id].acquisition === 'ancient' ? 'blessing' : RELIC_DEFINITIONS[id].acquisition === 'event' ? 'event' : 'reward', 'map');
    expect(next.maxHp).toBe(state.maxHp + amount); expect(next.hp).toBe(state.hp);
  });

  it('waffle raises max HP by seven and explicitly heals to the new maximum', () => {
    const state = run(); const next = acquireRelic(state, 'ref_lee_waffle', 'shop', 'shop');
    expect(next.maxHp).toBe(87); expect(next.hp).toBe(87);
  });

  it('acquisition and other gold use the 25% bonus once, floored once', () => {
    const state = run(); state.relicIds.push('ref_bowler_hat');
    const next = acquireRelic(state, 'ref_old_coin', 'reward', 'map');
    expect(next.gold - state.gold).toBe(375);
    expect(gainRunGold(next, 15)).toBe(18);
  });

  it('ectoplasm prevents every gain helper and excludes useless immediate-gold acquisitions', () => {
    const state = run(); state.relicIds.push('ref_ectoplasm'); const before = state.gold;
    expect(gainRunGold(state, 300)).toBe(0); expect(state.gold).toBe(before);
    expect(canAcquireRelic(state, 'ref_golden_pearl')).toBe(false);
  });

  it('dragon fruit grants one max HP per successful gold award, never per coin or a blocked gain', () => {
    const state = run(); state.relicIds.push('ref_dragon_fruit');
    gainRunGold(state, 300); expect(state.maxHp).toBe(81); expect(state.hp).toBe(40);
    gainRunGold(state, 1); expect(state.maxHp).toBe(82);
    state.relicIds.push('ref_ectoplasm'); gainRunGold(state, 100); expect(state.maxHp).toBe(82);
  });

  it('membership discount applies to a supplied original price without compounding', () => {
    const state = run(); state.relicIds.push('ref_membership_card');
    expect(getRelicShopPrice(state, 95)).toBe(47);
    expect(getRelicShopPrice(state, 150)).toBe(75);
  });

  it('war paint chooses skills and whetstone chooses attacks, at most two distinct cards each', () => {
    for (const [id, type] of [['ref_war_paint', 'skill'], ['ref_whetstone', 'attack']] as const) {
      const next = acquireRelic(run(), id, 'reward', 'map');
      const upgraded = next.deck.filter((card) => card.upgraded);
      expect(upgraded).toHaveLength(2);
      expect(upgraded.every((card) => CARD_DEFINITIONS[card.cardId].type === type)).toBe(true);
    }
  });

  it('target selection never changes the deck, costs, or seeded replacement outcomes', () => {
    const original = run(); const pending = acquireRelic(original, 'ref_astrolabe', 'blessing', 'map');
    const snapshot = structuredClone(pending.relicAcquisition!.replacements);
    const targetUids = pending.deck.slice(0, 3).map((card) => card.uid);
    let selected = reduceRelicAcquisition(pending, { type: 'selectRelicCards', cardUids: targetUids });
    expect(selected.deck).toEqual(original.deck); expect(selected.hp).toBe(original.hp);
    expect(selected.rngState).toBe(original.rngState); expect(selected.relicAcquisition!.replacements).toEqual(snapshot);
    selected = JSON.parse(JSON.stringify(selected));
    const next = reduceRelicAcquisition(selected, { type: 'confirmRelicAcquisition' });
    expect(targetUids.every((uid) => !next.deck.some((card) => card.uid === uid))).toBe(true);
    expect(next.relicAcquisition!.receipt!.addedCards).toHaveLength(3);
    expect(next.relicAcquisition!.receipt!.addedCards.every((card) => card.upgraded && targetUids.some((uid) => snapshot[uid] === card.cardId))).toBe(true);
  });

  it('rejects duplicate, unavailable, wrong-domain, and insufficient selections', () => {
    const state = acquireRelic(run(), 'ref_empty_cage', 'blessing', 'map'); const uid = state.deck[0].uid;
    expect(reduceRelicAcquisition(state, { type: 'selectRelicCards', cardUids: [uid, uid] })).toBe(state);
    expect(reduceRelicAcquisition(state, { type: 'selectRelicCards', cardUids: ['missing'] })).toBe(state);
    expect(reduceRelicAcquisition(state, { type: 'selectRelicCards', cardIds: [state.deck[0].cardId] })).toBe(state);
    expect(reduceRelicAcquisition(state, { type: 'confirmRelicAcquisition' })).toBe(state);
    expect(reduceRelicAcquisition(state, { type: 'continueRelicAcquisition' })).toBe(state);
  });

  it('dangerous scissors charges exactly 16 HP and removes exactly two only on commit', () => {
    const original = run(); let next = acquireRelic(original, 'ref_dangerous_scissors', 'blessing', 'map');
    expect(next.hp).toBe(40); next = selectAndConfirm(next);
    expect(next.hp).toBe(24); expect(next.deck).toHaveLength(original.deck.length - 2);
    const tooWeak = run(); tooWeak.hp = 16;
    expect(canAcquireRelic(tooWeak, 'ref_dangerous_scissors')).toBe(false);
  });

  it('claw permits zero to six targets and uses the actual existing blessing-only rending ID', () => {
    const state = acquireRelic(run(), 'ref_claw', 'blessing', 'map');
    expect(reduceRelicAcquisition(state, { type: 'confirmRelicAcquisition' }).deck).toEqual(state.deck);
    const selected = reduceRelicAcquisition(state, { type: 'selectRelicCards', cardUids: state.deck.slice(0, 6).map((card) => card.uid) });
    const next = reduceRelicAcquisition(selected, { type: 'confirmRelicAcquisition' });
    expect(next.deck.filter((card) => card.cardId === 'blessing_rending')).toHaveLength(6);
  });

  it('lead paperweight offers exactly two normal colorless cards, never blessing/token cards', () => {
    const state = acquireRelic(run(), 'ref_lead_paperweight', 'blessing', 'map');
    expect(state.relicAcquisition!.offeredCardIds).toHaveLength(2);
    for (const id of state.relicAcquisition!.offeredCardIds) {
      expect(CARD_DEFINITIONS[id].classId).toBe('colorless');
      expect(CARD_DEFINITIONS[id].acquisition ?? 'normal').toBe('normal');
      expect(CARD_DEFINITIONS[id].tokenOnly).not.toBe(true);
    }
  });

  it('Dolly mirrors the selected upgraded instance without modifying the original', () => {
    const original = run(); original.deck[0].upgraded = true;
    const pending = acquireRelic(original, 'ref_dolly_mirror', 'shop', 'shop'); const next = selectAndConfirm(pending);
    expect(next.deck[0]).toEqual(original.deck[0]);
    const copy = next.relicAcquisition!.receipt!.addedCards[0];
    expect(copy.cardId).toBe(original.deck[0].cardId); expect(copy.upgraded).toBe(true); expect(copy.uid).not.toBe(original.deck[0].uid);
  });

  it('Pandora transforms starter strike/guard instances, preserving other cards whose IDs contain strike', () => {
    const original = createRun('pandora-basic-boundary', 'assassin');
    const leading = original.deck.find((card) => card.cardId === 'assassin_leading_strike')!;
    const next = acquireRelic(original, 'ref_pandora_box', 'blessing', 'map');
    expect(next.deck.find((card) => card.uid === leading.uid)).toEqual(leading);
    expect(next.deck.some((card) => ['assassin_strike', 'assassin_guard'].includes(card.cardId) && original.deck.some((before) => before.uid === card.uid))).toBe(false);
  });

  it.each(CLASS_IDS)('Orobas replaces %s starter without retaining both effects', (classId) => {
    const state = createRun('orobas', classId); state.relicIds = [STARTER_RELIC_IDS[classId]];
    const next = acquireRelic(state, 'ref_orobas_fingertip', 'blessing', 'map');
    expect(next.relicIds).toContain(STARTER_UPGRADE_IDS[classId]); expect(next.relicIds).not.toContain(STARTER_RELIC_IDS[classId]);
    expect(next.relicAcquisition!.receipt!.replacedRelicIds).toEqual([STARTER_RELIC_IDS[classId]]);
    expect(isValidRelicAcquisitionState(JSON.parse(JSON.stringify(next)))).toBe(true);
  });

  it('legacy owned relics remain inert until an explicit new acquisition call', () => {
    const state = run(); state.relicIds.push('ref_strawberry');
    expect(state.maxHp).toBe(80);
    expect(acquireRelic(state, 'ref_strawberry', 'reward', 'map')).toBe(state);
  });

  it('rejects tampered frozen replacements and result receipts', () => {
    const state = acquireRelic(run(), 'ref_sapling', 'blessing', 'map');
    const corrupted = structuredClone(state); corrupted.relicAcquisition!.replacements[state.deck[0].uid] = 'blessing_apotheosis';
    expect(isValidRelicAcquisitionState(corrupted)).toBe(false);
    const result = selectAndConfirm(state); result.relicAcquisition!.receipt!.goldChange += 1;
    expect(isValidRelicAcquisitionState(result)).toBe(false);
  });

  it.each([
    ['ref_pomander', 'shop', 'shop'], ['ref_mango_imitation', 'reward', 'map'],
    ['ref_dolly_mirror', 'event', 'map'], ['ref_nutritious_oyster', 'event', 'map'],
  ] as const)('rejects %s through the wrong %s acquisition route', (id, source, returnScreen) => {
    const state = run(); expect(acquireRelic(state, id, source, returnScreen)).toBe(state);
  });

  it('rejects source or return-screen tampering on a saved acquisition', () => {
    const state = acquireRelic(run(), 'ref_pomander', 'blessing', 'map');
    const wrongSource = structuredClone(state); wrongSource.relicAcquisition!.source = 'shop';
    expect(isValidRelicAcquisitionState(wrongSource)).toBe(false);
    const wrongReturn = structuredClone(state); wrongReturn.relicAcquisition!.returnScreen = 'combat';
    expect(isValidRelicAcquisitionState(wrongReturn)).toBe(false);
  });

  it('each registered event relic is offered by a dedicated conditional event trade', () => {
    const fixed = new Set(Object.values(RELIC_EVENT_DEFINITIONS).flatMap((event) => event.choices.flatMap((choice) => choice.effects.flatMap((effect) => effect.type === 'relic' && effect.relicId ? [effect.relicId] : []))));
    for (const relic of Object.values(RELIC_DEFINITIONS).filter((relic) => relic.acquisition === 'event')) expect(fixed.has(relic.id), relic.id).toBe(true);
    for (const event of Object.values(RELIC_EVENT_DEFINITIONS)) expect(event.choices.some((choice) => choice.effects.length === 0)).toBe(true);
  });

  it('tungsten previews and applies each outside-combat HP payment, never max-HP loss', () => {
    const state = run(); state.relicIds.push('ref_tungsten_rod'); state.hp = 16;
    expect(getRelicAwareHpLoss(state, 16)).toBe(15);
    expect(canAcquireRelic(state, 'ref_dangerous_scissors')).toBe(true);
    const committed = selectAndConfirm(acquireRelic(state, 'ref_dangerous_scissors', 'blessing', 'map'));
    expect(committed.hp).toBe(1);
    const lossState = run(); lossState.relicIds.push('ref_tungsten_rod');
    expect(loseRelicAwareHp(lossState, 1)).toBe(0); expect(lossState.hp).toBe(40);
    const cape = acquireRelic(lossState, 'ref_noble_cape', 'blessing', 'map'); expect(cape.maxHp).toBe(71);
  });
});

describe('run relic hooks use actual facility actions and persistent counters', () => {
  it('room heals distinguish shop/event/rest and never trigger a rest-only bonus on arrival', () => {
    const state = run(); state.relicIds.push('ref_meal_ticket', 'ref_star_chart', 'ref_eternal_feather', 'ref_regal_pillow', 'ref_stone_humidifier');
    onRelicRoomEntered(state, 'shop'); expect(state.hp).toBe(55);
    onRelicRoomEntered(state, 'event'); expect(state.hp).toBe(60);
    onRelicRoomEntered(state, 'rest'); expect(state.hp).toBe(66); expect(state.maxHp).toBe(80);
    const healed = onRelicRest(state, 24); expect(healed).toBe(19); expect(state.maxHp).toBe(85); expect(state.hp).toBe(85);
  });

  it('tea sets reserve one next-combat bonus, do not stack repeated visits, and consume once', () => {
    const state = run(); state.relicIds.push('ref_tea_set', 'ref_tea_set_imitation');
    onRelicRoomEntered(state, 'rest'); onRelicRoomEntered(state, 'rest');
    const restored = JSON.parse(JSON.stringify(state));
    expect(consumeRelicNextBattleEnergy(restored)).toBe(3);
    expect(consumeRelicNextBattleEnergy(restored)).toBe(0);
  });

  it('all three eggs use the real added card type and leave existing cards unchanged', () => {
    const state = run(); state.relicIds.push('ref_frozen_egg', 'ref_toxic_egg', 'ref_molten_egg');
    const originalDeck = structuredClone(state.deck);
    for (const cardId of ['berserker_strike', 'berserker_guard', 'berserker_inflame']) expect(addRelicAwareCard(state, cardId)[0].upgraded).toBe(true);
    expect(state.deck.slice(0, originalDeck.length)).toEqual(originalDeck);
  });

  it('Bin Bon creates exactly one copy per real addition and both trigger fish/five-rings once', () => {
    const state = run(); state.hp = 10; state.relicIds.push('ref_bin_bon', 'ref_lucky_fish', 'ref_five_rings');
    const gold = state.gold; const count = state.stats.cardsAdded;
    for (let index = 0; index < 3; index++) expect(addRelicAwareCard(state, 'berserker_strike')).toHaveLength(2);
    expect(state.stats.cardsAdded - count).toBe(6); expect(state.gold - gold).toBe(90); expect(state.hp).toBe(30);
    expect(state.relicState!['ref_five_rings:cardsAdded']).toBe(6);
  });

  it('fishing rod counts normal victories only and resumes from saved counters', () => {
    const state = run(); state.relicIds.push('ref_fishing_rod');
    onRelicVictory(state, 'battle'); onRelicVictory(state, 'elite'); onRelicVictory(state, 'event');
    const restored = JSON.parse(JSON.stringify(state)); onRelicVictory(restored, 'battle');
    expect(restored.deck.filter((card: { upgraded: boolean }) => card.upgraded)).toHaveLength(0);
    onRelicVictory(restored, 'battle'); expect(restored.deck.filter((card: { upgraded: boolean }) => card.upgraded)).toHaveLength(1);
  });

  it('warhammer upgrades four distinct cards on elite victory and cheese raises max HP once per supplied victory', () => {
    const state = run(); state.relicIds.push('ref_warhammer', 'ref_chosen_cheese');
    onRelicVictory(state, 'battle'); expect(state.maxHp).toBe(81); expect(state.deck.some((card) => card.upgraded)).toBe(false);
    onRelicVictory(state, 'elite'); expect(state.maxHp).toBe(82); expect(state.deck.filter((card) => card.upgraded)).toHaveLength(4);
  });
});
