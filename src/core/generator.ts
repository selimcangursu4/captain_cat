import { BOARD_CONFIG } from '../config/board';
import { Board } from './Board';
import type { BoardShape } from './BoardShape';
import { hasAnyMatch, matchCellsAt } from './matchFinder';
import { hasPossibleMove } from './possibleMoves';
import type { Random } from './Random';
import type { Pos, Tile, TileColor } from './types';

/**
 * p karesine konduğunda eşleşme oluşturmayan rastgele bir renk seçer.
 * Böyle bir renk yoksa (çok az renk) herhangi birini döndürür.
 */
export function pickSafeColor(
  board: Board,
  p: Pos,
  rng: Random,
  colors: readonly TileColor[],
  minMatch: number = BOARD_CONFIG.minMatch,
): TileColor {
  const previous = board.getTile(p);
  const safe = colors.filter((color) => {
    board.setTile(p, { id: -1, color });
    return matchCellsAt(board, p, minMatch).length === 0;
  });
  board.setTile(p, previous);
  return rng.pick(safe.length > 0 ? safe : colors);
}

/** Boş karelere, eşleşme oluşturmayacak şekilde taş koyar (dolu karelere dokunmaz). */
export function fillWithoutMatches(
  board: Board,
  rng: Random,
  colors: readonly TileColor[],
  minMatch: number = BOARD_CONFIG.minMatch,
  makeTile: (color: TileColor) => Tile = (color) => board.createTile(color),
): void {
  for (const p of board.playablePositions()) {
    if (!board.canHoldTile(p) || board.getTile(p) !== null) continue;
    board.setTile(p, makeTile(pickSafeColor(board, p, rng, colors, minMatch)));
  }
}

/**
 * Başlangıçta hazır eşleşmesi olmayan ve en az bir olası hamlesi olan tahta üretir.
 * `prepare`, rastgele doldurmadan önce çağrılır (engeller ve bölümün sabit taşları için).
 */
export function generateBoard(
  shape: BoardShape,
  rng: Random,
  colors: readonly TileColor[] = BOARD_CONFIG.defaultColors,
  minMatch: number = BOARD_CONFIG.minMatch,
  maxAttempts: number = BOARD_CONFIG.maxGenerateAttempts,
  prepare?: (board: Board) => void,
): Board {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const board = new Board(shape);
    prepare?.(board);
    fillWithoutMatches(board, rng, colors, minMatch);
    if (!hasAnyMatch(board, minMatch) && hasPossibleMove(board, minMatch)) return board;
  }
  throw new Error(
    `${maxAttempts} denemede oynanabilir tahta üretilemedi (renk sayısı: ${colors.length})`,
  );
}
