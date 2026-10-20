import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import { getCardPool } from '../engine/cardPools';
import { getEnemies } from '../engine';
import { seedToState } from '../engine/random';
import { createRun, getAvailableNodes, getShopCardPrice, reduceRun, SHOP_PRICES } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import { newShopCardPrice, REWARD_RARITY_WEIGHTS, sampleCardRewards, type RewardTier } from '../engine/rewards';
import type { ClassId } from '../types/game';
import type { RunState } from '../types/run';

function shopRun(classId: ClassId): RunState {
  const run = createRun(`new-shop-${classId}`, classId);
  const node = getAvailableNodes(run)[0];
  node.type = 'shop';
  return reduceRun(run, { type: 'chooseNode', nodeId: node.id });
}

describe('rarity-aware offers for new runs', () => {
  it.each(CLASS_IDS)('%s has deterministic, distinct own-class combat offers at every tier', (classId) => {
    const pool = getCardPool(classId, 'combat');
    for (const tier of ['battle', 'elite', 'boss'] as const) {
      for (let seed = 0; seed < 50; seed++) {
        const rng = seedToState(`offer-${seed}`);
        const result = sampleCardRewards(pool, rng, tier);
        expect(result).toEqual(sampleCardRewards(pool, rng, tier));
        expect(result.cardIds).toHaveLength(3);
        const available = tier === 'boss' ? pool.filter((id) => CARD_DEFINITIONS[id].rarity === 'rare') : pool;
        expect(new Set(result.cardIds).size).toBe(Math.min(3, available.length));
        for (const id of result.cardIds) {
          expect(CARD_DEFINITIONS[id].classId).toBe(classId);
          expect(CARD_DEFINITIONS[id].tokenOnly).not.toBe(true);
          expect(CARD_DEFINITIONS[id].rewardEligible).not.toBe(false);
          if (tier === 'boss') expect(CARD_DEFINITIONS[id].rarity).toBe('rare');
        }
      }
    }
  });

  it('keeps rare cards scarce in ordinary rooms and more likely after elites and bosses', () => {
    const pool = CLASS_IDS.flatMap((id) => getCardPool(id, 'combat'));
    const samples = 3000;
    const rates: Record<string, number> = {};
    for (const tier of ['battle', 'elite', 'boss', 'shop'] as const) {
      const counts = { common: 0, uncommon: 0, rare: 0 };
      for (let seed = 0; seed < samples; seed++) {
        const result = sampleCardRewards(pool, seedToState(`rarity-${seed}`), tier, 1);
        counts[CARD_DEFINITIONS[result.cardIds[0]].rarity ?? 'common']++;
      }
      for (const rarity of ['common', 'uncommon', 'rare'] as const)
        expect(Math.abs(counts[rarity] / samples - REWARD_RARITY_WEIGHTS[tier][rarity] / 100)).toBeLessThan(0.04);
      rates[tier] = counts.rare / samples;
    }
    expect(rates.elite).toBeGreaterThan(rates.battle + 0.04);
    expect(rates.boss).toBeGreaterThan(rates.elite + 0.25);
  });

  it('handles exhausted rarity groups and tiny pools without duplicates or consuming RNG for no cards', () => {
    const ids = getCardPool('berserker', 'combat').slice(0, 2);
    for (const tier of ['battle', 'elite', 'shop'] as RewardTier[])
      expect(sampleCardRewards([...ids, ...ids, 'token_knife', 'missing'], 123, tier).cardIds.sort()).toEqual([...ids].sort());
    expect(sampleCardRewards(ids, 123, 'boss')).toEqual({ cardIds: [], rngState: 123 });
    const rare = getCardPool('berserker', 'combat').find((id) => CARD_DEFINITIONS[id].rarity === 'rare')!;
    expect(sampleCardRewards([rare, ...ids, 'token_knife'], 123, 'boss').cardIds).toEqual([rare, rare, rare]);
    expect(sampleCardRewards([], 123, 'battle')).toEqual({ cardIds: [], rngState: 123 });
    expect(sampleCardRewards(ids, 123, 'battle', 0)).toEqual({ cardIds: [], rngState: 123 });
  });

  it.each(CLASS_IDS)('%s shops offer two own cards and one colorless card with saved rarity prices', (classId) => {
    const shop = shopRun(classId);
    expect(shop.shop!.cardIds.filter((id) => CARD_DEFINITIONS[id].classId === classId)).toHaveLength(2);
    expect(shop.shop!.cardIds.filter((id) => CARD_DEFINITIONS[id].classId === 'colorless')).toHaveLength(1);
    expect(new Set(shop.shop!.cardIds).size).toBe(3);
    const restored = deserializeRun(serializeRun(shop))!;
    expect(restored).toEqual(shop);
    for (const id of shop.shop!.cardIds) {
      expect(getShopCardPrice(shop, id)).toBe(newShopCardPrice(id));
      expect(getShopCardPrice(restored, id)).toBe(getShopCardPrice(shop, id));
    }
    const id = shop.shop!.cardIds[0];
    const price = getShopCardPrice(shop, id);
    shop.gold = price - 1;
    expect(reduceRun(shop, { type: 'buyCard', cardId: id })).toBe(shop);
    shop.gold = price;
    const bought = reduceRun(shop, { type: 'buyCard', cardId: id });
    expect(bought.gold).toBe(0);
    expect(bought.deck.at(-1)!.cardId).toBe(id);
    expect(reduceRun(bought, { type: 'buyCard', cardId: id })).toBe(bought);
    expect(deserializeRun(serializeRun(bought))).toEqual(bought);
  });

  it('retains the original price and uniform policy when loading older stock', () => {
    const shop = shopRun('oracle');
    delete shop.rewardRules;
    delete shop.shop!.cardPrices;
    const restored = deserializeRun(serializeRun(shop))!;
    const id = restored.shop!.cardIds[0];
    restored.gold = 100;
    expect(getShopCardPrice(restored, id)).toBe(SHOP_PRICES.card);
    expect(reduceRun(restored, { type: 'buyCard', cardId: id }).gold).toBe(45);
    const badPrice = structuredClone(shop);
    badPrice.shop!.cardPrices = { [id]: 0 };
    expect(isValidRunState(badPrice)).toBe(false);
  });

  it('commits a new elite offer and gold once, preserving every choice through reload', () => {
    let run = createRun('atomic-rarity-elite', 'machinist');
    const node = getAvailableNodes(run)[0];
    node.type = 'elite';
    run = reduceRun(run, { type: 'chooseNode', nodeId: node.id });
    for (const enemy of getEnemies(run.combat!)) { enemy.hp = 1; enemy.poison = 1; }
    const beforeGold = run.gold;
    const won = reduceRun(run, { type: 'combat', action: { type: 'endTurn' } });
    expect(won.gold - beforeGold).toBe(won.reward!.gold);
    expect(won.reward!.relicId).toBeTruthy();
    const restored = deserializeRun(serializeRun(won))!;
    expect(restored.reward).toEqual(won.reward);
    expect(reduceRun(restored, { type: 'combat', action: { type: 'endTurn' } })).toBe(restored);
    const selected = reduceRun(restored, { type: 'takeCard', cardId: restored.reward!.cardIds[0] });
    expect(selected.gold).toBe(won.gold);
    expect(reduceRun(selected, { type: 'takeCard', cardId: won.reward!.cardIds[0] })).toBe(selected);
  });
});
