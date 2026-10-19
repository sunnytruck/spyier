import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSettings, saveSettings, SETTINGS_KEY } from '../engine/persistence';

describe('backwards-compatible presentation settings', () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps old two-field preferences without changing saved combat data', () => {
    values.set(SETTINGS_KEY, JSON.stringify({ speed: 'fast', reducedMotion: true }));
    expect(loadSettings()).toEqual({ speed: 'fast', reducedMotion: true });
  });

  it.each(['auto', 'full', 'low'] as const)('round-trips %s quality using the existing settings key', (effectsQuality) => {
    const settings = { speed: 'normal' as const, reducedMotion: false, effectsQuality };
    expect(saveSettings(settings)).toBe(true);
    expect(loadSettings()).toEqual(settings);
    expect([...values.keys()]).toEqual([SETTINGS_KEY]);
  });

  it('ignores unknown quality values while preserving valid speed and accessibility preferences', () => {
    values.set(SETTINGS_KEY, JSON.stringify({ speed: 'instant', reducedMotion: false, effectsQuality: 'ultra' }));
    expect(loadSettings()).toEqual({ speed: 'instant', reducedMotion: false });
  });
});
