import type { Pos } from './types';

export function pos(row: number, col: number): Pos {
  return { row, col };
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function posKey(p: Pos): string {
  return `${p.row},${p.col}`;
}

export function offset(p: Pos, dRow: number, dCol: number): Pos {
  return { row: p.row + dRow, col: p.col + dCol };
}

/** Konum listesindeki tekrarları atar (ilk görülen sıra korunur). */
export function uniquePositions(list: readonly Pos[]): Pos[] {
  const seen = new Set<string>();
  const out: Pos[] = [];
  for (const p of list) {
    const key = posKey(p);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}
