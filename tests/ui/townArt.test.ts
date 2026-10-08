import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST, TOWN_STAGE, townBackgroundTexture, townPartBox, townPartTexture } from '../../src/assets/AssetManifest';
import { TOWN } from '../../src/meta/town';

describe('kasaba görselleri', () => {
  it('her görevin 3 tasarımı ve her bölgenin arka planı manifestte (tembel) tanımlı', () => {
    for (const region of TOWN) {
      expect(ASSET_MANIFEST[townBackgroundTexture(region.id)]?.lazy).toBe(true);
      for (const task of region.tasks) {
        for (const design of [0, 1, 2]) {
          const entry = ASSET_MANIFEST[townPartTexture(task.id, design)];
          expect(entry, `${task.id}#${design}`).toBeDefined();
          expect(entry.lazy).toBe(true);
          if (entry.kind === 'svg') expect(entry.render()).toMatch(/^<svg[\s\S]*<\/svg>$/);
        }
      }
    }
  });

  it('parça kutuları sahnenin içinde', () => {
    for (const region of TOWN) {
      for (const task of region.tasks) {
        const [x, y, w, h] = townPartBox(task.id);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(TOWN_STAGE.width);
        expect(y + h).toBeLessThanOrEqual(TOWN_STAGE.height);
      }
    }
  });

  it('temalar birbirinden farklı çizilir', () => {
    const svgs = [0, 1, 2].map((d) => {
      const entry = ASSET_MANIFEST[townPartTexture('lighthouse.tower', d)];
      return entry.kind === 'svg' ? entry.render() : '';
    });
    expect(new Set(svgs).size).toBe(3);
  });
});
