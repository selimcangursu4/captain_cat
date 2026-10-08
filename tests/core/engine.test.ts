import { describe, expect, it } from 'vitest';
import { parseShape, rectShape } from '../../src/core/BoardShape';
import { Match3Engine, type MoveResult } from '../../src/core/Match3Engine';
import { hasAnyMatch } from '../../src/core/matchFinder';
import { findPossibleMoves, hasPossibleMove } from '../../src/core/possibleMoves';
import { Random } from '../../src/core/Random';
import { RandomSpawner } from '../../src/core/spawner';
import type { TileColor } from '../../src/core/types';
import {
  allTileIds,
  boardFrom,
  boardToLines,
  deadBoardLines,
  ScriptedSpawner,
  sortedPositions,
} from '../helpers/boardBuilder';

function engineFrom(lines: string[], spawns = '', seed = 1): { engine: Match3Engine; spawner: ScriptedSpawner } {
  const spawner = new ScriptedSpawner(spawns);
  const engine = new Match3Engine(boardFrom(lines), new Random(seed), spawner);
  return { engine, spawner };
}

// Kaydırma (2,2)↔(2,3) → satır 2: F F F → temizlenir, üstü düşer,
// yeni taşlar S T T gelir → satır 0: S T T T → ikinci (zincirleme) eşleşme.
const CASCADE_BOARD = ['ASRT', 'SRTA', 'FFAF', 'RTSR', 'TAFS'];

describe('Match3Engine.trySwap', () => {
  it('komşu olmayan, çapraz, boşluk veya tahta dışı kaydırmayı geçersiz sayar', () => {
    const lines = ['FAS.', 'ASFR'];
    const { engine } = engineFrom(lines);
    expect(engine.trySwap({ row: 0, col: 0 }, { row: 0, col: 2 }).kind).toBe('invalid');
    expect(engine.trySwap({ row: 0, col: 0 }, { row: 1, col: 1 }).kind).toBe('invalid');
    expect(engine.trySwap({ row: 0, col: 2 }, { row: 0, col: 3 }).kind).toBe('invalid');
    expect(engine.trySwap({ row: 0, col: 0 }, { row: -1, col: 0 }).kind).toBe('invalid');
    expect(boardToLines(engine.board)).toEqual(lines);
  });

  it('eşleşme oluşturmayan kaydırmada taşlar geri döner (tahta değişmez)', () => {
    const lines = ['FAS', 'ASF', 'SFA'];
    const { engine } = engineFrom(lines);
    const idBefore = engine.board.getTile({ row: 0, col: 0 })!.id;
    const result = engine.trySwap({ row: 0, col: 0 }, { row: 0, col: 1 });
    expect(result.kind).toBe('rejected');
    expect(boardToLines(engine.board)).toEqual(lines);
    expect(engine.board.getTile({ row: 0, col: 0 })!.id).toBe(idBefore);
  });

  it('eşleşmeyi temizler, taşları düşürür, yenileri getirir ve zinciri çözer', () => {
    const { engine, spawner } = engineFrom(CASCADE_BOARD, 'STT' + 'AFS');
    const fishIds = [0, 1, 3].map((col) => engine.board.getTile({ row: 2, col })!.id);

    const result = engine.trySwap({ row: 2, col: 2 }, { row: 2, col: 3 });
    if (result.kind !== 'resolved') throw new Error(`beklenen resolved, gelen ${result.kind}`);

    expect(result.steps).toHaveLength(2);

    const [first, second] = result.steps;
    expect(first.index).toBe(0);
    expect(first.groups).toHaveLength(1);
    expect(first.groups[0].color).toBe('fish');
    expect(first.cleared.map((c) => c.tileId).sort()).toEqual([...fishIds].sort());
    expect(first.falls).toHaveLength(6);
    expect(first.spawns).toHaveLength(3);

    expect(second.index).toBe(1);
    expect(second.groups[0].color).toBe('star');
    expect(sortedPositions(second.cleared.map((c) => c.pos))).toEqual(['0,1', '0,2', '0,3']);
    expect(second.falls).toHaveLength(0);

    expect(boardToLines(engine.board)).toEqual(['SAFS', 'ASRA', 'SRTA', 'RTSR', 'TAFS']);
    expect(spawner.remaining).toBe(0);
    expect(result.shuffle).toBeUndefined();
  });

  it('düşen taşların hareketleri kimlikle doğru eşleşir', () => {
    const { engine } = engineFrom(CASCADE_BOARD, 'STTAFS');
    const anchorId = engine.board.getTile({ row: 0, col: 0 })!.id; // A, (0,0) → (1,0)
    const result = engine.trySwap({ row: 2, col: 2 }, { row: 2, col: 3 });
    if (result.kind !== 'resolved') throw new Error('resolved bekleniyordu');
    const fall = result.steps[0].falls.find((f) => f.tileId === anchorId);
    expect(fall).toMatchObject({ tileId: anchorId, from: { row: 0, col: 0 }, to: { row: 1, col: 0 } });
  });

  it('aynı anda oluşan iki ayrı eşleşmeyi aynı adımda temizler', () => {
    // (1,1)A ↔ (1,2)F → sütun 1: F F F ve sütun 2: A A A
    const lines = ['SFAR', 'TAFS', 'RFAT', 'ARST'];
    const { engine } = engineFrom(lines, 'FRS' + 'ATS');
    const result = engine.trySwap({ row: 1, col: 1 }, { row: 1, col: 2 });
    if (result.kind !== 'resolved') throw new Error('resolved bekleniyordu');
    expect(result.steps[0].groups.map((g) => g.color).sort()).toEqual(['anchor', 'fish']);
    expect(result.steps[0].cleared).toHaveLength(6);
  });
});

describe('Match3Engine karıştırma ve ipucu', () => {
  it('ölü tahtada ensurePlayable tahtayı karıştırır', () => {
    const rng = new Random(11);
    const engine = new Match3Engine(
      boardFrom(deadBoardLines(6, 6)),
      rng,
      new RandomSpawner(rng, ['fish', 'anchor', 'shell', 'ring', 'star']),
    );
    expect(engine.findHint()).toBeNull();
    const moves = engine.ensurePlayable();
    expect(moves).not.toBeNull();
    expect(hasPossibleMove(engine.board)).toBe(true);
    expect(hasAnyMatch(engine.board)).toBe(false);
    expect(engine.findHint()).not.toBeNull();
  });

  it('oynanabilir tahtada ensurePlayable hiçbir şey yapmaz', () => {
    const engine = Match3Engine.create(rectShape(8, 8), 5);
    const before = boardToLines(engine.board);
    expect(engine.ensurePlayable()).toBeNull();
    expect(boardToLines(engine.board)).toEqual(before);
  });

  it('ipucu en çok taş eşleştiren hamleyi seçer', () => {
    const engine = Match3Engine.create(rectShape(8, 8), 77);
    const hint = engine.findHint()!;
    const best = Math.max(...findPossibleMoves(engine.board).map((m) => m.matchCells.length));
    expect(hint.matchCells.length).toBe(best);
  });
});

describe('Match3Engine rastgele oyun (invariant testi)', () => {
  const scenarios: { name: string; shape: ReturnType<typeof rectShape>; colors?: TileColor[] }[] = [
    { name: '8x8, 5 renk', shape: rectShape(8, 8) },
    {
      name: 'boşluklu şekil',
      shape: parseShape(['xxx..xxx', 'xxxxxxxx', 'xx.xx.xx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', 'xxxxxxxx']),
    },
    { name: '7x9, 4 renk', shape: rectShape(9, 7), colors: ['fish', 'anchor', 'ring', 'star'] },
  ];

  /** Rastgele bir hamle: çoğunlukla eşleşme, bazen güçlendiriciye dokunma veya onu kaydırma. */
  function randomMove(engine: Match3Engine, picker: Random): MoveResult {
    const board = engine.board;
    const specials = board.playablePositions().filter((p) => board.getTile(p)?.special);
    const moves = findPossibleMoves(board);
    const roll = picker.next();
    if (specials.length > 0 && (moves.length === 0 || roll < 0.35)) {
      const p = picker.pick(specials);
      if (roll < 0.15) return engine.activateAt(p);
      const neighbors = [
        { row: p.row - 1, col: p.col },
        { row: p.row + 1, col: p.col },
        { row: p.row, col: p.col - 1 },
        { row: p.row, col: p.col + 1 },
      ].filter((q) => board.getTile(q) !== null);
      // Komşuda güçlendirici varsa onu tercih et (kombinasyonları da sınar).
      const special = neighbors.find((q) => board.getTile(q)?.special);
      return engine.trySwap(p, special ?? picker.pick(neighbors));
    }
    expect(moves.length).toBeGreaterThan(0);
    const move = picker.pick(moves);
    return engine.trySwap(move.a, move.b);
  }

  for (const { name, shape, colors } of scenarios) {
    it(`${name}: 200 hamle boyunca tahta ve olaylar tutarlı kalır`, () => {
      const engine = Match3Engine.create(shape, 2024, { colors });
      const picker = new Random(99);
      let ids = new Set(allTileIds(engine.board));
      const seenKinds = new Set<string>();

      for (let turn = 0; turn < 200; turn++) {
        const result = randomMove(engine, picker);
        expect(result.kind).toBe('resolved');
        if (result.kind !== 'resolved') return;

        expect(result.steps.length).toBeGreaterThan(0);
        for (const step of result.steps) {
          const stepCleared = new Set(step.cleared.map((c) => c.tileId));
          expect(stepCleared.size).toBe(step.cleared.length); // her taş bir kez kalkar
          for (const activation of step.activations) {
            seenKinds.add(activation.kind);
            for (const c of activation.cleared) expect(stepCleared.has(c.tileId)).toBe(true);
          }
          for (const c of step.cleared) {
            expect(ids.has(c.tileId)).toBe(true);
            ids.delete(c.tileId);
          }
          for (const c of step.created) {
            seenKinds.add(`created:${c.tile.special}`);
            ids.add(c.tile.id);
          }
          for (const s of step.spawns) ids.add(s.tile.id);
        }

        const boardIds = allTileIds(engine.board);
        expect(new Set(boardIds).size).toBe(boardIds.length); // kimlikler benzersiz
        expect([...ids].sort()).toEqual([...boardIds].sort()); // olaylar tahtayla birebir
        expect(engine.board.isFull()).toBe(true);
        expect(hasAnyMatch(engine.board)).toBe(false);
        expect(hasPossibleMove(engine.board)).toBe(true);
        ids = new Set(boardIds);
      }
      // Rastgele oyunda güçlendiriciler gerçekten oluşup patlamış olmalı.
      expect([...seenKinds].some((k) => k.startsWith('created:'))).toBe(true);
      expect([...seenKinds].some((k) => !k.startsWith('created:'))).toBe(true);
    });
  }
});
