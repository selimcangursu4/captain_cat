import { describe, expect, it } from 'vitest';
import { findMatchGroups, findSquares, hasAnyMatch, matchCellsAt } from '../../src/core/matchFinder';
import { findPossibleMoves } from '../../src/core/possibleMoves';
import { classifyGroup, planSpecial } from '../../src/core/specials';
import { boardFrom, setSpecial, sortedPositions } from '../helpers/boardBuilder';

function onlyGroup(lines: string[]) {
  const groups = findMatchGroups(boardFrom(lines));
  expect(groups).toHaveLength(1);
  return groups[0];
}

describe('2x2 kare eşleşmesi', () => {
  it('kareyi bulur ve eşleşme sayar', () => {
    const board = boardFrom(['FFA', 'FFS', 'ART']);
    expect(findSquares(board)).toHaveLength(1);
    expect(hasAnyMatch(board)).toBe(true);
    expect(sortedPositions(matchCellsAt(board, { row: 1, col: 1 }))).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('kare ile ona değen 3\'lü diziyi tek grupta birleştirir', () => {
    const group = onlyGroup(['FFF', 'FFA', 'RST']);
    expect(group.cells).toHaveLength(5);
    expect(group.squares).toHaveLength(1);
    expect(group.runs).toHaveLength(1);
  });

  it('kare oluşturan kaydırmayı olası hamle olarak bulur', () => {
    const board = boardFrom(['FFA', 'FSF', 'RTA']);
    const move = findPossibleMoves(board).find(
      (m) => m.a.row === 1 && m.a.col === 1 && m.b.row === 1 && m.b.col === 2,
    );
    expect(move).toBeDefined();
    expect(sortedPositions(move!.matchCells)).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('Girdap renksizdir: eşleşmeye katılmaz', () => {
    const board = boardFrom(['FFF']);
    setSpecial(board, 0, 1, 'whirlpool');
    expect(hasAnyMatch(board)).toBe(false);
  });

  it('Harpun/Gülle/Martı kendi rengiyle eşleşir', () => {
    const board = boardFrom(['FFF']);
    setSpecial(board, 0, 1, 'cannon');
    expect(hasAnyMatch(board)).toBe(true);
  });
});

describe('eşleşme şekli → güçlendirici', () => {
  it('düz 3\'lü: güçlendirici yok', () => {
    expect(planSpecial(onlyGroup(['FFFA']))).toBeNull();
  });

  it('4\'lü düz → Harpun; zincirlemede eşleşmeye dik yönde', () => {
    const horizontal = onlyGroup(['FFFFA']);
    expect(classifyGroup(horizontal)).toBe('harpoon');
    expect(planSpecial(horizontal)).toEqual({ special: 'harpoon-v', pos: { row: 0, col: 2 } });
    const vertical = onlyGroup(['F', 'F', 'F', 'F', 'A']);
    expect(planSpecial(vertical)!.special).toBe('harpoon-h');
  });

  it('4\'lü düz → Harpun; kaydırmada kaydırma yönünde, kaydırılan karede', () => {
    const group = onlyGroup(['FFFFA']);
    expect(planSpecial(group, { swapCells: [{ row: 0, col: 1 }], swapAxis: 'horizontal' })).toEqual({
      special: 'harpoon-h',
      pos: { row: 0, col: 1 },
    });
    expect(planSpecial(group, { swapCells: [{ row: 0, col: 3 }], swapAxis: 'vertical' })).toEqual({
      special: 'harpoon-v',
      pos: { row: 0, col: 3 },
    });
  });

  it('5\'li ve daha uzun düz → Girdap', () => {
    expect(planSpecial(onlyGroup(['FFFFF']))).toEqual({ special: 'whirlpool', pos: { row: 0, col: 2 } });
    expect(classifyGroup(onlyGroup(['FFFFFF']))).toBe('whirlpool');
  });

  it('L şekli → Gülle, köşede', () => {
    expect(planSpecial(onlyGroup(['FAS', 'FAR', 'FFF']))).toEqual({ special: 'cannon', pos: { row: 2, col: 0 } });
  });

  it('T şekli → Gülle, kesişimde', () => {
    expect(planSpecial(onlyGroup(['RRRA', 'SRAS', 'TRST']))).toEqual({ special: 'cannon', pos: { row: 0, col: 1 } });
  });

  it('5\'li kollu L → Girdap (5\'li öncelikli)', () => {
    expect(classifyGroup(onlyGroup(['FFFFF', 'FASRT', 'FRTAS']))).toBe('whirlpool');
  });

  it('2x2 kare → Martı; kare + 3\'lü → Martı; 4\'lü + kare → Harpun', () => {
    expect(planSpecial(onlyGroup(['FFA', 'FFS', 'ART']))!.special).toBe('seagull');
    expect(classifyGroup(onlyGroup(['FFF', 'FFA', 'RST']))).toBe('seagull');
    expect(classifyGroup(onlyGroup(['FFFF', 'FFAS', 'RSTA']))).toBe('harpoon');
  });

  it('zincirlemede yeni düşen taşın yerinde oluşur', () => {
    const plan = planSpecial(onlyGroup(['FFFFA']), { recentlyMoved: new Set(['0,3']) });
    expect(plan!.pos).toEqual({ row: 0, col: 3 });
  });
});
