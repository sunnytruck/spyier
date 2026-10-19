import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCombat } from '../engine';
import { CLASS_DEFINITIONS, CLASS_IDS } from '../data/classes';
import { ClassResourceHud, EnemyResourceForecast, OrbSlots, OstyCompanion, StarEnergyHud } from '../components/classResources/ClassResourceHud';
import type { CombatCue } from '../presentation/types';

describe('always-visible class combat resources', () => {
  it.each(CLASS_IDS)('%s has its own named resource shelf without changing combat', (classId) => {
    const state = createCombat('class-resource-markup', 'grit_scout', { classId });
    const before = JSON.stringify(state);
    const markup = renderToStaticMarkup(createElement(ClassResourceHud, { state }));
    expect(markup).toContain(CLASS_DEFINITIONS[classId].displayName);
    expect(markup).toContain('固有リソースの詳細を表示');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('renders occupied and empty orb slots in engine order and marks the rightmost occupied slot', () => {
    const state = createCombat('orb-slot-markup', 'grit_scout', { classId: 'machinist' });
    state.classResources!.orbs = ['lightning', 'frost'];
    state.classResources!.focus = -1;
    const before = JSON.stringify(state);
    const markup = renderToStaticMarkup(createElement(OrbSlots, { state }));
    expect(markup.match(/data-orb-type="[^"]+"/g)).toEqual(['data-orb-type="lightning"', 'data-orb-type="frost"', 'data-orb-type="empty"']);
    expect(markup).toContain('オーブ 2/3、右端から解放');
    expect(markup).toContain('スロット2 霜。自動1、解放4。次に解放。');
    expect(markup).toContain('data-next-evoke="true"');
    expect(markup).not.toContain('スロット1 雷。自動2、解放7。次に解放。');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps all three empty slots visible even without saved class resources', () => {
    const state = createCombat('orb-empty-markup', 'grit_scout', { classId: 'machinist' });
    delete state.classResources;
    const markup = renderToStaticMarkup(createElement(OrbSlots, { state }));
    expect(markup.match(/data-orb-type="empty"/g)).toHaveLength(3);
    expect(markup).toContain('オーブ 0/3');
    expect(markup).not.toContain('data-next-evoke="true"');
    expect(state.classResources).toBeUndefined();
  });

  it('distinguishes dormant, active, and transient disappearing summons', () => {
    const state = createCombat('summon-markup', 'grit_scout', { classId: 'necromancer' });
    state.classResources!.ostyHp = 0;
    expect(renderToStaticMarkup(createElement(OstyCompanion, { state }))).toContain('data-osty-state="absent"');
    state.classResources!.ostyHp = 14;
    const active = renderToStaticMarkup(createElement(OstyCompanion, { state }));
    expect(active).toContain('data-osty-state="active"');
    expect(active).toContain('HP 14');
    state.classResources!.ostyHp = 0;
    const cue: CombatCue = { kind: 'resource', targetId: 'osty', resource: 'ostyHp', resourceAction: 'vanish', amount: 0, frame: state };
    const disappearing = renderToStaticMarkup(createElement(OstyCompanion, { state, cue }));
    expect(disappearing).toContain('data-osty-state="dissolving"');
    // The solid unit stays available for the presentation engine's disappearance effect.
    expect(disappearing).toContain('osty-art is-summoned');
    expect(disappearing).not.toContain('osty-art is-dormant');
  });

  it('keeps total stars and this-turn gains as separate values beside energy', () => {
    const state = createCombat('stars-markup', 'grit_scout', { classId: 'oracle' });
    state.classResources!.stars = 23;
    state.classResources!.starsGainedThisTurn = 4;
    const markup = renderToStaticMarkup(createElement(StarEnergyHud, { state }));
    expect(markup).toContain('星 23、このターン獲得 4');
    expect(markup).toContain('<b>23</b>');
    expect(markup).toContain('+4');
    expect(state.classResources!.stars).toBe(23);
    expect(state.classResources!.starsGainedThisTurn).toBe(4);
  });

  it('forecasts poison before doom, including a threshold only reached after poison', () => {
    const state = createCombat('doom-markup', 'grit_scout', { classId: 'necromancer' });
    state.enemy.hp = 12;
    state.enemy.poison = 4;
    state.enemy.doom = 8;
    const markup = renderToStaticMarkup(createElement(EnemyResourceForecast, { state, enemy: state.enemy }));
    expect(markup).toContain('次に 4ダメージ');
    expect(markup).toContain('次の敵ターンに発動');
    expect(markup).toContain('毒の後のHP 8');
    expect(state.enemy.hp).toBe(12);
  });

  it('does not add profession UI to a legacy practice battle', () => {
    const state = createCombat('legacy-class-markup');
    expect(renderToStaticMarkup(createElement(ClassResourceHud, { state }))).toBe('');
    expect(renderToStaticMarkup(createElement(StarEnergyHud, { state }))).toBe('');
  });

  it('labels a poison kill before the doom threshold instead of announcing a doom at zero HP', () => {
    const state = createCombat('poison-kill-markup', 'grit_scout', { classId: 'necromancer' });
    state.enemy.hp = 3;
    state.enemy.poison = 8;
    state.enemy.doom = 5;
    const markup = renderToStaticMarkup(createElement(EnemyResourceForecast, { state, enemy: state.enemy }));
    expect(markup).toContain('毒で撃破予定');
    expect(markup).not.toContain('発動条件：破滅 ≥ HP0');
    expect(markup).not.toContain('次の敵ターンに発動');
  });
});
