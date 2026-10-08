import { BOARD_CONFIG } from '../config/board';
import type { Board } from './Board';
import { pickSafeColor } from './generator';
import { hasAnyMatch } from './matchFinder';
import { hasPossibleMove, isSwappable } from './possibleMoves';
import type { Random } from './Random';
import type { Pos, Tile, TileColor } from './types';

/** Karıştırmada bir taşın yeni yeri. `color` değişmişse görünüm dokusunu günceller. */
export interface ShuffleMove {
  readonly tileId: number;
  readonly from: Pos;
  readonly to: Pos;
  readonly color: TileColor;
}

function isPlayableArrangement(board: Board, minMatch: number): boolean {
  return !hasAnyMatch(board, minMatch) && hasPossibleMove(board, minMatch);
}

/**
 * Hareket edebilen taşları, eşleşme olmayan ve en az bir hamlesi olan bir dizilime karıştırır.
 * Önce mevcut renkleri yer değiştirerek dener; olmazsa renkleri yeniden atar.
 * Hiçbiri başarılı olmazsa tahtayı eski haline getirip null döndürür.
 */
export function shuffleBoard(
  board: Board,
  rng: Random,
  colors: readonly TileColor[] = BOARD_CONFIG.defaultColors,
  minMatch: number = BOARD_CONFIG.minMatch,
  maxAttempts: number = BOARD_CONFIG.maxShuffleAttempts,
): ShuffleMove[] | null {
  const positions = board.playablePositions().filter((p) => isSwappable(board, p));
  const tiles = positions.map((p) => board.getTile(p)!);
  const originalColors = tiles.map((t) => t.color);
  const origin = new Map<number, Pos>();
  tiles.forEach((t, i) => origin.set(t.id, positions[i]));

  const place = (order: readonly Tile[]) =>
    positions.forEach((p, i) => board.setTile(p, order[i]));
  const result = (): ShuffleMove[] =>
    positions.map((p) => {
      const tile = board.getTile(p)!;
      return { tileId: tile.id, from: origin.get(tile.id)!, to: p, color: tile.color };
    });

  // 1) Aynı taşlar, farklı yerler.
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    place(rng.shuffle([...tiles]));
    if (isPlayableArrangement(board, minMatch)) return result();
  }

  // 2) Yedek plan: taşları karıştırıp renklerini güvenli şekilde yeniden ata.
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const order = rng.shuffle([...tiles]);
    positions.forEach((p) => board.setTile(p, null));
    positions.forEach((p, i) => {
      order[i].color = pickSafeColor(board, p, rng, colors, minMatch);
      board.setTile(p, order[i]);
    });
    if (isPlayableArrangement(board, minMatch)) return result();
  }

  tiles.forEach((t, i) => (t.color = originalColors[i]));
  place(tiles);
  return null;
}
