import type { Board } from './Board';
import type { Random } from './Random';
import type { Pos, Tile, TileColor } from './types';

/** Boşalan karelere gelecek yeni taşları üretir. Testlerde senaryolu sürümle değiştirilir. */
export interface TileSpawner {
  spawn(board: Board, p: Pos): Tile;
}

export class RandomSpawner implements TileSpawner {
  constructor(
    private readonly rng: Random,
    private readonly colors: readonly TileColor[],
  ) {}

  spawn(board: Board): Tile {
    return board.createTile(this.rng.pick(this.colors));
  }
}
