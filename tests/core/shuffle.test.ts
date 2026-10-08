import { describe, expect, it } from 'vitest';
import { hasAnyMatch } from '../../src/core/matchFinder';
import { hasPossibleMove } from '../../src/core/possibleMoves';
import { Random } from '../../src/core/Random';
import { shuffleBoard } from '../../src/core/shuffle';
import { allTileIds, boardFrom, boardToLines, deadBoardLines } from '../helpers/boardBuilder';

function colorCounts(lines: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ch of lines.join('')) counts[ch] = (counts[ch] ?? 0) + 1;
  return counts;
}

describe('shuffle', () => {
  it('ölü tahtayı eşleşmesiz ve hamlesi olan bir dizilime karıştırır', () => {
    const board = boardFrom(deadBoardLines(6, 6));
    const before = boardToLines(board);
    const idsBefore = allTileIds(board).sort();

    const moves = shuffleBoard(board, new Random(42));

    expect(moves).not.toBeNull();
    expect(hasAnyMatch(board)).toBe(false);
    expect(hasPossibleMove(board)).toBe(true);
    expect(allTileIds(board).sort()).toEqual(idsBefore);
    expect(colorCounts(boardToLines(board))).toEqual(colorCounts(before));
  });

  it('her hareket taşın eski ve yeni yerini doğru bildirir', () => {
    const board = boardFrom(deadBoardLines(5, 5));
    const originalPos = new Map(
      board.playablePositions().map((p) => [board.getTile(p)!.id, p] as const),
    );
    const moves = shuffleBoard(board, new Random(9))!;
    expect(moves).toHaveLength(25);
    for (const move of moves) {
      expect(move.from).toEqual(originalPos.get(move.tileId));
      expect(board.getTile(move.to)!.id).toBe(move.tileId);
      expect(board.getTile(move.to)!.color).toBe(move.color);
    }
  });

  it('boşluklara dokunmaz', () => {
    const lines = deadBoardLines(6, 6).map((line, row) =>
      row === 0 ? '..' + line.slice(2) : line,
    );
    const board = boardFrom(lines);
    shuffleBoard(board, new Random(5));
    expect(board.isPlayable({ row: 0, col: 0 })).toBe(false);
    expect(boardToLines(board)[0].slice(0, 2)).toBe('..');
    expect(board.isFull()).toBe(true);
  });

  it('çözümsüz tahtada null döner ve tahtayı eski haline getirir', () => {
    const board = boardFrom(['FAS']);
    const before = boardToLines(board);
    expect(shuffleBoard(board, new Random(1), undefined, undefined, 20)).toBeNull();
    expect(boardToLines(board)).toEqual(before);
  });
});
