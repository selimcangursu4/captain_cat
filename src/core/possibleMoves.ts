import { BOARD_CONFIG } from '../config/board';
import type { Board } from './Board';
import { matchCellsAt } from './matchFinder';
import { isAdjacent, uniquePositions } from './pos';
import type { Pos } from './types';

/**
 * Eşleşme oluşturan bir yer değiştirme. matchCells: hamle SONRASI eşleşen kareler.
 * (İpucunda a = b ise: o karedeki güçlendiriciye dokunulabilir.)
 */
export interface PossibleMove {
  readonly a: Pos;
  readonly b: Pos;
  readonly matchCells: readonly Pos[];
}

/** Bu kare kaydırılabilir bir taş içeriyor mu? (Ağ içindeki taş hareket edemez.) */
export function isSwappable(board: Board, p: Pos): boolean {
  return board.getTile(p) !== null && !board.isCovered(p);
}

export function canSwap(board: Board, a: Pos, b: Pos): boolean {
  return isAdjacent(a, b) && isSwappable(board, a) && isSwappable(board, b);
}

function evaluateSwap(board: Board, a: Pos, b: Pos, minMatch: number): Pos[] {
  board.swap(a, b);
  const cells = uniquePositions([
    ...matchCellsAt(board, a, minMatch),
    ...matchCellsAt(board, b, minMatch),
  ]);
  board.swap(a, b);
  return cells;
}

function* candidateSwaps(board: Board): Generator<[Pos, Pos]> {
  for (const p of board.playablePositions()) {
    for (const q of [
      { row: p.row, col: p.col + 1 },
      { row: p.row + 1, col: p.col },
    ]) {
      if (!canSwap(board, p, q)) continue;
      if (board.getTile(p)!.color === board.getTile(q)!.color) continue;
      yield [p, q];
    }
  }
}

export function findPossibleMoves(
  board: Board,
  minMatch: number = BOARD_CONFIG.minMatch,
): PossibleMove[] {
  const moves: PossibleMove[] = [];
  for (const [a, b] of candidateSwaps(board)) {
    const matchCells = evaluateSwap(board, a, b, minMatch);
    if (matchCells.length > 0) moves.push({ a, b, matchCells });
  }
  return moves;
}

/** Eşleşme yapan bir kaydırma ya da tetiklenebilecek bir güçlendirici var mı? */
export function hasPossibleMove(board: Board, minMatch: number = BOARD_CONFIG.minMatch): boolean {
  if (board.hasSpecial()) return true;
  for (const [a, b] of candidateSwaps(board)) {
    if (evaluateSwap(board, a, b, minMatch).length > 0) return true;
  }
  return false;
}
