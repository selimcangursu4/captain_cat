import { describe, expect, it } from 'vitest';
import { LAYOUT } from '../../src/config/layout';
import { computeBoardLayout } from '../../src/ui/board/layout';

describe('computeBoardLayout', () => {
  it('8x8 tahtayı referans ekranda yatayda ortalar ve sınırlar içinde tutar', () => {
    const layout = computeBoardLayout(1080, 1920, 8, 8);
    expect(layout.width).toBe(layout.cellSize * 8);
    expect(layout.x * 2 + layout.width).toBeCloseTo(1080, -1);
    expect(layout.cellSize).toBeLessThanOrEqual(LAYOUT.maxCellSize);
    expect(layout.y).toBeGreaterThanOrEqual(LAYOUT.hudHeight);
    expect(layout.y + layout.height).toBeLessThanOrEqual(1920 - LAYOUT.bottomHeight);
  });

  it('uzun telefonlarda (20:9) tahta dikeyde ortalanır', () => {
    const layout = computeBoardLayout(1080, 2400, 8, 8);
    expect(layout.y).toBeGreaterThan(computeBoardLayout(1080, 1920, 8, 8).y);
  });

  it('daha çok sütunlu tahtada kareler küçülür', () => {
    expect(computeBoardLayout(1080, 1920, 9, 10).cellSize).toBeLessThan(
      computeBoardLayout(1080, 1920, 8, 8).cellSize,
    );
  });

  it('geniş ekranda tahta aşırı büyümez', () => {
    const layout = computeBoardLayout(3400, 1920, 8, 8);
    expect(layout.cellSize).toBeLessThanOrEqual(LAYOUT.maxCellSize);
    expect(layout.x + layout.width / 2).toBeCloseTo(1700, 0);
  });
});
