import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getRelicMotif, RelicIcon, type RelicMotif } from '../components/RelicIcon';
import { CONTINUATION_RELIC_DEFINITIONS } from '../data/continuationRelics';

const motifs: Record<string, RelicMotif> = {
  ref_red_skull: 'skull', ref_pen_nib: 'feather', ref_reptile_trinket: 'amulet',
  ref_paper_frog: 'origami', ref_pocket_watch: 'hourglass', ref_paper_crane: 'origami',
  ref_chemical_x: 'vial', ref_resonant_triangle: 'triangle', ref_roaring_conch: 'horn',
  ref_glowing_pearl: 'pearl', ref_pael_tears: 'blood', ref_warm_gloves: 'fist',
  ref_diamond_tiara: 'crown', ref_velvet_choker: 'gorget', ref_runic_pyramid: 'pyramid',
  ref_strike_dummy_imitation: 'fist',
};

describe('continuation relic icon presentation', () => {
  it('gives all added relics a meaningful named motif and preserves every individual ID carving', () => {
    expect(Object.keys(motifs).sort()).toEqual(Object.keys(CONTINUATION_RELIC_DEFINITIONS).sort());
    const individualCarvings = new Set<string>();
    for (const relic of Object.values(CONTINUATION_RELIC_DEFINITIONS)) {
      expect(getRelicMotif(relic)).toBe(motifs[relic.id]);
      const html = renderToStaticMarkup(createElement(RelicIcon, { id: relic.id, label: relic.name }));
      expect(html).toContain(`data-relic-motif="${motifs[relic.id]}"`);
      expect(html).toContain(`data-relic-id="${relic.id}"`);
      expect(html).toContain(`data-relic-rarity="${relic.rarity}"`);
      expect(html).toContain(`data-relic-acquisition="${relic.acquisition}"`);
      expect(html).toContain(`aria-label="${relic.name}"`);
      expect(html).toContain('relic-emblem-frame');
      if (relic.rarity === 'ancient') expect(html).toContain('relic-ancient-mark');
      if (relic.rarity === 'event') expect(html).toContain('relic-event-mark');
      expect(html).not.toContain('<text');
      expect(html).not.toContain('<image');
      const carving = [...html.matchAll(/class="relic-id-rune" d="([^"]+)"/g)].map((part) => part[1]).join('|');
      expect(carving).not.toBe('');
      individualCarvings.add(carving);
    }
    expect(individualCarvings.size).toBe(Object.keys(CONTINUATION_RELIC_DEFINITIONS).length);
  });

  it('keeps the musical triangle, folded paper and carved pyramid geometries distinct', () => {
    const geometry = ['ref_resonant_triangle', 'ref_paper_crane', 'ref_runic_pyramid'].map((id) => {
      const html = renderToStaticMarkup(createElement(RelicIcon, { id, decorated: false, active: true, acquired: true }));
      expect(html).toContain('is-active');
      expect(html).toContain('is-acquired');
      expect(html).not.toContain('relic-id-rune');
      return [...html.matchAll(/ d="([^"]+)"/g)].map((part) => part[1]).join('|');
    });
    expect(new Set(geometry).size).toBe(3);
  });
});
