import { describe, expect, it, vi } from 'vitest';
import { LEVELS, getLevel, levelCount, registerLevels } from '../../src/data/levels';

const colors = ['fish', 'anchor', 'shell', 'ring', 'star'];
const level = (id: number, moves = 20) => ({ id, moves, colors, goals: [{ type: 'color', color: 'fish', count: 10 }] });

describe('seviye deposu', () => {
  it('pakete gömülü seviyeler ardışık ve en az 30 tane', () => {
    expect(levelCount()).toBe(LEVELS.length);
    expect(LEVELS.length).toBeGreaterThanOrEqual(30);
    LEVELS.forEach((l, i) => expect(l.id).toBe(i + 1));
  });

  it('yeni seviyeler (ör. sunucudan) sondan eklenir; boşluklu, mevcut ya da bozuk olanlar alınmaz', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const n = levelCount();
    expect(registerLevels([level(n + 3), level(n + 1), level(n + 2, 33)])).toBe(3);
    expect(levelCount()).toBe(n + 3);
    expect(getLevel(n + 2).moves).toBe(33);
    expect(registerLevels([level(1, 99)])).toBe(0);
    expect(getLevel(1).moves).not.toBe(99);
    expect(registerLevels([{ id: n + 4, moves: 'çok' }, level(n + 5)])).toBe(0); // n+4 bozuk → n+5 de bağlanamaz
    expect(levelCount()).toBe(n + 3);
  });
});
