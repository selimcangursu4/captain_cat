import { describe, expect, it } from 'vitest';
import { parseShape, rectShape } from '../../src/core/BoardShape';
import { fillWithoutMatches, generateBoard } from '../../src/core/generator';
import { hasAnyMatch } from '../../src/core/matchFinder';
import { hasPossibleMove } from '../../src/core/possibleMoves';
import { Random } from '../../src/core/Random';
import type { TileColor } from '../../src/core/types';
import { allTileIds, boardFrom, boardToLines } from '../helpers/boardBuilder';

const DIAMOND = ['..xxxx..', '.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..'];

describe('generator', () => {
  it('başlangıçta hazır eşleşme olmayan, hamlesi olan dolu tahta üretir', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const board = generateBoard(rectShape(8, 8), new Random(seed));
      expect(board.isFull()).toBe(true);
      expect(hasAnyMatch(board)).toBe(false);
      expect(hasPossibleMove(board)).toBe(true);
    }
  });

  it('boşluklu şekillerde boşluklara taş koymaz', () => {
    const board = generateBoard(parseShape(DIAMOND), new Random(7));
    expect(board.isFull()).toBe(true);
    expect(board.getTile({ row: 0, col: 0 })).toBeNull();
    expect(allTileIds(board)).toHaveLength(52);
    expect(hasAnyMatch(board)).toBe(false);
  });

  it('aynı tohumla aynı tahtayı üretir', () => {
    const a = generateBoard(rectShape(8, 8), new Random(12345));
    const b = generateBoard(rectShape(8, 8), new Random(12345));
    expect(boardToLines(a)).toEqual(boardToLines(b));
  });

  it('yalnızca bölümün izin verdiği renkleri kullanır', () => {
    const colors: TileColor[] = ['fish', 'anchor', 'shell'];
    const board = generateBoard(rectShape(9, 9), new Random(3), colors);
    for (const p of board.playablePositions()) {
      expect(colors).toContain(board.getTile(p)!.color);
    }
    expect(hasAnyMatch(board)).toBe(false);
  });

  it('fillWithoutMatches dolu karelere dokunmaz', () => {
    const board = boardFrom(['FF__', '____', 'A___']);
    fillWithoutMatches(board, new Random(1), ['fish', 'anchor', 'shell', 'ring', 'star']);
    const lines = boardToLines(board);
    expect(lines[0].slice(0, 2)).toBe('FF');
    expect(lines[0][2]).not.toBe('F');
    expect(lines[2][0]).toBe('A');
    expect(hasAnyMatch(board)).toBe(false);
  });

  it('oynanabilir tahta imkânsızsa hata verir (sonsuz döngü yok)', () => {
    expect(() => generateBoard(rectShape(1, 2), new Random(1))).toThrow();
  });
});
