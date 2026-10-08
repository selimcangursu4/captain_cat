import { describe, expect, it } from 'vitest';
import { Match3Engine, type CascadeStep, type MoveResult } from '../../src/core/Match3Engine';
import { OBSTACLE_CONFIG } from '../../src/config/obstacles';
import { obstacleCodes, OBSTACLE_LAYERS } from '../../src/core/obstacles';
import { findPossibleMoves } from '../../src/core/possibleMoves';
import { Random } from '../../src/core/Random';
import { RandomSpawner } from '../../src/core/spawner';
import { boardFrom, deadBoardLines, isSettled, placeBlock, setSpecial } from '../helpers/boardBuilder';

const ALL_COLORS = ['fish', 'anchor', 'shell', 'ring', 'star'] as const;

// (1,1)F ↔ (0,1)A kaydırması satır 0'da F F F eşleşmesi yapar.
const MATCH_BOARD = ['FAFR', 'SFRT', 'ATSF'];
const SWAP = [{ row: 1, col: 1 }, { row: 0, col: 1 }] as const;

function engineFor(board: ReturnType<typeof boardFrom>): Match3Engine {
  const rng = new Random(4);
  return new Match3Engine(board, rng, new RandomSpawner(rng, ALL_COLORS));
}

function firstStep(result: MoveResult): CascadeStep {
  if (result.kind !== 'resolved') throw new Error(`resolved bekleniyordu, gelen: ${result.kind}`);
  return result.steps[0];
}

describe('engel tanımları', () => {
  it('her katmanda kodlar benzersizdir', () => {
    for (const layer of OBSTACLE_LAYERS) expect(() => obstacleCodes(layer)).not.toThrow();
  });
});

describe('Yosun (zemin)', () => {
  it('üstündeki taş eşleşince bir katman temizlenir; 2 katmanlı yosun kalır', () => {
    const board = boardFrom(MATCH_BOARD);
    board.placeObstacle({ row: 0, col: 0 }, 'moss', 1);
    board.placeObstacle({ row: 0, col: 2 }, 'moss', 2);
    const step = firstStep(engineFor(board).trySwap(...SWAP));

    const hits = step.obstacleHits.filter((h) => h.kind === 'moss');
    expect(hits.map((h) => [h.pos.col, h.destroyed, h.layersLeft])).toEqual([
      [0, true, 0],
      [2, false, 1],
    ]);
    expect(board.getObstacle({ row: 0, col: 0 }, 'floor')).toBeNull();
    expect(board.getObstacle({ row: 0, col: 2 }, 'floor')!.layers).toBe(1);
  });

  it('yanındaki eşleşme yosunu temizlemez', () => {
    const board = boardFrom(MATCH_BOARD);
    board.placeObstacle({ row: 1, col: 0 }, 'moss', 1); // (0,0)'ın hemen altında
    const step = firstStep(engineFor(board).trySwap(...SWAP));
    expect(step.obstacleHits).toEqual([]);
  });
});

describe('Ağ (örtü)', () => {
  it('ağdaki taş kaydırılamaz', () => {
    const board = boardFrom(MATCH_BOARD);
    board.placeObstacle({ row: 1, col: 1 }, 'net', 1);
    expect(engineFor(board).trySwap(...SWAP).kind).toBe('invalid');
    expect(findPossibleMoves(board).some((m) => m.a.row === 1 && m.a.col === 1)).toBe(false);
  });

  it('ağdaki taş eşleşmeye katılır: ağ yırtılır, taş yerinde kalır', () => {
    const board = boardFrom(MATCH_BOARD);
    board.placeObstacle({ row: 0, col: 2 }, 'net', 1);
    const tileId = board.getTile({ row: 0, col: 2 })!.id;
    const step = firstStep(engineFor(board).trySwap(...SWAP));

    expect(step.obstacleHits).toMatchObject([{ kind: 'net', cause: 'match', destroyed: true }]);
    expect(step.cleared.map((c) => c.tileId)).not.toContain(tileId);
    expect(board.isCovered({ row: 0, col: 2 })).toBe(false);
    expect(board.getTile({ row: 0, col: 2 })!.id).toBe(tileId);
  });

  it('yanında eşleşme olunca ağ yırtılır', () => {
    const board = boardFrom(MATCH_BOARD);
    board.placeObstacle({ row: 1, col: 0 }, 'net', 1);
    const step = firstStep(engineFor(board).trySwap(...SWAP));
    expect(step.obstacleHits).toMatchObject([{ kind: 'net', cause: 'adjacent', destroyed: true }]);
  });

  it('güçlendirici ağdaki taşı kırmaz, yalnızca ağı yırtar', () => {
    const board = boardFrom(deadBoardLines(5, 5));
    setSpecial(board, 2, 0, 'harpoon-h');
    board.placeObstacle({ row: 2, col: 3 }, 'net', 1);
    const tileId = board.getTile({ row: 2, col: 3 })!.id;
    const act = firstStep(engineFor(board).activateAt({ row: 2, col: 0 })).activations[0];
    expect(act.obstacleHits).toMatchObject([{ kind: 'net', cause: 'special' }]);
    expect(act.cleared.map((c) => c.tileId)).not.toContain(tileId);
    expect(act.cleared).toHaveLength(4);
  });
});

describe('Kum torbası, sandık, martı yuvası (blok)', () => {
  it('kum torbası yanındaki eşleşmeyle katman kaybeder; eşleşme sayısı kadar değil, bir kez', () => {
    const board = boardFrom(MATCH_BOARD);
    placeBlock(board, 1, 2, 'sandbag', 2); // hem (0,2) hem (1,1)'e komşu
    const step = firstStep(engineFor(board).trySwap(...SWAP));
    expect(step.obstacleHits).toMatchObject([{ kind: 'sandbag', cause: 'adjacent', layersLeft: 1, destroyed: false }]);
  });

  it('kum torbası kalkınca karesi yerçekimiyle dolar', () => {
    const board = boardFrom(MATCH_BOARD);
    placeBlock(board, 1, 2, 'sandbag', 1);
    firstStep(engineFor(board).trySwap(...SWAP));
    expect(board.isBlocked({ row: 1, col: 2 })).toBe(false);
    expect(board.getTile({ row: 1, col: 2 })).not.toBeNull();
    expect(isSettled(board)).toBe(true);
  });

  it('Harpun kum torbasına hasar verir ve arkasındaki taşları da kırar', () => {
    const board = boardFrom(deadBoardLines(5, 5));
    setSpecial(board, 2, 0, 'harpoon-h');
    placeBlock(board, 2, 2, 'sandbag', 3);
    const act = firstStep(engineFor(board).activateAt({ row: 2, col: 0 })).activations[0];
    expect(act.obstacleHits).toMatchObject([{ kind: 'sandbag', cause: 'special', layersLeft: 2 }]);
    expect(act.cleared.map((c) => c.pos.col).sort()).toEqual([0, 1, 3, 4]);
  });

  it('kilitli sandık son vuruşta açılır ve altın verir', () => {
    const board = boardFrom(MATCH_BOARD);
    placeBlock(board, 1, 2, 'chest', 1);
    const step = firstStep(engineFor(board).trySwap(...SWAP));
    expect(step.obstacleHits).toMatchObject([
      { kind: 'chest', destroyed: true, reward: { coins: OBSTACLE_CONFIG.chestCoins } },
    ]);
  });

  it('martı yuvası her vuruşta bir martı verir, katmanları bitince kalkar', () => {
    const board = boardFrom(MATCH_BOARD);
    placeBlock(board, 1, 2, 'nest', 2);
    const step = firstStep(engineFor(board).trySwap(...SWAP));
    expect(step.obstacleHits).toMatchObject([{ kind: 'nest', destroyed: false, reward: { seagulls: 1 } }]);
    expect(board.getObstacle({ row: 1, col: 2 }, 'block')!.layers).toBe(1);
  });

  it('Martı güçlendiricisi blok engeli de hedef alabilir', () => {
    const board = boardFrom(deadBoardLines(5, 5));
    setSpecial(board, 0, 0, 'seagull');
    placeBlock(board, 4, 4, 'sandbag', 2);
    const rng = new Random(1);
    const engine = new Match3Engine(board, rng, new RandomSpawner(rng, ALL_COLORS), {
      targetPicker: (b, candidates) => candidates.find((p) => b.isBlocked(p)) ?? null,
    });
    const act = firstStep(engine.activateAt({ row: 0, col: 0 })).activations[0];
    expect(act.target).toEqual({ row: 4, col: 4 });
    expect(act.obstacleHits).toMatchObject([{ kind: 'sandbag', layersLeft: 1 }]);
  });
});
