import { BOARD_CONFIG } from '../config/board';
import type { Board } from './Board';
import { posKey, uniquePositions } from './pos';
import type { Pos, Tile, TileColor } from './types';

export type Orientation = 'horizontal' | 'vertical';

/** Tek doğrultudaki kesintisiz aynı renk dizisi (en az minMatch uzunlukta). */
export interface MatchRun {
  readonly color: TileColor;
  readonly orientation: Orientation;
  readonly cells: readonly Pos[];
}

/** 2x2 aynı renk kare (Martı oluşturur). */
export interface MatchSquare {
  readonly color: TileColor;
  readonly topLeft: Pos;
  readonly cells: readonly Pos[];
}

/**
 * Ortak kare paylaşan dizi ve karelerin birleşimi. Örn. L/T şekli = 1 yatay + 1 dikey dizi.
 * Hangi güçlendiricinin oluşacağı bu şekle göre belirlenir (specials.ts).
 */
export interface MatchGroup {
  readonly color: TileColor;
  readonly cells: readonly Pos[];
  readonly runs: readonly MatchRun[];
  readonly squares: readonly MatchSquare[];
}

/**
 * Taşın eşleşme rengi; eşleşemiyorsa null.
 * Girdap renksizdir. (Aşama 3: ağ vb. engeller de burada devreye girecek.)
 */
export function matchColor(tile: Tile | null): TileColor | null {
  if (!tile || tile.special === 'whirlpool') return null;
  return tile.color;
}

function scanLine(
  length: number,
  at: (i: number) => Pos,
  board: Board,
  orientation: Orientation,
  minMatch: number,
  out: MatchRun[],
): void {
  let start = 0;
  while (start < length) {
    const color = matchColor(board.getTile(at(start)));
    if (color === null) {
      start++;
      continue;
    }
    let end = start + 1;
    while (end < length && matchColor(board.getTile(at(end))) === color) end++;
    if (end - start >= minMatch) {
      const cells: Pos[] = [];
      for (let i = start; i < end; i++) cells.push(at(i));
      out.push({ color, orientation, cells });
    }
    start = end;
  }
}

/** Tahtadaki tüm yatay ve dikey eşleşme dizileri. */
export function findRuns(board: Board, minMatch: number = BOARD_CONFIG.minMatch): MatchRun[] {
  const runs: MatchRun[] = [];
  for (let row = 0; row < board.rows; row++) {
    scanLine(board.cols, (col) => ({ row, col }), board, 'horizontal', minMatch, runs);
  }
  for (let col = 0; col < board.cols; col++) {
    scanLine(board.rows, (row) => ({ row, col }), board, 'vertical', minMatch, runs);
  }
  return runs;
}

function squareAt(board: Board, topLeft: Pos): MatchSquare | null {
  const cells = [
    topLeft,
    { row: topLeft.row, col: topLeft.col + 1 },
    { row: topLeft.row + 1, col: topLeft.col },
    { row: topLeft.row + 1, col: topLeft.col + 1 },
  ];
  const color = matchColor(board.getTile(cells[0]));
  if (color === null) return null;
  for (let i = 1; i < 4; i++) {
    if (matchColor(board.getTile(cells[i])) !== color) return null;
  }
  return { color, topLeft, cells };
}

/** Tahtadaki tüm 2x2 aynı renk kareler. */
export function findSquares(board: Board): MatchSquare[] {
  if (!BOARD_CONFIG.squareMatches) return [];
  const squares: MatchSquare[] = [];
  for (let row = 0; row < board.rows - 1; row++) {
    for (let col = 0; col < board.cols - 1; col++) {
      const square = squareAt(board, { row, col });
      if (square) squares.push(square);
    }
  }
  return squares;
}

/** Dizi ve kareleri, ortak kare paylaşanları birleştirerek gruplara ayırır. */
export function findMatchGroups(
  board: Board,
  minMatch: number = BOARD_CONFIG.minMatch,
): MatchGroup[] {
  const runs = findRuns(board, minMatch);
  const squares = findSquares(board);
  const shapes: { cells: readonly Pos[]; color: TileColor }[] = [...runs, ...squares];
  if (shapes.length === 0) return [];

  // Union–find: aynı kareyi içeren şekiller aynı gruba düşer.
  const parent = shapes.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const owner = new Map<string, number>();
  shapes.forEach((shape, i) => {
    for (const cell of shape.cells) {
      const key = posKey(cell);
      const other = owner.get(key);
      if (other === undefined) owner.set(key, i);
      else parent[find(i)] = find(other);
    }
  });

  const byRoot = new Map<number, number[]>();
  shapes.forEach((_, i) => {
    const root = find(i);
    const list = byRoot.get(root);
    if (list) list.push(i);
    else byRoot.set(root, [i]);
  });

  return [...byRoot.values()].map((members) => {
    const groupRuns = members.filter((i) => i < runs.length).map((i) => runs[i]);
    const groupSquares = members.filter((i) => i >= runs.length).map((i) => squares[i - runs.length]);
    return {
      color: shapes[members[0]].color,
      runs: groupRuns,
      squares: groupSquares,
      cells: uniquePositions(members.flatMap((i) => shapes[i].cells)),
    };
  });
}

export function hasAnyMatch(board: Board, minMatch: number = BOARD_CONFIG.minMatch): boolean {
  return findRuns(board, minMatch).length > 0 || findSquares(board).length > 0;
}

function lineThrough(board: Board, p: Pos, dRow: number, dCol: number, color: TileColor): Pos[] {
  const cells: Pos[] = [p];
  for (const sign of [-1, 1]) {
    let q = { row: p.row + dRow * sign, col: p.col + dCol * sign };
    while (matchColor(board.getTile(q)) === color) {
      cells.push(q);
      q = { row: q.row + dRow * sign, col: q.col + dCol * sign };
    }
  }
  return cells;
}

/**
 * Yalnızca p karesinden geçen eşleşmelerin kareleri (yoksa boş dizi).
 * Tüm tahtayı taramadan hızlı yerel kontrol — olası hamle aramada ve tahta üretiminde kullanılır.
 */
export function matchCellsAt(
  board: Board,
  p: Pos,
  minMatch: number = BOARD_CONFIG.minMatch,
): Pos[] {
  const color = matchColor(board.getTile(p));
  if (color === null) return [];
  const horizontal = lineThrough(board, p, 0, 1, color);
  const vertical = lineThrough(board, p, 1, 0, color);
  const cells: Pos[] = [];
  if (horizontal.length >= minMatch) cells.push(...horizontal);
  if (vertical.length >= minMatch) cells.push(...vertical);
  if (BOARD_CONFIG.squareMatches) {
    for (const [dRow, dCol] of [
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 0],
    ]) {
      const square = squareAt(board, { row: p.row + dRow, col: p.col + dCol });
      if (square) cells.push(...square.cells);
    }
  }
  return uniquePositions(cells);
}
