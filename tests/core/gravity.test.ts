import { describe, expect, it } from 'vitest';
import { settle } from '../../src/core/gravity';
import { boardFrom, boardToLines, placeBlock, ScriptedSpawner } from '../helpers/boardBuilder';

const pathOf = (steps: readonly { pos: { row: number; col: number }; tick: number }[]) =>
  steps.map((s) => `${s.pos.row},${s.pos.col}@${s.tick}`);

describe('yerçekimi (settle)', () => {
  it('taşları adım adım düşürür, yukarıdan yenilerini getirir ve kimlikleri korur', () => {
    const board = boardFrom(['F', 'A', '_', '_', 'S']);
    const fishId = board.getTile({ row: 0, col: 0 })!.id;
    const anchorId = board.getTile({ row: 1, col: 0 })!.id;
    const spawner = new ScriptedSpawner('RT');

    const result = settle(board, () => spawner.spawn(board));

    expect(boardToLines(board)).toEqual(['T', 'R', 'F', 'A', 'S']);
    expect(result.ticks).toBe(2);
    expect(pathOf(result.falls.find((f) => f.tileId === anchorId)!.path)).toEqual(['1,0@0', '2,0@1', '3,0@2']);
    expect(pathOf(result.falls.find((f) => f.tileId === fishId)!.path)).toEqual(['0,0@0', '1,0@1', '2,0@2']);
    // Yeni taşlar sütunun üstündeki sanal satırdan gelir.
    expect(pathOf(result.spawns[0].path)).toEqual(['-1,0@0', '0,0@1', '1,0@2']);
    expect(pathOf(result.spawns[1].path)).toEqual(['-1,0@1', '0,0@2']);
  });

  it('dolu tahtada hiçbir şey hareket etmez', () => {
    const board = boardFrom(['FA', 'SR']);
    const result = settle(board, () => {
      throw new Error('yeni taş istenmemeli');
    });
    expect(result.falls).toEqual([]);
    expect(result.ticks).toBe(0);
  });

  it('yeni taşlar adım adım, her adımda soldan sağa üretilir', () => {
    const board = boardFrom(['__', '_S', 'RA']);
    const spawner = new ScriptedSpawner('FAT');
    settle(board, () => spawner.spawn(board));
    // 1. adım: (0,0)←F, (0,1)←A · 2. adım: F iner, (0,0)←T
    expect(boardToLines(board)).toEqual(['TA', 'FS', 'RA']);
  });

  it('taş boşluğun (tahtada olmayan karenin) arkasından geçip aşağı düşer', () => {
    const board = boardFrom(['F', '.', '_']);
    const spawner = new ScriptedSpawner('A');
    const result = settle(board, () => spawner.spawn(board));
    expect(boardToLines(board)).toEqual(['A', '.', 'F']);
    expect(pathOf(result.falls[0].path)).toEqual(['0,0@0', '2,0@1']);
  });

  it('üstü boşluklu sütunda yeni taş ilk oynanabilir karenin üstünden gelir', () => {
    const board = boardFrom(['.', '.', '_', 'F']);
    const spawner = new ScriptedSpawner('A');
    const result = settle(board, () => spawner.spawn(board));
    expect(pathOf(result.spawns[0].path)).toEqual(['1,0@0', '2,0@1']);
  });

  it('kum torbasının altındaki boş kare çaprazdan kayan taşla dolar', () => {
    const board = boardFrom(['FAS', 'R_T', '___']);
    placeBlock(board, 1, 1, 'sandbag', 1);
    const spawner = new ScriptedSpawner('RTA');
    const result = settle(board, () => spawner.spawn(board));

    expect(board.isFull()).toBe(true);
    expect(board.getTile({ row: 1, col: 1 })).toBeNull();
    const diagonal = [...result.falls, ...result.spawns].some((m) =>
      m.path.some((s, i) => i > 0 && s.pos.col !== m.path[i - 1].pos.col),
    );
    expect(diagonal).toBe(true);
    expect(spawner.remaining).toBe(0);
  });

  it('ağdaki taş düşmez; altı yandan kayan taşla dolar', () => {
    const board = boardFrom(['FA', '__']);
    board.placeObstacle({ row: 0, col: 0 }, 'net', 1);
    const fishId = board.getTile({ row: 0, col: 0 })!.id;
    const spawner = new ScriptedSpawner('STR');
    settle(board, () => spawner.spawn(board));
    expect(board.getTile({ row: 0, col: 0 })!.id).toBe(fishId);
    expect(board.isFull()).toBe(true);
  });

  it('tamamen kapalı bölge boş kalır ve simülasyon biter', () => {
    const board = boardFrom(['FA', '__', '__']);
    placeBlock(board, 1, 0, 'sandbag', 1);
    placeBlock(board, 1, 1, 'sandbag', 1);
    const result = settle(board, () => {
      throw new Error('yeni taş istenmemeli');
    });
    expect(result.ticks).toBe(0);
    expect(board.getTile({ row: 2, col: 0 })).toBeNull();
    expect(board.isFull()).toBe(false);
  });
});
