import { describe, expect, it } from 'vitest';
import { LevelSession, parseLevel } from '../../src/core';
import { ARCHETYPES, archetypeOf, formatLevel, generateLevel } from '../../tools/levelgen/generate';
import { HANDMADE_LEVELS, MIN_TARGET, density, progress, targetWinRate } from '../../tools/levelgen/plan';

describe('seviye üretici', () => {
  it('aynı id aynı seviyeyi üretir; farklı deneme farklı seviye', () => {
    expect(generateLevel(57)).toEqual(generateLevel(57));
    expect(generateLevel(57, 1)).not.toEqual(generateLevel(57, 0));
  });

  it('üretilen seviyeler geçerli ve tahta kurulabiliyor (31-230 arası örnekler)', () => {
    for (let id = 31; id <= 230; id += 7) {
      const json = generateLevel(id);
      const level = parseLevel(json);
      expect(level.goals.length, `seviye ${id}`).toBeGreaterThan(0);
      expect(level.goals.length, `seviye ${id}`).toBeLessThanOrEqual(3);
      expect(() => new LevelSession(level, 1), `seviye ${id}`).not.toThrow();
      // Dosya biçimi geri okununca aynı seviye.
      expect(parseLevel(JSON.parse(formatLevel(json)))).toEqual(level);
    }
  });

  it('her 10 seviyelik blokta seviye türleri çeşitli', () => {
    for (let block = 3; block < 20; block++) {
      const kinds = new Set(Array.from({ length: 10 }, (_, i) => archetypeOf(block * 10 + i + 1)));
      expect(kinds.size, `blok ${block}`).toBeGreaterThanOrEqual(5);
      for (const kind of kinds) expect(ARCHETYPES).toContain(kind);
    }
  });

  it('zorluk eğrisi: ilerleme artar, hedef kazanma oranı genel olarak düşer ve sınırlar içinde kalır', () => {
    expect(progress(HANDMADE_LEVELS)).toBe(0);
    expect(progress(200)).toBeGreaterThan(progress(100));
    const avg = (from: number) => {
      let sum = 0;
      for (let id = from; id < from + 10; id++) sum += targetWinRate(id);
      return sum / 10;
    };
    expect(avg(31)).toBeGreaterThan(avg(101));
    expect(avg(101)).toBeGreaterThan(avg(191));
    for (let id = 31; id <= 400; id++) {
      expect(targetWinRate(id)).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(targetWinRate(id)).toBeLessThanOrEqual(0.95);
      expect(density(id)).toBeGreaterThanOrEqual(0);
    }
    // 10'un katları (sandık seviyeleri) komşularından zor.
    expect(targetWinRate(50)).toBeLessThan(targetWinRate(46));
  });
});
