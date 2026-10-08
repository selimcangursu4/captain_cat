import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST, TEXTURES, TOWN_STAGE, regionIconTexture, townBackgroundTexture, townPartBox, townPartTexture } from '../../src/assets/AssetManifest';
import { MAP_NODES } from '../../src/assets/svg/town/map';
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

  it('liman haritası: her bölgenin düğümü sahnenin içinde, simgesi tanımlı; harita zemini tembel yüklenir', () => {
    expect(ASSET_MANIFEST[TEXTURES.townMap]?.lazy).toBe(true);
    for (const region of TOWN) {
      const { x, y } = MAP_NODES[region.id];
      // Düğüm (yarıçap 80) ve altındaki ad sahneden taşmasın.
      expect(x - 120).toBeGreaterThanOrEqual(0);
      expect(x + 120).toBeLessThanOrEqual(TOWN_STAGE.width);
      expect(y - 90).toBeGreaterThanOrEqual(0);
      expect(y + 140).toBeLessThanOrEqual(TOWN_STAGE.height);
      const icon = ASSET_MANIFEST[regionIconTexture(region.id)];
      expect(icon).toBeDefined();
      if (icon.kind === 'svg') expect(icon.render()).toMatch(/^<svg[\s\S]*<\/svg>$/);
    }
  });
});
