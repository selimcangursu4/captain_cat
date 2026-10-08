import type { Board } from '../Board';
import { matchCellsAt } from '../matchFinder';
import { uniquePositions } from '../pos';
import { canSwap, isSwappable } from '../possibleMoves';
import type { Pos, SpecialKind, TileColor } from '../types';

/**
 * Öğretici adımları (bölüm dosyasındaki "tutorial" dizisi). `text` bir i18n anahtarıdır.
 *  swap            — gösterilen kaydırmayı yaptır (yalnızca bu hamle kabul edilir)
 *  tap             — tahtadaki o türden güçlendiriciye dokundur
 *  swapSpecials    — yan yana duran iki güçlendiriciyi birleştirt
 *  swapSpecialWith — güçlendiriciyi (ör. Girdap) komşu bir taşla değiştirt; `color` varsa o renk tercih edilir
 *  (yalnızca text) — mesaj; oyuncu dokununca kapanır
 */
export type TutorialStep =
  | { readonly text: string; readonly swap: readonly [Pos, Pos]; readonly expect?: { readonly creates?: SpecialKind } }
  | { readonly text: string; readonly tap: SpecialKind }
  | { readonly text: string; readonly swapSpecials: true }
  | { readonly text: string; readonly swapSpecialWith: SpecialKind; readonly color?: TileColor }
  | { readonly text: string };

/** O anki tahtaya göre çözülmüş adım: hangi kareler aydınlatılacak, hangi hamle beklenecek. */
export type ResolvedTutorialStep =
  | { readonly kind: 'swap'; readonly text: string; readonly a: Pos; readonly b: Pos; readonly highlight: readonly Pos[] }
  | { readonly kind: 'tap'; readonly text: string; readonly at: Pos; readonly highlight: readonly Pos[] }
  | { readonly kind: 'message'; readonly text: string };

const NEIGHBORS = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const;

function findSpecial(board: Board, kind: SpecialKind): Pos | null {
  return board.playablePositions().find((p) => board.getTile(p)?.special === kind && isSwappable(board, p)) ?? null;
}

/**
 * Kaydırma sonrası eşleşecek kareler ve eşleşmenin hasar vereceği komşu engeller
 * (kum torbası, sandık, yuva, ağ) — öğreticide aydınlatmak için.
 */
function previewMatch(board: Board, a: Pos, b: Pos): Pos[] {
  board.swap(a, b);
  const cells = uniquePositions([...matchCellsAt(board, a), ...matchCellsAt(board, b)]);
  board.swap(a, b);
  const affected = cells.flatMap((c) =>
    NEIGHBORS.map(([dRow, dCol]) => ({ row: c.row + dRow, col: c.col + dCol })).filter(
      (n) => board.isBlocked(n) || board.isCovered(n),
    ),
  );
  return uniquePositions([...cells, ...affected]);
}

/**
 * Adımı tahtanın şu anki durumuna göre çözer. Beklenen hamle artık mümkün değilse
 * (ör. güçlendirici zincirde patladıysa) null döner ve adım atlanır.
 */
export function resolveTutorialStep(step: TutorialStep, board: Board): ResolvedTutorialStep | null {
  if ('swap' in step) {
    const [a, b] = step.swap;
    if (!canSwap(board, a, b)) return null;
    return { kind: 'swap', text: step.text, a, b, highlight: uniquePositions([a, b, ...previewMatch(board, a, b)]) };
  }
  if ('tap' in step) {
    const at = findSpecial(board, step.tap);
    return at ? { kind: 'tap', text: step.text, at, highlight: [at] } : null;
  }
  if ('swapSpecials' in step) {
    for (const p of board.playablePositions()) {
      if (!board.getTile(p)?.special || !isSwappable(board, p)) continue;
      for (const [dRow, dCol] of NEIGHBORS) {
        const q = { row: p.row + dRow, col: p.col + dCol };
        if (board.getTile(q)?.special && canSwap(board, p, q)) {
          return { kind: 'swap', text: step.text, a: p, b: q, highlight: [p, q] };
        }
      }
    }
    return null;
  }
  if ('swapSpecialWith' in step) {
    const at = findSpecial(board, step.swapSpecialWith);
    if (!at) return null;
    const options = NEIGHBORS.map(([dRow, dCol]) => ({ row: at.row + dRow, col: at.col + dCol })).filter(
      (q) => canSwap(board, at, q) && !board.getTile(q)!.special,
    );
    const target = options.find((q) => board.getTile(q)!.color === step.color) ?? options[0];
    return target ? { kind: 'swap', text: step.text, a: at, b: target, highlight: [at, target] } : null;
  }
  return { kind: 'message', text: step.text };
}

/** Öğretici adımı sırasında oyuncunun hamlesi kabul edilir mi? (a = b: dokunma) */
export function tutorialAllows(step: ResolvedTutorialStep, a: Pos, b: Pos): boolean {
  const same = (p: Pos, q: Pos) => p.row === q.row && p.col === q.col;
  switch (step.kind) {
    case 'message':
      return false;
    case 'swap':
      return (same(a, step.a) && same(b, step.b)) || (same(a, step.b) && same(b, step.a));
    case 'tap':
      // Güçlendiriciye dokunmak ya da onu herhangi bir yöne kaydırmak.
      return same(a, step.at) || same(b, step.at);
  }
}
