import type { Board } from './Board';
import type { MatchGroup, Orientation } from './matchFinder';
import { posKey, uniquePositions } from './pos';
import type { Pos, SpecialKind } from './types';

/** Bir eşleşme grubundan doğacak güçlendirici ve yeri. */
export interface SpecialPlan {
  readonly special: SpecialKind;
  readonly pos: Pos;
}

export interface PlanContext {
  /** Oyuncunun kaydırdığı kareler (öncelik sırasıyla: hedef kare, başlangıç karesi). */
  readonly swapCells?: readonly Pos[];
  readonly swapAxis?: Orientation;
  /** Önceki zincir adımında taş düşen/gelen kareler. */
  readonly recentlyMoved?: ReadonlySet<string>;
  /** Güçlendiricinin doğamayacağı kareler (ör. ağ altındaki taş). */
  readonly isExcluded?: (p: Pos) => boolean;
}

/** Eşleşme şekli → güçlendirici türü (yön hariç). Öncelik: 5'li > L/T > 4'lü > 2x2. */
export function classifyGroup(group: MatchGroup): 'whirlpool' | 'cannon' | 'harpoon' | 'seagull' | null {
  const longest = Math.max(0, ...group.runs.map((r) => r.cells.length));
  if (longest >= 5) return 'whirlpool';
  const hasHorizontal = group.runs.some((r) => r.orientation === 'horizontal');
  const hasVertical = group.runs.some((r) => r.orientation === 'vertical');
  if (hasHorizontal && hasVertical) return 'cannon';
  if (longest === 4) return 'harpoon';
  if (group.squares.length > 0) return 'seagull';
  return null;
}

/** Grup için güçlendirici planı; düz 3'lü eşleşmede null. */
export function planSpecial(group: MatchGroup, ctx: PlanContext = {}): SpecialPlan | null {
  const kind = classifyGroup(group);
  if (!kind) return null;

  const allowed = (p: Pos) => !ctx.isExcluded?.(p);
  const inGroup = (p: Pos) => group.cells.some((c) => c.row === p.row && c.col === p.col);
  const swapCell = ctx.swapCells?.find((p) => inGroup(p) && allowed(p));
  const candidates = group.cells.filter(allowed);
  if (candidates.length === 0) return null;

  let special: SpecialKind;
  if (kind === 'harpoon') {
    const run = group.runs.find((r) => r.cells.length === 4)!;
    // Oyuncu kaydırdıysa kaydırma yönü; zincirlemede eşleşmeye dik yön.
    const axis: Orientation =
      swapCell && ctx.swapAxis
        ? ctx.swapAxis
        : run.orientation === 'horizontal'
          ? 'vertical'
          : 'horizontal';
    special = axis === 'horizontal' ? 'harpoon-h' : 'harpoon-v';
  } else {
    special = kind;
  }

  return { special, pos: swapCell ?? choosePosition(group, kind, ctx, allowed) };
}

function choosePosition(
  group: MatchGroup,
  kind: 'whirlpool' | 'cannon' | 'harpoon' | 'seagull',
  ctx: PlanContext,
  allowed: (p: Pos) => boolean,
): Pos {
  if (kind === 'cannon') {
    const horizontal = new Set(
      group.runs.filter((r) => r.orientation === 'horizontal').flatMap((r) => r.cells.map(posKey)),
    );
    const corner = group.runs
      .filter((r) => r.orientation === 'vertical')
      .flatMap((r) => r.cells)
      .find((p) => horizontal.has(posKey(p)) && allowed(p));
    if (corner) return corner;
  }

  // Zincirlemede: en son hareket eden taşlardan en alttaki.
  if (ctx.recentlyMoved) {
    const moved = group.cells
      .filter((p) => ctx.recentlyMoved!.has(posKey(p)) && allowed(p))
      .sort((a, b) => b.row - a.row || a.col - b.col);
    if (moved.length > 0) return moved[0];
  }

  const longest = [...group.runs].sort((a, b) => b.cells.length - a.cells.length)[0];
  if (longest) {
    const middle = longest.cells[Math.floor(longest.cells.length / 2)];
    if (allowed(middle)) return middle;
  }
  return group.cells.find(allowed)!;
}

// ───────────────────────── etki alanları ─────────────────────────

export function rowCells(board: Board, row: number): Pos[] {
  const cells: Pos[] = [];
  for (let col = 0; col < board.cols; col++) {
    if (board.isPlayable({ row, col })) cells.push({ row, col });
  }
  return cells;
}

export function colCells(board: Board, col: number): Pos[] {
  return [...board.columnPositions(col)];
}

/** Merkezden en fazla `radius` kare uzaktaki (Chebyshev) oynanabilir kareler. */
export function areaCells(board: Board, center: Pos, radius: number): Pos[] {
  const cells: Pos[] = [];
  for (let row = center.row - radius; row <= center.row + radius; row++) {
    for (let col = center.col - radius; col <= center.col + radius; col++) {
      if (board.isPlayable({ row, col })) cells.push({ row, col });
    }
  }
  return cells;
}

/** Merkez + 4 komşu. */
export function plusCells(board: Board, center: Pos): Pos[] {
  return [
    center,
    { row: center.row - 1, col: center.col },
    { row: center.row + 1, col: center.col },
    { row: center.row, col: center.col - 1 },
    { row: center.row, col: center.col + 1 },
  ].filter((p) => board.isPlayable(p));
}

/** Satır ve sütun bantları: merkezin ±spread satırı ve ±spread sütunu. */
export function bandCells(board: Board, center: Pos, spread: number): Pos[] {
  const cells: Pos[] = [];
  for (let d = -spread; d <= spread; d++) {
    if (center.row + d >= 0 && center.row + d < board.rows) cells.push(...rowCells(board, center.row + d));
    if (center.col + d >= 0 && center.col + d < board.cols) cells.push(...colCells(board, center.col + d));
  }
  return uniquePositions(cells);
}
