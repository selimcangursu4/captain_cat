import { Board } from '../../src/core/Board';
import type { BoardShape } from '../../src/core/BoardShape';
import { settle } from '../../src/core/gravity';
import type { ObstacleKind } from '../../src/core/obstacles';
import type { TileSpawner } from '../../src/core/spawner';
import type { Pos, SpecialKind, Tile, TileColor } from '../../src/core/types';

/**
 * Testlerde tahtayı harflerle yazmak için:
 *   F = balık (fish), A = çapa (anchor), S = deniz kabuğu (shell),
 *   R = can simidi (ring), T = deniz yıldızı (star),
 *   _ = oynanabilir ama boş kare, . = boşluk (tahtada yok)
 */
const LETTER_TO_COLOR: Record<string, TileColor> = {
  F: 'fish',
  A: 'anchor',
  S: 'shell',
  R: 'ring',
  T: 'star',
};
const COLOR_TO_LETTER = Object.fromEntries(
  Object.entries(LETTER_TO_COLOR).map(([letter, color]) => [color, letter]),
) as Record<TileColor, string>;

export function colorOf(letter: string): TileColor {
  const color = LETTER_TO_COLOR[letter];
  if (!color) throw new Error(`Bilinmeyen taş harfi: ${letter}`);
  return color;
}

export function boardFrom(lines: readonly string[]): Board {
  const rows = lines.length;
  const cols = lines[0].length;
  const playable = lines.flatMap((line) => [...line].map((ch) => ch !== '.'));
  const shape: BoardShape = { rows, cols, playable };
  const board = new Board(shape);
  lines.forEach((line, row) =>
    [...line].forEach((ch, col) => {
      if (ch === '.' || ch === '_') return;
      board.setTile({ row, col }, board.createTile(colorOf(ch)));
    }),
  );
  return board;
}

export function boardToLines(board: Board): string[] {
  const lines: string[] = [];
  for (let row = 0; row < board.rows; row++) {
    let line = '';
    for (let col = 0; col < board.cols; col++) {
      const p = { row, col };
      if (!board.isPlayable(p)) line += '.';
      else line += board.getTile(p) ? COLOR_TO_LETTER[board.getTile(p)!.color] : '_';
    }
    lines.push(line);
  }
  return lines;
}

/** Yeni taşları verilen harf sırasıyla üretir; liste biterse hata verir (test eksik yazılmış demektir). */
export class ScriptedSpawner implements TileSpawner {
  private readonly queue: string[];

  constructor(letters: string) {
    this.queue = [...letters];
  }

  get remaining(): number {
    return this.queue.length;
  }

  spawn(board: Board): Tile {
    const letter = this.queue.shift();
    if (!letter) throw new Error('ScriptedSpawner: senaryodaki taşlar bitti');
    return board.createTile(colorOf(letter));
  }
}

/**
 * Hiçbir kaydırmanın eşleşme oluşturamadığı "ölü" tahta.
 * (col + 2*row) % 5 deseninde aynı renkler aynı satır/sütunda 5 kareden yakın olamaz.
 */
export function deadBoardLines(rows: number, cols: number): string[] {
  const letters = 'FASRT';
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => letters[(col + 2 * row) % 5]).join(''),
  );
}

/** Kareyi boşaltıp blok engel (kum torbası, sandık, yuva) koyar. */
export function placeBlock(board: Board, row: number, col: number, kind: ObstacleKind, layers: number): void {
  board.setTile({ row, col }, null);
  board.placeObstacle({ row, col }, kind, layers);
}

/** Tahtada kalıcı hareket kalmadı mı? (Kopya üzerinde yerçekimi çalıştırılır.) */
export function isSettled(board: Board): boolean {
  const copy = board.clone();
  let spawned = false;
  const result = settle(copy, () => {
    spawned = true;
    return copy.createTile('fish');
  });
  return !spawned && result.falls.length === 0;
}

/** Testte bir taşı güçlendiriciye çevirir (rengi korunur). */
export function setSpecial(board: Board, row: number, col: number, special: SpecialKind): Tile {
  const tile = board.getTile({ row, col });
  if (!tile) throw new Error(`(${row},${col}) boş`);
  tile.special = special;
  return tile;
}

export function sortedPositions(list: readonly Pos[]): string[] {
  return list.map((p) => `${p.row},${p.col}`).sort();
}

export function allTileIds(board: Board): number[] {
  return board
    .playablePositions()
    .map((p) => board.getTile(p))
    .filter((t): t is Tile => t !== null)
    .map((t) => t.id);
}
