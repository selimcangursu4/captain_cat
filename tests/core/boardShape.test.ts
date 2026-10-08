import { describe, expect, it } from 'vitest';
import { Board } from '../../src/core/Board';
import { findEnclosedHoles, parseShape, rectShape } from '../../src/core/BoardShape';

describe('BoardShape', () => {
  it('dikdörtgen tahta tüm kareleri oynanabilir yapar', () => {
    const shape = rectShape(8, 8);
    expect(shape.rows).toBe(8);
    expect(shape.cols).toBe(8);
    expect(shape.playable.every(Boolean)).toBe(true);
  });

  it('satır dizisinden boşluklu şekil okur', () => {
    const shape = parseShape(['.xx.', 'xxxx', 'x..x']);
    const board = new Board(shape);
    expect(board.isPlayable({ row: 0, col: 0 })).toBe(false);
    expect(board.isPlayable({ row: 0, col: 1 })).toBe(true);
    expect(board.isPlayable({ row: 2, col: 1 })).toBe(false);
    expect(board.playablePositions()).toHaveLength(8);
    expect(board.columnPositions(1).map((p) => p.row)).toEqual([0, 1]);
  });

  it('içeride kalan boşlukları kenara açılanlardan ayırır', () => {
    const shape = parseShape(['.xxxx', 'xx.xx', 'x..xx', 'xxxx.', 'xxx..']);
    const enclosed = findEnclosedHoles(shape).map((p) => `${p.row},${p.col}`);
    // (1,2), (2,1), (2,2) içeride; köşedeki (0,0) ve sağ alttaki (3,4),(4,3),(4,4) kenara açılıyor.
    expect(enclosed.sort()).toEqual(['1,2', '2,1', '2,2']);
    expect(findEnclosedHoles(rectShape(3, 3))).toEqual([]);
  });

  it('hatalı şekilleri reddeder', () => {
    expect(() => parseShape([])).toThrow();
    expect(() => parseShape(['xx', 'x'])).toThrow();
    expect(() => parseShape(['x?'])).toThrow();
    expect(() => parseShape(['..'])).toThrow();
  });

  it('boşluğa taş konmasına izin vermez ve tahta dışını null döndürür', () => {
    const board = new Board(parseShape(['x.']));
    expect(() => board.setTile({ row: 0, col: 1 }, board.createTile('fish'))).toThrow();
    expect(board.getTile({ row: -1, col: 0 })).toBeNull();
    expect(board.getTile({ row: 0, col: 5 })).toBeNull();
  });

  it('her taşa benzersiz kimlik verir ve klon bağımsızdır', () => {
    const board = new Board(rectShape(1, 2));
    board.setTile({ row: 0, col: 0 }, board.createTile('fish'));
    board.setTile({ row: 0, col: 1 }, board.createTile('star'));
    const copy = board.clone();
    copy.getTile({ row: 0, col: 0 })!.color = 'ring';
    expect(board.getTile({ row: 0, col: 0 })!.color).toBe('fish');
    expect(copy.createTile('fish').id).toBe(board.createTile('fish').id);
  });
});
