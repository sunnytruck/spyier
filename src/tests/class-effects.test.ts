import { describe, expect, it } from 'vitest';
import { createCombat } from '../engine';
import { generatedCardEffect, getClassEffectRoute } from '../presentation/classEffects';
import type { CombatCue } from '../presentation/types';
import type { ClassId } from '../types/game';

function cue(input: Partial<CombatCue> = {}, classId?: ClassId): CombatCue {
  return { kind: 'attack', sourceId: 'player', targetId: 'grit_scout', amount: 6,
    frame: createCombat('class-effects-test', 'grit_scout', { classId }), ...input };
}

describe('class-specific effects route actual engine cues without altering combat', () => {
  it.each([
    ['berserker', 'rock', 'lunge'], ['assassin', 'knife', 'dart'],
    ['oracle', 'stars', 'lunge'], ['necromancer', 'ghost', 'lunge'], ['machinist', 'lightning', 'lunge'],
  ] as const)('%s has its own attack appearance', (classId, motif, motion) => {
    const event = cue({}, classId);
    const before = JSON.stringify(event);
    expect(getClassEffectRoute(event)).toMatchObject({ motif, motion, sourceId: 'player', targetId: 'grit_scout' });
    expect(JSON.stringify(event)).toBe(before);
  });

  it('legacy battles and enemy attacks keep their original movement and motif', () => {
    expect(getClassEffectRoute(cue())).toMatchObject({ motif: 'slash', motion: 'lunge' });
    expect(getClassEffectRoute(cue({ sourceId: 'grit_scout', targetId: 'player' }, 'assassin'))).toMatchObject({ motif: 'slash', motion: 'lunge' });
  });

  it.each(['poison', 'doom', 'thorns', 'loseHp'])('%s never makes the player lunge', (effect) => {
    expect(getClassEffectRoute(cue({ effect }, 'berserker')).motion).toBe('none');
  });

  it('HP consumption is distinct from normal incoming damage', () => {
    expect(getClassEffectRoute(cue({ kind: 'impact', effect: 'loseHp', targetId: 'player' }, 'berserker')))
      .toMatchObject({ hpCost: true, motif: 'sacrifice', motion: 'none' });
    expect(getClassEffectRoute(cue({ kind: 'impact', sourceId: 'grit_scout', targetId: 'player' }, 'berserker')))
      .toMatchObject({ hpCost: false, motif: 'impact' });
  });

  it.each(['passive', 'evoke'] as const)('orb %s uses the actual slot source, not the player', (orbMode) => {
    expect(getClassEffectRoute(cue({ sourceId: 'orb-2', effect: 'orbLightning', orbIndex: 2, orbMode }, 'machinist')))
      .toMatchObject({ sourceId: 'orb-2', targetId: 'grit_scout', motif: 'lightning', motion: 'none' });
    expect(getClassEffectRoute(cue({ kind: 'block', sourceId: 'orb-1', targetId: 'player', effect: 'orbFrost', orbIndex: 1, orbMode }, 'machinist')))
      .toMatchObject({ sourceId: 'orb-1', targetId: 'player', motif: 'frost', motion: 'none' });
  });

  it.each(['channel', 'activate', 'remove'])('orb %s anchors the exact slot even after removal', (resourceAction) => {
    expect(getClassEffectRoute(cue({ kind: 'resource', resource: 'lightning', orbIndex: 2, resourceAction }, 'machinist')))
      .toMatchObject({ targetId: 'orb-2', motif: 'lightning' });
  });

  it('summon attacks originate at the independently rendered summon', () => {
    expect(getClassEffectRoute(cue({ sourceId: 'osty', effect: 'summonDamage' }, 'necromancer')))
      .toMatchObject({ sourceId: 'osty', motif: 'ghost', motion: 'summon' });
  });

  it.each(['guard', 'sweep'])('summon %s targets the summon body and HP widget', (resourceAction) => {
    expect(getClassEffectRoute(cue({ kind: 'resource', sourceId: 'grit_scout', targetId: 'player', resource: 'ostyHp', resourceAction, amount: -5 }, 'necromancer')))
      .toMatchObject({ targetId: 'osty', motif: 'guard', hudIds: ['ostyHp'] });
  });

  it.each(['summon', 'grow', 'vanish'])('summon %s retains its independent anchor', (resourceAction) => {
    expect(getClassEffectRoute(cue({ kind: 'resource', resource: 'ostyHp', resourceAction }, 'necromancer')))
      .toMatchObject({ targetId: 'osty', motif: 'ghost' });
  });

  it('star reference pulses the star HUD without adding a spend rule', () => {
    const event = cue({ kind: 'resource', resource: 'stars', amount: 0, resourceAction: 'reference' }, 'oracle');
    const snapshot = JSON.stringify(event.frame);
    expect(getClassEffectRoute(event)).toMatchObject({ motif: 'stars', hudIds: ['stars'] });
    expect(event.amount).toBe(0);
    expect(JSON.stringify(event.frame)).toBe(snapshot);
  });

  it.each([
    ['oracle_star_burst', 'stars'], ['oracle_manifest', 'forge'], ['token_sword', 'forge'], ['token_knife', 'knife'],
  ])('%s connects card use with its actual resource HUD', (cardId, hudId) => {
    expect(getClassEffectRoute(cue({ kind: 'cardPlay', card: { uid: 'card', cardId, upgraded: false } }, 'oracle')).hudIds).toContain(hudId);
  });

  it('enemy strength never pulses the player strength HUD', () => {
    expect(getClassEffectRoute(cue({ kind: 'status', sourceId: 'grit_scout', targetId: 'grit_scout', status: 'strength' }, 'berserker')).hudIds).toEqual([]);
    expect(getClassEffectRoute(cue({ kind: 'status', targetId: 'player', status: 'strength' }, 'berserker')).hudIds).toEqual(['strength']);
  });

  it.each([
    ['token_knife', 'knife', 'knife'], ['token_sword', 'sword', 'forge'], ['token_soul', 'ghost', 'ostyHp'],
  ])('generated %s uses its actual token identity and HUD origin', (cardId, motif, hudId) => {
    expect(generatedCardEffect(cardId)).toEqual({ motif, hudId });
  });

  it('unknown generated cards use the generic card flight', () => {
    expect(generatedCardEffect('future_card')).toEqual({ motif: 'card' });
  });
});
