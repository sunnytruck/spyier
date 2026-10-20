import { describe, expect, it } from 'vitest';
import { getHandPreviewBounds } from '../presentation/handLayout';

describe('enlarged hand card viewport bounds', () => {
  it.each([
    [1920, 1080], [1366, 768], [390, 844], [320, 568], [844, 390],
  ])('keeps every hand position inside a %i × %i viewport', (width, height) => {
    // Include cards partially outside either end of an internally scrolling hand.
    for (const left of [-150, 0, width / 2 - 75, width - 150, width + 30]) {
      const bounds = getHandPreviewBounds({ left, right: left + 170, top: height - 220, bottom: height - 10 }, { width, height });
      expect(bounds.left).toBeGreaterThanOrEqual(10);
      expect(bounds.top).toBeGreaterThanOrEqual(10);
      expect(bounds.left + bounds.width).toBeLessThanOrEqual(width - 10);
      expect(bounds.maxHeight).toBeLessThanOrEqual(height - 20);
      expect(bounds.top + bounds.maxHeight).toBeLessThanOrEqual(height - 10);
      expect(bounds.width).toBeGreaterThanOrEqual(Math.min(292, width - 20));
    }
  });

  it('places the enlarged card beside its source where space permits', () => {
    const viewport = { width: 1366, height: 768 };
    const left = getHandPreviewBounds({ left: 120, right: 290, top: 540, bottom: 746 }, viewport);
    const right = getHandPreviewBounds({ left: 1000, right: 1170, top: 540, bottom: 746 }, viewport);
    expect(left.left).toBeGreaterThan(290);
    expect(right.left + right.width).toBeLessThan(1000);
  });
});
