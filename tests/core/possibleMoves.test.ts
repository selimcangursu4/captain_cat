import { describe, expect, it } from 'vitest';
import { canSwap, findPossibleMoves, hasPossibleMove } from '../../src/core/possibleMoves';
import { boardFrom, boardToLines, deadBoardLines, sortedPositions } from '../helpers/boardBuilder';

describe('possibleMoves', () => {
  it('eşleşme oluşturan kaydırmayı ve hamle sonrası eşleşen kareleri bulur', () => {
    const board = boardFrom(['FAFF', 'STRS']);
    const moves = findPossibleMoves(board);
    const move = moves.find((m) => m.a.col === 0 && m.b.col === 1 && m.a.row === 0 && m.b.row === 0);
    expect(move).toBeDefined();
    expect(sortedPositions(move!.matchCells)).toEqual(['0,1', '0,2', '0,3']);
    expect(hasPossibleMove(board)).toBe(true);
  });

  it('dikey kaydırmayla oluşan eşleşmeyi de bulur', () => {
    const board = boardFrom(['FA', 'AF', 'FS', 'FR']);
    const moves = findPossibleMoves(board);
    expect(moves.some((m) => m.a.row === 0 && m.a.col === 0 && m.b.row === 0 && m.b.col === 1)).toBe(
      false,
    );
    // (1,0)A ↔ (1,1)F → sütun 0: F F F F
    expect(
      moves.some((m) => m.a.row === 1 && m.a.col === 0 && m.b.row === 1 && m.b.col === 1),
    ).toBe(true);
  });

  it('ölü tahtada hamle bulmaz', () => {
    const board = boardFrom(deadBoardLines(6, 6));
    expect(findPossibleMoves(board)).toEqual([]);
    expect(hasPossibleMove(board)).toBe(false);
  });

  it('arama sırasında tahtayı değiştirmez', () => {
    const lines = ['FAFF', 'STRS', 'AFSA'];
    const board = boardFrom(lines);
    findPossibleMoves(board);
    expect(boardToLines(board)).toEqual(lines);
  });

  it('canSwap: yalnızca komşu ve dolu kareler', () => {
    const board = boardFrom(['FA.', 'S_R']);
    expect(canSwap(board, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(canSwap(board, { row: 0, col: 0 }, { row: 1, col: 0 })).toBe(true);
    expect(canSwap(board, { row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false); // çapraz
    expect(canSwap(board, { row: 0, col: 1 }, { row: 0, col: 2 })).toBe(false); // boşluk
    expect(canSwap(board, { row: 1, col: 0 }, { row: 1, col: 1 })).toBe(false); // boş kare
    expect(canSwap(board, { row: 0, col: 0 }, { row: 0, col: -1 })).toBe(false); // tahta dışı
  });
});
