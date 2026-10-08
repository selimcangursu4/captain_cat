import { BOARD_CONFIG } from '../config/board';
import type { Board } from './Board';
import { posKey } from './pos';
import type { Pos, Tile } from './types';

/** Yoldaki bir nokta: taş `tick` anında `pos` karesine varır. */
export interface PathStep {
  readonly pos: Pos;
  readonly tick: number;
}

/** Bir taşın düşüşü. path[0] başlangıç karesi; her adım bir kare (dikey veya çapraz). */
export interface FallMove {
  readonly tileId: number;
  readonly from: Pos;
  readonly to: Pos;
  readonly path: readonly PathStep[];
}

/**
 * Yukarıdan gelen yeni taş. path[0], sütunun en üst karesinin hemen üstündeki
 * sanal noktadır (tahtanın dışında; görünüm orayı maskeyle gizler).
 */
export interface SpawnMove {
  readonly tile: Tile;
  readonly to: Pos;
  readonly path: readonly PathStep[];
}

export interface SettleResult {
  readonly falls: FallMove[];
  readonly spawns: SpawnMove[];
  /** Son hareketin gerçekleştiği adım (animasyon süresi için). */
  readonly ticks: number;
}

/** Karedeki taş yerçekimiyle hareket edebilir mi? (Ağ içindeki taş edemez.) */
export function isMovable(board: Board, p: Pos): boolean {
  return board.getTile(p) !== null && !board.isCovered(p);
}

function isFree(board: Board, p: Pos): boolean {
  return board.canHoldTile(p) && board.getTile(p) === null;
}

/**
 * Taşları adım adım yerleştirir. Her adımda (tick) her taş en fazla bir kare ilerler:
 *  1) dikey: altı boş olan taş bir kare iner (boşluklar atlanır, taş arkasından geçer),
 *  2) yeni taş: sütunun en üst karesi boşsa yukarıdan taş gelir,
 *  3) çapraz: üstünden besleme alamayan boş kareye (ör. kum torbasının altı)
 *     sol/sağ üst çaprazdaki taş kayar.
 * Hareket kalmayınca durur. Ulaşılamayan kareler (tamamen kapalı bölgeler) boş kalabilir.
 *
 * Yeni taşların üretim sırası: adım adım, her adımda sütunlar soldan sağa.
 */
export function settle(
  board: Board,
  createTile: (p: Pos) => Tile,
  maxTicks: number = BOARD_CONFIG.maxSettleTicks,
): SettleResult {
  const columns = Array.from({ length: board.cols }, (_, col) => board.columnPositions(col));
  const indexInColumn = new Map<string, number>();
  columns.forEach((cells) => cells.forEach((p, i) => indexInColumn.set(posKey(p), i)));

  const paths = new Map<number, PathStep[]>();
  const spawned = new Map<number, Tile>();
  let lastTick = 0;

  const move = (tile: Tile, from: Pos, to: Pos, tick: number) => {
    board.setTile(from, null);
    board.setTile(to, tile);
    let path = paths.get(tile.id);
    if (!path) {
      path = [{ pos: from, tick: tick - 1 }];
      paths.set(tile.id, path);
    }
    path.push({ pos: to, tick });
  };

  /** e karesine üstünden (aynı sütundan) taş gelebilir mi? */
  const hasVerticalSupply = (e: Pos): boolean => {
    const cells = columns[e.col];
    for (let i = indexInColumn.get(posKey(e))! - 1; i >= 0; i--) {
      const c = cells[i];
      if (board.isBlocked(c) || board.isCovered(c)) return false;
      if (board.getTile(c)) return true;
    }
    return true; // sütunun tepesine kadar boş: yeni taş gelecek
  };

  for (let tick = 1; tick <= maxTicks; tick++) {
    const movedNow = new Set<number>();

    // 1) Dikey düşüş (aşağıdan yukarı: bir sütun aynı adımda birlikte iner).
    for (let row = board.rows - 1; row >= 0; row--) {
      for (let col = 0; col < board.cols; col++) {
        const p = { row, col };
        if (!board.isPlayable(p) || !isMovable(board, p)) continue;
        const tile = board.getTile(p)!;
        if (movedNow.has(tile.id)) continue;
        const next = columns[col][indexInColumn.get(posKey(p))! + 1];
        if (!next || !isFree(board, next)) continue;
        move(tile, p, next, tick);
        movedNow.add(tile.id);
      }
    }

    // 2) Yeni taşlar.
    for (let col = 0; col < board.cols; col++) {
      const top = columns[col][0];
      if (!top || !isFree(board, top)) continue;
      const tile = createTile(top);
      board.setTile(top, tile);
      spawned.set(tile.id, tile);
      paths.set(tile.id, [
        { pos: { row: top.row - 1, col }, tick: tick - 1 },
        { pos: top, tick },
      ]);
      movedNow.add(tile.id);
    }

    // 3) Çapraz kayma: yalnızca üstünden beslenemeyen boş kareler için.
    for (let row = board.rows - 1; row >= 1; row--) {
      for (let col = 0; col < board.cols; col++) {
        const e = { row, col };
        if (!board.isPlayable(e) || !isFree(board, e) || hasVerticalSupply(e)) continue;
        const sides = (tick + col) % 2 === 0 ? [-1, 1] : [1, -1];
        for (const dc of sides) {
          const u = { row: row - 1, col: col + dc };
          if (!board.isPlayable(u) || !isMovable(board, u)) continue;
          const tile = board.getTile(u)!;
          if (movedNow.has(tile.id)) continue;
          move(tile, u, e, tick);
          movedNow.add(tile.id);
          break;
        }
      }
    }

    if (movedNow.size === 0) break;
    lastTick = tick;
  }

  const falls: FallMove[] = [];
  const spawns: SpawnMove[] = [];
  for (const [tileId, path] of paths) {
    const tile = spawned.get(tileId);
    const to = path[path.length - 1].pos;
    if (tile) spawns.push({ tile, to, path });
    else falls.push({ tileId, from: path[0].pos, to, path });
  }
  return { falls, spawns, ticks: lastTick };
}
